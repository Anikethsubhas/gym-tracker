import { config } from '../../config';
import type { Vars } from './templates';

/** Sends one SMS through MSG91's Flow API. `to` looks like 919876543210. */
export async function sendSms(args: { to: string; templateId: string; vars: Vars }): Promise<string> {
  const { authKey } = config.messaging.msg91;
  if (!authKey) throw new Error('MSG91_AUTH_KEY is not set.');
  if (!args.templateId) throw new Error('MSG91 template ID is not set for this message type.');

  const res = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      template_id: args.templateId,
      short_url: '0',
      recipients: [{ mobiles: args.to, ...args.vars }],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`MSG91 responded ${res.status}: ${body.slice(0, 300)}`);

  // MSG91 can answer HTTP 200 with {"type":"error", ...}
  let parsed: { type?: string; message?: string } | null = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* not JSON, ignore */
  }
  if (parsed?.type === 'error') throw new Error(`MSG91 error: ${parsed.message}`);

  return body.slice(0, 500);
}
