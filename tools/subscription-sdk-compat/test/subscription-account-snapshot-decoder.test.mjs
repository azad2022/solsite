import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
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
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
} from '@solana/subscriptions';
import { findAssociatedTokenPda } from '@solana-program/token';
import { decodeHistoricalSubscriptionAccountSnapshot } from '../dist/subscription-account-snapshot-decoder.js';

const PROGRAM = address(SUBSCRIPTIONS_PROGRAM_ADDRESS);
const TOKEN_PROGRAM = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM = address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ZERO = address('11111111111111111111111111111111');
const MERCHANT = address('SysvarRent111111111111111111111111111111111');
const SUBSCRIBER = address('SysvarC1ock11111111111111111111111111111111');
const MINT = address('So11111111111111111111111111111111111111112');
const DESTINATION = address('Stake11111111111111111111111111111111111111');
const PULLER = address('ComputeBudget111111111111111111111111111111');
const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const PLAN_ID = 17n;
const NOW = 1_800_000_000n;
const AMOUNT = 1_250_000n;
const PERIOD_HOURS = 720n;
const PERIOD_SECONDS = PERIOD_HOURS * 3_600n;

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
    snapshotResponseHash: createHash('sha256').update(`${id}:499`).digest('hex'),
  };
}

async function makeFixture({ tokenAccountOwner = TOKEN_PROGRAM, tokenAccountBytesExtra = 0 } = {}) {
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
  const [userAta] = await findAssociatedTokenPda({
    mint: MINT,
    owner: SUBSCRIBER,
    tokenProgram: TOKEN_PROGRAM,
  });

  const terms = {
    amount: AMOUNT,
    periodHours: PERIOD_HOURS,
    createdAt: NOW - 10_000n,
  };
  const planBytes = getPlanEncoder().encode({
    discriminator: 1,
    owner: MERCHANT,
    bump: planBump,
    status: PlanStatus.Active,
    data: {
      planId: PLAN_ID,
      mint: MINT,
      terms,
      endTs: 0n,
      destinations: [DESTINATION, ZERO, ZERO, ZERO],
      pullers: [PULLER, ZERO, ZERO, ZERO],
      metadataUri: 'https://example.test/plan.json',
    },
  });
  const subscriptionBytes = getSubscriptionDelegationEncoder().encode({
    header: {
      discriminator: 4,
      version: 1,
      bump: subscriptionBump,
      delegator: SUBSCRIBER,
      delegatee: planPda,
      payer: SUBSCRIBER,
      initId: 42n,
    },
    terms,
    amountPulledInPeriod: 250_000n,
    currentPeriodStartTs: NOW - 1_800n,
    expiresAtTs: 0n,
  });
  const authorityBytes = getSubscriptionAuthorityEncoder().encode({
    discriminator: 0,
    user: SUBSCRIBER,
    tokenMint: MINT,
    payer: SUBSCRIBER,
    bump: authorityBump,
    initId: 42n,
  });
  const mintBytes = getMintEncoder().encode({
    mintAuthority: null,
    supply: 1_000_000_000n,
    decimals: 6,
    isInitialized: true,
    freezeAuthority: null,
  });
  const tokenBytesBase = getTokenEncoder().encode({
    mint: MINT,
    owner: SUBSCRIBER,
    amount: 600_000n,
    delegate: authorityPda,
    state: AccountState.Initialized,
    isNative: null,
    delegatedAmount: 500_000n,
    closeAuthority: null,
  });
  const tokenBytes = tokenAccountBytesExtra === 0
    ? tokenBytesBase
    : new Uint8Array([...tokenBytesBase, ...new Array(tokenAccountBytesExtra).fill(0)]);

  const archive = {
    outcome: 'historical_snapshot',
    evidence: {
      providerId: 'alchemy-account-archive-devnet',
      cluster: 'devnet',
      clusterGenesisHash: GENESIS,
      transactionSignature: '1'.repeat(88),
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
        epochStartTimestamp: NOW - 100n,
        epoch: 500n,
        leaderScheduleEpoch: 500n,
        unixTimestamp: NOW,
        accountDataSha256: 'b'.repeat(64),
        responseContextSlot: 500n,
      },
      accounts: [
        accountEvidence('plan', planPda, PROGRAM, planBytes),
        accountEvidence('subscription', subscriptionPda, PROGRAM, subscriptionBytes),
        accountEvidence('authority', authorityPda, PROGRAM, authorityBytes),
        accountEvidence('mint', MINT, TOKEN_PROGRAM, mintBytes),
        accountEvidence('tokenAccount', userAta, tokenAccountOwner, tokenBytes),
      ],
      rpcResponseSetSha256: 'c'.repeat(64),
    },
  };
  const expected = {
    clusterGenesisHash: GENESIS,
    merchant: MERCHANT,
    planId: PLAN_ID,
    subscriber: SUBSCRIBER,
    mint: MINT,
    tokenAccount: userAta,
    mintDecimals: 6,
  };
  return {
    archive,
    transactionEvidence: {
      signature: archive.evidence.transactionSignature,
      slot: archive.evidence.transactionSlot,
      clusterGenesisHash: GENESIS,
      commitment: 'finalized',
      transactionError: null,
      messageHash: 'd'.repeat(64),
    },
    expected,
    planPda,
    subscriptionPda,
    authorityPda,
    tokenAccount: userAta,
  };
}

