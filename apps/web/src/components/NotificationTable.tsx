import type { Channel, NotificationEntry, NotificationKind, NotificationStatus } from '@gym/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';

const KIND: Record<NotificationKind, string> = {
  reminder: 'Payment reminder',
  missed_member: 'Missed payment, to member',
  missed_owner: 'Missed payment, to you',
};
const CHANNEL: Record<Channel, string> = { sms: 'SMS', whatsapp: 'WhatsApp' };
const STATUS: Record<NotificationStatus, { label: string; variant: 'success' | 'danger' | 'muted' }> = {
  sent: { label: 'Sent', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  dry_run: { label: 'Test only', variant: 'muted' },
};

/**
 * Reusable notification table component.
 * Separated to allow lazy-loading of the Messages page.
 */
export function NotificationTable({ rows, showMember = true }: { rows: NotificationEntry[]; showMember?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          {showMember && <TableHead>To</TableHead>}
          <TableHead>Message</TableHead><TableHead>Channel</TableHead><TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((n) => (
          <TableRow key={n.id}>
            <TableCell className="whitespace-nowrap">
              {formatDateTime(n.created_at)}
              {n.trigger === 'manual' && <div className="text-xs text-muted-foreground">Sent by you</div>}
            </TableCell>
            {showMember && <TableCell>{n.kind === 'missed_owner' ? 'You (owner)' : n.member_name ?? 'Deleted member'}</TableCell>}
            <TableCell>
              <div className="font-semibold">{KIND[n.kind]}</div>
              <div className="max-w-md truncate text-xs text-muted-foreground" title={n.message_preview ?? undefined}>{n.message_preview}</div>
              {n.error && <div className="mt-1 text-xs font-medium text-destructive">{n.error}</div>}
            </TableCell>
            <TableCell>{CHANNEL[n.channel]}</TableCell>
            <TableCell><Badge variant={STATUS[n.status].variant}>{STATUS[n.status].label}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}