import fs from 'node:fs';

const file = 'functions/article/[slug].ts';
const source = fs.readFileSync(file, 'utf8');
const markdownImport = "import { linkContextualInternalReferences } from '../../src/utils/contextualInternalLinking';";
const htmlImport = "import { linkContextualInternalHtmlReferences } from '../../src/utils/contextualInternalHtmlLinking';";

let next = source;
const importAnchor = "import { detectArticleLocale } from '../seo-helpers';";
if (!source.includes(importAnchor)) throw new Error('article SSR import anchor not found');
if (!next.includes(markdownImport)) next = next.replace(importAnchor, `${importAnchor}\n${markdownImport}`);
if (!next.includes(htmlImport)) next = next.replace(markdownImport, `${markdownImport}\n${htmlImport}`);

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
const newRender = "function inject(html: string, article: ArticleRecord, related: RelatedArticle[], contextualContent: string) {";
if (next.includes(oldRender)) next = next.replace(oldRender, newRender);
if (!next.includes(newRender)) throw new Error('contextual inject signature not present');

const bodyMarker = "${renderBody(article.content || '')}";
if (next.includes(bodyMarker)) next = next.replace(bodyMarker, "${renderBody(contextualContent)}");
if (!next.includes("${renderBody(contextualContent)}")) throw new Error('contextual article body marker not present');

const oldCallBlock = "const related = await fetchRelated(base, key, article);";
if (next.includes(oldCallBlock)) {
  const newBlock = `const [related, internalLinkTargets] = await Promise.all([\n      fetchRelated(base, key, article),\n      fetchInternalLinkTargets(base, key)\n    ]);\n    const locale = detectArticleLocale(article);\n    const originalContent = article.content || '';\n    const contextualContent = /<\\/?[a-z][\\s\\S]*>/i.test(originalContent)\n      ? linkContextualInternalHtmlReferences(originalContent, internalLinkTargets, { currentSlug: article.slug, maxLinks: 5, maxPerTarget: 1 })\n      : linkContextualInternalReferences(originalContent, internalLinkTargets, { currentSlug: article.slug, language: locale.lang, maxLinks: 5, maxPerTarget: 1 });`;
  next = next.replace(oldCallBlock, newBlock);
}

const oldReturn = "return new Response(inject(html, article, related), { status: 200, headers });";
const newReturn = "return new Response(inject(html, article, related, contextualContent), { status: 200, headers });";
if (next.includes(oldReturn)) next = next.replace(oldReturn, newReturn);
if (!next.includes(newReturn)) throw new Error('contextual response call not present');

if (next === source) {
  const alreadyApplied = next.includes(markdownImport)
    && next.includes(htmlImport)
    && next.includes(cacheMarker)
    && next.includes(newRender)
    && next.includes("${renderBody(contextualContent)}")
    && next.includes('const [related, internalLinkTargets] = await Promise.all([')
    && next.includes('linkContextualInternalHtmlReferences(originalContent, internalLinkTargets')
    && next.includes(newReturn);
  if (alreadyApplied) {
    console.log('✓ Contextual internal linking SSR wiring already applied.');
    process.exit(0);
  }
  throw new Error('No contextual-linking SSR changes applied');
}

fs.writeFileSync(file, next);
console.log('✓ Contextual internal linking SSR wiring applied.');
