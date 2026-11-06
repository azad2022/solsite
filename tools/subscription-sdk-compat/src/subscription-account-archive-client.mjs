import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';

export const SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS = Object.freeze([
  'getGenesisHash',
  'getSlot',
  'getBlock',
  'getAccountInfo',
]);
const ALLOWED_METHODS = new Set(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS);
const CLOCK_SYSVAR_ADDRESS = 'SysvarC1ock11111111111111111111111111111111';

const CLUSTERS = {
  'mainnet-beta': {
    hostname: 'solana-mainnet.g.alchemy.com',
    genesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    providerId: 'alchemy-account-archive-mainnet',
  },
  devnet: {
    hostname: 'solana-devnet.g.alchemy.com',
    genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    providerId: 'alchemy-account-archive-devnet',
  },
};

function unknown(reason) {
  return { outcome: 'unknown', reasons: [reason] };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalAddress(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const canonical = new PublicKey(value).toBase58();
    return canonical === value ? canonical : null;
  } catch {
    return null;
  }
}

function validateEndpoint(rpcUrl, cluster) {
  const expected = CLUSTERS[cluster];
  if (!expected) throw new Error('ARCHIVE_CLUSTER_UNSUPPORTED');

  let url;
  try {
    url = new URL(rpcUrl);
  } catch {
    throw new Error('ARCHIVE_RPC_URL_INVALID');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== expected.hostname ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    !/^\/v2\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  ) throw new Error('ARCHIVE_RPC_ENDPOINT_NOT_APPROVED');

  return expected;
}

async function postRpc(rpcUrl, method, params, requestId, fetchImpl) {
  if (!ALLOWED_METHODS.has(method)) throw new Error('ARCHIVE_RPC_METHOD_NOT_ALLOWED');

  let response;
  try {
    response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('ARCHIVE_RPC_TRANSPORT_FAILED');
  }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? response.status : 0;
    throw new Error(`ARCHIVE_RPC_HTTP_${status}`);
  }

  let rawBody;
  try {
    rawBody = await response.text();
  } catch {
    throw new Error('ARCHIVE_RPC_RESPONSE_UNREADABLE');
  }
  if (typeof rawBody !== 'string' || rawBody.length === 0 || rawBody.length > 20_000_000) {
    throw new Error('ARCHIVE_RPC_RESPONSE_SIZE_INVALID');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error('ARCHIVE_RPC_JSON_INVALID');
  }
  if (
    !isRecord(payload) ||
    payload.jsonrpc !== '2.0' ||
    payload.id !== requestId
  ) throw new Error('ARCHIVE_RPC_RESPONSE_CORRELATION_INVALID');

  if (Object.hasOwn(payload, 'error')) {
    const code = Number.isInteger(payload.error?.code) ? payload.error.code : 'UNKNOWN';
    const error = new Error(`ARCHIVE_RPC_ERROR_${code}`);
    error.rpcCode = code;
    throw error;
  }
  if (!Object.hasOwn(payload, 'result')) throw new Error('ARCHIVE_RPC_RESULT_MISSING');

  return {
    result: payload.result,
    responseHash: createHash('sha256').update(rawBody, 'utf8').digest('hex'),
  };
}

