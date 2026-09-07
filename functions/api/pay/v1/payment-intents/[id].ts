import { error, handleOptions, json, supabaseSecret } from '../../../v1/_shared';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type PaymentIntentRow = {
  id: string;
  merchant_id: string;
  amount_atomic: string | number;
  asset: string;
  token_mint: string | null;
  token_program: string | null;
  token_decimals: number | null;
  recipient: string;
  reference: string;
  fee_bps: number;
  fee_payer: string;
  fee_atomic: string | number;
  gas_sponsored: boolean;
  status: string;
  expires_at: string;
  customer_total_atomic: string | number;
  network: string;
  verification_commitment: string;
};

type MerchantRow = { id: string; business_name: string; status: string };

const PUBLIC_STATUS = new Set([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'completed',
  'expired', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient',
  'duplicate', 'ambiguous', 'failed', 'refunded'
]);

const PAYMENT_INTENT_SELECT = [
  'id', 'merchant_id', 'amount_atomic', 'asset', 'token_mint', 'token_program',
  'token_decimals', 'recipient', 'reference', 'fee_bps', 'fee_payer', 'fee_atomic',
  'gas_sponsored', 'status', 'expires_at', 'customer_total_atomic', 'network',
  'verification_commitment'
].join(',');

async function supabaseGet<T>(base: string, headers: Record<string, string>, query: string): Promise<T[]> {
  const response = await fetch(`${base}/rest/v1/${query}`, { method: 'GET', headers: { ...headers, 'Cache-Control': 'no-store' } });
  if (!response.ok) throw new Error(`Supabase request failed with ${response.status}`);
  return await response.json() as T[];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function atomic(value: string | number): string { return String(value); }

export const onRequestOptions = async ({ request }: { request: Request }) => handleOptions(request) || new Response(null, { status: 204 });

export const onRequestGet = async ({ request, env, params }: { request: Request; env: Env; params: { id?: string } }) => {
  const options = handleOptions(request);
  if (options) return options;

  const id = String(params?.id || '').trim();
  if (!isUuid(id)) return error(request, 'PAYMENT_INTENT_ID_INVALID', 'Payment Intent ID is invalid.', 400);

  let supabase;
  try { supabase = supabaseSecret(env); } catch { return error(request, 'PAYMENT_SERVICE_MISCONFIGURED', 'Payment service is not configured.', 503); }

  try {
    const paymentRows = await supabaseGet<PaymentIntentRow>(supabase.base, supabase.headers, `pay_payment_intents?select=${PAYMENT_INTENT_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`);
    const payment = paymentRows[0];
    if (!payment) return error(request, 'PAYMENT_INTENT_NOT_FOUND', 'Payment Intent was not found.', 404);
    if (!PUBLIC_STATUS.has(payment.status)) return error(request, 'PAYMENT_INTENT_STATE_INVALID', 'Payment Intent state is invalid.', 500);

    const merchantRows = await supabaseGet<MerchantRow>(supabase.base, supabase.headers, `pay_merchants?select=id,business_name,status&id=eq.${encodeURIComponent(payment.merchant_id)}&limit=1`);
    const merchant = merchantRows[0];
    if (!merchant || merchant.status !== 'active') return error(request, 'MERCHANT_UNAVAILABLE', 'Merchant is not available for checkout.', 404);

    return json(request, {
      success: true,
      apiVersion: 'v1',
      data: {
        id: payment.id,
        merchant: { id: merchant.id, businessName: merchant.business_name },
        amountAtomic: atomic(payment.amount_atomic),
        asset: payment.asset,
        tokenMint: payment.token_mint,
        tokenProgram: payment.token_program,
        tokenDecimals: payment.token_decimals,
        recipient: payment.recipient,
        reference: payment.reference,
        feeBps: payment.fee_bps,
        feePayer: payment.fee_payer,
        feeAtomic: atomic(payment.fee_atomic),
        gasSponsored: payment.gas_sponsored,
        status: payment.status,
        expiresAt: payment.expires_at,
        customerTotalAtomic: atomic(payment.customer_total_atomic),
        network: payment.network,
        verificationCommitment: payment.verification_commitment
      }
    }, 200, 'no-store');
  } catch (cause) {
    console.error('Pay Payment Intent GET failed:', cause instanceof Error ? cause.message : 'unknown error');
    return error(request, 'PAYMENT_INTENT_READ_FAILED', 'Payment Intent could not be retrieved.', 502);
  }
};
