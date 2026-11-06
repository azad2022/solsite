import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { normalizeSubscriptionGetTransactionResponse } from '../dist/subscription-rpc-evidence.js';
import { verifySubscriptionTransferTransaction } from '../dist/subscription-transaction-verifier.js';

const PROGRAM = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const SOURCE_COMMIT = '364a41976c33347d092902443bbec2def9227e75';
const ELF_SHA256 = 'a'.repeat(64);
const AMOUNT = 250n;
const PERIOD_START = 1_800_000_000n;
const PERIOD_END = PERIOD_START + 2_592_000n;

function base58Encode(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = alphabet[remainder] + encoded;
    value /= 58n;
  }
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading += 1;
  return '1'.repeat(leading) + encoded;
}

function derivePda(seeds, programId = PROGRAM) {
  return PublicKey.findProgramAddressSync(
    seeds.map(seed => Buffer.from(seed)),
    new PublicKey(programId),
  )[0];
}

function makeFixture({ versioned = false } = {}) {
  const merchant = Keypair.generate();
  const subscriber = Keypair.generate();
  const mint = new PublicKey('So11111111111111111111111111111111111111112');

  const planIdBytes = Buffer.alloc(8);
  planIdBytes.writeBigUInt64LE(7_301_030n);
  const planPda = derivePda([Buffer.from('plan'), merchant.publicKey.toBuffer(), planIdBytes]);
  const subscriptionPda = derivePda([
    Buffer.from('subscription'),
    planPda.toBuffer(),
    subscriber.publicKey.toBuffer(),
  ]);
  const authorityPda = derivePda([
    Buffer.from('SubscriptionAuthority'),
    subscriber.publicKey.toBuffer(),
    mint.toBuffer(),
  ]);
  const sourceAta = derivePda([
    subscriber.publicKey.toBuffer(),
    new PublicKey(TOKEN).toBuffer(),
    mint.toBuffer(),
  ], ASSOCIATED_TOKEN);
  const destinationAta = derivePda([
    merchant.publicKey.toBuffer(),
    new PublicKey(TOKEN).toBuffer(),
    mint.toBuffer(),
  ], ASSOCIATED_TOKEN);
  const eventAuthority = derivePda([Buffer.from('event_authority')]);
  const program = new PublicKey(PROGRAM);
  const tokenProgram = new PublicKey(TOKEN);
  const recentBlockhash = Keypair.generate().publicKey.toBase58();

  const instructionData = new Uint8Array(73);
  instructionData[0] = 10;
  new DataView(instructionData.buffer).setBigUint64(1, AMOUNT, true);
  instructionData.set(subscriber.publicKey.toBytes(), 9);
  instructionData.set(mint.toBytes(), 41);

  const instruction = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: subscriptionPda, isSigner: false, isWritable: true },
      { pubkey: planPda, isSigner: false, isWritable: false },
      { pubkey: authorityPda, isSigner: false, isWritable: false },
      { pubkey: sourceAta, isSigner: false, isWritable: true },
      { pubkey: destinationAta, isSigner: false, isWritable: true },
      { pubkey: merchant.publicKey, isSigner: true, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: program, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(instructionData),
  });

  const tokenData = new Uint8Array(10);
  tokenData[0] = 12;
  new DataView(tokenData.buffer).setBigUint64(1, AMOUNT, true);
  tokenData[9] = 9;

  const eventData = new Uint8Array(265);
  eventData.set([228, 69, 165, 46, 81, 203, 154, 29], 0);
  eventData[8] = 2;
  const putAddress = (value, offset) => eventData.set(value.toBytes(), offset);
  putAddress(subscriptionPda, 9);
  putAddress(planPda, 41);
  putAddress(subscriber.publicKey, 73);
  putAddress(mint, 105);
  const eventView = new DataView(eventData.buffer);
  eventView.setBigUint64(137, AMOUNT, true);
  eventView.setBigInt64(145, PERIOD_START, true);
  eventView.setBigInt64(153, PERIOD_END, true);
  eventView.setBigUint64(161, AMOUNT, true);
  putAddress(merchant.publicKey, 169);
  putAddress(destinationAta, 201);
  putAddress(merchant.publicKey, 233);

  let transaction;
  let message;
  let staticKeys;
  let loadedAddresses = { writable: [], readonly: [] };

  if (versioned) {
    const lookupTable = new AddressLookupTableAccount({
      key: Keypair.generate().publicKey,
      state: {
        deactivationSlot: BigInt('18446744073709551615'),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        authority: undefined,
        addresses: [destinationAta],
      },
    });
    message = new TransactionMessage({
      payerKey: merchant.publicKey,
      recentBlockhash,
      instructions: [instruction],
    }).compileToV0Message([lookupTable]);
    transaction = new VersionedTransaction(message);
    transaction.sign([merchant]);
    staticKeys = message.staticAccountKeys;
    loadedAddresses = { writable: [destinationAta.toBase58()], readonly: [] };
  } else {
    transaction = new Transaction({
      feePayer: merchant.publicKey,
      recentBlockhash,
    }).add(instruction);
    transaction.sign(merchant);
    message = transaction.compileMessage();
    staticKeys = message.accountKeys;
  }

  const accountKeys = [
    ...staticKeys,
    ...loadedAddresses.writable.map(value => new PublicKey(value)),
    ...loadedAddresses.readonly.map(value => new PublicKey(value)),
  ];
  const index = address => {
    const found = accountKeys.findIndex(candidate => candidate.equals(address));
    assert.notEqual(found, -1, 'fixture account must resolve in the compiled message');
    return found;
  };

  const topLevel = message.compiledInstructions[0];
  const outerAccountIndexes = Array.from(
    'accountKeyIndexes' in topLevel ? topLevel.accountKeyIndexes : topLevel.accounts,
  );
  const outerProgramIndex = topLevel.programIdIndex;
  const innerInstructions = [{
    index: 0,
    instructions: [
      {
        programIdIndex: index(tokenProgram),
        accounts: [index(sourceAta), index(mint), index(destinationAta), index(authorityPda)],
        data: base58Encode(tokenData),
        stackHeight: 2,
      },
      {
        programIdIndex: outerProgramIndex,
        accounts: [index(eventAuthority)],
        data: base58Encode(eventData),
        stackHeight: 2,
      },
    ],
  }];

  const balance = (accountIndex, owner, amountAtomic) => ({
    accountIndex,
    mint: mint.toBase58(),
    owner: owner.toBase58(),
    programId: TOKEN,
    uiTokenAmount: { amount: String(amountAtomic), decimals: 9, uiAmount: null, uiAmountString: '0' },
  });
  const meta = {
    err: null,
    fee: 5000,
    loadedAddresses,
    innerInstructions,
    preTokenBalances: [
      balance(index(sourceAta), subscriber.publicKey, 1_000n),
      balance(index(destinationAta), merchant.publicKey, 10n),
    ],
    postTokenBalances: [
      balance(index(sourceAta), subscriber.publicKey, 750n),
      balance(index(destinationAta), merchant.publicKey, 260n),
    ],
  };

  const wire = transaction.serialize();
  const signatures = versioned ? transaction.signatures : transaction.signatures.map(entry => entry.signature);
  const firstSignature = signatures[0];
  assert.ok(firstSignature instanceof Uint8Array);
  const signature = base58Encode(firstSignature);
  const messageBytes = message.serialize();
  const messageHash = createHash('sha256').update(Buffer.from(messageBytes)).digest('hex');
  const rawResponse = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: {
      blockTime: 1_800_000_001,
      meta,
      slot: 500,
      transaction: [Buffer.from(wire).toString('base64'), 'base64'],
      version: versioned ? 0 : 'legacy',
    },
  });

  const provenance = {
    requestedCommitment: 'finalized',
    clusterGenesisHash: GENESIS,
    providerId: 'helius-devnet-tests',
    requestId: 1,
    programDeployment: {
      programAddress: PROGRAM,
      sourceCommit: SOURCE_COMMIT,
      elfSha256: ELF_SHA256,
      deploymentSlot: 400n,
      readAtSlot: 600n,
      readCommitment: 'finalized',
      attestationKind: 'current-finalized-programdata',
    },
  };

  const expected = {
    clusterGenesisHash: GENESIS,
    cycleId: 'cycle-devnet-normalizer-test',
    attemptId: 'attempt-devnet-normalizer-test',
    expectedSignature: signature,
    expectedMessageHash: messageHash,
    merchant: merchant.publicKey.toBase58(),
    merchantFeePayer: merchant.publicKey.toBase58(),
    subscriber: subscriber.publicKey.toBase58(),
    planPda: planPda.toBase58(),
    subscriptionPda: subscriptionPda.toBase58(),
    authorityPda: authorityPda.toBase58(),
    sourceAta: sourceAta.toBase58(),
    mint: mint.toBase58(),
    mintDecimals: 9,
    planOwner: merchant.publicKey.toBase58(),
    authorizedPullers: [],
    allowedDestinationOwners: [merchant.publicKey.toBase58()],
    expectedDestinationOwner: merchant.publicKey.toBase58(),
    expectedDestinationAta: destinationAta.toBase58(),
    expectedAmountAtomic: AMOUNT,
    expectedPeriodStartTs: PERIOD_START,
    expectedPeriodEndTs: PERIOD_END,
    expectedCumulativeAmountAtomic: AMOUNT,
    programSourceCommit: SOURCE_COMMIT,
    programElfSha256: ELF_SHA256,
  };

  return {
    rawResponse,
    provenance,
    expected,
    signature,
    messageHash,
    destinationAccountIndex: index(destinationAta),
    resolvedAccountKeys: accountKeys.map(value => value.toBase58()),
    outerAccountIndexes,
  };
}

