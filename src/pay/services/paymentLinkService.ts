import { defaultPayHttpClient, type PayHttpClient } from '../http';

export interface CreatePayPaymentLinkInput {
  merchantId: string;
  slug: string;
  title: string;
  description?: string | null;
  fixedAmountAtomic: string;
  asset: 'SOL' | 'USDC' | 'USDT';
  feePayer: 'merchant' | 'customer';
  checkoutLocale: 'fa-IR' | 'en-US' | 'ar' | 'ru' | 'auto';
  expiresAt?: string | null;
}

export interface PublicPayPaymentLink {
  slug: string;
  title: string;
  description: string | null;
  amountAtomic: string;
  amountDecimals: number;
  asset: 'SOL' | 'USDC' | 'USDT';
  feePayer: 'merchant' | 'customer';
  checkoutLocale: 'fa-IR' | 'en-US' | 'ar' | 'ru' | 'auto';
  expiresAt: string | null;
  merchant: { businessName: string };
}

export interface PayPaymentLink {
  id: string;
  merchant_id: string;
  slug: string;
  title: string;
  description: string | null;
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
    description: nullableString(row, 'description'),
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
    async create(input: CreatePayPaymentLinkInput, idempotencyKey: string): Promise<PayPaymentLink> {
      if (!UUID.test(input.merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      const slug = input.slug.trim().toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 120) throw new TypeError('Payment link slug is invalid.');
      if (!input.title.trim() || input.title.trim().length > 200) throw new TypeError('Payment link title is invalid.');
      if (input.description && input.description.trim().length > 5000) throw new TypeError('Payment link description is too long.');
      if (!/^\d{1,78}$/.test(input.fixedAmountAtomic.trim()) || BigInt(input.fixedAmountAtomic.trim()) <= 0n) throw new TypeError('Payment link amount is invalid.');
      if (!ASSETS.has(input.asset) || !PAYERS.has(input.feePayer) || !LOCALES.has(input.checkoutLocale)) throw new TypeError('Payment link option is invalid.');
      if (!idempotencyKey.trim()) throw new TypeError('Idempotency key is required.');
      const payload = await client.request<Envelope>('/api/pay/v1/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.trim() },
        body: JSON.stringify({
          merchantId: input.merchantId.trim(),
          slug,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          fixedAmountAtomic: input.fixedAmountAtomic.trim(),
          asset: input.asset,
          feePayer: input.feePayer,
          checkoutLocale: input.checkoutLocale,
          expiresAt: input.expiresAt || null,
        }),
      });
      if (payload.success !== true || payload.apiVersion !== 'v1' || !payload.data) throw new TypeError('Invalid Pay payment link create envelope.');
      return parseLink(payload.data);
    },
    async getPublic(slug: string): Promise<PublicPayPaymentLink> {
      const normalized = slug.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized.length < 3 || normalized.length > 120) throw new TypeError('Payment link slug is invalid.');
      const payload = await client.request<Envelope>('/api/pay/v1/payment-links/' + encodeURIComponent(normalized));
      const row = record(payload.data);
      const amount = requiredString(row, 'amountAtomic');
      const asset = requiredString(row, 'asset');
      const feePayer = requiredString(row, 'feePayer');
      const checkoutLocale = requiredString(row, 'checkoutLocale');
      const amountDecimals = row.amountDecimals;
      if (typeof amountDecimals !== 'number' || !Number.isInteger(amountDecimals) || amountDecimals < 0 || amountDecimals > 255) throw new TypeError('Invalid public Pay payment link amount decimals.');
      if (payload.success !== true || payload.apiVersion !== 'v1' || !/^\d{1,78}$/.test(amount) || !ASSETS.has(asset as PayPaymentLink['asset']) || !PAYERS.has(feePayer as PayPaymentLink['fee_payer']) || !LOCALES.has(checkoutLocale as PayPaymentLink['checkout_locale'])) throw new TypeError('Invalid public Pay payment link envelope.');
      const merchant = record(row.merchant);
      return {
        slug: requiredString(row, 'slug'),
        title: requiredString(row, 'title'),
        description: nullableString(row, 'description'),
        amountAtomic: amount,
        amountDecimals,
        asset: asset as PublicPayPaymentLink['asset'],
        feePayer: feePayer as PublicPayPaymentLink['feePayer'],
        checkoutLocale: checkoutLocale as PublicPayPaymentLink['checkoutLocale'],
        expiresAt: nullableString(row, 'expiresAt'),
        merchant: { businessName: requiredString(merchant, 'businessName') },
      };
    },
    async createFromPublic(slug: string, idempotencyKey: string): Promise<{ id: string }> {
      const normalized = slug.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized.length < 3 || normalized.length > 120) throw new TypeError('Payment link slug is invalid.');
      if (!idempotencyKey.trim()) throw new TypeError('Idempotency key is required.');
      const payload = await client.request<Envelope>('/api/pay/v1/payment-links/' + encodeURIComponent(normalized), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.trim() },
        body: '{}',
      });
      const row = record(payload.data);
      const id = requiredString(row, 'id');
      if (payload.success !== true || payload.apiVersion !== 'v1' || !UUID.test(id)) throw new TypeError('Invalid Pay payment intent envelope.');
      return { id };
    },
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
