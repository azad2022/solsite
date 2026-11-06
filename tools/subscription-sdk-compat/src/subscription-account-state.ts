import type { Address } from '@solana/kit';
import { findAssociatedTokenPda } from '@solana-program/token';
import {
  findPlanPda,
  findSubscriptionAuthorityPda,
  findSubscriptionDelegationPda,
  PlanStatus,
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
} from '@solana/subscriptions';
import type {
  Plan,
  SubscriptionAuthority,
  SubscriptionDelegation,
} from '@solana/subscriptions';

/**
 * A decoded account returned by the pinned upstream Subscriptions SDK.
 * All accounts in a snapshot must be decoded from one finalized
 * getMultipleAccounts response, not fetched independently at moving slots.
 */
export interface DecodedProgramAccount<T> {
  readonly address: Address;
  readonly programAddress: Address;
  readonly data: T;
}

/**
 * Normalized SPL Token account data. The future RPC adapter must populate
 * this using the pinned SPL Token decoder; browser-supplied values are never
 * accepted by this policy.
 */
export interface SplTokenAccountState {
  readonly address: Address;
  readonly programAddress: Address;
  readonly mint: Address;
  readonly owner: Address;
  readonly delegate: Address | null;
  readonly amountAtomic: bigint;
  readonly delegatedAmountAtomic: bigint;
  readonly state: 'initialized' | 'frozen' | 'uninitialized';
}

/** Normalized SPL Token mint data decoded by the server-side RPC adapter. */
export interface SplTokenMintState {
  readonly address: Address;
  readonly programAddress: Address;
  readonly decimals: number;
  readonly initialized: boolean;
}

/**
 * Cross-account state at one finalized slot.
 * blockTimeUnixSeconds must be the block time for observedSlot.
 */
export interface FinalizedSubscriptionAccountSnapshot {
  readonly commitment: string;
  readonly clusterGenesisHash: string;
  readonly slot: bigint;
  readonly blockTimeUnixSeconds: bigint;
  readonly plan: DecodedProgramAccount<Plan>;
  readonly subscription: DecodedProgramAccount<SubscriptionDelegation>;
  readonly authority: DecodedProgramAccount<SubscriptionAuthority>;
  readonly mint: SplTokenMintState;
  readonly tokenAccount: SplTokenAccountState;
}

export interface ExpectedSubscriptionAccountIdentity {
  /** Server-configured cluster identity; never supplied by the browser. */
  readonly clusterGenesisHash: string;
  readonly merchant: Address;
  readonly planId: bigint;
  readonly subscriber: Address;
  readonly mint: Address;
  /** The token account bound to the server-side consent record. */
  readonly tokenAccount: Address;
  readonly mintDecimals: number;
}

export type SubscriptionAccountStateFailureCode =
  | 'snapshot_not_finalized'
  | 'cluster_genesis_mismatch'
  | 'invalid_chain_context'
  | 'program_owner_mismatch'
  | 'plan_pda_mismatch'
  | 'plan_identity_mismatch'
  | 'plan_status_invalid'
  | 'finite_plan_not_supported'
  | 'plan_terms_invalid'
  | 'plan_destination_allowlist_empty'
  | 'subscription_pda_mismatch'
  | 'subscription_identity_mismatch'
  | 'subscription_version_unsupported'
  | 'subscription_authority_generation_invalid'
  | 'subscription_terms_mismatch'
  | 'subscription_period_state_invalid'
  | 'subscription_expired_or_cancelled'
  | 'subscription_authority_pda_mismatch'
  | 'subscription_authority_identity_mismatch'
  | 'subscription_authority_generation_mismatch'
  | 'mint_identity_mismatch'
  | 'mint_program_unsupported'
  | 'mint_decimals_mismatch'
  | 'mint_not_initialized'
  | 'token_account_identity_mismatch'
  | 'token_account_ata_mismatch'
  | 'token_account_program_unsupported'
  | 'token_account_not_transferable'
  | 'token_account_delegate_mismatch'
  | 'token_account_amount_invalid';

