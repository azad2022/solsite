import {
  enforcePayRateLimit,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  readJsonBody,
  supabaseRequest,
} from '../../../_shared/runtime';
import { createSolanaRpcProvider } from '../../../../../../src/pay/services/solanaRpcProvider';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../../../../../../src/pay/services/reconciliationEngine';
import type { ObservedPaymentTransaction, ObservedTransfer } from '../../../../../../src/pay/services/verificationPolicy';
import type { PaymentAsset, PaymentStatus, TokenProgram } from '../../../../../../src/pay/types/domain';
import { sendMerchantPaymentNotificationEmail } from '../../_shared/paymentEmail';
import type { AuthEmailLocale } from '../../../../auth/_email';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  SOLANA_RPC_URL?: string;
  PAY_USDC_MINT?: string;
  PAY_USDT_MINT?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
}

interface PaymentRow {
  id: string;
  merchant_id: string;
  created_at: string;
  amount_atomic: string;
  customer_total_atomic: string;
  merchant_settlement_atomic: string;
  fee_atomic: string;
  asset: PaymentAsset;
  token_mint: string | null;
  token_program: TokenProgram | null;
  token_decimals: number | null;
  recipient: string;
  fee_recipient: string;
  reference: string;
  verification_commitment: 'confirmed' | 'finalized';
  expires_at: string;
  status: PaymentStatus;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_purpose: string | null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSignature(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(value);
}

function isPaymentAsset(value: unknown): value is PaymentAsset {
  return value === 'SOL' || value === 'USDC' || value === 'USDT';
}

function isTokenProgram(value: unknown): value is TokenProgram {
  return value === 'spl-token' || value === 'token-2022';
}

function normalizeMerchantEmailLocale(value: string | null | undefined): AuthEmailLocale {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('fa')) return 'fa-IR';
  if (raw.startsWith('ar')) return 'ar';
  if (raw.startsWith('ru')) return 'ru';
  return 'en-US';
}

type MerchantEmailTarget = {
  email: string;
  merchantName: string;
  locale: AuthEmailLocale;
};

async function loadMerchantEmailTarget(env: PayEnv, merchantId: string): Promise<MerchantEmailTarget | null> {
  const merchantResponse = await supabaseRequest(
    env,
    `/rest/v1/pay_merchants?select=id,owner_user_id,business_name,default_dashboard_locale&id=eq.${encodeURIComponent(merchantId)}&limit=1`,
    { headers: { Accept: 'application/json' } },
  );
  const merchants = await merchantResponse.json() as Array<{
    id: string;
    owner_user_id: string;
    business_name: string;
    default_dashboard_locale: string;
  }>;
  const merchant = merchants[0];
  if (!merchant?.owner_user_id || !merchant.business_name) return null;

  const identityResponse = await supabaseRequest(
    env,
    `/rest/v1/auth_identity_links?select=better_auth_user_id&application_user_id=eq.${encodeURIComponent(merchant.owner_user_id)}&limit=1`,
    { headers: { Accept: 'application/json' } },
  );
  const identities = await identityResponse.json() as Array<{ better_auth_user_id?: string }>;
  const betterAuthUserId = identities[0]?.better_auth_user_id;
  if (!betterAuthUserId) return null;

  const authUser = await rpcJson<{ id?: string; email?: string; name?: string }>(
    env,
    'solmint_better_auth_adapter',
    {
      p_operation: 'find_one',
      p_model: 'user',
      p_where: [{ field: 'id', value: betterAuthUserId, operator: 'eq' }],
      p_limit: 1,
      p_offset: 0,
      p_sort: null,
      p_increment: {},
      p_set: {},
    },
  );
  const email = typeof authUser?.email === 'string' ? authUser.email.trim() : '';
  if (!email || !email.includes('@') || email.length > 320) return null;

  return {
    email,
    merchantName: merchant.business_name,
    locale: normalizeMerchantEmailLocale(merchant.default_dashboard_locale),
  };
}

