import type { Channel, MemberOverview, NotificationKind, NotificationStatus, SendResult, SettingsRow } from '@gym/shared';
import { config } from '../../config';
import { pool, selectOne } from '../../db/pool';
import { sendSms } from './sms';
import { sendWhatsApp } from './whatsapp';
import { TEMPLATES, buildVars, msg91TemplateId, renderPreview, whatsappTemplateName } from './templates';

interface LogRow {
  memberId: number;
  subscriptionId: number;
  kind: NotificationKind;
  channel: Channel;
  recipient: string;
  dueDate: string;
  trigger: 'auto' | 'manual';
  preview: string;
  status?: NotificationStatus;
  response?: string | null;
  error?: string | null;
}

async function alreadyHandled(row: Omit<LogRow, 'status'>): Promise<boolean> {
  // In test mode a dry run counts as "done" so the log doesn't fill with repeats.
  // In live mode only a real, successful send counts.
  const done: NotificationStatus[] = config.messaging.dryRun ? ['sent', 'dry_run'] : ['sent'];
  const found = await selectOne(
    pool,
    `SELECT 1 FROM notifications
      WHERE subscription_id = $1 AND kind = $2 AND channel = $3 AND due_date = $4
        AND status = ANY($5) LIMIT 1`,
    [row.subscriptionId, row.kind, row.channel, row.dueDate, done],
  );
  return found !== undefined;
}

async function logNotification(row: LogRow & { status: NotificationStatus }): Promise<void> {
  await pool.query(
    `INSERT INTO notifications
       (member_id, subscription_id, kind, channel, recipient, due_date, status, trigger,
        message_preview, provider_response, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [row.memberId, row.subscriptionId, row.kind, row.channel, row.recipient, row.dueDate,
     row.status, row.trigger, row.preview, row.response ?? null, row.error ?? null],
  );
}

/**
 * Sends one kind of message about one member over every enabled channel.
 * - automatic sends skip channels that already succeeded for this billing cycle (same due date)
 * - manual sends (force) always send
 */
export async function notify(args: {
  kind: NotificationKind;
  member: MemberOverview;
  settings: SettingsRow;
  trigger?: 'auto' | 'manual';
  force?: boolean;
}): Promise<SendResult[]> {
  const { kind, member, settings, trigger = 'auto', force = false } = args;
  const template = TEMPLATES[kind];
  const recipient = template.audience === 'owner' ? settings.owner_phone : member.phone;
  if (!recipient) return [{ channel: 'all', status: 'skipped', reason: 'no phone number' }];

  const vars = buildVars(member, settings);
  const preview = renderPreview(kind, vars);
  const channels: Channel[] = [];
  if (settings.sms_enabled) channels.push('sms');
  if (settings.whatsapp_enabled) channels.push('whatsapp');

  const results: SendResult[] = [];
  for (const channel of channels) {
    const base = {
      memberId: member.id, subscriptionId: member.subscription_id, kind, channel,
      recipient, dueDate: member.next_due_date, trigger, preview,
    };

    if (!force && (await alreadyHandled(base))) {
      results.push({ channel, status: 'skipped', reason: 'already sent for this due date' });
      continue;
    }

    if (config.messaging.dryRun) {
      await logNotification({ ...base, status: 'dry_run' });
      results.push({ channel, status: 'dry_run' });
      continue;
    }

    try {
      const response =
        channel === 'sms'
          ? await sendSms({
              to: recipient,
              templateId: msg91TemplateId(kind),
              vars: Object.fromEntries(template.vars.map((key) => [key, vars[key]])),
            })
          : await sendWhatsApp({
              to: recipient,
              templateName: whatsappTemplateName(kind),
              vars: template.vars.map((key) => vars[key]),
            });
      await logNotification({ ...base, status: 'sent', response });
      results.push({ channel, status: 'sent' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await logNotification({ ...base, status: 'failed', error: message });
      results.push({ channel, status: 'failed', error: message });
    }
  }
  return results;
}
