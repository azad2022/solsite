import { getLocalizedPath, getPathWithoutLocale } from './i18n';

const SITE_URL = 'https://solmint.ir';

type LocalizedSeo = { title: string; description: string; path: string };

const ENGLISH_SEO: Record<string, LocalizedSeo> = {
  '/': {
    path: '/',
    title: 'Solmint | Solana, Web3 & Open-Source Wallet Platform',
    description: 'Solmint is a Solana-focused platform for live SOL market data, Web3 education and an upcoming open-source non-custodial wallet.'
  },
  '/solana-price': {
    path: '/solana-price',
    title: 'Solana (SOL) Price Today | Live SOL Market Data | Solmint',
    description: 'Track the current Solana (SOL) price, 24-hour movement and live market information on Solmint.'
  }
};

function setNamedMeta(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function setPropertyMeta(property: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function setCanonical(href: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}

export function isEnglishRouteSupported(path: string): boolean {
  return Boolean(ENGLISH_SEO[getPathWithoutLocale(path)]);
}

export function updateEnglishSeo(path: string): void {
  if (typeof document === 'undefined') return;
  const basePath = getPathWithoutLocale(path);
  const info = ENGLISH_SEO[basePath];
  const is404 = !info;
  const seo = info || {
    path: basePath,
    title: 'Page not found | Solmint',
    description: 'The requested English page could not be found on Solmint.'
  };
  const canonical = `${SITE_URL}${getLocalizedPath(seo.path, 'en')}`;
  document.title = seo.title;
  setNamedMeta('description', seo.description);
  setNamedMeta('robots', is404 ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  setPropertyMeta('og:title', seo.title);
  setPropertyMeta('og:description', seo.description);
  setPropertyMeta('og:url', canonical);
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:site_name', 'Solmint');
  setPropertyMeta('og:locale', 'en_US');
  setPropertyMeta('og:image', `${SITE_URL}/og-solmint.png`);
  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', seo.title);
  setNamedMeta('twitter:description', seo.description);
  setNamedMeta('twitter:url', canonical);
  setNamedMeta('twitter:image', `${SITE_URL}/og-solmint.png`);
  setCanonical(canonical);
}
