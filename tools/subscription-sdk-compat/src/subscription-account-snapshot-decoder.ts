import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  address,
  getBase64Encoder,
  type Address,
  type Base64EncodedBytes,
  type EncodedAccount,
} from '@solana/kit';
import {
  decodePlan,
  decodeSubscriptionAuthority,
  decodeSubscriptionDelegation,
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
} from '@solana/subscriptions';
import {
  getMintDecoder,
  getTokenDecoder,
} from '@solana-program/token';
import { validateSubscriptionAccountState } from './subscription-account-state.js';
import type {
  ExpectedSubscriptionAccountIdentity,
  FinalizedSubscriptionAccountSnapshot,
  SubscriptionAccountStateResult,
} from './subscription-account-state.js';

const CLASSIC_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SUBSCRIPTIONS_PROGRAM = SUBSCRIPTIONS_PROGRAM_ADDRESS;
const TOKEN_ACCOUNT_BASE_BYTES = 165;
const MINT_BASE_BYTES = 82;

interface HistoricalAccountEvidence {
  readonly id: string;
  readonly address: string;
  readonly owner: string;
  readonly executable: boolean;
  readonly lamports: string;
  readonly dataBase64: string;
  readonly dataLength: number;
  readonly accountDataSha256: string;
  readonly snapshotSlot: bigint;
  readonly snapshotResponseHash: string;
}

interface HistoricalClockEvidence {
  readonly address: string;
  readonly slot: bigint;
  readonly epochStartTimestamp: bigint;
  readonly epoch: bigint;
  readonly leaderScheduleEpoch: bigint;
  readonly unixTimestamp: bigint;
  readonly accountDataSha256: string;
  readonly responseContextSlot: bigint;
}

export interface HistoricalSubscriptionAccountEvidence {
  readonly outcome: 'historical_snapshot';
  readonly evidence: {
    readonly providerId: string;
    readonly cluster: 'mainnet-beta' | 'devnet';
    readonly clusterGenesisHash: string;
    readonly transactionSignature: string;
    readonly transactionSlot: bigint;
    readonly targetTransactionIndex: number;
    readonly transactionsBeforeTarget: number;
    readonly precedingWritableConflictCount: 0;
    readonly snapshotSlot: bigint;
    readonly finalizedTipSlot: bigint;
    readonly snapshotCommitment: 'finalized';
    readonly blockResponseHash: string;
    readonly clock: HistoricalClockEvidence;
    readonly accounts: readonly HistoricalAccountEvidence[];
    readonly rpcResponseSetSha256: string;
  };
}

export type SubscriptionSnapshotDecodeResult =
  | {
      readonly outcome: 'consistent_snapshot';
      readonly snapshot: FinalizedSubscriptionAccountSnapshot;
      readonly validation: SubscriptionAccountStateResult;
      readonly evidence: 'account-state-consistency-only';
    }
  | {
      readonly outcome: 'inconsistent_snapshot';
      readonly snapshot: FinalizedSubscriptionAccountSnapshot;
      readonly validation: SubscriptionAccountStateResult;
      readonly evidence: 'account-state-consistency-only';
    }
  | {
      readonly outcome: 'unknown';
      readonly reasons: readonly string[];
    };

function unknown(reason: string): SubscriptionSnapshotDecodeResult {
  return { outcome: 'unknown', reasons: [reason] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    return address(value) === value;
  } catch {
    return false;
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function readBase64Bytes(value: unknown, expectedLength?: number): Uint8Array {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) throw new Error('SNAPSHOT_ACCOUNT_BASE64_INVALID');

  const bytes = Buffer.from(value, 'base64');
  if (
    bytes.length === 0 ||
    (expectedLength !== undefined && bytes.length !== expectedLength)
  ) throw new Error('SNAPSHOT_ACCOUNT_DATA_LENGTH_UNSUPPORTED');
  return new Uint8Array(bytes);
}

function requiredAccount(
  evidence: HistoricalSubscriptionAccountEvidence['evidence'],
  id: string,
): HistoricalAccountEvidence {
  const matches = evidence.accounts.filter(account => account.id === id);
  if (matches.length !== 1) throw new Error('SNAPSHOT_REQUIRED_ACCOUNT_CARDINALITY:' + id);
  return matches[0];
}

function asEncodedAccount(account: HistoricalAccountEvidence): EncodedAccount {
  if (
    !isSafeAddress(account.address) ||
    !isSafeAddress(account.owner) ||
    account.executable !== false ||
    !/^(0|[1-9][0-9]*)$/.test(account.lamports) ||
    !Number.isSafeInteger(account.dataLength) ||
    account.dataLength <= 0 ||
    !isSha256(account.accountDataSha256) ||
    !isSha256(account.snapshotResponseHash)
  ) throw new Error('SNAPSHOT_ACCOUNT_PROVENANCE_INVALID');

  const bytes = readBase64Bytes(account.dataBase64, account.dataLength);
  const observedHash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  if (observedHash !== account.accountDataSha256) {
    throw new Error('SNAPSHOT_ACCOUNT_DATA_HASH_MISMATCH');
  }

  return {
    address: address(account.address),
    data: getBase64Encoder().encode(account.dataBase64 as Base64EncodedBytes),
    executable: account.executable,
    lamports: BigInt(account.lamports),
    programAddress: address(account.owner),
    space: BigInt(account.dataLength),
  } as EncodedAccount;
}

function unwrapOptionAddress(value: unknown): Address | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && isSafeAddress(value)) return address(value);
  if (isRecord(value)) {
    if (value.__option === 'None' || value.__option === 'NoneValue') return null;
    if (value.__option === 'Some' && typeof value.value === 'string' && isSafeAddress(value.value)) {
      return value.value;
    }
    if (Object.hasOwn(value, 'value') && value.value === null) return null;
    if (Object.hasOwn(value, 'value') && typeof value.value === 'string' && isSafeAddress(value.value)) {
      return value.value;
    }
  }
  throw new Error('SNAPSHOT_OPTION_ADDRESS_SHAPE_UNSUPPORTED');
}

