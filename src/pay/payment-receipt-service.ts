import { defaultPayHttpClient, type PayHttpClient } from './http';
import type { PayLocale } from './types';

export interface PayPaymentReceipt {
  readonly id: string;
  readonly status: 'completed';
  readonly merchant: { readonly id: string; readonly businessName: string };
  readonly paymentLink: {
    readonly slug: string;
    readonly title: string;
    readonly description: string | null;
    readonly checkoutLocale: PayLocale | 'auto';
  } | null;
  readonly amountAtomic: string;
  readonly customerTotalAtomic: string;
  readonly merchantSettlementAtomic: string;
  readonly feeAtomic: string;
  readonly feeBps: number;
  readonly feePayer: 'merchant' | 'customer';
  readonly asset: 'SOL' | 'USDC' | 'USDT';
  readonly tokenMint: string | null;
  readonly tokenProgram: string | null;
  readonly tokenDecimals: number | null;
  readonly recipient: string;
  readonly feeRecipient: string;
  readonly reference: string;
  readonly network: 'solana';
  readonly verificationCommitment: 'confirmed' | 'finalized';
  readonly createdAt: string;
  readonly completedAt: string;
  readonly transaction: {
    readonly id: string;
    readonly signature: string;
    readonly slot: number | null;
    readonly blockTime: string | null;
    readonly observedAmountAtomic: string;
    readonly asset: 'SOL' | 'USDC' | 'USDT';
    readonly recipient: string;
    readonly referenceMatched: boolean;
    readonly confirmed: boolean;
    readonly commitment: 'confirmed' | 'finalized';
    readonly feePayer: string | null;
    readonly networkFeeLamports: string;
    readonly verificationStatus: string;
    readonly verifiedAt: string;
    readonly isAuthoritative: boolean;
    readonly tokenMint: string | null;
    readonly tokenProgram: string | null;
    readonly tokenDecimals: number | null;
  };
  readonly transfers: readonly Record<string, unknown>[];
}

interface Envelope { success?: boolean; apiVersion?: string; data?: unknown; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCALES = new Set<PayLocale | 'auto'>(['fa-IR','en-US','ar','ru','auto']);
const ASSETS = new Set<PayPaymentReceipt['asset']>(['SOL','USDC','USDT']);

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid payment receipt field: ' + field);
  return value as Record<string, unknown>;
}
function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Invalid payment receipt field: ' + field);
  return value;
}
function nullableString(row: Record<string, unknown>, field: string): string | null {
  const value = row[field];
  if (value === null) return null;
  return requiredString(row, field);
}
function atomic(row: Record<string, unknown>, field: string): string {
  const value = requiredString(row, field);
  if (!/^\d+$/.test(value)) throw new TypeError('Invalid payment receipt atomic field: ' + field);
  return value;
}
function nullableInteger(row: Record<string, unknown>, field: string): number | null {
  const value = row[field];
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError('Invalid payment receipt integer field: ' + field);
  return value as number;
}
function bool(row: Record<string, unknown>, field: string): boolean {
  if (typeof row[field] !== 'boolean') throw new TypeError('Invalid payment receipt boolean field: ' + field);
  return row[field] as boolean;
}

