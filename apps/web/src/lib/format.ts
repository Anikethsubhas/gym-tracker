import { DAY_NAMES, plural } from '@gym/shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Cache for memoized computations
const phoneCache = new Map<string, string>();
const initialsCache = new Map<string, string>();
const dateCache = new Map<string, string>();

export const formatINR = (n: number | string | null | undefined): string =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const cached = dateCache.get(iso);
  if (cached) return cached;
  const [y, m, d] = iso.slice(0, 10).split('-');
  const result = `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  dateCache.set(iso, result);
  return result;
}

export function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

/** 919876543210 -> +91 98765 43210 */
export function formatPhone(phone: string): string {
  const cached = phoneCache.get(phone);
  if (cached) return cached;
  const d = phone.replace(/\D/g, '');
  const result = d.length === 12 ? `+${d.slice(0, 2)} ${d.slice(2, 7)} ${d.slice(7)}` : phone;
  phoneCache.set(phone, result);
  return result;
}

/** Today's date in India as YYYY-MM-DD, matching what the server uses. */
export const todayIso = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const planLength = (months: number): string => (months === 12 ? '1 year' : plural(months, 'month'));

export function initials(name: string): string {
  const cached = initialsCache.get(name);
  if (cached) return cached;
  const parts = name.trim().split(/\s+/);
  const result = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  initialsCache.set(name, result);
  return result;
}

/** 16:00 -> 4:00 PM */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const dayName = (isoDay: number): string => DAY_NAMES[isoDay - 1] ?? '';

/** "Valid until 31 Dec 2026", "Starts 1 Mar 2027", both, or nothing for an offer with no dates. */
export function formatValidity(from: string | null, until: string | null): string {
  if (from && until) return `Valid ${formatDate(from)} to ${formatDate(until)}`;
  if (until) return `Valid until ${formatDate(until)}`;
  if (from) return `Starts ${formatDate(from)}`;
  return '';
}

/** Digits only, for tel: and wa.me links. */
export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** Clear format caches (useful for testing) */
export function clearFormatCaches() {
  phoneCache.clear();
  initialsCache.clear();
  dateCache.clear();
}
