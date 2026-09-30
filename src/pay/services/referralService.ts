import { defaultPayHttpClient, type PayHttpClient } from '../http';
import type { PaymentAsset } from '../types/domain';

export interface PayAffiliate {
  id: string;
  display_name: string;
  referral_code: string;
  commission_rate_bps: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PayReferralStats {
  clicks: string;
  directSignups: string;
  referredMerchants: string;
  activeReferredMerchants: string;
}

export interface PayReferralEarning {
  asset: PaymentAsset;
  token_decimals: number;
  gross_gateway_fee_atomic: string;
  commission_atomic: string;
  pending_commission_atomic: string;
  approved_commission_atomic: string;
  paid_commission_atomic: string;
  reversed_commission_atomic: string;
}

export interface PayReferral {
  id: string;
  affiliate_id: string;
  merchant_id: string;
  referral_code: string;
  attributed_at: string;
  active: boolean;
  user_attribution_id: string | null;
}

export interface PayCommission {
  id: string;
  referral_id: string;
  payment_id: string;
  asset: PaymentAsset;
  token_decimals: number;
  gross_gateway_fee_atomic: string;
  commission_bps: number;
  commission_atomic: string;
  status: 'pending' | 'approved' | 'paid' | 'void';
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

export interface PayReferralDashboard {
  affiliate: PayAffiliate;
  stats: PayReferralStats;
  earnings_by_asset: PayReferralEarning[];
  referrals: PayReferral[];
  commissions: PayCommission[];
}

interface Envelope {
  success?: boolean;
  apiVersion?: string;
  data?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSETS = new Set<PaymentAsset>(['SOL', 'USDC', 'USDT']);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid Pay referral payload.');
  }
  return value as Record<string, unknown>;
}

function stringField(row: Record<string, unknown>, field: string): string {
  if (typeof row[field] !== 'string' || !row[field].trim()) {
    throw new TypeError('Invalid Pay referral field: ' + field);
  }
  return row[field] as string;
}

function nullableString(row: Record<string, unknown>, field: string): string | null {
  if (row[field] === null) return null;
  return stringField(row, field);
}

function atomicField(row: Record<string, unknown>, field: string): string {
  const value = stringField(row, field);
  if (!/^\d+$/.test(value)) {
    throw new TypeError('Invalid Pay referral field: ' + field);
  }
  return value;
}

function uuidField(row: Record<string, unknown>, field: string): string {
  const value = stringField(row, field);
  if (!UUID.test(value)) throw new TypeError('Invalid Pay referral UUID: ' + field);
  return value;
}

function integerField(row: Record<string, unknown>, field: string): number {
  if (!Number.isInteger(row[field])) {
    throw new TypeError('Invalid Pay referral integer: ' + field);
  }
  return Number(row[field]);
}

function countField(row: Record<string, unknown>, field: string): string {
  const value = stringField(row, field);
  if (!/^\d+$/.test(value)) throw new TypeError('Invalid Pay referral count: ' + field);
  return value;
}

function booleanField(row: Record<string, unknown>, field: string): boolean {
  if (typeof row[field] !== 'boolean') throw new TypeError('Invalid Pay referral boolean: ' + field);
  return row[field] as boolean;
}

function assetField(row: Record<string, unknown>, field: string): PaymentAsset {
  const value = stringField(row, field) as PaymentAsset;
  if (!ASSETS.has(value)) throw new TypeError('Invalid Pay referral asset: ' + field);
  return value;
}

function decimalField(row: Record<string, unknown>, field: string): number {
  const value = integerField(row, field);
  if (value < 0 || value > 18) throw new TypeError('Invalid Pay referral decimals: ' + field);
  return value;
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

function parseStats(value: unknown): PayReferralStats {
  const row = record(value);
  return {
    clicks: countField(row, 'clicks'),
    directSignups: countField(row, 'directSignups'),
    referredMerchants: countField(row, 'referredMerchants'),
    activeReferredMerchants: countField(row, 'activeReferredMerchants'),
  };
}

function parseEarning(value: unknown): PayReferralEarning {
  const row = record(value);
  return {
    asset: assetField(row, 'asset'),
    token_decimals: decimalField(row, 'token_decimals'),
    gross_gateway_fee_atomic: atomicField(row, 'gross_gateway_fee_atomic'),
    commission_atomic: atomicField(row, 'commission_atomic'),
    pending_commission_atomic: atomicField(row, 'pending_commission_atomic'),
    approved_commission_atomic: atomicField(row, 'approved_commission_atomic'),
    paid_commission_atomic: atomicField(row, 'paid_commission_atomic'),
    reversed_commission_atomic: atomicField(row, 'reversed_commission_atomic'),
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
    user_attribution_id: nullableString(row, 'user_attribution_id'),
  };
}

function parseCommission(value: unknown): PayCommission {
  const row = record(value);
  const status = stringField(row, 'status');
  if (!['pending', 'approved', 'paid', 'void'].includes(status)) {
    throw new TypeError('Invalid Pay referral commission status.');
  }
  return {
    id: uuidField(row, 'id'),
    referral_id: uuidField(row, 'referral_id'),
    payment_id: uuidField(row, 'payment_id'),
    asset: assetField(row, 'asset'),
    token_decimals: decimalField(row, 'token_decimals'),
    gross_gateway_fee_atomic: atomicField(row, 'gross_gateway_fee_atomic'),
    commission_bps: integerField(row, 'commission_bps'),
    commission_atomic: atomicField(row, 'commission_atomic'),
    status: status as PayCommission['status'],
    created_at: stringField(row, 'created_at'),
    approved_at: nullableString(row, 'approved_at'),
    paid_at: nullableString(row, 'paid_at'),
  };
}

function parseDashboard(value: unknown): PayReferralDashboard {
  const data = record(value);
  if (!Array.isArray(data.earnings_by_asset) || !Array.isArray(data.referrals) || !Array.isArray(data.commissions)) {
    throw new TypeError('Invalid Pay referral dashboard.');
  }
  return {
    affiliate: parseAffiliate(data.affiliate),
    stats: parseStats(data.stats),
    earnings_by_asset: data.earnings_by_asset.map(parseEarning),
    referrals: data.referrals.map(parseReferral),
    commissions: data.commissions.map(parseCommission),
  };
}

export function createPayReferralService(client: PayHttpClient = defaultPayHttpClient) {
  return {
    async load(limit = 100): Promise<PayReferralDashboard> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new TypeError('Referral limit is invalid.');
      }
      const payload = await client.request<Envelope>('/api/pay/v1/referrals?limit=' + limit);
      if (payload.success !== true || payload.apiVersion !== 'v1' || !payload.data) {
        throw new TypeError('Invalid Pay referral envelope.');
      }
      return parseDashboard(payload.data);
    },
  };
}

export const payReferralService = createPayReferralService();