function normalizeAccountInfo(result, expectedAddress, snapshotSlot) {
  if (!isRecord(result) || !isRecord(result.context) || !Number.isSafeInteger(result.context.slot)) {
    throw new Error('ARCHIVE_ACCOUNT_CONTEXT_INVALID');
  }
  if (BigInt(result.context.slot) !== snapshotSlot) {
    throw new Error('ARCHIVE_ACCOUNT_CONTEXT_SLOT_MISMATCH');
  }
  const value = result.value;
  if (!isRecord(value)) throw new Error('ARCHIVE_ACCOUNT_MISSING_AT_PRE_TRANSACTION_SLOT');

  const owner = canonicalAddress(value.owner);
  if (!owner || (value.executable !== false && value.executable !== true)) {
    throw new Error('ARCHIVE_ACCOUNT_METADATA_INVALID');
  }
  if (
    !Number.isSafeInteger(value.lamports) ||
    value.lamports < 0 ||
    !Array.isArray(value.data) ||
    value.data.length !== 2 ||
    value.data[1] !== 'base64' ||
    typeof value.data[0] !== 'string' ||
    value.data[0].length === 0 ||
    value.data[0].length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data[0])
  ) throw new Error('ARCHIVE_ACCOUNT_DATA_INVALID');

  const bytes = Buffer.from(value.data[0], 'base64');
  if (bytes.length === 0) throw new Error('ARCHIVE_ACCOUNT_DATA_EMPTY');

  return {
    address: expectedAddress,
    owner,
    executable: value.executable,
    lamports: String(value.lamports),
    dataBase64: value.data[0],
    dataLength: bytes.length,
    accountDataSha256: createHash('sha256').update(bytes).digest('hex'),
    snapshotSlot,
  };
}


function normalizeClockSysvar(result, expectedSlot) {
  const account = normalizeAccountInfo(result, CLOCK_SYSVAR_ADDRESS, expectedSlot);
  const bytes = Buffer.from(account.dataBase64, 'base64');
  if (bytes.length !== 40) throw new Error('ARCHIVE_CLOCK_SYSVAR_LENGTH_INVALID');

  const slot = bytes.readBigUInt64LE(0);
  const epochStartTimestamp = bytes.readBigInt64LE(8);
  const epoch = bytes.readBigUInt64LE(16);
  const leaderScheduleEpoch = bytes.readBigUInt64LE(24);
  const unixTimestamp = bytes.readBigInt64LE(32);
  if (slot !== expectedSlot) throw new Error('ARCHIVE_CLOCK_SYSVAR_SLOT_MISMATCH');

  return {
    address: CLOCK_SYSVAR_ADDRESS,
    slot,
    epochStartTimestamp,
    epoch,
    leaderScheduleEpoch,
    unixTimestamp,
    accountDataSha256: account.accountDataSha256,
    responseContextSlot: account.snapshotSlot,
  };
}

