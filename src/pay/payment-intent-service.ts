import { defaultPayHttpClient, PayHttpError, type PayHttpClient } from './http';

export type PayPaymentStatus =
  | 'created' | 'pending' | 'detected' | 'verifying' | 'confirmed' | 'completed'
  | 'expired' | 'underpaid' | 'overpaid' | 'wrong_token' | 'wrong_recipient'
  | 'duplicate' | 'ambiguous' | 'failed' | 'refunded';

export interface PayPaymentIntent {
  readonly id: string;
  readonly merchant: { readonly id: string; readonly businessName: string };
  readonly amountAtomic: string;
  readonly asset: string;
  readonly tokenMint: string | null;
  readonly tokenProgram: string | null;
  readonly tokenDecimals: number | null;
  readonly recipient: string;
  readonly reference: string;
  readonly feeBps: number;
  readonly feePayer: string;
  readonly feeAtomic: string;
  readonly gasSponsored: boolean;
  readonly status: PayPaymentStatus;
  readonly expiresAt: string;
  readonly customerTotalAtomic: string;
  readonly network: string;
  readonly verificationCommitment: 'confirmed' | 'finalized';
}

interface PaymentIntentEnvelope {
  success: boolean;
  apiVersion: 'v1';
  data: PayPaymentIntent;
}

const PAYMENT_INTENT_PATH = (intentId: string) => `/api/pay/v1/payment-intents/${encodeURIComponent(intentId)}`;
const PAYMENT_STATUSES = new Set<PayPaymentStatus>([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'completed',
  'expired', 'underpaid', 'overpaid', 'wrong_token', 'wrong_recipient',
  'duplicate', 'ambiguous', 'failed', 'refunded'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Invalid Pay contract field: ${name}`);
  return value;
}

function nullableString(value: unknown, name: string): string | null {
  if (value === null) return null;
  return requiredString(value, name);
}

function requiredInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value)) throw new TypeError(`Invalid Pay contract field: ${name}`);
  return value as number;
}

function requiredBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`Invalid Pay contract field: ${name}`);
  return value;
}

function parsePaymentIntent(payload: unknown): PayPaymentIntent {
  if (!isRecord(payload) || payload.success !== true || payload.apiVersion !== 'v1' || !isRecord(payload.data)) {
    throw new TypeError('Invalid Pay Payment Intent response envelope.');
  }

  const data = payload.data;
  const merchant = data.merchant;
  const status = data.status;
  const commitment = data.verificationCommitment;

  if (!isRecord(merchant) || !PAYMENT_STATUSES.has(status as PayPaymentStatus)) {
    throw new TypeError('Invalid Pay Payment Intent response.');
  }
  if (commitment !== 'confirmed' && commitment !== 'finalized') {
    throw new TypeError('Invalid Pay Payment Intent verification commitment.');
  }

  return {
    id: requiredString(data.id, 'id'),
    merchant: {
      id: requiredString(merchant.id, 'merchant.id'),
      businessName: requiredString(merchant.businessName, 'merchant.businessName'),
    },
    amountAtomic: requiredString(data.amountAtomic, 'amountAtomic'),
    asset: requiredString(data.asset, 'asset'),
    tokenMint: nullableString(data.tokenMint, 'tokenMint'),
    tokenProgram: nullableString(data.tokenProgram, 'tokenProgram'),
    tokenDecimals: data.tokenDecimals === null ? null : requiredInteger(data.tokenDecimals, 'tokenDecimals'),
    recipient: requiredString(data.recipient, 'recipient'),
    reference: requiredString(data.reference, 'reference'),
    feeBps: requiredInteger(data.feeBps, 'feeBps'),
    feePayer: requiredString(data.feePayer, 'feePayer'),
    feeAtomic: requiredString(data.feeAtomic, 'feeAtomic'),
    gasSponsored: requiredBoolean(data.gasSponsored, 'gasSponsored'),
    status: status as PayPaymentStatus,
    expiresAt: requiredString(data.expiresAt, 'expiresAt'),
    customerTotalAtomic: requiredString(data.customerTotalAtomic, 'customerTotalAtomic'),
    network: requiredString(data.network, 'network'),
    verificationCommitment: commitment,
  };
}

export function createPayPaymentIntentService(httpClient: PayHttpClient = defaultPayHttpClient) {
  return {
    async get(intentId: string): Promise<PayPaymentIntent> {
      const id = intentId.trim();
      if (!id) throw new TypeError('Payment Intent ID is required.');
      const payload = await httpClient.request<PaymentIntentEnvelope>(PAYMENT_INTENT_PATH(id), { method: 'GET' });
      return parsePaymentIntent(payload);
    },
  };
}

export const payPaymentIntentService = createPayPaymentIntentService();
export { PayHttpError };
