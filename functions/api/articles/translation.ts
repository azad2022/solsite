import type { Env } from '../auth/_shared';
import { jsonResponse } from '../auth/_shared';

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function db(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { base, headers } = db(env);
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId')?.trim();
    const language = url.searchParams.get('language') === 'en' ? 'en' : 'fa';
    if (!groupId) return jsonResponse({ success: false, code: 'TRANSLATION_GROUP_REQUIRED', message: 'Translation group is required.' }, 400);

    const select = 'id,slug,language,translation_group_id,is_draft';
    const params = new URLSearchParams({ select, translation_group_id: `eq.${groupId}`, language: `eq.${language}`, is_draft: 'eq.false', limit: '1' });
    const response = await fetch(`${base}/rest/v1/articles?${params.toString()}`, { headers });
    const text = await response.text();
    if (!response.ok) return jsonResponse({ success: false, code: 'TRANSLATION_LOOKUP_FAILED', message: 'Translation lookup failed.' }, 502);
    const rows = text ? JSON.parse(text) : [];
    const article = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return jsonResponse({
      success: true,
      language,
      article: article ? { id: article.id, slug: article.slug, language: article.language === 'en' ? 'en' : 'fa', translationGroupId: article.translation_group_id || groupId } : null
    });
  } catch (error) {
    console.error('Article translation API error:', error);
    return jsonResponse({ success: false, code: 'TRANSLATION_SERVER_ERROR', message: 'Unable to resolve article translation.' }, 503);
  }
};
