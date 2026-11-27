import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  UPGRADEABLE_LOADER_PROGRAM_ID,
  deriveProgramDataAddress,
} from '../src/upgradeable-loader.mjs';
import { attestSubscriptionProgramDeployment, SUBSCRIPTIONS_PROGRAM_ID } from '../src/subscription-programdata-attestation.mjs';

const SOURCE_COMMIT = '364a41976c33347d092902443bbec2def9227e75';
const REQUEST_ID = 'programdata-attestation-test-500';
const TX_SLOT = 500n;
const READ_SLOT = 600;
const DEPLOYMENT_SLOT = 400n;
const ELF = Buffer.from('solmint-pinned-program-elf-fixture-v1', 'utf8');
const ELF_SHA256 = createHash('sha256').update(ELF).digest('hex');

function makeResponse() {
  const programDataAddress = deriveProgramDataAddress(SUBSCRIPTIONS_PROGRAM_ID);
  const programState = Buffer.alloc(36);
  programState.writeUInt32LE(2, 0);
  new PublicKey(programDataAddress).toBuffer().copy(programState, 4);

  const programDataState = Buffer.alloc(13 + ELF.length + 8);
  programDataState.writeUInt32LE(3, 0);
  programDataState.writeBigUInt64LE(DEPLOYMENT_SLOT, 4);
  programDataState[12] = 0; // immutable test ProgramData fixture
  ELF.copy(programDataState, 13);

  const payload = {
    jsonrpc: '2.0',
    id: REQUEST_ID,
    result: {
      context: { apiVersion: '3.0.0', slot: READ_SLOT },
      value: [
        {
          data: [programState.toString('base64'), 'base64'],
          executable: true,
          lamports: 1,
          owner: UPGRADEABLE_LOADER_PROGRAM_ID,
          rentEpoch: 0,
        },
        {
          data: [programDataState.toString('base64'), 'base64'],
          executable: false,
          lamports: 1,
          owner: UPGRADEABLE_LOADER_PROGRAM_ID,
          rentEpoch: 0,
        },
      ],
    },
  };

  return JSON.stringify(payload);
}

function provenance(overrides = {}) {
  return {
    requestId: REQUEST_ID,
    providerId: 'helius-devnet-test',
    requestedCommitment: 'finalized',
    transactionSlot: TX_SLOT,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedElfSha256: ELF_SHA256,
    ...overrides,
  };
}

test('attests exact Program ID, ProgramData pointer, finalized slot window and pinned ELF hash', () => {
  const result = attestSubscriptionProgramDeployment(makeResponse(), provenance());

  assert.equal(result.outcome, 'attested');
  assert.equal(result.attestation.programAddress, SUBSCRIPTIONS_PROGRAM_ID);
  assert.equal(result.attestation.sourceCommit, SOURCE_COMMIT);
  assert.equal(result.attestation.elfSha256, ELF_SHA256);
  assert.equal(result.attestation.deploymentSlot, DEPLOYMENT_SLOT);
  assert.equal(result.attestation.readAtSlot, BigInt(READ_SLOT));
  assert.equal(result.attestation.readCommitment, 'finalized');
  assert.equal(result.attestation.attestationKind, 'current-finalized-programdata');
});

test('returns UNKNOWN when ProgramData snapshot is older than the transaction slot', () => {
  const body = JSON.parse(makeResponse());
  body.result.context.slot = Number(TX_SLOT - 1n);
  const result = attestSubscriptionProgramDeployment(JSON.stringify(body), provenance());
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /older than the transaction slot/);
});

test('returns UNKNOWN when Program deployment activates at or after the transaction slot', () => {
  const body = JSON.parse(makeResponse());
  const data = Buffer.from(body.result.value[1].data[0], 'base64');
  data.writeBigUInt64LE(TX_SLOT, 4);
  body.result.value[1].data[0] = data.toString('base64');
  const result = attestSubscriptionProgramDeployment(JSON.stringify(body), provenance());
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /not yet active/);
});

test('returns REJECTED when the Program account points to a non-canonical ProgramData address', () => {
  const body = JSON.parse(makeResponse());
  const data = Buffer.from(body.result.value[0].data[0], 'base64');
  new PublicKey('11111111111111111111111111111111').toBuffer().copy(data, 4);
  body.result.value[0].data[0] = data.toString('base64');
  const result = attestSubscriptionProgramDeployment(JSON.stringify(body), provenance());
  assert.equal(result.outcome, 'rejected');
  assert.match(result.reason, /different ProgramData PDA/);
});

test('returns REJECTED when deployed ELF bytes differ from the reproducible pinned build', () => {
  const result = attestSubscriptionProgramDeployment(makeResponse(), provenance({
    expectedElfSha256: 'a'.repeat(64),
  }));
  assert.equal(result.outcome, 'rejected');
  assert.match(result.reason, /does not match/);
});

test('returns UNKNOWN when RPC envelope id or commitment does not match the trusted request', () => {
  const body = JSON.parse(makeResponse());
  body.id = 'wrong-request';
  assert.equal(attestSubscriptionProgramDeployment(JSON.stringify(body), provenance()).outcome, 'unknown');

  assert.equal(
    attestSubscriptionProgramDeployment(makeResponse(), provenance({ requestedCommitment: 'confirmed' })).outcome,
    'unknown',
  );
});

test('returns REJECTED when Program or ProgramData owner/executable metadata is wrong', () => {
  const body = JSON.parse(makeResponse());
  body.result.value[1].executable = true;
  const result = attestSubscriptionProgramDeployment(JSON.stringify(body), provenance());
  assert.equal(result.outcome, 'rejected');
});
