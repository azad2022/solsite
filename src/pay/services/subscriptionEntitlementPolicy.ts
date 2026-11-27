/**
 * Pure activation gate for Subscription entitlement.
 *
 * The gate does not grant access or write data. It requires a finalized,
 * independently verified observation and a committed atomic accounting result
 * for the exact same cluster/transaction/Cycle/Attempt correlation.
 */
export interface SubscriptionVerifiedObservation {
  outcome: 'verified_observation';
  commitment: 'finalized';
  clusterGenesisHash: string;
  signature: string;
  messageHash: string;
  cycleIdentity: string;
  attemptId: string;
}

export interface SubscriptionUnverifiedObservation {
  outcome: 'unknown' | 'rejected';
  reason?: string;
}

export type SubscriptionVerificationEvidence =
  | SubscriptionVerifiedObservation
  | SubscriptionUnverifiedObservation;

export interface SubscriptionAtomicAccountingCommit {
  outcome: 'committed';
  clusterGenesisHash: string;
  signature: string;
  messageHash: string;
  cycleIdentity: string;
  attemptId: string;
}

export interface SubscriptionUncommittedAccounting {
  outcome: 'not_committed' | 'unknown';
}

export type SubscriptionAccountingEvidence =
  | SubscriptionAtomicAccountingCommit
  | SubscriptionUncommittedAccounting;

export type SubscriptionEntitlementBlockReason =
  | 'verification_not_verified'
  | 'accounting_not_committed'
  | 'observation_correlation_missing'
  | 'accounting_correlation_mismatch';

export type SubscriptionEntitlementDecision =
  | {
      eligible: true;
      evidence: {
        clusterGenesisHash: string;
        signature: string;
        messageHash: string;
        cycleIdentity: string;
        attemptId: string;
      };
    }
  | {
      eligible: false;
      reason: SubscriptionEntitlementBlockReason;
    };

const CORRELATION_FIELDS = [
  'clusterGenesisHash',
  'signature',
  'messageHash',
  'cycleIdentity',
  'attemptId',
] as const;

function hasCompleteCorrelation(
  value: SubscriptionVerifiedObservation | SubscriptionAtomicAccountingCommit,
): boolean {
  return CORRELATION_FIELDS.every((field) => {
    const candidate = value[field];
    return typeof candidate === 'string' && candidate.trim().length > 0;
  });
}

/**
 * Returns eligibility only; it never mutates entitlement.
 *
 * A submitted signature, non-final result, verifier UNKNOWN/REJECTED, lost
 * accounting response, or accounting record for a different Attempt/Cycle
 * cannot activate a Subscription.
 */
export function evaluateSubscriptionEntitlement(
  verification: SubscriptionVerificationEvidence | null,
  accounting: SubscriptionAccountingEvidence | null,
): SubscriptionEntitlementDecision {
  if (
    !verification ||
    verification.outcome !== 'verified_observation' ||
    verification.commitment !== 'finalized'
  ) {
    return { eligible: false, reason: 'verification_not_verified' };
  }

  if (!hasCompleteCorrelation(verification)) {
    return { eligible: false, reason: 'observation_correlation_missing' };
  }

  if (!accounting || accounting.outcome !== 'committed') {
    return { eligible: false, reason: 'accounting_not_committed' };
  }

  if (!hasCompleteCorrelation(accounting)) {
    return { eligible: false, reason: 'accounting_correlation_mismatch' };
  }

  for (const field of CORRELATION_FIELDS) {
    if (verification[field] !== accounting[field]) {
      return { eligible: false, reason: 'accounting_correlation_mismatch' };
    }
  }

  return {
    eligible: true,
    evidence: {
      clusterGenesisHash: verification.clusterGenesisHash,
      signature: verification.signature,
      messageHash: verification.messageHash,
      cycleIdentity: verification.cycleIdentity,
      attemptId: verification.attemptId,
    },
  };
}
