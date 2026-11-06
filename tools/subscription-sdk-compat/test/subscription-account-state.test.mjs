import assert from 'node:assert/strict';
import test from 'node:test';
import { address } from '@solana/kit';
import {
  findPlanPda,
  findSubscriptionAuthorityPda,
  findSubscriptionDelegationPda,
  PlanStatus,
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
} from '@solana/subscriptions';
import { validateSubscriptionAccountState } from '../dist/subscription-account-state.js';

const SPL_TOKEN_PROGRAM = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ZERO = address('11111111111111111111111111111111');
const MERCHANT = address('SysvarRent111111111111111111111111111111111');
const SUBSCRIBER = address('SysvarC1ock11111111111111111111111111111111');
const MINT = address('So11111111111111111111111111111111111111112');
const USER_ATA = address('Vote111111111111111111111111111111111111111');
const DESTINATION = address('Stake11111111111111111111111111111111111111');
const PULLER = address('ComputeBudget111111111111111111111111111111');
const GENESIS = 'devnet-genesis-fixture';
const PLAN_ID = 17n;
const NOW = 1_800_000_000n;
const PLAN_AMOUNT = 1_250_000n;
const PERIOD_HOURS = 720n;
const PERIOD_SECONDS = PERIOD_HOURS * 3_600n;

async function makeSnapshot(overrides = {}) {
  const [planPda, planBump] = await findPlanPda({
    owner: MERCHANT,
    planId: PLAN_ID,
  });
  const [subscriptionPda, subscriptionBump] = await findSubscriptionDelegationPda({
    planPda,
    subscriber: SUBSCRIBER,
  });
  const [authorityPda, authorityBump] = await findSubscriptionAuthorityPda({
    user: SUBSCRIBER,
    tokenMint: MINT,
  });

  const planTerms = {
    amount: PLAN_AMOUNT,
    periodHours: PERIOD_HOURS,
    createdAt: NOW - 10_000n,
  };
  const plan = {
    discriminator: 1,
    owner: MERCHANT,
    bump: planBump,
    status: PlanStatus.Active,
    data: {
      planId: PLAN_ID,
      mint: MINT,
      terms: { ...planTerms },
      endTs: 0n,
      destinations: [DESTINATION, ZERO, ZERO, ZERO],
      pullers: [PULLER, ZERO, ZERO, ZERO],
      metadataUri: 'https://example.test/plan.json',
    },
  };
  const subscription = {
    header: {
      discriminator: 4,
      version: 1,
      bump: subscriptionBump,
      delegator: SUBSCRIBER,
      delegatee: planPda,
      payer: SUBSCRIBER,
      initId: 42n,
    },
    terms: { ...planTerms },
    amountPulledInPeriod: 250_000n,
    currentPeriodStartTs: NOW - 1_800n,
    expiresAtTs: 0n,
  };
  const authority = {
    discriminator: 0,
    user: SUBSCRIBER,
    tokenMint: MINT,
    payer: SUBSCRIBER,
    bump: authorityBump,
    initId: 42n,
  };

  const snapshot = {
    commitment: 'finalized',
    clusterGenesisHash: GENESIS,
    slot: 500n,
    blockTimeUnixSeconds: NOW,
    plan: {
      address: planPda,
      programAddress: SUBSCRIPTIONS_PROGRAM_ADDRESS,
      data: plan,
    },
    subscription: {
      address: subscriptionPda,
      programAddress: SUBSCRIPTIONS_PROGRAM_ADDRESS,
      data: subscription,
    },
    authority: {
      address: authorityPda,
      programAddress: SUBSCRIPTIONS_PROGRAM_ADDRESS,
      data: authority,
    },
    mint: {
      address: MINT,
      programAddress: SPL_TOKEN_PROGRAM,
      decimals: 6,
      initialized: true,
    },
    tokenAccount: {
      address: USER_ATA,
      programAddress: SPL_TOKEN_PROGRAM,
      mint: MINT,
      owner: SUBSCRIBER,
      delegate: authorityPda,
      amountAtomic: 600_000n,
      delegatedAmountAtomic: 500_000n,
      state: 'initialized',
    },
  };

  Object.assign(snapshot, overrides);
  return { snapshot, planPda, subscriptionPda, authorityPda, planTerms };
}

function expected(overrides = {}) {
  return {
    clusterGenesisHash: GENESIS,
    merchant: MERCHANT,
    planId: PLAN_ID,
    subscriber: SUBSCRIBER,
    mint: MINT,
    tokenAccount: USER_ATA,
    mintDecimals: 6,
    ...overrides,
  };
}

test('accepts a consistent finalized perpetual Plan snapshot without claiming payment', async () => {
  const { snapshot } = await makeSnapshot();
  const result = await validateSubscriptionAccountState(expected(), snapshot);

  assert.equal(result.consistent, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.evidence, 'account-state-consistency-only');
  assert.equal(result.planStatus, PlanStatus.Active);
  assert.equal(result.newEnrollmentsAllowed, true);
  assert.equal(result.cancellationPending, false);
  assert.equal(result.effectivePeriodStartTs, NOW - 1_800n);
  assert.equal(result.amountPulledInEffectivePeriodAtomic, 250_000n);
  assert.equal(result.remainingPeriodAllowanceAtomic, PLAN_AMOUNT - 250_000n);
  assert.equal(result.sourceBalanceAtomic, 600_000n);
  assert.equal(result.sourceDelegateAllowanceAtomic, 500_000n);
  assert.equal(result.snapshotTransferCapacityAtomic, 500_000n);
  assert.deepEqual(result.authorizedPullers, [MERCHANT, PULLER]);
  assert.deepEqual(result.allowedDestinationOwners, [DESTINATION]);
  assert.equal('paid' in result, false);
  assert.equal('entitled' in result, false);
});

