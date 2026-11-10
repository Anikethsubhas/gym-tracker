export const PAYMENT_STATUSES = ['paid_up', 'due_soon', 'overdue', 'missed', 'paused', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const NOTIFICATION_KINDS = ['reminder', 'missed_member', 'missed_owner'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const CHANNELS = ['sms', 'whatsapp'] as const;
export type Channel = (typeof CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['sent', 'failed', 'dry_run'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Sent with every state-changing request. The API rejects writes without it (CSRF guard). */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'gym-tracker';

/** Roles live in the `roles` table. To add one later: insert a row there, add its key here, and guard routes with requireRole(). */
export const ROLE_KEYS = ['owner', 'member'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** ISO weekday numbers: Monday = 1 ... Sunday = 7. */
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const OFFER_STATUSES = ['live', 'scheduled', 'expired', 'hidden'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const INVITE_VALID_DAYS = 7;
