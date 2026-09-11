import { defaultPayHttpClient, type PayHttpClient } from '../http';

export interface PayWebhook {
  id: string;
  merchant_id: string;
  endpoint_url: string;
  active: boolean;
  subscribed_events: string[];
  created_at: string;
  updated_at: string;
  status: string;
  failure_count: number;
  disabled_at: string | null;
  secret_configured: boolean;
  signature_status: 'server_signed' | 'not_configured';
}

export interface PayWebhookDelivery {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  attempt_count: number;
  status: string;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  delivered_at: string | null;
  created_at: string;
  response_status: number | null;
  response_hash: string | null;
  error_code: string | null;
}

interface ListEnvelope { success?: boolean; apiVersion?: string; data?: unknown; meta?: unknown }
interface DetailEnvelope { success?: boolean; apiVersion?: string; data?: unknown; meta?: unknown }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Pay webhook payload.');
  return value as Record<string, unknown>;
}
function stringField(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Invalid Pay webhook field: ${field}`);
  return value;
}
function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new TypeError(`Invalid Pay webhook field: ${field}`);
  return value;
}
function booleanField(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`Invalid Pay webhook field: ${field}`);
  return value;
}
function integerField(value: unknown, field: string, min = 0): number {
  if (!Number.isInteger(value) || Number(value) < min) throw new TypeError(`Invalid Pay webhook field: ${field}`);
  return Number(value);
}
function parseWebhook(value: unknown): PayWebhook {
  const row = record(value);
  const signatureStatus = stringField(row.signature_status, 'signature_status');
  if (signatureStatus !== 'server_signed' && signatureStatus !== 'not_configured') throw new TypeError('Invalid Pay webhook signature status.');
  if (!UUID.test(stringField(row.id, 'id'))) throw new TypeError('Invalid Pay webhook ID.');
  if (!Array.isArray(row.subscribed_events) || row.subscribed_events.some(item => typeof item !== 'string')) throw new TypeError('Invalid Pay webhook subscribed events.');
  return {
    id: row.id as string,
    merchant_id: stringField(row.merchant_id, 'merchant_id'),
    endpoint_url: stringField(row.endpoint_url, 'endpoint_url'),
    active: booleanField(row.active, 'active'),
    subscribed_events: row.subscribed_events as string[],
    created_at: stringField(row.created_at, 'created_at'),
    updated_at: stringField(row.updated_at, 'updated_at'),
    status: stringField(row.status, 'status'),
    failure_count: integerField(row.failure_count, 'failure_count'),
    disabled_at: nullableString(row.disabled_at, 'disabled_at'),
    secret_configured: booleanField(row.secret_configured, 'secret_configured'),
    signature_status: signatureStatus,
  };
}
function parseDelivery(value: unknown): PayWebhookDelivery {
  const row = record(value);
  const responseStatus = row.response_status === null ? null : integerField(row.response_status, 'response_status', 100);
  return {
    id: stringField(row.id, 'id'),
    webhook_id: stringField(row.webhook_id, 'webhook_id'),
    event_id: stringField(row.event_id, 'event_id'),
    event_type: stringField(row.event_type, 'event_type'),
    attempt_count: integerField(row.attempt_count, 'attempt_count'),
    status: stringField(row.status, 'status'),
    next_attempt_at: nullableString(row.next_attempt_at, 'next_attempt_at'),
    last_attempt_at: nullableString(row.last_attempt_at, 'last_attempt_at'),
    delivered_at: nullableString(row.delivered_at, 'delivered_at'),
    created_at: stringField(row.created_at, 'created_at'),
    response_status: responseStatus,
    response_hash: nullableString(row.response_hash, 'response_hash'),
    error_code: nullableString(row.error_code, 'error_code'),
  };
}
function parseList(payload: unknown): PayWebhook[] {
  const body = record(payload);
  if (body.success !== true || body.apiVersion !== 'v1' || !Array.isArray(body.data)) throw new TypeError('Invalid Pay webhook list envelope.');
  return body.data.map(parseWebhook);
}
function parseDetail(payload: unknown): { webhook: PayWebhook; deliveries: PayWebhookDelivery[] } {
  const body = record(payload);
  if (body.success !== true || body.apiVersion !== 'v1') throw new TypeError('Invalid Pay webhook detail envelope.');
  const data = record(body.data);
  if (!Array.isArray(data.deliveries)) throw new TypeError('Invalid Pay webhook delivery list.');
  return { webhook: parseWebhook(data.webhook), deliveries: data.deliveries.map(parseDelivery) };
}

export function createPayWebhookService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async list(merchantId: string, limit = 50): Promise<PayWebhook[]> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Webhook limit is invalid.');
      return parseList(await client.request<ListEnvelope>(`/api/pay/v1/webhooks?merchantId=${encodeURIComponent(merchantId.trim())}&limit=${limit}`));
    },
    async get(merchantId: string, webhookId: string, limit = 50): Promise<{ webhook: PayWebhook; deliveries: PayWebhookDelivery[] }> {
      if (!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      if (!UUID.test(webhookId.trim())) throw new TypeError('Webhook ID is invalid.');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Webhook limit is invalid.');
      return parseDetail(await client.request<DetailEnvelope>(`/api/pay/v1/webhooks?merchantId=${encodeURIComponent(merchantId.trim())}&webhookId=${encodeURIComponent(webhookId.trim())}&limit=${limit}`));
    },
  };
}

export const payWebhookService = createPayWebhookService();
