import fs from 'node:fs';

const file = 'functions/article/[slug].ts';
const source = fs.readFileSync(file, 'utf8');
let next = source;

const helperMarker = 'const INTERNAL_TITLE_LINK_CACHE_TTL = 300_000;';
if (!next.includes(helperMarker)) {
  const helperBlock = `
const INTERNAL_TITLE_LINK_CACHE_TTL = 300_000;
let internalTitleLinkCache: { expiresAt: number; targets: Array<{ slug: string; title: string; priority?: number; href?: string }> } | null = null;

function normalizeInternalTitle(value: string) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[\\u200c\\u200e\\u200f]/g, ' ')
    .replace(/[\\u064B-\\u065F\\u0670]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function internalTitleProtectedRanges(markdown: string) {
  const patterns = [
    /```[\\s\\S]*?```/g,
    /`[^`\\n]+`/g,
    /!\\[[^\\]]*\\]\\([^\\n)]*\\)/g,
    /\\[[^\\]]+\\]\\([^\\n)]*\\)/g,
    /<a\\b[^>]*>[\\s\\S]*?<\\/a>/gi,
    /https?:\\/\\/[^\\s)]+/gi,
    /^#{1,6}\\s+.*$/gm
  ];
  const ranges: Array<{ start: number; end: number }> = [];
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      if (match.index !== undefined) ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function internalTitleIsProtected(index: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some(range => index >= range.start && index < range.end);
}

function linkContextualArticleTitles(markdown: string, targets: Array<{ slug: string; title: string; priority?: number; href?: string }>, currentSlug: string) {
  let result = String(markdown || '');
  const current = normalizeInternalTitle(currentSlug);
  const candidates = targets
    .filter(target => target.slug && target.title && normalizeInternalTitle(target.slug) !== current)
    .sort((a, b) => String(b.title).length - String(a.title).length || Number(b.priority || 0) - Number(a.priority || 0));

  let added = 0;
  for (const target of candidates) {
    if (added >= 5) break;
    const title = String(target.title).trim();
    if (title.length < 8) continue;
    const normalizedTitle = normalizeInternalTitle(title);
    if (!normalizedTitle) continue;
    const expression = new RegExp(title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'giu');
    const ranges = internalTitleProtectedRanges(result);
    let match;
    while ((match = expression.exec(result))) {
      const start = match.index;
      const end = start + match[0].length;
      if (internalTitleIsProtected(start, ranges)) continue;
      const href = target.href || `/article/${encodeURIComponent(target.slug)}`;
      result = `${result.slice(0, start)}[${result.slice(start, end)}](${href})${result.slice(end)}`;
      added += 1;
      break;
    }
  }
  return result;
}

async function fetchInternalTitleTargets(base: string, key: string) {
  const now = Date.now();
  if (internalTitleLinkCache && internalTitleLinkCache.expiresAt > now) return internalTitleLinkCache.targets;

  const staticTargets = [
    { slug: 'solana-wallet-page', title: 'کیف پول سولانا', priority: 100, href: '/solana-wallet' },
    { slug: 'solana-token-page', title: 'ساخت توکن سولانا', priority: 98, href: '/solana-token' },
    { slug: 'solana-meme-coin-page', title: 'ساخت میم کوین سولانا', priority: 94, href: '/solana-meme-coin' },
    { slug: 'solana-price-page', title: 'قیمت سولانا', priority: 86, href: '/solana-price' },
    { slug: 'wallet-analyzer-page', title: 'بررسی کیف پول', priority: 82, href: '/wallet-analyzer' },
    { slug: 'security-page', title: 'امنیت سولانا', priority: 78, href: '/security' }
  ];

  const url = `${base}/rest/v1/articles?select=slug,title&is_draft=eq.false&order=published_at.desc,id.desc&limit=250`;
  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return internalTitleLinkCache?.targets || staticTargets;
    const rows = await response.json() as Array<{ slug?: string; title?: string }>;
    const articleTargets = Array.isArray(rows)
      ? rows.flatMap(row => row.slug && row.title ? [{ slug: String(row.slug), title: String(row.title), priority: 25 }] : [])
      : [];
    const targets = [...staticTargets, ...articleTargets];
    internalTitleLinkCache = { expiresAt: now + INTERNAL_TITLE_LINK_CACHE_TTL, targets };
    return targets;
  } catch {
    return internalTitleLinkCache?.targets || staticTargets;
  }
}

