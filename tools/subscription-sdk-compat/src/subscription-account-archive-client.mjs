import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';

export const SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS = Object.freeze([
  'getGenesisHash',
  'getSlot',
  'getAccountInfo',
]);
const ALLOWED_METHODS = new Set(SUBSCRIPTION_ACCOUNT_ARCHIVE_ALLOWED_METHODS);

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
  if (typeof rawBody !== 'string' || rawBody.length === 0 || rawBody.length > 8_000_000) {
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
  if (!owner || value.executable !== false && value.executable !== true) {
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

/**
 * Fetch historical account bytes immediately before a transaction's slot,
 * then prove that no account write occurred during that whole transaction slot.
 *
 * This deliberately uses Alchemy's Solana Account Archive extension to the
 * standard getAccountInfo RPC. It is opt-in and does not change the current
 * Helius transaction/ProgramData provider. Historical parameters require an
 * eligible paid Account Archive plan. This function never falls back to latest
 * state or another RPC provider.
 *
 * Because account history is slot-granular, any first write at the transaction
 * slot is ambiguous relative to the transaction's index within that slot and
 * returns UNKNOWN. A first write strictly after the transaction slot proves
 * the slot-1 snapshot remained unchanged throughout the transaction slot.
 */
export async function fetchHistoricalSubscriptionAccountEvidence({
  rpcUrl,
  cluster,
  transactionSlot,
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
    transactionSlot > ((1n << 64n) - 1n)
  ) return unknown('ARCHIVE_TRANSACTION_SLOT_INVALID');
  if (
    typeof requestPrefix !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{0,40}$/i.test(requestPrefix)
  ) return unknown('ARCHIVE_REQUEST_PREFIX_INVALID');
  if (
    !Array.isArray(accounts) ||
    accounts.length === 0 ||
    accounts.length > 16
  ) return unknown('ARCHIVE_ACCOUNT_SET_INVALID');

  const normalizedAccounts = [];
  const ids = new Set();
  const addresses = new Set();
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
    normalizedAccounts.push({ id: item.id, address });
  }

  const snapshotSlot = transactionSlot - 1n;
  const idsForRpc = {
    genesis: `${requestPrefix}:genesis`,
    tip: `${requestPrefix}:tip`,
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

    const evidence = [];
    const responseHashes = [genesis.responseHash, tip.responseHash];

    for (const account of normalizedAccounts) {
      const snapshotRequestId = `${requestPrefix}:${account.id}:before`;
      const updateRequestId = `${requestPrefix}:${account.id}:next-write`;

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

      let nextWrite;
      try {
        nextWrite = await postRpc(
          rpcUrl,
          'getAccountInfo',
          [account.address, {
            encoding: 'base64',
            commitment: 'finalized',
            firstUpdateAfterSlot: Number(snapshotSlot),
          }],
          updateRequestId,
          fetchImpl,
        );
      } catch (error) {
        if (error?.rpcCode === -32020) {
          return unknown(`ARCHIVE_NEXT_WRITE_NOT_PROVEN:${account.id}`);
        }
        throw error;
      }

      if (!isRecord(nextWrite.result) || !isRecord(nextWrite.result.context) ||
          !Number.isSafeInteger(nextWrite.result.context.slot)) {
        return unknown(`ARCHIVE_NEXT_WRITE_CONTEXT_INVALID:${account.id}`);
      }
      const nextWriteSlot = BigInt(nextWrite.result.context.slot);
      if (nextWriteSlot <= transactionSlot) {
        return unknown(`ARCHIVE_ACCOUNT_CHANGED_WITHIN_TRANSACTION_SLOT:${account.id}`);
      }

      evidence.push({
        ...snapshot,
        nextWriteSlot,
        nextWriteValueIsNull: nextWrite.result.value === null,
        firstWriteResponseHash: nextWrite.responseHash,
        snapshotResponseHash: before.responseHash,
      });
      responseHashes.push(before.responseHash, nextWrite.responseHash);
    }

    return {
      outcome: 'historical_snapshot',
      evidence: {
        providerId: clusterConfig.providerId,
        cluster,
        clusterGenesisHash: genesis.result,
        transactionSlot,
        snapshotSlot,
        finalizedTipSlot: BigInt(tip.result),
        snapshotCommitment: 'finalized',
        slotBoundary: 'no-write-during-transaction-slot',
        accounts: evidence,
        rpcResponseSetSha256: createHash('sha256').update(responseHashes.join(':')).digest('hex'),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ARCHIVE_EVIDENCE_RETRIEVAL_FAILED';
    return unknown(message);
  }
}
