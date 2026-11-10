import { Router } from 'express';
import type { GymProfile, HourSlot, Offer, PublicLanding, PublicPlan } from '@gym/shared';
import { pool, select, selectOne } from '../db/pool';
import { asyncHandler } from '../utils/http';

const router = Router();

export const OFFER_COLUMNS = 'id, title, highlight, description, code, valid_from, valid_until, is_active';
export const PROFILE_SQL = `SELECT gym_name, tagline, about, address, contact_phone, contact_email, facilities
                              FROM settings WHERE id = 1`;
export const HOURS_SQL = `SELECT day_of_week, to_char(opens_at, 'HH24:MI') AS opens_at,
                                 to_char(closes_at, 'HH24:MI') AS closes_at, label
                            FROM gym_hours ORDER BY day_of_week, opens_at`;

/**
 * The landing page. No sign-in needed, and the same for everyone. Only content the owner
 * chose to publish is returned: never owner contact details, notes, members or alert settings.
 */
router.get('/landing', asyncHandler(async (_req, res) => {
  const [gym, hours, plans, offers, today] = await Promise.all([
    selectOne<GymProfile>(pool, PROFILE_SQL),
    select<HourSlot>(pool, HOURS_SQL),
    select<PublicPlan>(
      pool,
      `SELECT id, name, price, duration_months, description, features, is_featured
         FROM plans WHERE is_active ORDER BY duration_months, price`,
    ),
    select<Offer>(
      pool,
      `SELECT ${OFFER_COLUMNS} FROM offers
        WHERE is_active
          AND (valid_from IS NULL OR valid_from <= app_today())
          AND (valid_until IS NULL OR valid_until >= app_today())
        ORDER BY id DESC`,
    ),
    selectOne<{ today: string }>(pool, 'SELECT app_today() AS today'),
  ]);
  const body: PublicLanding = { gym: gym!, hours, plans, offers, today: today!.today };
  res.json(body);
}));

export default router;
