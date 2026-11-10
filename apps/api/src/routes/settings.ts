import { Router } from 'express';
import { normalizeIndianPhone, settingsSchema, type Settings } from '@gym/shared';
import { config } from '../config';
import { pool } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/http';
import { getSettings } from '../services/settings';

const router = Router();

const present = async (): Promise<Settings> => ({ ...(await getSettings()), messaging_dry_run: config.messaging.dryRun });

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await present());
}));

router.put('/', asyncHandler(async (req, res) => {
  const d = settingsSchema.parse(req.body);
  let ownerPhone: string | null = null;
  if (d.owner_phone) {
    ownerPhone = normalizeIndianPhone(d.owner_phone);
    if (!ownerPhone) throw new HttpError(400, 'owner_phone: enter a valid 10-digit Indian mobile number.');
  }
  await pool.query(
    `UPDATE settings SET owner_phone=$1, reminder_days_before=$2, grace_days=$3,
            sms_enabled=$4, whatsapp_enabled=$5, updated_at=now() WHERE id = 1`,
    [ownerPhone, d.reminder_days_before, d.grace_days, d.sms_enabled, d.whatsapp_enabled],
  );
  res.json(await present());
}));

export default router;
