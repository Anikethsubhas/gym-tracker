import { Router } from 'express';
import type { DashboardData, MemberOverview } from '@gym/shared';
import { pool, select, selectOne } from '../db/pool';
import { asyncHandler } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [counts, money, attention, today] = await Promise.all([
    select<{ payment_status: string; n: number }>(
      pool, 'SELECT payment_status, COUNT(*)::int AS n FROM member_overview GROUP BY payment_status',
    ),
    selectOne<{ collected_this_month: number; outstanding: number }>(
      pool,
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM payments
           WHERE date_trunc('month', paid_on) = date_trunc('month', app_today())) AS collected_this_month,
         (SELECT COALESCE(SUM(plan_price), 0) FROM member_overview
           WHERE payment_status IN ('overdue', 'missed')) AS outstanding`,
    ),
    select<MemberOverview>(
      pool,
      `SELECT * FROM member_overview
        WHERE payment_status IN ('missed', 'overdue', 'due_soon')
        ORDER BY CASE payment_status WHEN 'missed' THEN 0 WHEN 'overdue' THEN 1 ELSE 2 END,
                 next_due_date, name`,
    ),
    selectOne<{ today: string }>(pool, 'SELECT app_today() AS today'),
  ]);

  const by = Object.fromEntries(counts.map((r) => [r.payment_status, r.n])) as Record<string, number | undefined>;
  const body: DashboardData = {
    today: today!.today,
    counts: {
      total: counts.reduce((sum, r) => sum + r.n, 0),
      paid_up: by.paid_up ?? 0,
      due_soon: by.due_soon ?? 0,
      overdue: by.overdue ?? 0,
      missed: by.missed ?? 0,
      paused: (by.paused ?? 0) + (by.cancelled ?? 0),
    },
    collected_this_month: money!.collected_this_month,
    outstanding: money!.outstanding,
    needs_attention: attention,
  };
  res.json(body);
}));

export default router;
