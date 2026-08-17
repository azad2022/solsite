import { generateSlugFromTitle } from '../utils/slugUtils';

export type ArticleTaxonomyType = 'category' | 'tag';

export interface ArticleTaxonomyItem {
  slug: string;
  name: string;
  type: ArticleTaxonomyType;
}

// Single source of truth for public taxonomy URLs.
// These slugs are part of the public URL contract and must not be derived
// differently by the client, SSR, sitemap, or API layers.
export const CATEGORY_SLUGS: Record<string, string> = {
  'آموزش سولانا': 'solana',
  'پروژه های سولانا': 'solana-projects',
  'توسعه وب۳': 'web3-development',
  'امنیت': 'security',
  'اخبار و تحلیل': 'crypto-news-analysis',
  'آموزش ساخت میم کوین': 'meme-coin',
  'آموزش ساخت NFT': 'nft',
  'کیف پول سولانا': 'solana-wallet',
  'ترید': 'trading',
  'پراپ تریدینگ': 'prop-trading',
  'میم کوین': 'meme-coins'
};

export function getArticleCategoryTaxonomy(category?: string | null): ArticleTaxonomyItem | null {
  const name = String(category || '').trim();
  if (!name) return null;
  return { slug: CATEGORY_SLUGS[name] || generateSlugFromTitle(name), name, type: 'category' };
}

export function getArticleTagTaxonomy(tags: string[] = []): ArticleTaxonomyItem[] {
  return Array.from(new Set(tags.map(tag => String(tag || '').trim()).filter(Boolean))).map(tag => ({
    slug: generateSlugFromTitle(tag),
    name: tag,
    type: 'tag'
  }));
}

export function buildTaxonomyUrl(item: ArticleTaxonomyItem): string {
  return item.type === 'category' ? `/blog/category/${encodeURIComponent(item.slug)}` : `/blog/tag/${encodeURIComponent(item.slug)}`;
}

export function getCanonicalCategorySlug(slug: string): string | null {
  const normalized = decodeURIComponent(String(slug || '')).trim().toLowerCase();
  const entry = Object.entries(CATEGORY_SLUGS).find(([, value]) => value === normalized);
  return entry ? entry[1] : null;
}

export function findCategoryNameBySlug(slug: string): string | null {
  const normalized = decodeURIComponent(String(slug || '')).trim().toLowerCase();
  const entry = Object.entries(CATEGORY_SLUGS).find(([, value]) => value === normalized);
  return entry ? entry[0] : null;
}

export function getCanonicalTagSlug(tag: string): string {
  return generateSlugFromTitle(String(tag || '').trim());
}