function normalize(fixture) {
  return normalizeSubscriptionGetTransactionResponse(fixture.rawResponse, fixture.provenance);
}

test('normalizes a real signed legacy message and verifies the complete transaction evidence pipeline', () => {
  const fixture = makeFixture();
  const normalized = normalize(fixture);

  assert.equal(normalized.outcome, 'normalized');
  assert.equal(normalized.evidence.commitment, 'finalized');
  assert.equal(normalized.evidence.signature, fixture.signature);
  assert.equal(normalized.evidence.messageHash, fixture.messageHash);
  assert.equal(normalized.evidence.rpcProviderId, 'helius-devnet-tests');
  assert.equal(normalized.evidence.rpcResponseHash, createHash('sha256').update(fixture.rawResponse).digest('hex'));
  assert.equal(normalized.evidence.feePayerIsSigner, true);
  assert.equal(normalized.evidence.feePayerIsWritable, true);
  assert.equal(normalized.evidence.innerInstructions.get(0).length, 2);
  assert.equal(normalized.evidence.innerInstructions.get(0)[0].stackHeight, 2);

  const verified = verifySubscriptionTransferTransaction(fixture.expected, normalized.evidence);
  assert.equal(verified.outcome, 'verified_observation');
  assert.equal(verified.signature, fixture.signature);
  assert.equal(verified.messageHash, fixture.messageHash);
  assert.equal(verified.amountAtomic, AMOUNT);
  assert.equal(verified.rpcProviderId, 'helius-devnet-tests');
});

