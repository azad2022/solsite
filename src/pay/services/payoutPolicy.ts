import { Buffer } from 'node:buffer';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import type { PaymentAsset, TokenProgram } from '../types/domain';
import type { ObservedPaymentTransaction, ObservedTransfer } from './verificationPolicy';

export const PAYOUT_MAX_ITEMS = 50;
export const SOLANA_LEGACY_TRANSACTION_MAX_BYTES = 1232;

export interface PayoutItemInput {
  recipient: string;
  amountAtomic: string;
}

export interface PayoutBatchSnapshot {
  id: string;
  merchantId: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  tokenDecimals: number | null;
  sourceWalletAddress: string;
  totalAmountAtomic: string;
  itemCount: number;
  items: readonly PayoutItemInput[];
  verificationCommitment: 'finalized';
}

export type PayoutVerificationResult =
  | { status: 'completed'; reason: 'OK' }
  | { status: 'failed'; reason:
      | 'MISSING_SIGNATURE'
      | 'COMMITMENT_TOO_LOW'
      | 'TRANSACTION_FAILED'
      | 'FEE_PAYER_MISMATCH'
      | 'MISSING_TRANSFER'
      | 'AMOUNT_MISMATCH'
      | 'DESTINATION_MISMATCH'
      | 'ASSET_MISMATCH'
      | 'TOKEN_METADATA_MISMATCH'
      | 'DUPLICATE_TRANSFER'
      | 'EXTRA_TRANSFER'
      | 'SOURCE_MISMATCH'
      | 'AMBIGUOUS_TRANSFER'
    };

function atomicPattern(value: string): boolean {
  return /^\d{1,78}$/.test(value) && BigInt(value) > 0n;
}

export function parseAtomicAmount(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!atomicPattern(normalized)) throw new Error('INVALID_ATOMIC_AMOUNT');
  return normalized;
}

export function parseDisplayAmountAtomic(value: unknown, decimals: number): string {
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!/^\d+(?:\.\d+)?$/.test(raw) || decimals < 0 || decimals > 255) throw new Error('INVALID_AMOUNT');
  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > decimals) throw new Error('TOO_MANY_DECIMALS');
  const atomic = BigInt(whole || '0') * (10n ** BigInt(decimals)) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (atomic <= 0n || atomic.toString().length > 78) throw new Error('INVALID_AMOUNT');
  return atomic.toString();
}

export function canonicalizePayoutItems(items: readonly PayoutItemInput[]): readonly PayoutItemInput[] {
  if (items.length < 1 || items.length > PAYOUT_MAX_ITEMS) throw new Error('INVALID_ITEM_COUNT');
  return items.map((item) => ({
    recipient: new PublicKey(item.recipient).toBase58(),
    amountAtomic: parseAtomicAmount(item.amountAtomic),
  }));
}

export function totalAtomic(items: readonly PayoutItemInput[]): string {
  const total = items.reduce((sum, item) => sum + BigInt(item.amountAtomic), 0n);
  if (total <= 0n || total.toString().length > 78) throw new Error('TOTAL_AMOUNT_INVALID');
  return total.toString();
}

function bytesToBase64(value: Uint8Array): string {
  return Buffer.from(value).toString('base64');
}

function serializedTransactionSize(transaction: Transaction): number {
  return transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
}

