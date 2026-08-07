export interface ArticleTaxonomyItem {
  slug: string;
  name: string;
  type: 'category' | 'tag';
}

const slugify = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('fa-IR')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const getArticleCategoryTaxonomy = (category?: string): ArticleTaxonomyItem | null => {
  if (!category?.trim()) return null;
  return { slug: slugify(category), name: category.trim(), type: 'category' };
};

export const getArticleTagTaxonomy = (tags: string[] = []): ArticleTaxonomyItem[] =>
  Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean))).map(tag => ({
    slug: slugify(tag),
    name: tag,
    type: 'tag'
  }));

export const buildTaxonomyUrl = (item: ArticleTaxonomyItem): string =>
  item.type === 'category' ? `/blog/category/${item.slug}` : `/blog/tag/${item.slug}`;
