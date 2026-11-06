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
const PAYER = 'Stake11111111111111111111111111111111111111';
const TARGET_SIGNATURE = '1'.repeat(88);
const TRANSACTION_SLOT = 500;

function tx(signature, accountKeys, header, { err = null, loadedAddresses, addressTableLookups = [] } = {}) {
  return {
    transaction: {
      signatures: [signature],
      message: {
        accountKeys,
        header,
        addressTableLookups,
        instructions: [],
      },
    },
    meta: {
      err,
      ...(loadedAddresses === undefined ? {} : { loadedAddresses }),
    },
    version: 'legacy',
  };
}

function blockFixture({ transactions } = {}) {
  return {
    blockhash: '1'.repeat(88),
    previousBlockhash: '2'.repeat(88),
    parentSlot: TRANSACTION_SLOT - 1,
    blockTime: 1_800_000_000,
    transactions: transactions ?? [
      tx(
        '2'.repeat(88),
        [PAYER, ACCOUNT_A],
        { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 },
      ),
      tx(
        TARGET_SIGNATURE,
        [PAYER, ACCOUNT_A, ACCOUNT_B],
        { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 2 },
      ),
    ],
  };
}

function response(request, result) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function makeFetch({
  genesis = GENESIS,
  tip = 700,
  block = blockFixture(),
  snapshotContextSlot = TRANSACTION_SLOT - 1,
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
    if (request.method === 'getBlock') return response(request, block);
    if (request.method === 'getAccountInfo') {
      const [address, config] = request.params;
      assert.ok([ACCOUNT_A, ACCOUNT_B].includes(address));
      assert.deepEqual(config, {
        encoding: 'base64',
        commitment: 'finalized',
        slot: TRANSACTION_SLOT - 1,
      });
      return response(request, {
        context: { slot: snapshotContextSlot },
        value: snapshotValue === null ? null : { ...snapshotValue },
      });
    }
    throw new Error('unexpected RPC method');
  };
  return { fetchImpl, calls };
}

const accounts = [
  { id: 'plan', address: ACCOUNT_A },
  { id: 'authority', address: ACCOUNT_B },
];

function invoke(fetchImpl, overrides = {}) {
  return fetchHistoricalSubscriptionAccountEvidence({
    rpcUrl: RPC_URL,
    cluster: 'devnet',
    transactionSlot: BigInt(TRANSACTION_SLOT),
    signature: TARGET_SIGNATURE,
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
    'getBlock',
    'getAccountInfo',
  ]);
  assert.equal(Object.isFrozen(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS), true);
  assert.equal(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS.includes('sendTransaction'), false);
  assert.equal(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS.includes('sendRawTransaction'), false);
});

test('returns exact slot-1 account bytes when no earlier transaction could write them', async () => {
  const { fetchImpl, calls } = makeFetch();
  const result = await invoke(fetchImpl);

  assert.equal(result.outcome, 'historical_snapshot');
  assert.equal(result.evidence.transactionSlot, 500n);
  assert.equal(result.evidence.snapshotSlot, 499n);
  assert.equal(result.evidence.finalizedTipSlot, 700n);
  assert.equal(result.evidence.targetTransactionIndex, 1);
  assert.equal(result.evidence.transactionsBeforeTarget, 1);
  assert.equal(result.evidence.precedingWritableConflictCount, 0);
  assert.equal(result.evidence.accounts.length, 2);
  assert.equal(result.evidence.accounts[0].snapshotSlot, 499n);
  assert.equal(result.evidence.accounts[0].dataBase64, Buffer.from('historical-plan-state').toString('base64'));

  assert.deepEqual(calls.map(call => call.method), [
    'getGenesisHash',
    'getSlot',
    'getBlock',
    'getAccountInfo',
    'getAccountInfo',
  ]);
  assert.deepEqual(calls[2].params, [
    TRANSACTION_SLOT,
    {
      commitment: 'finalized',
      encoding: 'json',
      transactionDetails: 'full',
      rewards: false,
      maxSupportedTransactionVersion: 1,
    },
  ]);
});

test('returns UNKNOWN when a preceding transaction can write a required snapshot account', async () => {
  const precedingWriter = tx(
    '2'.repeat(88),
    [PAYER, ACCOUNT_A],
    { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0 },
  );
  const { fetchImpl } = makeFetch({
    block: blockFixture({
      transactions: [
        precedingWriter,
        blockFixture().transactions[1],
      ],
    }),
  });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /PRE_TRANSACTION_BLOCK_WRITERS_PRESENT/);
  assert.equal(result.writers[0].accountId, 'plan');
});

test('ignores failed preceding transactions because they cannot commit account writes', async () => {
  const failedWriter = tx(
    '2'.repeat(88),
    [PAYER, ACCOUNT_A],
    { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0 },
    { err: { InstructionError: [0, 'Custom'] } },
  );
  const { fetchImpl } = makeFetch({
    block: blockFixture({
      transactions: [
        failedWriter,
        blockFixture().transactions[1],
      ],
    }),
  });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'historical_snapshot');
});

test('detects writable accounts loaded through a v0 address lookup table', async () => {
  const v0Writer = tx(
    '2'.repeat(88),
    [PAYER, PROGRAM],
    { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 },
    {
      addressTableLookups: [{ writableIndexes: [0], readonlyIndexes: [] }],
      loadedAddresses: { writable: [ACCOUNT_A], readonly: [] },
    },
  );
  v0Writer.version = 0;
  const { fetchImpl } = makeFetch({
    block: blockFixture({
      transactions: [
        v0Writer,
        blockFixture().transactions[1],
      ],
    }),
  });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /PRE_TRANSACTION_BLOCK_WRITERS_PRESENT/);
});

test('returns UNKNOWN when block target signature is absent or ambiguous', async () => {
  const noTarget = tx(
    '2'.repeat(88),
    [PAYER],
    { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0 },
  );
  const { fetchImpl } = makeFetch({ block: blockFixture({ transactions: [noTarget] }) });
  const result = await invoke(fetchImpl);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /TARGET_TRANSACTION_NOT_UNIQUE/);
});

test('returns UNKNOWN when historical account context does not match slot minus one', async () => {
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

test('rejects cluster mismatch and validates finalized chain tip before block/account reads', async () => {
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
    signature: TARGET_SIGNATURE,
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