function assertClock(archive: HistoricalSubscriptionAccountEvidence['evidence']): void {
  const transactionSlot = archive.transactionSlot;
  const clock = archive.clock;
  if (
    typeof transactionSlot !== 'bigint' ||
    transactionSlot <= 0n ||
    archive.snapshotSlot !== transactionSlot - 1n ||
    clock.slot !== transactionSlot ||
    clock.responseContextSlot !== transactionSlot ||
    clock.address !== 'SysvarC1ock11111111111111111111111111111111' ||
    typeof clock.unixTimestamp !== 'bigint' ||
    clock.unixTimestamp < 0n ||
    typeof clock.epoch !== 'bigint' ||
    typeof clock.epochStartTimestamp !== 'bigint' ||
    typeof clock.leaderScheduleEpoch !== 'bigint' ||
    !isSha256(clock.accountDataSha256)
  ) throw new Error('SNAPSHOT_CLOCK_PROVENANCE_INVALID');
  if (
    !Number.isSafeInteger(archive.targetTransactionIndex) ||
    archive.targetTransactionIndex < 0 ||
    archive.transactionsBeforeTarget !== archive.targetTransactionIndex ||
    archive.precedingWritableConflictCount !== 0 ||
    archive.snapshotCommitment !== 'finalized' ||
    archive.finalizedTipSlot < transactionSlot ||
    !isSha256(archive.blockResponseHash) ||
    !isSha256(archive.rpcResponseSetSha256)
  ) throw new Error('SNAPSHOT_BLOCK_ORDER_PROVENANCE_INVALID');
}

function decodePlanAccount(account: HistoricalAccountEvidence) {
  if (account.owner !== SUBSCRIPTIONS_PROGRAM || account.executable !== false) {
    throw new Error('SNAPSHOT_PROGRAM_ACCOUNT_OWNER_MISMATCH:plan');
  }
  const decoded = decodePlan(asEncodedAccount(account));
  return {
    address: decoded.address,
    programAddress: address(SUBSCRIPTIONS_PROGRAM),
    data: decoded.data,
  };
}

function decodeSubscriptionAccount(account: HistoricalAccountEvidence) {
  if (account.owner !== SUBSCRIPTIONS_PROGRAM || account.executable !== false) {
    throw new Error('SNAPSHOT_PROGRAM_ACCOUNT_OWNER_MISMATCH:subscription');
  }
  const decoded = decodeSubscriptionDelegation(asEncodedAccount(account));
  return {
    address: decoded.address,
    programAddress: address(SUBSCRIPTIONS_PROGRAM),
    data: decoded.data,
  };
}

function decodeAuthorityAccount(account: HistoricalAccountEvidence) {
  if (account.owner !== SUBSCRIPTIONS_PROGRAM || account.executable !== false) {
    throw new Error('SNAPSHOT_PROGRAM_ACCOUNT_OWNER_MISMATCH:authority');
  }
  const decoded = decodeSubscriptionAuthority(asEncodedAccount(account));
  return {
    address: decoded.address,
    programAddress: address(SUBSCRIPTIONS_PROGRAM),
    data: decoded.data,
  };
}

/**
 * Decode a historical pre-transaction account snapshot with the exact pinned
 * Solana Subscriptions and original SPL Token SDK decoders, then run the
 * independent account-state consistency policy.
 *
 * This adapter is server-only. It does not fetch RPC, sign, submit, write DB,
 * account for a transfer, establish payment or grant entitlement.
 *
 * Token-2022 and extension-bearing account layouts remain UNKNOWN here. The
 * current account-state policy explicitly pins original SPL Token. Silently
 * treating extension-bearing Token-2022 data as ordinary SPL state could
 * ignore transfer hooks, transfer fees and other account/mint semantics.
 */
