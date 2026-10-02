import { defaultPayHttpClient, type PayHttpClient } from './http';

interface TransactionRequestResponse {
  success?: boolean;
  transaction?: unknown;
  message?: unknown;
  redirect?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Invalid transaction request field: ${name}`);
  return value;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const PATH = (intentId: string) => `/api/pay/v1/payment-intents/${encodeURIComponent(intentId)}/transaction-request`;

export function createPayTransactionRequestService(httpClient: PayHttpClient = defaultPayHttpClient) {
  return {
    async build(intentId: string, account: string): Promise<{ transaction: Uint8Array; message: string; redirect?: string }> {
      const id = intentId.trim();
      const wallet = account.trim();
      if (!id || !wallet) throw new TypeError('Payment Intent ID and wallet account are required.');
      const payload = await httpClient.request<TransactionRequestResponse>(PATH(id), {
        method: 'POST',
        body: JSON.stringify({ account: wallet }),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      if (!isRecord(payload) || payload.success !== true) {
        throw new TypeError('Invalid transaction request response envelope.');
      }
      const transaction = requiredString(payload.transaction, 'transaction');
      return {
        transaction: decodeBase64(transaction),
        message: typeof payload.message === 'string' ? payload.message : 'Payment ready',
        redirect: typeof payload.redirect === 'string' ? payload.redirect : undefined,
      };
    },
  };
}

export const payTransactionRequestService = createPayTransactionRequestService();