function accountKeysAndWritableSet(blockTransaction) {
  if (
    !isRecord(blockTransaction) ||
    !isRecord(blockTransaction.transaction) ||
    !isRecord(blockTransaction.transaction.message) ||
    !isRecord(blockTransaction.meta)
  ) throw new Error('ARCHIVE_BLOCK_TRANSACTION_SHAPE_INVALID');

  if (!Object.hasOwn(blockTransaction.meta, 'err')) {
    throw new Error('ARCHIVE_BLOCK_EXECUTION_STATUS_MISSING');
  }
  if (blockTransaction.meta.err !== null) {
    // A failed transaction does not commit account writes.
    return { signature: readFirstSignature(blockTransaction), writable: new Set(), failed: true };
  }

  const transaction = blockTransaction.transaction;
  const message = transaction.message;
  const header = message.header;
  const staticKeys = message.accountKeys;
  if (!Array.isArray(staticKeys) || staticKeys.length === 0 || !isRecord(header)) {
    throw new Error('ARCHIVE_BLOCK_MESSAGE_INVALID');
  }
  const staticAddresses = staticKeys.map(canonicalAddress);
  if (staticAddresses.some(address => address === null)) {
    throw new Error('ARCHIVE_BLOCK_ACCOUNT_KEY_INVALID');
  }
  const staticCount = staticAddresses.length;

  const lookups = message.addressTableLookups ?? [];
  if (
    !Array.isArray(lookups) ||
    lookups.some(lookup =>
      !isRecord(lookup) ||
      !Array.isArray(lookup.writableIndexes) ||
      !Array.isArray(lookup.readonlyIndexes) ||
      lookup.writableIndexes.some(index => !Number.isInteger(index) || index < 0 || index > 255) ||
      lookup.readonlyIndexes.some(index => !Number.isInteger(index) || index < 0 || index > 255)
    )
  ) throw new Error('ARCHIVE_BLOCK_LOOKUP_LAYOUT_INVALID');
  const expectedWritableLookupCount = lookups.reduce((n, lookup) => n + lookup.writableIndexes.length, 0);
  const expectedReadonlyLookupCount = lookups.reduce((n, lookup) => n + lookup.readonlyIndexes.length, 0);
  const loaded = blockTransaction.meta.loadedAddresses;

  let loadedWritable = [];
  let loadedReadonly = [];
  if (expectedWritableLookupCount + expectedReadonlyLookupCount > 0) {
    if (
      !isRecord(loaded) ||
      !Array.isArray(loaded.writable) ||
      !Array.isArray(loaded.readonly)
    ) throw new Error('ARCHIVE_BLOCK_LOADED_ADDRESSES_MISSING');
    loadedWritable = loaded.writable.map(canonicalAddress);
    loadedReadonly = loaded.readonly.map(canonicalAddress);
    if (
      loadedWritable.some(address => address === null) ||
      loadedReadonly.some(address => address === null) ||
      loadedWritable.length !== expectedWritableLookupCount ||
      loadedReadonly.length !== expectedReadonlyLookupCount
    ) throw new Error('ARCHIVE_BLOCK_LOADED_ADDRESSES_INVALID');
  } else if (loaded !== null && loaded !== undefined) {
    if (
      !isRecord(loaded) ||
      !Array.isArray(loaded.writable) ||
      !Array.isArray(loaded.readonly) ||
      loaded.writable.length !== 0 ||
      loaded.readonly.length !== 0
    ) throw new Error('ARCHIVE_BLOCK_UNEXPECTED_LOADED_ADDRESSES');
  }

  const required = header.numRequiredSignatures;
  const readonlySigned = header.numReadonlySignedAccounts;
  const readonlyUnsigned = header.numReadonlyUnsignedAccounts;
  if (
    !Number.isInteger(required) || required < 1 || required > staticCount ||
    !Number.isInteger(readonlySigned) || readonlySigned < 0 || readonlySigned > required ||
    !Number.isInteger(readonlyUnsigned) || readonlyUnsigned < 0 || readonlyUnsigned > staticCount - required
  ) throw new Error('ARCHIVE_BLOCK_MESSAGE_HEADER_INVALID');

  const allAddresses = [
    ...staticAddresses,
    ...loadedWritable,
    ...loadedReadonly,
  ];
  if (allAddresses.length > 256) throw new Error('ARCHIVE_BLOCK_ACCOUNT_KEY_LIMIT');

  const writable = new Set();
  for (let index = 0; index < staticCount; index += 1) {
    const isSigner = index < required;
    const isWritable = isSigner
      ? index < required - readonlySigned
      : index < staticCount - readonlyUnsigned;
    if (isWritable) writable.add(staticAddresses[index]);
  }
  for (const address of loadedWritable) writable.add(address);

  return {
    signature: readFirstSignature(blockTransaction),
    writable,
    failed: false,
  };
}

function readFirstSignature(blockTransaction) {
  const signatures = blockTransaction?.transaction?.signatures;
  if (!Array.isArray(signatures) || signatures.length === 0 ||
      typeof signatures[0] !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signatures[0])) {
    throw new Error('ARCHIVE_BLOCK_SIGNATURE_INVALID');
  }
  return signatures[0];
}