test('resolves v0 address-table accounts and verifies against the loaded destination index', () => {
  const fixture = makeFixture({ versioned: true });
  const normalized = normalize(fixture);

  assert.equal(normalized.outcome, 'normalized');
  assert.equal(normalized.evidence.accountKeys[fixture.destinationAccountIndex], fixture.resolvedAccountKeys[fixture.destinationAccountIndex]);
  assert.equal(normalized.evidence.accountKeys.at(-1), fixture.resolvedAccountKeys.at(-1));
  const verified = verifySubscriptionTransferTransaction(fixture.expected, normalized.evidence);
  assert.equal(verified.outcome, 'verified_observation');
  assert.equal(verified.destinationAta, fixture.expected.expectedDestinationAta);
});

test('returns UNKNOWN when address-table resolution evidence is absent', () => {
  const fixture = makeFixture({ versioned: true });
  const body = JSON.parse(fixture.rawResponse);
  body.result.meta.loadedAddresses = null;
  const normalized = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);

  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /LOADED_ADDRESSES_MISSING/);
});

test('returns UNKNOWN when token balance ownership provenance is missing', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rawResponse);
  delete body.result.meta.preTokenBalances[0].owner;
  const normalized = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);

  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /TOKEN_BALANCE_PROVENANCE_INVALID/);
});

test('returns UNKNOWN for unsupported wire transaction versions and malformed base64', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rawResponse);
  body.result.version = 1;
  const versionMismatch = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);
  assert.equal(versionMismatch.outcome, 'unknown');

  body.result.transaction = ['not-base64!', 'base64'];
  const malformed = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);
  assert.equal(malformed.outcome, 'unknown');
});

test('returns UNKNOWN when RPC execution metadata is missing or the transaction is not found', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rawResponse);
  delete body.result.meta.err;
  assert.equal(normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance).outcome, 'unknown');

  const notFound = JSON.stringify({ jsonrpc: '2.0', id: 1, result: null });
  assert.equal(normalizeSubscriptionGetTransactionResponse(notFound, fixture.provenance).outcome, 'unknown');
});

test('returns UNKNOWN when the JSON-RPC response id does not match the request', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rawResponse);
  body.id = 2;
  const normalized = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);
  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /request correlation/);
});

test('returns UNKNOWN when any serialized transaction signature is altered', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rawResponse);
  const wire = Buffer.from(body.result.transaction[0], 'base64');
  wire[1] ^= 0x01;
  body.result.transaction[0] = wire.toString('base64');
  const normalized = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);
  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /SIGNATURE/);
});
