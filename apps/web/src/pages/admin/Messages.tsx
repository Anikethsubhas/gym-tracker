import { useState } from 'react';
import { Info, MessageSquare } from 'lucide-react';
import type { Channel, NotificationEntry, NotificationKind, NotificationStatus } from '@gym/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { formatDateTime } from '@/lib/format';
import { useNotifications } from '@/lib/queries';

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

export default function Messages() {
  const [status, setStatus] = useState('all');
  const { data: rows, isPending, error } = useNotifications(status === 'all' ? '' : status);

  return (
    <>
      <PageHeader
        title="Messages"
        description="Every SMS and WhatsApp the system has sent or tried to send."
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="msg-filter">Show</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="msg-filter" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All messages</SelectItem>
                <SelectItem value="failed">Failed only</SelectItem>
                <SelectItem value="sent">Sent only</SelectItem>
                <SelectItem value="dry_run">Test only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Alert variant="info" role="status" className="mb-6">
        <Info className="size-4" aria-hidden />
        <AlertDescription>
          Each morning at 9:00 the system messages members whose payment is due soon, and messages both the member and you when a payment is still unpaid after the grace period. Failed messages are retried at the next daily check.
        </AlertDescription>
      </Alert>

      <Card>
        {error ? (
          <p role="alert" className="p-5 text-destructive">{error.message}</p>
        ) : isPending ? (
          <div className="grid gap-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={MessageSquare} title={status === 'all' ? 'No messages yet' : 'No messages with this result'} />
        ) : (
          <NotificationTable rows={rows} />
        )}
      </Card>
    </>
  );
}
