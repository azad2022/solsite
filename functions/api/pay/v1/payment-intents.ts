import {
  PayRuntimeError,
  assertSafeMetadata,
  assertIdempotencyKey,
  authenticateMerchantApi,
  calculateSnapshot,
  enforcePayRateLimit,
  hashCanonicalRequest,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  readJsonBody,
} from '../_shared/runtime';
import { validateExternalOrderId } from '../../../../src/pay/services/securityPolicy';
import { randomReferenceAddress } from '../../../../src/pay/services/walletSignature';
import { decodeBase58 } from '../../../../src/pay/services/base58';
import { resolveAssetFromEnvironment } from '../../../../src/pay/services/assetPolicy';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
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
const SCOPE = 'payment-intents:create';
type Asset = 'SOL' | 'USDC' | 'USDT';
type FeePayer = 'merchant' | 'customer';

function getSecret(env: PayEnv): string { return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ''; }
async function dbRequest(env: PayEnv, path: string, init: RequestInit = {}): Promise<Response> {
  const secret = getSecret(env);
  if (!secret) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay backend is not configured.');
  const headers = new Headers(init.headers);
  headers.set('apikey', secret);
  if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY) headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  return fetch(`${(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '')}${path}`, { ...init, headers });
}
function parsePositiveAtomic(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{1,78}$/.test(value) || BigInt(value) <= 0n) throw new PayRuntimeError('INVALID_AMOUNT', 400, `${field} must be a positive integer string in atomic units.`);
  return value;
}
function parseAsset(value: unknown): Asset {
  if (value !== 'SOL' && value !== 'USDC' && value !== 'USDT') throw new PayRuntimeError('INVALID_ASSET', 400, 'asset must be SOL, USDC, or USDT.');
  return value;
}
function parseFeePayer(value: unknown): FeePayer {
  if (value !== 'merchant' && value !== 'customer') throw new PayRuntimeError('INVALID_FEE_PAYER', 400, 'feePayer must be merchant or customer.');
  return value;
}
function parseExpiry(env: PayEnv, value: unknown): string {
  const raw = value === undefined ? Number(env.PAY_DEFAULT_EXPIRY_SECONDS || DEFAULT_EXPIRY_SECONDS) : Number(value);
  if (!Number.isInteger(raw) || raw < 60 || raw > MAX_EXPIRY_SECONDS) throw new PayRuntimeError('INVALID_EXPIRY', 400, 'expiresInSeconds must be an integer between 60 and 86400.');
  return new Date(Date.now() + raw * 1000).toISOString();
}
function assertSolanaPublicKey(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, `${field} is not configured safely.`);
  try {
    if (decodeBase58(value).length !== 32) throw new Error('invalid key length');
  } catch {
    throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, `${field} is not a valid Solana public key.`);
  }
  return value;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const principal = await authenticateMerchantApi(env, request, 'payment.create');
    const keySubjectBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(principal.keyId));
    const merchantSubjectBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(principal.merchantId));
    const keySubject = Array.from(new Uint8Array(keySubjectBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const merchantSubject = Array.from(new Uint8Array(merchantSubjectBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    await enforcePayRateLimit(env, 'payment-intents:create:key', keySubject, 60, 60);
    await enforcePayRateLimit(env, 'payment-intents:create:merchant', merchantSubject, 60, 300);

    const idempotencyKey = await assertIdempotencyKey(request);
    const body = await readJsonBody(request);
    const requestHash = await hashCanonicalRequest(body);
    const amountAtomic = parsePositiveAtomic(body.amountAtomic, 'amountAtomic');
    const asset = parseAsset(body.asset);
    const feePayer = parseFeePayer(body.feePayer ?? 'merchant');
    const assetConfig = resolveAssetFromEnvironment(asset, env as Record<string, string | undefined>);
    const expiresAt = parseExpiry(env, body.expiresInSeconds);
    const metadata = assertSafeMetadata(body.metadata);
    const externalOrderId = body.externalOrderId == null ? null : body.externalOrderId;
    if (!validateExternalOrderId(externalOrderId as string | null | undefined)) throw new PayRuntimeError('INVALID_EXTERNAL_ORDER_ID', 400, 'externalOrderId must be a non-empty safe string up to 255 characters.');
    if (externalOrderId !== null && typeof externalOrderId !== 'string') throw new PayRuntimeError('INVALID_EXTERNAL_ORDER_ID', 400, 'externalOrderId must be a string.');
    const feeRecipient = assertSolanaPublicKey(env.PAY_FEE_RECIPIENT, 'PAY_FEE_RECIPIENT');
    if (assetConfig.tokenMint && assetConfig.tokenProgram !== 'spl-token') throw new PayRuntimeError('ASSET_NOT_SUPPORTED', 503, 'Configured token program is not supported for this release.');

    const merchantResponse = await dbRequest(env, `/rest/v1/pay_merchants?select=id,status&id=eq.${encodeURIComponent(principal.merchantId)}&limit=1`);
    if (!merchantResponse.ok) throw new PayRuntimeError('MERCHANT_LOOKUP_FAILED', 503, 'Unable to load merchant configuration.');
    const merchants = await merchantResponse.json() as Array<{ id: string; status: string }>;
    if (merchants[0]?.status !== 'active') throw new PayRuntimeError('MERCHANT_NOT_ACTIVE', 403, 'Merchant is not active.');

    const walletResponse = await dbRequest(env, `/rest/v1/pay_merchant_wallets?select=id,address&merchant_id=eq.${encodeURIComponent(principal.merchantId)}&wallet_role=eq.receiving&is_active=eq.true&verification_status=eq.verified&limit=2`);
    if (!walletResponse.ok) throw new PayRuntimeError('WALLET_LOOKUP_FAILED', 503, 'Unable to load merchant receiving wallet.');
    const wallets = await walletResponse.json() as Array<{ id: string; address: string }>;
    if (wallets.length !== 1) throw new PayRuntimeError('MERCHANT_WALLET_NOT_READY', 409, 'Merchant must have exactly one active verified receiving wallet.');
    const recipient = wallets[0].address;

    const calculated = calculateSnapshot(amountAtomic, feePayer, 100);
    if (BigInt(calculated.merchantNetAtomic) <= 0n) throw new PayRuntimeError('AMOUNT_TOO_SMALL', 400, 'Payment amount is too small after gateway fee.');

    const reference = randomReferenceAddress();
    const rpcResponse = await dbRequest(env, '/rest/v1/rpc/pay_create_payment_intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        p_merchant_id: principal.merchantId,
        p_external_order_id: externalOrderId,
        p_amount_atomic: amountAtomic,
        p_asset: asset,
        p_token_mint: assetConfig.tokenMint,
        p_token_program: assetConfig.tokenProgram,
        p_token_decimals: assetConfig.decimals,
        p_recipient: recipient,
        p_reference: reference,
        p_fee_bps: 100,
        p_fee_payer: feePayer,
        p_fee_atomic: calculated.gatewayFeeAtomic,
        p_customer_total_atomic: calculated.customerTotalAtomic,
        p_merchant_net_atomic: calculated.merchantNetAtomic,
        p_fee_recipient: feeRecipient,
        p_network: 'solana',
        p_expires_at: expiresAt,
        p_metadata: metadata,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
        p_scope: SCOPE,
      }),
    });

    if (!rpcResponse.ok) {
      const text = (await rpcResponse.text()).slice(0, 500);
      console.error(JSON.stringify({ scope: 'pay:payment-intent-rpc', requestId, status: rpcResponse.status, error: text }));
      if (rpcResponse.status === 409) return payJson({ code: 'PAYMENT_CONFLICT', message: 'Payment intent conflicts with an existing merchant order.' }, 409, requestId);
      throw new PayRuntimeError('PAYMENT_CREATION_FAILED', 503, 'Payment intent could not be created safely.');
    }

    const result = await rpcResponse.json() as { state: 'created' | 'replay' | 'conflict' | 'in_progress'; response_status?: number; response_body?: unknown };
    if (result.state === 'conflict') return payJson({ code: 'IDEMPOTENCY_CONFLICT', message: 'The Idempotency-Key was reused with different request data.' }, 409, requestId);
    if (result.state === 'in_progress') return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical request is already being processed.' }, 409, requestId);
    if (result.state === 'replay' || result.state === 'created') return payJson(result.response_body || {}, result.response_status || 201, requestId);
    throw new PayRuntimeError('PAYMENT_CREATION_FAILED', 503, 'Payment intent creation returned an invalid state.');
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      console.error(JSON.stringify({ scope: 'pay:payment-intent', requestId, code: error.code, status: error.status }));
      return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    }
    console.error(JSON.stringify({ scope: 'pay:payment-intent', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, requestId);
  }
};