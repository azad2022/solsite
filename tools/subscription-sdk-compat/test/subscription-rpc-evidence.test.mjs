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

const PROGRAM = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const SOURCE_COMMIT = '364a41976c33347d092902443bbec2def9227e75';
const ELF_SHA256 = 'a'.repeat(64);
const AMOUNT = 250n;

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

function key() {
  return Keypair.generate().publicKey;
}

function addressIndex(accountKeys, address) {
  const index = accountKeys.findIndex(candidate => candidate.equals(address));
  assert.notEqual(index, -1, 'fixture account must resolve in the compiled message');
  return index;
}

function makeFixture({ versioned = false } = {}) {
  const feePayer = Keypair.generate();
  const caller = Keypair.generate();
  const subscriber = key();
  const subscription = key();
  const plan = key();
  const authority = key();
  const sourceAta = key();
  const destinationAta = key();
  const mint = key();
  const eventAuthority = key();
  const program = new PublicKey(PROGRAM);
  const tokenProgram = new PublicKey(TOKEN);
  const recentBlockhash = key().toBase58();

  const fixedAccounts = [
    { pubkey: subscription, isSigner: false, isWritable: true },
    { pubkey: plan, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: sourceAta, isSigner: false, isWritable: true },
    { pubkey: destinationAta, isSigner: false, isWritable: true },
    { pubkey: caller.publicKey, isSigner: true, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: program, isSigner: false, isWritable: false },
  ];
  const instructionData = new Uint8Array(73);
  instructionData[0] = 10;
  new DataView(instructionData.buffer).setBigUint64(1, AMOUNT, true);
  instructionData.set(subscriber.toBytes(), 9);
  instructionData.set(mint.toBytes(), 41);
  const instruction = new TransactionInstruction({
    programId: program,
    keys: fixedAccounts,
    data: Buffer.from(instructionData),
  });

  const tokenData = new Uint8Array(10);
  tokenData[0] = 12;
  new DataView(tokenData.buffer).setBigUint64(1, AMOUNT, true);
  tokenData[9] = 6;
  const eventData = new Uint8Array(265);
  eventData.set([228, 69, 165, 46, 81, 203, 154, 29], 0);
  eventData[8] = 2;

  let transaction;
  let message;
  let staticKeys;
  let loadedAddresses = { writable: [], readonly: [] };

  if (versioned) {
    const lookupTable = new AddressLookupTableAccount({
      key: key(),
      state: {
        deactivationSlot: BigInt('18446744073709551615'),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        authority: undefined,
        addresses: [destinationAta],
      },
    });
    message = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash,
      instructions: [instruction],
    }).compileToV0Message([lookupTable]);
    transaction = new VersionedTransaction(message);
    transaction.sign([feePayer, caller]);
    staticKeys = message.staticAccountKeys;
    loadedAddresses = { writable: [destinationAta.toBase58()], readonly: [] };
  } else {
    transaction = new Transaction({
      feePayer: feePayer.publicKey,
      recentBlockhash,
    }).add(instruction);
    transaction.sign(feePayer, caller);
    message = transaction.compileMessage();
    staticKeys = message.accountKeys;
  }

  const accountKeys = [
    ...staticKeys,
    ...loadedAddresses.writable.map(value => new PublicKey(value)),
    ...loadedAddresses.readonly.map(value => new PublicKey(value)),
  ];
  const index = address => addressIndex(accountKeys, address);
  const sourceIndex = index(sourceAta);
  const destinationIndex = index(destinationAta);
  const tokenProgramIndex = index(tokenProgram);
  const programIndex = index(program);
  const eventAuthorityIndex = index(eventAuthority);

  const innerInstructions = [{
    index: 0,
    instructions: [
      {
        programIdIndex: tokenProgramIndex,
        accounts: [index(sourceAta), index(mint), index(destinationAta), index(authority)],
        data: base58Encode(tokenData),
        stackHeight: 2,
      },
      {
        programIdIndex: programIndex,
        accounts: [eventAuthorityIndex],
        data: base58Encode(eventData),
        stackHeight: 2,
      },
    ],
  }];

  const tokenBalance = (accountIndex, owner, amount) => ({
    accountIndex,
    mint: mint.toBase58(),
    owner: owner.toBase58(),
    programId: TOKEN,
    uiTokenAmount: { amount: String(amount), decimals: 6, uiAmount: null, uiAmountString: '0' },
  });
  const meta = {
    err: null,
    fee: 5000,
    loadedAddresses,
    innerInstructions,
    preTokenBalances: [
      tokenBalance(sourceIndex, subscriber, 1000n),
      tokenBalance(destinationIndex, caller.publicKey, 1n),
    ],
    postTokenBalances: [
      tokenBalance(sourceIndex, subscriber, 750n),
      tokenBalance(destinationIndex, caller.publicKey, 251n),
    ],
  };

  const wire = transaction.serialize();
  const rpcResponse = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: {
      blockTime: 1_800_000_001,
      meta,
      slot: 500,
      transaction: [wire.toString('base64'), 'base64'],
      version: versioned ? 0 : 'legacy',
    },
  });
  const provenance = {
    requestedCommitment: 'finalized',
    clusterGenesisHash: GENESIS,
    providerId: 'helius-devnet-tests',
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
  return {
    rpcResponse,
    provenance,
    messageBytes: message.serialize(),
    expectedSignature: transaction.signatures[0].signature
      ? base58Encode(transaction.signatures[0].signature)
      : base58Encode(transaction.signatures[0]),
    destinationIndex,
    accountKeys: accountKeys.map(value => value.toBase58()),
  };
}

