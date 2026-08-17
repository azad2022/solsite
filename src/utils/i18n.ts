export type SupportedLocale = 'fa' | 'en';

export const DEFAULT_LOCALE: SupportedLocale = 'fa';
export const ENGLISH_PREFIX = '/en';

export function normalizePath(path: string): string {
  const withoutQuery = (path || '/').split('?')[0].split('#')[0];
  const normalized = withoutQuery.replace(/\/+$/, '');
  return normalized || '/';
}

export function getLocaleFromPath(path: string): SupportedLocale {
  const normalized = normalizePath(path);
  return normalized === ENGLISH_PREFIX || normalized.startsWith(`${ENGLISH_PREFIX}/`) ? 'en' : DEFAULT_LOCALE;
}

export function getLocalizedPath(path: string, locale: SupportedLocale): string {
  const normalized = normalizePath(path);
  const withoutLocale = normalized === ENGLISH_PREFIX || normalized.startsWith(`${ENGLISH_PREFIX}/`)
    ? normalized.slice(ENGLISH_PREFIX.length) || '/'
    : normalized;

  if (locale === 'fa') return withoutLocale;
  return withoutLocale === '/' ? ENGLISH_PREFIX : `${ENGLISH_PREFIX}${withoutLocale}`;
}

export function getPathWithoutLocale(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === ENGLISH_PREFIX) return '/';
  if (normalized.startsWith(`${ENGLISH_PREFIX}/`)) return normalized.slice(ENGLISH_PREFIX.length) || '/';
  return normalized;
}

export function setDocumentLocale(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'en' ? 'en' : 'fa-IR';
  document.documentElement.dir = locale === 'en' ? 'ltr' : 'rtl';
}

export function getAlternateLocalePath(path: string, locale: SupportedLocale): string {
  return getLocalizedPath(getPathWithoutLocale(path), locale);
}
