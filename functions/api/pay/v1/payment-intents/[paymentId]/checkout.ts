import {
  PayRuntimeError,
  enforcePayRateLimit,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  supabaseRequest,
} from '../../../_shared/runtime';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
}

function validPaymentId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function hashSubject(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const onRequestGet = async ({ env, params }: { request: Request; env: PayEnv; params: { paymentId: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const paymentId = String(params.paymentId || '');
    if (!validPaymentId(paymentId)) return payJson({ code: 'INVALID_PAYMENT_ID', message: 'Payment id is invalid.' }, 400, requestId);

    await enforcePayRateLimit(env, 'checkout:read:payment', await hashSubject(paymentId), 60, 120);

    const response = await supabaseRequest(
      env,
      `/rest/v1/pay_payment_intents?select=id,status,amount_atomic,asset,token_mint,token_program,token_decimals,recipient,reference,fee_payer,fee_atomic,customer_total_atomic,expires_at,network,created_at&id=eq.${encodeURIComponent(paymentId)}&limit=1`,
      { headers: { Accept: 'application/json' } },
    );
    const rows = await response.json() as Array<{
      id: string;
      status: string;
      amount_atomic: string;
      asset: string;
      token_mint: string | null;
      token_program: string | null;
      token_decimals: number | null;
      recipient: string;
      reference: string;
      fee_payer: string;
      fee_atomic: string;
      customer_total_atomic: string;
      expires_at: string;
      network: string;
      created_at: string;
    }>;
    const payment = rows[0];
    if (!payment) return payJson({ code: 'PAYMENT_NOT_FOUND', message: 'Payment intent was not found.' }, 404, requestId);

    return payJson({
      data: {
        id: payment.id,
        status: payment.status,
        amountAtomic: payment.amount_atomic,
        asset: payment.asset,
        tokenMint: payment.token_mint,
        tokenProgram: payment.token_program,
        tokenDecimals: payment.token_decimals,
        recipient: payment.recipient,
        reference: payment.reference,
        feePayer: payment.fee_payer,
        gatewayFeeAtomic: payment.fee_atomic,
        customerTotalAtomic: payment.customer_total_atomic,
        expiresAt: payment.expires_at,
        network: payment.network,
        createdAt: payment.created_at,
      },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:checkout-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, requestId);
  }
};
