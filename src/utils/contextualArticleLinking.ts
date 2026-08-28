export type ContextualArticleTarget = {
  slug: string;
  title: string;
  priority?: number;
  href?: string;
};

const CACHE_TTL = 300_000;
let targetCache: { expiresAt: number; targets: ContextualArticleTarget[] } | null = null;

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

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function protectedRanges(markdown: string) {
  const patterns = [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /!\[[^\]]*\]\([^\n)]*\)/g,
    /\[[^\]]+\]\([^\n)]*\)/g,
    /<a\b[^>]*>[\s\S]*?<\/a>/gi,
    /https?:\/\/[^\s)]+/gi,
    /^#{1,6}\s+.*$/gm
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

function isProtected(index: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some(range => index >= range.start && index < range.end);
}

export function linkContextualArticleTitles(markdown: string, targets: ContextualArticleTarget[], currentSlug: string, maxLinks = 5) {
  let result = String(markdown || '');
  if (!result || !targets.length || maxLinks <= 0) return result;

  const current = normalize(currentSlug);
  const candidates = targets
    .filter(target => target.slug && target.title && normalize(target.slug) !== current)
    .filter(target => String(target.title).trim().length >= 8)
    .sort((a, b) => String(b.title).length - String(a.title).length || Number(b.priority || 0) - Number(a.priority || 0));

  let added = 0;
  for (const target of candidates) {
    if (added >= maxLinks) break;
    const title = String(target.title).trim();
    const expression = new RegExp(escapeRegex(title), 'giu');
    const ranges = protectedRanges(result);
    let match: RegExpExecArray | null;
    while ((match = expression.exec(result))) {
      const start = match.index;
      const end = start + match[0].length;
      if (isProtected(start, ranges)) continue;
      const href = target.href || `/article/${encodeURIComponent(target.slug)}`;
      result = `${result.slice(0, start)}[${result.slice(start, end)}](${href})${result.slice(end)}`;
      added += 1;
      break;
    }
  }
  return result;
}

export async function fetchContextualArticleTargets(base: string, key: string): Promise<ContextualArticleTarget[]> {
  const now = Date.now();
  if (targetCache && targetCache.expiresAt > now) return targetCache.targets;

  const staticTargets: ContextualArticleTarget[] = [
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
    if (!response.ok) return targetCache?.targets || staticTargets;
    const rows = await response.json() as Array<{ slug?: string; title?: string }>;
    const articleTargets = Array.isArray(rows)
      ? rows.flatMap(row => row.slug && row.title ? [{ slug: String(row.slug), title: String(row.title), priority: 25 }] : [])
      : [];
    const targets = [...staticTargets, ...articleTargets];
    targetCache = { expiresAt: now + CACHE_TTL, targets };
    return targets;
  } catch {
    return targetCache?.targets || staticTargets;
  }
}

export function renderContextualMarkdownLine(line: string, escapeHtml: (value: unknown) => string, safeUrl: (value: unknown) => string) {
  const source = String(line || '');
  const parts: string[] = [];
  let cursor = 0;
  const tokenPattern = /\*\*\[([^\]]+)\]\(([^\s)]+)\)\*\*|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let match: RegExpExecArray | null;
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
