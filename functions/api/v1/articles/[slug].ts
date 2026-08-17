import { error, handleOptions, json, normalizeArticle, relatedFromArticle, isValidSlug, supabase } from '../_shared';

const DETAIL_SELECT = [
  'id','title','slug','category','category_id','tags','summary','content','cover_image','cover_image_asset_id',
  'video_url','author','published_at','published_at_jalali','published_at_gregorian','read_time_minutes','views_count','comments','created_at','updated_at'
].join(',');
const RELATED_SELECT = 'id,title,slug,category,tags,summary,cover_image,published_at,read_time_minutes,author,created_at';

type Context = { request: Request; env: Record<string, string | undefined>; params: { slug?: string } };

export const onRequestGet = async ({ request, env, params }: Context) => {
  const options = handleOptions(request);
  if (options) return options;

  const slug = decodeURIComponent(String(params.slug || '')).trim();
  if (!isValidSlug(slug)) return error(request, 'INVALID_SLUG', 'Invalid article slug.', 400);

  try {
    const db = supabase(env);
    const articleUrl = `${db.base}/rest/v1/articles?select=${encodeURIComponent(DETAIL_SELECT)}&slug=eq.${encodeURIComponent(slug)}&is_draft=eq.false&limit=1`;
    const response = await fetch(articleUrl, { headers: db.headers });
    const text = await response.text();
    if (!response.ok) return error(request, 'UPSTREAM_ERROR', 'Unable to retrieve the article.', 502);
    const rows = text ? JSON.parse(text) : [];
    if (!Array.isArray(rows) || !rows[0]) return error(request, 'ARTICLE_NOT_FOUND', 'Article not found.', 404);

    const row = rows[0] as Record<string, unknown>;
    const article = normalizeArticle(row);
    const categoryId = row.category_id ? String(row.category_id) : '';
    let relatedArticles: ReturnType<typeof relatedFromArticle>[] = [];

    if (categoryId) {
      const relatedUrl = `${db.base}/rest/v1/articles?select=${encodeURIComponent(RELATED_SELECT)}&category_id=eq.${encodeURIComponent(categoryId)}&id=neq.${encodeURIComponent(article.id)}&is_draft=eq.false&order=published_at.desc&limit=5`;
      const relatedResponse = await fetch(relatedUrl, { headers: db.headers });
      if (relatedResponse.ok) {
        const relatedRows = await relatedResponse.json();
        if (Array.isArray(relatedRows)) relatedArticles = relatedRows.map((item: Record<string, unknown>) => relatedFromArticle(item));
      }
    }

    return json(request, { success: true, data: { ...article, relatedArticles } });
  } catch (err) {
    console.error('API v1 article detail failed:', err);
    return error(request, 'SERVER_ERROR', 'The article API is temporarily unavailable.', 503);
  }
};
