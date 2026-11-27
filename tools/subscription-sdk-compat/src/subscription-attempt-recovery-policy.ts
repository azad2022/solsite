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
  /** Stable, server-derived identity for Subscription PDA + actual on-chain period start. */
  readonly cycleIdentity: string | null;
  /** Opaque fencing token returned by the database claim operation. */
  readonly fencingToken: string | null;
}

export interface SubscriptionDurableAttemptEvidence {
  readonly attemptId: string;
  /** Exact Cycle identity this Attempt was atomically attached to. */
  readonly cycleIdentity: string;
  /** True once the request may have reached an RPC submit boundary. */
  readonly submissionMayHaveOccurred: boolean;
  /** Exact signature and serialized-message hash persisted before submission. */
  readonly signature: string | null;
  readonly messageHash: string | null;
  readonly chainObservation: SubscriptionAttemptChainObservation;
  readonly rejectionProof?: SubscriptionAttemptRejectionProof;
  /** A lost DB response is UNKNOWN, not proof that the atomic commit did not occur. */
  readonly accountingOutcome: 'not_committed' | 'unknown' | 'committed';
  /** Result of a separately approved retry/entitlement policy, not inferred here. */
  readonly retryAuthorized: boolean;
}

export interface ResolveSubscriptionAttemptRecoveryInput {
  readonly cycleClaim: SubscriptionCycleClaimEvidence;
  /**
   * True only when the database read was complete for this locked Cycle,
   * including every Attempt that may still have an external side effect.
   * A failed/partial read is never equivalent to "no prior Attempt".
   */
  readonly attemptHistoryComplete: boolean;
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
      readonly action: 'reconcile_atomic_accounting_commit';
      readonly attemptId: string;
      readonly signature: string;
      readonly messageHash: string;
      readonly fencingToken: string;
      readonly mustNotCreateNewAttempt: true;
      readonly mustReuseExactObservation: true;
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
      readonly action: 'blocked_claim_unknown' | 'blocked_attempt_history_unknown' |
        'blocked_inconsistent_attempt_history' | 'blocked_retry_policy' | 'manual_review_required';
      readonly reasons: readonly string[];
    };

function blocked(
  action: 'blocked_claim_unknown' | 'blocked_attempt_history_unknown' |
    'blocked_inconsistent_attempt_history' | 'blocked_retry_policy' | 'manual_review_required',
  reason: string,
): SubscriptionAttemptRecoveryDecision {
  return { action, reasons: [reason] };
}

function validAttemptId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function validCycleIdentity(value: string | null): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/.test(value);
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SOLANA_SIGNATURE_BYTES = 64;

function validSignature(value: string | null): value is string {
  if (
    typeof value !== 'string' ||
    value.length < SOLANA_SIGNATURE_BYTES ||
    value.length > 88
  ) {
    return false;
  }

  let leadingZeroBytes = 0;
  while (value[leadingZeroBytes] === '1') {
    leadingZeroBytes += 1;
  }

  let decoded = 0n;
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) {
      return false;
    }
    decoded = decoded * 58n + BigInt(digit);
  }

  let decodedBytes = 0;
  while (decoded > 0n) {
    decodedBytes += 1;
    decoded >>= 8n;
  }

  return leadingZeroBytes + decodedBytes === SOLANA_SIGNATURE_BYTES;
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
  if (claim.outcome !== 'acquired') {
    return blocked('blocked_claim_unknown', 'The database Cycle claim outcome is unknown or malformed; no Attempt may be created or retried.');
  }
  if (typeof claim.fencingToken !== 'string' || claim.fencingToken.trim().length === 0) {
    return blocked('blocked_claim_unknown', 'An acquired Cycle claim without a fencing token is incomplete.');
  }
  if (!validCycleIdentity(claim.cycleIdentity)) {
    return blocked('blocked_claim_unknown', 'An acquired Cycle claim is not bound to a valid server-derived Cycle identity.');
  }
  if (input.attemptHistoryComplete !== true) {
    return blocked(
      'blocked_attempt_history_unknown',
      'The database did not prove a complete Attempt history for this Cycle; absence of a returned Attempt cannot authorize a new charge.',
    );
  }

  const attempt = input.priorAttempt;
  if (attempt === null) {
    return {
      action: 'first_attempt_permitted',
      fencingToken: claim.fencingToken,
      mustPersistAttemptBeforeSigning: true,
    };
  }

  if (
    typeof attempt.submissionMayHaveOccurred !== 'boolean' ||
    typeof attempt.retryAuthorized !== 'boolean' ||
    !['not_checked', 'unknown', 'rejected', 'verified_observation'].includes(attempt.chainObservation) ||
    !['not_committed', 'unknown', 'committed'].includes(attempt.accountingOutcome)
  ) {
    return blocked('blocked_inconsistent_attempt_history', 'The persisted Attempt contains an unknown or malformed recovery state.');
  }
  if (!validAttemptId(attempt.attemptId)) {
    return blocked('blocked_inconsistent_attempt_history', 'The persisted Attempt identity is missing or malformed.');
  }
  if (
    !validCycleIdentity(attempt.cycleIdentity) ||
    attempt.cycleIdentity !== claim.cycleIdentity
  ) {
    return blocked(
      'blocked_inconsistent_attempt_history',
      'The persisted Attempt is not bound to the exact Cycle currently claimed; cross-Cycle recovery is prohibited.',
    );
  }
  if (
    !['not_committed', 'unknown', 'committed'].includes(attempt.accountingOutcome) ||
    (attempt.accountingOutcome !== 'not_committed' && attempt.chainObservation !== 'verified_observation')
  ) {
    return blocked('blocked_inconsistent_attempt_history', 'Accounting is unknown or committed without a verified transaction observation, or its outcome is malformed.');
  }

  if (!attempt.submissionMayHaveOccurred) {
    if (attempt.chainObservation !== 'not_checked' || attempt.accountingOutcome !== 'not_committed') {
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
    if (attempt.accountingOutcome === 'committed') {
      return {
        action: 'cycle_accounted',
        attemptId: attempt.attemptId,
        fencingToken: claim.fencingToken,
        mustNotCreateNewAttempt: true,
      };
    }
    if (attempt.accountingOutcome === 'unknown') {
      return {
        action: 'reconcile_atomic_accounting_commit',
        attemptId: attempt.attemptId,
        signature: attempt.signature,
        messageHash: attempt.messageHash,
        fencingToken: claim.fencingToken,
        mustNotCreateNewAttempt: true,
        mustReuseExactObservation: true,
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
