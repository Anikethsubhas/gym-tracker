import 'dotenv/config';
import { z } from 'zod';
import type { NotificationKind } from '@gym/shared';

const flag = (fallback: boolean) =>
  z.string().optional().transform((v) => (v === undefined || v.trim() === '' ? fallback : v.trim().toLowerCase() === 'true'));
const text = (fallback = '') => z.string().optional().transform((v) => v?.trim() || fallback);

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: text('postgres://gym:gym@localhost:5432/gym_tracker'),
    JWT_SECRET: text(),
    CORS_ORIGIN: text(),
    COOKIE_SECURE: text(),
    TRUST_PROXY: flag(false),
    RUN_SCHEDULER: flag(true),
    CRON_SCHEDULE: text('0 9 * * *'),
    MESSAGING_DRY_RUN: flag(true),
    MSG91_AUTH_KEY: text(),
    MSG91_TEMPLATE_REMINDER: text(),
    MSG91_TEMPLATE_MISSED_MEMBER: text(),
    MSG91_TEMPLATE_MISSED_OWNER: text(),
    WHATSAPP_TOKEN: text(),
    WHATSAPP_PHONE_NUMBER_ID: text(),
    WHATSAPP_API_VERSION: text('v21.0'),
    WHATSAPP_LANGUAGE: text('en'),
    WHATSAPP_TEMPLATE_REMINDER: text('gym_payment_reminder'),
    WHATSAPP_TEMPLATE_MISSED_MEMBER: text('gym_payment_missed'),
    WHATSAPP_TEMPLATE_MISSED_OWNER: text('gym_owner_missed_alert'),
  })
  .parse(process.env);

const isProd = env.NODE_ENV === 'production';

if (isProd && (env.JWT_SECRET.length < 32 || env.JWT_SECRET.startsWith('replace-with'))) {
  throw new Error('Set JWT_SECRET to a random string of at least 32 characters before running in production.');
}

const SESSION_SECONDS = 12 * 60 * 60;

export const config = {
  isProd,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-not-for-production',
  corsOrigin: env.CORS_ORIGIN,
  trustProxy: env.TRUST_PROXY,
  timezone: 'Asia/Kolkata',
  runScheduler: env.RUN_SCHEDULER,
  cronSchedule: env.CRON_SCHEDULE,
  session: {
    cookieName: 'gym_session',
    seconds: SESSION_SECONDS,
    secure: env.COOKIE_SECURE ? env.COOKIE_SECURE.toLowerCase() === 'true' : isProd,
  },
  messaging: {
    dryRun: env.MESSAGING_DRY_RUN,
    msg91: {
      authKey: env.MSG91_AUTH_KEY,
      templates: {
        reminder: env.MSG91_TEMPLATE_REMINDER,
        missed_member: env.MSG91_TEMPLATE_MISSED_MEMBER,
        missed_owner: env.MSG91_TEMPLATE_MISSED_OWNER,
      } satisfies Record<NotificationKind, string>,
    },
    whatsapp: {
      token: env.WHATSAPP_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      apiVersion: env.WHATSAPP_API_VERSION,
      languageCode: env.WHATSAPP_LANGUAGE,
      templates: {
        reminder: env.WHATSAPP_TEMPLATE_REMINDER,
        missed_member: env.WHATSAPP_TEMPLATE_MISSED_MEMBER,
        missed_owner: env.WHATSAPP_TEMPLATE_MISSED_OWNER,
      } satisfies Record<NotificationKind, string>,
    },
  },
} as const;
