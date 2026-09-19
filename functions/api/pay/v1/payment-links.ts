import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SELECT = [
  'id','merchant_id','slug','title','fixed_amount_atomic','asset','fee_payer',
  'checkout_locale','is_active','expires_at','created_at','updated_at',
].join(',');

function safeLimit(value: string | null): number {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  }
  return parsed;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const merchantId = (params.get('merchantId') || '').trim();
    const linkId = (params.get('linkId') || '').trim();
    const slug = (params.get('slug') || '').trim();
    const limit = safeLimit(params.get('limit'));

    if (!UUID.test(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    if (linkId && !UUID.test(linkId)) return payJson({ code: 'PAYMENT_LINK_ID_INVALID', message: 'Payment link ID is invalid.' }, 400, requestId);
    if (slug.length > 160) return payJson({ code: 'SLUG_TOO_LONG', message: 'Payment link slug is too long.' }, 400, requestId);

    const conditions = ['merchant_id=eq.' + encodeURIComponent(merchantId)];
    if (linkId) conditions.push('id=eq.' + encodeURIComponent(linkId));
    if (slug) conditions.push('slug=eq.' + encodeURIComponent(slug));

    const response = await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      '/rest/v1/pay_payment_links?select=' + SELECT + '&' + conditions.join('&') + '&order=created_at.desc&limit=' + (linkId || slug ? '1' : String(limit)),
    );
    const rows = await response.json() as Array<Record<string, unknown>>;

    if ((linkId || slug) && rows.length === 0) {
      return payJson({ code: 'PAYMENT_LINK_NOT_FOUND', message: 'Payment link was not found.' }, 404, requestId);
    }

    return payJson({
      apiVersion: 'v1',
      data: linkId || slug ? rows[0] : rows,
      meta: linkId || slug ? { merchantId, paymentLinkId: linkId || null, slug: slug || null } : { merchantId, limit, returned: rows.length },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    }
    console.error(JSON.stringify({ scope: 'pay:payment-links-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_LINKS_READ_FAILED', message: 'Payment links could not be retrieved.' }, 503, requestId);
  }
};
