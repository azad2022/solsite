/**
 * Deterministic payment-verification rules.
 *
 * Provider adapters normalize observations; this policy matches value legs against
 * the immutable payment snapshot and never trusts provider-assigned transfer roles.
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
  slot?: number | null;
  blockTime?: string | null;
  networkFeeLamports?: string | null;
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
    | 'UNDERPAID'
    | 'OVERPAID'
    | 'AMBIGUOUS_TRANSFER'
    | 'AMBIGUOUS_CANDIDATE'
    | 'TOKEN_ACCOUNT_MISMATCH'
    | 'DESTINATION_COLLISION'
    | 'SENDER_MISMATCH'
    | 'SPONSOR_MISMATCH'
    | 'DUPLICATE_SIGNATURE'
    | 'MISSING_SIGNATURE';
}

function transferMatches(transfer: ObservedTransfer, expected: ExpectedPayment, destination: string, amountAtomic: string): boolean {
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

function transferMatchesTarget(transfer: ObservedTransfer, expected: ExpectedPayment, destination: string): boolean {
  if (transfer.destination !== transfer.destination.trim()) return false;
  if (transfer.asset !== expected.asset || transfer.destination !== destination) return false;
  if (expected.asset === 'SOL') {
    return transfer.tokenMint === null && transfer.tokenProgram === null && transfer.tokenDecimals === null;
  }
  return transfer.tokenMint === expected.tokenMint
    && transfer.tokenProgram === expected.tokenProgram
    && transfer.tokenDecimals === expected.tokenDecimals
    && transfer.destinationAuthority === destination;
}

function classifyAmount(actual: bigint, expected: bigint): 'underpaid' | 'overpaid' | 'exact' {
  if (actual < expected) return 'underpaid';
  if (actual > expected) return 'overpaid';
  return 'exact';
}

export function verifyPaymentTransaction(expected: ExpectedPayment, observed: ObservedPaymentTransaction, duplicateSignature = false): VerificationResult {
  if (!observed.signature) return { valid: false, status: 'failed', reason: 'MISSING_SIGNATURE' };
  if (duplicateSignature) return { valid: false, status: 'duplicate', reason: 'DUPLICATE_SIGNATURE' };
  if (!observed.success) return { valid: false, status: 'failed', reason: 'TRANSACTION_FAILED' };
  if (expected.requiredCommitment === 'finalized' && observed.commitment !== 'finalized') return { valid: false, status: 'verifying', reason: 'COMMITMENT_TOO_LOW' };
  if (!observed.referenceMatched) return { valid: false, status: 'wrong_recipient', reason: 'REFERENCE_MISMATCH' };
  if (expected.merchantDestination === expected.feeDestination) return { valid: false, status: 'failed', reason: 'DESTINATION_COLLISION' };
  if (expected.expectedSponsorAddress && observed.feePayer !== expected.expectedSponsorAddress) return { valid: false, status: 'failed', reason: 'SPONSOR_MISMATCH' };

  const merchantMatches = observed.transfers.filter((transfer) => transferMatches(transfer, expected, expected.merchantDestination, expected.merchantSettlementAtomic));
  const merchantTargets = observed.transfers.filter((transfer) => transferMatchesTarget(transfer, expected, expected.merchantDestination));
  const feeMatches = observed.transfers.filter((transfer) => transferMatches(transfer, expected, expected.feeDestination, expected.gatewayFeeAtomic));
  const feeTargets = observed.transfers.filter((transfer) => transferMatchesTarget(transfer, expected, expected.feeDestination));

  if (merchantMatches.length > 1 || feeMatches.length > 1 || merchantTargets.length > 1 || feeTargets.length > 1) {
    return { valid: false, status: 'failed', reason: 'AMBIGUOUS_TRANSFER' };
  }

  if (merchantMatches.length === 1 && feeMatches.length === 1) {
    const merchantTransfer = merchantMatches[0];
    const feeTransfer = feeMatches[0];
    if (expected.asset !== 'SOL' && (!merchantTransfer.destinationAuthority || !feeTransfer.destinationAuthority)) {
      return { valid: false, status: 'failed', reason: 'TOKEN_ACCOUNT_MISMATCH' };
    }
    if (!merchantTransfer.sourceAuthority || !feeTransfer.sourceAuthority || merchantTransfer.sourceAuthority !== feeTransfer.sourceAuthority) {
      return { valid: false, status: 'failed', reason: 'SENDER_MISMATCH' };
    }
    return { valid: true, status: 'confirmed', reason: 'OK' };
  }

  if (merchantTargets.length === 1) {
    const merchantAmount = BigInt(merchantTargets[0].amountAtomic);
    const merchantClass = classifyAmount(merchantAmount, BigInt(expected.merchantSettlementAtomic));
    if (merchantClass === 'underpaid') return { valid: false, status: 'underpaid', reason: 'UNDERPAID' };
    if (merchantClass === 'overpaid') return { valid: false, status: 'overpaid', reason: 'OVERPAID' };

    if (feeTargets.length === 0) {
      return { valid: false, status: 'underpaid', reason: 'UNDERPAID' };
    }
  } else {
    return { valid: false, status: 'wrong_recipient', reason: 'MERCHANT_TRANSFER_MISMATCH' };
  }

  if (feeTargets.length === 1) {
    const feeAmount = BigInt(feeTargets[0].amountAtomic);
    const feeClass = classifyAmount(feeAmount, BigInt(expected.gatewayFeeAtomic));
    if (feeClass === 'underpaid') return { valid: false, status: 'underpaid', reason: 'UNDERPAID' };
    if (feeClass === 'overpaid') return { valid: false, status: 'overpaid', reason: 'OVERPAID' };
  }

  return { valid: false, status: 'failed', reason: 'FEE_TRANSFER_MISMATCH' };
}
