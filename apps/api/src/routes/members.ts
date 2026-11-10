import { Router } from 'express';
import {
  createMemberSchema, INVITE_VALID_DAYS, laterDate, normalizeIndianPhone, paymentSchema, subscriptionPatchSchema,
  updateMemberSchema,
  type AppAccessStatus, type InviteLink, type MemberDetail, type MemberOverview, type NotificationEntry, type Payment,
  type Plan, type RemindResponse,
} from '@gym/shared';
import { pool, select, selectOne, withTransaction, type Queryable } from '../db/pool';
import { asyncHandler, HttpError, parseId } from '../utils/http';
import { getSettings } from '../services/settings';
import { notify } from '../services/messaging';
import { hashToken, newToken } from '../utils/tokens';

const router = Router();

function phoneOrThrow(raw: string): string {
  const phone = normalizeIndianPhone(raw);
  if (!phone) throw new HttpError(400, 'phone: enter a valid 10-digit Indian mobile number.');
  return phone;
}

async function addMonths(db: Queryable, isoDate: string, months: number): Promise<string> {
  const row = await selectOne<{ d: string }>(
    db, `SELECT (($1::date + make_interval(months => $2::int))::date) AS d`, [isoDate, months],
  );
  return row!.d;
}

async function overviewOf(db: Queryable, id: number): Promise<MemberOverview> {
  const member = await selectOne<MemberOverview>(db, 'SELECT * FROM member_overview WHERE id = $1', [id]);
  if (!member) throw new HttpError(404, 'Member not found.');
  return member;
}

// ---------- list ----------
router.get('/', asyncHandler(async (req, res) => {
  const term = String(req.query.search ?? '').trim();
  const escaped = term.replace(/[\\%_]/g, '\\$&');
  const digits = term.replace(/\D/g, '');
  const status = String(req.query.status ?? '');
  const members = await select<MemberOverview>(
    pool,
    `SELECT * FROM member_overview
      WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR ($2 <> '' AND phone LIKE '%' || $2 || '%'))
        AND ($3 = '' OR payment_status = $3
             OR ($3 = 'inactive' AND payment_status IN ('paused', 'cancelled')))
      ORDER BY CASE payment_status
                 WHEN 'missed' THEN 0 WHEN 'overdue' THEN 1 WHEN 'due_soon' THEN 2
                 WHEN 'paid_up' THEN 3 ELSE 4 END,
               next_due_date, name`,
    [escaped, digits, status],
  );
  res.json(members);
}));

