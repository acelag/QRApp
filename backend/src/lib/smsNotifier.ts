/**
 * smsNotifier — sends WhatsApp / SMS order confirmations via Twilio.
 *
 * Required env vars (all optional — if absent the notifier silently does nothing):
 *   TWILIO_ACCOUNT_SID   — Twilio account SID
 *   TWILIO_AUTH_TOKEN    — Twilio auth token
 *   TWILIO_FROM          — sender number, e.g. "+15551234567" for SMS
 *                          or "whatsapp:+14155238886" for WhatsApp sandbox
 *   TWILIO_CHANNEL       — "sms" | "whatsapp" | "both"  (default: "sms")
 *   APP_URL              — base URL for order tracking link (e.g. "https://yourdomain.com")
 */

import twilio from 'twilio';

const SID     = process.env.TWILIO_ACCOUNT_SID;
const TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const FROM    = process.env.TWILIO_FROM;
const CHANNEL = (process.env.TWILIO_CHANNEL ?? 'sms') as 'sms' | 'whatsapp' | 'both';
const APP_URL = process.env.APP_URL ?? '';

function isConfigured(): boolean {
  return Boolean(SID && TOKEN && FROM);
}

/** Normalise a user-supplied phone string to E.164 (best-effort). */
function normalise(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `+94${digits.slice(1)}` : digits.startsWith('+') ? phone.trim() : `+${digits}`;
}

export interface OrderConfirmationData {
  orderNumber: string;
  restaurantName: string;
  items: { name: string; quantity: number; price: number; toppingsTotal?: number }[];
  totalAmount: number;
  orderId: string;
  currency?: string;
}

function buildMessage(data: OrderConfirmationData): string {
  const currency = data.currency ?? '';
  const lines = data.items.map(
    (i) => `• ${i.quantity}× ${i.name} — ${currency}${((i.price + (i.toppingsTotal ?? 0)) * i.quantity).toFixed(2)}`,
  );
  const trackUrl = APP_URL ? `\nTrack: ${APP_URL}/order-success/${data.orderId}` : '';
  return [
    `✅ Order Confirmed! #${data.orderNumber}`,
    data.restaurantName,
    '',
    ...lines,
    '',
    `Total: ${currency}${data.totalAmount.toFixed(2)}`,
    trackUrl,
  ].join('\n').trim();
}

export async function sendOrderConfirmation(
  phone: string,
  data: OrderConfirmationData,
): Promise<void> {
  if (!isConfigured()) return;
  if (!phone?.trim()) return;

  const client = twilio(SID, TOKEN);
  const to     = normalise(phone);
  const body   = buildMessage(data);

  const channels: string[] = [];
  if (CHANNEL === 'whatsapp' || CHANNEL === 'both') {
    channels.push('whatsapp');
  }
  if (CHANNEL === 'sms' || CHANNEL === 'both') {
    channels.push('sms');
  }

  await Promise.allSettled(
    channels.map((ch) =>
      client.messages.create({
        from: ch === 'whatsapp' ? (FROM!.startsWith('whatsapp:') ? FROM! : `whatsapp:${FROM}`) : FROM!.replace(/^whatsapp:/, ''),
        to:   ch === 'whatsapp' ? (to.startsWith('whatsapp:') ? to : `whatsapp:${to}`) : to.replace(/^whatsapp:/, ''),
        body,
      }).catch((err: unknown) => {
        console.error(`[smsNotifier] ${ch} send failed:`, (err as Error).message);
      }),
    ),
  );
}
