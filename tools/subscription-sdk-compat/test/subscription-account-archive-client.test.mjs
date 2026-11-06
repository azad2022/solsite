import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchHistoricalSubscriptionAccountEvidence,
  SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS,
} from '../src/subscription-account-archive-client.mjs';

const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const RPC_URL = 'https://solana-devnet.g.alchemy.com/v2/test-only-placeholder';
const PROGRAM = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
const ACCOUNT_A = 'SysvarC1ock11111111111111111111111111111111';
const ACCOUNT_B = 'SysvarRent111111111111111111111111111111111';
const TRANSACTION_SLOT = 500;

function response(request, result) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function rpcError(request, code, message) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    error: { code, message },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function makeFetch({
  genesis = GENESIS,
  tip = 700,
  snapshotContextSlot = TRANSACTION_SLOT - 1,
  nextWriteSlot = 700,
  nextWriteError = null,
  snapshotValue = {
    data: [Buffer.from('historical-plan-state').toString('base64'), 'base64'],
    executable: false,
    lamports: 1_000_000,
    owner: PROGRAM,
    rentEpoch: 0,
  },
  failRequestId = null,
} = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    assert.equal(url, RPC_URL);
    assert.equal(init.method, 'POST');
    const request = JSON.parse(init.body);
    calls.push(request);

    if (request.id === failRequestId) return new Response('unavailable', { status: 503 });
    if (request.method === 'getGenesisHash') return response(request, genesis);
    if (request.method === 'getSlot') return response(request, tip);
    if (request.method !== 'getAccountInfo') throw new Error('unexpected RPC method');

    const [address, config] = request.params;
    if (config.slot !== undefined) {
      return response(request, {
        context: { slot: snapshotContextSlot },
        value: snapshotValue === null ? null : { ...snapshotValue, owner: PROGRAM, data: snapshotValue.data },
      });
    }

    if (config.firstUpdateAfterSlot !== undefined) {
      if (nextWriteError) return rpcError(request, nextWriteError.code, nextWriteError.message);
      return response(request, {
        context: { slot: nextWriteSlot },
        value: null,
      });
    }
    throw new Error('unexpected getAccountInfo config');
  };
  return { fetchImpl, calls };
}

const accounts = [
  { id: 'plan', address: ACCOUNT_A },
  { id: 'subscription', address: ACCOUNT_B },
];

function invoke(fetchImpl, overrides = {}) {
  return fetchHistoricalSubscriptionAccountEvidence({
    rpcUrl: RPC_URL,
    cluster: 'devnet',
    transactionSlot: BigInt(TRANSACTION_SLOT),
    accounts,
    requestPrefix: 'archive-fixture-500',
    fetchImpl,
    ...overrides,
  });
}

test('only permits read-only historical RPC methods', () => {
  assert.deepEqual(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS, [
    'getGenesisHash',
    'getSlot',
    'getAccountInfo',
  ]);
  assert.equal(Object.isFrozen(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS), true);
  assert.equal(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS.includes('sendTransaction'), false);
  assert.equal(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS.includes('sendRawTransaction'), false);
});

test('returns pre-slot account bytes only when every account has no writes in the transaction slot', async () => {
  const { fetchImpl, calls } = makeFetch();
  const result = await invoke(fetchImpl);

  assert.equal(result.outcome, 'historical_snapshot');
  assert.equal(result.evidence.transactionSlot, 500n);
  assert.equal(result.evidence.snapshotSlot, 499n);
  assert.equal(result.evidence.finalizedTipSlot, 700n);
  assert.equal(result.evidence.slotBoundary, 'no-write-during-transaction-slot');
  assert.equal(result.evidence.accounts.length, 2);
  assert.equal(result.evidence.accounts[0].snapshotSlot, 499n);
  assert.equal(result.evidence.accounts[0].nextWriteSlot, 700n);
  assert.equal(result.evidence.accounts[0].dataBase64, Buffer.from('historical-plan-state').toString('base64'));

  assert.deepEqual(calls.slice(0, 2).map(call => call.method), ['getGenesisHash', 'getSlot']);
  assert.deepEqual(calls.slice(2).map(call => call.method), [
    'getAccountInfo',
    'getAccountInfo',
    'getAccountInfo',
    'getAccountInfo',
  ]);
  assert.deepEqual(calls[2].params, [
    ACCOUNT_A,
    { encoding: 'base64', commitment: 'finalized', slot: 499 },
  ]);
  assert.deepEqual(calls[3].params, [
    ACCOUNT_A,
    { encoding: 'base64', commitment: 'finalized', firstUpdateAfterSlot: 499 },
  ]);
});

test('returns UNKNOWN when an account is updated anywhere in the transaction slot', async () => {
  const { fetchImpl } = makeFetch({ nextWriteSlot: TRANSACTION_SLOT });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /CHANGED_WITHIN_TRANSACTION_SLOT/);
});

test('returns UNKNOWN when the archive cannot prove the first write after the pre-transaction snapshot', async () => {
  const { fetchImpl } = makeFetch({
    nextWriteError: { code: -32020, message: 'Out of coverage' },
  });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /NEXT_WRITE_NOT_PROVEN/);
});

test('returns UNKNOWN when the historical snapshot context is not exactly the prior slot', async () => {
  const { fetchImpl } = makeFetch({ snapshotContextSlot: 498 });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /CONTEXT_SLOT_MISMATCH/);
});

test('returns UNKNOWN when a required account did not exist at the prior slot', async () => {
  const { fetchImpl } = makeFetch({ snapshotValue: null });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /ACCOUNT_MISSING_AT_PRE_TRANSACTION_SLOT/);
});

test('rejects cluster mismatch and validates finalized chain tip before account reads', async () => {
  const mismatch = makeFetch({ genesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d' });
  const wrongCluster = await invoke(mismatch.fetchImpl);
  assert.equal(wrongCluster.outcome, 'rejected');
  assert.equal(mismatch.calls.length, 1);

  const behind = makeFetch({ tip: TRANSACTION_SLOT - 1 });
  const tipBehind = await invoke(behind.fetchImpl);
  assert.equal(tipBehind.outcome, 'unknown');
  assert.equal(behind.calls.length, 2);
});

test('rejects public endpoints and malformed account descriptors without network access', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error('should not fetch');
  };
  const base = {
    cluster: 'devnet',
    transactionSlot: 500n,
    accounts,
    requestPrefix: 'invalid-config',
    fetchImpl,
  };
  for (const rpcUrl of [
    'https://api.devnet.solana.com',
    'http://solana-devnet.g.alchemy.com/v2/key',
    'https://solana-mainnet.g.alchemy.com/v2/key',
    'https://user:pass@solana-devnet.g.alchemy.com/v2/key',
    'https://solana-devnet.g.alchemy.com/v2/key?foo=bar',
  ]) {
    const result = await fetchHistoricalSubscriptionAccountEvidence({ ...base, rpcUrl });
    assert.equal(result.outcome, 'unknown');
  }
  const duplicated = await fetchHistoricalSubscriptionAccountEvidence({
    ...base,
    rpcUrl: RPC_URL,
    accounts: [accounts[0], accounts[0]],
  });
  assert.equal(duplicated.outcome, 'unknown');
  assert.equal(calls, 0);
});

test('does not expose the Alchemy API key in error results', async () => {
  const { fetchImpl } = makeFetch({ failRequestId: 'archive-fixture-500:genesis' });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.equal(JSON.stringify(result).includes('test-only-placeholder'), false);
});
