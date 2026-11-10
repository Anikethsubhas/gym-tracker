import { Router } from 'express';
import { NOTIFICATION_STATUSES, type NotificationEntry, type NotificationStatus } from '@gym/shared';
import { pool, select } from '../db/pool';
import { asyncHandler } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const raw = String(req.query.status ?? '');
  const status = (NOTIFICATION_STATUSES as readonly string[]).includes(raw) ? (raw as NotificationStatus) : null;
  const rows = await select<NotificationEntry>(
    pool,
    `SELECT n.*, u.name AS member_name
       FROM notifications n
       LEFT JOIN members m ON m.id = n.member_id
       LEFT JOIN users u ON u.id = m.user_id
      WHERE ($1::text IS NULL OR n.status = $1)
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2`,
    [status, limit],
  );
  res.json(rows);
}));

export default router;
