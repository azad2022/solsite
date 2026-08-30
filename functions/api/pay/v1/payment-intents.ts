import {
  assertSafeMetadata,
  assertIdempotencyKey,
  authenticateMerchantApi,
  calculateSnapshot,
  hashCanonicalRequest,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  readJsonBody,
} from '../_shared/runtime';
import { reserveIdempotencyAtomically, failIdempotency } from '../_shared/idempotency';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_FEE_RECIPIENT?: string;
  PAY_USDC_MINT?: string;
  PAY_USDT_MINT?: string;
  PAY_DEFAULT_EXPIRY_SECONDS?: string;
}

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_EXPIRY_SECONDS = 15 * 60;
const MAX_EXPIRY_SECONDS = 24 * 60 * 60;
const SCOPE = 'payment-intents:create';

type Asset = 'SOL' | 'USDC' | 'USDT';
type FeePayer = 'merchant' | 'customer';

function getSecret(env: PayEnv): string {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
}

async function dbRequest(env: PayEnv, path: string, init: RequestInit = {}): Promise<Response> {
  const secret = getSecret(env);
  if (!secret) throw new Error('Pay backend is not configured.');
  const headers = new Headers(init.headers);
  headers.set('apikey', secret);
  if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY) headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  return fetch(`${(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '')}${path}`, { ...init, headers });
}

function parsePositiveAtomic(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{1,78}$/.test(value)) throw new Error(`${field} must be a positive integer string in atomic units.`);
  if (BigInt(value) <= 0n) throw new Error(`${field} must be greater than zero.`);
  return value;
}

function parseAsset(value: unknown): Asset {
  if (value !== 'SOL' && value !== 'USDC' && value !== 'USDT') throw new Error('asset must be SOL, USDC, or USDT.');
  return value;
}

function parseFeePayer(value: unknown): FeePayer {
  if (value !== 'merchant' && value !== 'customer') throw new Error('feePayer must be merchant or customer.');
  return value;
}

function resolveTokenMint(env: PayEnv, asset: Asset, requested: unknown): string | null {
  if (asset === 'SOL') {
    if (requested != null) throw new Error('SOL payments must not specify tokenMint.');
    return null;
  }
  const expected = asset === 'USDC' ? env.PAY_USDC_MINT : env.PAY_USDT_MINT;
  if (!expected) throw new Error(`${asset} is not configured for Pay.`);
  if (requested !== undefined && requested !== expected) throw new Error(`tokenMint does not match the configured ${asset} mint.`);
  return expected;
}

function parseExpiry(env: PayEnv, value: unknown): string {
  const raw = value === undefined ? Number(env.PAY_DEFAULT_EXPIRY_SECONDS || DEFAULT_EXPIRY_SECONDS) : Number(value);
  if (!Number.isInteger(raw) || raw < 60 || raw > MAX_EXPIRY_SECONDS) throw new Error('expiresInSeconds must be an integer between 60 and 86400.');
  return new Date(Date.now() + raw * 1000).toISOString();
}

