import { useState } from 'react';
import { Info, MessageSquare } from 'lucide-react';
import type { NotificationEntry } from '@gym/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { useNotifications } from '@/lib/queries';
import { NotificationTable } from '@/components/NotificationTable';

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
