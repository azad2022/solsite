import { getAuthenticatedUser, getSessionToken, type Env } from './auth/_shared';

type GalleryEnv = Env & { SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string };
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' } });

const db = async (env: GalleryEnv, path: string, init: RequestInit = {}) => {
  const url = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) throw new Error('SUPABASE_SECRET_KEY_NOT_CONFIGURED');
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
};

const admin = async (request: Request, env: GalleryEnv) => {
  try {
    const user = await getAuthenticatedUser(env as any, request);
    return !!user && user.is_active !== false && (user.role === 'admin' || user.role === 'superadmin' || (Array.isArray(user.permissions) && user.permissions.map(String).includes('articles')));
  } catch { return false; }
};

const getSupabaseUrl = (env: GalleryEnv) => (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const normalizeGithubAssetId = (value: string) => {
  const id = value.trim();
  return /^github_[0-9a-f]{40}$/i.test(id) ? id.slice('github_'.length).toLowerCase() : null;
};

const ensureMediaAsset = async (env: GalleryEnv, asset: { publicUrl: string; path: string; sha?: string | null; filename: string; owner: string; repository: string; branch: string }) => {
  const publicUrl = asset.publicUrl.trim();
  const existingResponse = await db(env, `media_assets?public_url=eq.${encodeURIComponent(publicUrl)}&select=id&limit=1`);
  const existing = await existingResponse.json().catch(() => []);
  if (existingResponse.ok && Array.isArray(existing) && existing[0]?.id) return String(existing[0].id);

  const id = `media_${await sha256(publicUrl)}`;
  const insertResponse = await db(env, 'media_assets', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      id,
      provider: 'github',
      github_owner: asset.owner,
      github_repository: asset.repository,
      branch: asset.branch,
      path: asset.path,
      filename: asset.filename,
      public_url: publicUrl,
      mime_type: `image/${(asset.filename.split('.').pop() || 'webp').toLowerCase()}`,
      file_size: 0,
      width: 0,
      height: 0,
      sha: asset.sha || null,
      original_filename: asset.filename,
      alt_text: '',
      title: asset.filename,
    }),
  });
  const inserted = await insertResponse.json().catch(() => []);
  if (insertResponse.ok && Array.isArray(inserted) && inserted[0]?.id) return String(inserted[0].id);

  const raceResponse = await db(env, `media_assets?id=eq.${encodeURIComponent(id)}&select=id&limit=1`);
  const race = await raceResponse.json().catch(() => []);
  if (raceResponse.ok && Array.isArray(race) && race[0]?.id) return String(race[0].id);
  throw new Error('MEDIA_ASSET_REGISTRATION_FAILED');
};

