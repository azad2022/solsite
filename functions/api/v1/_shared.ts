type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
export const API_VERSION = '1';
export const SITE_ORIGIN = 'https://solmint.ir';
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

export type ArticlePublic = {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  summary: string;
  content: string | null;
  coverImage: string | null;
  coverImageAssetId: string | null;
  videoUrl: string | null;
  author: { name: string; role?: string; avatar?: string } | null;
  publishedAt: string | null;
  publishedAtJalali: string | null;
  publishedAtGregorian: string | null;
  readTimeMinutes: number;
  viewsCount: number;
  commentsCount: number | null;
  relatedArticles?: RelatedArticle[];
};

export type RelatedArticle = Pick<ArticlePublic, 'id' | 'title' | 'slug' | 'summary' | 'coverImage' | 'category' | 'publishedAt'>;

export function supabase(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!key) throw new Error('Supabase API configuration is missing.');
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  return {
    base,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    }
  };
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = origin === 'https://solmint.ir' || origin === 'https://www.solmint.ir';
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://solmint.ir',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

export function handleOptions(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function json(request: Request, body: unknown, status = 200, cacheControl = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Solmint-API-Version': API_VERSION,
    ...corsHeaders(request)
  });
  return new Response(JSON.stringify(body), { status, headers });
}

export function error(request: Request, code: string, message: string, status: number, details?: Record<string, unknown>): Response {
  return json(request, { success: false, error: { code, message, ...(details ? { details } : {}) } }, status, 'no-store');
}

export function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
  return [];
}

export function normalizeAuthor(value: unknown): ArticlePublic['author'] {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const name = String(item.name || '').trim();
  if (!name) return null;
  return {
    name,
    ...(item.role ? { role: String(item.role) } : {}),
    ...(item.avatar ? { avatar: String(item.avatar) } : {})
  };
}

export function normalizeArticle(row: Record<string, unknown>, includeContent = false): ArticlePublic {
  const comments = Array.isArray(row.comments) ? row.comments : [];
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    category: String(row.category || 'آموزش سولانا'),
    tags: normalizeTags(row.tags),
    summary: String(row.summary || ''),
    content: includeContent ? String(row.content || '') : null,
    coverImage: row.cover_image ? String(row.cover_image) : null,
    coverImageAssetId: row.cover_image_asset_id ? String(row.cover_image_asset_id) : null,
    videoUrl: row.video_url ? String(row.video_url) : null,
    author: normalizeAuthor(row.author),
    publishedAt: row.published_at ? String(row.published_at) : null,
    publishedAtJalali: row.published_at_jalali ? String(row.published_at_jalali) : null,
    publishedAtGregorian: row.published_at_gregorian ? String(row.published_at_gregorian) : null,
    readTimeMinutes: Number(row.read_time_minutes ?? 5),
    viewsCount: Number(row.views_count ?? 0),
    commentsCount: Array.isArray(row.comments) ? comments.length : null
  };
}

export function relatedFromArticle(row: Record<string, unknown>): RelatedArticle {
  const article = normalizeArticle(row, false);
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    coverImage: article.coverImage,
    category: article.category,
    publishedAt: article.publishedAt
  };
}

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= 200 && /^[\p{L}\p{N}._-]+$/u.test(value);
}
