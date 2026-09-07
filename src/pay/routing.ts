import { PAY_SECTIONS, type PaySection } from './types';

export const PAY_PREFIX = '/pay';
export const PAY_CHECKOUT_PREFIX = `${PAY_PREFIX}/checkout`;

export function normalizePayPath(pathname: string): string {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean || '/';
}

export function sectionFromPayPath(pathname: string): PaySection {
  const normalized = normalizePayPath(pathname);
  if (normalized === PAY_PREFIX) return 'overview';
  if (!normalized.startsWith(`${PAY_PREFIX}/`)) return 'overview';
  const suffix = normalized.slice(`${PAY_PREFIX}/`.length);
  return isPaySection(suffix) ? suffix : 'overview';
}

export function pathForPaySection(section: PaySection): string {
  return section === 'overview' ? PAY_PREFIX : `${PAY_PREFIX}/${section}`;
}

export function isPaySection(value: string): value is PaySection {
  return (PAY_SECTIONS as readonly string[]).includes(value);
}

export function isPayCheckoutPath(pathname: string): boolean {
  const normalized = normalizePayPath(pathname);
  if (normalized === PAY_CHECKOUT_PREFIX) return true;
  const suffix = normalized.slice(`${PAY_CHECKOUT_PREFIX}/`.length);
  return normalized.startsWith(`${PAY_CHECKOUT_PREFIX}/`) && Boolean(suffix) && !suffix.includes('/');
}

export function checkoutIntentIdFromPath(pathname: string): string | undefined {
  const normalized = normalizePayPath(pathname);
  if (!isPayCheckoutPath(normalized) || normalized === PAY_CHECKOUT_PREFIX) return undefined;
  const value = normalized.slice(`${PAY_CHECKOUT_PREFIX}/`.length);
  return value || undefined;
}
