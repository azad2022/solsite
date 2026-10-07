import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  canonicalizePayoutItems,
  parseAtomicAmount,
  parseDisplayAmountAtomic,
  totalAtomic,
  verifyPayoutObservation,
  buildPayoutTransaction,
  type PayoutBatchSnapshot,
} from '../src/pay/services/payoutPolicy';

test('Bulk Pay amount parsing stays exact and integer based', () => {
  assert.equal(parseDisplayAmountAtomic('1.2500', 6), '1250000');
  assert.equal(parseDisplayAmountAtomic('0.000001', 6), '1');
  assert.equal(parseAtomicAmount('1000000000000000000000000000000000000000000000'), '1000000000000000000000000000000000000000000000');
  assert.equal(totalAtomic([{ recipient: Keypair.generate().publicKey.toBase58(), amountAtomic: '10' }, { recipient: Keypair.generate().publicKey.toBase58(), amountAtomic: '7' }]), '17');
  assert.throws(() => parseDisplayAmountAtomic('1.0000001', 6), /TOO_MANY_DECIMALS/);
  assert.throws(() => parseAtomicAmount('0'), /INVALID_ATOMIC_AMOUNT/);
});

test('Bulk Pay recipient canonicalization validates real Solana public keys', () => {
  const address = Keypair.generate().publicKey.toBase58();
  const items = canonicalizePayoutItems([{ recipient: address, amountAtomic: '3' }]);
  assert.equal(items[0].recipient, new PublicKey(address).toBase58());
  assert.throws(() => canonicalizePayoutItems([{ recipient: 'not-a-wallet', amountAtomic: '3' }]));
});

function makeBatch(items: PayoutBatchSnapshot['items']): PayoutBatchSnapshot {
  return {
    id: Keypair.generate().publicKey.toBase58(),
    merchantId: Keypair.generate().publicKey.toBase58(),
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    sourceWalletAddress: Keypair.generate().publicKey.toBase58(),
    totalAmountAtomic: totalAtomic(items),
    itemCount: items.length,
    items,
    verificationCommitment: 'finalized',
  };
}

test('Bulk Pay verification matches duplicate recipient lines by multiset, not Set cardinality', () => {
  const source = Keypair.generate().publicKey.toBase58();
  const recipient = Keypair.generate().publicKey.toBase58();
  const batch = { ...makeBatch([{ recipient, amountAtomic: '5' }, { recipient, amountAtomic: '5' }]), sourceWalletAddress: source };
  const observation = {
    signature: '5'.repeat(80),
    slot: 1,
    blockTime: new Date().toISOString(),
    networkFeeLamports: '5000',
    success: true,
    commitment: 'finalized' as const,
    feePayer: source,
    referenceMatched: false,
    transfers: [
      { role: 'other' as const, source, sourceAuthority: source, destination: recipient, destinationAuthority: recipient, asset: 'SOL' as const, tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic: '5', instructionIndex: 1 },
      { role: 'other' as const, source, sourceAuthority: source, destination: recipient, destinationAuthority: recipient, asset: 'SOL' as const, tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic: '5', instructionIndex: 2 },
    ],
  };
  assert.deepEqual(verifyPayoutObservation(batch, observation), { status: 'completed', reason: 'OK' });
});

test('Bulk Pay verification rejects unexpected destination and amount', () => {
  const source = Keypair.generate().publicKey.toBase58();
  const expectedRecipient = Keypair.generate().publicKey.toBase58();
  const wrongRecipient = Keypair.generate().publicKey.toBase58();
  const batch = { ...makeBatch([{ recipient: expectedRecipient, amountAtomic: '5' }]), sourceWalletAddress: source };
  const base = {
    signature: '6'.repeat(80),
    slot: 1,
    blockTime: new Date().toISOString(),
    networkFeeLamports: '5000',
    success: true,
    commitment: 'finalized' as const,
    feePayer: source,
    referenceMatched: false,
  };
  assert.equal(verifyPayoutObservation(batch, {
    ...base,
    transfers: [{ role: 'other', source, sourceAuthority: source, destination: wrongRecipient, destinationAuthority: wrongRecipient, asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic: '5', instructionIndex: 1 }],
  }).reason, 'EXTRA_TRANSFER');
  assert.equal(verifyPayoutObservation(batch, {
    ...base,
    transfers: [{ role: 'other', source, sourceAuthority: source, destination: expectedRecipient, destinationAuthority: expectedRecipient, asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic: '6', instructionIndex: 1 }],
  }).reason, 'AMOUNT_MISMATCH');
});


test('Bulk Pay rejects numeric display amounts so floating-point values cannot enter financial math', () => {
  assert.throws(() => parseDisplayAmountAtomic(1.25, 2), /INVALID_AMOUNT/);
});

test('Bulk Pay transaction builder fails closed on snapshot item-count and total mismatches', async () => {
  const source = Keypair.generate();
  const recipient = Keypair.generate().publicKey.toBase58();
  const base = {
    ...makeBatch([{ recipient, amountAtomic:'5' }]),
    sourceWalletAddress: source.publicKey.toBase58(),
  };
  await assert.rejects(
    () => buildPayoutTransaction({ ...base, itemCount:2 }, source.publicKey, null as never),
    /PAYOUT_SNAPSHOT_ITEM_COUNT_MISMATCH/,
  );
  await assert.rejects(
    () => buildPayoutTransaction({ ...base, totalAmountAtomic:'6' }, source.publicKey, null as never),
    /PAYOUT_SNAPSHOT_TOTAL_MISMATCH/,
  );
});
