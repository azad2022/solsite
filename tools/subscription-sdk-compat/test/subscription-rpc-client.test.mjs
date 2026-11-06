import assert from 'node:assert/strict';
import test from 'node:test';
import { verifySubscriptionTransferTransaction } from '../dist/subscription-transaction-verifier.js';
import {
  ELF_SHA256 as FIXTURE_ELF_SHA256,
  GENESIS,
  makeFixture,
  makeProgramDataRpcResponse,
  SOURCE_COMMIT as FIXTURE_SOURCE_COMMIT,
} from './helpers/subscription-rpc-fixture.mjs';
import {
  fetchFinalizedSubscriptionTransactionEvidence,
  SUBSCRIPTION_RPC_ALLOWED_METHODS,
} from '../src/subscription-rpc-client.mjs';

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const PROGRAM_COMMIT = '364a41976c33347d092902443bbec2def9227e75';
const ELF_SHA256 = 'a'.repeat(64);
const SIGNATURE = '1'.repeat(88);
const RPC_URL = 'https://devnet.helius-rpc.com/?api-key=test-only-placeholder';

function response(request, result) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function fixtureFetch({ genesis = DEVNET_GENESIS, transaction = { slot: 500 }, programData = { context: { slot: 600 }, value: [] } } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    assert.equal(url, RPC_URL);
    assert.equal(init.method, 'POST');
    const request = JSON.parse(init.body);
    calls.push(request);
    if (request.method === 'getGenesisHash') return response(request, genesis);
    if (request.method === 'getTransaction') return response(request, transaction);
    if (request.method === 'getMultipleAccounts') return response(request, programData);
    throw new Error('unexpected RPC method');
  };
  return { calls, fetchImpl };
}

test('RPC method allowlist is immutable and contains no state-changing transaction methods', () => {
  assert.deepEqual(SUBSCRIPTION_RPC_ALLOWED_METHODS, [
    'getGenesisHash',
    'getTransaction',
    'getMultipleAccounts',
  ]);
  assert.equal(Object.isFrozen(SUBSCRIPTION_RPC_ALLOWED_METHODS), true);
  assert.equal(SUBSCRIPTION_RPC_ALLOWED_METHODS.includes('sendTransaction'), false);
  assert.equal(SUBSCRIPTION_RPC_ALLOWED_METHODS.includes('sendRawTransaction'), false);
});

test('uses only finalized read RPC calls and opts into active transaction version 1', async () => {
  const { calls, fetchImpl } = fixtureFetch();
  const result = await fetchFinalizedSubscriptionTransactionEvidence({
    rpcUrl: RPC_URL,
    cluster: 'devnet',
    signature: SIGNATURE,
    expectedSourceCommit: PROGRAM_COMMIT,
    expectedElfSha256: ELF_SHA256,
    requestPrefix: 'test-cycle-500',
    fetchImpl,
  });

  assert.equal(result.outcome, 'unknown');
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => call.method), [
    'getGenesisHash',
    'getTransaction',
    'getMultipleAccounts',
  ]);

  assert.deepEqual(calls[1].params, [
    SIGNATURE,
    {
      commitment: 'finalized',
      encoding: 'base64',
      maxSupportedTransactionVersion: 1,
    },
  ]);
  assert.deepEqual(calls[2].params[1], {
    commitment: 'finalized',
    encoding: 'base64',
    minContextSlot: 500,
  });
  assert.deepEqual(calls.map(call => call.id), [
    'test-cycle-500:genesis',
    'test-cycle-500:transaction',
    'test-cycle-500:programdata',
  ]);
});

