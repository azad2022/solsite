export type SubscriptionAttemptChainObservation =
  | 'not_checked'
  | 'unknown'
  | 'rejected'
  | 'verified_observation';

export type SubscriptionAttemptRejectionProof =
  | 'finalized_execution_error'
  | 'policy_or_identity_mismatch'
  | 'unknown';

export interface SubscriptionCycleClaimEvidence {
  readonly outcome: 'acquired' | 'not_acquired' | 'unknown';
  /** Opaque fencing token returned by the database claim operation. */
  readonly fencingToken: string | null;
}

export interface SubscriptionDurableAttemptEvidence {
  readonly attemptId: string;
  /** True once the request may have reached an RPC submit boundary. */
  readonly submissionMayHaveOccurred: boolean;
  /** Exact signature and serialized-message hash persisted before submission. */
  readonly signature: string | null;
  readonly messageHash: string | null;
  readonly chainObservation: SubscriptionAttemptChainObservation;
  readonly rejectionProof?: SubscriptionAttemptRejectionProof;
  /** True only after the atomic DB accounting commit is confirmed. */
  readonly accountingCommitted: boolean;
  /** Result of a separately approved retry/entitlement policy, not inferred here. */
  readonly retryAuthorized: boolean;
}

export interface ResolveSubscriptionAttemptRecoveryInput {
  readonly cycleClaim: SubscriptionCycleClaimEvidence;
  readonly priorAttempt: SubscriptionDurableAttemptEvidence | null;
}

export type SubscriptionAttemptRecoveryDecision =
  | {
      readonly action: 'first_attempt_permitted';
      readonly fencingToken: string;
      readonly mustPersistAttemptBeforeSigning: true;
    }
  | {
      readonly action: 'resume_existing_pre_submission_attempt';
      readonly attemptId: string;
      readonly signature: string | null;
      readonly messageHash: string | null;
      readonly fencingToken: string;
      readonly mustNotCreateNewAttempt: true;
    }
  | {
      readonly action: 'reconcile_existing_attempt';
      readonly attemptId: string;
      readonly signature: string;
      readonly messageHash: string;
      readonly fencingToken: string;
      readonly mustNotCreateNewAttempt: true;
      readonly mustReuseExactTransaction: true;
    }
  | {
      readonly action: 'await_atomic_accounting_commit';
      readonly attemptId: string;
      readonly signature: string;
      readonly messageHash: string;
      readonly fencingToken: string;
      readonly mustNotCreateNewAttempt: true;
    }
  | {
      readonly action: 'cycle_accounted';
      readonly attemptId: string;
      readonly fencingToken: string;
      readonly mustNotCreateNewAttempt: true;
    }
  | {
      readonly action: 'retry_permitted_after_finalized_execution_error';
      readonly previousAttemptId: string;
      readonly fencingToken: string;
      readonly mustCreateNewAttemptWithNewCorrelation: true;
    }
  | {
      readonly action: 'wait_for_cycle_claim';
    }
  | {
      readonly action: 'blocked_claim_unknown' | 'blocked_inconsistent_attempt_history' |
        'blocked_retry_policy' | 'manual_review_required';
      readonly reasons: readonly string[];
    };

function blocked(
  action: 'blocked_claim_unknown' | 'blocked_inconsistent_attempt_history' |
    'blocked_retry_policy' | 'manual_review_required',
  reason: string,
): SubscriptionAttemptRecoveryDecision {
  return { action, reasons: [reason] };
}

function validAttemptId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function validSignature(value: string | null): value is string {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(value);
}

function validMessageHash(value: string | null): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/**
 * Deterministic recovery decision for an already-persisted billing Cycle and
 * Attempt. It never performs a claim, creates an Attempt, signs, submits, or
 * retries a transaction. The caller must obtain the database-enforced unique
 * Cycle claim and fencing token first, and must apply this decision through
 * a short server-side transaction.
 *
 * Core safety rule: after submission may have occurred, UNKNOWN/not-checked
 * means reconcile the same signature and message hash. A new Attempt is only
 * permitted after a proven finalized Solana execution error (which commits no
 * instruction state changes) and an independently-approved retry policy.
 * A policy/verifier mismatch is not treated as proof that no funds moved.
 */
