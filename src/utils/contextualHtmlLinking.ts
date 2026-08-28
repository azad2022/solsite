export type ContextualLinkTarget = {
  slug: string;
  title: string;
  aliases?: string[];
  priority?: number;
  href?: string;
};

export type ContextualLinkOptions = {
  currentSlug?: string;
  maxLinks?: number;
};

export const CONTEXTUAL_PAGE_TARGETS: ContextualLinkTarget[] = [
  { slug: 'solana-wallet-page', title: 'کیف پول سولانا', aliases: ['کیف پول سولانا'], priority: 100, href: '/solana-wallet' },
  { slug: 'solana-token-page', title: 'ساخت توکن سولانا', aliases: ['ساخت توکن سولانا'], priority: 98, href: '/solana-token' },
  { slug: 'solana-meme-coin-page', title: 'ساخت میم کوین سولانا', aliases: ['ساخت میم کوین سولانا'], priority: 94, href: '/solana-meme-coin' },
  { slug: 'solana-price-page', title: 'قیمت سولانا', aliases: ['قیمت سولانا'], priority: 86, href: '/solana-price' },
  { slug: 'wallet-analyzer-page', title: 'بررسی کیف پول', aliases: ['بررسی کیف پول', 'تحلیل کیف پول'], priority: 82, href: '/wallet-analyzer' },
  { slug: 'security-page', title: 'امنیت سولانا', aliases: ['امنیت سولانا'], priority: 78, href: '/security' }
];

export function buildContextualLinkTargets(articles: Array<Pick<ContextualLinkTarget, 'slug' | 'title'>> = []) {
  const articleTargets = Array.isArray(articles)
    ? articles.filter(article => article?.slug && article?.title).map(article => ({ slug: String(article.slug), title: String(article.title), priority: 25 }))
    : [];
  return [...CONTEXTUAL_PAGE_TARGETS, ...articleTargets];
}

const normalize = (value: string) => String(value || '')
  .normalize('NFKC')
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[ۀة]/g, 'ه')
  .replace(/[\u200c\u200e\u200f]/g, ' ')
  .replace(/[\u064B-\u065F\u0670]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const escapeAttribute = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PERSIAN_SPACE = '[\\s\\u200c\\u200e\\u200f]+';
const candidatePattern = (alias: string) => {
  const normalizedAlias = normalize(alias);
  if (!normalizedAlias) return null;
  return new RegExp(normalizedAlias.split(' ').map(part => escapeRegex(part)).join(PERSIAN_SPACE), 'giu');
};
const SKIP_TAGS = new Set(['a', 'code', 'pre', 'script', 'style', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function protectHtmlSegments(html: string) {
  const pattern = /<!--[^]*?-->|<[^>]+>/g;
  const segments: Array<{ start: number; end: number; tag?: string; closing?: boolean }> = [];
  for (const match of html.matchAll(pattern)) {
    if (match.index === undefined) continue;
    const raw = match[0];
    const tag = raw.match(/^<\/?\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    segments.push({ start: match.index, end: match.index + raw.length, tag, closing: /^<\//.test(raw) });
  }
  return segments;
}

function currentSkipDepth(html: string, position: number, tags: Array<{ start: number; end: number; tag?: string; closing?: boolean }>) {
  const stack: string[] = [];
  for (const token of tags) {
    if (token.end > position) break;
    if (!token.tag || !SKIP_TAGS.has(token.tag)) continue;
    if (token.closing) {
      const index = stack.lastIndexOf(token.tag);
      if (index >= 0) stack.splice(index, 1);
    } else if (!/\/\s*>$/.test(html.slice(token.start, token.end))) {
      stack.push(token.tag);
    }
  }
  return stack.length > 0;
}

function titleCandidates(targets: ContextualLinkTarget[], currentSlug: string) {
  const current = normalize(currentSlug);
  const output: Array<{ target: ContextualLinkTarget; alias: string; score: number }> = [];
  for (const target of targets) {
    if (!target?.slug || !target.title || normalize(target.slug) === current) continue;
    const aliases = [target.title, ...(target.aliases || [])].map(normalize).filter(value => value.length >= 6);
    for (const alias of [...new Set(aliases)]) output.push({ target, alias, score: alias.length + Number(target.priority || 0) });
  }
  return output.sort((a, b) => b.score - a.score || b.alias.length - a.alias.length);
}

export function linkContextualHtml(html: string, targets: ContextualLinkTarget[], options: ContextualLinkOptions = {}) {
  let result = String(html || '');
  const maxLinks = Math.max(0, options.maxLinks ?? 5);
  if (!result || !targets.length || maxLinks === 0) return result;
  const used = new Set<string>();
  let added = 0;
  for (const candidate of titleCandidates(targets, options.currentSlug || '')) {
    if (added >= maxLinks) break;
    const key = normalize(candidate.target.href || `/article/${candidate.target.slug}`);
    if (used.has(key)) continue;
    const expression = candidatePattern(candidate.alias);
    if (!expression) continue;
    const tokens = protectHtmlSegments(result);
    let match: RegExpExecArray | null;
    while ((match = expression.exec(result))) {
      const start = match.index;
      const end = start + match[0].length;
      if (tokens.some(token => start < token.end && end > token.start) || currentSkipDepth(result, start, tokens)) continue;
      const href = escapeAttribute(candidate.target.href || `/article/${encodeURIComponent(candidate.target.slug)}`);
      const visibleText = result.slice(start, end);
      result = result.slice(0, start) + `<a href="${href}" class="contextual-internal-link">${visibleText}</a>` + result.slice(end);
      used.add(key);
      added += 1;
      break;
    }
  }
  return result;
}

export function linkContextualMarkdown(markdown: string, targets: ContextualLinkTarget[], options: ContextualLinkOptions = {}) {
  let result = String(markdown || '');
  const maxLinks = Math.max(0, options.maxLinks ?? 5);
  if (!result || !targets.length || maxLinks === 0) return result;
  const used = new Set<string>();
  let added = 0;
  for (const candidate of titleCandidates(targets, options.currentSlug || '')) {
    if (added >= maxLinks) break;
    const key = normalize(candidate.target.href || `/article/${candidate.target.slug}`);
    if (used.has(key)) continue;
    const expression = candidatePattern(candidate.alias);
    if (!expression) continue;
    const match = expression.exec(result);
    if (!match) continue;
    const start = match.index;
    const before = result.slice(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = result.slice(lineStart, result.indexOf('\n', start) === -1 ? result.length : result.indexOf('\n', start));
    if (/^\s{0,3}#{1,6}\s/.test(line)) continue;
    const href = candidate.target.href || `/article/${encodeURIComponent(candidate.target.slug)}`;
    result = result.slice(0, start) + `[${result.slice(start, start + match[0].length)}](${href})` + result.slice(start + match[0].length);
    used.add(key);
    added += 1;
  }
  return result;
}
