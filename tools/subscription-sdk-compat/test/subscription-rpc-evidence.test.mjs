import assert from 'node:assert/strict';
import { createHash, createPrivateKey, sign as signEd25519 } from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import test from 'node:test';
import {
  AMOUNT,
  GENESIS,
  makeFixture,
  makeProgramDataAttestation,
  base58Encode,
  PROGRAM,
} from './helpers/subscription-rpc-fixture.mjs';
import { normalizeSubscriptionGetTransactionResponse } from '../dist/subscription-rpc-evidence.js';
import { verifySubscriptionTransferTransaction } from '../dist/subscription-transaction-verifier.js';
function normalize(fixture) {
  return normalizeSubscriptionGetTransactionResponse(fixture.rawResponse, fixture.provenance);
}

test('normalizes a real signed legacy message and verifies the complete transaction evidence pipeline', () => {
  const fixture = makeFixture();
  const normalized = normalize(fixture);

  assert.equal(normalized.outcome, 'normalized');
  assert.equal(normalized.evidence.commitment, 'finalized');
  assert.equal(normalized.evidence.transactionVersion, 'legacy');
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
  assert.equal(verified.feePayer, fixture.expected.merchantFeePayer);
  assert.notEqual(verified.feePayer, verified.puller);
  assert.equal(verified.rpcProviderId, 'helius-devnet-tests');
});

test('resolves v0 address-table accounts and verifies against the loaded destination index', () => {
  const fixture = makeFixture({ versioned: true });
  const normalized = normalize(fixture);

  assert.equal(normalized.outcome, 'normalized');
  assert.equal(normalized.evidence.transactionVersion, 0);
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
  body.result.version = 2;
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


function buildV1RpcFixture() {
  const feePayer = Keypair.generate();
  const program = new PublicKey(PROGRAM);
  const recentBlockhash = Keypair.generate().publicKey.toBytes();
  const computeUnitLimit = Buffer.alloc(4);
  computeUnitLimit.writeUInt32LE(200_000);
  const loadedAccountsDataSizeLimit = Buffer.alloc(4);
  loadedAccountsDataSizeLimit.writeUInt32LE(64 * 1024 * 1024);

  const messageBytes = Buffer.concat([
    Buffer.from([0x81, 1, 0, 1]), // version 1; one writable signer, one readonly unsigned program
    Buffer.from([12, 0, 0, 0]), // compute-unit limit + loaded-account-data-size config
    Buffer.from(recentBlockhash),
    Buffer.from([1, 2]), // one instruction, two static account keys
    Buffer.from(feePayer.publicKey.toBytes()),
    Buffer.from(program.toBytes()),
    computeUnitLimit,
    loadedAccountsDataSizeLimit,
    Buffer.from([1, 0, 1, 0]), // program id index, zero accounts, one data byte
    Buffer.from([7]),
  ]);

  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from(feePayer.secretKey.subarray(0, 32)),
    ]),
    format: 'der',
    type: 'pkcs8',
  });
  const signatureBytes = signEd25519(null, messageBytes, privateKey);
  const signature = base58Encode(signatureBytes);
  const wire = Buffer.concat([messageBytes, signatureBytes]);
  const rawResponse = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: {
      blockTime: 1_800_000_001,
      meta: {
        err: null,
        fee: 5000,
        innerInstructions: [],
        preTokenBalances: [],
        postTokenBalances: [],
      },
      slot: 500,
      transaction: [wire.toString('base64'), 'base64'],
      version: 1,
    },
  });
  return {
    rawResponse,
    messageHash: createHash('sha256').update(messageBytes).digest('hex'),
    signature,
    feePayer: feePayer.publicKey.toBase58(),
    provenance: {
      requestedCommitment: 'finalized',
      clusterGenesisHash: GENESIS,
      providerId: 'helius-devnet-tests',
      requestId: 1,
      programDeployment: makeProgramDataAttestation(500n),
    },
  };
}

test('normalizes and verifies Ed25519 signature over exact Solana v1 message bytes', () => {
  const fixture = buildV1RpcFixture();
  const normalized = normalizeSubscriptionGetTransactionResponse(
    fixture.rawResponse,
    fixture.provenance,
  );

  assert.equal(normalized.outcome, 'normalized');
  assert.equal(normalized.evidence.transactionVersion, 1);
  assert.equal(normalized.evidence.signature, fixture.signature);
  assert.equal(normalized.evidence.messageHash, fixture.messageHash);
  assert.equal(normalized.evidence.feePayer, fixture.feePayer);
  assert.equal(normalized.evidence.feePayerIsSigner, true);
  assert.equal(normalized.evidence.feePayerIsWritable, true);
  assert.equal(normalized.evidence.topLevelInstructions.length, 1);
  assert.equal(normalized.evidence.topLevelInstructions[0].programAddress, PROGRAM);
  assert.deepEqual([...normalized.evidence.topLevelInstructions[0].data], [7]);
});

test('rejects a modified Ed25519 signature on a Solana v1 transaction', () => {
  const fixture = buildV1RpcFixture();
  const body = JSON.parse(fixture.rawResponse);
  const wire = Buffer.from(body.result.transaction[0], 'base64');
  wire[wire.length - 1] ^= 0x01;
  body.result.transaction = [wire.toString('base64'), 'base64'];

  const normalized = normalizeSubscriptionGetTransactionResponse(
    JSON.stringify(body),
    fixture.provenance,
  );
  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /SIGNATURE/);
});

test('fails closed on unsupported future Solana transaction versions', () => {
  const fixture = buildV1RpcFixture();
  const body = JSON.parse(fixture.rawResponse);
  const wire = Buffer.from(body.result.transaction[0], 'base64');
  wire[0] = 0x82;
  body.result.transaction = [wire.toString('base64'), 'base64'];
  body.result.version = 2;

  const normalized = normalizeSubscriptionGetTransactionResponse(
    JSON.stringify(body),
    fixture.provenance,
  );
  assert.equal(normalized.outcome, 'unknown');
  assert.match(normalized.reasons.join(' '), /RPC_TRANSACTION_VERSION_UNSUPPORTED/);
});
