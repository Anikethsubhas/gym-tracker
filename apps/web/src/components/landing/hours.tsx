import { useEffect, useState } from 'react';
import { DAY_NAMES, istNow, openStatus, type HourSlot } from '@gym/shared';
import { cn } from '@/lib/utils';
import { dayName, formatTime12 } from '@/lib/format';

/** Open or closed right now, in India time. Re-checked every 30 seconds so the sign stays truthful. */
export function useOpenStatus(hours: HourSlot[]) {
  const [now, setNow] = useState(() => istNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(istNow()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return { now, status: openStatus(hours, now) };
}

function nextOpeningText(next: { day: number; time: string; daysAhead: number }): string {
  const when = next.daysAhead === 0 ? 'today' : next.daysAhead === 1 ? 'tomorrow' : dayName(next.day);
  return `Opens ${when} at ${formatTime12(next.time)}`;
}

const slotText = (s: HourSlot) => `${formatTime12(s.opens_at)} to ${formatTime12(s.closes_at)}`;

/**
 * The gym's front door: is it open right now, and what are today's hours?
 * Everything here comes from the timetable the owner sets, so it is never out of date.
 */
export function DoorSign({ hours, className }: { hours: HourSlot[]; className?: string }) {
  const { now, status } = useOpenStatus(hours);
  const today = hours.filter((h) => h.day_of_week === now.day);

  return (
    <div className={cn('rounded-xl bg-card p-6 text-card-foreground shadow-lg', className)}>
      {hours.length === 0 ? (
        <>
          <p className="font-display text-3xl font-bold">Timings coming soon</p>
          <p className="mt-1 text-muted-foreground">Call or visit the front desk for today's hours.</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="relative flex size-4">
              {status.isOpen && <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-paid opacity-40 motion-reduce:animate-none" />}
              <span className={cn('relative inline-flex size-4 rounded-full', status.isOpen ? 'bg-status-paid' : 'bg-status-miss')} />
            </span>
            <p className={cn('font-display text-5xl font-bold leading-none', status.isOpen ? 'text-status-paid' : 'text-status-miss')}>
              {status.isOpen ? 'Open now' : 'Closed'}
            </p>
          </div>
          <p className="mt-3 text-lg font-medium">
            {status.isOpen && status.closesAt && `Open until ${formatTime12(status.closesAt)}`}
            {!status.isOpen && status.next && nextOpeningText(status.next)}
            {!status.isOpen && !status.next && 'Not open this week'}
          </p>
          <div className="mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">Today, {dayName(now.day)}</p>
            {today.length === 0 ? (
              <p className="mt-1 font-semibold">Closed all day</p>
            ) : (
              <ul className="mt-1 grid gap-1">
                {today.map((s, i) => (
                  <li key={i} className="flex justify-between gap-4 font-semibold">
                    <span>{s.label || 'Open'}</span>
                    <span className="tabular-nums">{slotText(s)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** The full week. Today's row is highlighted. */
export function HoursTable({ hours, className }: { hours: HourSlot[]; className?: string }) {
  const { now } = useOpenStatus(hours);
  return (
    <ul className={cn('divide-y rounded-lg border bg-card', className)}>
      {DAY_NAMES.map((name, i) => {
        const day = i + 1;
        const slots = hours.filter((h) => h.day_of_week === day);
        return (
          <li key={name} className={cn('flex items-start justify-between gap-4 px-4 py-3', day === now.day && 'bg-accent text-accent-foreground')}>
            <span className="font-semibold">
              {name}
              {day === now.day && <span className="ml-2 text-xs font-medium">Today</span>}
            </span>
            {slots.length === 0 ? (
              <span className="text-muted-foreground">Closed</span>
            ) : (
              <span className="grid gap-0.5 text-right tabular-nums">
                {slots.map((s, j) => (
                  <span key={j}>
                    {s.label && <span className="mr-2 text-sm text-muted-foreground">{s.label}</span>}
                    {slotText(s)}
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
