/**
 * Explicit Payment Intent transitions.
 *
 * The TypeScript policy mirrors the authoritative database transition function.
 * Workers and HTTP handlers must never invent ad-hoc status changes.
 */
import type { PaymentStatus } from '../types/domain';

const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ['pending', 'expired'],
  pending: ['detected', 'expired', 'failed', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient', 'duplicate', 'ambiguous'],
  detected: ['verifying', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient', 'duplicate', 'ambiguous', 'failed'],
  verifying: ['pending', 'confirmed', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient', 'duplicate', 'ambiguous', 'failed'],
  underpaid: ['pending', 'detected', 'verifying', 'expired'],
  overpaid: ['refunded', 'completed'],
  confirmed: ['completed', 'refunded'],
  completed: ['refunded'],
  expired: [],
  wrong_token: [],
  wrong_recipient: [],
  duplicate: [],
  ambiguous: ['pending', 'detected', 'verifying', 'expired'],
  failed: [],
  refunded: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return transitions[from].includes(to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Illegal SolMint Pay status transition: ${from} -> ${to}`);
  }
}
