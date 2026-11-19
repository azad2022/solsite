import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSubscriptionAttemptRecovery,
} from '../dist/subscription-attempt-recovery-policy.js';

const CLAIM = { outcome: 'acquired', fencingToken: 'db-fence-42' };
const SIGNATURE = '1'.repeat(88);
const MESSAGE_HASH = 'a'.repeat(64);

function attempt(overrides = {}) {
  return {
    attemptId: 'attempt-42',
    submissionMayHaveOccurred: true,
    signature: SIGNATURE,
    messageHash: MESSAGE_HASH,
    chainObservation: 'unknown',
    rejectionProof: 'unknown',
    accountingOutcome: 'not_committed',
    retryAuthorized: false,
    ...overrides,
  };
}

test('permits a first Attempt only after an acquired fenced Cycle claim', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: null,
  });
  assert.equal(result.action, 'first_attempt_permitted');
  assert.equal(result.fencingToken, CLAIM.fencingToken);
  assert.equal(result.mustPersistAttemptBeforeSigning, true);
});

test('does not permit an Attempt when another worker owns the Cycle claim', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: { outcome: 'not_acquired', fencingToken: null },
    priorAttempt: null,
  });
  assert.equal(result.action, 'wait_for_cycle_claim');
});

test('fails closed when the database claim outcome is unknown', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: { outcome: 'unknown', fencingToken: null },
    priorAttempt: null,
  });
  assert.equal(result.action, 'blocked_claim_unknown');
});

test('resumes an existing pre-submission Attempt without creating a new Attempt', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({
      submissionMayHaveOccurred: false,
      signature: null,
      messageHash: null,
      chainObservation: 'not_checked',
    }),
  });
  assert.equal(result.action, 'resume_existing_pre_submission_attempt');
  assert.equal(result.attemptId, 'attempt-42');
  assert.equal(result.mustNotCreateNewAttempt, true);
});

test('reconciles the exact same signature and message hash after timeout or restart', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ chainObservation: 'unknown' }),
  });
  assert.equal(result.action, 'reconcile_existing_attempt');
  assert.equal(result.signature, SIGNATURE);
  assert.equal(result.messageHash, MESSAGE_HASH);
  assert.equal(result.mustReuseExactTransaction, true);
  assert.equal(result.mustNotCreateNewAttempt, true);
});

test('also reconciles an Attempt whose submit outcome was never recorded', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ chainObservation: 'not_checked' }),
  });
  assert.equal(result.action, 'reconcile_existing_attempt');
  assert.equal(result.signature, SIGNATURE);
  assert.equal(result.mustReuseExactTransaction, true);
});

test('blocks automatic recovery if a submitted Attempt lost its signature or message hash', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ signature: null }),
  });
  assert.equal(result.action, 'blocked_inconsistent_attempt_history');
});

test('does not create a new charge when a verified observation awaits atomic accounting', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ chainObservation: 'verified_observation' }),
  });
  assert.equal(result.action, 'await_atomic_accounting_commit');
  assert.equal(result.mustNotCreateNewAttempt, true);
});

test('does not create a new charge after the verified observation has been atomically accounted', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({
      chainObservation: 'verified_observation',
      accountingOutcome: 'committed',
    }),
  });
  assert.equal(result.action, 'cycle_accounted');
  assert.equal(result.mustNotCreateNewAttempt, true);
});

test('reconciles an unknown atomic accounting outcome without creating a new charge', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({
      chainObservation: 'verified_observation',
      accountingOutcome: 'unknown',
    }),
  });
  assert.equal(result.action, 'reconcile_atomic_accounting_commit');
  assert.equal(result.attemptId, 'attempt-42');
  assert.equal(result.signature, SIGNATURE);
  assert.equal(result.messageHash, MESSAGE_HASH);
  assert.equal(result.mustReuseExactObservation, true);
  assert.equal(result.mustNotCreateNewAttempt, true);
});

test('permits a fresh Attempt only after a finalized execution error and explicit retry authorization', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({
      chainObservation: 'rejected',
      rejectionProof: 'finalized_execution_error',
      retryAuthorized: true,
    }),
  });
  assert.equal(result.action, 'retry_permitted_after_finalized_execution_error');
  assert.equal(result.previousAttemptId, 'attempt-42');
  assert.equal(result.mustCreateNewAttemptWithNewCorrelation, true);
});

test('does not automatically retry an identity or verifier rejection even when a retry flag is true', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({
      chainObservation: 'rejected',
      rejectionProof: 'policy_or_identity_mismatch',
      retryAuthorized: true,
    }),
  });
  assert.equal(result.action, 'manual_review_required');
});

test('blocks a retry after finalized execution failure when the approved policy denies retry', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({
      chainObservation: 'rejected',
      rejectionProof: 'finalized_execution_error',
      retryAuthorized: false,
    }),
  });
  assert.equal(result.action, 'blocked_retry_policy');
});

test('blocks contradictory history where accounting is marked committed without verification', () => {
  const result = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ accountingOutcome: 'committed' }),
  });
  assert.equal(result.action, 'blocked_inconsistent_attempt_history');
});

test('blocks malformed Attempt identity and malformed signature/message correlation', () => {
  const badId = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ attemptId: '../attempt' }),
  });
  assert.equal(badId.action, 'blocked_inconsistent_attempt_history');

  const badHash = resolveSubscriptionAttemptRecovery({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ messageHash: 'not-a-hash' }),
  });
  assert.equal(badHash.action, 'blocked_inconsistent_attempt_history');
});
