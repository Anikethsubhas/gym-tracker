import type { Channel, MemberOverview } from '@gym/shared';
import { toast } from 'sonner';
import { useRemind } from '@/lib/queries';

const CHANNEL_NAME: Record<Channel | 'all', string> = { sms: 'SMS', whatsapp: 'WhatsApp', all: 'message' };

/** Sends a reminder now and reports the outcome with a toast. */
export function useRemindMember() {
  const remind = useRemind();
  return async (member: Pick<MemberOverview, 'id' | 'name'>) => {
    try {
      const { results } = await remind.mutateAsync(member.id);
      const failed = results.filter((r) => r.status === 'failed');
      const sent = results.filter((r) => r.status === 'sent').map((r) => CHANNEL_NAME[r.channel]);
      if (failed.length) {
        toast.error(`${failed.map((r) => CHANNEL_NAME[r.channel]).join(' and ')} to ${member.name} failed. See Messages for details.`);
      } else if (results.some((r) => r.status === 'dry_run')) {
        toast.info(`Test mode: reminder for ${member.name} was logged, not sent.`);
      } else if (sent.length) {
        toast.success(`Reminder sent to ${member.name} by ${sent.join(' and ')}.`);
      } else {
        toast.error('No messages were sent. Turn on SMS or WhatsApp in Settings.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the reminder.');
    }
  };
}