// ---------- create ----------
router.post('/', asyncHandler(async (req, res) => {
  const d = createMemberSchema.parse(req.body);
  const phone = phoneOrThrow(d.phone);

  const member = await withTransaction(async (db) => {
    const plan = await selectOne<Plan>(db, 'SELECT * FROM plans WHERE id = $1 AND is_active', [d.plan_id]);
    if (!plan) throw new HttpError(400, 'plan_id: choose an active plan.');

    const start = d.start_date ?? (await selectOne<{ t: string }>(db, 'SELECT app_today() AS t'))!.t;
    const paid = d.first_payment?.paid === true;
    const amount = d.first_payment?.amount ?? plan.price;
    if (paid && !(amount > 0)) throw new HttpError(400, 'first_payment.amount: enter the amount collected.');
    const nextDue = paid ? await addMonths(db, start, plan.duration_months) : start;

    // A member is a user (identity, can sign in once invited) who holds the 'member' role,
    // plus a members row for the gym-specific side.
    const user = await selectOne<{ id: number }>(
      db,
      `INSERT INTO users (name, phone, email) VALUES ($1,$2,$3) RETURNING id`,
      [d.name, phone, d.email ? d.email.toLowerCase() : null],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = 'member'`,
      [user!.id],
    );
    const created = await selectOne<{ id: number }>(
      db,
      `INSERT INTO members (user_id, notes, joined_on) VALUES ($1,$2,$3) RETURNING id`,
      [user!.id, d.notes || null, start],
    );
    const subscription = await selectOne<{ id: number }>(
      db,
      `INSERT INTO subscriptions (member_id, plan_id, start_date, next_due_date) VALUES ($1,$2,$3,$4) RETURNING id`,
      [created!.id, plan.id, start, nextDue],
    );
    if (paid) {
      await db.query(
        `INSERT INTO payments
           (member_id, subscription_id, plan_id, amount, method, paid_on,
            previous_due_date, period_start, period_end, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'First payment')`,
        [created!.id, subscription!.id, plan.id, amount, d.first_payment?.method ?? 'cash', start, start, start, nextDue],
      );
    }
    return overviewOf(db, created!.id);
  });

  res.status(201).json(member);
}));

// ---------- read one ----------
router.get('/:id', asyncHandler(async (req, res) => {
  const member = await overviewOf(pool, parseId(req.params.id));
  const [payments, notifications] = await Promise.all([
    select<Payment>(
      pool,
      `SELECT pay.*, pl.name AS plan_name FROM payments pay
         LEFT JOIN plans pl ON pl.id = pay.plan_id
        WHERE pay.member_id = $1 ORDER BY pay.id DESC`,
      [member.id],
    ),
    select<NotificationEntry>(
      pool,
      `SELECT n.*, $2::text AS member_name FROM notifications n
        WHERE n.member_id = $1 ORDER BY n.created_at DESC, n.id DESC LIMIT 30`,
      [member.id, member.name],
    ),
  ]);
  const access = await selectOne<{ has_password: boolean; invite_pending: boolean; last_login_at: string | null }>(
    pool,
    `SELECT (u.password_hash IS NOT NULL) AS has_password, u.last_login_at,
            EXISTS (SELECT 1 FROM user_invites i WHERE i.user_id = u.id AND i.used_at IS NULL AND i.expires_at > now()) AS invite_pending
       FROM users u WHERE u.id = $1`,
    [member.user_id],
  );
  const status: AppAccessStatus = access?.has_password ? 'active' : access?.invite_pending ? 'invited' : 'not_invited';
  const body: MemberDetail = {
    member, payments, notifications,
    app_access: { status, last_login_at: access?.last_login_at ?? null },
  };
  res.json(body);
}));

// ---------- update profile ----------
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = updateMemberSchema.parse(req.body);
  const phone = phoneOrThrow(d.phone);
  const member = await withTransaction(async (db) => {
    const row = await selectOne<{ user_id: number }>(db, 'SELECT user_id FROM members WHERE id = $1', [id]);
    if (!row) throw new HttpError(404, 'Member not found.');
    await db.query(
      `UPDATE users SET name=$1, phone=$2, email=$3, updated_at=now() WHERE id=$4`,
      [d.name, phone, d.email ? d.email.toLowerCase() : null, row.user_id],
    );
    await db.query('UPDATE members SET notes=$1, updated_at=now() WHERE id=$2', [d.notes || null, id]);
    return overviewOf(db, id);
  });
  res.json(member);
}));

// ---------- delete ----------
router.delete('/:id', asyncHandler(async (req, res) => {
  // Deleting the user removes the member, their subscription, payments, invites and role links with it.
  const result = await pool.query(
    'DELETE FROM users WHERE id = (SELECT user_id FROM members WHERE id = $1)',
    [parseId(req.params.id)],
  );
  if (!result.rowCount) throw new HttpError(404, 'Member not found.');
  res.status(204).end();
}));

// ---------- change plan / pause / resume / cancel ----------
router.patch('/:id/subscription', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = subscriptionPatchSchema.parse(req.body);
  if (d.plan_id) {
    const plan = await selectOne(pool, 'SELECT 1 FROM plans WHERE id = $1', [d.plan_id]);
    if (!plan) throw new HttpError(400, 'plan_id: plan not found.');
  }
  const result = await pool.query(
    `UPDATE subscriptions SET plan_id = COALESCE($1, plan_id), status = COALESCE($2, status),
            next_due_date = COALESCE($3::date, next_due_date), updated_at = now()
      WHERE member_id = $4`,
    [d.plan_id ?? null, d.status ?? null, d.next_due_date ?? null, id],
  );
  if (!result.rowCount) throw new HttpError(404, 'Member not found.');
  res.json(await overviewOf(pool, id));
}));

// ---------- record a payment ----------
// New due date = later of (current due date, payment date) + plan length.
// Paying early never loses days; paying late starts the new period on the payment date.
router.post('/:id/payments', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = paymentSchema.parse(req.body);

  const member = await withTransaction(async (db) => {
    const sub = await selectOne<{
      id: number; plan_id: number; next_due_date: string; duration_months: number; today: string;
    }>(
      db,
      `SELECT s.id, s.plan_id, s.next_due_date, p.duration_months, app_today() AS today
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.member_id = $1 FOR UPDATE OF s`,
      [id],
    );
    if (!sub) throw new HttpError(404, 'Member not found.');

    const paidOn = d.paid_on ?? sub.today;
    if (paidOn > sub.today) throw new HttpError(400, 'paid_on: the payment date cannot be in the future.');

    const periodStart = laterDate(sub.next_due_date, paidOn);
    const newDue = d.next_due_date ?? (await addMonths(db, periodStart, sub.duration_months));

    await db.query(
      `INSERT INTO payments
         (member_id, subscription_id, plan_id, amount, method, paid_on,
          previous_due_date, period_start, period_end, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, sub.id, sub.plan_id, d.amount, d.method, paidOn, sub.next_due_date, periodStart, newDue, d.note || null],
    );
    await db.query(
      `UPDATE subscriptions SET next_due_date = $1, status = 'active', updated_at = now() WHERE id = $2`,
      [newDue, sub.id],
    );
    return overviewOf(db, id);
  });

  res.status(201).json(member);
}));

