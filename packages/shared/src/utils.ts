/**
 * Accepts the usual ways Indian mobile numbers are typed
 * (9876543210, +91 98765 43210, 09876543210, 919876543210)
 * and returns the 12-digit form MSG91 and WhatsApp expect: 919876543210.
 * Returns null when it is not a valid Indian mobile number.
 */
export function normalizeIndianPhone(input: unknown): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
}

/** Add calendar months to a YYYY-MM-DD date. Same month-end rule as PostgreSQL (31 Jan + 1 month = 28 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export const laterDate = (a: string, b: string): string => (a > b ? a : b);

/* ---------------- opening hours ---------------- */
export interface OpenStatus {
  isOpen: boolean;
  /** HH:MM the current slot ends, when open. */
  closesAt: string | null;
  /** The next opening, when closed. daysAhead is 0 for later today, 1 for tomorrow, and so on. */
  next: { day: number; time: string; daysAhead: number } | null;
}

const IST_DAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** The current weekday (Mon = 1) and minutes since midnight in India. */
export function istNow(date: Date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: IST_DAYS[get('weekday')] ?? 1, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function openStatus(
  slots: { day_of_week: number; opens_at: string; closes_at: string }[],
  now: { day: number; minutes: number },
): OpenStatus {
  const byOpening = (a: { opens_at: string }, b: { opens_at: string }) => a.opens_at.localeCompare(b.opens_at);
  const today = slots.filter((s) => s.day_of_week === now.day).sort(byOpening);

  const current = today.find((s) => toMinutes(s.opens_at) <= now.minutes && now.minutes < toMinutes(s.closes_at));
  if (current) return { isOpen: true, closesAt: current.closes_at, next: null };

  const later = today.find((s) => toMinutes(s.opens_at) > now.minutes);
  if (later) return { isOpen: false, closesAt: null, next: { day: now.day, time: later.opens_at, daysAhead: 0 } };

  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const day = ((now.day - 1 + ahead) % 7) + 1;
    const first = slots.filter((s) => s.day_of_week === day).sort(byOpening)[0];
    if (first) return { isOpen: false, closesAt: null, next: { day, time: first.opens_at, daysAhead: ahead } };
  }
  return { isOpen: false, closesAt: null, next: null };
}