const SUCCESS_EMAIL_STATUSES = new Set<PaymentStatus>(['confirmed', 'completed']);
const FAILURE_EMAIL_STATUSES = new Set<PaymentStatus>(['underpaid', 'overpaid', 'wrong_token', 'wrong_recipient', 'failed', 'expired', 'ambiguous']);

async function notifyMerchantPaymentOutcome(env: PayEnv, row: PaymentRow, status: PaymentStatus, requestId: string): Promise<void> {
  const outcome = SUCCESS_EMAIL_STATUSES.has(status) ? 'success' : FAILURE_EMAIL_STATUSES.has(status) ? 'failure' : null;
  if (!outcome) return;

  try {
    const eventType = outcome === 'success' ? 'payment.outcome.success' : 'payment.outcome.failure';
    const workerId = `pay-verify:${requestId}`;
    const claim = await rpcJson<{ ok?: boolean; should_send?: boolean; delivery_id?: string }>(
      env,
      'pay_claim_payment_email_delivery',
      { p_payment_id: row.id, p_event_type: eventType, p_worker_id: workerId },
    );
    if (claim.ok !== true || claim.should_send !== true || !claim.delivery_id) return;

    try {
      const target = await loadMerchantEmailTarget(env, row.merchant_id);
      if (!target) throw new Error('MERCHANT_EMAIL_NOT_AVAILABLE');

      await sendMerchantPaymentNotificationEmail(env, target.email, {
        outcome,
        locale: target.locale,
        merchantName: target.merchantName,
        paymentId: row.id,
        paymentStatus: status,
        amountAtomic: row.amount_atomic,
        asset: row.asset,
        tokenDecimals: row.token_decimals,
        customerFirstName: row.customer_first_name,
        customerLastName: row.customer_last_name,
        customerPurpose: row.customer_purpose,
      });

      await rpcJson(env, 'pay_complete_payment_email_delivery', {
        p_delivery_id: claim.delivery_id,
        p_worker_id: workerId,
      });
    } catch {
      await rpcJson(env, 'pay_fail_payment_email_delivery', {
        p_delivery_id: claim.delivery_id,
        p_worker_id: workerId,
        p_error_code: 'EMAIL_DELIVERY_FAILED',
      }).catch(() => {});
    }
  } catch {
    // Notification failure must never mutate or mask the authoritative payment result.
    console.warn(JSON.stringify({ scope: 'pay:merchant-payment-email', requestId, paymentId: row.id, status, outcome }));
  }
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && [
    'created', 'pending', 'detected', 'verifying', 'confirmed', 'completed',
    'expired', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient',
    'duplicate', 'ambiguous', 'failed', 'refunded',
  ].includes(value);
}

