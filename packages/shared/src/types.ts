import type {
  Channel, NotificationKind, NotificationStatus, OfferStatus, PaymentMethod, PaymentStatus, RoleKey,
  SubscriptionStatus,
} from './constants';

/* ---------------- identity ---------------- */
export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  roles: RoleKey[];
}

export interface InviteInfo {
  name: string;
  /** True when the person already has a password, i.e. this link resets it. */
  is_reset: boolean;
}

export interface InviteLink {
  token: string;
  expires_at: string;
}

/* ---------------- plans / settings ---------------- */
export interface Plan {
  id: number;
  name: string;
  price: number;
  duration_months: number;
  description: string | null;
  features: string[];
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PlanWithCount extends Plan {
  member_count: number;
}

/** Alert settings (the owner's private configuration). */
export interface SettingsRow {
  id: number;
  gym_name: string;
  owner_phone: string | null;
  reminder_days_before: number;
  grace_days: number;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  updated_at: string;
}

export interface Settings extends SettingsRow {
  /** True while the server is in test mode: messages are logged, not sent. */
  messaging_dry_run: boolean;
}

/* ---------------- public website content ---------------- */
export interface GymProfile {
  gym_name: string;
  tagline: string;
  about: string;
  address: string;
  contact_phone: string;
  contact_email: string;
  facilities: string[];
}

export interface HourSlot {
  day_of_week: number; // 1 = Monday ... 7 = Sunday
  opens_at: string; // HH:MM
  closes_at: string; // HH:MM
  label: string | null;
}

export interface PublicPlan {
  id: number;
  name: string;
  price: number;
  duration_months: number;
  description: string | null;
  features: string[];
  is_featured: boolean;
}

export interface Offer {
  id: number;
  title: string;
  highlight: string | null;
  description: string | null;
  code: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

export interface OfferAdmin extends Offer {
  /** Worked out by the server: live, scheduled (starts later), expired or hidden (switched off). */
  status: OfferStatus;
}

export interface PublicLanding {
  gym: GymProfile;
  hours: HourSlot[];
  plans: PublicPlan[];
  offers: Offer[];
  today: string;
}

export interface WebsiteAdminData {
  profile: GymProfile;
  hours: HourSlot[];
}

/* ---------------- members (owner's view) ---------------- */
/** One row of the member_overview database view: member + login identity + subscription + live payment status. */
export interface MemberOverview {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  email: string | null;
  joined_on: string;
  notes: string | null;
  subscription_id: number;
  plan_id: number;
  plan_name: string;
  plan_price: number;
  duration_months: number;
  start_date: string;
  next_due_date: string;
  subscription_status: SubscriptionStatus;
  days_until_due: number;
  payment_status: PaymentStatus;
}

export interface Payment {
  id: number;
  member_id: number;
  subscription_id: number | null;
  plan_id: number | null;
  plan_name: string | null;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  previous_due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  note: string | null;
  created_at: string;
}

export interface NotificationEntry {
  id: number;
  member_id: number | null;
  member_name: string | null;
  subscription_id: number | null;
  kind: NotificationKind;
  channel: Channel;
  recipient: string;
  due_date: string | null;
  status: NotificationStatus;
  trigger: 'auto' | 'manual';
  message_preview: string | null;
  provider_response: string | null;
  error: string | null;
  created_at: string;
}

export type AppAccessStatus = 'active' | 'invited' | 'not_invited';

export interface MemberDetail {
  member: MemberOverview;
  payments: Payment[];
  notifications: NotificationEntry[];
  /** Whether this member has set a password for the app yet. */
  app_access: { status: AppAccessStatus; last_login_at: string | null };
}

/* ---------------- members (their own view) ---------------- */
/** What a member may see about themselves. The owner's private notes are deliberately not included. */
export interface MySubscription {
  name: string;
  phone: string;
  email: string | null;
  joined_on: string;
  plan_name: string;
  plan_price: number;
  duration_months: number;
  start_date: string;
  next_due_date: string;
  subscription_status: SubscriptionStatus;
  days_until_due: number;
  payment_status: PaymentStatus;
}

export interface MyPayment {
  id: number;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  period_end: string | null;
  plan_name: string | null;
}

export interface MyReminder {
  kind: 'reminder' | 'missed_member';
  due_date: string | null;
  sent_at: string;
  channels: Channel[];
  message: string | null;
}

export interface MyMembership {
  membership: MySubscription;
  payments: MyPayment[];
  reminders: MyReminder[];
  reminder_days_before: number;
  grace_days: number;
  /** The day the next automatic reminder goes out, or null when none is scheduled. */
  reminder_on: string | null;
  today: string;
}

/* ---------------- dashboard & jobs ---------------- */
export interface DashboardData {
  today: string;
  counts: {
    total: number;
    paid_up: number;
    due_soon: number;
    overdue: number;
    missed: number;
    paused: number;
  };
  collected_this_month: number;
  outstanding: number;
  needs_attention: MemberOverview[];
}

export interface SendResult {
  channel: Channel | 'all';
  status: 'sent' | 'failed' | 'dry_run' | 'skipped';
  reason?: string;
  error?: string;
}

export interface RemindResponse {
  kind: NotificationKind;
  results: SendResult[];
}

export interface CheckSummary {
  checked: number;
  reminders: number;
  missed_member: number;
  missed_owner: number;
  failed: number;
  skipped: number;
  dry_run: number;
}
