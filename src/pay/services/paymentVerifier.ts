/**
 * Payment verification orchestrator.
 *
 * This service connects a provider-neutral Solana adapter to the pure
 * verification policy. It deliberately returns a verification decision only;
 * callers must persist the authoritative observation and accounting outcome in
 * a transaction-safe server workflow.
 */
import type { SolanaPaymentProvider } from './blockchainProvider';
import { verifyPaymentTransaction, type ExpectedPayment, type VerificationResult } from './verificationPolicy';

export interface VerificationCandidate {
  signature: string;
  result: VerificationResult;
}

export interface PaymentVerificationDecision {
  result: VerificationResult;
  candidate: VerificationCandidate | null;
  checkedSignatures: readonly string[];
}

export async function verifyPayment(
  provider: SolanaPaymentProvider,
  expected: ExpectedPayment,
  signature?: string,
  knownSignatures: ReadonlySet<string> = new Set(),
): Promise<PaymentVerificationDecision> {
  const observations = signature
    ? [await provider.getTransaction(signature, expected.requiredCommitment)]
    : await provider.findTransactionsByReference(expected.reference, expected.requiredCommitment);

  const checked = new Set<string>();
  let lastResult: VerificationResult = {
    valid: false,
    status: 'failed',
    reason: 'MISSING_SIGNATURE',
  };

  for (const observation of observations) {
    if (!observation?.signature || checked.has(observation.signature)) continue;
    checked.add(observation.signature);

    const duplicate = knownSignatures.has(observation.signature);
    const result = verifyPaymentTransaction(expected, observation, duplicate);
    if (result.valid) {
      return {
        result,
        candidate: { signature: observation.signature, result },
        checkedSignatures: [...checked],
      };
    }
    lastResult = result;
  }

  return {
    result: lastResult,
    candidate: null,
    checkedSignatures: [...checked],
  };
}
