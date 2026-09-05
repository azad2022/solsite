import {
  PayRuntimeError,
  authenticateMerchantApi,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  supabaseRequest,
} from '../../_shared/runtime';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
}

function validPaymentId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const onRequestGet = async ({ request, env, params }: { request: Request; env: PayEnv; params: { paymentId: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const paymentId = String(params.paymentId || '');
    if (!validPaymentId(paymentId)) return payJson({ code: 'INVALID_PAYMENT_ID', message: 'Payment id is invalid.' }, 400, requestId);

    const principal = await authenticateMerchantApi(env, request, 'payment.read');
    const response = await supabaseRequest(
      env,
      `/rest/v1/pay_payment_intents?select=id,merchant_id,status,amount_atomic,asset,token_mint,token_program,token_decimals,recipient,reference,fee_bps,fee_payer,fee_atomic,customer_total_atomic,merchant_net_atomic,fee_recipient,network,gas_sponsored,expires_at,created_at,updated_at&id=eq.${encodeURIComponent(paymentId)}&merchant_id=eq.${encodeURIComponent(principal.merchantId)}&limit=1`,
      { headers: { Accept: 'application/json' } },
    );
    const rows = await response.json() as Array<{
      id: string;
      merchant_id: string;
      status: string;
      amount_atomic: string;
      asset: string;
      token_mint: string | null;
      token_program: string | null;
      token_decimals: number | null;
      recipient: string;
      reference: string;
      fee_bps: number;
      fee_payer: string;
      fee_atomic: string;
      customer_total_atomic: string;
      merchant_net_atomic: string;
      fee_recipient: string;
      network: string;
      gas_sponsored: boolean;
      expires_at: string;
      created_at: string;
      updated_at: string;
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
        feeBps: payment.fee_bps,
        feePayer: payment.fee_payer,
        gatewayFeeAtomic: payment.fee_atomic,
        customerTotalAtomic: payment.customer_total_atomic,
        merchantNetAtomic: payment.merchant_net_atomic,
        feeRecipient: payment.fee_recipient,
        network: payment.network,
        gasSponsored: payment.gas_sponsored,
        expiresAt: payment.expires_at,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
        checkoutUrl: `https://solmint.ir/pay/checkout/${payment.id}`,
      },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:payment-intent-get', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, requestId);
  }
};
