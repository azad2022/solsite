/**
 * Deterministic payment-verification rules.
 *
 * This policy intentionally knows nothing about RPC/indexer response formats.
 * Provider adapters normalize observations; the verifier matches value legs
 * against the immutable Payment Intent snapshot and does not trust a caller- or
 * provider-assigned semantic transfer role.
 */
import type { PaymentAsset, PaymentStatus, TokenProgram } from '../types/domain';

export type SolanaCommitment = 'confirmed' | 'finalized';

export interface ExpectedPayment {
  amountAtomic: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  tokenDecimals: number | null;
  merchantDestination: string;
  feeDestination: string;
  merchantSettlementAtomic: string;
  gatewayFeeAtomic: string;
  reference: string;
  requiredCommitment: SolanaCommitment;
  expectedSponsorAddress?: string | null;
}

export interface ObservedTransfer {
  role: 'merchant_settlement' | 'gateway_fee' | 'refund' | 'other';
  source: string | null;
  sourceAuthority: string | null;
  destination: string;
  destinationAuthority: string | null;
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  tokenDecimals: number | null;
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
    | 'TOKEN_ACCOUNT_MISMATCH'
    | 'DESTINATION_COLLISION'
    | 'SENDER_MISMATCH'
    | 'SPONSOR_MISMATCH'
    | 'DUPLICATE_SIGNATURE'
    | 'MISSING_SIGNATURE';
}

function transferMatches(
  transfer: ObservedTransfer,
  expected: ExpectedPayment,
  destination: string,
  amountAtomic: string,
): boolean {
  if (transfer.destination !== transfer.destination.trim()) return false;
  if (transfer.asset !== expected.asset || transfer.amountAtomic !== amountAtomic) return false;

  if (expected.asset === 'SOL') {
    return transfer.tokenMint === null
      && transfer.tokenProgram === null
      && transfer.tokenDecimals === null
      && transfer.destination === destination;
  }

  return transfer.tokenMint === expected.tokenMint
    && transfer.tokenProgram === expected.tokenProgram
    && transfer.tokenDecimals === expected.tokenDecimals
    && transfer.destinationAuthority === destination;
}

export function verifyPaymentTransaction(
  expected: ExpectedPayment,
  observed: ObservedPaymentTransaction,
  duplicateSignature = false,
): VerificationResult {
  if (!observed.signature) return { valid: false, status: 'failed', reason: 'MISSING_SIGNATURE' };
  if (duplicateSignature) return { valid: false, status: 'duplicate', reason: 'DUPLICATE_SIGNATURE' };
  if (!observed.success) return { valid: false, status: 'failed', reason: 'TRANSACTION_FAILED' };
  if (expected.requiredCommitment === 'finalized' && observed.commitment !== 'finalized') {
    return { valid: false, status: 'verifying', reason: 'COMMITMENT_TOO_LOW' };
  }
  if (!observed.referenceMatched) return { valid: false, status: 'wrong_recipient', reason: 'REFERENCE_MISMATCH' };
  if (expected.merchantDestination === expected.feeDestination) {
    return { valid: false, status: 'failed', reason: 'DESTINATION_COLLISION' };
  }
  if (expected.expectedSponsorAddress && observed.feePayer !== expected.expectedSponsorAddress) {
    return { valid: false, status: 'failed', reason: 'SPONSOR_MISMATCH' };
  }

  // Do not trust `role` labels from a provider. Determine the two semantic legs
  // exclusively from the immutable payment snapshot (destination, asset,
  // mint/program/decimals and exact amount).
  const merchantTransfer = observed.transfers.find((transfer) =>
    transferMatches(transfer, expected, expected.merchantDestination, expected.merchantSettlementAtomic),
  );
  if (!merchantTransfer) return { valid: false, status: 'wrong_recipient', reason: 'MERCHANT_TRANSFER_MISMATCH' };

  const feeTransfer = observed.transfers.find((transfer) =>
    transferMatches(transfer, expected, expected.feeDestination, expected.gatewayFeeAtomic),
  );
  if (!feeTransfer) return { valid: false, status: 'failed', reason: 'FEE_TRANSFER_MISMATCH' };

  if (expected.asset !== 'SOL') {
    if (!merchantTransfer.destinationAuthority || !feeTransfer.destinationAuthority) {
      return { valid: false, status: 'failed', reason: 'TOKEN_ACCOUNT_MISMATCH' };
    }
  }

  // Both value legs must be authorized by the same payer. For SPL tokens,
  // source is a token account while sourceAuthority is the instruction
  // authority/delegate normalized by the provider.
  if (!merchantTransfer.sourceAuthority || !feeTransfer.sourceAuthority || merchantTransfer.sourceAuthority !== feeTransfer.sourceAuthority) {
    return { valid: false, status: 'failed', reason: 'SENDER_MISMATCH' };
  }

  return { valid: true, status: 'confirmed', reason: 'OK' };
}
