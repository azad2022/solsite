export interface SolanaEntityDefinition {
  id: string;
  slug: string;
  aliases: string[];
  priority: number;
  maxPerArticle?: number;
}

const BASE = '/article/';

/**
 * Central entity registry for the Solmint Solana topic graph.
 * Aliases are ordered longest-first at runtime so specific phrases win over
 * shorter aliases (for example JitoSOL before Jito).
 */
export const SOLANA_ENTITIES: SolanaEntityDefinition[] = [
  { id: 'jupiter', slug: 'solana-jupiter-guide-2026', aliases: ['Jupiter Lend', 'ژوپیتر لند', 'ژوپیتر سولانا', 'Jupiter', 'ژوپیتر'], priority: 100 },
  { id: 'raydium', slug: 'raydium-solana-guide-2026', aliases: ['Raydium CLMM', 'CLMM ریدیوم', 'ریدیوم سولانا', 'Raydium', 'ریدیوم'], priority: 95 },
  { id: 'kamino', slug: 'kamino-solana-guide-2026', aliases: ['Kamino Lend', 'کامینو فایننس', 'Kamino Finance', 'Kamino', 'کامینو'], priority: 90 },
  { id: 'jitosol', slug: 'jitosol-solana-guide-2026', aliases: ['JitoSOL', 'جیتو سول'], priority: 88 },
  { id: 'jito', slug: 'jito-solana-guide-2026', aliases: ['Jito', 'جیتو سولانا', 'جیتو'], priority: 86 },
  { id: 'jito-mev', slug: 'jito-mev-solana-guide-2026', aliases: ['MEV در سولانا', 'Jito MEV', 'MEV سولانا'], priority: 84 },
  { id: 'drift', slug: 'drift-solana-guide-2026', aliases: ['Drift Protocol', 'Drift', 'دریفت سولانا', 'دریفت'], priority: 80 },
  { id: 'pyth', slug: 'pyth-solana-guide-2026', aliases: ['Pyth Network', 'Pyth', 'پایث نتورک', 'پایث'], priority: 78 },
  { id: 'phantom', slug: 'phantom-solana-guide-2026', aliases: ['Phantom Wallet', 'Phantom', 'کیف پول فانتوم', 'فانتوم'], priority: 74 },
  { id: 'helium', slug: 'helium-solana-guide-2026', aliases: ['Helium', 'هلیوم سولانا', 'هلیوم'], priority: 72 },
  { id: 'metaplex', slug: 'metaplex-solana-guide-2026', aliases: ['Metaplex Core', 'Metaplex', 'متاپلکس'], priority: 70 },
  { id: 'solana-defi', slug: 'solana-defi-map-2026', aliases: ['دیفای سولانا', 'DeFi سولانا', 'Solana DeFi'], priority: 68 }
];

const SORTED_ENTITIES = [...SOLANA_ENTITIES].sort((a, b) => b.priority - a.priority);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLatinLike(value: string): boolean {
  return /[A-Za-z0-9]/.test(value);
}

function hasBoundary(text: string, start: number, end: number, alias: string): boolean {
  if (!isLatinLike(alias)) return true;
  const before = text[start - 1] || '';
  const after = text[end] || '';
  return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
}

function protectRegions(markdown: string) {
  const blocks: Array<{ start: number; end: number }> = [];
  const patterns = [/```[\s\S]*?```/g, /`[^`\n]+`/g, /!\[[^\]]*\]\([^\n)]*\)/g, /\[[^\]]+\]\([^\n)]*\)/g, /<a\b[^>]*>[\s\S]*?<\/a>/gi, /https?:\/\/[^\s)]+/gi];
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      if (match.index === undefined) continue;
      blocks.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  blocks.sort((a, b) => a.start - b.start || a.end - b.end);
  return blocks.filter((block, index) => index === 0 || block.start >= blocks[index - 1].end);
}

function inProtectedRegion(index: number, regions: Array<{ start: number; end: number }>): boolean {
  return regions.some(region => index >= region.start && index < region.end);
}

function insertOne(markdown: string, alias: string, href: string, currentSlug: string): { content: string; changed: boolean } {
  if (!alias || currentSlug === href.replace(BASE, '')) return { content: markdown, changed: false };

  const regions = protectRegions(markdown);
  const expression = new RegExp(escapeRegex(alias), isLatinLike(alias) ? 'g' : 'gu');
  let match: RegExpExecArray | null;
  while ((match = expression.exec(markdown))) {
    const start = match.index;
    const end = start + alias.length;
    if (inProtectedRegion(start, regions)) continue;
    if (!hasBoundary(markdown, start, end, alias)) continue;
    const link = `[${alias}](${href})`;
    return { content: `${markdown.slice(0, start)}${link}${markdown.slice(end)}`, changed: true };
  }
  return { content: markdown, changed: false };
}

export interface EntityLinkingOptions {
  currentSlug?: string;
  maxLinks?: number;
  maxPerEntity?: number;
}

/**
 * Adds a small number of contextual Markdown links to existing prose.
 * It is intentionally conservative: one link per entity per article by
 * default, five total links per article, never self-links, never touches
 * existing Markdown links/code/URLs, and prefers descriptive aliases.
 */
export function linkSolanaEntities(markdown: string, options: EntityLinkingOptions = {}): string {
  let result = String(markdown || '');
  const currentSlug = options.currentSlug || '';
  const maxLinks = Math.max(0, options.maxLinks ?? 5);
  const maxPerEntity = Math.max(1, options.maxPerEntity ?? 1);
  let added = 0;

  if (!result || maxLinks === 0) return result;

  for (const entity of SORTED_ENTITIES) {
    if (added >= maxLinks) break;
    let entityAdded = 0;
    const aliases = [...entity.aliases].sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      if (entityAdded >= maxPerEntity || added >= maxLinks) break;
      const outcome = insertOne(result, alias, `${BASE}${entity.slug}`, currentSlug);
      if (!outcome.changed) continue;
      result = outcome.content;
      entityAdded += 1;
      added += 1;
    }
  }

  return result;
}
