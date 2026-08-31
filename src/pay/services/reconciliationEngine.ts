import type { PaymentAsset, PaymentStatus, TokenProgram } from '../types/domain';
import type { SolanaPaymentProvider } from './blockchainProvider';
import { verifyPayment, type PaymentVerificationDecision } from './paymentVerifier';
import type { ExpectedPayment, ObservedPaymentTransaction, ObservedTransfer } from './verificationPolicy';

export interface ReconciliationPayment {
  id: string;
  merchantId: string;
  createdAt: string;
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

function labelVerifiedTransfers(expected: ExpectedPayment, transfers: readonly ObservedTransfer[]): readonly ObservedTransfer[] {
  const merchant = transfers.filter((transfer) =>
    transfer.destination === expected.merchantDestination
      && transfer.asset === expected.asset
      && transfer.amountAtomic === expected.merchantSettlementAtomic,
  );
  const fee = transfers.filter((transfer) =>
    transfer.destination === expected.feeDestination
      && transfer.asset === expected.asset
      && transfer.amountAtomic === expected.gatewayFeeAtomic,
  );

  if (merchant.length !== 1 || fee.length !== 1) {
    throw new Error('Verified observation contains ambiguous settlement legs.');
  }

  return transfers.map((transfer) => {
    if (transfer === merchant[0]) return { ...transfer, role: 'merchant_settlement' };
    if (transfer === fee[0]) return { ...transfer, role: 'gateway_fee' };
    return { ...transfer, role: 'other' };
  });
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
    verification = await verifyPayment(
      provider,
      expectedFromPayment(payment),
      undefined,
      knownSignatures,
      { createdAt: payment.createdAt, expiresAt: payment.expiresAt },
    );
  } catch {
    return { paymentId: payment.id, outcome: 'provider_unavailable', checkedSignatures: [], verification: null };
  }

  if (verification.candidate) {
    try {
      const expected = expectedFromPayment(payment);
      const transfers = labelVerifiedTransfers(expected, verification.candidate.observation.transfers);
      const outcome = await repository.applyVerifiedObservation({
        payment,
        observation: verification.candidate.observation,
        transfers,
      });
      return {
        paymentId: payment.id,
        outcome,
        checkedSignatures: verification.checkedSignatures,
        verification,
      };
    } catch {
      return {
        paymentId: payment.id,
        outcome: 'stale',
        checkedSignatures: verification.checkedSignatures,
        verification,
      };
    }
  }

  if (verification.result.reason === 'DUPLICATE_SIGNATURE') {
    return {
      paymentId: payment.id,
      outcome: 'duplicate',
      checkedSignatures: verification.checkedSignatures,
      verification,
    };
  }

  for (const check of verification.checks) {
    try {
      await repository.recordRejectedObservation(payment.id, check.observation, check.result.reason);
    } catch {
      // Fail closed: persistence failure never turns a rejected observation into success.
    }
  }

  return {
    paymentId: payment.id,
    outcome: 'no_match',
    checkedSignatures: verification.checkedSignatures,
    verification,
  };
}