export function resolveSubscriptionAttemptRecovery(
  input: ResolveSubscriptionAttemptRecoveryInput,
): SubscriptionAttemptRecoveryDecision {
  const claim = input.cycleClaim;
  if (claim.outcome === 'not_acquired') {
    return { action: 'wait_for_cycle_claim' };
  }
  if (claim.outcome === 'unknown') {
    return blocked('blocked_claim_unknown', 'The database Cycle claim outcome is unknown; no Attempt may be created or retried.');
  }
  if (typeof claim.fencingToken !== 'string' || claim.fencingToken.trim().length === 0) {
    return blocked('blocked_claim_unknown', 'An acquired Cycle claim without a fencing token is incomplete.');
  }

  const attempt = input.priorAttempt;
  if (attempt === null) {
    return {
      action: 'first_attempt_permitted',
      fencingToken: claim.fencingToken,
      mustPersistAttemptBeforeSigning: true,
    };
  }

  if (!validAttemptId(attempt.attemptId)) {
    return blocked('blocked_inconsistent_attempt_history', 'The persisted Attempt identity is missing or malformed.');
  }
  if (attempt.accountingCommitted && attempt.chainObservation !== 'verified_observation') {
    return blocked('blocked_inconsistent_attempt_history', 'Accounting is marked committed without a verified transaction observation.');
  }

  if (!attempt.submissionMayHaveOccurred) {
    if (attempt.chainObservation !== 'not_checked') {
      return blocked('blocked_inconsistent_attempt_history', 'A pre-submission Attempt cannot already have a chain observation.');
    }
    const hasSignature = attempt.signature !== null;
    const hasMessageHash = attempt.messageHash !== null;
    if (hasSignature !== hasMessageHash) {
      return blocked('blocked_inconsistent_attempt_history', 'The pre-submission Attempt has only one half of its signature/message correlation.');
    }
    if (
      (hasSignature && !validSignature(attempt.signature)) ||
      (hasMessageHash && !validMessageHash(attempt.messageHash))
    ) {
      return blocked('blocked_inconsistent_attempt_history', 'The prepared Attempt signature/message correlation is malformed.');
    }
    return {
      action: 'resume_existing_pre_submission_attempt',
      attemptId: attempt.attemptId,
      signature: attempt.signature,
      messageHash: attempt.messageHash,
      fencingToken: claim.fencingToken,
      mustNotCreateNewAttempt: true,
    };
  }

  if (!validSignature(attempt.signature) || !validMessageHash(attempt.messageHash)) {
    return blocked('blocked_inconsistent_attempt_history', 'Submission may have occurred but the exact signature/message hash was not durably recorded.');
  }

  if (attempt.chainObservation === 'not_checked' || attempt.chainObservation === 'unknown') {
    return {
      action: 'reconcile_existing_attempt',
      attemptId: attempt.attemptId,
      signature: attempt.signature,
      messageHash: attempt.messageHash,
      fencingToken: claim.fencingToken,
      mustNotCreateNewAttempt: true,
      mustReuseExactTransaction: true,
    };
  }

  if (attempt.chainObservation === 'verified_observation') {
    if (attempt.accountingCommitted) {
      return {
        action: 'cycle_accounted',
        attemptId: attempt.attemptId,
        fencingToken: claim.fencingToken,
        mustNotCreateNewAttempt: true,
      };
    }
    return {
      action: 'await_atomic_accounting_commit',
      attemptId: attempt.attemptId,
      signature: attempt.signature,
      messageHash: attempt.messageHash,
      fencingToken: claim.fencingToken,
      mustNotCreateNewAttempt: true,
    };
  }

  if (attempt.chainObservation === 'rejected') {
    if (attempt.rejectionProof !== 'finalized_execution_error') {
      return blocked(
        'manual_review_required',
        'A verifier or identity rejection is not proof that no token movement occurred; automatic retry is prohibited.',
      );
    }
    if (!attempt.retryAuthorized) {
      return blocked('blocked_retry_policy', 'The transaction failed on finalized chain state, but the approved retry policy does not authorize another Attempt.');
    }
    return {
      action: 'retry_permitted_after_finalized_execution_error',
      previousAttemptId: attempt.attemptId,
      fencingToken: claim.fencingToken,
      mustCreateNewAttemptWithNewCorrelation: true,
    };
  }

  return blocked('manual_review_required', 'Attempt history is not classifiable; no new charge is permitted.');
}
