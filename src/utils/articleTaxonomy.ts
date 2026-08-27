import {
  buildTaxonomyUrl,
  getArticleCategoryTaxonomy,
  getArticleTagTaxonomy as getArticleTagTaxonomyUnsafe,
} from '../config/articleTaxonomy';

export type { ArticleTaxonomyItem } from '../config/articleTaxonomy';

export { buildTaxonomyUrl, getArticleCategoryTaxonomy };

/**
 * Defensive public wrapper for article tag taxonomy.
 * CMS/API payloads can contain null or malformed tag values; taxonomy
 * resolution must never crash the entire React tree because of one record.
 */
export function getArticleTagTaxonomy(tags?: unknown): ReturnType<typeof getArticleTagTaxonomyUnsafe> {
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .map(tag => String(tag ?? '').trim())
    .filter(Boolean);
  try {
    return getArticleTagTaxonomyUnsafe(normalized);
  } catch {
    return [];
  }
}
