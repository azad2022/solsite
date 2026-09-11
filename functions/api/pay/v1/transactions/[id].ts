import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getJson<T>(env: PayEnv, token: string, path: string): Promise<T[]> {
  const response = await supabaseRequestAsIdentity(env, token, path);
  return await response.json() as T[];
}

export const onRequestGet = async ({ request, env, params }: { request: Request; env: PayEnv; params: { id?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const id = String(params?.id || '').trim();
    if (!validUuid(id)) return payJson({ code: 'TRANSACTION_ID_INVALID', message: 'Transaction ID is invalid.' }, 400, requestId);

    const payments = await getJson<Record<string, unknown>>(
      env,
      identity.accessToken,
      `/rest/v1/pay_payment_intents?select=id,merchant_id,external_order_id,amount_atomic,asset,token_mint,token_program,token_decimals,recipient,reference,fee_bps,fee_payer,fee_atomic,gas_sponsored,status,expires_at,created_at,updated_at,customer_total_atomic,merchant_net_atomic,merchant_settlement_atomic,network,payment_link_id,invoice_id,customer_wallet_address,fee_recipient,fee_payer_address&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    const payment = payments[0];
    if (!payment) return payJson({ code: 'TRANSACTION_NOT_FOUND', message: 'Transaction was not found.' }, 404, requestId);

    const [transactions, events] = await Promise.all([
      getJson<Record<string, unknown>>(env, identity.accessToken, `/rest/v1/pay_payment_transactions?select=id,payment_id,signature,slot,block_time,observed_amount_atomic,asset,recipient,reference_matched,confirmed,observed_at,success,commitment,fee_payer,network_fee_lamports,verification_status,verified_at,is_authoritative,token_mint,token_program,token_decimals,rejection_reason&payment_id=eq.${encodeURIComponent(id)}&order=observed_at.desc`),
      getJson<Record<string, unknown>>(env, identity.accessToken, `/rest/v1/pay_payment_events?select=id,payment_id,event_type,from_status,to_status,request_id,actor_type,actor_id,payload,created_at&payment_id=eq.${encodeURIComponent(id)}&order=created_at.asc`),
    ]);

    let transfers: Record<string, unknown>[] = [];
    if (transactions.length) {
      const ids = transactions.map(row => typeof row.id === 'string' ? row.id : '').filter(Boolean);
      if (ids.length) {
        transfers = await getJson<Record<string, unknown>>(
          env,
          identity.accessToken,
          `/rest/v1/pay_payment_transfers?select=id,payment_transaction_id,transfer_role,source,destination,asset,amount_atomic,token_mint,instruction_index,created_at,token_program,token_decimals,source_authority,destination_authority&payment_transaction_id=in.(${ids.map(encodeURIComponent).join(',')})&order=created_at.asc`,
        );
      }
    }

    return payJson({
      apiVersion: 'v1',
      data: { payment, transactions, transfers, events },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:transaction-detail', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'TRANSACTION_READ_FAILED', message: 'Transaction could not be retrieved.' }, 503, requestId);
  }
};
