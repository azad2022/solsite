/**
 * Deterministic payment-verification rules.
 *
 * This module consumes normalized blockchain observations. RPC/indexer adapters
 * are kept outside it so the business decision does not depend on a provider's
 * response shape. A payment is financially eligible only when every required
 * invariant passes at the configured commitment level.
 */
import type { PaymentAsset, PaymentStatus } from '../types/domain';

export type SolanaCommitment = 'confirmed' | 'finalized';

export interface ExpectedPayment {
  amountAtomic: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  merchantDestination: string;
  feeDestination: string;
  merchantSettlementAtomic: string;
  gatewayFeeAtomic: string;
  reference: string;
  requiredCommitment: SolanaCommitment;
}

export interface ObservedTransfer {
  role: 'merchant_settlement' | 'gateway_fee' | 'refund' | 'other';
  source: string | null;
  destination: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  amountAtomic: string;
  instructionIndex: number | null;
}

export interface ObservedPaymentTransaction {
  signature: string;
  success: boolean;
  commitment: SolanaCommitment;
  feePayer: string | null;
  referenceMatched: boolean;
  transfers: readonly ObservedTransfer[];
}

export interface VerificationResult {
  valid: boolean;
  status: PaymentStatus;
  reason:
    | 'OK'
    | 'TRANSACTION_FAILED'
    | 'COMMITMENT_TOO_LOW'
    | 'REFERENCE_MISMATCH'
    | 'MERCHANT_TRANSFER_MISMATCH'
    | 'FEE_TRANSFER_MISMATCH'
    | 'DUPLICATE_SIGNATURE'
    | 'MISSING_SIGNATURE';
}

export function verifyPaymentTransaction(
  expected: ExpectedPayment,
  observed: ObservedPaymentTransaction,
  duplicateSignature = false,
): VerificationResult {
  if (!observed.signature) {
    return { valid: false, status: 'failed', reason: 'MISSING_SIGNATURE' };
  }
  if (duplicateSignature) {
    return { valid: false, status: 'duplicate', reason: 'DUPLICATE_SIGNATURE' };
  }
  if (!observed.success) {
    return { valid: false, status: 'failed', reason: 'TRANSACTION_FAILED' };
  }
  if (expected.requiredCommitment === 'finalized' && observed.commitment !== 'finalized') {
    return { valid: false, status: 'verifying', reason: 'COMMITMENT_TOO_LOW' };
  }
  if (!observed.referenceMatched) {
    return { valid: false, status: 'wrong_recipient', reason: 'REFERENCE_MISMATCH' };
  }

  const merchantMatches = observed.transfers.some(
    (transfer) =>
      transfer.role === 'merchant_settlement' &&
      transfer.destination === expected.merchantDestination &&
      transfer.asset === expected.asset &&
      transfer.tokenMint === expected.tokenMint &&
      transfer.amountAtomic === expected.merchantSettlementAtomic,
  );

  if (!merchantMatches) {
    return { valid: false, status: 'wrong_recipient', reason: 'MERCHANT_TRANSFER_MISMATCH' };
  }

  const feeMatches = observed.transfers.some(
    (transfer) =>
      transfer.role === 'gateway_fee' &&
      transfer.destination === expected.feeDestination &&
      transfer.asset === expected.asset &&
      transfer.tokenMint === expected.tokenMint &&
      transfer.amountAtomic === expected.gatewayFeeAtomic,
  );

  if (!feeMatches) {
    return { valid: false, status: 'failed', reason: 'FEE_TRANSFER_MISMATCH' };
  }

  // Verification proves the transaction. Completion is a later business step
  // that records accounting and emits merchant webhooks exactly once.
  return { valid: true, status: 'confirmed', reason: 'OK' };
}
