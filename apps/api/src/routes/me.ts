import { Router } from 'express';
import { myProfileSchema, type MemberOverview, type MyMembership, type MyPayment, type MyReminder } from '@gym/shared';
import { config } from '../config';
import { pool, select, selectOne } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/http';

/**
 * Everything here is about the signed-in member and nobody else: there is no id in any URL,
 * the member is always looked up from the session. The owner's private notes are never sent.
 */
const router = Router();

router.get('/membership', asyncHandler(async (req, res) => {
  const m = await selectOne<MemberOverview & { reminder_on: string; reminder_days_before: number; grace_days: number; today: string }>(
    pool,
    `SELECT mo.*, (mo.next_due_date - st.reminder_days_before) AS reminder_on,
            st.reminder_days_before, st.grace_days, app_today() AS today
       FROM member_overview mo CROSS JOIN settings st WHERE mo.user_id = $1`,
    [req.user!.id],
  );
  if (!m) throw new HttpError(404, 'No membership is linked to this account yet.');

  const visible = config.messaging.dryRun ? ['sent', 'dry_run'] : ['sent'];
  const [payments, reminders] = await Promise.all([
    select<MyPayment>(
      pool,
      `SELECT pay.id, pay.amount, pay.method, pay.paid_on, pay.period_end, pl.name AS plan_name
         FROM payments pay LEFT JOIN plans pl ON pl.id = pay.plan_id
        WHERE pay.member_id = $1 ORDER BY pay.id DESC`,
      [m.id],
    ),
    // One entry per message, however many channels it went out on. Failed attempts are not shown.
    select<MyReminder>(
      pool,
      `SELECT kind, due_date, MIN(created_at) AS sent_at, array_agg(DISTINCT channel) AS channels,
              MAX(message_preview) AS message
         FROM notifications
        WHERE member_id = $1 AND kind IN ('reminder', 'missed_member') AND status = ANY($2)
        GROUP BY kind, due_date ORDER BY MIN(created_at) DESC LIMIT 20`,
      [m.id, visible],
    ),
  ]);

  const body: MyMembership = {
    membership: {
      name: m.name, phone: m.phone, email: m.email, joined_on: m.joined_on,
      plan_name: m.plan_name, plan_price: m.plan_price, duration_months: m.duration_months,
      start_date: m.start_date, next_due_date: m.next_due_date,
      subscription_status: m.subscription_status, days_until_due: m.days_until_due, payment_status: m.payment_status,
    },
    payments,
    reminders,
    reminder_days_before: m.reminder_days_before,
    grace_days: m.grace_days,
    reminder_on: m.payment_status === 'paid_up' ? m.reminder_on : null,
    today: m.today,
  };
  res.json(body);
}));

/** Members can keep their own email up to date. Name and phone are changed by the gym. */
router.put('/profile', asyncHandler(async (req, res) => {
  const { email } = myProfileSchema.parse(req.body);
  await pool.query('UPDATE users SET email = $1, updated_at = now() WHERE id = $2', [email ? email.toLowerCase() : null, req.user!.id]);
  res.status(204).end();
}));

export default router;
