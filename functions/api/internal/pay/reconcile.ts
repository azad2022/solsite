import { createSolanaRpcProvider } from '../../../../src/pay/services/solanaRpcProvider';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../../../../src/pay/services/reconciliationEngine';
import type { ObservedPaymentTransaction, ObservedTransfer } from '../../../../src/pay/services/verificationPolicy';
import { payJson, PayRuntimeError, readJsonBody, supabaseRequest, makePayRequestId, enforcePayRateLimit } from '../../pay/_shared/runtime';

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

type PaymentRow = ReconciliationPayment & {
  merchant_id: string;
  amount_atomic: string;
  customer_total_atomic: string;
  merchant_settlement_atomic: string;
  fee_atomic: string;
  fee_recipient: string;
  token_mint: string | null;
  token_program: 'spl-token' | 'token-2022' | null;
  token_decimals: number | null;
  verification_commitment: 'confirmed' | 'finalized';
  expires_at: string;
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

function toPayment(row: PaymentRow): ReconciliationPayment {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    createdAt: (row as PaymentRow & { created_at?: string }).created_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    amountAtomic: row.amount_atomic,
    customerTotalAtomic: row.customer_total_atomic,
    merchantSettlementAtomic: row.merchant_settlement_atomic,
    gatewayFeeAtomic: row.fee_atomic,
    asset: row.asset,
    tokenMint: row.token_mint,
    tokenProgram: row.token_program,
    tokenDecimals: row.token_decimals,
    recipient: row.recipient,
    feeRecipient: row.fee_recipient,
    reference: row.reference,
    verificationCommitment: row.verification_commitment,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

async function loadPayments(env: Env, limit: number): Promise<ReconciliationPayment[]> {
  const fields = ['id','merchant_id','created_at','amount_atomic','customer_total_atomic','merchant_settlement_atomic','fee_atomic','asset','token_mint','token_program','token_decimals','recipient','fee_recipient','reference','verification_commitment','expires_at','status'].join(',');
  const now = new Date().toISOString();
  const active = await supabaseRequest(env, `/rest/v1/pay_payment_intents?select=${fields}&status=in.(pending,detected,verifying,underpaid)&expires_at=gt.${encodeURIComponent(now)}&order=created_at.asc&limit=${limit}`, { headers: { Accept: 'application/json' } });
  if (!active.ok) throw new PayRuntimeError('PAYMENT_SCAN_FAILED', 503, 'Unable to scan payment intents.');
  const activeRows = await active.json() as PaymentRow[];
  if (activeRows.length >= limit) return activeRows.map(toPayment);

  const remaining = limit - activeRows.length;
  const expired = await supabaseRequest(env, `/rest/v1/pay_payment_intents?select=${fields}&status=in.(pending,detected,verifying,underpaid)&expires_at=lte.${encodeURIComponent(now)}&order=expires_at.asc&limit=${remaining}`, { headers: { Accept: 'application/json' } });
  if (!expired.ok) throw new PayRuntimeError('PAYMENT_EXPIRY_SCAN_FAILED', 503, 'Unable to scan expired payment intents.');
  return [...activeRows, ...await expired.json() as PaymentRow[]].map(toPayment);
}

class SupabaseReconciliationRepository implements ReconciliationRepository {
  constructor(private readonly env: Env, private readonly requestId: string) {}

  async loadKnownSignatures(paymentId: string): Promise<ReadonlySet<string>> {
    const response = await supabaseRequest(this.env, `/rest/v1/pay_payment_transactions?select=signature&payment_id=eq.${encodeURIComponent(paymentId)}&order=observed_at.asc`, { headers: { Accept: 'application/json' } });
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
        p_slot: observation.slot,
        p_block_time: observation.blockTime,
        p_success: observation.success,
        p_commitment: observation.commitment,
        p_fee_payer: observation.feePayer,
        p_observed_amount_atomic: null,
        p_asset: observation.transfers[0]?.asset ?? null,
        p_recipient: observation.transfers[0]?.destination ?? null,
        p_reference_matched: observation.referenceMatched,
        p_reason: reason,
        p_raw_observation: { provider: 'solana-rpc', requestId: this.requestId, signature: observation.signature },
      }),
    });
    if (!response.ok) throw new PayRuntimeError('OBSERVATION_PERSIST_FAILED', 503, 'Rejected observation could not be stored.');
  }

  async applyVerifiedObservation(input: { payment: ReconciliationPayment; observation: ObservedPaymentTransaction; transfers: readonly ObservedTransfer[] }): Promise<'confirmed' | 'duplicate' | 'stale'> {
    const merchantTransfer = input.transfers.find((transfer) => transfer.role === 'merchant_settlement');
    if (!merchantTransfer) return 'stale';
    const response = await supabaseRequest(this.env, '/rest/v1/rpc/pay_apply_verified_observation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        p_payment_id: input.payment.id,
        p_signature: input.observation.signature,
        p_slot: input.observation.slot,
        p_block_time: input.observation.blockTime,
        p_observed_amount_atomic: merchantTransfer.amountAtomic,
        p_asset: input.payment.asset,
        p_recipient: input.payment.recipient,
        p_reference_matched: input.observation.referenceMatched,
        p_success: input.observation.success,
        p_commitment: input.observation.commitment,
        p_fee_payer: input.observation.feePayer,
        p_network_fee_lamports: input.observation.networkFeeLamports,
        p_transfers: input.transfers,
        p_raw_observation: { provider: 'solana-rpc', requestId: this.requestId, signature: input.observation.signature },
        p_verified_at: new Date().toISOString(),
        p_request_id: this.requestId,
      }),
    });
    if (!response.ok) throw new PayRuntimeError('RECONCILIATION_COMMIT_FAILED', 503, 'Verified payment could not be committed safely.');
    const result = await response.json() as { ok?: boolean; status?: string; reason?: string };
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
    const result = await response.json() as { ok?: boolean };
    return result.ok ? 'expired' : 'stale';
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const requestId = makePayRequestId();
  try {
    if (!authorized(request, env)) return payJson({ code: 'UNAUTHORIZED' }, 401, requestId);
    const subjectBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pay-reconcile'));
    const subjectHash = Array.from(new Uint8Array(subjectBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    await enforcePayRateLimit(env, 'reconcile:worker', subjectHash, 60, 30);

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
    for (const payment of payments) results.push(await reconcilePayment(provider, repository, payment));

    return payJson({ data: { provider: health.provider, slot: health.slot, scanned: payments.length, results } }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Reconciliation service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:reconcile', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Reconciliation service is temporarily unavailable.' }, 503, requestId);
  }
};
