import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }

const WEBHOOK_SELECT = [
  'id', 'merchant_id', 'endpoint_url', 'active', 'subscribed_events', 'created_at', 'updated_at',
  'status', 'failure_count', 'disabled_at', 'secret_hash', 'encrypted_secret', 'secret_ciphertext', 'signing_secret_ciphertext',
].join(',');
const DELIVERY_SELECT = [
  'id', 'webhook_id', 'event_id', 'event_type', 'attempt_count', 'status', 'next_attempt_at', 'last_attempt_at',
  'delivered_at', 'created_at', 'response_status', 'response_hash', 'error_code',
].join(',');

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeLimit(value: string | null): number {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  return parsed;
}

function projectWebhook(row: Record<string, unknown>) {
  const secretConfigured = Boolean(row.secret_hash || row.encrypted_secret || row.secret_ciphertext || row.signing_secret_ciphertext);
  return {
    id: row.id,
    merchant_id: row.merchant_id,
    endpoint_url: row.endpoint_url,
    active: row.active,
    subscribed_events: Array.isArray(row.subscribed_events) ? row.subscribed_events : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    failure_count: row.failure_count,
    disabled_at: row.disabled_at,
    secret_configured: secretConfigured,
    signature_status: secretConfigured ? 'server_signed' : 'not_configured',
  };
}

function projectDelivery(row: Record<string, unknown>) {
  return {
    id: row.id,
    webhook_id: row.webhook_id,
    event_id: row.event_id,
    event_type: row.event_type,
    attempt_count: row.attempt_count,
    status: row.status,
    next_attempt_at: row.next_attempt_at,
    last_attempt_at: row.last_attempt_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    response_status: row.response_status,
    response_hash: row.response_hash,
    error_code: row.error_code,
  };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const merchantId = (params.get('merchantId') || '').trim();
    if (!validUuid(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    const limit = safeLimit(params.get('limit'));
    const webhookId = (params.get('webhookId') || '').trim();
    if (webhookId && !validUuid(webhookId)) return payJson({ code: 'WEBHOOK_ID_INVALID', message: 'Webhook ID is invalid.' }, 400, requestId);

    const webhookConditions = [`merchant_id=eq.${encodeURIComponent(merchantId)}`];
    if (webhookId) webhookConditions.push(`id=eq.${encodeURIComponent(webhookId)}`);
    const webhookQuery = `/rest/v1/pay_webhooks?select=${WEBHOOK_SELECT}&${webhookConditions.join('&')}&order=created_at.desc&limit=${limit}`;
    const webhookResponse = await supabaseRequestAsIdentity(env, identity.accessToken, webhookQuery);
    const webhookRows = await webhookResponse.json() as Array<Record<string, unknown>>;
    const data = webhookRows.map(projectWebhook);

    if (!webhookId) return payJson({ apiVersion: 'v1', data, meta: { merchantId, limit, returned: data.length } }, 200, requestId);
    if (data.length === 0) return payJson({ code: 'WEBHOOK_NOT_FOUND', message: 'Webhook was not found.' }, 404, requestId);

    const deliveryQuery = `/rest/v1/pay_webhook_deliveries?select=${DELIVERY_SELECT}&webhook_id=eq.${encodeURIComponent(webhookId)}&order=created_at.desc&limit=${limit}`;
    const deliveryResponse = await supabaseRequestAsIdentity(env, identity.accessToken, deliveryQuery);
    const deliveryRows = await deliveryResponse.json() as Array<Record<string, unknown>>;

    return payJson({
      apiVersion: 'v1',
      data: { webhook: data[0], deliveries: deliveryRows.map(projectDelivery) },
      meta: { merchantId, webhookId, limit, returnedDeliveries: deliveryRows.length },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:webhooks-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'WEBHOOKS_READ_FAILED', message: 'Webhook data could not be retrieved.' }, 503, requestId);
  }
};