function parseReceipt(value: unknown): PayPaymentReceipt {
  const root = record(value, 'data');
  const receipt = record(root.receipt, 'receipt');
  const merchant = record(receipt.merchant, 'receipt.merchant');
  const transaction = record(root.transaction, 'transaction');
  const paymentLink = receipt.paymentLink === null ? null : record(receipt.paymentLink, 'receipt.paymentLink');

  const status = requiredString(receipt, 'status');
  const asset = requiredString(receipt, 'asset');
  const feePayer = requiredString(receipt, 'feePayer');
  const network = requiredString(receipt, 'network');
  const verificationCommitment = requiredString(receipt, 'verificationCommitment');
  const txAsset = requiredString(transaction, 'asset');
  const txCommitment = requiredString(transaction, 'commitment');
  const rawFeeBps = receipt.feeBps;
  const feeBps = Number.isInteger(rawFeeBps) ? rawFeeBps as number : null;
  const rawTokenDecimals = receipt.tokenDecimals;
  const tokenDecimals = rawTokenDecimals === null ? null : Number.isInteger(rawTokenDecimals) ? rawTokenDecimals as number : null;
  const rawTxTokenDecimals = transaction.tokenDecimals;
  const txTokenDecimals = rawTxTokenDecimals === null ? null : Number.isInteger(rawTxTokenDecimals) ? rawTxTokenDecimals as number : null;

  if (!UUID.test(requiredString(receipt, 'id')) || status !== 'completed') throw new TypeError('Invalid completed payment receipt.');
  if (feeBps === null || feeBps < 0 || feeBps > 10000) throw new TypeError('Invalid payment receipt fee rate.');
  if (rawTokenDecimals !== null && tokenDecimals === null) throw new TypeError('Invalid payment receipt token decimals.');
  if (rawTokenDecimals !== null && (tokenDecimals < 0 || tokenDecimals > 255)) throw new TypeError('Invalid payment receipt token decimals.');
  if (rawTxTokenDecimals !== null && txTokenDecimals === null) throw new TypeError('Invalid payment receipt transaction token decimals.');
  if (rawTxTokenDecimals !== null && (txTokenDecimals < 0 || txTokenDecimals > 255)) throw new TypeError('Invalid payment receipt transaction token decimals.');
  if (!UUID.test(requiredString(merchant, 'id')) || !ASSETS.has(asset as PayPaymentReceipt['asset']) || (feePayer !== 'merchant' && feePayer !== 'customer') || network !== 'solana') {
    throw new TypeError('Invalid payment receipt snapshot.');
  }
  if (verificationCommitment !== 'confirmed' && verificationCommitment !== 'finalized') throw new TypeError('Invalid payment receipt commitment.');
  if (!ASSETS.has(txAsset as PayPaymentReceipt['asset']) || (txCommitment !== 'confirmed' && txCommitment !== 'finalized')) {
    throw new TypeError('Invalid payment receipt transaction.');
  }
  const transactionSignature = requiredString(transaction, 'signature').replace(/\s/g, '');
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(transactionSignature)) throw new TypeError('Invalid payment receipt transaction signature.');
  if (bool(transaction, 'isAuthoritative') !== true || bool(transaction, 'referenceMatched') !== true || bool(transaction, 'confirmed') !== true) {
    throw new TypeError('Invalid authoritative payment receipt transaction.');
  }

  let parsedLink: PayPaymentReceipt['paymentLink'] = null;
  if (paymentLink) {
    const checkoutLocale = requiredString(paymentLink, 'checkoutLocale');
    if (!LOCALES.has(checkoutLocale as PayLocale | 'auto')) throw new TypeError('Invalid payment receipt checkout locale.');
    parsedLink = {
      slug: requiredString(paymentLink, 'slug'),
      title: requiredString(paymentLink, 'title'),
      description: nullableString(paymentLink, 'description'),
      checkoutLocale: checkoutLocale as PayLocale | 'auto',
    };
  }

  return {
    id: requiredString(receipt, 'id'),
    status: 'completed',
    merchant: { id: requiredString(merchant, 'id'), businessName: requiredString(merchant, 'businessName') },
    paymentLink: parsedLink,
    amountAtomic: atomic(receipt, 'amountAtomic'),
    customerTotalAtomic: atomic(receipt, 'customerTotalAtomic'),
    merchantSettlementAtomic: atomic(receipt, 'merchantSettlementAtomic'),
    feeAtomic: atomic(receipt, 'feeAtomic'),
    feeBps,
    feePayer: feePayer as PayPaymentReceipt['feePayer'],
    asset: asset as PayPaymentReceipt['asset'],
    tokenMint: nullableString(receipt, 'tokenMint'),
    tokenProgram: nullableString(receipt, 'tokenProgram'),
    tokenDecimals: tokenDecimals === null ? null : Number(tokenDecimals),
    recipient: requiredString(receipt, 'recipient'),
    feeRecipient: requiredString(receipt, 'feeRecipient'),
    reference: requiredString(receipt, 'reference'),
    network: 'solana',
    verificationCommitment: verificationCommitment as PayPaymentReceipt['verificationCommitment'],
    createdAt: requiredString(receipt, 'createdAt'),
    completedAt: requiredString(receipt, 'completedAt'),
    transaction: {
      id: requiredString(transaction, 'id'),
      signature: transactionSignature,
      slot: nullableInteger(transaction, 'slot'),
      blockTime: nullableString(transaction, 'blockTime'),
      observedAmountAtomic: atomic(transaction, 'observedAmountAtomic'),
      asset: txAsset as PayPaymentReceipt['asset'],
      recipient: requiredString(transaction, 'recipient'),
      referenceMatched: bool(transaction, 'referenceMatched'),
      confirmed: bool(transaction, 'confirmed'),
      commitment: txCommitment as PayPaymentReceipt['transaction']['commitment'],
      feePayer: nullableString(transaction, 'feePayer'),
      networkFeeLamports: atomic(transaction, 'networkFeeLamports'),
      verificationStatus: requiredString(transaction, 'verificationStatus'),
      verifiedAt: requiredString(transaction, 'verifiedAt'),
      isAuthoritative: bool(transaction, 'isAuthoritative'),
      tokenMint: nullableString(transaction, 'tokenMint'),
      tokenProgram: nullableString(transaction, 'tokenProgram'),
      tokenDecimals: txTokenDecimals === null ? null : Number(txTokenDecimals),
    },
    transfers: Array.isArray(root.transfers) ? root.transfers.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[] : [],
  };
}

export function createPayPaymentReceiptService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async get(paymentId: string): Promise<PayPaymentReceipt> {
      const id = paymentId.trim();
      if (!UUID.test(id)) throw new TypeError('Payment Intent ID is invalid.');
      const payload = await client.request<Envelope>('/api/pay/v1/payment-intents/' + encodeURIComponent(id) + '/receipt');
      if (payload.success !== true || payload.apiVersion !== 'v1' || !payload.data) {
        throw new TypeError('Invalid payment receipt envelope.');
      }
      if (!isRecord(payload.data)) throw new TypeError('Invalid payment receipt data.');
      return parseReceipt(payload.data);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export const payPaymentReceiptService = createPayPaymentReceiptService();
