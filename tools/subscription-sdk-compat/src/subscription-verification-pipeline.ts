import {
  normalizeSubscriptionGetTransactionResponse,
} from './subscription-rpc-evidence.js';
import type {
  ExpectedSubscriptionTransaction,
  ProgramDeploymentAttestation,
  SubscriptionTransactionVerification,
} from './subscription-transaction-verifier.js';
import {
  verifySubscriptionTransferTransaction,
} from './subscription-transaction-verifier.js';
import {
  decodeHistoricalSubscriptionAccountSnapshot,
} from './subscription-account-snapshot-decoder.js';
import type {
  ExpectedSubscriptionAccountIdentity,
  SubscriptionAccountStateResult,
} from './subscription-account-state.js';

export interface SubscriptionVerificationRpcProvenance {
  readonly requestedCommitment: 'processed' | 'confirmed' | 'finalized';
  readonly clusterGenesisHash: string;
  readonly providerId: string;
  readonly requestId: string | number;
  readonly programDeployment: ProgramDeploymentAttestation | null;
}

export type ExpectedSubscriptionTransactionWithoutPeriod = Omit<
  ExpectedSubscriptionTransaction,
  'expectedPeriodStartTs' | 'expectedPeriodEndTs' | 'expectedCumulativeAmountAtomic' |
    'planOwner' | 'authorizedPullers' | 'allowedDestinationOwners'
>;

export type SubscriptionVerificationPipelineStage =
  | 'transaction_rpc'
  | 'attempt_correlation'
  | 'historical_account_state'
  | 'period_capacity'
  | 'transaction_policy';

export type SubscriptionVerificationPipelineResult =
  | {
      readonly outcome: 'verified_observation';
      readonly observation: Extract<
        SubscriptionTransactionVerification,
        { outcome: 'verified_observation' }
      >;
      readonly evidence: 'finalized-transaction-plus-prestate-archive';
      readonly accountState: SubscriptionAccountStateResult;
      readonly period: {
        readonly periodStartTs: bigint;
        readonly periodEndTs: bigint;
        readonly cumulativeAmountBeforeAtomic: bigint;
        readonly cumulativeAmountAfterAtomic: bigint;
        readonly remainingAllowanceBeforeAtomic: bigint;
        readonly sourceBalanceBeforeAtomic: bigint;
        readonly sourceDelegateAllowanceBeforeAtomic: bigint;
      };
      readonly archive: {
        readonly providerId: string;
        readonly transactionSlot: bigint;
        readonly snapshotSlot: bigint;
        readonly targetTransactionIndex: number;
        readonly transactionsBeforeTarget: number;
        readonly rpcResponseSetSha256: string;
        readonly blockResponseHash: string;
      };
    }
  | {
      readonly outcome: 'rejected';
      readonly stage: SubscriptionVerificationPipelineStage;
      readonly failures: readonly string[];
    }
  | {
      readonly outcome: 'unknown';
      readonly stage: SubscriptionVerificationPipelineStage;
      readonly reasons: readonly string[];
    };

export interface VerifySubscriptionAttemptPipelineInput {
  /** Server-resolved immutable Customer/Plan/Subscription/asset identity. */
  readonly expectedAccountIdentity: ExpectedSubscriptionAccountIdentity;
  /** Server-persisted Attempt correlation and approved single-transfer policy. */
  readonly expectedTransaction: ExpectedSubscriptionTransactionWithoutPeriod;
  /** Provenance created by the trusted RPC adapter, never accepted from a browser. */
  readonly rpcProvenance: SubscriptionVerificationRpcProvenance;
  /** Exact raw JSON-RPC getTransaction response, not caller-parsed JSON. */
  readonly rawTransactionResponseBody: string;
  /** Result of the historical pre-state archive reader; raw bytes remain server-side. */
  readonly historicalAccountEvidence: unknown;
}

function reject(
  stage: SubscriptionVerificationPipelineStage,
  failures: readonly string[],
): SubscriptionVerificationPipelineResult {
  return { outcome: 'rejected', stage, failures: [...new Set(failures)] };
}

