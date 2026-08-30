import { createSolanaRpcProvider } from '../../../../src/pay/services/solanaRpcProvider';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../../../../src/pay/services/reconciliationEngine';
import type { ObservedPaymentTransaction } from '../../../../src/pay/services/verificationPolicy';
import { payJson, PayRuntimeError, readJsonBody, supabaseRequest, makePayRequestId } from '../../../pay/_shared/runtime';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SOLANA_RPC_URL?: string;
  PAY_USDC_MINT?: string;
  PAY_USDT_MINT?: string;
  PAY_RECONCILE_SECRET?: string;
  PAY_RECONCILE_BATCH_SIZE?: string;
};

type PaymentRow = {
  id: string;
  merchant_id: string;
  amount_atomic: string;
  customer_total_atomic: string;
  merchant_settlement_atomic: string;
  fee_atomic: string;
  asset: 'SOL' | 'USDC' | 'USDT';
  token_mint: string | null;
  token_program: 'spl-token' | 'token-2022' | null;
  token_decimals: number | null;
  recipient: string;
  fee_recipient: string;
  reference: string;
  verification_commitment: 'confirmed' | 'finalized';
  expires_at: string;
  status: ReconciliationPayment['status'];
};

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) diff |= (left[i % Math.max(left.length, 1)] ?? 0) ^ (right[i % Math.max(right.length, 1)] ?? 0);
  return diff === 0;
}

function authorized(request: Request, env: Env): boolean {
  const configured = env.PAY_RECONCILE_SECRET?.trim();
  if (!configured || configured.length < 32) return false;
  const header = request.headers.get('Authorization') || '';
  if (!/^Bearer\s+/i.test(header)) return false;
  return constantTimeEqual(header.replace(/^Bearer\s+/i, '').trim(), configured);
}

async function loadPayments(env: Env, limit: number): Promise<PaymentRow[]> {
  const now = new Date().toISOString();
  const fields = [
    'id','merchant_id','amount_atomic','customer_total_atomic','merchant_settlement_atomic',
    'fee_atomic','asset','token_mint','token_program','token_decimals','recipient',
    'fee_recipient','reference','verification_commitment','expires_at','status',
  ].join(',');
  const active = await supabaseRequest(env, `/rest/v1/pay_payment_intents?select=${fields}&status=in.(pending,detected,verifying,underpaid)&expires_at=gt.${encodeURIComponent(now)}&order=created_at.asc&limit=${limit}`, { headers: { Accept: 'application/json' } });
  if (!active.ok) throw new PayRuntimeError('PAYMENT_SCAN_FAILED', 503, 'Unable to scan payment intents.');
  return await active.json() as PaymentRow[];
}

class SupabaseReconciliationRepository implements ReconciliationRepository {
  constructor(private readonly env: Env, private readonly requestId: string) {}

