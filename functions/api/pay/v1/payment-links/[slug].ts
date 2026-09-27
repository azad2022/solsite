import {
  PayRuntimeError,
  assertIdempotencyKey,
  calculateSnapshot,
  enforcePayRateLimit,
  hashCanonicalRequest,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  supabaseRequest,
} from '../../_shared/runtime';
import { resolveAssetFromEnvironment } from '../../../../../src/pay/services/assetPolicy';
import { randomReferenceAddress } from '../../../../../src/pay/services/walletSignature';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
  PAY_FEE_RECIPIENT?: string;
  PAY_USDC_MINT?: string;
  PAY_USDC_DECIMALS?: string;
  PAY_USDT_MINT?: string;
  PAY_USDT_DECIMALS?: string;
  PAY_DEFAULT_EXPIRY_SECONDS?: string;
}

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_EXPIRY_SECONDS = 15 * 60;
const MAX_EXPIRY_SECONDS = 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validSlug(value: string): boolean { return value.length >= 3 && value.length <= 120 && SLUG.test(value); }

async function hashSubject(value: string): Promise<string> { return hashCanonicalRequest({ value }); }

function nowPlusDefault(env: PayEnv): Date {
  const raw = Number(env.PAY_DEFAULT_EXPIRY_SECONDS || DEFAULT_EXPIRY_SECONDS);
  const seconds = Number.isInteger(raw) && raw >= 60 && raw <= MAX_EXPIRY_SECONDS ? raw : DEFAULT_EXPIRY_SECONDS;
  return new Date(Date.now() + seconds * 1000);
}

function linkIntentExpiry(env: PayEnv, linkExpiresAt: string | null): string {
  const now = Date.now();
  const fallback = nowPlusDefault(env).getTime();
  const selected = linkExpiresAt ? Math.min(fallback, new Date(linkExpiresAt).getTime()) : fallback;
  if (!Number.isFinite(selected) || selected <= now + 60_000) throw new PayRuntimeError('PAYMENT_LINK_EXPIRING', 409, 'This payment link expires too soon to start a payment.');
  return new Date(selected).toISOString();
}

async function readLink(env: PayEnv, slug: string) {
  const response = await supabaseRequest(
    env as never,
    '/rest/v1/pay_payment_links?select=id,merchant_id,slug,title,description,fixed_amount_atomic::text,asset,fee_payer,checkout_locale,is_active,expires_at&slug=eq.' + encodeURIComponent(slug) + '&limit=1',
    { headers: { Accept: 'application/json' } },
  );
  const rows = await response.json() as Array<{
    id: string; merchant_id: string; slug: string; title: string; description: string | null;
    fixed_amount_atomic: string | null; asset: string | null; fee_payer: string | null;
    checkout_locale: string; is_active: boolean; expires_at: string | null;
  }>;
  const link = rows[0];
  if (!link) throw new PayRuntimeError('PAYMENT_LINK_NOT_FOUND', 404, 'Payment link was not found.');
  if (!link.is_active) throw new PayRuntimeError('PAYMENT_LINK_INACTIVE', 404, 'Payment link is not active.');
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) throw new PayRuntimeError('PAYMENT_LINK_EXPIRED', 410, 'Payment link has expired.');
  if (!link.fixed_amount_atomic || !/^\d{1,78}$/.test(link.fixed_amount_atomic) || BigInt(link.fixed_amount_atomic) <= 0n || !link.asset || !link.fee_payer) {
    throw new PayRuntimeError('PAYMENT_LINK_NOT_CONFIGURED', 409, 'Payment link is not configured for checkout.');
  }
  if (!UUID.test(link.id) || !UUID.test(link.merchant_id)) throw new PayRuntimeError('PAYMENT_LINK_INVALID', 503, 'Payment link configuration is invalid.');
  return link;
}