function unknown(
  stage: SubscriptionVerificationPipelineStage,
  reasons: readonly string[],
): SubscriptionVerificationPipelineResult {
  return { outcome: 'unknown', stage, reasons: [...new Set(reasons)] };
}

/**
 * Joins the previously separate evidence modules into one fail-closed,
 * server-only verification pipeline for the pinned v0.5.0 single-pull path.
 *
 * The historical archive must prove that Plan, Subscription, Authority,
 * Mint and source ATA were read at slot S-1 and that no earlier transaction
 * in slot S wrote any of those accounts. The archive Clock sysvar at S is
 * authoritative for period rollover. The raw transaction is independently
 * normalized and verified at finalized commitment. The period fields passed
 * to the transaction verifier are derived here from the decoded pre-state;
 * callers cannot supply an event-derived period/cumulative amount.
 *
 * This returns only a verified transaction observation. It does not persist,
 * account, settle, mark a Cycle complete, grant entitlement or report paid.
 */
export async function verifySubscriptionAttemptPipeline(
  input: VerifySubscriptionAttemptPipelineInput,
): Promise<SubscriptionVerificationPipelineResult> {
  const normalized = normalizeSubscriptionGetTransactionResponse(
    input.rawTransactionResponseBody,
    input.rpcProvenance,
  );
  if (normalized.outcome !== 'normalized') {
    return unknown('transaction_rpc', normalized.reasons);
  }

  const evidence = normalized.evidence;
  if (evidence.clusterGenesisHash !== input.expectedAccountIdentity.clusterGenesisHash) {
    return reject('attempt_correlation', ['cluster_genesis_mismatch']);
  }
  if (evidence.signature !== input.expectedTransaction.expectedSignature) {
    return reject('attempt_correlation', ['attempt_signature_mismatch']);
  }
  if (evidence.messageHash !== input.expectedTransaction.expectedMessageHash) {
    return reject('attempt_correlation', ['attempt_message_mismatch']);
  }
  if (evidence.transactionError === undefined) {
    return unknown('transaction_rpc', ['Finalized transaction execution metadata is missing.']);
  }
  if (evidence.transactionError !== null) {
    return reject('transaction_policy', ['transaction_execution_failed']);
  }

  const snapshotResult = await decodeHistoricalSubscriptionAccountSnapshot(
    input.expectedAccountIdentity,
    evidence,
    input.historicalAccountEvidence,
  );
  if (snapshotResult.outcome === 'unknown') {
    return unknown('historical_account_state', snapshotResult.reasons);
  }
  if (snapshotResult.outcome === 'inconsistent_snapshot') {
    return reject(
      'historical_account_state',
      snapshotResult.validation.failures,
    );
  }

  const snapshot = snapshotResult.snapshot;
  const validation = snapshotResult.validation;

  // Merchant, subscriber, Plan/Subscription/Authority PDAs, source ATA and Mint
  // must be the same identities in the Attempt and the independently decoded
  // historical account set. A stale backend snapshot must not redirect a pull.
  if (
    input.expectedTransaction.merchant !== input.expectedAccountIdentity.merchant ||
    input.expectedTransaction.subscriber !== input.expectedAccountIdentity.subscriber ||
    input.expectedTransaction.mint !== input.expectedAccountIdentity.mint ||
    input.expectedTransaction.mintDecimals !== snapshot.mint.decimals ||
    input.expectedTransaction.planPda !== snapshot.plan.address ||
    input.expectedTransaction.subscriptionPda !== snapshot.subscription.address ||
    input.expectedTransaction.authorityPda !== snapshot.authority.address ||
    input.expectedTransaction.sourceAta !== snapshot.tokenAccount.address
  ) {
    return reject('attempt_correlation', ['attempt_historical_account_identity_mismatch']);
  }
  if (
    snapshot.plan.owner !== input.expectedAccountIdentity.merchant ||
    snapshot.plan.owner !== input.expectedTransaction.merchant
  ) {
    return reject('historical_account_state', ['plan_owner_merchant_identity_mismatch']);
  }

  const periodStartTs = validation.effectivePeriodStartTs;
  const cumulativeBefore = validation.amountPulledInEffectivePeriodAtomic;
  const remainingBefore = validation.remainingPeriodAllowanceAtomic;
  if (
    periodStartTs === null ||
    cumulativeBefore === null ||
    remainingBefore === null
  ) {
    return unknown('period_capacity', [
      'Historical Subscription state did not yield a determinate effective period and cumulative allowance.',
    ]);
  }

  const amountAtomic = input.expectedTransaction.expectedAmountAtomic;
  const periodHours = snapshot.plan.data.terms.periodHours;
  if (
    typeof amountAtomic !== 'bigint' ||
    amountAtomic <= 0n ||
    typeof periodHours !== 'bigint' ||
    periodHours <= 0n ||
    periodHours > 8_760n
  ) {
    return reject('period_capacity', ['attempt_amount_or_plan_period_invalid']);
  }

  const periodEndTs = periodStartTs + periodHours * 3_600n;
  const cumulativeAfter = cumulativeBefore + amountAtomic;
  const i64Max = (1n << 63n) - 1n;
  if (
    periodStartTs < 0n ||
    periodEndTs > i64Max ||
    cumulativeAfter > snapshot.plan.data.terms.amount
  ) {
    return reject('period_capacity', ['period_cumulative_allowance_exceeded']);
  }
  if (
    amountAtomic > remainingBefore ||
    amountAtomic > validation.sourceBalanceAtomic ||
    amountAtomic > validation.sourceDelegateAllowanceAtomic ||
    amountAtomic > validation.snapshotTransferCapacityAtomic
  ) {
    return reject('period_capacity', ['snapshot_transfer_capacity_insufficient']);
  }

  const expectedTransaction: ExpectedSubscriptionTransaction = {
    ...input.expectedTransaction,
    // These authorization facts come from the finalized on-chain Plan
    // snapshot, never from caller-supplied backend/browser lists.
    planOwner: snapshot.plan.owner,
    authorizedPullers: validation.authorizedPullers,
    allowedDestinationOwners: validation.allowedDestinationOwners,
    expectedPeriodStartTs: periodStartTs,
    expectedPeriodEndTs: periodEndTs,
    expectedCumulativeAmountAtomic: cumulativeAfter,
  };

  const verification = verifySubscriptionTransferTransaction(
    expectedTransaction,
    evidence,
  );
  if (verification.outcome === 'unknown') {
    return unknown('transaction_policy', verification.reasons);
  }
  if (verification.outcome === 'rejected') {
    return reject('transaction_policy', verification.failures);
  }

  return {
    outcome: 'verified_observation',
    observation: verification,
    evidence: 'finalized-transaction-plus-prestate-archive',
    accountState: validation,
    period: {
      periodStartTs,
      periodEndTs,
      cumulativeAmountBeforeAtomic: cumulativeBefore,
      cumulativeAmountAfterAtomic: cumulativeAfter,
      remainingAllowanceBeforeAtomic: remainingBefore,
      sourceBalanceBeforeAtomic: validation.sourceBalanceAtomic,
      sourceDelegateAllowanceBeforeAtomic: validation.sourceDelegateAllowanceAtomic,
    },
    archive: {
      providerId: snapshotResult.archiveEvidence.providerId,
      transactionSlot: snapshotResult.archiveEvidence.transactionSlot,
      snapshotSlot: snapshotResult.archiveEvidence.snapshotSlot,
      targetTransactionIndex: snapshotResult.archiveEvidence.targetTransactionIndex,
      transactionsBeforeTarget: snapshotResult.archiveEvidence.transactionsBeforeTarget,
      rpcResponseSetSha256: snapshotResult.archiveEvidence.rpcResponseSetSha256,
      blockResponseHash: snapshotResult.archiveEvidence.blockResponseHash,
    },
  };
}