export interface SubscriptionAccountStateResult {
  readonly consistent: boolean;
  readonly failures: readonly SubscriptionAccountStateFailureCode[];
  /** This result is account-state evidence only, never transaction/payment proof. */
  readonly evidence: 'account-state-consistency-only';
  readonly observedSlot: bigint;
  readonly observedBlockTimeUnixSeconds: bigint;
  readonly planStatus: PlanStatus;
  /** Plan Owner is an implicit authorized puller in the pinned Program. */
  readonly authorizedPullers: readonly Address[];
  readonly allowedDestinationOwners: readonly Address[];
  /** Sunset blocks new Subscribe calls but does not itself stop existing pulls. */
  readonly newEnrollmentsAllowed: boolean;
  readonly cancellationPending: boolean;
  readonly effectivePeriodStartTs: bigint | null;
  readonly amountPulledInEffectivePeriodAtomic: bigint | null;
  readonly remainingPeriodAllowanceAtomic: bigint | null;
  readonly sourceBalanceAtomic: bigint;
  readonly sourceDelegateAllowanceAtomic: bigint;
  /**
   * Read-only upper bound at observedSlot, not a reservation or permission
   * to submit TransferSubscription. This capacity becomes stale immediately.
   */
  readonly snapshotTransferCapacityAtomic: bigint;
}

const SPL_TOKEN_PROGRAM_ADDRESS =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const ZERO_ADDRESS = '11111111111111111111111111111111';
const UNKNOWN_INIT_ID = -(1n << 63n);
const MAX_PLAN_PERIOD_HOURS = 8_760n;
const SECONDS_PER_HOUR = 3_600n;
const U64_MAX = (1n << 64n) - 1n;
const I64_MAX = (1n << 63n) - 1n;
const CURRENT_DELEGATION_VERSION = 1;

function isU64(value: bigint): boolean {
  return value >= 0n && value <= U64_MAX;
}

function isNonNegativeI64(value: bigint): boolean {
  return value >= 0n && value <= I64_MAX;
}

function minBigInt(values: readonly bigint[]): bigint {
  return values.reduce((lowest, value) => value < lowest ? value : lowest);
}

/**
 * Checks cross-account identity and the currently observed period allowance
 * for an existing SubscriptionDelegation.
 *
 * It does NOT verify a transaction, TransferSubscription instruction, actual
 * token movement, all authorized Pullers' competing activity, a billing
 * Attempt, accounting, an outbox event, or entitlement. Those require a
 * separate finalized transaction verifier and atomic database commit.
 *
 * The supplied snapshot is not trusted merely because this function accepts
 * it: the future server-side adapter must verify RPC provenance, genesis hash,
 * Program deployment identity and that all accounts came from one finalized
 * bank slot before calling this pure policy.
 */
