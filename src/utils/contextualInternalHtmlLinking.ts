export type HtmlInternalLinkTarget = {
  slug: string;
  title: string;
  aliases?: string[];
  priority?: number;
  href?: string;
};

export type HtmlContextualLinkOptions = {
  currentSlug?: string;
  maxLinks?: number;
  maxPerTarget?: number;
};

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
const protectedTags = new Set(['a', 'code', 'pre', 'script', 'style', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function phraseUseful(value: string, allowSingleWord = false) {
  const text = normalize(value);
  const words = text.split(/\s+/).filter(Boolean);
  if (!text || !words.length) return false;
  if (words.length === 1) return allowSingleWord && text.length >= 4;
  return words.every(word => word.length >= 2);
}

function aliasesFor(target: HtmlInternalLinkTarget) {
  const values = [target.title, ...(target.aliases || [])]
    .map(normalize)
    .filter((value, index, all) => value && phraseUseful(value, index > 0) && all.indexOf(value) === index);
  return values.sort((a, b) => b.length - a.length || b.split(' ').length - a.split(' ').length);
}

function boundarySafe(text: string, start: number, end: number, alias: string) {
  if (!isLatinLike(alias)) return true;
  return !/[A-Za-z0-9_]/.test(text[start - 1] || '') && !/[A-Za-z0-9_]/.test(text[end] || '');
}

function firstMatch(text: string, aliases: string[]) {
  for (const alias of aliases) {
    const expression = new RegExp(escapeRegex(alias), isLatinLike(alias) ? 'gi' : 'gu');
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      if (boundarySafe(text, start, end, alias)) return { start, end, alias };
    }
  }
  return null;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(value: string) {
  const href = String(value || '').trim();
  if (/^(javascript|data|vbscript):/i.test(href)) return '#';
  if (/^(https?:|\/|#)/i.test(href)) return href;
  return '#';
}

/**
 * Adds contextual internal links directly to HTML text nodes.
 * Existing anchors, code, preformatted content, scripts/styles and headings are never rewritten.
 */
export function linkContextualInternalHtmlReferences(
  html: string,
  targets: HtmlInternalLinkTarget[],
  options: HtmlContextualLinkOptions = {},
): string {
  let result = String(html || '');
  if (!result || !targets.length) return result;

  const maxLinks = Math.max(0, options.maxLinks ?? 5);
  const maxPerTarget = Math.max(1, options.maxPerTarget ?? 1);
  if (!maxLinks) return result;

  const currentSlug = normalize(options.currentSlug || '');
  const candidates = targets
    .filter(target => target.slug && normalize(target.slug) !== currentSlug)
    .map(target => ({
      target,
      aliases: aliasesFor(target),
      score: Math.max(...aliasesFor(target).map(alias => alias.length + alias.split(' ').length * 4), 0) + Number(target.priority || 0),
    }))
    .filter(item => item.aliases.length)
    .sort((a, b) => b.score - a.score || a.target.title.localeCompare(b.target.title));

  const linkedTargets = new Set<string>();
  let added = 0;
  let protectedDepth = 0;

  const parts = result.split(/(<\/?[a-zA-Z][^>]*>)/g);
  const output: string[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (/^<\/?[a-zA-Z][^>]*>$/.test(part)) {
      const closing = /^<\//.test(part);
      const tagMatch = part.match(/^<\/?\s*([a-zA-Z0-9-]+)/);
      const tag = String(tagMatch?.[1] || '').toLowerCase();
      if (closing && protectedTags.has(tag)) protectedDepth = Math.max(0, protectedDepth - 1);
      output.push(part);
      if (!closing && protectedTags.has(tag) && !/\/\s*>$/.test(part)) protectedDepth += 1;
      continue;
    }

    if (protectedDepth > 0 || added >= maxLinks) {
      output.push(part);
      continue;
    }

    let text = part;
    for (const candidate of candidates) {
      if (added >= maxLinks || linkedTargets.has(normalize(candidate.target.href || `/article/${candidate.target.slug}`))) break;
      const key = normalize(candidate.target.href || `/article/${candidate.target.slug}`);
      if (linkedTargets.has(key)) continue;

      const match = firstMatch(text, candidate.aliases);
      if (!match) continue;

      const href = safeHref(candidate.target.href || `/article/${encodeURIComponent(candidate.target.slug)}`);
      const label = escapeHtml(text.slice(match.start, match.end));
      const anchor = href === '#'
        ? label
        : `<a href="${escapeHtml(href)}">${label}</a>`;
      text = `${text.slice(0, match.start)}${anchor}${text.slice(match.end)}`;
      linkedTargets.add(key);
      added += 1;
    }
    output.push(text);
  }

  return output.join('');
}
