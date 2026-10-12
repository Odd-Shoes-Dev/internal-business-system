import { decryptSecret } from '@/lib/crypto/secret-box';
import type { QueryExecutor } from '@/lib/accounting/provider-accounting';

// WhatsApp Business (Meta Cloud API) order confirmations. Each company connects its own
// WhatsApp Business number; credentials live in company_whatsapp_settings.
// The message uses an approved template whose body takes three parameters:
//   {{1}} customer name, {{2}} amount paid, {{3}} items bought

const GRAPH_API = 'https://graph.facebook.com/v21.0';

export interface WhatsAppSettingsRow {
  enabled: boolean;
  phone_number_id: string | null;
  access_token_encrypted: string | null;
  template_name: string;
  template_language: string;
  default_country_code: string;
}

// To the format the Cloud API wants: country code + number, digits only, no '+'.
// A local number starting with 0 gets the company's default country code.
export function normalizeWhatsAppNumber(raw: string, defaultCountryCode: string): string | null {
  const trimmed = String(raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `${defaultCountryCode.replace(/\D/g, '')}${digits.slice(1)}`;
  return digits;
}

export async function getWhatsAppSettingsWithDb(q: QueryExecutor, companyId: string): Promise<WhatsAppSettingsRow | null> {
  const result = await q.query<WhatsAppSettingsRow>(
    `SELECT enabled, phone_number_id, access_token_encrypted, template_name, template_language, default_country_code
     FROM company_whatsapp_settings WHERE company_id = $1`,
    [companyId]
  );
  return result.rows[0] ?? null;
}

export async function sendWhatsAppTemplate(
  settings: WhatsAppSettingsRow,
  to: string,
  params: string[]
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!settings.phone_number_id || !settings.access_token_encrypted) {
    return { ok: false, error: 'WhatsApp is not fully configured' };
  }
  try {
    const response = await fetch(`${GRAPH_API}/${encodeURIComponent(settings.phone_number_id)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${decryptSecret(settings.access_token_encrypted)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: settings.template_name,
          language: { code: settings.template_language },
          components: [
            { type: 'body', parameters: params.map((text) => ({ type: 'text', text: text.slice(0, 1000) })) },
          ],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: payload?.error?.message || `WhatsApp API returned ${response.status}` };
    }
    return { ok: true, messageId: payload?.messages?.[0]?.id };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'WhatsApp request failed' };
  }
}

// Sends the order confirmation for a sale and logs the outcome. Never throws: a failed
// message must not affect the sale.
export async function sendOrderConfirmationWithDb(
  q: QueryExecutor,
  input: {
    companyId: string;
    invoiceId: string;
    customerName: string;
    whatsappNumber: string;
    amountText: string;
    itemsText: string;
  }
): Promise<void> {
  try {
    const settings = await getWhatsAppSettingsWithDb(q, input.companyId);
    if (!settings?.enabled) return;

    const to = normalizeWhatsAppNumber(input.whatsappNumber, settings.default_country_code);
    if (!to) return;

    const result = await sendWhatsAppTemplate(settings, to, [input.customerName, input.amountText, input.itemsText]);
    await q.query(
      `INSERT INTO whatsapp_message_logs (company_id, invoice_id, to_number, status, provider_message_id, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.companyId, input.invoiceId, to, result.ok ? 'sent' : 'failed', result.messageId ?? null, result.error ?? null]
    );
  } catch (error) {
    console.error('WhatsApp order confirmation failed:', error);
  }
}