async function rpcJson<T>(env: PayEnv, functionName: string, body: Record<string, unknown>): Promise<T> {
  const response = await supabaseRequest(env, `/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return await response.json() as T;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function observationPayload(observation: ObservedPaymentTransaction): Record<string, unknown> {
  return {
    signature: observation.signature,
    slot: observation.slot ?? null,
    blockTime: observation.blockTime ?? null,
    networkFeeLamports: observation.networkFeeLamports ?? null,
    success: observation.success,
    commitment: observation.commitment,
    feePayer: observation.feePayer,
    referenceMatched: observation.referenceMatched,
    transfers: observation.transfers,
  };
}

function mapPayment(row: PaymentRow): ReconciliationPayment {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    createdAt: row.created_at,
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

function createRepository(env: PayEnv, requestId: string): ReconciliationRepository {
  return {
    async loadKnownSignatures(paymentId) {
      const response = await supabaseRequest(
        env,
        `/rest/v1/pay_payment_transactions?select=signature&payment_id=eq.${encodeURIComponent(paymentId)}&signature=not.is.null`,
        { headers: { Accept: 'application/json' } },
      );
      const rows = await response.json() as Array<{ signature?: unknown }>;
      return new Set(rows.map((row) => row.signature).filter((value): value is string => typeof value === 'string' && value.length > 0));
    },

    async prepareVerification(paymentId) {
      const result = await rpcJson<{ ok?: boolean }>(env, 'pay_transition_payment', {
        p_payment_id: paymentId,
        p_to_status: 'pending',
        p_reason: 'verification_retry',
        p_request_id: requestId,
      });
      return result.ok === true ? 'ready' : 'stale';
    },

    async recordRejectedObservation(paymentId, observation, reason) {
      await rpcJson(env, 'pay_record_rejected_observation', {
        p_payment_id: paymentId,
        p_signature: observation.signature,
        p_slot: observation.slot ?? null,
        p_block_time: observation.blockTime ?? null,
        p_success: observation.success,
        p_commitment: observation.commitment,
        p_fee_payer: observation.feePayer,
        p_observed_amount_atomic: null,
        p_asset: observation.transfers[0]?.asset ?? null,
        p_recipient: observation.transfers[0]?.destination ?? null,
        p_reference_matched: observation.referenceMatched,
        p_reason: reason,
        p_raw_observation: observationPayload(observation),
      });
    },

    async recordOutcome(paymentId, status, reason) {
      const result = await rpcJson<{ ok?: boolean }>(env, 'pay_transition_payment', {
        p_payment_id: paymentId,
        p_to_status: status,
        p_reason: reason,
        p_request_id: requestId,
      });
      return result.ok === true ? 'recorded' : 'stale';
    },

    async applyVerifiedObservation(input) {
      const transfers = input.transfers.map((transfer: ObservedTransfer) => ({
        role: transfer.role,
        source: transfer.source,
        destination: transfer.destination,
        asset: transfer.asset,
        amountAtomic: transfer.amountAtomic,
        tokenMint: transfer.tokenMint,
        tokenProgram: transfer.tokenProgram,
        tokenDecimals: transfer.tokenDecimals,
        sourceAuthority: transfer.sourceAuthority,
        destinationAuthority: transfer.destinationAuthority,
        instructionIndex: transfer.instructionIndex,
      }));
      const result = await rpcJson<{ ok?: boolean; reason?: string; status?: PaymentStatus }>(env, 'pay_apply_verified_observation', {
        p_payment_id: input.payment.id,
        p_signature: input.observation.signature,
        p_slot: input.observation.slot ?? null,
        p_block_time: input.observation.blockTime ?? null,
        p_observed_amount_atomic: input.observation.transfers
          .filter((transfer) => transfer.role === 'merchant_settlement')
          .reduce((sum, transfer) => sum + BigInt(transfer.amountAtomic), 0n)
          .toString(),
        p_asset: input.observation.transfers.find((transfer) => transfer.role === 'merchant_settlement')?.asset ?? input.payment.asset,
        p_recipient: input.payment.recipient,
        p_reference_matched: input.observation.referenceMatched,
        p_success: input.observation.success,
        p_commitment: input.observation.commitment,
        p_fee_payer: input.observation.feePayer,
        p_network_fee_lamports: input.observation.networkFeeLamports,
        p_transfers: transfers,
        p_raw_observation: observationPayload(input.observation),
        p_verified_at: new Date().toISOString(),
        p_request_id: requestId,
      });
      if (result.ok === true && result.status === 'confirmed') return 'confirmed';
      if (result.reason === 'SIGNATURE_ALREADY_BOUND' || result.reason === 'ALREADY_CONFIRMED') return 'duplicate';
      return 'stale';
    },

    async expirePayment(paymentId) {
      const result = await rpcJson<{ ok?: boolean }>(env, 'pay_transition_payment', {
        p_payment_id: paymentId,
        p_to_status: 'expired',
        p_reason: 'intent_expired',
        p_request_id: requestId,
      });
      return result.ok === true ? 'expired' : 'stale';
    },
  };
}

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { id?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const paymentId = String(params?.id || '').trim();
    if (!isUuid(paymentId)) return payJson({ code: 'PAYMENT_INTENT_ID_INVALID', message: 'Payment Intent ID is invalid.' }, 400, requestId);

    const body = await readJsonBody(request);
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
    if (!isSignature(signature)) return payJson({ code: 'INVALID_SIGNATURE', message: 'A valid Solana transaction signature is required.' }, 400, requestId);

    const source = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'anonymous';
    const subjectHash = await sha256Hex(`${paymentId}:${source}`);
    await enforcePayRateLimit(env, 'payment-intents:verify:payment', subjectHash, 60, 10);

    const response = await supabaseRequest(
      env,
      `/rest/v1/pay_payment_intents?select=id,merchant_id,created_at,amount_atomic,customer_total_atomic,merchant_settlement_atomic,fee_atomic,asset,token_mint,token_program,token_decimals,recipient,fee_recipient,reference,verification_commitment,expires_at,status,customer_first_name,customer_last_name,customer_purpose&id=eq.${encodeURIComponent(paymentId)}&limit=1`,
      { headers: { Accept: 'application/json' } },
    );
    const rows = await response.json() as PaymentRow[];
    const row = rows[0];
    if (!row) return payJson({ code: 'PAYMENT_INTENT_NOT_FOUND', message: 'Payment Intent was not found.' }, 404, requestId);
    if (!isPaymentAsset(row.asset) || (row.token_program !== null && !isTokenProgram(row.token_program)) || !isPaymentStatus(row.status)) {
      return payJson({ code: 'PAYMENT_INTENT_CONTRACT_INVALID', message: 'Payment Intent state is invalid.' }, 500, requestId);
    }

    if (row.status === 'completed' || row.status === 'refunded') {
      if (row.status === 'completed') await notifyMerchantPaymentOutcome(env, row, row.status, requestId);
      return payJson({ data: { paymentId, status: row.status, outcome: 'duplicate', signature } }, 200, requestId);
    }

    if (row.status === 'created') {
      const advanced = await rpcJson<{ ok?: boolean }>(env, 'pay_transition_payment', {
        p_payment_id: paymentId,
        p_to_status: 'pending',
        p_reason: 'customer_verification_requested',
        p_request_id: requestId,
      });
      if (advanced.ok !== true) return payJson({ code: 'PAYMENT_STATE_STALE', message: 'Payment state changed before verification. Please refresh and try again.' }, 409, requestId);
      row.status = 'pending';
    }

    const provider = createSolanaRpcProvider(
      env,
      { USDC: env.PAY_USDC_MINT?.trim(), USDT: env.PAY_USDT_MINT?.trim() },
    );
    const payment = mapPayment(row);
    const repository = createRepository(env, requestId);
    const result = await reconcilePayment(provider, repository, payment, signature);

    if (result.outcome === 'no_match') {
      if (SUCCESS_EMAIL_STATUSES.has(row.status) || FAILURE_EMAIL_STATUSES.has(row.status)) {
        await notifyMerchantPaymentOutcome(env, row, row.status, requestId);
      }
      return payJson({ data: { paymentId, status: row.status, outcome: 'not_detected', signature } }, 200, requestId);
    }

    const authoritativeStatuses: ReadonlySet<PaymentStatus> = new Set(['confirmed', 'underpaid', 'overpaid', 'ambiguous', 'failed', 'wrong_recipient', 'expired', 'refunded', 'completed']);
    const status = authoritativeStatuses.has(result.outcome as PaymentStatus) ? result.outcome as PaymentStatus : row.status;
    const transactionSignature = result.verification?.candidate?.signature || signature;
    await notifyMerchantPaymentOutcome(env, row, status, requestId);
    return payJson({
      data: {
        paymentId,
        status,
        outcome: result.outcome,
        signature: transactionSignature,
        checkedSignatures: result.checkedSignatures,
      },
    }, 200, requestId);
  } catch (error) {
    console.error(JSON.stringify({ scope: 'pay:payment-intent-verify', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'PAYMENT_VERIFICATION_FAILED', message: 'Payment verification could not be completed safely.' }, 503, requestId);
  }
};