test('rejects a cluster genesis mismatch before fetching any transaction', async () => {
  const { calls, fetchImpl } = fixtureFetch({ genesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d' });
  const result = await fetchFinalizedSubscriptionTransactionEvidence({
    rpcUrl: RPC_URL,
    cluster: 'devnet',
    signature: SIGNATURE,
    expectedSourceCommit: PROGRAM_COMMIT,
    expectedElfSha256: ELF_SHA256,
    requestPrefix: 'wrong-genesis',
    fetchImpl,
  });

  assert.equal(result.outcome, 'rejected');
  assert.deepEqual(result.failures, ['RPC_CLUSTER_GENESIS_MISMATCH']);
  assert.equal(calls.length, 1);
});

test('rejects public RPC, non-TLS, wrong-cluster and credential-ambiguous endpoints without network access', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error('should not fetch');
  };
  const base = {
    cluster: 'devnet',
    signature: SIGNATURE,
    expectedSourceCommit: PROGRAM_COMMIT,
    expectedElfSha256: ELF_SHA256,
    requestPrefix: 'endpoint-policy',
    fetchImpl,
  };

  for (const rpcUrl of [
    'https://api.devnet.solana.com',
    'http://devnet.helius-rpc.com/?api-key=secret',
    'https://mainnet.helius-rpc.com/?api-key=secret',
    'https://devnet.helius-rpc.com/?api-key=one&api-key=two',
    'https://user:pass@devnet.helius-rpc.com/?api-key=secret',
  ]) {
    const result = await fetchFinalizedSubscriptionTransactionEvidence({ ...base, rpcUrl });
    assert.equal(result.outcome, 'unknown');
  }
  assert.equal(calls, 0);
});

test('does not expose the Helius API-key query in failure reasons', async () => {
  const secretLikeValue = 'test-only-placeholder';
  const { fetchImpl } = fixtureFetch({ transaction: null });
  const result = await fetchFinalizedSubscriptionTransactionEvidence({
    rpcUrl: RPC_URL,
    cluster: 'devnet',
    signature: SIGNATURE,
    expectedSourceCommit: PROGRAM_COMMIT,
    expectedElfSha256: ELF_SHA256,
    requestPrefix: 'missing-transaction',
    fetchImpl,
  });

  assert.equal(result.outcome, 'unknown');
  assert.equal(JSON.stringify(result).includes(secretLikeValue), false);
});

test('retrieves finalized RPC evidence, attests ProgramData, normalizes and verifies one exact Attempt', async () => {
  const fixture = makeFixture();
  const transactionResult = JSON.parse(fixture.rawResponse).result;
  const calls = [];
  const fetchImpl = async (_url, init) => {
    const request = JSON.parse(init.body);
    calls.push(request);
    if (request.method === 'getGenesisHash') return response(request, GENESIS);
    if (request.method === 'getTransaction') return response(request, transactionResult);
    if (request.method === 'getMultipleAccounts') {
      return new Response(makeProgramDataRpcResponse(request.id, 500n, 600), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error('unexpected RPC method');
  };

  const result = await fetchFinalizedSubscriptionTransactionEvidence({
    rpcUrl: RPC_URL,
    cluster: 'devnet',
    signature: fixture.signature,
    transactionSlotHint: 500n,
    expectedSourceCommit: FIXTURE_SOURCE_COMMIT,
    expectedElfSha256: FIXTURE_ELF_SHA256,
    requestPrefix: 'rpc-integration-attempt-500',
    fetchImpl,
  });

  assert.equal(result.outcome, 'normalized', JSON.stringify(result));
  assert.equal(result.evidence.signature, fixture.signature);
  assert.equal(result.evidence.messageHash, fixture.messageHash);
  assert.equal(result.evidence.programDeployment.attestationKind, 'current-finalized-programdata');
  assert.equal(result.evidence.programDeployment.deploymentSlot, 400n);
  assert.equal(result.evidence.programDeployment.readAtSlot, 600n);
  assert.deepEqual(calls.map(call => call.method), [
    'getGenesisHash',
    'getTransaction',
    'getMultipleAccounts',
  ]);
  assert.equal(calls[1].params[1].commitment, 'finalized');
  assert.equal(calls[2].params[1].minContextSlot, 500);

  const verified = verifySubscriptionTransferTransaction(fixture.expected, result.evidence);
  assert.equal(verified.outcome, 'verified_observation');
  assert.equal(verified.signature, fixture.signature);
  assert.equal(verified.messageHash, fixture.messageHash);
  assert.equal(verified.amountAtomic, 250n);
});
