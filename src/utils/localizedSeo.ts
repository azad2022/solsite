import { getLocalizedPath, getPathWithoutLocale } from './i18n';

const SITE_URL = 'https://solmint.ir';

type LocalizedSeo = { path: string; title: string; description: string };
type SeoArticle = { title: string; summary?: string; slug: string; coverImage?: string };

const ENGLISH_SEO: Record<string, LocalizedSeo> = {
  '/': { path: '/', title: 'Solmint | Solana, Web3 & Open-Source Wallet Platform', description: 'Solmint is a Solana-focused platform for live SOL market data, Web3 education and an open-source non-custodial wallet direction.' },
  '/solana-price': { path: '/solana-price', title: 'Solana (SOL) Price Today | Live SOL Market Data | Solmint', description: 'Track the current Solana (SOL) price, 24-hour movement and live network market information on Solmint.' },
  '/blog': { path: '/blog', title: 'Solana Web3 Academy | Solmint Research & Education', description: 'Solmint research, Solana education, Web3 security, development guides and ecosystem analysis in English.' },
  '/solana-wallet': { path: '/solana-wallet', title: 'Solana Non-Custodial Wallet | Solmint', description: 'Learn how Solmint approaches a non-custodial Solana wallet with user-controlled signing and local key management.' },
  '/wallet-analyzer': { path: '/wallet-analyzer', title: 'Solana Wallet Analyzer | On-Chain Wallet Analysis | Solmint', description: 'Analyze a public Solana wallet address using read-only on-chain data including balance, activity, transfers and token security signals.' },
  '/solana-token': { path: '/solana-token', title: 'Solana Token Creator | SPL Token Tools | Solmint', description: 'Learn how Solmint approaches Solana SPL token creation, metadata and wallet-controlled transaction signing.' },
  '/solana-meme-coin': { path: '/solana-meme-coin', title: 'Solana Meme Coin Tools | Mint & Authority Guidance | Solmint', description: 'Explore Solana meme coin tooling and understand mint, freeze authority and launch preparation before signing.' },
  '/solana-nft': { path: '/solana-nft', title: 'Solana NFT Tools & Education | Solmint', description: 'Explore Solana NFT concepts, metadata and practical Web3 tooling through the Solmint platform.' },
  '/security': { path: '/security', title: 'Solmint Security Architecture | Non-Custodial Solana Wallet', description: 'Review Solmint security principles around local signing, server-authoritative APIs and minimizing web-layer trust.' },
  '/faq': { path: '/faq', title: 'Solmint FAQ | Solana Wallet, Web3 Tools & Security', description: 'Answers about Solmint, the non-custodial wallet direction, Solana tools, security and the English platform.' },
  '/app-guide': { path: '/app-guide', title: 'Solmint Android App Guide | Solana Wallet & Web3 Tools', description: 'A practical guide to using the Solmint Android application, local wallet operations and Solana tooling.' },
  '/download': { path: '/download', title: 'Download Solmint Android App | Official Release Channel', description: 'Find the official Solmint Android release channel and review security guidance before installation.' },
  '/tools': { path: '/tools', title: 'Solana Tools | Token Scanner & Token-2022 Research | Solmint', description: 'Use Solmint tools for Solana token inspection, token scanning and Token-2022 research.' },
  '/tools/solana-token-tools': { path: '/tools/solana-token-tools', title: 'Solana Token Tools | Solmint', description: 'Explore Solmint read-only tools for Solana token and Token-2022 analysis.' },
  '/tools/solana-token-scanner': { path: '/tools/solana-token-scanner', title: 'Solana Token Scanner | Mint & Authority Analysis | Solmint', description: 'Inspect a Solana Mint using public on-chain data including supply, authorities, metadata, distribution and technical risk flags.' },
  '/tools/token-2022-inspector': { path: '/tools/token-2022-inspector', title: 'Token-2022 Inspector | Solana Token Extensions | Solmint', description: 'Inspect Token-2022 extensions and understand their observable on-chain configuration with Solmint.' }
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

export function updateEnglishArticleNotFoundSeo(path: string): void {
  if (typeof document === 'undefined') return;
  const canonical = `${SITE_URL}${getLocalizedPath(getPathWithoutLocale(path), 'en')}`;
  applySeo({ title: 'Article not found | Solmint', description: 'The requested English article could not be found on Solmint.', canonical, robots: 'noindex, follow' });
  setPropertyMeta('og:type', 'website');
}

export function updateEnglishArticleSeo(article: SeoArticle): void {
  if (typeof document === 'undefined') return;
  const title = `${article.title} | Solmint`;
  const description = article.summary?.trim() || `Read ${article.title} on Solmint, a Solana and Web3 research platform.`;
  const canonical = `${SITE_URL}${getLocalizedPath(`/articles/${article.slug}`, 'en')}`;
  applySeo({ title, description, canonical, robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1', image: article.coverImage ? `${SITE_URL}${article.coverImage.startsWith('/') ? article.coverImage : `/${article.coverImage}`}` : `${SITE_URL}/og-solmint.png` });
  setPropertyMeta('og:type', 'article');
}
