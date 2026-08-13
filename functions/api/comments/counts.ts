import { jsonResponse, type Env } from '../auth/_shared';

interface CommentsEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function getDb(env: CommentsEnv) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

function parseIds(raw: string): string[] {
  return [...new Set(raw.split(',').map(value => value.trim()).filter(value => value.length > 0 && value.length <= 200))].slice(0, 100);
}

export const onRequestGet = async ({ request, env }: { request: Request; env: CommentsEnv }) => {
  try {
    const ids = parseIds(new URL(request.url).searchParams.get('articleIds') || '');
    if (!ids.length) return jsonResponse({ success: false, message: 'شناسه مقالات الزامی است.', counts: {} }, 400);

    const { base, headers } = getDb(env);
    const articleFilter = ids.map(id => `article_id.eq.${encodeURIComponent(id)}`).join(',');
    const response = await fetch(
      `${base}/rest/v1/comments?select=article_id&approved=eq.true&or=(${articleFilter})&limit=10000`,
      { headers }
    );
    const text = await response.text();
    if (!response.ok) {
      console.error('Comment counts query failed:', response.status, text.slice(0, 500));
      return jsonResponse({ success: false, message: 'دریافت تعداد دیدگاه‌ها از دیتابیس ناموفق بود.', counts: {} }, 502);
    }

    const rows = text ? JSON.parse(text) : [];
    const counts: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const id = String(row?.article_id || '');
        if (id in counts) counts[id] += 1;
      }
    }

    return jsonResponse({ success: true, counts }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  } catch (error) {
    console.error('Comment counts error:', error);
    return jsonResponse({ success: false, message: 'خطا در دریافت تعداد دیدگاه‌ها.', counts: {} }, 500);
  }
};
