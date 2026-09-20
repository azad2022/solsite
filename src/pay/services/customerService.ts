import { defaultPayHttpClient, type PayHttpClient } from '../http';

export interface PayCustomer {
  merchant_id: string;
  customer_wallet_address: string;
  first_seen_at: string;
  last_seen_at: string;
  payment_intent_count: number;
  completed_payment_count: number;
}

interface Envelope {
  success?: boolean;
  apiVersion?: string;
  data?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid Pay customer payload.');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Invalid Pay customer field: ' + field);
  }
  return value;
}

function count(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new TypeError('Invalid Pay customer field: ' + field);
  }
  return parsed;
}

function parseCustomer(value: unknown): PayCustomer {
  const row = record(value);
  const merchantId = requiredString(row.merchant_id, 'merchant_id');
  if (!UUID.test(merchantId)) throw new TypeError('Invalid Pay customer merchant ID.');
  const wallet = requiredString(row.customer_wallet_address, 'customer_wallet_address');
  const firstSeen = requiredString(row.first_seen_at, 'first_seen_at');
  const lastSeen = requiredString(row.last_seen_at, 'last_seen_at');

  return {
    merchant_id: merchantId,
    customer_wallet_address: wallet,
    first_seen_at: firstSeen,
    last_seen_at: lastSeen,
    payment_intent_count: count(row.payment_intent_count, 'payment_intent_count'),
    completed_payment_count: count(row.completed_payment_count, 'completed_payment_count'),
  };
}

function parseList(payload: unknown): PayCustomer[] {
  const body = record(payload);
  if (body.success !== true || body.apiVersion !== 'v1' || !Array.isArray(body.data)) {
    throw new TypeError('Invalid Pay customer list envelope.');
  }
  return body.data.map(parseCustomer);
}

export function createPayCustomerService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async list(
      merchantId: string,
      filters: { search?: string; limit?: number } = {},
    ): Promise<PayCustomer[]> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      const params = new URLSearchParams({
        merchantId: merchantId.trim(),
        limit: String(filters.limit ?? 50),
      });
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      return parseList(await client.request<Envelope>('/api/pay/v1/customers?' + params.toString()));
    },
  };
}

export const payCustomerService = createPayCustomerService();