  async loadKnownSignatures(paymentId: string): Promise<ReadonlySet<string>> {
    const response = await supabaseRequest(this.env, `/rest/v1/pay_payment_transactions?select=signature&payment_id=eq.${encodeURIComponent(paymentId)}&limit=100`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new PayRuntimeError('TRANSACTION_SCAN_FAILED', 503, 'Unable to load known payment observations.');
    const rows = await response.json() as Array<{ signature: string }>;
    return new Set(rows.map((row) => row.signature).filter(Boolean));
  }

  async recordRejectedObservation(paymentId: string, observation: ObservedPaymentTransaction, reason: string): Promise<void> {
    const response = await supabaseRequest(this.env, '/rest/v1/rpc/pay_record_rejected_observation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        p_payment_id: paymentId,
        p_signature: observation.signature,
        p_slot: null,
        p_block_time: null,
        p_success: observation.success,
        p_commitment: observation.commitment,
        p_fee_payer: observation.feePayer,
        p_observed_amount_atomic: observation.transfers.find((transfer) => transfer.asset === observation.transfers[0]?.asset)?.amountAtomic || '0',
        p_asset: observation.transfers[0]?.asset || 'SOL',
        p_recipient: observation.transfers.find((transfer) => transfer.asset === observation.transfers[0]?.asset)?.destination || '',
        p_reference_matched: observation.referenceMatched,
        p_reason: reason,
        p_raw_observation: { provider: 'solana-rpc', requestId: this.requestId, signature: observation.signature },
      }),
    });
    if (!response.ok) throw new PayRuntimeError('OBSERVATION_PERSIST_FAILED', 503, 'Rejected observation could not be stored.');
  }

  async applyVerifiedObservation(input: { payment: ReconciliationPayment; observation: ObservedPaymentTransaction; transfers: readonly import('../../../../src/pay/services/verificationPolicy').ObservedTransfer[] }): Promise<'confirmed' | 'duplicate' | 'stale'> {
    const merchantTransfer = input.transfers.find((transfer) => transfer.destination === input.payment.recipient && transfer.asset === input.payment.asset && transfer.amountAtomic === input.payment.merchantSettlementAtomic);
    if (!merchantTransfer) return 'stale';

    const rpc = await supabaseRequest(this.env, '/rest/v1/rpc/pay_apply_verified_observation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        p_payment_id: input.payment.id,
        p_signature: input.observation.signature,
        p_slot: null,
        p_block_time: null,
        p_observed_amount_atomic: merchantTransfer.amountAtomic,
        p_asset: input.payment.asset,
        p_recipient: input.payment.recipient,
        p_reference_matched: input.observation.referenceMatched,
        p_success: input.observation.success,
        p_commitment: input.observation.commitment,
        p_fee_payer: input.observation.feePayer,
        p_network_fee_lamports: null,
        p_transfers: input.transfers,
        p_raw_observation: { provider: 'solana-rpc', requestId: this.requestId, signature: input.observation.signature },
        p_verified_at: new Date().toISOString(),
        p_request_id: this.requestId,
      }),
    });
    if (!rpc.ok) throw new PayRuntimeError('RECONCILIATION_COMMIT_FAILED', 503, 'Verified payment could not be committed safely.');
    const result = await rpc.json() as { ok?: boolean; status?: string; reason?: string };
    if (result.ok && result.status === 'confirmed') return 'confirmed';
    if (result.reason === 'ALREADY_CONFIRMED' || result.reason === 'SIGNATURE_ALREADY_BOUND') return 'duplicate';
    return 'stale';
  }

  async expirePayment(paymentId: string): Promise<'expired' | 'stale'> {
    const response = await supabaseRequest(this.env, '/rest/v1/rpc/pay_transition_payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_payment_id: paymentId, p_to_status: 'expired', p_reason: 'payment_expiry_reconciliation', p_request_id: this.requestId }),
    });
    if (!response.ok) return 'stale';
    const result = await response.json() as { ok?: boolean; reason?: string };
    return result.ok ? 'expired' : 'stale';
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const requestId = makePayRequestId();
  try {
    if (!authorized(request, env)) return payJson({ code: 'UNAUTHORIZED' }, 401, requestId);
    const body = await readJsonBody(request).catch(() => ({}));
    const requested = body.limit === undefined ? 10 : Number(body.limit);
    if (!Number.isInteger(requested) || requested < 1 || requested > 50) throw new PayRuntimeError('INVALID_BATCH_SIZE', 400, 'limit must be an integer between 1 and 50.');
    const configured = Number(env.PAY_RECONCILE_BATCH_SIZE || requested);
    const limit = Math.min(requested, Number.isInteger(configured) && configured > 0 ? Math.min(configured, 50) : requested);

    const provider = createSolanaRpcProvider(env, { USDC: env.PAY_USDC_MINT, USDT: env.PAY_USDT_MINT });
    const health = await provider.getHealth();
    if (!health.ok) return payJson({ code: 'BLOCKCHAIN_PROVIDER_UNAVAILABLE', data: { provider: health.provider } }, 503, requestId);

    const payments = await loadPayments(env, limit);
    const repository = new SupabaseReconciliationRepository(env, requestId);
    const results = [];
    for (const payment of payments) {
      const result = await reconcilePayment(provider, repository, payment);
      results.push(result);
    }

    return payJson({ data: { provider: health.provider, slot: health.slot, scanned: payments.length, results } }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Reconciliation service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:reconcile', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Reconciliation service is temporarily unavailable.' }, 503, requestId);
  }
};