test('decodes pinned Program and SPL Token account codecs, then validates one historical snapshot', async () => {
  const fixture = await makeFixture();
  const result = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    fixture.transactionEvidence,
    fixture.archive,
  );

  assert.equal(result.outcome, 'consistent_snapshot');
  assert.equal(result.evidence, 'account-state-consistency-only');
  assert.equal(result.snapshot.slot, 500n);
  assert.equal(result.snapshot.blockTimeUnixSeconds, NOW);
  assert.equal(result.snapshot.plan.address, fixture.planPda);
  assert.equal(result.snapshot.subscription.address, fixture.subscriptionPda);
  assert.equal(result.snapshot.authority.address, fixture.authorityPda);
  assert.equal(result.snapshot.tokenAccount.address, fixture.tokenAccount);
  assert.equal(result.snapshot.tokenAccount.amountAtomic, 600_000n);
  assert.equal(result.snapshot.tokenAccount.delegatedAmountAtomic, 500_000n);
  assert.equal(result.validation.consistent, true);
  assert.equal('paid' in result, false);
  assert.equal('entitled' in result, false);
});

test('rejects mutated account bytes whose preserved metadata hash no longer matches', async () => {
  const fixture = await makeFixture();
  const account = fixture.archive.evidence.accounts.find(item => item.id === 'plan');
  const bytes = Buffer.from(account.dataBase64, 'base64');
  bytes[0] ^= 0x01;
  account.dataBase64 = bytes.toString('base64');

  const result = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    fixture.transactionEvidence,
    fixture.archive,
  );
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /DATA_HASH_MISMATCH/);
});

test('rejects Program-owned account bytes attributed to a different owner', async () => {
  const fixture = await makeFixture();
  fixture.archive.evidence.accounts.find(item => item.id === 'subscription').owner = TOKEN_PROGRAM;

  const result = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    fixture.transactionEvidence,
    fixture.archive,
  );
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /PROGRAM_ACCOUNT_OWNER_MISMATCH/);
});

test('fails closed when Token-2022 owns the customer account but the current validator is classic-SPL-only', async () => {
  const fixture = await makeFixture({ tokenAccountOwner: TOKEN_2022_PROGRAM });
  const result = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    fixture.transactionEvidence,
    fixture.archive,
  );
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /TOKEN_PROGRAM_UNSUPPORTED/);
});

test('fails closed on extension-bearing SPL token account data instead of truncating TLV state', async () => {
  const fixture = await makeFixture({ tokenAccountBytesExtra: 4 });
  const result = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    fixture.transactionEvidence,
    fixture.archive,
  );
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /DATA_LENGTH_UNSUPPORTED/);
});

test('fails closed when the historical state is not bound to the exact transaction slot Clock', async () => {
  const fixture = await makeFixture();
  fixture.archive.evidence.clock.slot = 499n;

  const result = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    fixture.transactionEvidence,
    fixture.archive,
  );
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /CLOCK_PROVENANCE_INVALID/);
});

test('fails closed when the archive snapshot omits or duplicates a required account', async () => {
  const missing = await makeFixture();
  missing.archive.evidence.accounts = missing.archive.evidence.accounts.filter(item => item.id !== 'authority');
  const missingResult = await decodeHistoricalSubscriptionAccountSnapshot(missing.expected, missing.transactionEvidence, missing.archive);
  assert.equal(missingResult.outcome, 'unknown');

  const duplicate = await makeFixture();
  duplicate.archive.evidence.accounts[4].id = 'mint';
  const duplicateResult = await decodeHistoricalSubscriptionAccountSnapshot(duplicate.expected, duplicate.transactionEvidence, duplicate.archive);
  assert.equal(duplicateResult.outcome, 'unknown');
});

test('returns an explicit inconsistent snapshot when Plan, delegate and authority disagree', async () => {
  const fixture = await makeFixture();
  const account = fixture.archive.evidence.accounts.find(item => item.id === 'authority');
  const data = Buffer.from(account.dataBase64, 'base64');
  // Mutate the authority's final init_id byte while retaining valid account encoding.
  data[data.length - 1] ^= 0x01;
  account.dataBase64 = data.toString('base64');
  account.accountDataSha256 = createHash('sha256').update(data).digest('hex');

  const result = await decodeHistoricalSubscriptionAccountSnapshot(fixture.expected, fixture.transactionEvidence, fixture.archive);
  assert.equal(result.outcome, 'inconsistent_snapshot');
  assert.ok(result.validation.failures.includes('subscription_authority_generation_mismatch'));
});

test('rejects historical state that is not correlated to the exact finalized transaction evidence', async () => {
  const fixture = await makeFixture();
  const wrongSignature = {
    ...fixture.transactionEvidence,
    signature: '2'.repeat(88),
  };
  const signatureResult = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    wrongSignature,
    fixture.archive,
  );
  assert.equal(signatureResult.outcome, 'unknown');
  assert.match(signatureResult.reasons.join(' '), /TRANSACTION_CORRELATION_MISMATCH/);

  const wrongSlot = {
    ...fixture.transactionEvidence,
    slot: 501n,
  };
  const slotResult = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    wrongSlot,
    fixture.archive,
  );
  assert.equal(slotResult.outcome, 'unknown');
  assert.match(slotResult.reasons.join(' '), /TRANSACTION_CORRELATION_MISMATCH/);
});

test('rejects archive provider identity that does not match its declared cluster', async () => {
  const fixture = await makeFixture();
  fixture.archive.evidence.providerId = 'alchemy-account-archive-mainnet';
  const result = await decodeHistoricalSubscriptionAccountSnapshot(
    fixture.expected,
    fixture.transactionEvidence,
    fixture.archive,
  );
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /EVIDENCE_PROVENANCE_INVALID/);
});
