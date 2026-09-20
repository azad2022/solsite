import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDate(value: string | null, field: string): string {
  if (!value) throw new PayRuntimeError('REPORT_RANGE_INVALID', 400, field + ' is required.');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PayRuntimeError('REPORT_RANGE_INVALID', 400, field + ' must be a valid ISO date.');
  return date.toISOString();
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const merchantId = (params.get('merchantId') || '').trim();
    if (!UUID.test(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);

    const from = parseDate(params.get('from'), 'from');
    const to = parseDate(params.get('to'), 'to');
    if (new Date(from).getTime() >= new Date(to).getTime()) {
      return payJson({ code: 'REPORT_RANGE_INVALID', message: 'Report period must have from before to.' }, 400, requestId);
    }

    const query = '/rest/v1/rpc/pay_read_report';
    const response = await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      query,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_merchant_id: merchantId, p_from: from, p_to: to }),
      },
    );

    if (!response.ok) {
      if (response.status === 401) return payJson({ code: 'UNAUTHORIZED', message: 'Authentication is required.' }, 401, requestId);
      if (response.status === 403) return payJson({ code: 'FORBIDDEN', message: 'You are not allowed to access this merchant report.' }, 403, requestId);
      throw new PayRuntimeError('REPORT_READ_FAILED', 503, 'Report data could not be retrieved.');
    }

    const data = await response.json();
    return payJson({ apiVersion: 'v1', data }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    }
    console.error(JSON.stringify({ scope: 'pay:reports-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'REPORT_READ_FAILED', message: 'Report data could not be retrieved.' }, 503, requestId);
  }
};
