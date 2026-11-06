import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import {
  decodeBase64AccountData,
  deriveProgramDataAddress,
  parseProgramDataAccount,
  readProgramDataAddress,
  stripTrailingZeroBytes,
  UPGRADEABLE_LOADER_PROGRAM_ID,
} from './upgradeable-loader.mjs';

export const SUBSCRIPTIONS_PROGRAM_ID = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';

const U64_MAX = (1n << 64n) - 1n;

function unknown(reason) {
  return { outcome: 'unknown', reasons: [reason] };
}

function rejected(reason) {
  return { outcome: 'rejected', reason };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidBase64(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function canonicalAddress(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const encoded = new PublicKey(value).toBase58();
    return encoded === value ? encoded : null;
  } catch {
    return null;
  }
}

/**
 * Build a verifier-grade Program deployment attestation from one finalized
 * getMultipleAccounts response containing [Program, ProgramData].
 *
 * The caller must issue getMultipleAccounts with commitment=finalized and
 * minContextSlot >= the transaction slot against the already-selected cluster
 * endpoint. This function verifies the raw response correlation and all loader
 * relationships; it performs no network request and does not trust an
 * unvalidated ProgramData object supplied by a browser.
 */
export function attestSubscriptionProgramDeployment(
  rawResponseBody,
  {
    requestId,
    providerId,
    requestedCommitment,
    transactionSlot,
    expectedSourceCommit,
    expectedElfSha256,
  },
) {
  if (typeof rawResponseBody !== 'string' || rawResponseBody.length === 0) {
    return unknown('Raw ProgramData RPC response body is missing.');
  }
  if (requestedCommitment !== 'finalized') {
    return unknown('ProgramData request did not use finalized commitment.');
  }
  if (typeof providerId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(providerId)) {
    return unknown('Trusted RPC provider alias is missing or invalid.');
  }
  if (typeof expectedSourceCommit !== 'string' || !/^[0-9a-f]{40}$/.test(expectedSourceCommit)) {
    return unknown('Pinned Program source commit is missing or malformed.');
  }
  if (typeof expectedElfSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedElfSha256)) {
    return unknown('Reproducible Program ELF SHA-256 is missing or malformed.');
  }
  if (typeof transactionSlot !== 'bigint' || transactionSlot < 0n || transactionSlot > U64_MAX) {
    return unknown('Transaction slot is outside the Solana u64 domain.');
  }

  try {
    const payload = JSON.parse(rawResponseBody);
    if (
      !isRecord(payload) ||
      payload.jsonrpc !== '2.0' ||
      !Object.hasOwn(payload, 'id') ||
      payload.id !== requestId ||
      Object.hasOwn(payload, 'error') ||
      !Object.hasOwn(payload, 'result') ||
      !isRecord(payload.result)
    ) return unknown('ProgramData JSON-RPC envelope or request correlation is invalid.');

    const result = payload.result;
    const context = result.context;
    if (!isRecord(context) || !Number.isSafeInteger(context.slot) || context.slot < 0) {
      return unknown('Finalized ProgramData RPC context slot is missing or unsafe.');
    }
    const readAtSlot = BigInt(context.slot);
    if (readAtSlot < transactionSlot) {
      return unknown('Finalized ProgramData read is older than the transaction slot.');
    }

    if (!Array.isArray(result.value) || result.value.length !== 2) {
      return unknown('getMultipleAccounts must return exactly Program and ProgramData accounts.');
    }
    const [programAccount, programDataAccount] = result.value;
    if (!isRecord(programAccount) || !isRecord(programDataAccount)) {
      return unknown('Program or ProgramData account is missing.');
    }

    const programId = new PublicKey(SUBSCRIPTIONS_PROGRAM_ID);
    const loaderId = new PublicKey(UPGRADEABLE_LOADER_PROGRAM_ID);
    if (
      programAccount.owner !== loaderId.toBase58() ||
      programAccount.executable !== true ||
      programDataAccount.owner !== loaderId.toBase58() ||
      programDataAccount.executable !== false
    ) return rejected('Program/ProgramData account ownership or executable flags do not match the Upgradeable Loader contract.');

    const programDataAddress = deriveProgramDataAddress(SUBSCRIPTIONS_PROGRAM_ID);
    const programDataAccountData = decodeBase64AccountData(programAccount.data, 'PROGRAM');
    const pointedProgramData = readProgramDataAddress(programDataAccountData);
    if (pointedProgramData !== programDataAddress) {
      return rejected('Program account points to a different ProgramData PDA.');
    }

    if (
      !Array.isArray(programDataAccount.data) ||
      typeof programDataAccount.data[0] !== 'string' ||
      programDataAccount.data[1] !== 'base64' ||
      !isValidBase64(programDataAccount.data[0])
    ) return unknown('ProgramData binary account encoding is malformed.');

    const programDataBytes = Buffer.from(programDataAccount.data[0], 'base64');
    if (programDataBytes.length === 0) return unknown('ProgramData binary account is empty.');
    const parsed = parseProgramDataAccount(programDataBytes);
    const deploymentSlot = BigInt(parsed.deploymentSlot);

    // Upgradeable Loader writes a new deployment slot when code is upgraded.
    // The new ELF is active from the next slot. At the transaction's slot,
    // the approved code therefore must have deploymentSlot < transactionSlot.
    if (deploymentSlot >= transactionSlot) {
      return unknown('The currently observed ELF was not yet active at the transaction slot.');
    }

    const executableBytes = stripTrailingZeroBytes(parsed.elfBytes);
    const observedElfSha256 = createHash('sha256').update(executableBytes).digest('hex');
    if (observedElfSha256 !== expectedElfSha256) {
      return rejected('Finalized ProgramData ELF does not match the pinned reproducible Program build.');
    }

    return {
      outcome: 'attested',
      attestation: {
        programAddress: programId.toBase58(),
        sourceCommit: expectedSourceCommit,
        elfSha256: observedElfSha256,
        deploymentSlot,
        readAtSlot,
        readCommitment: 'finalized',
        attestationKind: 'current-finalized-programdata',
      },
      evidence: {
        providerId,
        requestId,
        programDataAddress,
        deploymentSlot,
        readAtSlot,
        elfSha256: observedElfSha256,
        upgradeAuthority: parsed.upgradeAuthority,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PROGRAMDATA_ATTESTATION_FAILED';
    return unknown(message);
  }
}
