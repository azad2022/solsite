import type { PayPaymentStatus } from './payment-intent-service';

export function isPaymentIntentFinal(status: PayPaymentStatus): boolean {
  return status === 'completed' || status === 'refunded' || status === 'expired';
}

export function isPaymentIntentCompleted(status: PayPaymentStatus): boolean {
  return status === 'completed';
}
