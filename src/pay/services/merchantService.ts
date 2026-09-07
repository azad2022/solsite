import { defaultPayHttpClient, PayHttpError, type PayHttpClient } from '../http';

export interface PayMerchantSummary {
  readonly id: string;
  readonly ownerUserId: string;
  readonly businessName: string;
  readonly slug: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface MerchantEnvelope {
  merchant: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Invalid Pay merchant field: ${name}`);
  }
  return value;
}

function parseMerchant(value: unknown): PayMerchantSummary | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new TypeError('Invalid Pay merchant response.');

  return {
    id: requiredString(value.id, 'id'),
    ownerUserId: requiredString(value.owner_user_id, 'owner_user_id'),
    businessName: requiredString(value.business_name, 'business_name'),
    slug: requiredString(value.slug, 'slug'),
    status: requiredString(value.status, 'status'),
    createdAt: requiredString(value.created_at, 'created_at'),
    updatedAt: requiredString(value.updated_at, 'updated_at'),
  };
}

export function createPayMerchantService(httpClient: PayHttpClient = defaultPayHttpClient) {
  return {
    async getCurrent(): Promise<PayMerchantSummary | null> {
      const payload = await httpClient.request<MerchantEnvelope>('/api/pay/v1/merchants', { method: 'GET' });
      if (!isRecord(payload) || !Object.prototype.hasOwnProperty.call(payload, 'merchant')) {
        throw new TypeError('Invalid Pay merchant response envelope.');
      }
      return parseMerchant(payload.merchant);
    },
  };
}

export const payMerchantService = createPayMerchantService();
export { PayHttpError };
