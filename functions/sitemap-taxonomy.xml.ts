import { CATEGORY_SLUGS } from '../src/config/articleTaxonomy';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type ArticleRow = {
  category_id?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  published_at_gregorian?: string | null;
  is_draft?: boolean | number | string | null;
};

type CategoryRow = { id?: string | null; slug?: string | null; name?: string | null; is_active?: boolean | null };
type TaxonomyItem = { slug: string; count: number; lastmod: string | null };

const BASE_URL = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const INDEXABLE_CATEGORY_MIN_ARTICLES = 2;

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isPublished(article: ArticleRow): boolean {
  return !(article.is_draft === true || article.is_draft === 1 || article.is_draft === 'true');
}

function lastModified(article: ArticleRow): string | null {
  const raw = article.updated_at || article.published_at || article.published_at_gregorian;
  if (!raw) return null;
  const date = new Date(String(raw).replace(/\//g, '-'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

function newer(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!key) return new Response('Sitemap configuration error', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  try {
    const categoryResponse = await fetch(`${supabaseUrl}/rest/v1/article_categories?select=id,slug,name,is_active`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
    });
    if (!categoryResponse.ok) throw new Error(`categories query failed: ${categoryResponse.status}`);
    const categoryRows = await categoryResponse.json() as CategoryRow[];
    const categorySlugs = new Map<string, string>();
    for (const category of Array.isArray(categoryRows) ? categoryRows : []) {
      const id = String(category.id || '').trim();
      const name = String(category.name || '').trim();
      const dbSlug = String(category.slug || '').trim();
      if (id && category.is_active !== false) {
        const canonical = CATEGORY_SLUGS[name] || dbSlug;
        if (canonical) categorySlugs.set(id, canonical);
      }
    }

    const articleResponse = await fetch(`${supabaseUrl}/rest/v1/articles?select=category_id,updated_at,published_at,published_at_gregorian,is_draft&is_draft=eq.false&order=updated_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
    });
    if (!articleResponse.ok) throw new Error(`articles query failed: ${articleResponse.status}`);
    const articles = await articleResponse.json() as ArticleRow[];
    if (!Array.isArray(articles)) throw new Error('articles query returned a non-array response');

    const categories = new Map<string, TaxonomyItem>();
    for (const article of articles) {
      if (!isPublished(article)) continue;
      const categorySlug = article.category_id ? categorySlugs.get(String(article.category_id)) : '';
      if (!categorySlug) continue;

      const current = categories.get(categorySlug) || { slug: categorySlug, count: 0, lastmod: null };
      current.count += 1;
      current.lastmod = newer(current.lastmod, lastModified(article));
      categories.set(categorySlug, current);
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    for (const item of categories.values()) {
      if (item.count < INDEXABLE_CATEGORY_MIN_ARTICLES) continue;
      const url = `${BASE_URL}/blog/category/${encodeURIComponent(item.slug)}`;
      xml += `  <url>\n    <loc>${xmlEscape(url)}</loc>\n`;
      if (item.lastmod) xml += `    <lastmod>${xmlEscape(item.lastmod)}</lastmod>\n`;
      xml += '  </url>\n';
    }
    xml += '</urlset>\n';

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Taxonomy sitemap generation failed:', error);
    return new Response('Taxonomy sitemap temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
};
