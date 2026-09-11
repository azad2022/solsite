import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }

const STATUSES = new Set([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'completed',
  'expired', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient',
  'duplicate', 'ambiguous', 'failed', 'refunded',
]);

const PAYMENT_SELECT = [
  'id', 'merchant_id', 'external_order_id', 'amount_atomic', 'asset', 'token_mint', 'token_program',
  'token_decimals', 'recipient', 'reference', 'fee_atomic', 'fee_payer', 'customer_total_atomic',
  'merchant_net_atomic', 'merchant_settlement_atomic', 'status', 'expires_at', 'created_at', 'updated_at',
  'network', 'payment_link_id', 'invoice_id', 'customer_wallet_address',
].join(',');

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeLimit(value: string | null): number {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  return parsed;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const merchantId = (params.get('merchantId') || '').trim();
    if (!validUuid(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);

    const status = (params.get('status') || '').trim();
    if (status && !STATUSES.has(status)) return payJson({ code: 'STATUS_INVALID', message: 'Payment status is invalid.' }, 400, requestId);

    const search = (params.get('search') || '').trim();
    if (search.length > 120) return payJson({ code: 'SEARCH_TOO_LONG', message: 'Search text is too long.' }, 400, requestId);

    const limit = safeLimit(params.get('limit'));
    const conditions = [`merchant_id=eq.${encodeURIComponent(merchantId)}`];
    if (status) conditions.push(`status=eq.${encodeURIComponent(status)}`);
    if (search) {
      const escaped = search.replace(/[%*,()]/g, '');
      if (escaped) {
        if (validUuid(escaped)) conditions.push(`or=(id.eq.${encodeURIComponent(escaped)},external_order_id.ilike.*${encodeURIComponent(escaped)}*,reference.ilike.*${encodeURIComponent(escaped)}*,customer_wallet_address.ilike.*${encodeURIComponent(escaped)}*)`);
        else conditions.push(`or=(external_order_id.ilike.*${encodeURIComponent(escaped)}*,reference.ilike.*${encodeURIComponent(escaped)}*,customer_wallet_address.ilike.*${encodeURIComponent(escaped)}*)`);
      }
    }

    const query = `/rest/v1/pay_payment_intents?select=${PAYMENT_SELECT}&${conditions.join('&')}&order=created_at.desc&limit=${limit}`;
    const response = await supabaseRequestAsIdentity(env, identity.accessToken, query);
    const rows = await response.json() as Array<Record<string, unknown>>;

    return payJson({
      apiVersion: 'v1',
      data: rows,
      meta: { merchantId, limit, returned: rows.length },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:transactions-list', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'TRANSACTIONS_READ_FAILED', message: 'Transactions could not be retrieved.' }, 503, requestId);
  }
};