export async function buildPayoutTransaction(
  batch: PayoutBatchSnapshot,
  sourceWallet: PublicKey,
  connection: Connection,
): Promise<{ transaction: string; sizeBytes: number }> {
  if (sourceWallet.toBase58() !== batch.sourceWalletAddress) throw new Error('SOURCE_WALLET_MISMATCH');

  const transaction = new Transaction();
  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latest.blockhash;
  transaction.feePayer = sourceWallet;

  if (batch.asset === 'SOL') {
    for (const item of batch.items) {
      transaction.add(SystemProgram.transfer({
        fromPubkey: sourceWallet,
        toPubkey: new PublicKey(item.recipient),
        lamports: Number(BigInt(item.amountAtomic)),
      }));
    }
  } else {
    if (batch.tokenProgram !== 'spl-token' || !batch.tokenMint || batch.tokenDecimals === null) throw new Error('TOKEN_POLICY_UNSUPPORTED');

    const mint = new PublicKey(batch.tokenMint);
    const sourceAta = getAssociatedTokenAddressSync(
      mint,
      sourceWallet,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const sourceInfo = await connection.getAccountInfo(sourceAta, 'confirmed');
    if (!sourceInfo) throw new Error('SOURCE_TOKEN_ACCOUNT_NOT_FOUND');

    for (const item of batch.items) {
      const owner = new PublicKey(item.recipient);
      const destinationAta = getAssociatedTokenAddressSync(
        mint,
        owner,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      transaction.add(createAssociatedTokenAccountIdempotentInstruction(
        sourceWallet,
        destinationAta,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
      transaction.add(createTransferCheckedInstruction(
        sourceAta,
        mint,
        destinationAta,
        sourceWallet,
        BigInt(item.amountAtomic),
        batch.tokenDecimals,
        [],
        TOKEN_PROGRAM_ID,
      ));
    }
  }

  const sizeBytes = serializedTransactionSize(transaction);
  if (sizeBytes > SOLANA_LEGACY_TRANSACTION_MAX_BYTES) throw new Error('PAYOUT_TRANSACTION_TOO_LARGE');
  return { transaction: bytesToBase64(transaction.serialize({ requireAllSignatures: false, verifySignatures: false })), sizeBytes };
}

function transferKey(transfer: ObservedTransfer): string {
  return [
    transfer.sourceAuthority ?? transfer.source ?? '',
    transfer.destinationAuthority ?? transfer.destination,
    transfer.asset,
    transfer.tokenMint ?? '',
    transfer.tokenProgram ?? '',
    transfer.tokenDecimals === null ? '' : String(transfer.tokenDecimals),
    transfer.amountAtomic,
  ].join('|');
}

function payoutTransferMatches(batch: PayoutBatchSnapshot, transfer: ObservedTransfer, item: PayoutItemInput): boolean {
  if (transfer.sourceAuthority !== batch.sourceWalletAddress) return false;
  if (transfer.amountAtomic !== item.amountAtomic) return false;
  if (batch.asset === 'SOL') {
    return transfer.asset === 'SOL'
      && transfer.destination === item.recipient
      && transfer.tokenMint === null
      && transfer.tokenProgram === null
      && transfer.tokenDecimals === null;
  }
  return transfer.asset === batch.asset
    && transfer.destinationAuthority === item.recipient
    && transfer.tokenMint === batch.tokenMint
    && transfer.tokenProgram === batch.tokenProgram
    && transfer.tokenDecimals === batch.tokenDecimals;
}

export function verifyPayoutObservation(
  batch: PayoutBatchSnapshot,
  observation: ObservedPaymentTransaction,
): PayoutVerificationResult {
  if (!observation.signature) return { status: 'failed', reason: 'MISSING_SIGNATURE' };
  if (batch.verificationCommitment === 'finalized' && observation.commitment !== 'finalized') return { status: 'failed', reason: 'COMMITMENT_TOO_LOW' };
  if (!observation.success) return { status: 'failed', reason: 'TRANSACTION_FAILED' };
  if (observation.feePayer !== batch.sourceWalletAddress) return { status: 'failed', reason: 'FEE_PAYER_MISMATCH' };

  const expectedKeys = new Set(batch.items.map((item) => `${item.recipient}|${item.amountAtomic}`));
  const matchedKeys = new Set<string>();
  const candidateTransfers = observation.transfers.filter((transfer) => transfer.sourceAuthority === batch.sourceWalletAddress);

  for (const transfer of candidateTransfers) {
    const key = transferKey(transfer);
    const matchingItems = batch.items.filter((item) => payoutTransferMatches(batch, transfer, item));
    if (matchingItems.length > 1) return { status: 'failed', reason: 'AMBIGUOUS_TRANSFER' };
    if (matchingItems.length === 0) {
      if (batch.asset === 'SOL' && transfer.asset !== 'SOL') return { status: 'failed', reason: 'ASSET_MISMATCH' };
      if (batch.asset !== 'SOL' && (transfer.asset !== batch.asset || transfer.tokenMint !== batch.tokenMint || transfer.tokenProgram !== batch.tokenProgram || transfer.tokenDecimals !== batch.tokenDecimals)) {
        return { status: 'failed', reason: 'TOKEN_METADATA_MISMATCH' };
      }
      return { status: 'failed', reason: 'EXTRA_TRANSFER' };
    }
    const itemKey = `${matchingItems[0].recipient}|${matchingItems[0].amountAtomic}`;
    if (!expectedKeys.has(itemKey)) return { status: 'failed', reason: 'DESTINATION_MISMATCH' };
    if (matchedKeys.has(itemKey) || matchedKeys.has(key)) return { status: 'failed', reason: 'DUPLICATE_TRANSFER' };
    matchedKeys.add(itemKey);
  }

  if (matchedKeys.size !== expectedKeys.size) {
    const destinations = new Set(candidateTransfers.map((transfer) => batch.asset === 'SOL' ? transfer.destination : transfer.destinationAuthority));
    const expectedRecipients = new Set(batch.items.map((item) => item.recipient));
    if (candidateTransfers.length > batch.items.length) return { status: 'failed', reason: 'EXTRA_TRANSFER' };
    if ([...destinations].some((value) => value && !expectedRecipients.has(value))) return { status: 'failed', reason: 'DESTINATION_MISMATCH' };
    if ([...matchedKeys].some((value) => value)) {
      return { status: 'failed', reason: 'AMOUNT_MISMATCH' };
    }
    return { status: 'failed', reason: 'MISSING_TRANSFER' };
  }

  return { status: 'completed', reason: 'OK' };
}
