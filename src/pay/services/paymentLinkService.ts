import { defaultPayHttpClient, type PayHttpClient } from '../http';

export interface PayPaymentLink {
  id: string;
  merchant_id: string;
  slug: string;
  title: string;
  fixed_amount_atomic: string | null;
  asset: 'SOL' | 'USDC' | 'USDT' | null;
  fee_payer: 'merchant' | 'customer' | null;
  checkout_locale: 'fa-IR' | 'en-US' | 'ar' | 'ru' | 'auto';
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Envelope { success?: boolean; apiVersion?: string; data?: unknown; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSETS = new Set<PayPaymentLink['asset']>(['SOL','USDC','USDT',null]);
const PAYERS = new Set<PayPaymentLink['fee_payer']>(['merchant','customer',null]);
const LOCALES = new Set<PayPaymentLink['checkout_locale']>(['fa-IR','en-US','ar','ru','auto']);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Pay payment link payload.');
  return value as Record<string, unknown>;
}
function requiredString(row: Record<string, unknown>, field: string): string {
  if (typeof row[field] !== 'string' || !String(row[field]).trim()) throw new TypeError('Invalid Pay payment link field: ' + field);
  return row[field] as string;
}
function nullableString(row: Record<string, unknown>, field: string): string | null {
  if (row[field] === null) return null;
  return requiredString(row, field);
}
function atomicNullable(row: Record<string, unknown>, field: string): string | null {
  if (row[field] === null) return null;
  const value = requiredString(row, field);
  if (!/^\d+$/.test(value)) throw new TypeError('Invalid Pay payment link field: ' + field);
  return value;
}
function enumNullable<T extends string | null>(value: unknown, field: string, allowed: Set<T>): T {
  if (value !== null && typeof value !== 'string') throw new TypeError('Invalid Pay payment link field: ' + field);
  if (!allowed.has(value as T)) throw new TypeError('Invalid Pay payment link field: ' + field);
  return value as T;
}
function booleanField(row: Record<string, unknown>, field: string): boolean {
  if (typeof row[field] !== 'boolean') throw new TypeError('Invalid Pay payment link field: ' + field);
  return row[field] as boolean;
}

function parseLink(value: unknown): PayPaymentLink {
  const row = record(value);
  const id = requiredString(row, 'id');
  const merchantId = requiredString(row, 'merchant_id');
  if (!UUID.test(id) || !UUID.test(merchantId)) throw new TypeError('Invalid Pay payment link UUID.');
  return {
    id,
    merchant_id: merchantId,
    slug: requiredString(row, 'slug'),
    title: requiredString(row, 'title'),
    fixed_amount_atomic: atomicNullable(row, 'fixed_amount_atomic'),
    asset: enumNullable(row.asset, 'asset', ASSETS),
    fee_payer: enumNullable(row.fee_payer, 'fee_payer', PAYERS),
    checkout_locale: enumNullable(row.checkout_locale, 'checkout_locale', LOCALES) as PayPaymentLink['checkout_locale'],
    is_active: booleanField(row, 'is_active'),
    expires_at: nullableString(row, 'expires_at'),
    created_at: requiredString(row, 'created_at'),
    updated_at: requiredString(row, 'updated_at'),
  };
}

export function createPayPaymentLinkService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async list(merchantId: string, limit = 50): Promise<PayPaymentLink[]> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Payment link limit is invalid.');
      const payload = await client.request<Envelope>('/api/pay/v1/payment-links?merchantId=' + encodeURIComponent(merchantId.trim()) + '&limit=' + limit);
      if (payload.success !== true || payload.apiVersion !== 'v1' || !Array.isArray(payload.data)) throw new TypeError('Invalid Pay payment link list envelope.');
      return payload.data.map(parseLink);
    },
    async get(merchantId: string, linkId: string): Promise<PayPaymentLink> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      if (!UUID.test(linkId.trim())) throw new TypeError('Payment link ID is invalid.');
      const payload = await client.request<Envelope>('/api/pay/v1/payment-links?merchantId=' + encodeURIComponent(merchantId.trim()) + '&linkId=' + encodeURIComponent(linkId.trim()));
      if (payload.success !== true || payload.apiVersion !== 'v1' || !payload.data) throw new TypeError('Invalid Pay payment link detail envelope.');
      return parseLink(payload.data);
    },
  };
}
export const payPaymentLinkService = createPayPaymentLinkService();
