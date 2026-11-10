import { Link } from 'react-router-dom';
import { BellRing, CalendarClock, Info, Tag } from 'lucide-react';
import { plural, type Channel, type MyMembership } from '@gym/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DoorSign } from '@/components/landing/hours';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { DueCountdown, StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatDateTime, formatINR, planLength } from '@/lib/format';
import { useMyMembership, usePublicLanding } from '@/lib/queries';

const CHANNEL: Record<Channel, string> = { sms: 'SMS', whatsapp: 'WhatsApp' };
const KIND = { reminder: 'Payment reminder', missed_member: 'Overdue payment notice' } as const;

/** One plain sentence about where the member stands, and what (if anything) to do. */
function statusNote(d: MyMembership): { variant: 'info' | 'warning' | 'destructive' | 'default'; text: string } {
  const { membership: m } = d;
  const due = formatDate(m.next_due_date);
  switch (m.payment_status) {
    case 'paid_up':
      return { variant: 'info', text: `You are all paid up. Your next payment is due on ${due}.` };
    case 'due_soon':
      return {
        variant: 'warning',
        text: m.days_until_due === 0
          ? 'Your payment is due today. Please pay at the front desk by cash, UPI or card.'
          : `Your payment is due in ${plural(m.days_until_due, 'day')}, on ${due}. Please pay at the front desk by cash, UPI or card.`,
      };
    case 'overdue':
      return { variant: 'destructive', text: `Your payment was due on ${due}. Please pay at the front desk. If it is still unpaid ${plural(d.grace_days, 'day')} after the due date, the gym is told.` };
    case 'missed':
      return { variant: 'destructive', text: `Your payment has been overdue since ${due}. Please pay at the front desk as soon as you can.` };
    case 'paused':
      return { variant: 'default', text: 'Your membership is paused, so no payment is due. Ask the front desk when you want to start again.' };
    default:
      return { variant: 'default', text: 'Your membership has ended. Ask the front desk if you would like to rejoin.' };
  }
}

function reminderPlan(d: MyMembership): string {
  const status = d.membership.payment_status;
  if (status === 'paid_up' && d.reminder_on) {
    return `We will remind you by SMS and WhatsApp on ${formatDate(d.reminder_on)}, ${plural(d.reminder_days_before, 'day')} before your payment is due.`;
  }
  if (status === 'due_soon') return `You are within ${plural(d.reminder_days_before, 'day')} of your due date, so reminders are going out by SMS and WhatsApp.`;
  if (status === 'overdue' || status === 'missed') return 'Your payment is overdue. Paying at the front desk clears it.';
  return 'No reminders are sent while your membership is not active.';
}

export default function MemberHome() {
  const { data, isPending, error } = useMyMembership();
  const { data: landing } = usePublicLanding();

  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  if (isPending) {
    return <div className="grid gap-6"><Skeleton className="h-12 w-64" /><Skeleton className="h-56" /><Skeleton className="h-40" /></div>;
  }

  const { membership: m, reminders } = data;
  const note = statusNote(data);
  const offers = landing?.offers ?? [];

  return (
    <>
      <PageHeader title={`Hi, ${m.name.split(' ')[0]}`} description={landing ? `Your membership at ${landing.gym.gym_name}` : undefined} />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Your membership</CardTitle>
              <CardDescription>{m.plan_name}, {formatINR(m.plan_price)} for {planLength(m.duration_months)}</CardDescription>
            </div>
            <StatusBadge status={m.payment_status} />
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
              <DueCountdown member={m} className="[&>b]:text-7xl" />
              <dl className="grid gap-2 text-sm">
                <div className="flex gap-4"><dt className="w-36 text-muted-foreground">Next payment due</dt><dd className="font-semibold">{formatDate(m.next_due_date)}</dd></div>
                <div className="flex gap-4"><dt className="w-36 text-muted-foreground">Amount</dt><dd className="font-semibold">{formatINR(m.plan_price)}</dd></div>
                <div className="flex gap-4"><dt className="w-36 text-muted-foreground">Member since</dt><dd>{formatDate(m.joined_on)}</dd></div>
              </dl>
            </div>
            <Alert variant={note.variant} role="status">
              <Info className="size-4" aria-hidden />
              <AlertDescription>{note.text}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div>{landing && <DoorSign hours={landing.hours} className="border shadow-sm" />}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reminders</CardTitle>
            <CardDescription className="flex items-start gap-2"><CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />{reminderPlan(data)}</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {reminders.length === 0 ? (
              <EmptyState icon={BellRing} title="No reminders yet">Reminders you receive from the gym will be listed here.</EmptyState>
            ) : (
              <ul className="divide-y">
                {reminders.map((r) => (
                  <li key={`${r.kind}-${r.sent_at}`} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{KIND[r.kind]}</span>
                      <span className="text-sm text-muted-foreground">{formatDateTime(r.sent_at)} · {r.channels.map((c) => CHANNEL[c]).join(' and ')}</span>
                    </div>
                    {r.message && <p className="mt-1 text-sm text-muted-foreground">{r.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offers</CardTitle>
            <CardDescription>Running at the gym now</CardDescription>
          </CardHeader>
          <CardContent>
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers right now. Check back soon.</p>
            ) : (
              <ul className="grid gap-3">
                {offers.slice(0, 3).map((o) => (
                  <li key={o.id} className="flex items-start gap-3">
                    <Tag className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="font-semibold leading-tight">{o.title} {o.highlight && <Badge variant="success" className="ml-1">{o.highlight}</Badge>}</p>
                      {o.code && <p className="text-sm text-muted-foreground">Code {o.code}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/me/offers" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">See all offers and plans</Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
