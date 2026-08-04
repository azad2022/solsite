/**
 * Utility to generate clean, SEO-friendly article slugs from Persian or English titles
 */
export function generateSlugFromTitle(title: string): string {
  if (!title || !title.trim()) return `article-${Date.now()}`;

  let clean = title
    .trim()
    // Strip meta commentary prefixes
    .replace(/^(مقاله\s*سئو\s*شده|آموزش\s*سئو\s*شده|عنوان\s*سئو\s*شده|سئو\s*شده|مقاله\s*سئوشده|آموزش\s*سئوشده|مقاله|آموزش|عنوان)\s*[:：\-–—]?\s*/gi, '')
    // Strip any AI / model brand mentions
    .replace(/deepseek|دیپ\s*سیک|دیپ‌سیک|هوش\s*مصنوعی/gi, '')
    // Keep letters, Persian characters (\u0600-\u06FF), digits, spaces, hyphens
    .replace(/[^\w\u0600-\u06FF\s\-]+/g, '')
    // Replace whitespace and underscores with hyphen
    .replace(/[\s_]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Trim hyphens from start and end
    .replace(/^-|-$/g, '');

  return clean || `article-${Date.now()}`;
}

export const DEFAULT_ARTICLE_AUTHOR = {
  name: 'تیم تحریریه سول‌مینت',
  role: 'تحلیل‌گر ارشد وب۳ و کریپتو',
  avatar: '/avatars/editor.svg'
};