export async function validateSubscriptionAccountState(
  expected: ExpectedSubscriptionAccountIdentity,
  snapshot: FinalizedSubscriptionAccountSnapshot,
): Promise<SubscriptionAccountStateResult> {
  const failures: SubscriptionAccountStateFailureCode[] = [];
  const programAddress = SUBSCRIPTIONS_PROGRAM_ADDRESS;

  if (snapshot.commitment !== 'finalized') failures.push('snapshot_not_finalized');
  if (
    !expected.clusterGenesisHash ||
    !snapshot.clusterGenesisHash ||
    snapshot.clusterGenesisHash !== expected.clusterGenesisHash
  ) failures.push('cluster_genesis_mismatch');
  if (
    snapshot.slot < 0n ||
    !isNonNegativeI64(snapshot.blockTimeUnixSeconds)
  ) failures.push('invalid_chain_context');

  for (const account of [snapshot.plan, snapshot.subscription, snapshot.authority]) {
    if (account.programAddress !== programAddress) failures.push('program_owner_mismatch');
  }

  const [expectedPlanAddress] = await findPlanPda(
    { owner: expected.merchant, planId: expected.planId },
    { programAddress },
  );
  const [expectedSubscriptionAddress] = await findSubscriptionDelegationPda(
    { planPda: expectedPlanAddress, subscriber: expected.subscriber },
    { programAddress },
  );
  const [expectedAuthorityAddress] = await findSubscriptionAuthorityPda(
    { user: expected.subscriber, tokenMint: expected.mint },
    { programAddress },
  );

  const plan = snapshot.plan.data;
  const subscription = snapshot.subscription.data;
  const authority = snapshot.authority.data;
  const planTerms = plan.data.terms;

  if (snapshot.plan.address !== expectedPlanAddress) failures.push('plan_pda_mismatch');
  if (
    plan.owner !== expected.merchant ||
    plan.data.planId !== expected.planId ||
    plan.data.mint !== expected.mint
  ) failures.push('plan_identity_mismatch');

  const knownPlanStatus =
    plan.status === PlanStatus.Active || plan.status === PlanStatus.Sunset;
  if (!knownPlanStatus) failures.push('plan_status_invalid');
  if (plan.data.endTs !== 0n) failures.push('finite_plan_not_supported');
  if (
    !isU64(planTerms.amount) ||
    planTerms.amount === 0n ||
    !isU64(planTerms.periodHours) ||
    planTerms.periodHours === 0n ||
    planTerms.periodHours > MAX_PLAN_PERIOD_HOURS ||
    !isNonNegativeI64(planTerms.createdAt) ||
    planTerms.createdAt > snapshot.blockTimeUnixSeconds
  ) failures.push('plan_terms_invalid');

  const allowedDestinationOwners = plan.data.destinations.filter(
    destination => destination !== ZERO_ADDRESS,
  );
  if (allowedDestinationOwners.length === 0) {
    failures.push('plan_destination_allowlist_empty');
  }

  if (snapshot.subscription.address !== expectedSubscriptionAddress) {
    failures.push('subscription_pda_mismatch');
  }
  if (
    subscription.header.delegator !== expected.subscriber ||
    subscription.header.delegatee !== expectedPlanAddress
  ) failures.push('subscription_identity_mismatch');
  if (subscription.header.version !== CURRENT_DELEGATION_VERSION) {
    failures.push('subscription_version_unsupported');
  }
  if (
    subscription.header.initId === UNKNOWN_INIT_ID ||
    !isNonNegativeI64(subscription.header.initId) ||
    authority.initId === UNKNOWN_INIT_ID ||
    !isNonNegativeI64(authority.initId)
  ) failures.push('subscription_authority_generation_invalid');
  if (
    subscription.terms.amount !== planTerms.amount ||
    subscription.terms.periodHours !== planTerms.periodHours ||
    subscription.terms.createdAt !== planTerms.createdAt
  ) failures.push('subscription_terms_mismatch');

  if (
    !isU64(subscription.amountPulledInPeriod) ||
    !isNonNegativeI64(subscription.currentPeriodStartTs) ||
    !isNonNegativeI64(subscription.expiresAtTs) ||
    subscription.currentPeriodStartTs > snapshot.blockTimeUnixSeconds
  ) failures.push('subscription_period_state_invalid');
  if (
    isU64(subscription.amountPulledInPeriod) &&
    isU64(planTerms.amount) &&
    subscription.amountPulledInPeriod > planTerms.amount
  ) failures.push('subscription_period_state_invalid');
  // The pinned TransferSubscription handler rejects at current_ts >= expires_at_ts.
  // Equality is the hard stop; no pull is valid at the exact cancellation boundary.
  if (
    subscription.expiresAtTs !== 0n &&
    snapshot.blockTimeUnixSeconds >= subscription.expiresAtTs
  ) failures.push('subscription_expired_or_cancelled');

  if (snapshot.authority.address !== expectedAuthorityAddress) {
    failures.push('subscription_authority_pda_mismatch');
  }
  if (
    authority.user !== expected.subscriber ||
    authority.tokenMint !== expected.mint
  ) failures.push('subscription_authority_identity_mismatch');
  if (authority.initId !== subscription.header.initId) {
    failures.push('subscription_authority_generation_mismatch');
  }

  if (snapshot.mint.address !== expected.mint) failures.push('mint_identity_mismatch');
  if (snapshot.mint.programAddress !== SPL_TOKEN_PROGRAM_ADDRESS) {
    failures.push('mint_program_unsupported');
  }
  if (snapshot.mint.decimals !== expected.mintDecimals) {
    failures.push('mint_decimals_mismatch');
  }
  if (!snapshot.mint.initialized) failures.push('mint_not_initialized');

  const [expectedAssociatedTokenAddress] = await findAssociatedTokenPda({
    owner: expected.subscriber,
    mint: expected.mint,
    tokenProgram: SPL_TOKEN_PROGRAM_ADDRESS as Address,
  });
  if (
    snapshot.tokenAccount.address !== expected.tokenAccount ||
    snapshot.tokenAccount.owner !== expected.subscriber ||
    snapshot.tokenAccount.mint !== expected.mint
  ) failures.push('token_account_identity_mismatch');
  if (
    expected.tokenAccount !== expectedAssociatedTokenAddress ||
    snapshot.tokenAccount.address !== expectedAssociatedTokenAddress
  ) failures.push('token_account_ata_mismatch');
  if (snapshot.tokenAccount.programAddress !== SPL_TOKEN_PROGRAM_ADDRESS) {
    failures.push('token_account_program_unsupported');
  }
  if (snapshot.tokenAccount.state !== 'initialized') {
    failures.push('token_account_not_transferable');
  }
  if (snapshot.tokenAccount.delegate !== expectedAuthorityAddress) {
    failures.push('token_account_delegate_mismatch');
  }
  if (
    !isU64(snapshot.tokenAccount.amountAtomic) ||
    !isU64(snapshot.tokenAccount.delegatedAmountAtomic)
  ) failures.push('token_account_amount_invalid');

  const periodLengthSeconds = planTerms.periodHours * SECONDS_PER_HOUR;
  let effectivePeriodStartTs: bigint | null = null;
  let amountPulledInEffectivePeriodAtomic: bigint | null = null;
  let remainingPeriodAllowanceAtomic: bigint | null = null;

  if (
    isU64(planTerms.periodHours) &&
    planTerms.periodHours > 0n &&
    isNonNegativeI64(subscription.currentPeriodStartTs) &&
    subscription.currentPeriodStartTs <= snapshot.blockTimeUnixSeconds &&
    isU64(subscription.amountPulledInPeriod) &&
    isU64(planTerms.amount) &&
    subscription.amountPulledInPeriod <= planTerms.amount &&
    isNonNegativeI64(subscription.expiresAtTs) &&
    periodLengthSeconds > 0n
  ) {
    // Mirror validate_recurring_transfer() in the pinned Program:
    // advance by whole periods, but never open a new allowance whose period
    // starts at or after a scheduled cancellation/expiry timestamp.
    let effectiveStart = subscription.currentPeriodStartTs;
    let effectivePulled = subscription.amountPulledInPeriod;
    const elapsedSeconds =
      snapshot.blockTimeUnixSeconds - subscription.currentPeriodStartTs;

    if (elapsedSeconds >= periodLengthSeconds) {
      const periodsPassed = elapsedSeconds / periodLengthSeconds;
      const candidateStart =
        subscription.currentPeriodStartTs + periodsPassed * periodLengthSeconds;

      if (
        subscription.expiresAtTs === 0n ||
        candidateStart < subscription.expiresAtTs
      ) {
        effectiveStart = candidateStart;
        effectivePulled = 0n;
      } else {
        // The Program caps catch-up at the last period boundary strictly
        // before expiresAtTs. At the exact expiry boundary the final
        // in-bounds period remains usable, but a fresh post-expiry allowance
        // is never opened.
        const lastBillableTs = subscription.expiresAtTs - 1n;
        if (lastBillableTs >= subscription.currentPeriodStartTs) {
          const inBoundsSpan =
            lastBillableTs - subscription.currentPeriodStartTs;
          const inBoundsPeriods = inBoundsSpan / periodLengthSeconds;
          const lastInBoundsStart =
            subscription.currentPeriodStartTs +
            inBoundsPeriods * periodLengthSeconds;
          if (lastInBoundsStart > subscription.currentPeriodStartTs) {
            effectiveStart = lastInBoundsStart;
            effectivePulled = 0n;
          }
        }
      }
    }

    effectivePeriodStartTs = effectiveStart;
    amountPulledInEffectivePeriodAtomic = effectivePulled;
    remainingPeriodAllowanceAtomic = planTerms.amount - effectivePulled;
  }

  const sourceBalanceAtomic = isU64(snapshot.tokenAccount.amountAtomic)
    ? snapshot.tokenAccount.amountAtomic
    : 0n;
  const sourceDelegateAllowanceAtomic = isU64(snapshot.tokenAccount.delegatedAmountAtomic)
    ? snapshot.tokenAccount.delegatedAmountAtomic
    : 0n;
  const remaining = remainingPeriodAllowanceAtomic ?? 0n;
  const snapshotTransferCapacityAtomic = failures.length === 0
    ? minBigInt([
        sourceBalanceAtomic,
        sourceDelegateAllowanceAtomic,
        remaining,
      ])
    : 0n;

  const authorizedPullers = [
    plan.owner,
    ...plan.data.pullers.filter(puller => puller !== ZERO_ADDRESS),
  ].filter((puller, index, all) => all.indexOf(puller) === index);

  return {
    consistent: failures.length === 0,
    failures: [...new Set(failures)],
    evidence: 'account-state-consistency-only',
    observedSlot: snapshot.slot,
    observedBlockTimeUnixSeconds: snapshot.blockTimeUnixSeconds,
    planStatus: plan.status,
    authorizedPullers,
    allowedDestinationOwners,
    newEnrollmentsAllowed: plan.status === PlanStatus.Active,
    cancellationPending: subscription.expiresAtTs !== 0n,
    effectivePeriodStartTs,
    amountPulledInEffectivePeriodAtomic,
    remainingPeriodAllowanceAtomic,
    sourceBalanceAtomic,
    sourceDelegateAllowanceAtomic,
    snapshotTransferCapacityAtomic,
  };
}
