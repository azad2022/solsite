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

export type ReconciliationOutcomeStatus = 'underpaid' | 'overpaid' | 'ambiguous';

export interface ReconciliationRepository {
  loadKnownSignatures(paymentId: string): Promise<ReadonlySet<string>>;
  prepareVerification(paymentId: string): Promise<'ready' | 'stale'>;
  recordRejectedObservation(paymentId: string, observation: ObservedPaymentTransaction, reason: string): Promise<void>;
  recordOutcome(paymentId: string, status: ReconciliationOutcomeStatus, reason: string): Promise<'recorded' | 'stale'>;
  applyVerifiedObservation(input: {
    payment: ReconciliationPayment;
    observation: ObservedPaymentTransaction;
    transfers: readonly ObservedTransfer[];
  }): Promise<'confirmed' | 'duplicate' | 'stale'>;
  expirePayment(paymentId: string): Promise<'expired' | 'stale'>;
}

export interface ReconciliationResult {
  paymentId: string;
  outcome: 'confirmed' | 'duplicate' | 'expired' | 'no_match' | 'underpaid' | 'overpaid' | 'ambiguous' | 'provider_unavailable' | 'stale';
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

function transferMatchesExpectation(transfer: ObservedTransfer, expected: ExpectedPayment, destinationAuthority: string, amountAtomic: string): boolean {
  if (transfer.asset !== expected.asset || transfer.amountAtomic !== amountAtomic) return false;
  if (expected.asset === 'SOL') {
    return transfer.destination === destinationAuthority
      && transfer.tokenMint === null
      && transfer.tokenProgram === null
      && transfer.tokenDecimals === null;
  }
  return transfer.destinationAuthority === destinationAuthority
    && transfer.tokenMint === expected.tokenMint
    && transfer.tokenProgram === expected.tokenProgram
    && transfer.tokenDecimals === expected.tokenDecimals;
}

function labelVerifiedTransfers(expected: ExpectedPayment, transfers: readonly ObservedTransfer[]): readonly ObservedTransfer[] {
  const merchant = transfers.filter((transfer) => transferMatchesExpectation(
    transfer,
    expected,
    expected.merchantDestination,
    expected.merchantSettlementAtomic,
  ));
  const fee = transfers.filter((transfer) => transferMatchesExpectation(
    transfer,
    expected,
    expected.feeDestination,
    expected.gatewayFeeAtomic,
  ));

  if (merchant.length !== 1 || fee.length !== 1) {
    throw new Error('Verified observation contains ambiguous settlement legs.');
  }

  return transfers.map((transfer) => {
    if (transfer === merchant[0]) return { ...transfer, role: 'merchant_settlement' };
    if (transfer === fee[0]) return { ...transfer, role: 'gateway_fee' };
    return { ...transfer, role: 'other' };
  });
}

async function persistOutcome(
  repository: ReconciliationRepository,
  paymentId: string,
  status: ReconciliationOutcomeStatus,
  reason: string,
): Promise<'recorded' | 'stale'> {
  try {
    return await repository.recordOutcome(paymentId, status, reason);
  } catch {
    return 'stale';
  }
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

  if (payment.status === 'ambiguous') {
    const prepared = await repository.prepareVerification(payment.id);
    if (prepared === 'stale') return { paymentId: payment.id, outcome: 'stale', checkedSignatures: [], verification: null };
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

  if (verification.result.reason === 'AMBIGUOUS_CANDIDATE') {
    for (const check of verification.checks) {
      try { await repository.recordRejectedObservation(payment.id, check.observation, 'AMBIGUOUS_CANDIDATE'); } catch { /* keep retryable outcome */ }
    }
    const persisted = await persistOutcome(repository, payment.id, 'ambiguous', 'AMBIGUOUS_CANDIDATE');
    return {
      paymentId: payment.id,
      outcome: persisted === 'stale' ? 'stale' : 'ambiguous',
      checkedSignatures: verification.checkedSignatures,
      verification,
    };
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
      return {
        paymentId: payment.id,
        outcome: 'stale',
        checkedSignatures: verification.checkedSignatures,
        verification,
      };
    }
  }

  if (verification.result.reason === 'UNDERPAID' || verification.result.reason === 'OVERPAID') {
    const status = verification.result.reason === 'UNDERPAID' ? 'underpaid' : 'overpaid';
    const persisted = await persistOutcome(repository, payment.id, status, verification.result.reason);
    return {
      paymentId: payment.id,
      outcome: persisted === 'stale' ? 'stale' : status,
      checkedSignatures: verification.checkedSignatures,
      verification,
    };
  }

  return {
    paymentId: payment.id,
    outcome: 'no_match',
    checkedSignatures: verification.checkedSignatures,
    verification,
  };
}
