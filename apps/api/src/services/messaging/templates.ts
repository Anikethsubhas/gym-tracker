import type { Channel, MemberOverview, NotificationKind, SettingsRow } from '@gym/shared';
import { config } from '../../config';

export interface TemplateDef {
  audience: 'member' | 'owner';
  /** Variable order. MSG91 receives them by name; WhatsApp by position ({{1}}, {{2}}, ...). */
  vars: readonly string[];
  /** The wording to register as a template with MSG91 (DLT) and Meta (WhatsApp). */
  text: string;
}

export const TEMPLATES: Record<NotificationKind, TemplateDef> = {
  reminder: {
    audience: 'member',
    vars: ['name', 'plan', 'gym', 'due_date', 'amount'],
    text: 'Hi {{name}}, your {{plan}} membership at {{gym}} is due on {{due_date}}. Amount: Rs.{{amount}}. Please pay at the front desk to keep your membership active.',
  },
  missed_member: {
    audience: 'member',
    vars: ['name', 'gym', 'amount', 'due_date'],
    text: 'Hi {{name}}, your membership payment of Rs.{{amount}} at {{gym}} was due on {{due_date}} and is still pending. Please pay at the front desk as soon as possible.',
  },
  missed_owner: {
    audience: 'owner',
    vars: ['name', 'phone', 'amount', 'due_date', 'days_overdue'],
    text: 'Missed payment: {{name}} ({{phone}}) has not paid Rs.{{amount}} due on {{due_date}}. {{days_overdue}} days overdue.',
  },
};

export type Vars = Record<string, string>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function buildVars(member: MemberOverview, settings: SettingsRow): Vars {
  return {
    name: member.name,
    plan: member.plan_name,
    gym: settings.gym_name,
    due_date: formatDate(member.next_due_date),
    amount: String(Number(member.plan_price)),
    phone: member.phone.slice(-10),
    days_overdue: String(Math.max(0, -member.days_until_due)),
  };
}

export function renderPreview(kind: NotificationKind, vars: Vars): string {
  return TEMPLATES[kind].text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export const msg91TemplateId = (kind: NotificationKind): string => config.messaging.msg91.templates[kind];
export const whatsappTemplateName = (kind: NotificationKind): string => config.messaging.whatsapp.templates[kind];

export type { Channel };
