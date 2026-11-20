import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateSubscriptionEntitlement,
  type SubscriptionAtomicAccountingCommit,
  type SubscriptionVerifiedObservation,
} from '../src/pay/services/subscriptionEntitlementPolicy';

const verified: SubscriptionVerifiedObservation = {
  outcome: 'verified_observation',
  commitment: 'finalized',
  clusterGenesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  signature: 'signature-verified-1',
  messageHash: 'a'.repeat(64),
  cycleIdentity: 'SubscriptionPda1111111111111111111111111111111:1800000000',
  attemptId: 'attempt-100',
};

const committed: SubscriptionAtomicAccountingCommit = {
  outcome: 'committed',
  clusterGenesisHash: verified.clusterGenesisHash,
  signature: verified.signature,
  messageHash: verified.messageHash,
  cycleIdentity: verified.cycleIdentity,
  attemptId: verified.attemptId,
};

test('entitlement is eligible only for matching finalized verification and atomic accounting', () => {
  assert.deepEqual(evaluateSubscriptionEntitlement(verified, committed), {
    eligible: true,
    evidence: {
      clusterGenesisHash: verified.clusterGenesisHash,
      signature: verified.signature,
      messageHash: verified.messageHash,
      cycleIdentity: verified.cycleIdentity,
      attemptId: verified.attemptId,
    },
  });
});

test('submission or verifier UNKNOWN/REJECTED never makes entitlement eligible', () => {
  for (const outcome of ['unknown', 'rejected'] as const) {
    assert.deepEqual(
      evaluateSubscriptionEntitlement({ outcome }, committed),
      { eligible: false, reason: 'verification_not_verified' },
    );
  }
  assert.deepEqual(
    evaluateSubscriptionEntitlement(null, committed),
    { eligible: false, reason: 'verification_not_verified' },
  );
});

test('accounting missing, not committed or unknown blocks entitlement', () => {
  assert.deepEqual(
    evaluateSubscriptionEntitlement(verified, null),
    { eligible: false, reason: 'accounting_not_committed' },
  );
  assert.deepEqual(
    evaluateSubscriptionEntitlement(verified, { outcome: 'not_committed' }),
    { eligible: false, reason: 'accounting_not_committed' },
  );
  assert.deepEqual(
    evaluateSubscriptionEntitlement(verified, { outcome: 'unknown' }),
    { eligible: false, reason: 'accounting_not_committed' },
  );
});

test('does not accept an accounting commit for a different Cycle or Attempt', () => {
  const wrongCycle = { ...committed, cycleIdentity: 'other-subscription:1800000000' };
  const wrongAttempt = { ...committed, attemptId: 'attempt-other' };

  assert.deepEqual(
    evaluateSubscriptionEntitlement(verified, wrongCycle),
    { eligible: false, reason: 'accounting_correlation_mismatch' },
  );
  assert.deepEqual(
    evaluateSubscriptionEntitlement(verified, wrongAttempt),
    { eligible: false, reason: 'accounting_correlation_mismatch' },
  );
});

test('does not accept cross-cluster, signature or message-hash accounting evidence', () => {
  for (const mismatch of [
    { clusterGenesisHash: 'different-genesis' },
    { signature: 'different-signature' },
    { messageHash: 'b'.repeat(64) },
  ]) {
    assert.deepEqual(
      evaluateSubscriptionEntitlement(verified, { ...committed, ...mismatch }),
      { eligible: false, reason: 'accounting_correlation_mismatch' },
    );
  }
});

test('rejects incomplete verification or accounting correlation', () => {
  assert.deepEqual(
    evaluateSubscriptionEntitlement(
      { ...verified, messageHash: '' },
      committed,
    ),
    { eligible: false, reason: 'observation_correlation_missing' },
  );
  assert.deepEqual(
    evaluateSubscriptionEntitlement(
      verified,
      { ...committed, cycleIdentity: '' },
    ),
    { eligible: false, reason: 'accounting_correlation_mismatch' },
  );
});
