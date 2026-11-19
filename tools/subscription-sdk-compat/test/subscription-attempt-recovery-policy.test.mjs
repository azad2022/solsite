import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSubscriptionAttemptRecovery,
} from '../dist/subscription-attempt-recovery-policy.js';

const CLAIM = {
  outcome: 'acquired',
  cycleIdentity: 'cycle:subscription-pda:1800000000',
  fencingToken: 'db-fence-42',
};
const SIGNATURE = '1'.repeat(88);
const MESSAGE_HASH = 'a'.repeat(64);

function decide(input) {
  return resolveSubscriptionAttemptRecovery({
    attemptHistoryComplete: true,
    ...input,
  });
}

function attempt(overrides = {}) {
  return {
    attemptId: 'attempt-42',
    cycleIdentity: CLAIM.cycleIdentity,
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
  const result = decide({
    cycleClaim: CLAIM,
    priorAttempt: null,
  });
  assert.equal(result.action, 'first_attempt_permitted');
  assert.equal(result.fencingToken, CLAIM.fencingToken);
  assert.equal(result.mustPersistAttemptBeforeSigning, true);
});

test('does not permit an Attempt when another worker owns the Cycle claim', () => {
  const result = decide({
    cycleClaim: { outcome: 'not_acquired', fencingToken: null },
    priorAttempt: null,
  });
  assert.equal(result.action, 'wait_for_cycle_claim');
});

test('fails closed when the database claim outcome is unknown', () => {
  const result = decide({
    cycleClaim: { outcome: 'unknown', fencingToken: null },
    priorAttempt: null,
  });
  assert.equal(result.action, 'blocked_claim_unknown');
});

test('resumes an existing pre-submission Attempt without creating a new Attempt', () => {
  const result = decide({
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
  const result = decide({
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
  const result = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ chainObservation: 'not_checked' }),
  });
  assert.equal(result.action, 'reconcile_existing_attempt');
  assert.equal(result.signature, SIGNATURE);
  assert.equal(result.mustReuseExactTransaction, true);
});

test('blocks automatic recovery if a submitted Attempt lost its signature or message hash', () => {
  const result = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ signature: null }),
  });
  assert.equal(result.action, 'blocked_inconsistent_attempt_history');
});

test('does not create a new charge when a verified observation awaits atomic accounting', () => {
  const result = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ chainObservation: 'verified_observation' }),
  });
  assert.equal(result.action, 'await_atomic_accounting_commit');
  assert.equal(result.mustNotCreateNewAttempt, true);
});

test('does not create a new charge after the verified observation has been atomically accounted', () => {
  const result = decide({
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
  const result = decide({
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
  const result = decide({
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
  const result = decide({
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
  const result = decide({
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
  const result = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ accountingOutcome: 'committed' }),
  });
  assert.equal(result.action, 'blocked_inconsistent_attempt_history');
});

test('blocks malformed Attempt identity and malformed signature/message correlation', () => {
  const badId = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ attemptId: '../attempt' }),
  });
  assert.equal(badId.action, 'blocked_inconsistent_attempt_history');

  const badHash = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ messageHash: 'not-a-hash' }),
  });
  assert.equal(badHash.action, 'blocked_inconsistent_attempt_history');
});


test('blocks malformed Cycle claim and Attempt state values instead of treating them as acquired', () => {
  const malformedClaim = decide({
    cycleClaim: { outcome: 'acquired-ish', fencingToken: 'db-fence-42' },
    priorAttempt: null,
  });
  assert.equal(malformedClaim.action, 'blocked_claim_unknown');

  const malformedAttempt = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ chainObservation: 'probably-ok' }),
  });
  assert.equal(malformedAttempt.action, 'blocked_inconsistent_attempt_history');
});


test('does not interpret an incomplete Attempt read as proof that no prior Attempt exists', () => {
  const result = decide({
    cycleClaim: CLAIM,
    attemptHistoryComplete: false,
    priorAttempt: null,
  });
  assert.equal(result.action, 'blocked_attempt_history_unknown');
  assert.match(result.reasons.join(' '), /complete Attempt history/);
});

test('rejects recovery when a durable Attempt belongs to another Cycle', () => {
  const result = decide({
    cycleClaim: CLAIM,
    priorAttempt: attempt({ cycleIdentity: 'cycle:another-subscription:1800000000' }),
  });
  assert.equal(result.action, 'blocked_inconsistent_attempt_history');
  assert.match(result.reasons.join(' '), /exact Cycle currently claimed/);
});

test('fails closed when the claimed Cycle identity is missing or malformed', () => {
  const result = decide({
    cycleClaim: { ...CLAIM, cycleIdentity: ' ' },
    priorAttempt: null,
  });
  assert.equal(result.action, 'blocked_claim_unknown');
});


test('does not permit a first Attempt without a non-empty database fencing token', () => {
  const invalidTokens = [null, undefined, '', '  \t  ', 42];

  for (const fencingToken of invalidTokens) {
    const result = decide({
      cycleClaim: { ...CLAIM, fencingToken },
      priorAttempt: null,
    });
    assert.equal(result.action, 'blocked_claim_unknown');
  }
});

test('does not resume a pre-submission Attempt with an incomplete or malformed signature/message pair', () => {
  const invalidCorrelations = [
    { signature: SIGNATURE, messageHash: null },
    { signature: null, messageHash: MESSAGE_HASH },
    { signature: 'not-a-solana-signature', messageHash: MESSAGE_HASH },
    { signature: SIGNATURE, messageHash: 'not-a-sha256-hash' },
  ];

  for (const correlation of invalidCorrelations) {
    const result = decide({
      cycleClaim: CLAIM,
      priorAttempt: attempt({
        submissionMayHaveOccurred: false,
        chainObservation: 'not_checked',
        accountingOutcome: 'not_committed',
        ...correlation,
      }),
    });
    assert.equal(result.action, 'blocked_inconsistent_attempt_history');
  }
});

test('does not resume a pre-submission Attempt with a chain observation or accounting side effect', () => {
  const inconsistentStates = [
    { chainObservation: 'unknown' },
    { chainObservation: 'verified_observation' },
    { accountingOutcome: 'unknown' },
    { accountingOutcome: 'committed' },
  ];

  for (const state of inconsistentStates) {
    const result = decide({
      cycleClaim: CLAIM,
      priorAttempt: attempt({
        submissionMayHaveOccurred: false,
        signature: null,
        messageHash: null,
        chainObservation: 'not_checked',
        accountingOutcome: 'not_committed',
        ...state,
      }),
    });
    assert.equal(result.action, 'blocked_inconsistent_attempt_history');
  }
});
