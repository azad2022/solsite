import fs from 'node:fs';

const file = 'functions/article/[slug].ts';
const source = fs.readFileSync(file, 'utf8');
const importLine = "import { linkContextualInternalReferences } from '../../src/utils/contextualInternalLinking';";

let next = source;
if (!next.includes(importLine)) {
  const anchor = "import { detectArticleLocale } from '../seo-helpers';";
  if (!source.includes(anchor)) throw new Error('article SSR import anchor not found');
  next = next.replace(anchor, `${anchor}\n${importLine}`);
}

const cacheMarker = 'const INTERNAL_LINK_TARGET_CACHE_TTL = 300_000;';
if (!next.includes(cacheMarker)) {
  const cacheBlock = `
const INTERNAL_LINK_TARGET_CACHE_TTL = 300_000;
let internalLinkTargetCache: { expiresAt: number; targets: Array<{ slug: string; title: string; aliases?: string[]; category?: string; priority?: number; href?: string }> } | null = null;

const STATIC_INTERNAL_LINK_TARGETS = [
  { slug: 'solana-wallet-page', title: 'کیف پول سولانا', aliases: ['کیف پول سولانا', 'کیف پول غیرامانی'], priority: 100, href: '/solana-wallet' },
  { slug: 'solana-token-page', title: 'ساخت توکن سولانا', aliases: ['ساخت توکن سولانا', 'SPL Token'], priority: 98, href: '/solana-token' },
  { slug: 'solana-meme-coin-page', title: 'ساخت میم کوین سولانا', aliases: ['ساخت میم کوین', 'میم کوین سولانا'], priority: 94, href: '/solana-meme-coin' },
  { slug: 'solana-price-page', title: 'قیمت سولانا', aliases: ['قیمت سولانا', 'قیمت SOL'], priority: 86, href: '/solana-price' },
  { slug: 'wallet-analyzer-page', title: 'بررسی کیف پول', aliases: ['بررسی کیف پول', 'تحلیل کیف پول سولانا'], priority: 82, href: '/wallet-analyzer' },
  { slug: 'security-page', title: 'امنیت سولانا', aliases: ['امنیت سولانا', 'امنیت کیف پول'], priority: 78, href: '/security' },
];

async function fetchInternalLinkTargets(base: string, key: string) {
  const now = Date.now();
  if (internalLinkTargetCache && internalLinkTargetCache.expiresAt > now) return internalLinkTargetCache.targets;

  const url = \`${'${base}'}/rest/v1/articles?select=slug,title,category&is_draft=eq.false&order=published_at.desc&limit=250\`;
  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: \`Bearer ${'${key}'}\`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return internalLinkTargetCache?.targets || [];
    const rows = await response.json() as Array<{ slug?: string; title?: string; category?: string }>;
    const articleTargets = Array.isArray(rows)
      ? rows.flatMap(row => row.slug && row.title ? [{ slug: String(row.slug), title: String(row.title), category: row.category || '', priority: 25 }] : [])
      : [];
    const targets = [...STATIC_INTERNAL_LINK_TARGETS, ...articleTargets];
    internalLinkTargetCache = { expiresAt: now + INTERNAL_LINK_TARGET_CACHE_TTL, targets };
    return targets;
  } catch {
    return internalLinkTargetCache?.targets || [];
  }
}
`;
  next = next.replace("const SITE_ORIGIN = 'https://solmint.ir';", "const SITE_ORIGIN = 'https://solmint.ir';" + cacheBlock);
}

const oldRender = "function inject(html: string, article: ArticleRecord, related: RelatedArticle[]) {";
if (next.includes(oldRender) && !next.includes("contextualContent: string")) {
  next = next.replace(oldRender, "function inject(html: string, article: ArticleRecord, related: RelatedArticle[], contextualContent: string) {");
  const bodyMarker = "${renderBody(article.content || '')}";
  if (!next.includes(bodyMarker)) throw new Error('article SSR body marker not found');
  next = next.replace(bodyMarker, "${renderBody(contextualContent)}");
}

const oldCallBlock = "const related = await fetchRelated(base, key, article);";
if (next.includes(oldCallBlock) && !next.includes("const contextualLinkData = await Promise.all")) {
  const newBlock = `const [related, internalLinkTargets] = await Promise.all([\n      fetchRelated(base, key, article),\n      fetchInternalLinkTargets(base, key)\n    ]);\n    const locale = detectArticleLocale(article);\n    const contextualContent = linkContextualInternalReferences(article.content || '', internalLinkTargets, { currentSlug: article.slug, language: locale.lang, maxLinks: 5, maxPerTarget: 1 });`;
  next = next.replace(oldCallBlock, newBlock);
}

const oldReturn = "return new Response(inject(html, article, related), { status: 200, headers });";
if (next.includes(oldReturn)) next = next.replace(oldReturn, "return new Response(inject(html, article, related, contextualContent), { status: 200, headers });");

if (next === source) {
  const alreadyApplied = next.includes(importLine)
    && next.includes(cacheMarker)
    && next.includes('function inject(html: string, article: ArticleRecord, related: RelatedArticle[], contextualContent: string)')
    && next.includes('const [related, internalLinkTargets] = await Promise.all([')
    && next.includes('return new Response(inject(html, article, related, contextualContent), { status: 200, headers });');
  if (alreadyApplied) {
    console.log('✓ Contextual internal linking SSR wiring already applied.');
    process.exit(0);
  }
  throw new Error('No contextual-linking SSR changes applied');
}

fs.writeFileSync(file, next);
console.log('✓ Contextual internal linking SSR wiring applied.');
