import { defaultPayHttpClient, type PayHttpClient } from '../http';

export type PayInvoiceStatus = 'draft' | 'open' | 'paid' | 'partially_paid' | 'overdue' | 'void' | 'refunded';
export type PayInvoiceFeePayer = 'merchant' | 'customer';
export type PayInvoiceLocale = 'fa-IR' | 'en-US' | 'ar' | 'ru' | 'auto';

export interface PayInvoice {
  id: string; merchant_id: string; invoice_number: string; customer_label: string | null;
  title: string; description: string | null; amount_atomic: string;
  asset: 'SOL' | 'USDC' | 'USDT'; fee_payer: PayInvoiceFeePayer;
  checkout_locale: PayInvoiceLocale; due_at: string | null; status: PayInvoiceStatus;
  created_at: string; updated_at: string;
}

interface Envelope { success?: boolean; apiVersion?: string; data?: unknown; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const STATUSES = new Set<PayInvoiceStatus>(['draft','open','paid','partially_paid','overdue','void','refunded']);
const ASSETS = new Set<PayInvoice['asset']>(['SOL','USDC','USDT']);
const PAYERS = new Set<PayInvoiceFeePayer>(['merchant','customer']);
const LOCALES = new Set<PayInvoiceLocale>(['fa-IR','en-US','ar','ru','auto']);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Pay invoice payload.');
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Invalid Pay invoice field: ' + field);
  return value;
}
function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}
function atomic(value: unknown, field: string): string {
  const result = requiredString(value, field);
  if (!/^\d+$/.test(result)) throw new TypeError('Invalid Pay invoice field: ' + field);
  return result;
}

function parseInvoice(value: unknown): PayInvoice {
  const row = record(value);
  const id = requiredString(row.id, 'id');
  const asset = requiredString(row.asset, 'asset');
  const feePayer = requiredString(row.fee_payer, 'fee_payer');
  const checkoutLocale = requiredString(row.checkout_locale, 'checkout_locale');
  const status = requiredString(row.status, 'status') as PayInvoiceStatus;
  if (!UUID.test(id) || !ASSETS.has(asset as PayInvoice['asset']) || !PAYERS.has(feePayer as PayInvoiceFeePayer) || !LOCALES.has(checkoutLocale as PayInvoiceLocale) || !STATUSES.has(status)) throw new TypeError('Invalid Pay invoice state.');
  if (row.due_at !== null && typeof row.due_at !== 'string') throw new TypeError('Invalid Pay invoice field: due_at');
  return {
    id, merchant_id: requiredString(row.merchant_id, 'merchant_id'), invoice_number: requiredString(row.invoice_number, 'invoice_number'),
    customer_label: nullableString(row.customer_label, 'customer_label'), title: requiredString(row.title, 'title'),
    description: nullableString(row.description, 'description'), amount_atomic: atomic(row.amount_atomic, 'amount_atomic'),
    asset: asset as PayInvoice['asset'], fee_payer: feePayer as PayInvoiceFeePayer, checkout_locale: checkoutLocale as PayInvoiceLocale,
    due_at: row.due_at as string | null, status, created_at: requiredString(row.created_at, 'created_at'), updated_at: requiredString(row.updated_at, 'updated_at'),
  };
}

export function createPayInvoiceService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async list(merchantId: string, filters: { status?: PayInvoiceStatus; search?: string; limit?: number } = {}): Promise<PayInvoice[]> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      if (filters.status && !STATUSES.has(filters.status)) throw new TypeError('Invoice status is invalid.');
      if (filters.limit !== undefined && (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 100)) throw new TypeError('Invoice limit is invalid.');
      const params = new URLSearchParams({ merchantId: merchantId.trim(), limit: String(filters.limit ?? 50) });
      if (filters.status) params.set('status', filters.status);
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      const payload = await client.request<Envelope>('/api/pay/v1/invoices?' + params.toString());
      if (payload.success !== true || payload.apiVersion !== 'v1' || !Array.isArray(payload.data)) throw new TypeError('Invalid Pay invoice list envelope.');
      return payload.data.map(parseInvoice);
    },
    async get(merchantId: string, invoiceId: string): Promise<PayInvoice> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      if (!UUID.test(invoiceId.trim())) throw new TypeError('Invoice ID is invalid.');
      const payload = await client.request<Envelope>('/api/pay/v1/invoices?merchantId=' + encodeURIComponent(merchantId.trim()) + '&invoiceId=' + encodeURIComponent(invoiceId.trim()));
      if (payload.success !== true || payload.apiVersion !== 'v1' || !payload.data) throw new TypeError('Invalid Pay invoice detail envelope.');
      return parseInvoice(payload.data);
    },
  };
}

export const payInvoiceService = createPayInvoiceService();