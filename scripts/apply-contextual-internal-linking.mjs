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
  const cacheBlock = `\nconst INTERNAL_LINK_TARGET_CACHE_TTL = 300_000;\nlet internalLinkTargetCache: { expiresAt: number; targets: Array<{ slug: string; title: string; tags?: string[]; category?: string; language?: string; priority?: number; href?: string }> } | null = null;\n\nconst STATIC_INTERNAL_LINK_TARGETS = [\n  { slug: 'solana-wallet-page', title: 'کیف پول سولانا', aliases: ['کیف پول سولانا', 'کیف پول غیرامانی'], priority: 100, href: '/solana-wallet', language: 'fa' },\n  { slug: 'solana-token-page', title: 'ساخت توکن سولانا', aliases: ['ساخت توکن سولانا', 'SPL Token'], priority: 98, href: '/solana-token' },\n  { slug: 'solana-meme-coin-page', title: 'ساخت میم کوین سولانا', aliases: ['ساخت میم کوین', 'میم کوین سولانا'], priority: 94, href: '/solana-meme-coin', language: 'fa' },\n  { slug: 'solana-price-page', title: 'قیمت سولانا', aliases: ['قیمت سولانا', 'قیمت SOL'], priority: 86, href: '/solana-price', language: 'fa' },\n  { slug: 'wallet-analyzer-page', title: 'بررسی کیف پول', aliases: ['بررسی کیف پول', 'تحلیل کیف پول سولانا'], priority: 82, href: '/wallet-analyzer', language: 'fa' },\n  { slug: 'security-page', title: 'امنیت سولانا', aliases: ['امنیت سولانا', 'امنیت کیف پول'], priority: 78, href: '/security', language: 'fa' },\n];\n\nasync function fetchInternalLinkTargets(base: string, key: string) {\n  const now = Date.now();\n  if (internalLinkTargetCache && internalLinkTargetCache.expiresAt > now) return internalLinkTargetCache.targets;\n\n  const url = \\`${'${base}'}/rest/v1/articles?select=slug,title,tags,category&is_draft=eq.false&order=published_at.desc&limit=250\\`;\n  try {\n    const response = await fetch(url, {\n      headers: { apikey: key, Authorization: \\`Bearer ${'${key}'}\\`, Accept: 'application/json' },\n      signal: AbortSignal.timeout(5000)\n    });\n    if (!response.ok) return internalLinkTargetCache?.targets || [];\n    const rows = await response.json() as Array<{ slug?: string; title?: string; tags?: unknown; category?: string }>;\n    const articleTargets = Array.isArray(rows) ? rows.flatMap(row => row.slug && row.title ? [{\n      slug: String(row.slug),\n      title: String(row.title),\n      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],\n      category: row.category || '',\n      priority: 25\n    }] : []) : [];\n    const targets = [...STATIC_INTERNAL_LINK_TARGETS, ...articleTargets];\n    internalLinkTargetCache = { expiresAt: now + INTERNAL_LINK_TARGET_CACHE_TTL, targets };\n    return targets;\n  } catch {\n    return internalLinkTargetCache?.targets || [];\n  }\n}\n`;
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
if (next.includes(oldCallBlock) && !next.includes("const internalLinkTargets = await fetchInternalLinkTargets")) {
  const newBlock = `${oldCallBlock}\n    const locale = detectArticleLocale(article);\n    const internalLinkTargets = await fetchInternalLinkTargets(base, key);\n    const contextualContent = linkContextualInternalReferences(article.content || '', internalLinkTargets, { currentSlug: article.slug, language: locale.lang, maxLinks: 5, maxPerTarget: 1 });`;
  next = next.replace(oldCallBlock, newBlock);
}

const oldReturn = "return new Response(inject(html, article, related), { status: 200, headers });";
if (next.includes(oldReturn)) next = next.replace(oldReturn, "return new Response(inject(html, article, related, contextualContent), { status: 200, headers });");

if (next === source) throw new Error('No contextual-linking SSR changes applied');
fs.writeFileSync(file, next);
console.log('✓ Contextual internal linking SSR wiring applied.');
