import { generateSlugFromTitle } from './slugUtils';

export interface ArticleTaxonomyItem {
  slug: string;
  name: string;
  type: 'category' | 'tag';
}

const CATEGORY_SLUGS: Record<string, string> = {
  'آموزش سولانا': 'solana',
  'توسعه وب۳': 'web3-development',
  'امنیت': 'security',
  'اخبار و تحلیل': 'crypto-news-analysis',
  'آموزش ساخت میم کوین': 'meme-coin',
  'آموزش ساخت NFT': 'nft',
  'کیف پول سولانا': 'solana-wallet',
  'ترید': 'trading',
  'پراپ تریدینگ': 'prop-trading'
};

export const getArticleCategoryTaxonomy = (category?: string): ArticleTaxonomyItem | null => {
  const name = category?.trim();
  if (!name) return null;
  return { slug: CATEGORY_SLUGS[name] || generateSlugFromTitle(name), name, type: 'category' };
};

export const getArticleTagTaxonomy = (tags: string[] = []): ArticleTaxonomyItem[] =>
  Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean))).map(tag => ({
    slug: generateSlugFromTitle(tag),
    name: tag,
    type: 'tag'
  }));

export const buildTaxonomyUrl = (item: ArticleTaxonomyItem): string =>
  item.type === 'category' ? `/blog/category/${item.slug}` : `/blog/tag/${item.slug}`;
