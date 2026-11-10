import { Router } from 'express';
import { hoursSchema, websiteProfileSchema, type GymProfile, type HourSlot, type WebsiteAdminData } from '@gym/shared';
import { pool, select, selectOne, withTransaction } from '../db/pool';
import { asyncHandler } from '../utils/http';
import { HOURS_SQL, PROFILE_SQL } from './public';

/** What the owner edits to change the public landing page (and what members see in the app). */
const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [profile, hours] = await Promise.all([selectOne<GymProfile>(pool, PROFILE_SQL), select<HourSlot>(pool, HOURS_SQL)]);
  const body: WebsiteAdminData = { profile: profile!, hours };
  res.json(body);
}));

router.put('/profile', asyncHandler(async (req, res) => {
  const d = websiteProfileSchema.parse(req.body);
  await pool.query(
    `UPDATE settings SET gym_name=$1, tagline=$2, about=$3, address=$4, contact_phone=$5, contact_email=$6,
            facilities=$7::text[], updated_at=now() WHERE id = 1`,
    [d.gym_name, d.tagline, d.about, d.address, d.contact_phone, d.contact_email, d.facilities],
  );
  res.json(await selectOne<GymProfile>(pool, PROFILE_SQL));
}));

/** Saves the whole weekly timetable in one go. A day with no slots is shown as closed. */
router.put('/hours', asyncHandler(async (req, res) => {
  const { slots } = hoursSchema.parse(req.body);
  const hours = await withTransaction(async (db) => {
    await db.query('DELETE FROM gym_hours');
    await db.query(
      `INSERT INTO gym_hours (day_of_week, opens_at, closes_at, label)
       SELECT * FROM unnest($1::smallint[], $2::time[], $3::time[], $4::text[])`,
      [slots.map((s) => s.day_of_week), slots.map((s) => s.opens_at), slots.map((s) => s.closes_at), slots.map((s) => s.label || null)],
    );
    return select<HourSlot>(db, HOURS_SQL);
  });
  res.json(hours);
}));

export default router;
