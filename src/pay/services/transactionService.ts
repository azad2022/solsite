import { defaultPayHttpClient, type PayHttpClient } from '../http';

export type PayTransactionStatus =
  | 'created' | 'pending' | 'detected' | 'verifying' | 'confirmed' | 'completed'
  | 'expired' | 'underpaid' | 'overpaid' | 'wrong_token' | 'wrong_recipient'
  | 'duplicate' | 'ambiguous' | 'failed' | 'refunded';

export interface PayTransaction {
  id: string;
  merchant_id: string;
  external_order_id: string | null;
  amount_atomic: string;
  asset: string;
  token_mint: string | null;
  token_program: string | null;
  token_decimals: number | null;
  recipient: string;
  reference: string;
  fee_atomic: string;
  fee_payer: string;
  customer_total_atomic: string;
  merchant_net_atomic: string | null;
  merchant_settlement_atomic: string | null;
  status: PayTransactionStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
  network: string;
  payment_link_id: string | null;
  invoice_id: string | null;
  customer_wallet_address: string | null;
}

export interface PayTransactionDetail {
  payment: PayTransaction & { fee_bps: number; gas_sponsored: boolean; fee_recipient: string | null; fee_payer_address: string | null };
  transactions: Array<Record<string, unknown>>;
  transfers: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}

interface ListEnvelope { success?: boolean; apiVersion?: string; data?: unknown; meta?: { merchantId?: unknown; limit?: unknown; returned?: unknown } }
interface DetailEnvelope { success?: boolean; apiVersion?: string; data?: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<PayTransactionStatus>([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'completed', 'expired',
  'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient', 'duplicate', 'ambiguous', 'failed', 'refunded',
]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Pay transaction payload.');
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Invalid Pay transaction field: ${field}`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new TypeError(`Invalid Pay transaction field: ${field}`);
  return value;
}

function atomic(value: unknown, field: string): string {
  const result = requiredString(value, field);
  if (!/^\d+$/.test(result)) throw new TypeError(`Invalid Pay transaction field: ${field}`);
  return result;
}

function parseTransaction(value: unknown): PayTransaction {
  const row = record(value);
  if (!UUID.test(requiredString(row.id, 'id'))) throw new TypeError('Invalid Pay transaction ID.');
  const status = requiredString(row.status, 'status') as PayTransactionStatus;
  if (!STATUSES.has(status)) throw new TypeError('Invalid Pay transaction status.');
  return {
    id: row.id as string,
    merchant_id: requiredString(row.merchant_id, 'merchant_id'),
    external_order_id: nullableString(row.external_order_id, 'external_order_id'),
    amount_atomic: atomic(row.amount_atomic, 'amount_atomic'),
    asset: requiredString(row.asset, 'asset'),
    token_mint: nullableString(row.token_mint, 'token_mint'),
    token_program: nullableString(row.token_program, 'token_program'),
    token_decimals: row.token_decimals === null ? null : Number(row.token_decimals),
    recipient: requiredString(row.recipient, 'recipient'),
    reference: requiredString(row.reference, 'reference'),
    fee_atomic: atomic(row.fee_atomic, 'fee_atomic'),
    fee_payer: requiredString(row.fee_payer, 'fee_payer'),
    customer_total_atomic: atomic(row.customer_total_atomic, 'customer_total_atomic'),
    merchant_net_atomic: row.merchant_net_atomic === null ? null : atomic(row.merchant_net_atomic, 'merchant_net_atomic'),
    merchant_settlement_atomic: row.merchant_settlement_atomic === null ? null : atomic(row.merchant_settlement_atomic, 'merchant_settlement_atomic'),
    status,
    expires_at: requiredString(row.expires_at, 'expires_at'),
    created_at: requiredString(row.created_at, 'created_at'),
    updated_at: requiredString(row.updated_at, 'updated_at'),
    network: requiredString(row.network, 'network'),
    payment_link_id: nullableString(row.payment_link_id, 'payment_link_id'),
    invoice_id: nullableString(row.invoice_id, 'invoice_id'),
    customer_wallet_address: nullableString(row.customer_wallet_address, 'customer_wallet_address'),
  };
}

function parseList(payload: unknown): PayTransaction[] {
  const body = record(payload);
  if (body.success !== true || body.apiVersion !== 'v1' || !Array.isArray(body.data)) throw new TypeError('Invalid Pay transaction list envelope.');
  return body.data.map(parseTransaction);
}

function parseDetail(payload: unknown): PayTransactionDetail {
  const body = record(payload);
  if (body.success !== true || body.apiVersion !== 'v1') throw new TypeError('Invalid Pay transaction detail envelope.');
  const data = record(body.data);
  const payment = parseTransaction(data.payment);
  const enriched = record(data.payment);
  if (!Number.isInteger(enriched.fee_bps) || typeof enriched.gas_sponsored !== 'boolean') throw new TypeError('Invalid Pay transaction detail fields.');
  const list = (field: string) => Array.isArray(data[field]) ? data[field].map(record) : (() => { throw new TypeError(`Invalid Pay transaction detail list: ${field}`); })();
  return {
    payment: { ...payment, fee_bps: enriched.fee_bps as number, gas_sponsored: enriched.gas_sponsored as boolean, fee_recipient: nullableString(enriched.fee_recipient, 'fee_recipient'), fee_payer_address: nullableString(enriched.fee_payer_address, 'fee_payer_address') },
    transactions: list('transactions'),
    transfers: list('transfers'),
    events: list('events'),
  };
}

export function createPayTransactionService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async list(merchantId: string, filters: { status?: PayTransactionStatus; search?: string; limit?: number } = {}): Promise<PayTransaction[]> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      if (filters.status && !STATUSES.has(filters.status)) throw new TypeError('Transaction status is invalid.');
      const params = new URLSearchParams({ merchantId: merchantId.trim(), limit: String(filters.limit ?? 50) });
      if (filters.status) params.set('status', filters.status);
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      return parseList(await client.request<ListEnvelope>(`/api/pay/v1/transactions?${params.toString()}`));
    },
    async get(id: string): Promise<PayTransactionDetail> {
      if (!UUID.test(id.trim())) throw new TypeError('Transaction ID is invalid.');
      return parseDetail(await client.request<DetailEnvelope>(`/api/pay/v1/transactions/${encodeURIComponent(id.trim())}`));
    },
  };
}

export const payTransactionService = createPayTransactionService();
