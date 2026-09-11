import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value: string): boolean { return UUID.test(value); }
function safeLimit(value: string | null): number {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  return parsed;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const merchantId = (params.get('merchantId') || '').trim();
    const webhookId = (params.get('webhookId') || '').trim();
    if (!validUuid(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    if (webhookId && !validUuid(webhookId)) return payJson({ code: 'WEBHOOK_ID_INVALID', message: 'Webhook ID is invalid.' }, 400, requestId);
    const limit = safeLimit(params.get('limit'));

    const response = await supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/rpc/pay_read_webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_merchant_id: merchantId, p_webhook_id: webhookId || null, p_limit: limit }),
    });
    const result = await response.json() as { authorized?: boolean; code?: string; webhooks?: unknown; deliveries?: unknown };
    if (result.authorized !== true) {
      if (result.code === 'FORBIDDEN') return payJson({ code: 'FORBIDDEN', message: 'You are not allowed to access this merchant.' }, 403, requestId);
      return payJson({ code: result.code === 'INVALID_ARGUMENT' ? 'INVALID_ARGUMENT' : 'UNAUTHORIZED', message: 'Webhook access is not authorized.' }, result.code === 'INVALID_ARGUMENT' ? 400 : 401, requestId);
    }

    if (!webhookId) return payJson({ apiVersion: 'v1', data: Array.isArray(result.webhooks) ? result.webhooks : [], meta: { merchantId, limit, returned: Array.isArray(result.webhooks) ? result.webhooks.length : 0 } }, 200, requestId);
    const webhooks = Array.isArray(result.webhooks) ? result.webhooks : [];
    if (webhooks.length !== 1) return payJson({ code: 'WEBHOOK_NOT_FOUND', message: 'Webhook was not found.' }, 404, requestId);
    const deliveries = Array.isArray(result.deliveries) ? result.deliveries : [];
    return payJson({ apiVersion: 'v1', data: { webhook: webhooks[0], deliveries }, meta: { merchantId, webhookId, limit, returnedDeliveries: deliveries.length } }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:webhooks-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'WEBHOOKS_READ_FAILED', message: 'Webhook data could not be retrieved.' }, 503, requestId);
  }
};
