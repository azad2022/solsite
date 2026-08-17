import { CATEGORY_SLUGS, getCanonicalTagSlug } from '../src/config/articleTaxonomy';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type ArticleRow = {
  slug?: string | null;
  category_id?: string | null;
  category?: string | null;
  tags?: string[] | null;
  updated_at?: string | null;
  published_at?: string | null;
  published_at_gregorian?: string | null;
  is_draft?: boolean | number | string | null;
  language?: string | null;
};

type CategoryRow = { id?: string | null; slug?: string | null; name?: string | null; is_active?: boolean | null };

const BASE_URL = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function lastModified(article: ArticleRow): string | null {
  const raw = article.updated_at || article.published_at || article.published_at_gregorian;
  if (!raw) return null;
  const date = new Date(String(raw).replace(/\//g, '-'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

function isPublished(article: ArticleRow): boolean {
  return !(article.is_draft === true || article.is_draft === 1 || article.is_draft === 'true');
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const staticRoutes = [
    '/', '/solana-price', '/solana-wallet', '/wallet-analyzer', '/solana-token', '/solana-meme-coin',
    '/solana-nft', '/app-guide', '/security', '/download', '/blog', '/faq',
    '/tools/solana-token-tools', '/tools/solana-token-scanner', '/tools/token-2022-inspector',
    '/en', '/en/solana-price', '/en/blog'
  ];

  if (!key) return new Response('Sitemap configuration error', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

  const urls = new Map<string, string | null>();
  for (const route of staticRoutes) urls.set(`${BASE_URL}${route}`, null);
  const taxonomyCounts = new Map<string, { type: 'category' | 'tag'; slug: string; count: number }>();

  try {
    const categoriesEndpoint = `${supabaseUrl}/rest/v1/article_categories?select=id,slug,name,is_active`;
    const categoriesResponse = await fetch(categoriesEndpoint, { headers: authHeaders(key) });
    if (!categoriesResponse.ok) throw new Error(`categories query failed: ${categoriesResponse.status}`);
    const categoryRows = await categoriesResponse.json() as CategoryRow[];
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

    const endpoint = `${supabaseUrl}/rest/v1/articles?select=slug,category_id,category,tags,updated_at,published_at,published_at_gregorian,is_draft,language&is_draft=eq.false&order=updated_at.desc`;
    const response = await fetch(endpoint, { headers: authHeaders(key) });
    if (!response.ok) throw new Error(`articles query failed: ${response.status}`);
    const articles = await response.json() as ArticleRow[];
    if (!Array.isArray(articles)) throw new Error('articles query returned a non-array response');

    for (const article of articles) {
      if (!isPublished(article)) continue;
      const slug = String(article.slug || '').trim().replace(/^\/+|\/+$/g, '');
      if (!slug) continue;

      const language = article.language === 'en' ? 'en' : 'fa';
      const articlePath = language === 'en' ? `/en/articles/${encodeURIComponent(slug)}` : `/article/${encodeURIComponent(slug)}`;
      urls.set(`${BASE_URL}${articlePath}`, lastModified(article));

      if (language !== 'fa') continue;

      const categorySlug = article.category_id ? categorySlugs.get(String(article.category_id)) : '';
      if (categorySlug) {
        const keyName = `category:${categorySlug}`;
        const current = taxonomyCounts.get(keyName) || { type: 'category', slug: categorySlug, count: 0 };
        current.count += 1;
        taxonomyCounts.set(keyName, current);
      }

      for (const tag of Array.isArray(article.tags) ? article.tags : []) {
        const tagSlug = getCanonicalTagSlug(String(tag || '').trim());
        if (!tagSlug) continue;
        const keyName = `tag:${tagSlug}`;
        const current = taxonomyCounts.get(keyName) || { type: 'tag', slug: tagSlug, count: 0 };
        current.count += 1;
        taxonomyCounts.set(keyName, current);
      }
    }
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  for (const item of taxonomyCounts.values()) {
    if (item.count < 2) continue;
    urls.set(`${BASE_URL}/blog/${item.type}/${encodeURIComponent(item.slug)}`, null);
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const [url, lastmod] of urls) {
    xml += `  <url>\n    <loc>${xmlEscape(url)}</loc>\n`;
    if (lastmod) xml += `    <lastmod>${xmlEscape(lastmod)}</lastmod>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>\n';

  return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } });
};
