export interface SolanaEntityDefinition { id: string; slug: string; aliases: string[]; priority: number; }

const BASE = '/article/';

export const SOLANA_ENTITIES: SolanaEntityDefinition[] = [
  { id: 'jupiter-lend', slug: 'jupiter-lend-solana-guide-2026', aliases: ['Jupiter Lend', 'ژوپیتر لند'], priority: 106 },
  { id: 'raydium-clmm', slug: 'raydium-clmm-solana-guide-2026', aliases: ['Raydium CLMM', 'CLMM ریدیوم'], priority: 101 },
  { id: 'jupiter', slug: 'solana-jupiter-guide-2026', aliases: ['ژوپیتر سولانا', 'Jupiter', 'ژوپیتر'], priority: 100 },
  { id: 'raydium', slug: 'raydium-solana-guide-2026', aliases: ['ریدیوم سولانا', 'Raydium', 'ریدیوم'], priority: 95 },
  { id: 'kamino-lend', slug: 'kamino-lend-solana-guide-2026', aliases: ['Kamino Lend', 'کامینو لند'], priority: 96 },
  { id: 'kamino', slug: 'kamino-solana-guide-2026', aliases: ['کامینو فایننس', 'Kamino Finance', 'Kamino', 'کامینو'], priority: 90 },
  { id: 'jitosol', slug: 'jitosol-solana-guide-2026', aliases: ['JitoSOL', 'جیتو سول'], priority: 88 },
  { id: 'jito-mev', slug: 'jito-mev-solana-guide-2026', aliases: ['MEV در سولانا', 'Jito MEV', 'MEV سولانا'], priority: 87 },
  { id: 'jito', slug: 'jito-solana-guide-2026', aliases: ['جیتو سولانا', 'Jito', 'جیتو'], priority: 86 },
  { id: 'drift', slug: 'drift-solana-guide-2026', aliases: ['Drift Protocol', 'Drift', 'دریفت سولانا', 'دریفت'], priority: 80 },
  { id: 'pyth', slug: 'pyth-solana-guide-2026', aliases: ['Pyth Network', 'Pyth', 'پایث نتورک', 'پایث'], priority: 78 },
  { id: 'phantom', slug: 'phantom-solana-guide-2026', aliases: ['Phantom Wallet', 'Phantom', 'کیف پول فانتوم', 'فانتوم'], priority: 74 },
  { id: 'helium', slug: 'helium-solana-guide-2026', aliases: ['Helium', 'هلیوم سولانا', 'هلیوم'], priority: 72 },
  { id: 'metaplex', slug: 'metaplex-solana-guide-2026', aliases: ['Metaplex Core', 'Metaplex', 'متاپلکس'], priority: 70 },
  { id: 'solana-defi', slug: 'solana-defi-map-2026', aliases: ['دیفای سولانا', 'DeFi سولانا', 'Solana DeFi'], priority: 68 }
];

const SORTED_ENTITIES = [...SOLANA_ENTITIES].sort((a, b) => b.priority - a.priority);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isLatinLike = (value: string) => /[A-Za-z0-9]/.test(value);

function hasBoundary(text: string, start: number, end: number, alias: string) {
  if (!isLatinLike(alias)) return true;
  return !/[A-Za-z0-9_]/.test(text[start - 1] || '') && !/[A-Za-z0-9_]/.test(text[end] || '');
}

function protectedRegions(markdown: string) {
  const patterns = [/```[\s\S]*?```/g, /`[^`\n]+`/g, /!\[[^\]]*\]\([^\n)]*\)/g, /\[[^\]]+\]\([^\n)]*\)/g, /<a\b[^>]*>[\s\S]*?<\/a>/gi, /https?:\/\/[^\s)]+/gi];
  const blocks: Array<{ start: number; end: number }> = [];
  for (const pattern of patterns) for (const match of markdown.matchAll(pattern)) if (match.index !== undefined) blocks.push({ start: match.index, end: match.index + match[0].length });
  blocks.sort((a, b) => a.start - b.start || a.end - b.end);
  return blocks.filter((block, index) => index === 0 || block.start >= blocks[index - 1].end);
}

function inProtected(index: number, blocks: Array<{ start: number; end: number }>) {
  return blocks.some(block => index >= block.start && index < block.end);
}

function insertOne(markdown: string, alias: string, href: string, currentSlug: string) {
  if (!alias || currentSlug === href.replace(BASE, '')) return { content: markdown, changed: false };
  const blocks = protectedRegions(markdown);
  const expression = new RegExp(escapeRegex(alias), isLatinLike(alias) ? 'g' : 'gu');
  let match: RegExpExecArray | null;
  while ((match = expression.exec(markdown))) {
    const start = match.index;
    const end = start + alias.length;
    if (inProtected(start, blocks) || !hasBoundary(markdown, start, end, alias)) continue;
    return { content: `${markdown.slice(0, start)}[${alias}](${href})${markdown.slice(end)}`, changed: true };
  }
  return { content: markdown, changed: false };
}

export function linkSolanaEntities(markdown: string, options: { currentSlug?: string; maxLinks?: number; maxPerEntity?: number } = {}) {
  let result = String(markdown || '');
  const currentSlug = options.currentSlug || '';
  const maxLinks = Math.max(0, options.maxLinks ?? 5);
  const maxPerEntity = Math.max(1, options.maxPerEntity ?? 1);
  let added = 0;
  if (!result || maxLinks === 0) return result;

  for (const entity of SORTED_ENTITIES) {
    if (added >= maxLinks) break;
    let entityAdded = 0;
    for (const alias of [...entity.aliases].sort((a, b) => b.length - a.length)) {
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
