interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

type ArticleRow = {
  slug?: string | null;
  category?: string | null;
  tags?: string[] | null;
  updated_at?: string | null;
  published_at?: string | null;
  published_at_gregorian?: string | null;
  is_draft?: boolean | number | string | null;
};

const BASE_URL = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-ZwqYhdkVw_cOwO9OLt';

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('fa-IR')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export const onRequestGet = async ({ env }: { env: Env }) => {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const staticRoutes = [
    '/',
    '/solana-price',
    '/solana-wallet',
    '/solana-token',
    '/solana-meme-coin',
    '/solana-nft',
    '/app-guide',
    '/security',
    '/download',
    '/blog',
    '/faq'
  ];

  const urls = new Map<string, string | null>();
  staticRoutes.forEach(route => urls.set(`${BASE_URL}${route}`, null));
  const taxonomyCounts = new Map<string, { type: 'category' | 'tag'; slug: string; count: number }>();

  try {
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/articles?select=slug,category,tags,updated_at,published_at,published_at_gregorian,is_draft&is_draft=eq.false&order=updated_at.desc`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json'
      }
    });

    if (response.ok) {
      const articles = await response.json() as ArticleRow[];
      for (const article of articles) {
        if (!isPublished(article)) continue;
        const slug = String(article.slug || '').trim().replace(/^\/+|\/+$/g, '');
        if (!slug) continue;
        urls.set(`${BASE_URL}/article/${encodeURIComponent(slug)}`, lastModified(article));

        const category = String(article.category || '').trim();
        if (category) {
          const taxonomySlug = slugify(category);
          const key = `category:${taxonomySlug}`;
          const current = taxonomyCounts.get(key) || { type: 'category', slug: taxonomySlug, count: 0 };
          current.count += 1;
          taxonomyCounts.set(key, current);
        }

        for (const tag of Array.isArray(article.tags) ? article.tags : []) {
          const name = String(tag || '').trim();
          const taxonomySlug = slugify(name);
          if (!taxonomySlug) continue;
          const key = `tag:${taxonomySlug}`;
          const current = taxonomyCounts.get(key) || { type: 'tag', slug: taxonomySlug, count: 0 };
          current.count += 1;
          taxonomyCounts.set(key, current);
        }
      }
    }
  } catch {
    // Keep static URLs available even if the database is temporarily unavailable.
  }

  for (const item of taxonomyCounts.values()) {
    if (item.count < 2) continue;
    urls.set(`${BASE_URL}/blog/${item.type}/${encodeURIComponent(item.slug)}`, null);
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const [url, lastmod] of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${xmlEscape(url)}</loc>\n`;
    if (lastmod) xml += `    <lastmod>${xmlEscape(lastmod)}</lastmod>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>';

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'
    }
  });
};
