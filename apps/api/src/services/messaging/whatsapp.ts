import { config } from '../../config';

/**
 * Sends one approved WhatsApp template message through the Meta Cloud API.
 * `vars` is an ARRAY in template order ({{1}}, {{2}}, ...).
 */
export async function sendWhatsApp(args: { to: string; templateName: string; vars: string[] }): Promise<string> {
  const { token, phoneNumberId, apiVersion, languageCode } = config.messaging.whatsapp;
  if (!token || !phoneNumberId) throw new Error('WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set.');
  if (!args.templateName) throw new Error('WhatsApp template name is not set for this message type.');

  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: args.to,
      type: 'template',
      template: {
        name: args.templateName,
        language: { code: languageCode },
        components: [{ type: 'body', parameters: args.vars.map((v) => ({ type: 'text', text: String(v) })) }],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`WhatsApp responded ${res.status}: ${body.slice(0, 300)}`);
  return body.slice(0, 500);
}
