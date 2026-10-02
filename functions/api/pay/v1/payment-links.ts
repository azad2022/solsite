import { PayRuntimeError, assertIdempotencyKey, calculateSnapshot, enforcePayRateLimit, hashCanonicalRequest, makePayRequestId, payFeatureEnabled, payJson, readJsonBody } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';
import { calculateSnapshot } from '../_shared/runtime';
import { resolveAssetFromEnvironment } from '../../../../src/pay/services/assetPolicy';

interface PayEnv extends PayIdentityEnv {
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
  PAY_USDC_MINT?: string;
  PAY_USDC_DECIMALS?: string;
  PAY_USDT_MINT?: string;
  PAY_USDT_DECIMALS?: string;
}

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
    const rawRows = await response.json() as Array<Record<string, unknown>>;
    const assetDecimals: Record<'SOL' | 'USDC' | 'USDT', number | null> = { SOL: 9, USDC: null, USDT: null };
    for (const asset of ['SOL', 'USDC', 'USDT'] as const) {
      try {
        const config = resolveAssetFromEnvironment(asset, env as Record<string, string | undefined>);
        assetDecimals[asset] = config.decimals ?? 9;
      } catch {
        assetDecimals[asset] = null;
      }
    }
    const rows = rawRows.map((row) => {
      const asset = row.asset;
      if (asset !== 'SOL' && asset !== 'USDC' && asset !== 'USDT') return { ...row, amount_decimals: null };
      try {
        const config = resolveAssetFromEnvironment(asset, env as Record<string, string | undefined>);
        return { ...row, amount_decimals: config.decimals ?? 9 };
      } catch {
        return { ...row, amount_decimals: null };
      }
    });

    if ((linkId || slug) && rows.length === 0) {
      return payJson({ code: 'PAYMENT_LINK_NOT_FOUND', message: 'Payment link was not found.' }, 404, requestId);
    }

    return payJson({
      apiVersion: 'v1',
      data: linkId || slug ? rows[0] : rows,
      meta: linkId || slug
        ? { merchantId, paymentLinkId: linkId || null, slug: slug || null, assetDecimals }
        : { merchantId, limit, returned: rows.length, assetDecimals },
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
    try {
      resolveAssetFromEnvironment(asset, env as Record<string, string | undefined>);
    } catch {
      return payJson({ code: 'PAYMENT_LINK_ASSET_NOT_CONFIGURED', message: 'The selected payment asset is not configured for SolMint Pay.' }, 503, requestId);
    }
    if (feePayer !== 'merchant' && feePayer !== 'customer') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link fee payer is invalid.' }, 400, requestId);
    if (checkoutLocale !== 'fa-IR' && checkoutLocale !== 'en-US' && checkoutLocale !== 'ar' && checkoutLocale !== 'ru' && checkoutLocale !== 'auto') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link locale is invalid.' }, 400, requestId);
    try {
      const snapshot = calculateSnapshot(amountAtomic, feePayer, 100);
      if (BigInt(snapshot.merchantNetAtomic) <= 0n) return payJson({ code: 'PAYMENT_LINK_AMOUNT_TOO_SMALL', message: 'Payment link amount is too small after the gateway fee.' }, 400, requestId);
    } catch {
      return payJson({ code: 'INVALID_PAYMENT_LINK_AMOUNT', message: 'Payment link amount is invalid.' }, 400, requestId);
    }

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


const MUTATION_ASSETS = new Set(['SOL', 'USDC', 'USDT']);
const MUTATION_PAYERS = new Set(['merchant', 'customer']);
const MUTATION_LOCALES = new Set(['fa-IR', 'en-US', 'ar', 'ru', 'auto']);

function readLinkMutationQuery(request: Request): { merchantId: string; linkId: string } {
  const params = new URL(request.url).searchParams;
  return { merchantId: (params.get('merchantId') || '').trim(), linkId: (params.get('linkId') || '').trim() };
}

function validUuidValue(value: string): boolean { return UUID.test(value); }

async function readPaymentLinkForMutation(env: PayEnv, identity: Awaited<ReturnType<typeof resolvePayIdentity>>, merchantId: string, linkId: string): Promise<Record<string, unknown> | null> {
  const response = await supabaseRequestAsIdentity(
    env,
    identity.accessToken,
    '/rest/v1/pay_payment_links?select=' + SELECT +
      '&id=eq.' + encodeURIComponent(linkId) +
      '&merchant_id=eq.' + encodeURIComponent(merchantId) +
      '&limit=1',
  );
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows[0] || null;
}

function parseMutationInput(body: Record<string, unknown>) {
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = body.description === null ? null : typeof body.description === 'string' ? body.description.trim() : '';
  const fixedAmountAtomic = typeof body.fixedAmountAtomic === 'string' ? body.fixedAmountAtomic.trim() : '';
  const asset = body.asset;
  const feePayer = body.feePayer;
  const checkoutLocale = body.checkoutLocale;
  const isActive = body.isActive;
  let expiresAt: string | null = null;
  if (body.expiresAt !== null && body.expiresAt !== undefined && body.expiresAt !== '') {
    if (typeof body.expiresAt !== 'string' || Number.isNaN(Date.parse(body.expiresAt))) throw new PayRuntimeError('INVALID_PAYMENT_LINK_EXPIRY', 400, 'Payment link expiry is invalid.');
    expiresAt = new Date(body.expiresAt).toISOString();
  }
  if (!validUuidValue(String(body.merchantId || '').trim())) throw new PayRuntimeError('MERCHANT_ID_INVALID', 400, 'Merchant ID is invalid.');
  if (!validUuidValue(String(body.linkId || '').trim())) throw new PayRuntimeError('PAYMENT_LINK_ID_INVALID', 400, 'Payment link ID is invalid.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 120) throw new PayRuntimeError('INVALID_PAYMENT_LINK_INPUT', 400, 'Payment link slug is invalid.');
  if (!title || title.length > 200) throw new PayRuntimeError('INVALID_PAYMENT_LINK_INPUT', 400, 'Payment link title is invalid.');
  if (description !== null && description.length > 5000) throw new PayRuntimeError('INVALID_PAYMENT_LINK_INPUT', 400, 'Payment link description is invalid.');
  if (!/^\d{1,78}$/.test(fixedAmountAtomic) || BigInt(fixedAmountAtomic) <= 0n) throw new PayRuntimeError('INVALID_PAYMENT_LINK_AMOUNT', 400, 'Payment link amount must be a positive atomic integer string.');
  if (typeof asset !== 'string' || !MUTATION_ASSETS.has(asset)) throw new PayRuntimeError('INVALID_PAYMENT_LINK_INPUT', 400, 'Payment link asset is invalid.');
  if (typeof feePayer !== 'string' || !MUTATION_PAYERS.has(feePayer)) throw new PayRuntimeError('INVALID_PAYMENT_LINK_INPUT', 400, 'Payment link fee payer is invalid.');
  if (typeof checkoutLocale !== 'string' || !MUTATION_LOCALES.has(checkoutLocale)) throw new PayRuntimeError('INVALID_PAYMENT_LINK_INPUT', 400, 'Payment link locale is invalid.');
  if (typeof isActive !== 'boolean') throw new PayRuntimeError('INVALID_PAYMENT_LINK_INPUT', 400, 'Payment link active state is invalid.');
  if (isActive && expiresAt && Date.parse(expiresAt) <= Date.now()) throw new PayRuntimeError('INVALID_PAYMENT_LINK_EXPIRY', 400, 'An active payment link cannot already be expired.');
  return { slug, title, description, fixedAmountAtomic, asset, feePayer, checkoutLocale, isActive, expiresAt };
}

export const onRequestPatch = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!env.PAY_APP_ORIGIN?.trim() || request.headers.get('Origin') !== env.PAY_APP_ORIGIN.trim()) {
      return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    }
    const identity = await resolvePayIdentity(request, env);
    const { merchantId, linkId } = readLinkMutationQuery(request);
    if (!validUuidValue(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    if (!validUuidValue(linkId)) return payJson({ code: 'PAYMENT_LINK_ID_INVALID', message: 'Payment link ID is invalid.' }, 400, requestId);
    const currentLink = await readPaymentLinkForMutation(env, identity, merchantId, linkId);
    if (!currentLink) return payJson({ code: 'PAYMENT_LINK_NOT_FOUND', message: 'Payment link was not found.' }, 404, requestId);

    const body = await readJsonBody(request);
    const input = parseMutationInput({ ...body, merchantId, linkId });
    try {
      const snapshot = calculateSnapshot(input.fixedAmountAtomic, input.feePayer as 'merchant' | 'customer', 100);
      if (BigInt(snapshot.merchantNetAtomic) <= 0n) return payJson({ code: 'PAYMENT_LINK_AMOUNT_TOO_SMALL', message: 'Payment link amount is too small after the gateway fee.' }, 400, requestId);
    } catch {
      return payJson({ code: 'INVALID_PAYMENT_LINK_AMOUNT', message: 'Payment link amount is invalid.' }, 400, requestId);
    }
    resolveAssetFromEnvironment(input.asset as 'SOL' | 'USDC' | 'USDT', env as Record<string, string | undefined>);

    const idempotencyKey = await assertIdempotencyKey(request);
    const subjectHash = await hashCanonicalRequest({ userId: identity.user.applicationUserId });
    await enforcePayRateLimit(env, 'payment-links:update:user', subjectHash, 60, 30);
    const requestHash = await hashCanonicalRequest({ paymentLinkId: linkId, merchantId, ...input });

    const rpcResponse = await supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/rpc/pay_update_payment_link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        p_payment_link_id: linkId, p_merchant_id: merchantId, p_slug: input.slug, p_title: input.title,
        p_description: input.description, p_fixed_amount_atomic: input.fixedAmountAtomic, p_asset: input.asset,
        p_fee_payer: input.feePayer, p_checkout_locale: input.checkoutLocale, p_is_active: input.isActive,
        p_expires_at: input.expiresAt, p_idempotency_key: idempotencyKey, p_request_hash: requestHash,
      }),
    });
    const result = await rpcResponse.json() as { state?: string; response_status?: number; response_body?: unknown };
    if (result.state === 'updated' || result.state === 'replay') return payJson(result.response_body || {}, result.state === 'updated' ? 200 : 200, requestId);
    if (result.state === 'in_progress') return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical payment link update is already being processed.' }, 409, requestId);
    if (result.state === 'conflict') return payJson({ code: 'IDEMPOTENCY_CONFLICT', message: 'The Idempotency-Key was reused with different payment link data.' }, 409, requestId);
    if (result.state === 'slug_exists') return payJson({ code: 'PAYMENT_LINK_SLUG_EXISTS', message: 'That payment link slug is already in use.' }, 409, requestId);
    if (result.state === 'forbidden') return payJson({ code: 'FORBIDDEN', message: 'You cannot manage payment links for this merchant.' }, 403, requestId);
    if (result.state === 'merchant_not_active') return payJson({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not active.' }, 403, requestId);
    if (result.state === 'not_found') return payJson({ code: 'PAYMENT_LINK_NOT_FOUND', message: 'Payment link was not found.' }, 404, requestId);
    if (result.state === 'unauthorized') return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    if (result.state === 'invalid') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link data is invalid.' }, 400, requestId);
    throw new PayRuntimeError('PAYMENT_LINK_UPDATE_FAILED', 503, 'Payment link could not be updated safely.');
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:payment-link-update', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_LINK_UPDATE_FAILED', message: 'Payment link could not be updated safely.' }, 503, requestId);
  }
};

