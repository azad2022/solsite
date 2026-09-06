import type { PaySection } from './types';

export const PAY_PREFIX = '/pay';

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
  return [
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
  ].includes(value);
}
