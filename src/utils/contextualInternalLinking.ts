export type InternalLinkTarget = {
  slug: string;
  title: string;
  aliases?: string[];
  category?: string;
  language?: string;
  priority?: number;
  href?: string;
};

export type ContextualLinkOptions = {
  currentSlug?: string;
  maxLinks?: number;
  maxPerTarget?: number;
  language?: 'fa' | 'en';
};

const STOPWORDS = new Set([
  'این','آن','یک','برای','از','به','در','با','و','یا','که','را','است','هست',
  'the','a','an','and','or','for','to','of','in','on','with','is','are'
]);

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
const isLatinLike = (value: string) => /[A-Za-z0-9]/.test(value);
const escapeHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function phraseUseful(value: string, allowSingleWord = false): boolean {
  const text = normalize(value);
  const words = text.split(/\s+/).filter(Boolean);
  if (!text || words.length === 0) return false;
  if (words.length === 1) return allowSingleWord && text.length >= 4 && !STOPWORDS.has(text);
  return words.every(word => word.length >= 3 && !STOPWORDS.has(word));
}

function uniqueAliases(target: InternalLinkTarget): string[] {
  const title = normalize(target.title);
  const aliases = (target.aliases || []).map(normalize);
  const values = [
    ...(phraseUseful(title) ? [title] : []),
    ...aliases.filter(value => phraseUseful(value, true))
  ];
  return [...new Set(values)].sort(
    (a, b) => b.length - a.length || b.split(' ').length - a.split(' ').length
  );
}

function protectedRanges(markup: string) {
  const patterns = [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /!\[[^\]]*\]\([^\n)]*\)/g,
    /\[[^\]]+\]\([^\n)]*\)/g,
    /<a\b[^>]*>[\s\S]*?<\/a>/gi,
    /https?:\/\/[^\s)]+/gi,
  ];
  const ranges: Array<{ start: number; end: number }> = [];
  for (const pattern of patterns) {
    for (const match of markup.matchAll(pattern)) {
      if (match.index !== undefined) ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && range.start <= prev.end) prev.end = Math.max(prev.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function inProtected(index: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some(range => index >= range.start && index < range.end);
}

function boundarySafe(text: string, start: number, end: number, alias: string) {
  if (!isLatinLike(alias)) return true;
  return !/[A-Za-z0-9_]/.test(text[start - 1] || '') && !/[A-Za-z0-9_]/.test(text[end] || '');
}

function languageCompatible(target: InternalLinkTarget, language?: 'fa' | 'en') {
  if (!language || !target.language) return true;
  return target.language === language;
}

function findCandidate(markup: string, aliases: string[], ranges: Array<{ start: number; end: number }>) {
  for (const alias of aliases) {
    const expression = new RegExp(escapeRegex(alias), isLatinLike(alias) ? 'gi' : 'gu');
    let match: RegExpExecArray | null;
    while ((match = expression.exec(markup))) {
      const start = match.index;
      const end = start + match[0].length;
      if (inProtected(start, ranges)) continue;
      if (!boundarySafe(markup, start, end, alias)) continue;
      const lineStart = markup.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = markup.indexOf('\n', start) === -1 ? markup.length : markup.indexOf('\n', start);
      const line = markup.slice(lineStart, lineEnd);
      if (/^\s{0,3}#{1,6}\s/.test(line)) continue;
      return { start, end, alias };
    }
  }
  return null;
}

export function linkContextualInternalReferences(
  markdown: string,
  targets: InternalLinkTarget[],
  options: ContextualLinkOptions = {}
): string {
  let result = String(markdown || '');
  if (!result || !targets.length) return result;

  const language = options.language;
  const maxLinks = Math.max(0, options.maxLinks ?? 5);
  const maxPerTarget = Math.max(1, options.maxPerTarget ?? 1);
  if (!maxLinks) return result;

  const currentSlug = normalize(options.currentSlug || '');
  const htmlMode = /<\/?[a-z][\s\S]*>/i.test(result);
  const candidates = targets
    .filter(target => target.slug && normalize(target.slug) !== currentSlug)
    .filter(target => languageCompatible(target, language))
    .map(target => {
      const aliases = uniqueAliases(target);
      const matches = aliases.some(alias => normalize(result).includes(alias));
      const specificity = aliases.reduce(
        (best, item) => Math.max(best, item.length + item.split(' ').length * 4),
        0
      );
      return { target, aliases, matches, score: specificity + Number(target.priority || 0) };
    })
    .filter(item => item.matches && item.aliases.length)
    .sort((a, b) => b.score - a.score || a.target.title.localeCompare(b.target.title));

  const used = new Set<string>();
  let added = 0;
  const targetCounts = new Map<string, number>();

  for (const candidate of candidates) {
    if (added >= maxLinks) break;
    const key = normalize(candidate.target.href || `/article/${candidate.target.slug}`);
    const count = targetCounts.get(key) || 0;
    if (used.has(key) || count >= maxPerTarget) continue;

    const ranges = protectedRanges(result);
    const match = findCandidate(result, candidate.aliases, ranges);
    if (!match) continue;

    const href = candidate.target.href || `/article/${encodeURIComponent(candidate.target.slug)}`;
    const sourceLabel = result.slice(match.start, match.end);
    const replacement = htmlMode
      ? `<a href="${escapeHtml(href)}">${escapeHtml(sourceLabel)}</a>`
      : `[${sourceLabel}](${href})`;
    result = `${result.slice(0, match.start)}${replacement}${result.slice(match.end)}`;
    used.add(key);
    targetCounts.set(key, count + 1);
    added += 1;
  }

  return result;
}
