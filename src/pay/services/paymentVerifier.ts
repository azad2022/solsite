import type { SolanaPaymentProvider } from './blockchainProvider';
import {
  verifyPaymentTransaction,
  type ExpectedPayment,
  type ObservedPaymentTransaction,
  type VerificationResult,
} from './verificationPolicy';

export interface VerificationCandidate {
  signature: string;
  observation: ObservedPaymentTransaction;
  result: VerificationResult;
}

export interface VerificationCheck {
  signature: string;
  observation: ObservedPaymentTransaction;
  result: VerificationResult;
}

export interface PaymentVerificationDecision {
  result: VerificationResult;
  candidate: VerificationCandidate | null;
  checks: readonly VerificationCheck[];
  checkedSignatures: readonly string[];
}

export async function verifyPayment(
  provider: SolanaPaymentProvider,
  expected: ExpectedPayment,
  signature?: string,
  knownSignatures: ReadonlySet<string> = new Set(),
  window?: { createdAt: string; expiresAt: string },
): Promise<PaymentVerificationDecision> {
  const observations = signature
    ? [await provider.getTransaction(signature, expected.requiredCommitment)]
    : await provider.findTransactionsByReference(expected.reference, expected.requiredCommitment, window);

  const checked = new Set<string>();
  const checks: VerificationCheck[] = [];
  let lastResult: VerificationResult = {
    valid: false,
    status: 'failed',
    reason: 'MISSING_SIGNATURE',
  };
  let validCandidate: VerificationCandidate | null = null;

  for (const observation of observations) {
    if (!observation?.signature || checked.has(observation.signature)) continue;
    checked.add(observation.signature);

    const result = verifyPaymentTransaction(expected, observation, knownSignatures.has(observation.signature));
    checks.push({ signature: observation.signature, observation, result });
    lastResult = result;

    if (result.valid) {
      if (validCandidate) {
        const ambiguous: VerificationResult = { valid: false, status: 'ambiguous', reason: 'AMBIGUOUS_CANDIDATE' };
        return { result: ambiguous, candidate: null, checks, checkedSignatures: [...checked] };
      }
      validCandidate = { signature: observation.signature, observation, result };
    }
  }

  if (validCandidate) {
    return { result: validCandidate.result, candidate: validCandidate, checks, checkedSignatures: [...checked] };
  }

  return { result: lastResult, candidate: null, checks, checkedSignatures: [...checked] };
}
