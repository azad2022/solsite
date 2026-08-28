import fs from 'node:fs';

const file = 'functions/article/[slug].ts';
const source = fs.readFileSync(file, 'utf8');
let next = source;

const importLine = "import { linkContextualHtml } from '../../src/utils/contextualHtmlLinking';";
if (!next.includes(importLine)) {
  const anchor = "import { detectArticleLocale } from '../seo-helpers';";
  if (!next.includes(anchor)) throw new Error('SSR contextual HTML linker import anchor not found');
  next = next.replace(anchor, `${anchor}\n${importLine}`);
}

const targetBlockMarker = 'const INTERNAL_HTML_LINK_TARGET_CACHE_TTL = 300_000;';
if (!next.includes(targetBlockMarker)) {
  const block = `
const INTERNAL_HTML_LINK_TARGET_CACHE_TTL = 300_000;
let internalHtmlLinkTargetCache: { expiresAt: number; targets: Array<{ slug: string; title: string; priority?: number; href?: string }> } | null = null;

async function fetchInternalHtmlLinkTargets(base: string, key: string) {
  const now = Date.now();
  if (internalHtmlLinkTargetCache && internalHtmlLinkTargetCache.expiresAt > now) return internalHtmlLinkTargetCache.targets;
  const staticTargets = [
    { slug: 'solana-wallet-page', title: 'کیف پول سولانا', priority: 100, href: '/solana-wallet' },
    { slug: 'solana-token-page', title: 'ساخت توکن سولانا', priority: 98, href: '/solana-token' },
    { slug: 'solana-meme-coin-page', title: 'ساخت میم کوین سولانا', priority: 94, href: '/solana-meme-coin' },
    { slug: 'solana-price-page', title: 'قیمت سولانا', priority: 86, href: '/solana-price' },
    { slug: 'wallet-analyzer-page', title: 'بررسی کیف پول', priority: 82, href: '/wallet-analyzer' },
    { slug: 'security-page', title: 'امنیت سولانا', priority: 78, href: '/security' }
  ];
  const url = \`${'${base}'}/rest/v1/articles?select=slug,title&is_draft=eq.false&order=published_at.desc,id.desc&limit=1000\`;
  try {
    const response = await fetch(url, { headers: { apikey: key, Authorization: \`Bearer ${'${key}'}\`, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return internalHtmlLinkTargetCache?.targets || staticTargets;
    const rows = await response.json() as Array<{ slug?: string; title?: string }>;
    const articleTargets = Array.isArray(rows) ? rows.flatMap(row => row.slug && row.title ? [{ slug: String(row.slug), title: String(row.title), priority: 25 }] : []) : [];
    const targets = [...staticTargets, ...articleTargets];
    internalHtmlLinkTargetCache = { expiresAt: now + INTERNAL_HTML_LINK_TARGET_CACHE_TTL, targets };
    return targets;
  } catch {
    return internalHtmlLinkTargetCache?.targets || staticTargets;
  }
}
`;
  next = next.replace("const SITE_ORIGIN = 'https://solmint.ir';", "const SITE_ORIGIN = 'https://solmint.ir';" + block);
}

const oldShell = 'const shell = `<main id="article-ssr" dir="${escapeHtml(locale.dir)}" lang="${escapeHtml(locale.lang)}"><article><header>';
if (next.includes(oldShell) && !next.includes('linkContextualHtml(renderBody(article.content || \'\')')) {
  const oldBody = "<section aria-label=\"${locale.lang === 'en' ? 'Article body' : 'متن مقاله'}\">${renderBody(article.content || '')}</section>";
  const newBody = "<section aria-label=\"${locale.lang === 'en' ? 'Article body' : 'متن مقاله'}\">${linkContextualHtml(renderBody(article.content || ''), contextualTargets, { currentSlug: article.slug, maxLinks: 5 })}</section>";
  if (!next.includes(oldBody)) throw new Error('SSR article body marker not found');
  next = next.replace(oldBody, newBody);
}

const oldInject = 'function inject(html: string, article: ArticleRecord, related: RelatedArticle[]) {';
if (next.includes(oldInject) && !next.includes('contextualTargets:')) {
  next = next.replace(oldInject, 'function inject(html: string, article: ArticleRecord, related: RelatedArticle[], contextualTargets: Array<{ slug: string; title: string; priority?: number; href?: string }>) {');
}

const oldRelated = 'const related = await fetchRelated(base, key, article);';
if (next.includes(oldRelated) && !next.includes('const [related, contextualTargets] = await Promise.all([')) {
  const replacement = `const [related, contextualTargets] = await Promise.all([\n      fetchRelated(base, key, article),\n      fetchInternalHtmlLinkTargets(base, key)\n    ]);`;
  next = next.replace(oldRelated, replacement);
}

const oldReturn = 'return new Response(inject(html, article, related), { status: 200, headers });';
if (next.includes(oldReturn)) next = next.replace(oldReturn, 'return new Response(inject(html, article, related, contextualTargets), { status: 200, headers });');

const required = [importLine, targetBlockMarker, 'linkContextualHtml(renderBody(article.content || \'\'), contextualTargets', 'contextualTargets: Array<{ slug: string; title: string; priority?: number; href?: string }>', 'fetchInternalHtmlLinkTargets(base, key)', 'return new Response(inject(html, article, related, contextualTargets), { status: 200, headers });'];
for (const marker of required) if (!next.includes(marker)) throw new Error(`HTML-aware SSR linking failed: missing ${marker}`);

if (next !== source) {
  fs.writeFileSync(file, next, 'utf8');
  console.log('✓ HTML-aware contextual SSR article linking applied.');
} else {
  console.log('✓ HTML-aware contextual SSR article linking already applied.');
}