test('Sunset prevents new enrollment but does not invalidate a consistent existing subscription snapshot', async () => {
  const { snapshot } = await makeSnapshot();
  snapshot.plan.data.status = PlanStatus.Sunset;

  const result = await validateSubscriptionAccountState(expected(), snapshot);

  assert.equal(result.consistent, true);
  assert.equal(result.planStatus, PlanStatus.Sunset);
  assert.equal(result.newEnrollmentsAllowed, false);
});

test('matches the pinned Program period rollover at an exact period boundary', async () => {
  const { snapshot } = await makeSnapshot();
  snapshot.blockTimeUnixSeconds = snapshot.subscription.data.currentPeriodStartTs + PERIOD_SECONDS;

  const result = await validateSubscriptionAccountState(expected(), snapshot);

  assert.equal(result.consistent, true);
  assert.equal(
    result.effectivePeriodStartTs,
    snapshot.subscription.data.currentPeriodStartTs + PERIOD_SECONDS,
  );
  assert.equal(result.amountPulledInEffectivePeriodAtomic, 0n);
  assert.equal(result.remainingPeriodAllowanceAtomic, PLAN_AMOUNT);
});

test('fails closed for non-finalized snapshots and a different cluster genesis', async () => {
  const first = await makeSnapshot();
  first.snapshot.commitment = 'confirmed';
  const nonFinalized = await validateSubscriptionAccountState(expected(), first.snapshot);
  assert.equal(nonFinalized.consistent, false);
  assert.ok(nonFinalized.failures.includes('snapshot_not_finalized'));

  const second = await makeSnapshot();
  second.snapshot.clusterGenesisHash = 'another-genesis';
  const wrongCluster = await validateSubscriptionAccountState(expected(), second.snapshot);
  assert.equal(wrongCluster.consistent, false);
  assert.ok(wrongCluster.failures.includes('cluster_genesis_mismatch'));
});

test('rejects finite Plans and Plans without an explicit destination allowlist', async () => {
  const finite = await makeSnapshot();
  finite.snapshot.plan.data.endTs = NOW + PERIOD_SECONDS;
  const finiteResult = await validateSubscriptionAccountState(expected(), finite.snapshot);
  assert.ok(finiteResult.failures.includes('finite_plan_not_supported'));

  const empty = await makeSnapshot();
  empty.snapshot.plan.data.destinations = [ZERO, ZERO, ZERO, ZERO];
  const emptyResult = await validateSubscriptionAccountState(expected(), empty.snapshot);
  assert.ok(emptyResult.failures.includes('plan_destination_allowlist_empty'));
});

test('rejects mismatched Plan terms and a different authority generation', async () => {
  const { snapshot } = await makeSnapshot();
  snapshot.subscription.data.terms.amount += 1n;
  snapshot.authority.data.initId += 1n;

  const result = await validateSubscriptionAccountState(expected(), snapshot);

  assert.ok(result.failures.includes('subscription_terms_mismatch'));
  assert.ok(result.failures.includes('subscription_authority_generation_mismatch'));
});

test('rejects UNKNOWN_INIT_ID and cancellation at the exact expiry boundary', async () => {
  const unknown = await makeSnapshot();
  unknown.snapshot.subscription.data.header.initId = -(1n << 63n);
  unknown.snapshot.authority.data.initId = -(1n << 63n);
  const unknownResult = await validateSubscriptionAccountState(expected(), unknown.snapshot);
  assert.ok(unknownResult.failures.includes('subscription_authority_generation_invalid'));

  const cancelled = await makeSnapshot();
  cancelled.snapshot.subscription.data.expiresAtTs = NOW;
  const cancelledResult = await validateSubscriptionAccountState(expected(), cancelled.snapshot);
  assert.ok(cancelledResult.failures.includes('subscription_expired_or_cancelled'));
  assert.equal(cancelledResult.cancellationPending, true);
});

test('rejects wrong token owner, delegate, mint decimals and frozen token account', async () => {
  const wrongOwner = await makeSnapshot();
  wrongOwner.snapshot.tokenAccount.owner = MERCHANT;
  wrongOwner.snapshot.tokenAccount.delegate = SUBSCRIBER;
  wrongOwner.snapshot.mint.decimals = 9;
  wrongOwner.snapshot.tokenAccount.state = 'frozen';

  const result = await validateSubscriptionAccountState(expected(), wrongOwner.snapshot);

  assert.ok(result.failures.includes('token_account_identity_mismatch'));
  assert.ok(result.failures.includes('token_account_delegate_mismatch'));
  assert.ok(result.failures.includes('mint_decimals_mismatch'));
  assert.ok(result.failures.includes('token_account_not_transferable'));
});

test('rejects a corrupt cumulative amount above the Plan period allowance', async () => {
  const { snapshot } = await makeSnapshot();
  snapshot.subscription.data.amountPulledInPeriod = PLAN_AMOUNT + 1n;

  const result = await validateSubscriptionAccountState(expected(), snapshot);

  assert.ok(result.failures.includes('subscription_period_state_invalid'));
  assert.equal(result.remainingPeriodAllowanceAtomic, null);
  assert.equal(result.snapshotTransferCapacityAtomic, 0n);
});
