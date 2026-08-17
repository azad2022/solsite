import { getLocalizedPath, getPathWithoutLocale } from './i18n';

const SITE_URL = 'https://solmint.ir';

type LocalizedSeo = { title: string; description: string; h1: string; path: string };

const ENGLISH_SEO: Record<string, LocalizedSeo> = {
  '/': {
    path: '/',
    title: 'Solmint | Solana, Web3 & Open-Source Wallet Platform',
    description: 'Solmint is a Solana-focused platform for live SOL market data, Web3 education and an upcoming open-source non-custodial wallet.',
    h1: 'Solmint — a Solana-focused Web3 platform'
  },
  '/solana-price': {
    path: '/solana-price',
    title: 'Solana (SOL) Price Today | Live SOL Market Data | Solmint',
    description: 'Track the current Solana (SOL) price, 24-hour movement and live market information on Solmint.',
    h1: 'Solana (SOL) price and live market data'
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

export function updateEnglishSeo(path: string): void {
  if (typeof document === 'undefined') return;
  const basePath = getPathWithoutLocale(path);
  const info = ENGLISH_SEO[basePath] || {
    path: basePath,
    title: 'Solmint | Solana & Web3',
    description: 'Solmint is a Solana-focused Web3 platform.',
    h1: 'Solmint'
  };
  const canonical = `${SITE_URL}${getLocalizedPath(info.path, 'en')}`;
  document.title = info.title;
  setNamedMeta('description', info.description);
  setNamedMeta('robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  setPropertyMeta('og:title', info.title);
  setPropertyMeta('og:description', info.description);
  setPropertyMeta('og:url', canonical);
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:site_name', 'Solmint');
  setPropertyMeta('og:locale', 'en_US');
  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', info.title);
  setNamedMeta('twitter:description', info.description);
  setNamedMeta('twitter:url', canonical);
  setCanonical(canonical);
}
