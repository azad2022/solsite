import { PublicKey, Connection, SystemProgram, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import type { PaymentAsset, TokenProgram } from '../types/domain';

export interface BulkPayoutTransactionItem {
  recipient: string;
  amountAtomic: string;
}

export interface BulkPayoutTransactionBatch {
  sourceWalletAddress: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  tokenDecimals: number | null;
  totalAmountAtomic: string;
  itemCount: number;
}

function asAtomic(value: string): bigint {
  if (!/^[0-9]+$/.test(value)) throw new Error('INVALID_ATOMIC_AMOUNT');
  const amount = BigInt(value);
  if (amount <= 0n) throw new Error('INVALID_ATOMIC_AMOUNT');
  return amount;
}

function asSafeLamports(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('SOL_AMOUNT_TOO_LARGE');
  return Number(value);
}

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < value.length; offset += chunk) {
    binary += String.fromCharCode(...value.subarray(offset, Math.min(offset + chunk, value.length)));
  }
  return btoa(binary);
}

function ensureAddress(value: string): PublicKey {
  try { return new PublicKey(value); } catch { throw new Error('INVALID_RECIPIENT'); }
}

export function validateBulkPayoutSnapshot(batch: BulkPayoutTransactionBatch, items: readonly BulkPayoutTransactionItem[]): void {
  if (batch.itemCount !== items.length || items.length < 1 || items.length > 50) throw new Error('ITEM_COUNT_MISMATCH');
  const expected = asAtomic(batch.totalAmountAtomic);
  let total = 0n;
  for (const item of items) total += asAtomic(item.amountAtomic);
  if (total !== expected) throw new Error('TOTAL_AMOUNT_MISMATCH');
  if (batch.asset === 'SOL') {
    if (batch.tokenMint !== null || batch.tokenProgram !== null || batch.tokenDecimals !== null) throw new Error('TOKEN_FIELDS_INVALID');
  } else if (!batch.tokenMint || batch.tokenProgram !== 'spl-token' || batch.tokenDecimals === null || batch.tokenDecimals < 0 || batch.tokenDecimals > 255) {
    throw new Error('TOKEN_FIELDS_INVALID');
  }
  ensureAddress(batch.sourceWalletAddress);
  for (const item of items) ensureAddress(item.recipient);
}

export interface BuiltBulkPayoutTransaction {
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function buildBulkPayoutTransaction(
  batch: BulkPayoutTransactionBatch,
  items: readonly BulkPayoutTransactionItem[],
  connection: Connection,
): Promise<BuiltBulkPayoutTransaction> {
  validateBulkPayoutSnapshot(batch, items);
  const source = ensureAddress(batch.sourceWalletAddress);
  const latestBlockhash = await connection.getLatestBlockhash('finalized');
  const transaction = new Transaction({ feePayer: source, recentBlockhash: latestBlockhash.blockhash });

  if (batch.asset === 'SOL') {
    for (const item of items) {
      transaction.add(SystemProgram.transfer({
        fromPubkey: source,
        toPubkey: ensureAddress(item.recipient),
        lamports: asSafeLamports(asAtomic(item.amountAtomic)),
      }));
    }
  } else {
    const mint = ensureAddress(batch.tokenMint!);
    const sourceAta = getAssociatedTokenAddressSync(mint, source, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const sourceInfo = await connection.getAccountInfo(sourceAta, 'finalized');
    if (!sourceInfo) throw new Error('SOURCE_TOKEN_ACCOUNT_NOT_FOUND');

    for (const item of items) {
      const owner = ensureAddress(item.recipient);
      const destinationAta = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      transaction.add(createAssociatedTokenAccountIdempotentInstruction(
        source,
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
        source,
        asAtomic(item.amountAtomic),
        batch.tokenDecimals!,
        [],
        TOKEN_PROGRAM_ID,
      ));
    }
  }

  let serialized: Uint8Array;
  try {
    serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
  } catch (error) {
    throw new Error(error instanceof Error && /too large|Transaction too large|encoding/i.test(error.message) ? 'BATCH_TRANSACTION_TOO_LARGE' : 'TRANSACTION_SERIALIZATION_FAILED');
  }
  if (serialized.length > 1232) throw new Error('BATCH_TRANSACTION_TOO_LARGE');
  return {
    transaction: bytesToBase64(serialized),
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  };
}