function renderPlainMarkdownParagraphWithLinks(line: string) {
  const source = String(line || '');
  const parts: string[] = [];
  let cursor = 0;
  const tokenPattern = /\\*\\*\\[([^\\]]+)\\]\\(([^\\s)]+)\\)\\*\\*|\\[([^\\]]+)\\]\\(([^\\s)]+)\\)|\\*\\*([^*]+)\\*\\*/g;
  let match;
  while ((match = tokenPattern.exec(source))) {
    if (match.index > cursor) parts.push(escapeHtml(source.slice(cursor, match.index)));
    if (match[1] !== undefined) {
      parts.push('<strong><a href="' + escapeHtml(safeUrl(match[2])) + '">' + escapeHtml(match[1]) + '</a></strong>');
    } else if (match[3] !== undefined) {
      const href = safeUrl(match[4]);
      parts.push(href === '#' ? escapeHtml(match[3]) : '<a href="' + escapeHtml(href) + '">' + escapeHtml(match[3]) + '</a>');
    } else {
      parts.push('<strong>' + escapeHtml(match[5]) + '</strong>');
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) parts.push(escapeHtml(source.slice(cursor)));
  return parts.join('');
}
`;
  const anchor = "const SITE_ORIGIN = 'https://solmint.ir';";
  if (!next.includes(anchor)) throw new Error('SSR site origin anchor not found');
  next = next.replace(anchor, `${anchor}${helperBlock}`);
}

const renderAnchor = 'function renderBody(value: string) {';
if (next.includes(renderAnchor) && !next.includes('renderPlainMarkdownParagraphWithLinks(line)')) {
  const start = next.indexOf(renderAnchor);
  const end = next.indexOf('\nfunction setMeta(', start);
  if (start < 0 || end < 0) throw new Error('SSR renderBody boundaries not found');
  const original = next.slice(start, end);
  const replaced = original.replace("out.push('<p>' + escapeHtml(line) + '</p>');", "out.push('<p>' + renderPlainMarkdownParagraphWithLinks(line) + '</p>');");
  if (replaced === original) throw new Error('SSR plain markdown paragraph marker not found');
  next = next.slice(0, start) + replaced + next.slice(end);
}

const oldInject = 'function inject(html: string, article: ArticleRecord, related: RelatedArticle[]) {';
if (next.includes(oldInject)) {
  next = next.replace(oldInject, 'function inject(html: string, article: ArticleRecord, related: RelatedArticle[], contextualContent: string) {');
}
if (next.includes("${renderBody(article.content || '')}")) {
  next = next.replace("${renderBody(article.content || '')}", "${renderBody(contextualContent)}");
}

const oldRelated = 'const related = await fetchRelated(base, key, article);';
if (next.includes(oldRelated) && !next.includes('const [related, internalTitleTargets] = await Promise.all([')) {
  const replacement = `const [related, internalTitleTargets] = await Promise.all([\n      fetchRelated(base, key, article),\n      fetchInternalTitleTargets(base, key)\n    ]);\n    const contextualContent = linkContextualArticleTitles(article.content || '', internalTitleTargets, article.slug);`;
  next = next.replace(oldRelated, replacement);
}

const oldReturn = 'return new Response(inject(html, article, related), { status: 200, headers });';
if (next.includes(oldReturn)) {
  next = next.replace(oldReturn, 'return new Response(inject(html, article, related, contextualContent), { status: 200, headers });');
}

const required = [
  helperMarker,
  'renderPlainMarkdownParagraphWithLinks(line)',
  'contextualContent: string',
  'fetchInternalTitleTargets(base, key)',
  'return new Response(inject(html, article, related, contextualContent), { status: 200, headers });'
];
for (const marker of required) {
  if (!next.includes(marker)) throw new Error(`SSR contextual title linking failed: missing ${marker}`);
}

if (next !== source) {
  fs.writeFileSync(file, next, 'utf8');
  console.log('✓ SSR contextual article title linking applied.');
} else {
  console.log('✓ SSR contextual article title linking already applied.');
}
