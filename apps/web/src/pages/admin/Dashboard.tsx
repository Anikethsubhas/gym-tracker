import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, Send, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { MemberOverview, PaymentStatus } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { MemberAvatar } from '@/components/MemberAvatar';
import { PageHeader } from '@/components/PageHeader';
import { PaymentDialog } from '@/components/PaymentDialog';
import { DueCountdown, STATUS_BAR_COLOR, STATUS_TEXT_COLOR, StatusBadge } from '@/components/StatusBadge';
import { useRemindMember } from '@/hooks/use-remind-member';
import { formatDate, formatINR, formatPhone } from '@/lib/format';
import { useDashboard, useRunChecks, useSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';

const SEGMENTS: { status: PaymentStatus; label: string }[] = [
  { status: 'paid_up', label: 'Paid up' },
  { status: 'due_soon', label: 'Due soon' },
  { status: 'overdue', label: 'Overdue' },
  { status: 'missed', label: 'Missed' },
];

export default function Dashboard() {
  const { data, isPending, error } = useDashboard();
  const { data: settings } = useSettings();
  const runChecks = useRunChecks();
  const remind = useRemindMember();
  const [paying, setPaying] = useState<MemberOverview | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);

  async function sendAlerts() {
    try {
      const s = await runChecks.mutateAsync();
      const sent = s.reminders + s.missed_member + s.missed_owner;
      if (s.failed) toast.error(`${s.failed} message${s.failed === 1 ? '' : 's'} failed. See Messages for details.`);
      else if (sent) toast.success(`${sent} message${sent === 1 ? '' : 's'} ${s.dry_run ? 'logged in test mode' : 'sent'}.`);
      else toast.info('Nothing new to send. Everyone due has already been alerted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not run the check.');
    }
  }

  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  if (isPending) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-44 lg:col-span-2" /><Skeleton className="h-44" /></div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { counts } = data;
  const reminderDays = settings?.reminder_days_before ?? 3;

  return (
    <>
      <PageHeader
        title="Today"
        description={formatDate(data.today)}
        actions={
          <Button variant="outline" onClick={() => setConfirmRun(true)} disabled={runChecks.isPending}>
            <Send aria-hidden /> {runChecks.isPending ? 'Sending…' : "Send today's alerts now"}
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Membership status</CardTitle>
            <CardDescription>{counts.total} members{counts.paused ? `, ${counts.paused} paused or cancelled` : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {counts.total === 0 ? (
              <p className="text-sm text-muted-foreground">Add your first member to see how payments are going.</p>
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Members by payment status">
                  {SEGMENTS.map(({ status }) => {
                    const n = counts[status as 'paid_up' | 'due_soon' | 'overdue' | 'missed'];
                    return n > 0 ? <div key={status} className={STATUS_BAR_COLOR[status]} style={{ width: `${(n / counts.total) * 100}%` }} /> : null;
                  })}
                </div>
                <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {SEGMENTS.map(({ status, label }) => (
                    <li key={status}>
                      <Link to={`/admin/members?status=${status}`} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className={cn('block font-display text-4xl font-bold leading-none tabular-nums', STATUS_TEXT_COLOR[status])}>
                          {counts[status as 'paid_up' | 'due_soon' | 'overdue' | 'missed']}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground group-hover:text-foreground">{label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-start gap-3">
              <Wallet className="mt-1 size-5 text-status-paid" aria-hidden />
              <div>
                <p className="font-display text-3xl font-bold leading-none tabular-nums">{formatINR(data.collected_this_month)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Collected this month</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BellRing className="mt-1 size-5 text-status-late" aria-hidden />
              <div>
                <p className="font-display text-3xl font-bold leading-none tabular-nums">{formatINR(data.outstanding)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Not yet paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>Payments due within {reminderDays} days, or already late.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {data.needs_attention.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nobody owes a payment right now">
              Members appear here once their due date is within {reminderDays} days or has passed.
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead><TableHead>Member</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.needs_attention.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><DueCountdown member={m} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={m.name} />
                        <div>
                          <Link to={`/admin/members/${m.id}`} className="font-semibold hover:underline">{m.name}</Link>
                          <div className="text-xs text-muted-foreground">{formatPhone(m.phone)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.plan_name}
                      <div className="text-xs text-muted-foreground">{formatINR(m.plan_price)} · due {formatDate(m.next_due_date)}</div>
                    </TableCell>
                    <TableCell><StatusBadge status={m.payment_status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button size="sm" onClick={() => setPaying(m)}>Record payment</Button>{' '}
                      <Button size="sm" variant="outline" onClick={() => remind(m)}>Remind</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {paying && <PaymentDialog member={paying} onClose={() => setPaying(null)} />}
      <ConfirmDialog
        open={confirmRun}
        onOpenChange={setConfirmRun}
        title="Send today's alerts now?"
        description="Anyone who is due soon or has missed a payment gets their message, unless they were already alerted for this due date."
        confirmLabel="Send alerts"
        onConfirm={sendAlerts}
      />
    </>
  );
}
