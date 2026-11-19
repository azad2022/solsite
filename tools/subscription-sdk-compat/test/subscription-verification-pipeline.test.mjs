import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { address } from '@solana/kit';
import {
  AccountState,
  getMintEncoder,
  getTokenEncoder,
} from '@solana-program/token';
import {
  findPlanPda,
  findSubscriptionAuthorityPda,
  findSubscriptionDelegationPda,
  getPlanEncoder,
  getSubscriptionAuthorityEncoder,
  getSubscriptionDelegationEncoder,
  PlanStatus,
} from '@solana/subscriptions';
import { findAssociatedTokenPda } from '@solana-program/token';
import test from 'node:test';
import {
  AMOUNT,
  GENESIS,
  PERIOD_START,
  PROGRAM,
  TOKEN,
  makeFixture,
} from './helpers/subscription-rpc-fixture.mjs';
import {
  verifySubscriptionAttemptPipeline,
} from '../dist/subscription-verification-pipeline.js';

const ZERO = address('11111111111111111111111111111111');
const PERIOD_HOURS = 720n;

function accountEvidence(id, accountAddress, owner, bytes) {
  const data = Buffer.from(bytes);
  return {
    id,
    address: accountAddress,
    owner,
    executable: false,
    lamports: '1000000',
    dataBase64: data.toString('base64'),
    dataLength: data.length,
    accountDataSha256: createHash('sha256').update(data).digest('hex'),
    snapshotSlot: 499n,
    snapshotResponseHash: createHash('sha256').update(id + ':499').digest('hex'),
  };
}

async function makeHistoricalArchive(fixture, options = {}) {
  const identity = fixture.expectedAccountIdentity;
  const merchant = address(identity.merchant);
  const subscriber = address(identity.subscriber);
  const mint = address(identity.mint);
  const program = address(PROGRAM);
  const tokenProgram = address(TOKEN);
  const [planPda, planBump] = await findPlanPda({ owner: merchant, planId: identity.planId });
  const [subscriptionPda, subscriptionBump] = await findSubscriptionDelegationPda({
    planPda,
    subscriber,
  });
  const [authorityPda, authorityBump] = await findSubscriptionAuthorityPda({
    user: subscriber,
    tokenMint: mint,
  });
  const [sourceAta] = await findAssociatedTokenPda({
    mint,
    owner: subscriber,
    tokenProgram,
  });

  assert.equal(planPda, fixture.expected.planPda);
  assert.equal(subscriptionPda, fixture.expected.subscriptionPda);
  assert.equal(authorityPda, fixture.expected.authorityPda);
  assert.equal(sourceAta, fixture.expected.sourceAta);

  const terms = {
    amount: 1_000n,
    periodHours: PERIOD_HOURS,
    createdAt: PERIOD_START - 10_000n,
  };
  const planBytes = getPlanEncoder().encode({
    discriminator: 1,
    owner: merchant,
    bump: planBump,
    status: PlanStatus.Active,
    data: {
      planId: identity.planId,
      mint,
      terms,
      endTs: 0n,
      destinations: [merchant, ZERO, ZERO, ZERO],
      pullers: [ZERO, ZERO, ZERO, ZERO],
      metadataUri: 'https://example.test/plan.json',
    },
  });
  const subscriptionBytes = getSubscriptionDelegationEncoder().encode({
    header: {
      discriminator: 4,
      version: 1,
      bump: subscriptionBump,
      delegator: subscriber,
      delegatee: planPda,
      payer: subscriber,
      initId: 42n,
    },
    terms,
    amountPulledInPeriod: 0n,
    currentPeriodStartTs: PERIOD_START,
    expiresAtTs: 0n,
  });
  const authorityBytes = getSubscriptionAuthorityEncoder().encode({
    discriminator: 0,
    user: subscriber,
    tokenMint: mint,
    payer: subscriber,
    bump: authorityBump,
    initId: 42n,
  });
  const mintBytes = getMintEncoder().encode({
    mintAuthority: null,
    supply: 1_000_000_000n,
    decimals: identity.mintDecimals,
    isInitialized: true,
    freezeAuthority: null,
  });
  const tokenBytes = getTokenEncoder().encode({
    mint,
    owner: subscriber,
    amount: 1_000n,
    delegate: options.wrongDelegate ? null : authorityPda,
    state: AccountState.Initialized,
    isNative: null,
    delegatedAmount: options.lowDelegateAllowance ? 100n : 1_000n,
    closeAuthority: null,
  });

  return {
    outcome: 'historical_snapshot',
    evidence: {
      providerId: 'alchemy-account-archive-devnet',
      cluster: 'devnet',
      clusterGenesisHash: GENESIS,
      transactionSignature: fixture.signature,
      transactionSlot: 500n,
      targetTransactionIndex: 3,
      transactionsBeforeTarget: 3,
      precedingWritableConflictCount: 0,
      snapshotSlot: 499n,
      finalizedTipSlot: 700n,
      snapshotCommitment: 'finalized',
      blockResponseHash: 'a'.repeat(64),
      clock: {
        address: 'SysvarC1ock11111111111111111111111111111111',
        slot: 500n,
        epochStartTimestamp: PERIOD_START - 100n,
        epoch: 500n,
        leaderScheduleEpoch: 500n,
        unixTimestamp: PERIOD_START + 1n,
        accountDataSha256: 'b'.repeat(64),
        responseContextSlot: 500n,
      },
      accounts: [
        accountEvidence('plan', planPda, program, planBytes),
        accountEvidence('subscription', subscriptionPda, program, subscriptionBytes),
        accountEvidence('authority', authorityPda, program, authorityBytes),
        accountEvidence('mint', mint, tokenProgram, mintBytes),
        accountEvidence('tokenAccount', sourceAta, tokenProgram, tokenBytes),
      ],
      rpcResponseSetSha256: createHash('sha256').update('synthetic-but-correlated-archive-fixture').digest('hex'),
    },
  };
}

