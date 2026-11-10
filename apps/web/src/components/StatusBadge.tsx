import { plural, type MemberOverview, type PaymentStatus } from '@gym/shared';

/** The two fields the countdown needs, so it works for the owner's view and the member's own view. */
type Countdown = Pick<MemberOverview, 'payment_status' | 'days_until_due'>;
import { cn } from '@/lib/utils';

const LABEL: Record<PaymentStatus, string> = {
  paid_up: 'Paid up',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  missed: 'Missed',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

const TONE: Record<PaymentStatus, string> = {
  paid_up: 'bg-status-paid-soft text-status-paid',
  due_soon: 'bg-status-soon-soft text-status-soon',
  overdue: 'bg-status-late-soft text-status-late',
  missed: 'bg-status-miss-soft text-status-miss',
  paused: 'bg-status-idle-soft text-status-idle',
  cancelled: 'bg-status-idle-soft text-status-idle',
};

export const STATUS_BAR_COLOR: Record<PaymentStatus, string> = {
  paid_up: 'bg-status-paid',
  due_soon: 'bg-status-soon',
  overdue: 'bg-status-late',
  missed: 'bg-status-miss',
  paused: 'bg-status-idle',
  cancelled: 'bg-status-idle',
};

export const STATUS_TEXT_COLOR: Record<PaymentStatus, string> = {
  paid_up: 'text-status-paid',
  due_soon: 'text-status-soon',
  overdue: 'text-status-late',
  missed: 'text-status-miss',
  paused: 'text-status-idle',
  cancelled: 'text-status-idle',
};

export function StatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {LABEL[status]}
    </span>
  );
}

/** The big day countdown used on the worklist: the one thing the owner scans for. */
export function DueCountdown({ member, className }: { member: Countdown; className?: string }) {
  if (member.payment_status === 'paused' || member.payment_status === 'cancelled') {
    return <span className="text-2xl text-muted-foreground">–</span>;
  }
  const days = member.days_until_due;
  const abs = Math.abs(days);
  const unit = days === 0 ? 'due today' : days > 0 ? `${abs === 1 ? 'day' : 'days'} left` : `${abs === 1 ? 'day' : 'days'} late`;
  return (
    <span className={cn('inline-flex min-w-[4.5rem] flex-col leading-none', STATUS_TEXT_COLOR[member.payment_status], className)}>
      <b className="font-display text-4xl font-bold tabular-nums">{abs}</b>
      <span className="mt-1 text-xs font-semibold">{unit}</span>
    </span>
  );
}

export function dueText(member: Countdown): string {
  if (member.payment_status === 'paused' || member.payment_status === 'cancelled') return '';
  const d = member.days_until_due;
  if (d === 0) return 'Due today';
  return d > 0 ? `Due in ${plural(d, 'day')}` : `${plural(-d, 'day')} late`;
}
