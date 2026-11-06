import { normalizeSubscriptionGetTransactionResponse } from '../dist/subscription-rpc-evidence.js';
import { attestSubscriptionProgramDeployment } from './subscription-programdata-attestation.mjs';
import { deriveProgramDataAddress } from './upgradeable-loader.mjs';

export const SUBSCRIPTION_RPC_ALLOWED_METHODS = Object.freeze([
  'getGenesisHash',
  'getTransaction',
  'getMultipleAccounts',
]);
const ALLOWED_RPC_METHODS = new Set(SUBSCRIPTION_RPC_ALLOWED_METHODS);

const CLUSTERS = {
  'mainnet-beta': {
    hostname: 'mainnet.helius-rpc.com',
    genesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    providerId: 'helius-mainnet',
  },
  devnet: {
    hostname: 'devnet.helius-rpc.com',
    genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    providerId: 'helius-devnet',
  },
};

function unknown(reason) {
  return { outcome: 'unknown', reasons: [reason] };
}

function rejected(reason) {
  return { outcome: 'rejected', failures: [reason] };
}

function validateEndpoint(rpcUrl, cluster) {
  const expected = CLUSTERS[cluster];
  if (!expected) throw new Error('RPC_CLUSTER_UNSUPPORTED');
  let url;
  try {
    url = new URL(rpcUrl);
  } catch {
    throw new Error('RPC_URL_INVALID');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== expected.hostname ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.hash.length > 0
  ) throw new Error('RPC_ENDPOINT_NOT_APPROVED');
  const queryKeys = [...url.searchParams.keys()];
  if (
    queryKeys.length !== 1 ||
    queryKeys[0] !== 'api-key' ||
    !url.searchParams.get('api-key')
  ) throw new Error('RPC_API_KEY_QUERY_INVALID');
  return expected;
}

function parseEnvelope(rawBody, requestId) {
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error('RPC_JSON_INVALID');
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    payload.jsonrpc !== '2.0' ||
    payload.id !== requestId ||
    Object.hasOwn(payload, 'error') ||
    !Object.hasOwn(payload, 'result')
  ) throw new Error('RPC_RESPONSE_ENVELOPE_INVALID');
  return payload.result;
}

async function postReadOnlyRpc(rpcUrl, method, params, requestId, fetchImpl) {
  if (!ALLOWED_RPC_METHODS.has(method)) {
    throw new Error('RPC_METHOD_NOT_ALLOWED');
  }
  let response;
  try {
    response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('RPC_TRANSPORT_FAILED');
  }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? response.status : 0;
    throw new Error(`RPC_HTTP_${status}`);
  }

  let rawBody;
  try {
    rawBody = await response.text();
  } catch {
    throw new Error('RPC_RESPONSE_BODY_UNREADABLE');
  }
  if (typeof rawBody !== 'string' || rawBody.length === 0 || rawBody.length > 12_000_000) {
    throw new Error('RPC_RESPONSE_BODY_SIZE_INVALID');
  }
  parseEnvelope(rawBody, requestId);
  return rawBody;
}

/**
 * Read-only finalized Subscription evidence retrieval.
 *
 * Calls only getGenesisHash, getTransaction and getMultipleAccounts on the
 * exact Helius endpoint for the selected cluster. It never signs, submits,
 * retries a charge, writes on-chain or logs the endpoint/API-key.
 *
 * Returned transaction evidence is still only a candidate for the pure
 * Subscription verifier. It is not an accounting commit or paid outcome.
 */
export async function fetchFinalizedSubscriptionTransactionEvidence({
  rpcUrl,
  cluster,
  signature,
  transactionSlotHint,
  expectedSourceCommit,
  expectedElfSha256,
  fetchImpl = fetch,
  requestPrefix,
}) {
  let clusterConfig;
  try {
    clusterConfig = validateEndpoint(rpcUrl, cluster);
  } catch (error) {
    return unknown(error instanceof Error ? error.message : 'RPC_ENDPOINT_VALIDATION_FAILED');
  }

  if (
    typeof signature !== 'string' ||
    !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature) ||
    typeof requestPrefix !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{0,40}$/i.test(requestPrefix)
  ) return unknown('TRANSACTION_SIGNATURE_OR_REQUEST_PREFIX_INVALID');

  const ids = {
    genesis: `${requestPrefix}:genesis`,
    transaction: `${requestPrefix}:transaction`,
    programData: `${requestPrefix}:programdata`,
  };

  try {
    const genesisRaw = await postReadOnlyRpc(
      rpcUrl,
      'getGenesisHash',
      [],
      ids.genesis,
      fetchImpl,
    );
    const genesisHash = parseEnvelope(genesisRaw, ids.genesis);
    if (genesisHash !== clusterConfig.genesisHash) {
      return rejected('RPC_CLUSTER_GENESIS_MISMATCH');
    }

    const transactionRaw = await postReadOnlyRpc(
      rpcUrl,
      'getTransaction',
      [
        signature,
        {
          commitment: 'finalized',
          encoding: 'base64',
          maxSupportedTransactionVersion: 1,
        },
      ],
      ids.transaction,
      fetchImpl,
    );
    const transactionResult = parseEnvelope(transactionRaw, ids.transaction);
    if (
      !transactionResult ||
      typeof transactionResult !== 'object' ||
      !Number.isSafeInteger(transactionResult.slot) ||
      transactionResult.slot < 0
    ) return unknown('FINALIZED_TRANSACTION_SLOT_MISSING_OR_INVALID');

    const transactionSlot = BigInt(transactionResult.slot);
    if (
      transactionSlotHint !== undefined &&
      (typeof transactionSlotHint !== 'bigint' || transactionSlotHint !== transactionSlot)
    ) return rejected('TRANSACTION_SLOT_HINT_MISMATCH');

    const programDataAddress = deriveProgramDataAddress(
      'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44',
    );
    const programDataRaw = await postReadOnlyRpc(
      rpcUrl,
      'getMultipleAccounts',
      [
        [
          'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44',
          programDataAddress,
        ],
        {
          commitment: 'finalized',
          encoding: 'base64',
          minContextSlot: transactionResult.slot,
        },
      ],
      ids.programData,
      fetchImpl,
    );

    const attested = attestSubscriptionProgramDeployment(programDataRaw, {
      requestId: ids.programData,
      providerId: clusterConfig.providerId,
      requestedCommitment: 'finalized',
      transactionSlot,
      expectedSourceCommit,
      expectedElfSha256,
    });
    if (attested.outcome !== 'attested') {
      return attested.outcome === 'rejected'
        ? rejected(attested.reason)
        : unknown(attested.reasons.join('; '));
    }

    return normalizeSubscriptionGetTransactionResponse(transactionRaw, {
      requestedCommitment: 'finalized',
      clusterGenesisHash,
      providerId: clusterConfig.providerId,
      requestId: ids.transaction,
      programDeployment: attested.attestation,
    });
  } catch (error) {
    // Never include the endpoint URL, query string, request body or API key.
    const message = error instanceof Error ? error.message : 'RPC_EVIDENCE_RETRIEVAL_FAILED';
    return unknown(message);
  }
}