function expectedTransaction(fixture) {
  const {
    expectedPeriodStartTs,
    expectedPeriodEndTs,
    expectedCumulativeAmountAtomic,
    ...expected
  } = fixture.expected;
  return expected;
}

test('joins a raw finalized transaction to historical pre-state and derives period usage before verification', async () => {
  const fixture = makeFixture();
  const archive = await makeHistoricalArchive(fixture);
  const result = await verifySubscriptionAttemptPipeline({
    expectedAccountIdentity: fixture.expectedAccountIdentity,
    expectedTransaction: expectedTransaction(fixture),
    rpcProvenance: fixture.provenance,
    rawTransactionResponseBody: fixture.rawResponse,
    historicalAccountEvidence: archive,
  });

  assert.equal(result.outcome, 'verified_observation');
  assert.equal(result.evidence, 'finalized-transaction-plus-prestate-archive');
  assert.equal(result.observation.signature, fixture.signature);
  assert.equal(result.observation.messageHash, fixture.messageHash);
  assert.equal(result.observation.amountAtomic, AMOUNT);
  assert.equal(result.period.periodStartTs, PERIOD_START);
  assert.equal(result.period.periodEndTs, PERIOD_START + PERIOD_HOURS * 3_600n);
  assert.equal(result.period.cumulativeAmountBeforeAtomic, 0n);
  assert.equal(result.period.cumulativeAmountAfterAtomic, AMOUNT);
  assert.equal(result.period.remainingAllowanceBeforeAtomic, 1_000n);
  assert.equal(result.archive.transactionSlot, 500n);
  assert.equal(result.archive.snapshotSlot, 499n);
  assert.equal(result.accountState.consistent, true);
});

test('returns UNKNOWN when historical pre-state is not bound to the exact transaction signature', async () => {
  const fixture = makeFixture();
  const archive = await makeHistoricalArchive(fixture);
  archive.evidence.transactionSignature = '2'.repeat(88);
  const result = await verifySubscriptionAttemptPipeline({
    expectedAccountIdentity: fixture.expectedAccountIdentity,
    expectedTransaction: expectedTransaction(fixture),
    rpcProvenance: fixture.provenance,
    rawTransactionResponseBody: fixture.rawResponse,
    historicalAccountEvidence: archive,
  });

  assert.equal(result.outcome, 'unknown');
  assert.equal(result.stage, 'historical_account_state');
  assert.match(result.reasons.join(' '), /CORRELATION_MISMATCH/);
});

test('rejects the transfer when the historical subscriber ATA is not delegated to the expected Authority', async () => {
  const fixture = makeFixture();
  const archive = await makeHistoricalArchive(fixture, { wrongDelegate: true });
  const result = await verifySubscriptionAttemptPipeline({
    expectedAccountIdentity: fixture.expectedAccountIdentity,
    expectedTransaction: expectedTransaction(fixture),
    rpcProvenance: fixture.provenance,
    rawTransactionResponseBody: fixture.rawResponse,
    historicalAccountEvidence: archive,
  });

  assert.equal(result.outcome, 'rejected');
  assert.equal(result.stage, 'historical_account_state');
  assert.ok(result.failures.includes('token_account_delegate_mismatch'));
});

test('rejects the transfer when historical delegate allowance is smaller than the requested amount', async () => {
  const fixture = makeFixture();
  const archive = await makeHistoricalArchive(fixture, { lowDelegateAllowance: true });
  const result = await verifySubscriptionAttemptPipeline({
    expectedAccountIdentity: fixture.expectedAccountIdentity,
    expectedTransaction: expectedTransaction(fixture),
    rpcProvenance: fixture.provenance,
    rawTransactionResponseBody: fixture.rawResponse,
    historicalAccountEvidence: archive,
  });

  assert.equal(result.outcome, 'rejected');
  assert.equal(result.stage, 'period_capacity');
  assert.ok(result.failures.includes('snapshot_transfer_capacity_insufficient'));
});

test('does not return a verified observation when exact finalized ProgramData provenance is unavailable', async () => {
  const fixture = makeFixture();
  const archive = await makeHistoricalArchive(fixture);
  const provenance = { ...fixture.provenance, programDeployment: null };
  const result = await verifySubscriptionAttemptPipeline({
    expectedAccountIdentity: fixture.expectedAccountIdentity,
    expectedTransaction: expectedTransaction(fixture),
    rpcProvenance: provenance,
    rawTransactionResponseBody: fixture.rawResponse,
    historicalAccountEvidence: archive,
  });

  assert.equal(result.outcome, 'unknown');
  assert.equal(result.stage, 'transaction_policy');
  assert.match(result.reasons.join(' '), /ProgramData deployment evidence is missing/);
});

test('rejects a signature that is not the one persisted on the trusted Attempt', async () => {
  const fixture = makeFixture();
  const archive = await makeHistoricalArchive(fixture);
  const expected = expectedTransaction(fixture);
  expected.expectedSignature = '3'.repeat(88);
  const result = await verifySubscriptionAttemptPipeline({
    expectedAccountIdentity: fixture.expectedAccountIdentity,
    expectedTransaction: expected,
    rpcProvenance: fixture.provenance,
    rawTransactionResponseBody: fixture.rawResponse,
    historicalAccountEvidence: archive,
  });

  assert.equal(result.outcome, 'rejected');
  assert.equal(result.stage, 'attempt_correlation');
  assert.deepEqual(result.failures, ['attempt_signature_mismatch']);
});
