import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }

const WEBHOOK_SELECT = [
  'id', 'merchant_id', 'endpoint_url', 'active', 'subscribed_events', 'created_at', 'updated_at',
  'status', 'failure_count', 'disabled_at', 'secret_hash', 'encrypted_secret', 'secret_ciphertext', 'signing_secret_ciphertext',
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
    subscribed_events: row.subscribed_events,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    failure_count: row.failure_count,
    disabled_at: row.disabled_at,
    secret_configured: secretConfigured,
    signature_status: secretConfigured ? 'server_signed' : 'not_configured',
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

    const conditions = [`merchant_id=eq.${encodeURIComponent(merchantId)}`];
    if (webhookId) conditions.push(`id=eq.${encodeURIComponent(webhookId)}`);
    const query = `/rest/v1/pay_webhooks?select=${WEBHOOK_SELECT}&${conditions.join('&')}&order=created_at.desc&limit=${limit}`;
    const response = await supabaseRequestAsIdentity(env, identity.accessToken, query);
    const rows = await response.json() as Array<Record<string, unknown>>;

    const data = rows.map(projectWebhook);
    return payJson({ apiVersion: 'v1', data, meta: { merchantId, limit, returned: data.length } }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:webhooks-list', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'WEBHOOKS_READ_FAILED', message: 'Webhooks could not be retrieved.' }, 503, requestId);
  }
};
