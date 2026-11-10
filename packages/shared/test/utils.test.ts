import { describe, expect, it } from 'vitest';
import { addMonths, normalizeIndianPhone, plural } from '../src';

describe('normalizeIndianPhone', () => {
  it.each([
    ['9876543210', '919876543210'],
    ['+91 98765 43210', '919876543210'],
    ['09876543210', '919876543210'],
    ['919876543210', '919876543210'],
  ])('accepts %s', (input, expected) => expect(normalizeIndianPhone(input)).toBe(expected));

  it.each(['12345', '', '5876543210', '98765432101234', null])('rejects %s', (input) =>
    expect(normalizeIndianPhone(input)).toBeNull());
});

describe('addMonths', () => {
  it('adds whole months', () => expect(addMonths('2026-11-10', 1)).toBe('2026-12-10'));
  it('rolls over the year', () => expect(addMonths('2026-12-12', 1)).toBe('2027-01-12'));
  it('adds quarters', () => expect(addMonths('2026-11-10', 3)).toBe('2027-02-10'));
  it('clamps to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
});

describe('plural', () => {
  it('pluralises', () => {
    expect(plural(1, 'day')).toBe('1 day');
    expect(plural(3, 'day')).toBe('3 days');
  });
});

import { openStatus, istNow } from '../src';
import { hoursSchema, loginSchema, offerSchema, planSchema } from '../src';

describe('openStatus', () => {
  const slots = [
    { day_of_week: 1, opens_at: '06:00', closes_at: '10:00' },
    { day_of_week: 1, opens_at: '16:00', closes_at: '22:00' },
    { day_of_week: 3, opens_at: '06:00', closes_at: '22:00' },
  ];
  it('is open inside a slot and reports when it closes', () =>
    expect(openStatus(slots, { day: 1, minutes: 7 * 60 })).toEqual({ isOpen: true, closesAt: '10:00', next: null }));
  it('is closed between split shifts and reports the evening opening', () =>
    expect(openStatus(slots, { day: 1, minutes: 12 * 60 }).next).toEqual({ day: 1, time: '16:00', daysAhead: 0 }));
  it('treats the closing minute as closed', () =>
    expect(openStatus(slots, { day: 1, minutes: 22 * 60 }).isOpen).toBe(false));
  it('finds the next open day after closing time', () =>
    expect(openStatus(slots, { day: 1, minutes: 23 * 60 }).next).toEqual({ day: 3, time: '06:00', daysAhead: 2 }));
  it('wraps around the week', () =>
    expect(openStatus(slots, { day: 3, minutes: 23 * 60 }).next).toEqual({ day: 1, time: '06:00', daysAhead: 5 }));
  it('handles a gym with no hours', () =>
    expect(openStatus([], { day: 2, minutes: 600 })).toEqual({ isOpen: false, closesAt: null, next: null }));
});

describe('istNow', () => {
  it('converts a UTC instant to India time', () => {
    // 2026-11-09 is a Monday. 20:30 UTC is 02:00 on Tuesday in India (UTC+5:30).
    expect(istNow(new Date('2026-11-09T20:30:00Z'))).toEqual({ day: 2, minutes: 2 * 60 });
  });
});

describe('schemas', () => {
  it('login takes an email or a mobile number', () => {
    expect(loginSchema.safeParse({ identifier: '98765 43210', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: '', password: 'x' }).success).toBe(false);
  });
  it('offers reject an end date before the start date', () => {
    const base = { title: 'New year', is_active: true };
    expect(offerSchema.safeParse({ ...base, valid_from: '2026-12-01', valid_until: '2026-11-01' }).success).toBe(false);
    expect(offerSchema.safeParse({ ...base, valid_from: '2026-11-01', valid_until: '2026-12-01' }).success).toBe(true);
  });
  it('hours reject a slot that ends before it starts and overlapping slots', () => {
    const slot = (opens_at: string, closes_at: string) => ({ day_of_week: 1, opens_at, closes_at });
    expect(hoursSchema.safeParse({ slots: [slot('10:00', '09:00')] }).success).toBe(false);
    expect(hoursSchema.safeParse({ slots: [slot('06:00', '11:00'), slot('10:00', '14:00')] }).success).toBe(false);
    expect(hoursSchema.safeParse({ slots: [slot('06:00', '10:00'), slot('16:00', '22:00')] }).success).toBe(true);
  });
  it('plans accept a feature list', () => {
    expect(planSchema.safeParse({ name: 'Monthly', price: 1000, duration_months: 1, features: ['Cardio', 'Weights'], is_featured: true }).success).toBe(true);
  });
});
