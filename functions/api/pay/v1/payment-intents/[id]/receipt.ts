import { PayRuntimeError, enforcePayRateLimit, hashCanonicalRequest, makePayRequestId, payFeatureEnabled, payJson, type PayRuntimeEnv } from '../../../_shared/runtime';
import { supabaseSecret } from '../../../v1/_shared';

interface PayEnv extends PayRuntimeEnv {
  PAY_API_ENABLED?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}

async function getJson<T>(env: PayEnv, path: string): Promise<T[]> {
  const config = supabaseSecret(env);
  const response = await fetch(config.base + path, {
    headers: {
      ...config.headers,
      Accept: 'application/json',
      'Cache-Control': 'no-store',
    },
  });
  if (!response.ok) throw new PayRuntimeError('PAY_RECEIPT_DATA_UNAVAILABLE', 503, 'Payment receipt data is temporarily unavailable.');
  return await response.json() as T[];
}

export const onRequestGet = async ({ request, env, params }: { request: Request; env: PayEnv; params: { id?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  const paymentId = String(params?.id || '').trim();
  if (!isUuid(paymentId)) return payJson({ code: 'PAYMENT_INTENT_ID_INVALID', message: 'Payment Intent ID is invalid.' }, 400, requestId);

  try {
    const subject = await hashCanonicalRequest({ paymentId });
    await enforcePayRateLimit(env, 'payment-intents:receipt', subject, 30, 60);

    const payments = await getJson<Record<string, unknown>>(
      env,
      '/rest/v1/pay_payment_intents?select=id,merchant_id,amount_atomic::text,customer_total_atomic::text,merchant_settlement_atomic::text,fee_atomic::text,fee_payer,fee_bps,asset,token_mint,token_program,token_decimals,recipient,fee_recipient,reference,network,status,verification_commitment,created_at,updated_at,payment_link_id,invoice_id,customer_wallet_address&id=eq.' + encodeURIComponent(paymentId) + '&limit=1',
    );
    const payment = payments[0];
    if (!payment) return payJson({ code: 'PAYMENT_INTENT_NOT_FOUND', message: 'Payment Intent was not found.' }, 404, requestId);
    if (payment.status !== 'completed') {
      return payJson({ code: 'PAYMENT_RECEIPT_NOT_READY', message: 'The payment receipt is available after the payment reaches its final completed state.' }, 409, requestId);
    }

    const merchants = await getJson<Record<string, unknown>>(
      env,
      '/rest/v1/pay_merchants?select=id,business_name,status&id=eq.' + encodeURIComponent(String(payment.merchant_id)) + '&limit=1',
    );
    const merchant = merchants[0];
    if (!merchant || merchant.status !== 'active') {
      return payJson({ code: 'MERCHANT_UNAVAILABLE', message: 'Merchant is not available.' }, 404, requestId);
    }

    const transactions = await getJson<Record<string, unknown>>(
      env,
      '/rest/v1/pay_payment_transactions?select=id,signature,slot,block_time,observed_amount_atomic::text,asset,recipient,reference_matched,confirmed,commitment,fee_payer,network_fee_lamports::text,verification_status,verified_at,is_authoritative,token_mint,token_program,token_decimals&payment_id=eq.' + encodeURIComponent(paymentId) + '&is_authoritative=eq.true&verification_status=eq.verified&order=verified_at.desc&limit=1',
    );
    const transaction = transactions[0];
    if (!transaction) {
      return payJson({ code: 'PAYMENT_RECEIPT_NOT_READY', message: 'The payment receipt is not ready yet.' }, 409, requestId);
    }

    let paymentLink: Record<string, unknown> | null = null;
    if (typeof payment.payment_link_id === 'string' && payment.payment_link_id) {
      const links = await getJson<Record<string, unknown>>(
        env,
        '/rest/v1/pay_payment_links?select=id,slug,title,description,checkout_locale&id=eq.' + encodeURIComponent(payment.payment_link_id) + '&limit=1',
      );
      paymentLink = links[0] || null;
    }

    const transfers = await getJson<Record<string, unknown>>(
      env,
      '/rest/v1/pay_payment_transfers?select=id,transfer_role,source,destination,asset,amount_atomic::text,token_mint,token_program,token_decimals,instruction_index,created_at&payment_transaction_id=eq.' + encodeURIComponent(String(transaction.id)) + '&order=instruction_index.asc,created_at.asc',
    );

    const asset = String(payment.asset);
    const decimals = payment.token_decimals === null || payment.token_decimals === undefined
      ? (asset === 'SOL' ? 9 : null)
      : Number(payment.token_decimals);

    return payJson({
      apiVersion: 'v1',
      data: {
        receipt: {
          id: payment.id,
          status: payment.status,
          merchant: {
            id: merchant.id,
            businessName: merchant.business_name,
          },
          paymentLink: paymentLink ? {
            slug: paymentLink.slug,
            title: paymentLink.title,
            description: paymentLink.description,
            checkoutLocale: paymentLink.checkout_locale,
          } : null,
          amountAtomic: String(payment.amount_atomic),
          customerTotalAtomic: String(payment.customer_total_atomic),
          merchantSettlementAtomic: String(payment.merchant_settlement_atomic),
          feeAtomic: String(payment.fee_atomic),
          feeBps: Number(payment.fee_bps),
          feePayer: payment.fee_payer,
          asset,
          tokenMint: payment.token_mint,
          tokenProgram: payment.token_program,
          tokenDecimals: decimals,
          recipient: payment.recipient,
          feeRecipient: payment.fee_recipient,
          reference: payment.reference,
          network: payment.network,
          verificationCommitment: payment.verification_commitment,
          createdAt: payment.created_at,
          completedAt: transaction.verified_at,
          payerWallet: payment.customer_wallet_address,
        },
        transaction: {
          id: transaction.id,
          signature: transaction.signature,
          slot: transaction.slot,
          blockTime: transaction.block_time,
          observedAmountAtomic: String(transaction.observed_amount_atomic),
          asset: transaction.asset,
          recipient: transaction.recipient,
          referenceMatched: transaction.reference_matched,
          confirmed: transaction.confirmed,
          commitment: transaction.commitment,
          feePayer: transaction.fee_payer,
          networkFeeLamports: String(transaction.network_fee_lamports ?? '0'),
          verificationStatus: transaction.verification_status,
          verifiedAt: transaction.verified_at,
          isAuthoritative: transaction.is_authoritative,
          tokenMint: transaction.token_mint,
          tokenProgram: transaction.token_program,
          tokenDecimals: transaction.token_decimals,
        },
        transfers,
      },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    }
    console.error(JSON.stringify({ scope: 'pay:payment-receipt-read', requestId, paymentId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_RECEIPT_READ_FAILED', message: 'Payment receipt could not be retrieved.' }, 503, requestId);
  }
};
