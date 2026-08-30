/**
 * Explicit Payment Intent transitions.
 *
 * Keeping legal transitions in one pure module prevents handlers, workers and
 * UI code from inventing incompatible status changes as the product grows.
 */
import type { PaymentStatus } from '../types/domain';

const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ['pending', 'expired'],
  pending: ['detected', 'expired', 'failed'],
  detected: ['verifying', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient', 'duplicate', 'failed'],
  verifying: ['confirmed', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient', 'duplicate', 'failed'],
  // Underpayment may be followed by another valid transfer before expiry.
  underpaid: ['detected', 'verifying', 'expired'],
  // Overpayment requires an explicit business decision; it may be completed
  // only after reconciliation or refunded as a separate business operation.
  overpaid: ['refunded', 'completed'],
  confirmed: ['completed', 'refunded'],
  completed: ['refunded'],
  expired: [],
  wrong_token: [],
  wrong_recipient: [],
  duplicate: [],
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
