import { error, handleOptions, json, supabase } from '../_shared';

export const onRequestGet = async ({ request, env }: { request: Request; env: Record<string, string | undefined> }) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    const db = supabase(env);
    const categoryResponse = await fetch(`${db.base}/rest/v1/article_categories?select=id,name,slug,description,is_active&is_active=eq.true&order=name.asc`, { headers: db.headers });
    const categoryText = await categoryResponse.text();
    if (!categoryResponse.ok) return error(request, 'UPSTREAM_ERROR', 'Unable to retrieve categories.', 502);
    const categories = categoryText ? JSON.parse(categoryText) : [];
    if (!Array.isArray(categories)) return error(request, 'INVALID_UPSTREAM_RESPONSE', 'The category service returned an invalid response.', 502);

    const articlesResponse = await fetch(`${db.base}/rest/v1/articles?select=category_id&is_draft=eq.false&limit=10000`, { headers: db.headers });
    const articlesText = await articlesResponse.text();
    const counts = new Map<string, number>();
    if (articlesResponse.ok) {
      const rows = articlesText ? JSON.parse(articlesText) : [];
      if (Array.isArray(rows)) for (const row of rows as Array<{ category_id?: string | null }>) {
        const id = String(row.category_id || '');
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
      }
    }

    return json(request, {
      success: true,
      data: categories.map((category: Record<string, unknown>) => ({
        id: String(category.id || ''),
        name: String(category.name || ''),
        slug: String(category.slug || ''),
        description: category.description ? String(category.description) : null,
        articleCount: counts.get(String(category.id || '')) || 0
      }))
    });
  } catch (err) {
    console.error('API v1 categories failed:', err);
    return error(request, 'SERVER_ERROR', 'The category API is temporarily unavailable.', 503);
  }
};