export const onRequestDelete = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!env.PAY_APP_ORIGIN?.trim() || request.headers.get('Origin') !== env.PAY_APP_ORIGIN.trim()) {
      return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    }
    const identity = await resolvePayIdentity(request, env);
    const { merchantId, linkId } = readLinkMutationQuery(request);
    if (!validUuidValue(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    if (!validUuidValue(linkId)) return payJson({ code: 'PAYMENT_LINK_ID_INVALID', message: 'Payment link ID is invalid.' }, 400, requestId);
    const currentLink = await readPaymentLinkForMutation(env, identity, merchantId, linkId);
    if (!currentLink) return payJson({ code: 'PAYMENT_LINK_NOT_FOUND', message: 'Payment link was not found.' }, 404, requestId);

    const idempotencyKey = await assertIdempotencyKey(request);
    const subjectHash = await hashCanonicalRequest({ userId: identity.user.applicationUserId });
    await enforcePayRateLimit(env, 'payment-links:delete:user', subjectHash, 30, 60);
    const requestHash = await hashCanonicalRequest({ paymentLinkId: linkId, merchantId, operation: 'delete' });

    const rpcResponse = await supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/rpc/pay_delete_payment_link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_payment_link_id: linkId, p_merchant_id: merchantId, p_idempotency_key: idempotencyKey, p_request_hash: requestHash }),
    });
    const result = await rpcResponse.json() as { state?: string; response_status?: number; response_body?: unknown };
    if (result.state === 'deleted' || result.state === 'replay') return payJson(result.response_body || {}, 200, requestId);
    if (result.state === 'in_progress') return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical payment link deletion is already being processed.' }, 409, requestId);
    if (result.state === 'conflict') return payJson({ code: 'IDEMPOTENCY_CONFLICT', message: 'The Idempotency-Key was reused with different deletion data.' }, 409, requestId);
    if (result.state === 'has_payments') return payJson({ code: 'PAYMENT_LINK_HAS_PAYMENTS', message: 'This payment link has payment history and cannot be deleted. Deactivate it instead.' }, 409, requestId);
    if (result.state === 'forbidden') return payJson({ code: 'FORBIDDEN', message: 'You cannot manage payment links for this merchant.' }, 403, requestId);
    if (result.state === 'merchant_not_active') return payJson({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not active.' }, 403, requestId);
    if (result.state === 'not_found') return payJson({ code: 'PAYMENT_LINK_NOT_FOUND', message: 'Payment link was not found.' }, 404, requestId);
    if (result.state === 'unauthorized') return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    if (result.state === 'invalid') return payJson({ code: 'INVALID_PAYMENT_LINK_INPUT', message: 'Payment link deletion request is invalid.' }, 400, requestId);
    throw new PayRuntimeError('PAYMENT_LINK_DELETE_FAILED', 503, 'Payment link could not be deleted safely.');
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:payment-link-delete', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_LINK_DELETE_FAILED', message: 'Payment link could not be deleted safely.' }, 503, requestId);
  }
};