export const onRequestPost = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();

  if (!payFeatureEnabled(env)) {
    return payJson({ success: false, code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  }

  let idempotencyKey = '';
  try {
    const principal = await authenticateMerchantApi(env, request, 'payment.create');
    idempotencyKey = await assertIdempotencyKey(request);
    const body = await readJsonBody(request);
    const requestHash = await hashCanonicalRequest(body);

    const reservation = await reserveIdempotencyAtomically(env, principal.merchantId, SCOPE, idempotencyKey, requestHash);
    if (reservation.state === 'conflict') {
      return payJson({ code: 'IDEMPOTENCY_CONFLICT', message: 'The Idempotency-Key was reused with different request data.' }, 409, requestId);
    }
    if (reservation.state === 'in_progress') {
      return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical request is already being processed.' }, 409, requestId);
    }
    if (reservation.state === 'replay') {
      return payJson(reservation.responseBody, reservation.responseStatus || 200, requestId);
    }

    try {
      const amountAtomic = parsePositiveAtomic(body.amountAtomic, 'amountAtomic');
      const asset = parseAsset(body.asset);
      const feePayer = parseFeePayer(body.feePayer ?? 'merchant');
      const tokenMint = resolveTokenMint(env, asset, body.tokenMint);
      const expiration = parseExpiry(env, body.expiresInSeconds);
      const metadata = assertSafeMetadata(body.metadata);
      const externalOrderId = body.externalOrderId == null ? null : String(body.externalOrderId);
      if (externalOrderId && externalOrderId.length > 255) throw new Error('externalOrderId is too long.');
      if (!env.PAY_FEE_RECIPIENT) throw new Error('Pay fee recipient is not configured.');

      const merchantResponse = await dbRequest(env, `/rest/v1/pay_merchants?select=id,status& id=eq.${encodeURIComponent(principal.merchantId)}&limit=1`.replace('status& id', 'status&id'));
      if (!merchantResponse.ok) throw new Error('Merchant lookup failed.');
      const merchants = await merchantResponse.json() as Array<{ id: string; status: string }>;
      const merchant = merchants[0];
      if (!merchant || merchant.status !== 'active') throw new Error('Merchant is not active.');

      const walletResponse = await dbRequest(env, `/rest/v1/pay_merchant_wallets?select=id,address&merchant_id=eq.${encodeURIComponent(principal.merchantId)}&wallet_role=eq.receiving&is_active=eq.true&verification_status=eq.verified&limit=2`);
      if (!walletResponse.ok) throw new Error('Merchant wallet lookup failed.');
      const wallets = await walletResponse.json() as Array<{ id: string; address: string }>;
      if (wallets.length !== 1) throw new Error('Merchant must have exactly one active verified receiving wallet.');
      const recipient = wallets[0].address;

      const calculated = calculateSnapshot(amountAtomic, feePayer, 100);
      if (BigInt(calculated.merchantNetAtomic) <= 0n) throw new Error('Payment amount is too small after gateway fee.');

      const reference = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
      const insertBody = {
        merchant_id: principal.merchantId,
        external_order_id: externalOrderId,
        amount_atomic: amountAtomic,
        asset,
        token_mint: tokenMint,
        recipient,
        reference,
        fee_bps: 100,
        fee_payer: feePayer,
        fee_atomic: calculated.gatewayFeeAtomic,
        customer_total_atomic: calculated.customerTotalAtomic,
        merchant_net_atomic: calculated.merchantNetAtomic,
        fee_recipient: env.PAY_FEE_RECIPIENT,
        network: 'solana',
        gas_sponsored: false,
        status: 'created',
        expires_at: expiration,
        metadata,
      };

      const createdResponse = await dbRequest(env, '/rest/v1/pay_payment_intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(insertBody),
      });
      if (!createdResponse.ok) {
        const errorText = (await createdResponse.text()).slice(0, 500);
        console.error(JSON.stringify({ scope: 'pay:payment-intent', requestId, status: createdResponse.status, error: errorText }));
        throw new Error('Payment intent could not be created.');
      }
      const created = (await createdResponse.json()) as Array<{ id: string; reference: string; status: string; expires_at: string }>;
      const payment = created[0];
      if (!payment) throw new Error('Payment intent creation returned no resource.');

      const data = {
        id: payment.id,
        status: payment.status,
        amountAtomic,
        asset,
        feePayer,
        gatewayFeeAtomic: calculated.gatewayFeeAtomic,
        customerTotalAtomic: calculated.customerTotalAtomic,
        merchantNetAtomic: calculated.merchantNetAtomic,
        reference: payment.reference,
        checkoutUrl: `https://solmint.ir/pay/checkout/${payment.id}`,
        expiresAt: payment.expires_at,
      };
      const responseBody = { data };
      // The idempotency record is completed only after the financial resource is
      // durably created. A failed completion leaves the request replay-safe via
      // the payment's external order/reference constraints and must be alerted.
      await completeIdempotencySafe(env, principal.merchantId, SCOPE, idempotencyKey, 201, responseBody, payment.id);
      return payJson(responseBody, 201, requestId);
    } catch (error) {
      await failIdempotency(env, principal.merchantId, SCOPE, idempotencyKey).catch(() => {});
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create payment intent.';
    const known = /Idempotency|idempotency|must be|not configured|not active|too small|already being processed/.test(message);
    const status = known && /already being processed/i.test(message) ? 409 : 400;
    console.error(JSON.stringify({ scope: 'pay:payment-intent', requestId, error: message.slice(0, 300) }));
    return payJson({ code: status === 409 ? 'REQUEST_IN_PROGRESS' : 'INVALID_REQUEST', message: status === 409 ? message : 'Payment intent request is invalid.' }, status, requestId);
  }
};

async function completeIdempotencySafe(
  env: PayEnv,
  merchantId: string,
  scope: string,
  key: string,
  status: number,
  body: unknown,
  resourceId: string,
) {
  const secret = getSecret(env);
  if (!secret) throw new Error('Pay backend is not configured.');
  const headers = new Headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal', apikey: secret });
  if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY) headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const response = await fetch(`${(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '')}/rest/v1/pay_idempotency_keys?merchant_id=eq.${encodeURIComponent(merchantId)}&scope=eq.${encodeURIComponent(scope)}&idempotency_key=eq.${encodeURIComponent(key)}`, {
    method: 'PATCH', headers, body: JSON.stringify({ status: 'completed', response_status: status, response_body: body, resource_type: 'payment_intent', resource_id: resourceId, completed_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error('Idempotency completion failed.');
}
