import { PAY_PREFIX, PAY_CHECKOUT_PREFIX, checkoutIntentIdFromPath, isPayCheckoutPath, normalizePayPath, sectionFromPayPath, isPaySection } from './routing';
import type { PaySection } from './types';

export type PayRoute =
  | { kind: 'dashboard'; section: PaySection }
  | { kind: 'checkout'; intentId?: string }
  | { kind: 'not-found' };

export function matchPayRoute(pathname: string): PayRoute {
  const normalized = normalizePayPath(pathname);
  if (normalized === PAY_PREFIX) return { kind: 'dashboard', section: 'overview' };

  if (isPayCheckoutPath(normalized)) {
    return { kind: 'checkout', intentId: checkoutIntentIdFromPath(normalized) };
  }

  if (normalized.startsWith(`${PAY_PREFIX}/`)) {
    const suffix = normalized.slice(`${PAY_PREFIX}/`.length);
    if (isPaySection(suffix)) return { kind: 'dashboard', section: sectionFromPayPath(normalized) };
    return { kind: 'not-found' };
  }

  return { kind: 'not-found' };
}
