import type { Env } from '../auth/_shared';
import { jsonResponse } from '../auth/_shared';

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function db(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

function normalizeArticle(item: any) {
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  const comments = Array.isArray(item?.comments) ? item.comments : [];
  const author = item?.author && typeof item.author === 'object' ? item.author : { name: 'Solmint Editorial Team', role: 'Editorial', avatar: '⚡' };
  return {
    id: item?.id,
    title: String(item?.title || ''),
    slug: String(item?.slug || ''),
    category: String(item?.category || ''),
    tags,
    summary: String(item?.summary || ''),
    content: String(item?.content || ''),
    coverImage: item?.cover_image || '/images/blog-og.jpg',
    coverImageAssetId: item?.cover_image_asset_id || '',
    videoUrl: item?.video_url || undefined,
    author,
    publishedAt: item?.published_at || item?.created_at || new Date().toISOString(),
    publishedAtJalali: item?.published_at_jalali || '',
    publishedAtGregorian: item?.published_at_gregorian || '',
    readTimeMinutes: Number(item?.read_time_minutes ?? 5),
    viewsCount: Number(item?.views_count ?? 0),
    comments,
    seoScore: Number(item?.seo_score ?? 90),
    isDraft: Boolean(item?.is_draft),
    language: item?.language === 'en' ? 'en' : 'fa',
    translationGroupId: item?.translation_group_id || null
  };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { base, headers } = db(env);
    const url = new URL(request.url);
    const language = url.searchParams.get('language') === 'en' ? 'en' : 'fa';
    const slug = url.searchParams.get('slug');
    const select = ['id','title','slug','category','tags','summary','content','cover_image','cover_image_asset_id','video_url','author','published_at','published_at_jalali','published_at_gregorian','read_time_minutes','views_count','comments','seo_score','is_draft','created_at','language','translation_group_id'].join(',');
    const params = new URLSearchParams({ select, language: `eq.${language}`, is_draft: 'eq.false', order: 'created_at.desc', limit: slug ? '1' : '50' });
    if (slug) params.set('slug', `eq.${slug}`);
    const response = await fetch(`${base}/rest/v1/articles?${params.toString()}`, { headers });
    const text = await response.text();
    if (!response.ok) return jsonResponse({ success: false, code: 'LOCALIZED_ARTICLE_LIST_FAILED', message: 'Localized article query failed.' }, 502);
    const rows = text ? JSON.parse(text) : [];
    return jsonResponse({ success: true, language, articles: Array.isArray(rows) ? rows.map(normalizeArticle) : [] });
  } catch (error) {
    console.error('Localized article API error:', error);
    return jsonResponse({ success: false, code: 'LOCALIZED_ARTICLE_SERVER_ERROR', message: 'Unable to load localized articles.' }, 503);
  }
};
