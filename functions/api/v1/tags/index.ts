import { error, handleOptions, json, normalizeTags, supabase } from '../_shared';

export const onRequestGet = async ({ request, env }: { request: Request; env: Record<string, string | undefined> }) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    const db = supabase(env);
    const response = await fetch(`${db.base}/rest/v1/articles?select=tags&is_draft=eq.false&limit=10000`, { headers: db.headers });
    const text = await response.text();
    if (!response.ok) return error(request, 'UPSTREAM_ERROR', 'Unable to retrieve tags.', 502);
    const rows = text ? JSON.parse(text) : [];
    if (!Array.isArray(rows)) return error(request, 'INVALID_UPSTREAM_RESPONSE', 'The tag service returned an invalid response.', 502);

    const counts = new Map<string, number>();
    for (const row of rows as Array<{ tags?: unknown }>) {
      for (const tag of normalizeTags(row.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    const data = Array.from(counts.entries())
      .map(([name, articleCount]) => ({ name, articleCount }))
      .sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name, 'fa'));

    return json(request, { success: true, data });
  } catch (err) {
    console.error('API v1 tags failed:', err);
    return error(request, 'SERVER_ERROR', 'The tag API is temporarily unavailable.', 503);
  }
};
