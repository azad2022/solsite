import type { PayLocale } from '../types/domain';

/**
 * Central Pay product configuration.
 * Keep product policy here; do not scatter fee or locale defaults across UI files.
 */
export const PAY_CONFIG = {
  publicPath: '/pay',
  defaultLocale: 'fa-IR' as PayLocale,
  supportedLocales: ['fa-IR', 'en-US', 'ar', 'ru'] as const,
  gatewayFeeBps: 100, // 1.00%; 100 basis points = 1%.
  feePayers: ['merchant', 'customer'] as const,
  supportedAssets: ['SOL', 'USDC', 'USDT'] as const,
  launchEnabled: false,
} as const;

/**
 * The launch gate intentionally defaults to false. A later deployment phase
 * will expose `/pay` only after API, verification, accounting, SEO and tests
 * have passed their release gates.
 */
export function isPayLaunchEnabled(): boolean {
  return PAY_CONFIG.launchEnabled;
}
