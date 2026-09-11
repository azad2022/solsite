export const PAY_LOCALES = ['fa-IR', 'en-US', 'ar', 'ru'] as const;
export type PayLocale = (typeof PAY_LOCALES)[number];
export type PayDirection = 'rtl' | 'ltr';
export const PAY_SECTIONS = [
  'overview', 'checkout', 'dashboard', 'transactions', 'merchants', 'customers', 'invoices', 'referrals', 'tickets', 'reports', 'developer', 'security', 'webhooks',
] as const;
export type PaySection = (typeof PAY_SECTIONS)[number];
export interface PayNavItem { section: PaySection; label: string; href: string; icon?: string; }

export type { Direction, FeePayer, PaymentStatus, PaymentAsset, TokenProgram, PaymentFeePolicy, GasPolicySnapshot, PaymentIntent, PaymentTransaction, MerchantLocalePreferences, ReferralAttribution, EligibleCommission } from './domain';
