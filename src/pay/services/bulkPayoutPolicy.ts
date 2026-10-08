import type { ObservedPaymentTransaction, ObservedTransfer } from './verificationPolicy';
import type { PaymentAsset, TokenProgram } from '../types/domain';

export interface BulkPayoutVerificationItem {
  recipient: string;
  amountAtomic: string;
}

export interface BulkPayoutVerificationBatch {
  sourceWalletAddress: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  tokenDecimals: number | null;
  totalAmountAtomic: string;
  itemCount: number;
  verificationCommitment: 'finalized';
  items: readonly BulkPayoutVerificationItem[];
}

export type BulkPayoutFailureReason =
  | 'MISSING_SIGNATURE'
  | 'TRANSACTION_FAILED'
  | 'COMMITMENT_TOO_LOW'
  | 'SOURCE_MISMATCH'
  | 'TRANSFER_MISMATCH'
  | 'AMBIGUOUS_TRANSFER'
  | 'ITEM_COUNT_MISMATCH';

export interface BulkPayoutVerificationResult {
  valid: boolean;
  reason: BulkPayoutFailureReason | 'OK';
  matchedItemCount: number;
  observedSupportedTransferCount: number;
  observedTotalAtomic: string;
}

function assetFieldsMatch(batch: BulkPayoutVerificationBatch, transfer: ObservedTransfer): boolean {
  if (transfer.asset !== batch.asset) return false;
  if (batch.asset === 'SOL') return transfer.tokenMint === null && transfer.tokenProgram === null && transfer.tokenDecimals === null;
  return transfer.tokenMint === batch.tokenMint
    && transfer.tokenProgram === batch.tokenProgram
    && transfer.tokenDecimals === batch.tokenDecimals
    && Boolean(transfer.destinationAuthority);
}

function itemMatches(batch: BulkPayoutVerificationBatch, item: BulkPayoutVerificationItem, transfer: ObservedTransfer): boolean {
  if (!assetFieldsMatch(batch, transfer) || transfer.sourceAuthority !== batch.sourceWalletAddress || transfer.amountAtomic !== item.amountAtomic) return false;
  if (batch.asset === 'SOL') return transfer.destination === item.recipient;
  return transfer.destinationAuthority === item.recipient;
}

export function verifyBulkPayoutTransaction(
  batch: BulkPayoutVerificationBatch,
  observed: ObservedPaymentTransaction,
): BulkPayoutVerificationResult {
  if (!observed.signature) return { valid:false,reason:'MISSING_SIGNATURE',matchedItemCount:0,observedSupportedTransferCount:0,observedTotalAtomic:'0' };
  if (!observed.success) return { valid:false,reason:'TRANSACTION_FAILED',matchedItemCount:0,observedSupportedTransferCount:observed.transfers.length,observedTotalAtomic:'0' };
  if (observed.commitment !== batch.verificationCommitment) return { valid:false,reason:'COMMITMENT_TOO_LOW',matchedItemCount:0,observedSupportedTransferCount:observed.transfers.length,observedTotalAtomic:'0' };
  if (observed.feePayer !== batch.sourceWalletAddress) return { valid:false,reason:'SOURCE_MISMATCH',matchedItemCount:0,observedSupportedTransferCount:observed.transfers.length,observedTotalAtomic:'0' };

  const supported = observed.transfers.filter(t => assetFieldsMatch(batch,t));
  const used = new Set<number>();
  let matched = 0;
  let observedTotal = 0n;

  for (const item of batch.items) {
    const candidates = supported
      .map((transfer,index)=>({transfer,index}))
      .filter(({transfer,index})=>!used.has(index) && itemMatches(batch,item,transfer));

    if (candidates.length !== 1) {
      return {
        valid:false,
        reason:candidates.length > 1 ? 'AMBIGUOUS_TRANSFER' : 'TRANSFER_MISMATCH',
        matchedItemCount:matched,
        observedSupportedTransferCount:supported.length,
        observedTotalAtomic:observedTotal.toString()
      };
    }
    const match = candidates[0];
    used.add(match.index);
    matched += 1;
    observedTotal += BigInt(match.transfer.amountAtomic);
  }

  if (matched !== batch.itemCount || supported.length !== batch.itemCount) {
    return { valid:false,reason:'ITEM_COUNT_MISMATCH',matchedItemCount:matched,observedSupportedTransferCount:supported.length,observedTotalAtomic:observedTotal.toString() };
  }
  if (observedTotal !== BigInt(batch.totalAmountAtomic)) {
    return { valid:false,reason:'TRANSFER_MISMATCH',matchedItemCount:matched,observedSupportedTransferCount:supported.length,observedTotalAtomic:observedTotal.toString() };
  }

  return { valid:true,reason:'OK',matchedItemCount:matched,observedSupportedTransferCount:supported.length,observedTotalAtomic:observedTotal.toString() };
}