function proveNoEarlierWriters(block, expectedSignature, accountIdsByAddress) {
  if (!isRecord(block) || !Array.isArray(block.transactions)) {
    throw new Error('ARCHIVE_BLOCK_TRANSACTIONS_MISSING');
  }

  const targetIndexes = [];
  const normalized = block.transactions.map((entry, index) => {
    const item = accountKeysAndWritableSet(entry);
    if (item.signature === expectedSignature) targetIndexes.push(index);
    return item;
  });

  if (targetIndexes.length !== 1) {
    throw new Error('ARCHIVE_TARGET_TRANSACTION_NOT_UNIQUE_IN_BLOCK');
  }
  const targetIndex = targetIndexes[0];
  if (normalized[targetIndex].failed) {
    throw new Error('ARCHIVE_TARGET_TRANSACTION_FAILED');
  }
  const writers = [];

  for (let index = 0; index < targetIndex; index += 1) {
    const transaction = normalized[index];
    if (transaction.failed) continue;

    for (const address of transaction.writable) {
      const accountId = accountIdsByAddress.get(address);
      if (accountId) writers.push({ transactionIndex: index, signature: transaction.signature, accountId });
    }
  }

  if (writers.length > 0) {
    return { outcome: 'unknown', reasons: ['ARCHIVE_PRE_TRANSACTION_BLOCK_WRITERS_PRESENT'], writers };
  }
  return {
    outcome: 'safe',
    targetTransactionIndex: targetIndex,
    transactionsBeforeTarget: targetIndex,
    precedingWritableConflictCount: 0,
  };
}

/**
 * Fetch account bytes at slot S-1 from the Alchemy Solana Account Archive,
 * then inspect the finalized full block at slot S (as returned by the same
 * archive endpoint) to prove none of the earlier transactions could have
 * written those accounts.
 *
 * The target transaction itself may write SubscriptionDelegation and token
 * accounts. This is expected and is not a conflict: the pre-state is from
 * S-1, and only transactions earlier than the target can invalidate it.
 *
 * This is a read-only, opt-in adapter. Alchemy documents historical parameters
 * as paid-plan-only. It is not configured by this code and does not fall back
 * to latest-state RPC, another provider, or a public endpoint.
 */
