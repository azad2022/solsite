export const PAY_LOCALES = ['fa-IR', 'en-US', 'ar', 'ru'] as const;
export type PayLocale = (typeof PAY_LOCALES)[number];
export type PayDirection = 'rtl' | 'ltr';

export const PAY_SECTIONS = [
  'overview',
  'transactions',
  'merchants',
  'customers',
  'invoices',
  'referrals',
  'reports',
  'tickets',
  'developer',
  'security',
] as const;

export type PaySection = (typeof PAY_SECTIONS)[number];

export interface PayNavItem {
  id: PaySection;
}