const resolveFromAuthenticatedMediaService = async (env: GalleryEnv, request: Request, githubSha: string) => {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) throw new Error('MEDIA_ADMIN_SESSION_MISSING');
  const response = await fetch(`${getSupabaseUrl(env)}/functions/v1/github-media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-solmint-session': sessionToken,
      'x-media-gateway-version': '4',
    },
    body: JSON.stringify({ action: 'list' }),
  });
  const data = await response.json().catch(() => null) as any;
  if (!response.ok || !data?.success) {
    const status = response.status || 502;
    throw new Error(status === 403 ? 'GITHUB_MEDIA_SERVICE_FORBIDDEN' : `GITHUB_MEDIA_SERVICE_${status}`);
  }
  const asset = Array.isArray(data.assets)
    ? data.assets.find((item: any) => String(item?.sha || '').toLowerCase() === githubSha)
    : null;
  if (!asset?.path || !asset?.publicUrl) throw new Error('MEDIA_ASSET_NOT_FOUND');
  return ensureMediaAsset(env, {
    publicUrl: String(asset.publicUrl),
    path: String(asset.path),
    sha: String(asset.sha || githubSha),
    filename: String(asset.filename || String(asset.path).split('/').pop() || asset.path),
    owner: String(asset.githubOwner || data?.config?.githubOwner || 'azad2022'),
    repository: String(asset.githubRepository || data?.config?.githubRepository || 'solsite'),
    branch: String(asset.branch || data?.config?.branch || 'main'),
  });
};

const resolveMediaAssetIds = async (env: GalleryEnv, request: Request, mediaAssetIds: string[]) => {
  if (!mediaAssetIds.length) return [];
  const resolved: string[] = [];
  for (const id of mediaAssetIds) {
    const exactResponse = await db(env, `media_assets?id=eq.${encodeURIComponent(id)}&select=id&limit=1`);
    const exact = await exactResponse.json().catch(() => []);
    if (exactResponse.ok && Array.isArray(exact) && exact[0]?.id) {
      resolved.push(String(exact[0].id));
      continue;
    }
    const githubSha = normalizeGithubAssetId(id);
    if (!githubSha) throw new Error('MEDIA_ASSET_NOT_FOUND');
    resolved.push(await resolveFromAuthenticatedMediaService(env, request, githubSha));
  }
  return Array.from(new Set(resolved));
};

export const onRequest = async ({ request, env }: { request: Request; env: GalleryEnv }) => {
  if (!(await admin(request, env))) return json({ success: false, message: 'دسترسی مدیریت تصاویر دسته‌بندی مجاز نیست.' }, 401);
  try {
    if (request.method === 'GET') {
      const categoriesResponse = await db(env, 'article_categories?select=id,name,default_media_asset_id,default_media_url,default_media_mode,default_media_interval_ms&order=sort_order.asc,name.asc');
      const categories = await categoriesResponse.json().catch(() => []);
      if (!categoriesResponse.ok || !Array.isArray(categories)) return json({ success: false, message: 'دریافت تنظیمات تصاویر دسته‌بندی ناموفق بود.' }, 502);
      const relationResponse = await db(env, 'category_default_media_assets?select=category_id,media_asset_id,sort_order&order=sort_order.asc,created_at.asc');
      const relations = await relationResponse.json().catch(() => []);
      if (!relationResponse.ok || !Array.isArray(relations)) return json({ success: false, message: 'دریافت مجموعه تصاویر دسته‌بندی ناموفق بود.' }, 502);
      const assetIds = Array.from(new Set(relations.map((r: any) => String(r.media_asset_id || '')).filter(Boolean)));
      const assetsResponse = assetIds.length ? await db(env, `media_assets?id=in.(${assetIds.map(encodeURIComponent).join(',')})&select=id,public_url,filename,width,height,alt_text,title`) : null;
      const assets = assetsResponse ? await assetsResponse.json().catch(() => []) : [];
      const assetMap = new Map((Array.isArray(assets) ? assets : []).map((a: any) => [String(a.id), a]));
      return json({ success: true, categories: categories.map((category: any) => ({ ...category, media_assets: relations.filter((r: any) => r.category_id === category.id).sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order)).map((r: any) => assetMap.get(String(r.media_asset_id))).filter(Boolean) })) });
    }

    if (request.method !== 'POST') return json({ success: false, message: 'متد درخواست پشتیبانی نمی‌شود.' }, 405);
    const body = await request.json().catch(() => null) as any;
    const categoryId = String(body?.categoryId || '').trim();
    const mediaAssetIds = Array.isArray(body?.mediaAssetIds) ? body.mediaAssetIds.map(String).map((id: string) => id.trim()).filter(Boolean) : [];
    const mode = ['single', 'random', 'slideshow'].includes(body?.mode) ? body.mode : 'single';
    const intervalMs = Number(body?.intervalMs || 4500);
    if (!categoryId) return json({ success: false, message: 'شناسه دسته‌بندی ارسال نشده است.' }, 400);
    if (mediaAssetIds.length > 20) return json({ success: false, message: 'حداکثر ۲۰ تصویر برای هر دسته‌بندی مجاز است.' }, 400);
    if (!Number.isInteger(intervalMs) || intervalMs < 1500 || intervalMs > 20000) return json({ success: false, message: 'فاصله اسلاید باید بین ۱.۵ تا ۲۰ ثانیه باشد.' }, 400);

    const resolvedMediaAssetIds = await resolveMediaAssetIds(env, request, mediaAssetIds);
    const response = await db(env, 'rpc/set_category_default_media_gallery', {
      method: 'POST',
      body: JSON.stringify({ p_category_id: categoryId, p_media_asset_ids: resolvedMediaAssetIds, p_mode: mode, p_interval_ms: intervalMs })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return json({ success: false, message: 'ذخیره مجموعه تصاویر دسته‌بندی ناموفق بود.', details: data }, response.status >= 400 ? response.status : 502);
    const payload = Array.isArray(data) ? data[0] : data;
    return json({ success: true, ...payload });
  } catch (error: any) {
    const internal = error?.message || 'UNKNOWN_ERROR';
    const message = internal === 'SUPABASE_SECRET_KEY_NOT_CONFIGURED'
      ? 'کلید امن دیتابیس در محیط production تنظیم نشده است.'
      : internal === 'MEDIA_ADMIN_SESSION_MISSING'
        ? 'نشست مدیر در درخواست رسانه ارسال نشده است. لطفاً دوباره وارد پنل شوید.'
        : internal === 'MEDIA_ASSET_NOT_FOUND'
          ? 'تصویر انتخاب‌شده در مخزن رسانه شناسایی نشد. کتابخانه تصاویر را تازه‌سازی کنید.'
          : internal === 'MEDIA_ASSET_REGISTRATION_FAILED'
            ? 'ثبت تصویر در کتابخانه رسانه ناموفق بود.'
            : internal === 'GITHUB_MEDIA_SERVICE_FORBIDDEN'
              ? 'سرویس امن کتابخانه تصاویر اجازه دسترسی به مخزن GitHub را ندارد.'
              : 'سرویس تصاویر دسته‌بندی در پردازش درخواست با خطا مواجه شد.';
    return json({ success: false, message, errorCode: internal }, 500);
  }
};
