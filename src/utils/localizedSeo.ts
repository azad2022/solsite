import { getLocalizedPath, getPathWithoutLocale } from './i18n';

const SITE_URL = 'https://solmint.ir';

type LocalizedSeo = { title: string; description: string; path: string };

type SeoArticle = { title: string; summary?: string; slug: string; coverImage?: string };

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
  },
  '/blog': {
    path: '/blog',
    title: 'Solana Web3 Academy | Solmint Research & Education',
    description: 'Solmint research, Solana education, Web3 security, development guides and ecosystem analysis in English.'
  }
};

function setNamedMeta(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) { meta = document.createElement('meta'); meta.name = name; document.head.appendChild(meta); }
  meta.content = content;
}

function setPropertyMeta(property: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', property); document.head.appendChild(meta); }
  meta.content = content;
}

function setCanonical(href: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = href;
}

function applySeo(seo: { title: string; description: string; canonical: string; robots: string; image?: string }) {
  document.title = seo.title;
  setNamedMeta('description', seo.description);
  setNamedMeta('robots', seo.robots);
  setPropertyMeta('og:title', seo.title);
  setPropertyMeta('og:description', seo.description);
  setPropertyMeta('og:url', seo.canonical);
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:site_name', 'Solmint');
  setPropertyMeta('og:locale', 'en_US');
  if (seo.image) setPropertyMeta('og:image', seo.image);
  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', seo.title);
  setNamedMeta('twitter:description', seo.description);
  setNamedMeta('twitter:url', seo.canonical);
  if (seo.image) setNamedMeta('twitter:image', seo.image);
  setCanonical(seo.canonical);
}

export function isEnglishRouteSupported(path: string): boolean {
  const basePath = getPathWithoutLocale(path);
  return Boolean(ENGLISH_SEO[basePath] || basePath.startsWith('/articles/'));
}

export function updateEnglishSeo(path: string): void {
  if (typeof document === 'undefined') return;
  const basePath = getPathWithoutLocale(path);
  const info = ENGLISH_SEO[basePath];
  if (info) {
    applySeo({ title: info.title, description: info.description, canonical: `${SITE_URL}${getLocalizedPath(info.path, 'en')}`, robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1', image: `${SITE_URL}/og-solmint.png` });
    return;
  }
  if (basePath.startsWith('/articles/')) {
    applySeo({ title: 'Solana Article | Solmint', description: 'Solana and Web3 research from Solmint.', canonical: `${SITE_URL}${getLocalizedPath(basePath, 'en')}`, robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1', image: `${SITE_URL}/og-solmint.png` });
    return;
  }
  applySeo({ title: 'Page not found | Solmint', description: 'The requested English page could not be found on Solmint.', canonical: `${SITE_URL}${getLocalizedPath(basePath, 'en')}`, robots: 'noindex, follow' });
}

export function updateEnglishArticleSeo(article: SeoArticle): void {
  if (typeof document === 'undefined') return;
  const title = `${article.title} | Solmint`;
  const description = article.summary?.trim() || `Read ${article.title} on Solmint, a Solana and Web3 research platform.`;
  const canonical = `${SITE_URL}${getLocalizedPath(`/articles/${article.slug}`, 'en')}`;
  applySeo({ title, description, canonical, robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1', image: article.coverImage ? `${SITE_URL}${article.coverImage.startsWith('/') ? article.coverImage : `/${article.coverImage}`}` : `${SITE_URL}/og-solmint.png` });
  setPropertyMeta('og:type', 'article');
}