export async function fetchHistoricalSubscriptionAccountEvidence({
  rpcUrl,
  cluster,
  transactionSlot,
  signature,
  accounts,
  fetchImpl = fetch,
  requestPrefix,
}) {
  let clusterConfig;
  try {
    clusterConfig = validateEndpoint(rpcUrl, cluster);
  } catch (error) {
    return unknown(error instanceof Error ? error.message : 'ARCHIVE_ENDPOINT_VALIDATION_FAILED');
  }

  if (
    typeof transactionSlot !== 'bigint' ||
    transactionSlot <= 0n ||
    transactionSlot > BigInt(Number.MAX_SAFE_INTEGER)
  ) return unknown('ARCHIVE_TRANSACTION_SLOT_INVALID');
  if (
    typeof signature !== 'string' ||
    !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)
  ) return unknown('ARCHIVE_TARGET_SIGNATURE_INVALID');
  if (
    typeof requestPrefix !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{0,40}$/i.test(requestPrefix)
  ) return unknown('ARCHIVE_REQUEST_PREFIX_INVALID');
  if (!Array.isArray(accounts) || accounts.length === 0 || accounts.length > 16) {
    return unknown('ARCHIVE_ACCOUNT_SET_INVALID');
  }

  const normalizedAccounts = [];
  const ids = new Set();
  const addresses = new Set();
  const accountIdsByAddress = new Map();
  for (const item of accounts) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !/^[a-z][a-z0-9._:-]{0,60}$/i.test(item.id) ||
      ids.has(item.id)
    ) return unknown('ARCHIVE_ACCOUNT_DESCRIPTOR_INVALID');
    const address = canonicalAddress(item.address);
    if (!address || addresses.has(address)) return unknown('ARCHIVE_ACCOUNT_ADDRESS_INVALID');
    ids.add(item.id);
    addresses.add(address);
    accountIdsByAddress.set(address, item.id);
    normalizedAccounts.push({ id: item.id, address });
  }

  const snapshotSlot = transactionSlot - 1n;
  const idsForRpc = {
    genesis: `${requestPrefix}:genesis`,
    tip: `${requestPrefix}:tip`,
    block: `${requestPrefix}:block`,
    clock: `${requestPrefix}:clock`,
  };

  try {
    const genesis = await postRpc(rpcUrl, 'getGenesisHash', [], idsForRpc.genesis, fetchImpl);
    if (genesis.result !== clusterConfig.genesisHash) {
      return { outcome: 'rejected', failures: ['ARCHIVE_CLUSTER_GENESIS_MISMATCH'] };
    }
    const tip = await postRpc(
      rpcUrl,
      'getSlot',
      [{ commitment: 'finalized' }],
      idsForRpc.tip,
      fetchImpl,
    );
    if (!Number.isSafeInteger(tip.result) || BigInt(tip.result) < transactionSlot) {
      return unknown('ARCHIVE_FINALIZED_TIP_BEHIND_TRANSACTION');
    }

    const block = await postRpc(
      rpcUrl,
      'getBlock',
      [
        Number(transactionSlot),
        {
          commitment: 'finalized',
          encoding: 'json',
          transactionDetails: 'full',
          rewards: false,
          maxSupportedTransactionVersion: 1,
        },
      ],
      idsForRpc.block,
      fetchImpl,
    );
    if (block.result === null) return unknown('ARCHIVE_TARGET_BLOCK_NOT_AVAILABLE');
    const writerProof = proveNoEarlierWriters(block.result, signature, accountIdsByAddress);
    if (writerProof.outcome !== 'safe') return writerProof;

    const evidence = [];
    const responseHashes = [genesis.responseHash, tip.responseHash, block.responseHash];

    for (const account of normalizedAccounts) {
      const snapshotRequestId = `${requestPrefix}:${account.id}:before-slot`;
      const before = await postRpc(
        rpcUrl,
        'getAccountInfo',
        [account.address, {
          encoding: 'base64',
          commitment: 'finalized',
          slot: Number(snapshotSlot),
        }],
        snapshotRequestId,
        fetchImpl,
      );
      const snapshot = normalizeAccountInfo(before.result, account.address, snapshotSlot);
      evidence.push({
        ...snapshot,
        snapshotResponseHash: before.responseHash,
      });
      responseHashes.push(before.responseHash);
    }

    // Clock is a sysvar updated by the runtime at the slot boundary and is
    // stable for transactions executed in that slot. Read the Clock account
    // at the transaction slot itself so period rollover uses the exact
    // on-chain unix_timestamp rather than RPC blockTime's estimated value.
    const clockRaw = await postRpc(
      rpcUrl,
      'getAccountInfo',
      [CLOCK_SYSVAR_ADDRESS, {
        encoding: 'base64',
        commitment: 'finalized',
        slot: Number(transactionSlot),
      }],
      idsForRpc.clock,
      fetchImpl,
    );
    const clock = normalizeClockSysvar(clockRaw.result, transactionSlot);
    responseHashes.push(clockRaw.responseHash);

    return {
      outcome: 'historical_snapshot',
      evidence: {
        providerId: clusterConfig.providerId,
        cluster,
        clusterGenesisHash: genesis.result,
        transactionSignature: signature,
        transactionSlot,
        targetTransactionIndex: writerProof.targetTransactionIndex,
        transactionsBeforeTarget: writerProof.transactionsBeforeTarget,
        precedingWritableConflictCount: 0,
        snapshotSlot,
        finalizedTipSlot: BigInt(tip.result),
        snapshotCommitment: 'finalized',
        blockResponseHash: block.responseHash,
        clock,
        accounts: evidence,
        rpcResponseSetSha256: createHash('sha256').update(responseHashes.join(':')).digest('hex'),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ARCHIVE_EVIDENCE_RETRIEVAL_FAILED';
    return unknown(message);
  }
}
