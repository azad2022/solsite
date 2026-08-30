/**
 * Provider-to-ledger reconciliation orchestration.
 *
 * The engine never writes directly to the database and never trusts the
 * provider to assign semantic transfer roles. Database implementations must
 * commit a verified observation and the financial state transition atomically.
 */
import type { PaymentAsset, PaymentStatus, TokenProgram } from '../types/domain';
import type { SolanaPaymentProvider } from './blockchainProvider';
import { verifyPayment, type PaymentVerificationDecision } from './paymentVerifier';
import type { ExpectedPayment, ObservedPaymentTransaction, ObservedTransfer } from './verificationPolicy';

export interface ReconciliationPayment {
  id: string;
  merchantId: string;
  amountAtomic: string;
  customerTotalAtomic: string;
  merchantSettlementAtomic: string;
  gatewayFeeAtomic: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  tokenDecimals: number | null;
  recipient: string;
  feeRecipient: string;
  reference: string;
  verificationCommitment: 'confirmed' | 'finalized';
  expiresAt: string;
  status: PaymentStatus;
}

export interface ReconciliationRepository {
  loadKnownSignatures(paymentId: string): Promise<ReadonlySet<string>>;
  recordRejectedObservation(paymentId: string, observation: ObservedPaymentTransaction, reason: string): Promise<void>;
  applyVerifiedObservation(input: {
    payment: ReconciliationPayment;
    observation: ObservedPaymentTransaction;
    transfers: readonly ObservedTransfer[];
  }): Promise<'confirmed' | 'duplicate' | 'stale'>;
  expirePayment(paymentId: string): Promise<'expired' | 'stale'>;
}

export interface ReconciliationResult {
  paymentId: string;
  outcome: 'confirmed' | 'duplicate' | 'expired' | 'no_match' | 'provider_unavailable' | 'stale';
  checkedSignatures: readonly string[];
  verification: PaymentVerificationDecision | null;
}

function expectedFromPayment(payment: ReconciliationPayment): ExpectedPayment {
  return {
    amountAtomic: payment.amountAtomic,
    asset: payment.asset,
    tokenMint: payment.tokenMint,
    tokenProgram: payment.tokenProgram,
    tokenDecimals: payment.tokenDecimals,
    merchantDestination: payment.recipient,
    feeDestination: payment.feeRecipient,
    merchantSettlementAtomic: payment.merchantSettlementAtomic,
    gatewayFeeAtomic: payment.gatewayFeeAtomic,
    reference: payment.reference,
    requiredCommitment: payment.verificationCommitment,
  };
}

export async function reconcilePayment(
  provider: SolanaPaymentProvider,
  repository: ReconciliationRepository,
  payment: ReconciliationPayment,
): Promise<ReconciliationResult> {
  if (new Date(payment.expiresAt).getTime() <= Date.now()) {
    const outcome = await repository.expirePayment(payment.id);
    return { paymentId: payment.id, outcome, checkedSignatures: [], verification: null };
  }

  let knownSignatures: ReadonlySet<string>;
  try {
    knownSignatures = await repository.loadKnownSignatures(payment.id);
  } catch {
    return { paymentId: payment.id, outcome: 'provider_unavailable', checkedSignatures: [], verification: null };
  }

  let verification: PaymentVerificationDecision;
  try {
    verification = await verifyPayment(provider, expectedFromPayment(payment), undefined, knownSignatures);
  } catch {
    return { paymentId: payment.id, outcome: 'provider_unavailable', checkedSignatures: [], verification: null };
  }

  if (verification.candidate) {
    const observation = await provider.getTransaction(verification.candidate.signature, payment.verificationCommitment);
    if (!observation) {
      return { paymentId: payment.id, outcome: 'provider_unavailable', checkedSignatures: verification.checkedSignatures, verification };
    }
    try {
      const outcome = await repository.applyVerifiedObservation({ payment, observation, transfers: observation.transfers });
      return {
        paymentId: payment.id,
        outcome,
        checkedSignatures: verification.checkedSignatures,
        verification,
      };
    } catch {
      return { paymentId: payment.id, outcome: 'stale', checkedSignatures: verification.checkedSignatures, verification };
    }
  }

  for (const signature of verification.checkedSignatures) {
    const observation = await provider.getTransaction(signature, payment.verificationCommitment);
    if (!observation) continue;
    const reason = verification.result.reason;
    try {
      await repository.recordRejectedObservation(payment.id, observation, reason);
    } catch {
      // Reconciliation remains fail-closed. A rejected observation is not
      // converted into a success merely because persistence failed.
    }
  }

  return {
    paymentId: payment.id,
    outcome: verification.checkedSignatures.length ? 'no_match' : 'no_match',
    checkedSignatures: verification.checkedSignatures,
    verification,
  };
}
