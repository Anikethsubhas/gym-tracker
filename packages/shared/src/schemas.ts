import { z } from 'zod';
import { PAYMENT_METHODS, SUBSCRIPTION_STATUSES } from './constants';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use the format YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use the format HH:MM');

/* ---------------- sign-in ---------------- */
// bcrypt only looks at the first 72 bytes, so longer passwords add nothing.
export const passwordSchema = z.string().min(8, 'use at least 8 characters').max(72, 'use at most 72 characters');

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'enter your email or mobile number'),
  password: z.string().min(1, 'enter your password'),
});

export const activateSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'enter your current password'),
  new_password: passwordSchema,
});

export const myProfileSchema = z.object({
  email: z.union([z.string().trim().email('enter a valid email'), z.literal('')]),
});

/* ---------------- members ---------------- */
const memberFields = {
  name: z.string().trim().min(1, 'enter a name').max(80),
  phone: z.string().trim().min(1, 'enter a phone number'),
  email: z.union([z.string().trim().email('enter a valid email'), z.literal('')]).nullish(),
  notes: z.string().trim().max(500).nullish(),
};

export const updateMemberSchema = z.object(memberFields);

export const createMemberSchema = z.object({
  ...memberFields,
  plan_id: z.number().int().positive(),
  start_date: isoDate.optional(),
  first_payment: z
    .object({
      paid: z.boolean(),
      amount: z.number().positive().max(1_000_000).optional(),
      method: z.enum(PAYMENT_METHODS).optional(),
    })
    .optional(),
});

export const subscriptionPatchSchema = z
  .object({
    plan_id: z.number().int().positive().optional(),
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    next_due_date: isoDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

export const paymentSchema = z.object({
  amount: z.number({ invalid_type_error: 'enter the amount' }).positive('amount must be above 0').max(1_000_000),
  method: z.enum(PAYMENT_METHODS),
  paid_on: isoDate.optional(),
  next_due_date: isoDate.optional(),
  note: z.string().trim().max(200).nullish(),
});

/* ---------------- plans ---------------- */
export const planSchema = z.object({
  name: z.string().trim().min(1, 'enter a plan name').max(60),
  price: z.number({ invalid_type_error: 'enter a price' }).min(0).max(1_000_000),
  duration_months: z.number({ invalid_type_error: 'enter the length in months' }).int().min(1).max(36),
  description: z.string().trim().max(300).nullish(),
  features: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

/* ---------------- alert settings (owner only) ---------------- */
export const settingsSchema = z.object({
  owner_phone: z.string().trim().nullish(),
  reminder_days_before: z.number().int().min(0).max(30),
  grace_days: z.number().int().min(0).max(30),
  sms_enabled: z.boolean(),
  whatsapp_enabled: z.boolean(),
});

/* ---------------- website content (owner edits, everyone sees) ---------------- */
export const offerSchema = z
  .object({
    title: z.string().trim().min(1, 'enter a title').max(80),
    highlight: z.string().trim().max(30).nullish(),
    description: z.string().trim().max(400).nullish(),
    code: z.string().trim().max(30).nullish(),
    valid_from: isoDate.nullish(),
    valid_until: isoDate.nullish(),
    is_active: z.boolean(),
  })
  .refine((v) => !v.valid_from || !v.valid_until || v.valid_from <= v.valid_until, {
    message: 'the end date must not be before the start date',
    path: ['valid_until'],
  });

export const websiteProfileSchema = z.object({
  gym_name: z.string().trim().min(1, 'enter your gym name').max(60),
  tagline: z.string().trim().max(120),
  about: z.string().trim().max(1000),
  address: z.string().trim().max(300),
  contact_phone: z.string().trim().max(30),
  contact_email: z.union([z.string().trim().email('enter a valid email'), z.literal('')]),
  facilities: z.array(z.string().trim().min(1).max(40)).max(12),
});

export const hourSlotSchema = z
  .object({
    day_of_week: z.number().int().min(1).max(7),
    opens_at: hhmm,
    closes_at: hhmm,
    label: z.string().trim().max(30).nullish(),
  })
  .refine((s) => s.opens_at < s.closes_at, { message: 'closing time must be after opening time', path: ['closes_at'] });

export const hoursSchema = z
  .object({ slots: z.array(hourSlotSchema).max(40) })
  .superRefine((value, ctx) => {
    for (let day = 1; day <= 7; day += 1) {
      const slots = value.slots.filter((s) => s.day_of_week === day).sort((a, b) => a.opens_at.localeCompare(b.opens_at));
      for (let i = 1; i < slots.length; i += 1) {
        if (slots[i].opens_at < slots[i - 1].closes_at) {
          ctx.addIssue({ code: 'custom', message: 'time slots on the same day cannot overlap', path: ['slots'] });
          return;
        }
      }
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ActivateInput = z.infer<typeof activateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type MyProfileInput = z.infer<typeof myProfileSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type SubscriptionPatchInput = z.infer<typeof subscriptionPatchSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type OfferInput = z.infer<typeof offerSchema>;
export type WebsiteProfileInput = z.infer<typeof websiteProfileSchema>;
export type HoursInput = z.infer<typeof hoursSchema>;
