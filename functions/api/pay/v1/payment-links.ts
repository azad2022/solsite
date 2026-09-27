import { PayRuntimeError, assertIdempotencyKey, enforcePayRateLimit, hashCanonicalRequest, makePayRequestId, payFeatureEnabled, payJson, readJsonBody } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; PAY_APP_ORIGIN?: string; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SELECT = [
  'id','merchant_id','slug','title','description','fixed_amount_atomic::text','asset','fee_payer',
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

export const onRequestPost = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!env.PAY_APP_ORIGIN?.trim() || request.headers.get('Origin') !== env.PAY_APP_ORIGIN.trim()) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const identity = await resolvePayIdentity(request, env);
    const body = await readJsonBody(request);
    const merchantId = typeof body.merchantId === 'string' ? body.merchantId.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const amountAtomic = typeof body.fixedAmountAtomic === 'string' ? body.fixedAmountAtomic.trim() : '';
    const asset = body.asset;
    const feePayer = body.feePayer;
    const checkoutLocale = body.checkoutLocale === undefined ? 'auto' : body.checkoutLocale;
    const expiresAt = body.expiresAt === undefined || body.expiresAt === null || body.expiresAt === '' ? null : body.expiresAt;

    if (!UUID.test(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 120) return payJson({ code: 'PAYMENT_LINK_SLUG_INVALID', message: 'Payment link slug is invalid.' }, 400, requestId);
    if (!title || title.length > 200) return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link title is invalid.' }, 400, requestId);
    if (description !== null && description.length > 5000) return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link description is too long.' }, 400, requestId);
    if (!/^\d{1,78}$/.test(amountAtomic) || BigInt(amountAtomic) <= 0n) return payJson({ code: 'INVALID_PAYMENT_LINK_AMOUNT', message: 'Payment link amount must be a positive integer string.' }, 400, requestId);
    if (asset !== 'SOL' && asset !== 'USDC' && asset !== 'USDT') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link asset is invalid.' }, 400, requestId);
    if (feePayer !== 'merchant' && feePayer !== 'customer') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link fee payer is invalid.' }, 400, requestId);
    if (checkoutLocale !== 'fa-IR' && checkoutLocale !== 'en-US' && checkoutLocale !== 'ar' && checkoutLocale !== 'ru' && checkoutLocale !== 'auto') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link locale is invalid.' }, 400, requestId);

    let normalizedExpiresAt: string | null = null;
    if (expiresAt !== null) {
      if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return payJson({ code: 'INVALID_PAYMENT_LINK_EXPIRY', message: 'Payment link expiry is invalid.' }, 400, requestId);
      normalizedExpiresAt = new Date(expiresAt).toISOString();
    }

    const requestHash = await hashCanonicalRequest({
      merchantId, slug, title, description, fixedAmountAtomic: amountAtomic, asset, feePayer, checkoutLocale, expiresAt: normalizedExpiresAt,
    });
    const idempotencyKey = await assertIdempotencyKey(request);
    const identitySubject = await hashCanonicalRequest({ userId: identity.user.applicationUserId });
    await enforcePayRateLimit(env, 'payment-links:create:user', identitySubject, 60, 30);

    const response = await supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/rpc/pay_create_payment_link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        p_merchant_id: merchantId, p_slug: slug, p_title: title, p_description: description,
        p_fixed_amount_atomic: amountAtomic, p_asset: asset, p_fee_payer: feePayer, p_checkout_locale: checkoutLocale,
        p_expires_at: normalizedExpiresAt, p_idempotency_key: idempotencyKey, p_request_hash: requestHash,
      }),
    });
    const result = await response.json() as { state?: string; response_status?: number; response_body?: unknown };
    if (result.state === 'created') return payJson(result.response_body || {}, result.response_status || 201, requestId);
    if (result.state === 'replay') return payJson(result.response_body || {}, 200, requestId);
    if (result.state === 'in_progress') return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical payment link request is already being processed.' }, 409, requestId);
    if (result.state === 'conflict') return payJson({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key was reused with different link data.' }, 409, requestId);
    if (result.state === 'slug_exists') return payJson({ code: 'PAYMENT_LINK_SLUG_EXISTS', message: 'That payment link slug is already in use.' }, 409, requestId);
    if (result.state === 'forbidden') return payJson({ code: 'FORBIDDEN', message: 'You are not allowed to create payment links for this merchant.' }, 403, requestId);
    if (result.state === 'merchant_not_active') return payJson({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not active.' }, 403, requestId);
    if (result.state === 'unauthorized') return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    if (result.state === 'invalid') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link data is invalid.' }, 400, requestId);
    throw new PayRuntimeError('PAYMENT_LINK_CREATION_FAILED', 503, 'Payment link could not be created safely.');
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:payment-link-create', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_LINK_CREATION_FAILED', message: 'Payment link could not be created.' }, 503, requestId);
  }
};