test('normalizes a real serialized legacy transaction and preserves raw RPC provenance', () => {
  const fixture = makeFixture();
  const normalized = normalizeSubscriptionGetTransactionResponse(fixture.rpcResponse, fixture.provenance);

  assert.equal(normalized.outcome, 'normalized');
  assert.equal(normalized.evidence.commitment, 'finalized');
  assert.equal(normalized.evidence.signature, fixture.expectedSignature);
  assert.equal(
    normalized.evidence.messageHash,
    createHash('sha256').update(Buffer.from(fixture.messageBytes)).digest('hex'),
  );
  assert.equal(normalized.evidence.rpcProviderId, 'helius-devnet-tests');
  assert.equal(normalized.evidence.rpcResponseHash, createHash('sha256').update(fixture.rpcResponse).digest('hex'));
  assert.equal(normalized.evidence.feePayerIsSigner, true);
  assert.equal(normalized.evidence.feePayerIsWritable, true);
  assert.equal(normalized.evidence.slot, 500n);
  assert.equal(normalized.evidence.innerInstructions.get(0).length, 2);
  assert.equal(normalized.evidence.innerInstructions.get(0)[0].stackHeight, 2);
  assert.equal(normalized.evidence.preTokenBalances[0].amountAtomic, '1000');
});

test('resolves v0 address-table accounts in the exact static + writable + readonly order', () => {
  const fixture = makeFixture({ versioned: true });
  const normalized = normalizeSubscriptionGetTransactionResponse(fixture.rpcResponse, fixture.provenance);

  assert.equal(normalized.outcome, 'normalized');
  assert.equal(normalized.evidence.accountKeys[fixture.destinationIndex], fixture.accountKeys[fixture.destinationIndex]);
  assert.equal(normalized.evidence.accountKeys.at(-1), fixture.accountKeys.at(-1));
  const instruction = normalized.evidence.topLevelInstructions[0];
  const destinationMeta = instruction.accounts.find(account => account.address === fixture.accountKeys[fixture.destinationIndex]);
  assert.equal(destinationMeta.isWritable, true);
  assert.equal(normalized.evidence.signature, fixture.expectedSignature);
});

test('returns UNKNOWN when address-table resolution evidence is absent', () => {
  const fixture = makeFixture({ versioned: true });
  const body = JSON.parse(fixture.rpcResponse);
  body.result.meta.loadedAddresses = null;
  const normalized = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);

  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /LOADED_ADDRESSES_MISSING/);
});

test('returns UNKNOWN when token balance ownership provenance is missing', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rpcResponse);
  delete body.result.meta.preTokenBalances[0].owner;
  const normalized = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);

  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /TOKEN_BALANCE_PROVENANCE_INVALID/);
});

test('returns UNKNOWN for unsupported wire transaction versions and malformed base64', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rpcResponse);
  body.result.version = 1;
  const versionMismatch = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);
  assert.equal(versionMismatch.outcome, 'unknown');

  body.result.transaction = ['not-base64!', 'base64'];
  const malformed = normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance);
  assert.equal(malformed.outcome, 'unknown');
});

test('returns UNKNOWN when RPC execution metadata is missing or the transaction is not found', () => {
  const fixture = makeFixture();
  const body = JSON.parse(fixture.rpcResponse);
  delete body.result.meta.err;
  assert.equal(normalizeSubscriptionGetTransactionResponse(JSON.stringify(body), fixture.provenance).outcome, 'unknown');

  const notFound = JSON.stringify({ jsonrpc: '2.0', id: 1, result: null });
  assert.equal(normalizeSubscriptionGetTransactionResponse(notFound, fixture.provenance).outcome, 'unknown');
});
