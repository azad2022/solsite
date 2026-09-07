import { defaultPayHttpClient, PayHttpError, type PayHttpClient } from './http';

export type PayPaymentStatus =
  | 'created' | 'pending' | 'detected' | 'verifying' | 'confirmed' | 'completed'
  | 'expired' | 'underpaid' | 'overpaid' | 'wrong_token' | 'wrong_recipient'
  | 'duplicate' | 'ambiguous' | 'failed' | 'refunded';

export type PayPaymentAsset = 'SOL' | 'USDC' | 'USDT';
export type PayFeePayer = 'merchant' | 'customer';

export interface PayPaymentIntent {
  readonly id: string;
  readonly merchant: { readonly id: string; readonly businessName: string };
  readonly amountAtomic: string;
  readonly asset: PayPaymentAsset;
  readonly tokenMint: string | null;
  readonly tokenProgram: string | null;
  readonly tokenDecimals: number | null;
  readonly recipient: string;
  readonly reference: string;
  readonly feeBps: number;
  readonly feePayer: PayFeePayer;
  readonly feeAtomic: string;
  readonly gasSponsored: boolean;
  readonly status: PayPaymentStatus;
  readonly expiresAt: string;
  readonly customerTotalAtomic: string;
  readonly network: 'solana';
  readonly verificationCommitment: 'confirmed' | 'finalized';
}

interface PaymentIntentEnvelope {
  success: boolean;
  apiVersion: 'v1';
  data: PayPaymentIntent;
}

const PAYMENT_INTENT_PATH = (intentId: string) => `/api/pay/v1/payment-intents/${encodeURIComponent(intentId)}`;
const PAYMENT_ASSETS = new Set<PayPaymentAsset>(['SOL', 'USDC', 'USDT']);
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

function atomicString(value: unknown, name: string): string {
  const result = requiredString(value, name);
  if (!/^\d+$/.test(result)) throw new TypeError(`Invalid Pay contract field: ${name}`);
  return result;
}

function boundedInteger(value: unknown, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TypeError(`Invalid Pay contract field: ${name}`);
  }
  return value as number;
}

function requiredBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`Invalid Pay contract field: ${name}`);
  return value;
}

function uuid(value: unknown, name: string): string {
  const result = requiredString(value, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) {
    throw new TypeError(`Invalid Pay contract field: ${name}`);
  }
  return result;
}

function parsePaymentIntent(payload: unknown): PayPaymentIntent {
  if (!isRecord(payload) || payload.success !== true || payload.apiVersion !== 'v1' || !isRecord(payload.data)) {
    throw new TypeError('Invalid Pay Payment Intent response envelope.');
  }

  const data = payload.data;
  const merchant = data.merchant;
  const status = data.status;
  const commitment = data.verificationCommitment;
  const asset = data.asset;
  const feePayer = data.feePayer;

  if (!isRecord(merchant) || !PAYMENT_STATUSES.has(status as PayPaymentStatus)) {
    throw new TypeError('Invalid Pay Payment Intent response.');
  }
  if (!PAYMENT_ASSETS.has(asset as PayPaymentAsset)) {
    throw new TypeError('Invalid Pay Payment Intent asset.');
  }
  if (feePayer !== 'merchant' && feePayer !== 'customer') {
    throw new TypeError('Invalid Pay Payment Intent fee payer.');
  }
  if (data.network !== 'solana') {
    throw new TypeError('Invalid Pay Payment Intent network.');
  }
  if (commitment !== 'confirmed' && commitment !== 'finalized') {
    throw new TypeError('Invalid Pay Payment Intent verification commitment.');
  }

  const tokenMint = nullableString(data.tokenMint, 'tokenMint');
  const tokenProgram = nullableString(data.tokenProgram, 'tokenProgram');
  const tokenDecimals = data.tokenDecimals === null ? null : boundedInteger(data.tokenDecimals, 'tokenDecimals', 0, 255);

  if (asset === 'SOL') {
    if (tokenMint !== null || tokenProgram !== null || tokenDecimals !== null) {
      throw new TypeError('Invalid Pay Payment Intent SOL token fields.');
    }
  } else if (tokenMint === null || tokenProgram === null || tokenDecimals === null) {
    throw new TypeError('Invalid Pay Payment Intent token fields.');
  }

  const reference = requiredString(data.reference, 'reference');
  if (reference.length < 32 || reference.length > 44) {
    throw new TypeError('Invalid Pay contract field: reference');
  }

  return {
    id: uuid(data.id, 'id'),
    merchant: {
      id: uuid(merchant.id, 'merchant.id'),
      businessName: requiredString(merchant.businessName, 'merchant.businessName'),
    },
    amountAtomic: atomicString(data.amountAtomic, 'amountAtomic'),
    asset: asset as PayPaymentAsset,
    tokenMint,
    tokenProgram,
    tokenDecimals,
    recipient: requiredString(data.recipient, 'recipient'),
    reference,
    feeBps: boundedInteger(data.feeBps, 'feeBps', 0, 10000),
    feePayer: feePayer as PayFeePayer,
    feeAtomic: atomicString(data.feeAtomic, 'feeAtomic'),
    gasSponsored: requiredBoolean(data.gasSponsored, 'gasSponsored'),
    status: status as PayPaymentStatus,
    expiresAt: requiredString(data.expiresAt, 'expiresAt'),
    customerTotalAtomic: atomicString(data.customerTotalAtomic, 'customerTotalAtomic'),
    network: 'solana',
    verificationCommitment: commitment,
  };
}

export function createPayPaymentIntentService(httpClient: PayHttpClient = defaultPayHttpClient) {
  return {
    async get(intentId: string): Promise<PayPaymentIntent> {
      const id = intentId.trim();
      if (!id) throw new TypeError('Payment Intent ID is required.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new TypeError('Payment Intent ID is invalid.');
      }
      const payload = await httpClient.request<PaymentIntentEnvelope>(PAYMENT_INTENT_PATH(id), { method: 'GET' });
      return parsePaymentIntent(payload);
    },
  };
}

export const payPaymentIntentService = createPayPaymentIntentService();
export { PayHttpError };
