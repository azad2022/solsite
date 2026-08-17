import { error, handleOptions, json, normalizeArticle, parsePositiveInt, supabase } from '../_shared';

const SELECT = [
  'id','title','slug','category','tags','summary','content','cover_image','cover_image_asset_id',
  'video_url','author','published_at','published_at_jalali','published_at_gregorian',
  'read_time_minutes','views_count','comments','created_at','updated_at'
].join(',');

export const onRequestGet = async ({ request, env }: { request: Request; env: Record<string, string | undefined> }) => {
  const options = handleOptions(request);
  if (options) return options;

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 100000);
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 50);
  const search = (url.searchParams.get('search') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const tag = (url.searchParams.get('tag') || '').trim();
  const sort = (url.searchParams.get('sort') || 'published_at').trim();
  const order = (url.searchParams.get('order') || 'desc').trim().toLowerCase();

  if (search.length > 100) return error(request, 'INVALID_SEARCH', 'Search query is too long.', 400);
  if (category.length > 120) return error(request, 'INVALID_CATEGORY', 'Category filter is too long.', 400);
  if (tag.length > 120) return error(request, 'INVALID_TAG', 'Tag filter is too long.', 400);

  const allowedSorts: Record<string, string> = {
    published_at: 'published_at',
    created_at: 'created_at',
    updated_at: 'updated_at',
    views: 'views_count'
  };
  const sortColumn = allowedSorts[sort];
  if (!sortColumn) return error(request, 'INVALID_SORT', 'Unsupported sort field.', 400, { allowed: Object.keys(allowedSorts) });
  if (order !== 'asc' && order !== 'desc') return error(request, 'INVALID_ORDER', 'Order must be asc or desc.', 400);

  try {
    const db = supabase(env);
    const filters: string[] = ['is_draft=eq.false'];
    if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
    if (tag) filters.push(`tags=cs.${encodeURIComponent(`{${tag}}`)}`);
    if (search) {
      const pattern = `*${search.replace(/[,*()]/g, ' ').replace(/\s+/g, ' ').trim()}*`;
      const or = `(title.ilike.${pattern},summary.ilike.${pattern},content.ilike.${pattern})`;
      filters.push(`or=${encodeURIComponent(or)}`);
    }

    const from = (page - 1) * limit;
    const endpoint = `${db.base}/rest/v1/articles?select=${encodeURIComponent(SELECT)}&${filters.join('&')}&order=${sortColumn}.${order}&offset=${from}&limit=${limit}`;
    const response = await fetch(endpoint, { headers: { ...db.headers, Prefer: 'count=exact' } });
    const text = await response.text();
    if (!response.ok) return error(request, 'UPSTREAM_ERROR', 'Unable to retrieve articles.', 502);
    const rows = text ? JSON.parse(text) : [];
    if (!Array.isArray(rows)) return error(request, 'INVALID_UPSTREAM_RESPONSE', 'The article service returned an invalid response.', 502);

    const contentRange = response.headers.get('content-range') || '';
    const totalMatch = contentRange.match(/\/(\d+)$/);
    const total = totalMatch ? Number(totalMatch[1]) : null;
    const pages = total === null ? null : Math.ceil(total / limit);

    return json(request, {
      success: true,
      data: rows.map((row: Record<string, unknown>) => normalizeArticle(row)),
      pagination: { page, limit, total, pages, hasNext: total === null ? rows.length === limit : page < pages, hasPrevious: page > 1 },
      filters: { search: search || null, category: category || null, tag: tag || null, sort, order }
    });
  } catch (err) {
    console.error('API v1 articles list failed:', err);
    return error(request, 'SERVER_ERROR', 'The article API is temporarily unavailable.', 503);
  }
};
