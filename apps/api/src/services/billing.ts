import type { CheckSummary, MemberOverview, NotificationKind, SendResult } from '@gym/shared';
import { pool, select } from '../db/pool';
import { getSettings } from './settings';
import { notify } from './messaging';
import { HttpError } from '../utils/http';

let running = false;

/**
 * The daily check. Looks at every active subscription and:
 *   - due_soon -> sends the payment reminder to the member (once per due date)
 *   - missed   -> sends a missed-payment alert to the member AND the owner (once per due date)
 * Failed sends are retried on the next run.
 */
export async function runDailyChecks(trigger: 'auto' | 'manual' = 'auto'): Promise<CheckSummary> {
  if (running) throw new HttpError(409, 'A check is already running. Try again in a moment.');
  running = true;
  try {
    const settings = await getSettings();
    const members = await select<MemberOverview>(
      pool,
      `SELECT * FROM member_overview WHERE payment_status IN ('due_soon', 'missed') ORDER BY next_due_date`,
    );

    const summary: CheckSummary = {
      checked: members.length, reminders: 0, missed_member: 0, missed_owner: 0, failed: 0, skipped: 0, dry_run: 0,
    };
    const counters: Record<NotificationKind, 'reminders' | 'missed_member' | 'missed_owner'> = {
      reminder: 'reminders', missed_member: 'missed_member', missed_owner: 'missed_owner',
    };
    const tally = (kind: NotificationKind, results: SendResult[]) => {
      for (const r of results) {
        if (r.status === 'sent') summary[counters[kind]] += 1;
        else if (r.status === 'dry_run') {
          summary[counters[kind]] += 1;
          summary.dry_run += 1;
        } else if (r.status === 'failed') summary.failed += 1;
        else summary.skipped += 1;
      }
    };

    for (const member of members) {
      if (member.payment_status === 'due_soon') {
        tally('reminder', await notify({ kind: 'reminder', member, settings, trigger }));
      } else {
        tally('missed_member', await notify({ kind: 'missed_member', member, settings, trigger }));
        tally('missed_owner', await notify({ kind: 'missed_owner', member, settings, trigger }));
      }
    }

    console.log(`[billing] ${trigger} check done:`, JSON.stringify(summary));
    return summary;
  } finally {
    running = false;
  }
}