export const onRequestGet = async ({ request, env, params }: { request: Request; env: PayEnv; params: { slug?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    const slug = String(params?.slug || '').trim();
    if (!validSlug(slug)) return payJson({ code: 'PAYMENT_LINK_SLUG_INVALID', message: 'Payment link is invalid.' }, 400, requestId);
    const link = await readLink(env, slug);
    const merchantResponse = await supabaseRequest(env as never, '/rest/v1/pay_merchants?select=id,business_name,status&id=eq.' + encodeURIComponent(link.merchant_id) + '&limit=1', { headers: { Accept: 'application/json' } });
    const merchants = await merchantResponse.json() as Array<{ id: string; business_name: string; status: string }>;
    const merchant = merchants[0];
    if (!merchant || merchant.status !== 'active') return payJson({ code: 'MERCHANT_UNAVAILABLE', message: 'Merchant is not available for checkout.' }, 404, requestId);
    return payJson({
      apiVersion: 'v1',
      data: {
        slug: link.slug, title: link.title, description: link.description, amountAtomic: link.fixed_amount_atomic,
        asset: link.asset, feePayer: link.fee_payer, checkoutLocale: link.checkout_locale, expiresAt: link.expires_at,
        merchant: { businessName: merchant.business_name },
      },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:public-payment-link-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_LINK_READ_FAILED', message: 'Payment link could not be retrieved.' }, 503, requestId);
  }
};

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { slug?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!env.PAY_APP_ORIGIN?.trim() || request.headers.get('Origin') !== env.PAY_APP_ORIGIN.trim()) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const slug = String(params?.slug || '').trim();
    if (!validSlug(slug)) return payJson({ code: 'PAYMENT_LINK_SLUG_INVALID', message: 'Payment link is invalid.' }, 400, requestId);
    const link = await readLink(env, slug);
    const merchantResponse = await supabaseRequest(env as never, '/rest/v1/pay_merchants?select=id,status&id=eq.' + encodeURIComponent(link.merchant_id) + '&limit=1', { headers: { Accept: 'application/json' } });
    const merchants = await merchantResponse.json() as Array<{ id: string; status: string }>;
    if (merchants[0]?.status !== 'active') return payJson({ code: 'MERCHANT_UNAVAILABLE', message: 'Merchant is not available for checkout.' }, 404, requestId);
    const walletResponse = await supabaseRequest(env as never, '/rest/v1/pay_merchant_wallets?select=id,address&merchant_id=eq.' + encodeURIComponent(link.merchant_id) + '&wallet_role=eq.receiving&is_active=eq.true&verification_status=eq.verified&limit=2', { headers: { Accept: 'application/json' } });
    const wallets = await walletResponse.json() as Array<{ id: string; address: string }>;
    if (wallets.length !== 1) return payJson({ code: 'MERCHANT_WALLET_NOT_READY', message: 'Merchant is not ready to receive payments.' }, 409, requestId);
    if (!env.PAY_FEE_RECIPIENT?.trim()) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay fee recipient is not configured.');
    const asset = link.asset;
    if (asset !== 'SOL' && asset !== 'USDC' && asset !== 'USDT') throw new PayRuntimeError('PAYMENT_LINK_ASSET_INVALID', 409, 'Payment link asset is not supported.');
    const feePayer = link.fee_payer;
    if (feePayer !== 'merchant' && feePayer !== 'customer') throw new PayRuntimeError('PAYMENT_LINK_FEE_PAYER_INVALID', 409, 'Payment link fee policy is invalid.');
    const assetConfig = resolveAssetFromEnvironment(asset, env as Record<string, string | undefined>);
    const amountAtomic = link.fixed_amount_atomic!;
    const calculated = calculateSnapshot(amountAtomic, feePayer, 100);
    if (BigInt(calculated.merchantNetAtomic) <= 0n) throw new PayRuntimeError('AMOUNT_TOO_SMALL', 400, 'Payment amount is too small after gateway fee.');
    const idempotencyKey = await assertIdempotencyKey(request);
    const scope = 'payment-intents:link';
    const requestHash = await hashCanonicalRequest({ paymentLinkId: link.id, merchantId: link.merchant_id, amountAtomic, asset, feePayer });
    const subject = await hashSubject(link.id + ':' + (request.headers.get('CF-Connecting-IP') || 'shared'));
    await enforcePayRateLimit(env, 'payment-links:checkout', subject, 60, 60);
    const expiresAt = linkIntentExpiry(env, link.expires_at);
    const reference = randomReferenceAddress();
    const rpcResponse = await supabaseRequest(env as never, '/rest/v1/rpc/pay_create_payment_intent_from_link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        p_payment_link_id: link.id, p_merchant_id: link.merchant_id, p_amount_atomic: amountAtomic, p_asset: asset,
        p_token_mint: assetConfig.tokenMint, p_token_program: assetConfig.tokenProgram, p_token_decimals: assetConfig.decimals,
        p_recipient: wallets[0].address, p_reference: reference, p_fee_bps: 100, p_fee_payer: feePayer,
        p_fee_atomic: calculated.gatewayFeeAtomic, p_customer_total_atomic: calculated.customerTotalAtomic,
        p_merchant_net_atomic: calculated.merchantNetAtomic, p_fee_recipient: env.PAY_FEE_RECIPIENT, p_network: 'solana',
        p_expires_at: expiresAt, p_metadata: { paymentLinkId: link.id, paymentLinkSlug: link.slug },
        p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_scope: scope,
      }),
    });
    const result = await rpcResponse.json() as { state?: string; response_status?: number; response_body?: unknown };
    if (result.state === 'conflict') return payJson({ code: 'IDEMPOTENCY_CONFLICT', message: 'The Idempotency-Key was reused with different request data.' }, 409, requestId);
    if (result.state === 'in_progress') return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical request is already being processed.' }, 409, requestId);
    if (result.state === 'replay') return payJson(result.response_body || {}, 200, requestId);
    if (result.state === 'created') return payJson(result.response_body || {}, result.response_status || 201, requestId);
    throw new PayRuntimeError('PAYMENT_LINK_CHECKOUT_FAILED', 503, 'Payment link checkout could not be created.');
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:public-payment-link-checkout', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_LINK_CHECKOUT_FAILED', message: 'Payment link checkout could not be created.' }, 503, requestId);
  }
};