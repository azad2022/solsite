import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { SUBSCRIPTIONS_PROGRAM_ADDRESS } from '@solana/subscriptions';
import {
  ORIGINAL_SPL_TOKEN_PROGRAM_ADDRESS,
  TRANSFER_SUBSCRIPTION_ACCOUNT_COUNT,
  TRANSFER_SUBSCRIPTION_DATA_LENGTH,
  TRANSFER_SUBSCRIPTION_DISCRIMINATOR,
  decodeTransferSubscriptionInstruction,
} from '../dist/transfer-subscription-instruction.js';

const keys = Array.from({ length: TRANSFER_SUBSCRIPTION_ACCOUNT_COUNT }, () =>
  Keypair.generate().publicKey.toBase58(),
);
keys[6] = Keypair.generate().publicKey.toBase58();
keys[7] = ORIGINAL_SPL_TOKEN_PROGRAM_ADDRESS;
keys[9] = SUBSCRIPTIONS_PROGRAM_ADDRESS;
const delegator = Keypair.generate().publicKey;
const mint = keys[6];

function instruction({
  programAddress = SUBSCRIPTIONS_PROGRAM_ADDRESS,
  data,
  accountAddresses = keys,
  amount = 9_007_199_254_740_993n,
  instructionMint = mint,
  discriminator = TRANSFER_SUBSCRIPTION_DISCRIMINATOR,
} = {}) {
  const bytes = data ?? new Uint8Array(TRANSFER_SUBSCRIPTION_DATA_LENGTH);
  if (!data) {
    const view = new DataView(bytes.buffer);
    bytes[0] = discriminator;
    view.setBigUint64(1, amount, true);
    bytes.set(delegator.toBytes(), 9);
    bytes.set(new (delegator.constructor)(instructionMint).toBytes(), 41);
  }
  return { programAddress, data: bytes, accountAddresses };
}

test('decodes the exact pinned TransferSubscription layout and preserves u64 precision', () => {
  const decoded = decodeTransferSubscriptionInstruction(instruction());

  assert.equal(decoded.discriminator, 10);
  assert.equal(decoded.amountAtomic, 9_007_199_254_740_993n);
  assert.equal(decoded.delegator, delegator.toBase58());
  assert.equal(decoded.mint, mint);
  assert.deepEqual(Object.keys(decoded.accounts), [
    'subscriptionPda',
    'planPda',
    'subscriptionAuthorityPda',
    'delegatorAta',
    'receiverAta',
    'caller',
    'tokenMint',
    'tokenProgram',
    'eventAuthority',
    'selfProgram',
  ]);
});

test('rejects a different Program ID and instruction discriminator', () => {
  assert.throws(
    () => decodeTransferSubscriptionInstruction(instruction({ programAddress: SystemProgram.programId.toBase58() })),
    /Unexpected Subscription Program ID/,
  );
  assert.throws(
    () => decodeTransferSubscriptionInstruction(instruction({ discriminator: 11 })),
    /discriminator/,
  );
});

test('rejects malformed or trailing instruction data', () => {
  const short = new Uint8Array(TRANSFER_SUBSCRIPTION_DATA_LENGTH - 1);
  const long = new Uint8Array(TRANSFER_SUBSCRIPTION_DATA_LENGTH + 1);
  assert.throws(() => decodeTransferSubscriptionInstruction(instruction({ data: short })), /exactly 73 bytes/);
  assert.throws(() => decodeTransferSubscriptionInstruction(instruction({ data: long })), /exactly 73 bytes/);
});

test('rejects zero amount and never converts atomic units to Number', () => {
  assert.throws(() => decodeTransferSubscriptionInstruction(instruction({ amount: 0n })), /greater than zero/);
  assert.equal(typeof decodeTransferSubscriptionInstruction(instruction()).amountAtomic, 'bigint');
});

test('rejects missing, extra and empty resolved account keys', () => {
  assert.throws(
    () => decodeTransferSubscriptionInstruction(instruction({ accountAddresses: keys.slice(0, -1) })),
    /exactly ten fixed accounts/,
  );
  assert.throws(
    () => decodeTransferSubscriptionInstruction(instruction({ accountAddresses: [...keys, keys[0]] })),
    /exactly ten fixed accounts/,
  );
  const empty = [...keys];
  empty[4] = '';
  assert.throws(() => decodeTransferSubscriptionInstruction(instruction({ accountAddresses: empty })), /non-empty address/);
});

test('rejects Token-2022 or any non-original token program in the fixed account list', () => {
  const wrongTokenProgram = [...keys];
  wrongTokenProgram[7] = SystemProgram.programId.toBase58();
  assert.throws(
    () => decodeTransferSubscriptionInstruction(instruction({ accountAddresses: wrongTokenProgram })),
    /original SPL Token Program/,
  );
});

test('rejects selfProgram and transferData mint mismatches', () => {
  const wrongSelfProgram = [...keys];
  wrongSelfProgram[9] = SystemProgram.programId.toBase58();
  assert.throws(
    () => decodeTransferSubscriptionInstruction(instruction({ accountAddresses: wrongSelfProgram })),
    /selfProgram account mismatch/,
  );

  const otherMint = Keypair.generate().publicKey.toBase58();
  assert.throws(
    () => decodeTransferSubscriptionInstruction(instruction({ instructionMint: otherMint })),
    /mint argument does not match/,
  );
});