export async function decodeHistoricalSubscriptionAccountSnapshot(
  expected: ExpectedSubscriptionAccountIdentity,
  archiveResult: HistoricalSubscriptionAccountEvidence | unknown,
): Promise<SubscriptionSnapshotDecodeResult> {
  try {
    if (!isRecord(archiveResult) || archiveResult.outcome !== 'historical_snapshot' ||
        !isRecord(archiveResult.evidence)) {
      return unknown('HISTORICAL_ACCOUNT_EVIDENCE_MISSING');
    }

    const archive = archiveResult.evidence as HistoricalSubscriptionAccountEvidence['evidence'];
    if (
      archive.clusterGenesisHash !== expected.clusterGenesisHash ||
      !['mainnet-beta', 'devnet'].includes(archive.cluster) ||
      typeof archive.providerId !== 'string' ||
      !/^alchemy-account-archive-(mainnet|devnet)$/.test(archive.providerId) ||
      !Array.isArray(archive.accounts) ||
      archive.accounts.length !== 5
    ) return unknown('HISTORICAL_ACCOUNT_EVIDENCE_PROVENANCE_INVALID');

    assertClock(archive);

    const accountIds = new Set(archive.accounts.map(account => account.id));
    for (const id of ['plan', 'subscription', 'authority', 'mint', 'tokenAccount']) {
      if (!accountIds.has(id)) return unknown('SNAPSHOT_REQUIRED_ACCOUNT_MISSING:' + id);
    }
    if (accountIds.size !== 5) return unknown('SNAPSHOT_ACCOUNT_SET_NOT_CANONICAL');

    for (const account of archive.accounts) {
      if (account.snapshotSlot !== archive.snapshotSlot) {
        return unknown('SNAPSHOT_ACCOUNT_SLOT_MISMATCH');
      }
    }

    const planRaw = requiredAccount(archive, 'plan');
    const subscriptionRaw = requiredAccount(archive, 'subscription');
    const authorityRaw = requiredAccount(archive, 'authority');
    const mintRaw = requiredAccount(archive, 'mint');
    const tokenRaw = requiredAccount(archive, 'tokenAccount');

    const tokenOwner = address(CLASSIC_TOKEN_PROGRAM);
    if (
      mintRaw.owner !== CLASSIC_TOKEN_PROGRAM ||
      tokenRaw.owner !== CLASSIC_TOKEN_PROGRAM ||
      mintRaw.executable !== false ||
      tokenRaw.executable !== false
    ) throw new Error('SNAPSHOT_TOKEN_PROGRAM_UNSUPPORTED');

    const mintBytes = readBase64Bytes(mintRaw.dataBase64, MINT_BASE_BYTES);
    const tokenBytes = readBase64Bytes(tokenRaw.dataBase64, TOKEN_ACCOUNT_BASE_BYTES);
    const mint = getMintDecoder().decode(mintBytes);
    const tokenAccount = getTokenDecoder().decode(tokenBytes);

    const mintAddress = address(mintRaw.address);
    const tokenAddress = address(tokenRaw.address);
    if (tokenAccount.mint !== mintAddress) {
      throw new Error('SNAPSHOT_TOKEN_MINT_IDENTITY_MISMATCH');
    }

    const snapshot: FinalizedSubscriptionAccountSnapshot = {
      commitment: 'finalized',
      clusterGenesisHash: archive.clusterGenesisHash,
      slot: archive.transactionSlot,
      blockTimeUnixSeconds: archive.clock.unixTimestamp,
      plan: decodePlanAccount(planRaw),
      subscription: decodeSubscriptionAccount(subscriptionRaw),
      authority: decodeAuthorityAccount(authorityRaw),
      mint: {
        address: mintAddress,
        programAddress: tokenOwner,
        decimals: mint.decimals,
        initialized: mint.isInitialized,
      },
      tokenAccount: {
        address: tokenAddress,
        programAddress: tokenOwner,
        mint: tokenAccount.mint,
        owner: tokenAccount.owner,
        delegate: unwrapOptionAddress(tokenAccount.delegate),
        amountAtomic: tokenAccount.amount,
        delegatedAmountAtomic: tokenAccount.delegatedAmount,
        state:
          tokenAccount.state === 1 ? 'initialized' :
          tokenAccount.state === 2 ? 'frozen' :
          'uninitialized',
      },
    };

    const validation = await validateSubscriptionAccountState(expected, snapshot);
    return {
      outcome: validation.consistent ? 'consistent_snapshot' : 'inconsistent_snapshot',
      snapshot,
      validation,
      evidence: 'account-state-consistency-only',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SUBSCRIPTION_SNAPSHOT_DECODE_FAILED';
    return unknown(message);
  }
}
