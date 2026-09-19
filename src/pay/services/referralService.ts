import { defaultPayHttpClient, type PayHttpClient } from '../http';

export interface PayAffiliate {
  id: string;
  display_name: string;
  referral_code: string;
  commission_rate_bps: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PayReferral {
  id: string;
  affiliate_id: string;
  merchant_id: string;
  referral_code: string;
  attributed_at: string;
  active: boolean;
}

export interface PayCommission {
  id: string;
  referral_id: string;
  payment_id: string;
  gross_gateway_fee_atomic: string;
  commission_bps: number;
  commission_atomic: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

export interface PayReferralSnapshot {
  affiliates: PayAffiliate[];
  referrals: PayReferral[];
  commissions: PayCommission[];
}

interface Envelope { success?: boolean; apiVersion?: string; data?: unknown; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Pay referral payload.');
  return value as Record<string, unknown>;
}
function stringField(row: Record<string, unknown>, field: string): string {
  if (typeof row[field] !== 'string' || !row[field].trim()) throw new TypeError('Invalid Pay referral field: ' + field);
  return row[field] as string;
}
function nullableString(row: Record<string, unknown>, field: string): string | null {
  if (row[field] === null) return null;
  return stringField(row, field);
}
function atomicField(row: Record<string, unknown>, field: string): string {
  const value = stringField(row, field);
  if (!/^\d+$/.test(value)) throw new TypeError('Invalid Pay referral field: ' + field);
  return value;
}
function uuidField(row: Record<string, unknown>, field: string): string {
  const value = stringField(row, field);
  if (!UUID.test(value)) throw new TypeError('Invalid Pay referral UUID: ' + field);
  return value;
}
function integerField(row: Record<string, unknown>, field: string): number {
  if (!Number.isInteger(row[field])) throw new TypeError('Invalid Pay referral integer: ' + field);
  return Number(row[field]);
}
function booleanField(row: Record<string, unknown>, field: string): boolean {
  if (typeof row[field] !== 'boolean') throw new TypeError('Invalid Pay referral boolean: ' + field);
  return row[field] as boolean;
}

function parseAffiliate(value: unknown): PayAffiliate {
  const row = record(value);
  return {
    id: uuidField(row, 'id'),
    display_name: stringField(row, 'display_name'),
    referral_code: stringField(row, 'referral_code'),
    commission_rate_bps: integerField(row, 'commission_rate_bps'),
    status: stringField(row, 'status'),
    created_at: stringField(row, 'created_at'),
    updated_at: stringField(row, 'updated_at'),
  };
}
function parseReferral(value: unknown): PayReferral {
  const row = record(value);
  return {
    id: uuidField(row, 'id'),
    affiliate_id: uuidField(row, 'affiliate_id'),
    merchant_id: uuidField(row, 'merchant_id'),
    referral_code: stringField(row, 'referral_code'),
    attributed_at: stringField(row, 'attributed_at'),
    active: booleanField(row, 'active'),
  };
}
function parseCommission(value: unknown): PayCommission {
  const row = record(value);
  return {
    id: uuidField(row, 'id'),
    referral_id: uuidField(row, 'referral_id'),
    payment_id: uuidField(row, 'payment_id'),
    gross_gateway_fee_atomic: atomicField(row, 'gross_gateway_fee_atomic'),
    commission_bps: integerField(row, 'commission_bps'),
    commission_atomic: atomicField(row, 'commission_atomic'),
    status: stringField(row, 'status'),
    created_at: stringField(row, 'created_at'),
    approved_at: nullableString(row, 'approved_at'),
    paid_at: nullableString(row, 'paid_at'),
  };
}
function parseSnapshot(value: unknown): PayReferralSnapshot {
  const data = record(value);
  if (!Array.isArray(data.affiliates) || !Array.isArray(data.referrals) || !Array.isArray(data.commissions)) {
    throw new TypeError('Invalid Pay referral snapshot.');
  }
  return {
    affiliates: data.affiliates.map(parseAffiliate),
    referrals: data.referrals.map(parseReferral),
    commissions: data.commissions.map(parseCommission),
  };
}

export function createPayReferralService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async load(limit = 100): Promise<PayReferralSnapshot> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Referral limit is invalid.');
      const payload = await client.request<Envelope>('/api/pay/v1/referrals?limit=' + limit);
      if (payload.success !== true || payload.apiVersion !== 'v1' || !payload.data) throw new TypeError('Invalid Pay referral envelope.');
      return parseSnapshot(payload.data);
    },
  };
}

export const payReferralService = createPayReferralService();