// ---------- undo the most recent payment (entered by mistake) ----------
router.delete('/:id/payments/:paymentId', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const paymentId = parseId(req.params.paymentId);

  const member = await withTransaction(async (db) => {
    const latest = await selectOne<Payment>(
      db, 'SELECT * FROM payments WHERE member_id = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE', [id],
    );
    if (!latest) throw new HttpError(404, 'Payment not found.');
    if (latest.id !== paymentId) throw new HttpError(409, 'Only the most recent payment can be removed.');

    if (latest.previous_due_date) {
      await db.query(
        'UPDATE subscriptions SET next_due_date = $1, updated_at = now() WHERE id = $2',
        [latest.previous_due_date, latest.subscription_id],
      );
    }
    await db.query('DELETE FROM payments WHERE id = $1', [latest.id]);
    return overviewOf(db, id);
  });
  res.json(member);
}));

// ---------- create a sign-in link for the member ----------
// Works for first-time setup and for a forgotten password. Any earlier unused link stops working.
router.post('/:id/invite', asyncHandler(async (req, res) => {
  const row = await selectOne<{ user_id: number }>(pool, 'SELECT user_id FROM members WHERE id = $1', [parseId(req.params.id)]);
  if (!row) throw new HttpError(404, 'Member not found.');
  const token = newToken();
  const expiresAt = await withTransaction(async (db) => {
    await db.query('UPDATE user_invites SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
    const invite = await selectOne<{ expires_at: string }>(
      db,
      `INSERT INTO user_invites (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING expires_at`,
      [row.user_id, hashToken(token), INVITE_VALID_DAYS],
    );
    return invite!.expires_at;
  });
  const body: InviteLink = { token, expires_at: expiresAt };
  res.status(201).json(body);
}));

// ---------- send a reminder right now ----------
router.post('/:id/remind', asyncHandler(async (req, res) => {
  const member = await overviewOf(pool, parseId(req.params.id));
  if (member.subscription_status !== 'active') {
    throw new HttpError(409, 'This membership is not active, so no reminder was sent.');
  }
  const settings = await getSettings();
  const kind = member.days_until_due < 0 ? 'missed_member' : 'reminder';
  const results = await notify({ kind, member, settings, trigger: 'manual', force: true });
  const body: RemindResponse = { kind, results };
  res.json(body);
}));

export default router;
