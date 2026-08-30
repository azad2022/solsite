/**
 * Stable domain contracts for SolMint Pay.
 *
 * These types deliberately contain business states rather than translated UI
 * strings. UI layers should map them through the Pay i18n catalog.
 */

export const SOLMINT_PAY_VERSION = '1';
export const SOLMINT_PAY_FEE_BPS = 100;

export type PayLocale = 'fa-IR' | 'en-US' | 'ar' | 'ru';
export type Direction = 'rtl' | 'ltr';

export type FeePayer = 'merchant' | 'customer';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'detected'
  | 'verifying'
  | 'confirmed'
  | 'completed'
  | 'expired'
  | 'underpaid'
  | 'overpaid'
  | 'wrong_token'
  | 'wrong_recipient'
  | 'duplicate'
  | 'failed'
  | 'refunded';

export type PaymentAsset = 'SOL' | 'USDC' | 'USDT';

export interface PaymentFeePolicy {
  /** Gateway fee in basis points. 100 bps = 1%. */
  rateBps: number;
  payer: FeePayer;
}

export interface PaymentIntent {
  id: string;
  merchantId: string;
  orderId: string | null;
  amountAtomic: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  recipient: string;
  reference: string;
  feePolicy: PaymentFeePolicy;
  gasSponsored: boolean;
  status: PaymentStatus;
  expiresAt: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  signature: string;
  slot: number | null;
  blockTime: string | null;
  amountAtomic: string;
  asset: PaymentAsset;
  recipient: string;
  referenceMatched: boolean;
  confirmed: boolean;
}

export interface MerchantLocalePreferences {
  dashboardLocale: PayLocale;
  checkoutLocale: PayLocale | 'auto';
}

export interface ReferralAttribution {
  referralId: string;
  affiliateId: string;
  merchantId: string;
  attributedAt: string;
}

export interface EligibleCommission {
  paymentId: string;
  affiliateId: string;
  grossGatewayFeeAtomic: string;
  commissionRateBps: number;
  commissionAtomic: string;
  status: 'pending' | 'approved' | 'paid' | 'void';
}
