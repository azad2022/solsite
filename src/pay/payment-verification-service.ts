import { defaultPayHttpClient, type PayHttpClient } from './http';
import type { PayPaymentStatus } from './payment-intent-service';

export interface PayPaymentVerificationResult {
  readonly paymentId: string;
  readonly status: PayPaymentStatus;
  readonly outcome: string;
  readonly signature: string;
  readonly checkedSignatures: readonly string[];
}

interface VerificationEnvelope {
  success: boolean;
  data: {
    paymentId: string;
    status: PayPaymentStatus;
    outcome: string;
    signature: string;
    checkedSignatures?: string[];
  };
}

const PAYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOLANA_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;
const STATUSES = new Set<PayPaymentStatus>([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'completed',
  'expired', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient',
  'duplicate', 'ambiguous', 'failed', 'refunded',
]);

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid Pay verification response.');
}

function parseResult(payload: unknown, paymentId: string, signature: string): PayPaymentVerificationResult {
  assertRecord(payload);
  const data = payload.data;
  assertRecord(data);
  if (payload.success !== true || data.paymentId !== paymentId || typeof data.outcome !== 'string' || typeof data.signature !== 'string') {
    throw new TypeError('Invalid Pay verification response envelope.');
  }
  if (!STATUSES.has(data.status as PayPaymentStatus)) throw new TypeError('Invalid Pay verification status.');
  if (!SOLANA_SIGNATURE.test(data.signature) || data.signature !== signature) throw new TypeError('Invalid Pay verification signature.');
  const checked = data.checkedSignatures;
  if (checked !== undefined && (!Array.isArray(checked) || checked.some((item) => typeof item !== 'string' || !SOLANA_SIGNATURE.test(item)))) {
    throw new TypeError('Invalid Pay verification checkedSignatures.');
  }
  return {
    paymentId,
    status: data.status as PayPaymentStatus,
    outcome: data.outcome,
    signature: data.signature,
    checkedSignatures: checked ?? [],
  };
}

export function createPayPaymentVerificationService(httpClient: PayHttpClient = defaultPayHttpClient) {
  return {
    async verify(paymentId: string, signature: string): Promise<PayPaymentVerificationResult> {
      const id = paymentId.trim();
      const txSignature = signature.trim();
      if (!PAYMENT_ID.test(id)) throw new TypeError('Payment Intent ID is invalid.');
      if (!SOLANA_SIGNATURE.test(txSignature)) throw new TypeError('Transaction signature is invalid.');
      const payload = await httpClient.request<VerificationEnvelope>(`/api/pay/v1/payment-intents/${encodeURIComponent(id)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: txSignature }),
      });
      return parseResult(payload, id, txSignature);
    },
  };
}

export const payPaymentVerificationService = createPayPaymentVerificationService();
