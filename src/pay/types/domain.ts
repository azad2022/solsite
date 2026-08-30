/**
 * Stable business contracts for SolMint Pay.
 *
 * Monetary values use integer atomic units represented as strings so the Pay
 * layer never relies on JavaScript floating-point arithmetic for money.
 */
export const SOLMINT_PAY_VERSION = '1';
export const SOLMINT_PAY_FEE_BPS = 100;
export type PayLocale = 'fa-IR' | 'en-US' | 'ar' | 'ru';
export type Direction = 'rtl' | 'ltr';
export type FeePayer = 'merchant' | 'customer';
export type PaymentStatus = 'created'|'pending'|'detected'|'verifying'|'confirmed'|'completed'|'expired'|'underpaid'|'overpaid'|'wrong_token'|'wrong_recipient'|'duplicate'|'failed'|'refunded';
export type PaymentAsset = 'SOL' | 'USDC' | 'USDT';
export type TokenProgram = 'spl-token' | 'token-2022';
export interface PaymentFeePolicy { rateBps:number; payer:FeePayer; feeAtomic:string; }
export interface GasPolicySnapshot { sponsored:boolean; fundingModel:'merchant_funded'|'solmint_funded'; sponsorAddress:string|null; perPaymentLimitAtomic:string|null; }
export interface PaymentIntent {
  id:string; merchantId:string; orderId:string|null; amountAtomic:string;
  customerTotalAtomic:string; merchantAmountAtomic:string; asset:PaymentAsset;
  tokenMint:string|null; tokenProgram:TokenProgram|null; tokenDecimals:number|null;
  network:'solana'; recipient:string; feeRecipient:string;
  reference:string; feePolicy:PaymentFeePolicy; gasPolicy:GasPolicySnapshot;
  status:PaymentStatus; expiresAt:string; createdAt:string;
}
export interface PaymentTransaction {
  id:string; paymentId:string; signature:string; slot:number|null; blockTime:string|null;
  observedAmountAtomic:string; asset:PaymentAsset; recipient:string;
  feeRecipient:string|null; referenceMatched:boolean; confirmed:boolean;
  tokenProgram:TokenProgram|null; tokenDecimals:number|null;
}
export interface MerchantLocalePreferences { dashboardLocale:PayLocale; checkoutLocale:PayLocale|'auto'; }
export interface ReferralAttribution { referralId:string; affiliateId:string; merchantId:string; attributedAt:string; }
export interface EligibleCommission {
  paymentId:string; affiliateId:string; grossGatewayFeeAtomic:string;
  commissionRateBps:number; commissionAtomic:string; status:'pending'|'approved'|'paid'|'void';
}
