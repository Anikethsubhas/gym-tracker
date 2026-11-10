import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { normalizeIndianPhone } from '@gym/shared';
import { pool, withTransaction } from './pool';

const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const password = process.env.OWNER_PASSWORD ?? '';

try {
  if (!email || password.length < 8) {
    throw new Error('Set OWNER_EMAIL and an OWNER_PASSWORD of at least 8 characters in apps/api/.env first.');
  }
  const hash = await bcrypt.hash(password, 10);

  await withTransaction(async (db) => {
    // The owner is an ordinary user who holds the 'owner' role. Re-running this resets the password.
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, is_active = true
       RETURNING id`,
      [process.env.OWNER_NAME || 'Owner', email, hash],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE key = 'owner' ON CONFLICT DO NOTHING`,
      [rows[0].id],
    );

    const ownerPhone = process.env.OWNER_PHONE ? normalizeIndianPhone(process.env.OWNER_PHONE) : null;
    await db.query(
      `UPDATE settings SET gym_name = COALESCE($1, gym_name), owner_phone = COALESCE($2, owner_phone) WHERE id = 1`,
      [process.env.GYM_NAME || null, ownerPhone],
    );

    const plans = await db.query('SELECT COUNT(*)::int AS n FROM plans');
    if (plans.rows[0].n === 0) {
      await db.query(
        `INSERT INTO plans (name, price, duration_months, description)
         VALUES ('Monthly', 1000, 1, 'Standard monthly membership. Edit the price on the Plans page.')`,
      );
      console.log('Created a starter "Monthly" plan. Update its price on the Plans page.');
    }
  });

  console.log(`Owner login ready: ${email}`);
} catch (err) {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
