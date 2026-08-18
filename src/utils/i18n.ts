export type SupportedLocale = 'fa' | 'en';

export const DEFAULT_LOCALE: SupportedLocale = 'fa';
export const ENGLISH_PREFIX = '/en';

export function normalizeLocalePath(path: string): string {
  const withoutQuery = (path || '/').split('?')[0].split('#')[0];
  const normalized = withoutQuery.replace(/\/+$/, '');
  return normalized || '/';
}

export function getLocaleFromPath(path: string): SupportedLocale {
  const normalized = normalizeLocalePath(path);
  return normalized === ENGLISH_PREFIX || normalized.startsWith(`${ENGLISH_PREFIX}/`) ? 'en' : DEFAULT_LOCALE;
}

export function getPathWithoutLocale(path: string): string {
  const normalized = normalizeLocalePath(path);
  if (normalized === ENGLISH_PREFIX) return '/';
  if (normalized.startsWith(`${ENGLISH_PREFIX}/`)) return normalized.slice(ENGLISH_PREFIX.length) || '/';
  return normalized;
}

function normalizeContentPath(basePath: string, locale: SupportedLocale): string {
  if (locale === 'fa') {
    if (basePath.startsWith('/articles/')) return `/article/${basePath.slice('/articles/'.length)}`;
    return basePath;
  }
  if (basePath.startsWith('/article/')) return `/articles/${basePath.slice('/article/'.length)}`;
  return basePath;
}

export function getLocalizedPath(path: string, locale: SupportedLocale): string {
  const basePath = normalizeContentPath(getPathWithoutLocale(path), locale);
  if (locale === 'fa') return basePath;
  return basePath === '/' ? ENGLISH_PREFIX : `${ENGLISH_PREFIX}${basePath}`;
}

export function getAlternateLocalePath(path: string, locale: SupportedLocale): string {
  return getLocalizedPath(path, locale);
}

export function setDocumentLocale(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'en' ? 'en' : 'fa-IR';
  document.documentElement.dir = locale === 'en' ? 'ltr' : 'rtl';
}

export function upsertAlternateLink(hreflang: string, href: string): void {
  if (typeof document === 'undefined') return;
  const selector = `link[rel="alternate"][hreflang="${hreflang}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = hreflang;
    document.head.appendChild(link);
  }
  link.href = href;
}

export function removeAlternateLinks(): void {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
}
