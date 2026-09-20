import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv {
  PAY_API_ENABLED?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value: string): boolean {
  return UUID.test(value);
}

function safeLimit(value: string | null): number {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  }
  return parsed;
}

function escapeSearch(value: string): string {
  return value.replace(/[%*,()]/g, '').trim();
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) {
    return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  }

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const merchantId = (params.get('merchantId') || '').trim();
    if (!validUuid(merchantId)) {
      return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    }

    const search = escapeSearch((params.get('search') || '').slice(0, 120));
    const limit = safeLimit(params.get('limit'));

    const conditions = ['merchant_id=eq.' + encodeURIComponent(merchantId)];
    if (search) {
      conditions.push('customer_wallet_address=ilike.*' + encodeURIComponent(search) + '*');
    }

    const query = [
      '/rest/v1/pay_customer_projection?select=merchant_id,customer_wallet_address,first_seen_at,last_seen_at,payment_intent_count,completed_payment_count',
      conditions.join('&'),
      'order=last_seen_at.desc',
      'limit=' + String(limit),
    ].join('&');

    const response = await supabaseRequestAsIdentity(env, identity.accessToken, query);
    if (!response.ok) {
      if (response.status === 401) {
        return payJson({ code: 'UNAUTHORIZED', message: 'Authentication is required.' }, 401, requestId);
      }
      if (response.status === 403) {
        return payJson({ code: 'FORBIDDEN', message: 'You are not allowed to access this merchant.' }, 403, requestId);
      }
      throw new PayRuntimeError('CUSTOMERS_READ_FAILED', 503, 'Customer data could not be retrieved.');
    }

    const rows = await response.json() as Array<Record<string, unknown>>;
    return payJson({
      apiVersion: 'v1',
      data: rows,
      meta: { merchantId, limit, returned: rows.length },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      return payJson(
        { code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message },
        error.status,
        requestId,
      );
    }

    console.error(JSON.stringify({
      scope: 'pay:customers-read',
      requestId,
      error: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
    }));
    return payJson({ code: 'CUSTOMERS_READ_FAILED', message: 'Customer data could not be retrieved.' }, 503, requestId);
  }
};
