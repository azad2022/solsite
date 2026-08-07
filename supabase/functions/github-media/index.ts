import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type MediaConfig = {
  provider: 'github';
  githubOwner: string;
  githubRepository: string;
  branch: string;
  basePath: string;
  connectionStatus?: 'connected' | 'disconnected' | 'untested';
  lastTestAt?: string | null;
};

type DiagnosticStatus = 'passed' | 'failed' | 'warning';

type DiagnosticStep = {
  name: string;
  stage: string;
  status: DiagnosticStatus;
  message: string;
  details?: Record<string, unknown>;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GITHUB_TOKEN = (Deno.env.get('GITHUB_MEDIA_TOKEN') || '').trim();
const ADMIN_PASSCODE = (Deno.env.get('MEDIA_ADMIN_PASSCODE') || '').trim();

const DEFAULT_CONFIG: MediaConfig = {
  provider: 'github',
  githubOwner: 'azad2022',
  githubRepository: 'solsite',
  branch: 'main',
  basePath: 'public/media/articles/',
  connectionStatus: 'untested',
  lastTestAt: null,
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-passcode',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function nowIso() { return new Date().toISOString(); }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorPayload(errorCode: string, stage: string, message: string, details: Record<string, unknown> = {}) {
  return { success: false, errorCode, stage, message, details, timestamp: nowIso() };
}

function okPayload<T extends Record<string, unknown>>(data: T) {
  return { success: true, timestamp: nowIso(), ...data };
}

function cleanBasePath(value: string) {
  const cleaned = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  return cleaned ? `${cleaned}/` : '';
}

function cleanRepoPart(value: string) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_.-]/g, '');
}

function normalizeConfig(input: any): MediaConfig {
  return {
    provider: 'github',
    githubOwner: cleanRepoPart(input?.githubOwner || DEFAULT_CONFIG.githubOwner),
    githubRepository: cleanRepoPart(input?.githubRepository || DEFAULT_CONFIG.githubRepository),
    branch: String(input?.branch || DEFAULT_CONFIG.branch).trim().replace(/[^A-Za-z0-9._\/-]/g, ''),
    basePath: cleanBasePath(input?.basePath || DEFAULT_CONFIG.basePath),
    connectionStatus: input?.connectionStatus || 'untested',
    lastTestAt: input?.lastTestAt ?? null,
  };
}

function isImagePath(path: string) {
  const lower = path.toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) if (lower.endsWith(ext)) return true;
  return false;
}

function safeRelativePath(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..') || normalized.includes('//')) return null;
  return normalized;
}

function githubHeaders() {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_MEDIA_TOKEN is not configured on the server.');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Solmint-GitHub-Media-Gateway',
  };
}

async function githubFetch(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com${path}`, { ...init, headers: { ...githubHeaders(), ...(init.headers || {}) } });
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Supabase service environment is not configured.');
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function maybeLog(level: 'info' | 'warn' | 'error', service: string, stage: string, errorCode: string, message: string, details: Record<string, unknown> = {}) {
  try {
    await supabaseFetch('media_system_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ level, service, stage, error_code: errorCode, message, details }),
    });
  } catch {
    // logging must not fail the request
  }
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function getStoredConfig() {
  const response = await supabaseFetch('media_config?id=eq.active_config&select=*');
  if (!response.ok) return { ...DEFAULT_CONFIG };
  const rows = await parseJsonResponse(response);
  return normalizeConfig(Array.isArray(rows) && rows[0] ? rows[0] : DEFAULT_CONFIG);
}

async function saveStoredConfig(config: any) {
  const normalized = normalizeConfig(config);
  const response = await supabaseFetch('media_config?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 'active_config', ...normalized, last_test_at: normalized.connectionStatus === 'connected' ? nowIso() : null }),
  });
  if (!response.ok) throw new Error(`Supabase media config save failed (${response.status}).`);
  return normalized;
}

async function saveAsset(asset: any) {
  const row = {
    id: asset.id,
    provider: 'github',
    github_owner: asset.githubOwner,
    github_repository: asset.githubRepository,
    branch: asset.branch,
    path: asset.path,
    filename: asset.filename,
    public_url: asset.publicUrl,
    mime_type: asset.mimeType,
    file_size: asset.fileSize || 0,
    width: asset.width || 0,
    height: asset.height || 0,
    sha: asset.sha || null,
    original_filename: asset.originalFilename || asset.filename,
    alt_text: asset.altText || '',
    title: asset.title || '',
    updated_at: nowIso(),
  };
  const response = await supabaseFetch('media_assets?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Supabase media asset save failed (${response.status}).`);
}

async function deleteAssetMetadata(id: string) {
  if (!id) return;
  await supabaseFetch(`media_assets?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function loadAssetMetadata(owner: string, repo: string, branch: string) {
  const query = new URLSearchParams({ github_owner: `eq.${owner}`, github_repository: `eq.${repo}`, branch: `eq.${branch}`, select: '*', limit: '1000' });
  const response = await supabaseFetch(`media_assets?${query.toString()}`);
  if (!response.ok) return [];
  const rows = await parseJsonResponse(response);
  return Array.isArray(rows) ? rows : [];
}

function toAsset(row: any, fallback?: any) {
  return {
    id: row?.id || fallback?.id,
    provider: 'github',
    githubOwner: row?.github_owner || fallback?.githubOwner,
    githubRepository: row?.github_repository || fallback?.githubRepository,
    branch: row?.branch || fallback?.branch,
    path: row?.path || fallback?.path,
    filename: row?.filename || fallback?.filename,
    publicUrl: row?.public_url || fallback?.publicUrl,
    mimeType: row?.mime_type || fallback?.mimeType || 'image/*',
    fileSize: row?.file_size || fallback?.fileSize || 0,
    width: row?.width || fallback?.width || 0,
    height: row?.height || fallback?.height || 0,
    sha: row?.sha || fallback?.sha,
    createdAt: row?.created_at || fallback?.createdAt || nowIso(),
    updatedAt: row?.updated_at || fallback?.updatedAt,
    originalFilename: row?.original_filename || fallback?.originalFilename || fallback?.filename,
    altText: row?.alt_text || fallback?.altText || '',
    title: row?.title || fallback?.title || fallback?.filename,
  };
}

function authPasscode(req: Request) {
  const supplied = (req.headers.get('x-admin-passcode') || '').trim();
  return Boolean(ADMIN_PASSCODE && supplied && supplied === ADMIN_PASSCODE);
}

function classifyGitHubError(status: number) {
  if (status === 401) return { code: 'GITHUB_TOKEN_INVALID', message: 'Token معتبر نیست یا منقضی شده است.' };
  if (status === 403) return { code: 'GITHUB_TOKEN_PERMISSION_DENIED', message: 'Token معتبر است اما دسترسی کافی ندارد.' };
  if (status === 404) return { code: 'GITHUB_REPOSITORY_NOT_FOUND', message: 'Repository یا Branch یافت نشد.' };
  return { code: 'GITHUB_API_ERROR', message: `خطای GitHub (${status}).` };
}

async function repositoryCheck(config: MediaConfig) {
  const steps: DiagnosticStep[] = [];

  if (!GITHUB_TOKEN) {
    steps.push({ name: 'GitHub Token', stage: 'github_authentication', status: 'failed', message: 'کلید GitHub روی سرور تنظیم نشده است.', details: { configured: false } });
    return { ok: false, steps, code: 'GITHUB_TOKEN_MISSING', stage: 'github_authentication', message: 'کلید GitHub روی سرور تنظیم نشده است.' };
  }

  steps.push({ name: 'GitHub Token', stage: 'github_authentication', status: 'passed', message: 'Token روی سرور تنظیم شده است.', details: { configured: true } });

  const repoResponse = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepository}`);
  const repoBody = await parseJsonResponse(repoResponse);
  if (!repoResponse.ok) {
    const classified = classifyGitHubError(repoResponse.status);
    steps.push({ name: 'GitHub Repository Access', stage: 'github_repository_check', status: 'failed', message: classified.message, details: { status: repoResponse.status, response: repoBody } });
    return { ok: false, steps, code: classified.code, stage: 'github_repository_check', message: classified.message, details: { status: repoResponse.status } };
  }

  steps.push({ name: 'GitHub Repository Access', stage: 'github_repository_check', status: 'passed', message: 'Repository قابل دسترسی است.', details: { full_name: repoBody?.full_name, private: repoBody?.private, default_branch: repoBody?.default_branch } });

  const branchResponse = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepository}/branches/${encodeURIComponent(config.branch)}`);
  const branchBody = await parseJsonResponse(branchResponse);
  if (!branchResponse.ok) {
    steps.push({ name: 'Branch Access', stage: 'github_branch_check', status: 'failed', message: `شاخه ${config.branch} در مخزن وجود ندارد یا قابل دسترسی نیست.`, details: { status: branchResponse.status, response: branchBody } });
    return { ok: false, steps, code: 'GITHUB_BRANCH_NOT_FOUND', stage: 'github_branch_check', message: `شاخه ${config.branch} در مخزن وجود ندارد یا قابل دسترسی نیست.`, details: { status: branchResponse.status } };
  }

  steps.push({ name: 'Branch Access', stage: 'github_branch_check', status: 'passed', message: 'Branch قابل دسترسی است.', details: { name: branchBody?.name, protected: branchBody?.protected } });

  const treeResponse = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepository}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
  const treeBody = await parseJsonResponse(treeResponse);
  if (!treeResponse.ok) {
    const classified = classifyGitHubError(treeResponse.status);
    steps.push({ name: 'Media Directory', stage: 'media_directory_check', status: 'failed', message: classified.message, details: { status: treeResponse.status, response: treeBody } });
    return { ok: false, steps, code: classified.code, stage: 'media_directory_check', message: classified.message, details: { status: treeResponse.status } };
  }

  const treeItems = Array.isArray(treeBody?.tree) ? treeBody.tree : [];
  const mediaItems = treeItems.filter((item: any) => item.type === 'blob' && String(item.path || '').startsWith(config.basePath) && isImagePath(String(item.path || '')));
  steps.push({ name: 'Media Directory', stage: 'media_directory_check', status: mediaItems.length > 0 ? 'passed' : 'warning', message: mediaItems.length > 0 ? 'مسیر رسانه در مخزن پیدا شد.' : 'مسیر رسانه وجود دارد اما فعلاً فایل تصویری ثبت نشده است.', details: { basePath: config.basePath, matchedFiles: mediaItems.length, treeTruncated: Boolean(treeBody?.truncated) } });

  return { ok: true, steps, repoBody, branchBody, treeBody };
}

async function listImages(config: MediaConfig) {
  const treeResponse = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepository}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
  if (!treeResponse.ok) throw new Error(classifyGitHubError(treeResponse.status).message);
  const tree = await parseJsonResponse(treeResponse);
  if (tree?.truncated) throw new Error('مخزن گیت‌هاب بزرگ است و فهرست فایل‌ها توسط GitHub ناقص شد. مسیر کتابخانه تصاویر را محدودتر کنید.');
  const rows = await loadAssetMetadata(config.githubOwner, config.githubRepository, config.branch);
  const metadata = new Map(rows.map((r: any) => [r.path, r]));
  return (tree?.tree || [])
    .filter((item: any) => item.type === 'blob' && String(item.path || '').startsWith(config.basePath) && isImagePath(String(item.path || '')))
    .map((item: any) => {
      const filename = item.path.split('/').pop() || item.path;
      const encodedPath = item.path.split('/').map(encodeURIComponent).join('/');
      const fallback = {
        id: `github_${config.githubOwner}_${config.githubRepository}_${item.sha}`,
        githubOwner: config.githubOwner,
        githubRepository: config.githubRepository,
        branch: config.branch,
        path: item.path,
        filename,
        publicUrl: `https://raw.githubusercontent.com/${config.githubOwner}/${config.githubRepository}/${encodeURIComponent(config.branch)}/${encodedPath}`,
        mimeType: `image/${filename.split('.').pop()}`,
        fileSize: 0,
        sha: item.sha,
        createdAt: nowIso(),
        originalFilename: filename,
        altText: '',
        title: filename,
      };
      return toAsset(metadata.get(item.path), fallback);
    });
}

async function upload(payload: any, config: MediaConfig) {
  const cleanFilename = String(payload.filename || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleanFilename || cleanFilename.includes('..')) throw new Error('نام فایل نامعتبر است.');
  const base64 = String(payload.base64 || '');
  if (!base64) throw new Error('محتوای تصویر خالی است.');
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_UPLOAD_BYTES) throw new Error('حجم تصویر بیش از حد مجاز ۸ مگابایت است.');
  const path = `${config.basePath}${cleanFilename}`;
  const safePath = safeRelativePath(path);
  if (!safePath || !safePath.startsWith(config.basePath)) throw new Error('مسیر فایل نامعتبر است.');
  const endpoint = `/repos/${config.githubOwner}/${config.githubRepository}/contents/${safePath.split('/').map(encodeURIComponent).join('/')}`;
  const existing = await githubFetch(`${endpoint}?ref=${encodeURIComponent(config.branch)}`);
  let existingSha = '';
  if (existing.ok) {
    const data = await parseJsonResponse(existing);
    existingSha = data?.sha || '';
    if (!payload.overwrite) return { conflict: true, existingSha, message: `فایلی با نام ${cleanFilename} در مخزن وجود دارد.` };
  } else if (existing.status !== 404) {
    throw new Error(`خطا در بررسی فایل موجود (${existing.status}).`);
  }
  const put = await githubFetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Upload media asset: ${cleanFilename} via Solmint Admin`, content: base64, branch: config.branch, ...(existingSha ? { sha: existingSha } : {}) }),
  });
  if (!put.ok) throw new Error(`GitHub upload failed (${put.status}).`);
  const data = await parseJsonResponse(put);
  const encodedPath = safePath.split('/').map(encodeURIComponent).join('/');
  const asset = {
    id: `asset_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    provider: 'github',
    githubOwner: config.githubOwner,
    githubRepository: config.githubRepository,
    branch: config.branch,
    path: safePath,
    filename: cleanFilename,
    publicUrl: `https://raw.githubusercontent.com/${config.githubOwner}/${config.githubRepository}/${encodeURIComponent(config.branch)}/${encodedPath}`,
    mimeType: payload.mimeType || 'image/webp',
    fileSize: bytes,
    width: Number(payload.width || 0),
    height: Number(payload.height || 0),
    sha: data?.content?.sha || existingSha,
    createdAt: nowIso(),
    originalFilename: payload.originalFilename || cleanFilename,
    altText: payload.altText || '',
    title: payload.title || cleanFilename,
  };
  await saveAsset(asset);
  return { asset };
}

async function remove(payload: any, config: MediaConfig) {
  const safePath = safeRelativePath(payload.path);
  if (!safePath || !safePath.startsWith(config.basePath)) throw new Error('مسیر فایل برای این کتابخانه معتبر نیست.');
  const endpoint = `/repos/${config.githubOwner}/${config.githubRepository}/contents/${safePath.split('/').map(encodeURIComponent).join('/')}`;
  const existing = await githubFetch(`${endpoint}?ref=${encodeURIComponent(config.branch)}`);
  if (existing.status === 404) {
    if (payload.assetId) await deleteAssetMetadata(payload.assetId);
    return;
  }
  if (!existing.ok) throw new Error(`خطا در خواندن فایل برای حذف (${existing.status}).`);
  const data = await parseJsonResponse(existing);
  const del = await githubFetch(endpoint, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Delete media asset: ${safePath} via Solmint Admin`, sha: payload.sha || data?.sha, branch: config.branch }),
  });
  if (!del.ok) throw new Error(`GitHub delete failed (${del.status}).`);
  if (payload.assetId) await deleteAssetMetadata(payload.assetId);
}

async function migrate(payload: any, source: MediaConfig, target: MediaConfig) {
  if (source.githubOwner === target.githubOwner && source.githubRepository === target.githubRepository && source.branch === target.branch && source.basePath === target.basePath) throw new Error('مخزن مبدا و مقصد یکسان هستند.');
  const sourceCheck = await repositoryCheck(source);
  if (!sourceCheck.ok) throw new Error(sourceCheck.message);
  const targetCheck = await repositoryCheck(target);
  if (!targetCheck.ok) throw new Error(targetCheck.message);
  const assets = Array.isArray(payload.assets) ? payload.assets : await listImages(source);
  const migrated: any[] = [];
  for (const asset of assets) {
    const sourcePath = safeRelativePath(asset.path);
    if (!sourcePath || !sourcePath.startsWith(source.basePath)) throw new Error(`مسیر مبدا نامعتبر است: ${asset.path}`);
    const sourceEndpoint = `/repos/${source.githubOwner}/${source.githubRepository}/contents/${sourcePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(source.branch)}`;
    const sourceResponse = await githubFetch(sourceEndpoint);
    if (!sourceResponse.ok) throw new Error(`خواندن ${asset.filename} از مبدا ناموفق بود.`);
    const sourceData = await parseJsonResponse(sourceResponse);
    const targetPath = `${target.basePath}${asset.filename}`;
    const targetEndpoint = `/repos/${target.githubOwner}/${target.githubRepository}/contents/${targetPath.split('/').map(encodeURIComponent).join('/')}`;
    const targetExisting = await githubFetch(`${targetEndpoint}?ref=${encodeURIComponent(target.branch)}`);
    let targetSha = '';
    if (targetExisting.ok) targetSha = (await parseJsonResponse(targetExisting))?.sha || '';
    else if (targetExisting.status !== 404) throw new Error(`بررسی مقصد برای ${asset.filename} ناموفق بود.`);
    const put = await githubFetch(targetEndpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Migrate media asset: ${asset.filename} from ${source.githubOwner}/${source.githubRepository}`, content: sourceData?.content, branch: target.branch, ...(targetSha ? { sha: targetSha } : {}) }),
    });
    if (!put.ok) throw new Error(`نوشتن ${asset.filename} در مقصد ناموفق بود.`);
    const putData = await parseJsonResponse(put);
    const encodedPath = targetPath.split('/').map(encodeURIComponent).join('/');
    migrated.push({ ...asset, githubOwner: target.githubOwner, githubRepository: target.githubRepository, branch: target.branch, path: targetPath, publicUrl: `https://raw.githubusercontent.com/${target.githubOwner}/${target.githubRepository}/${encodeURIComponent(target.branch)}/${encodedPath}`, sha: putData?.content?.sha || targetSha });
  }
  for (const asset of migrated) await saveAsset(asset);
  const oldRows = await loadAssetMetadata(source.githubOwner, source.githubRepository, source.branch);
  for (const row of oldRows) await deleteAssetMetadata(row.id);
  await saveStoredConfig({ ...target, connectionStatus: 'connected', lastTestAt: nowIso() });
  return { migratedAssets: migrated, total: assets.length };
}

async function runFullDiagnostic(config: MediaConfig) {
  const authStep: DiagnosticStep = { name: 'Admin Authentication', stage: 'admin_authentication', status: 'passed', message: 'رمز مدیر معتبر است.' };
  const envStep: DiagnosticStep = {
    name: 'Supabase Edge Function',
    stage: 'edge_function_environment',
    status: SUPABASE_URL && SERVICE_ROLE_KEY ? 'passed' : 'failed',
    message: SUPABASE_URL && SERVICE_ROLE_KEY ? 'Environment configured.' : 'SUPABASE_URL یا SERVICE_ROLE_KEY تنظیم نشده است.',
    details: { supabaseUrlConfigured: Boolean(SUPABASE_URL), serviceRoleConfigured: Boolean(SERVICE_ROLE_KEY) },
  };
  if (envStep.status === 'failed') return { ok: false, steps: [authStep, envStep], code: 'SUPABASE_ENV_MISSING', stage: envStep.stage, message: envStep.message, details: envStep.details };
  const dbStep: DiagnosticStep = { name: 'Supabase Database', stage: 'supabase_database', status: 'passed', message: 'اتصال دیتابیس برقرار است.' };
  const repoCheck = await repositoryCheck(config);
  const steps = [authStep, envStep, dbStep, ...repoCheck.steps];
  if (!repoCheck.ok) return { ok: false, steps, code: repoCheck.code, stage: repoCheck.stage, message: repoCheck.message, details: repoCheck.details };
  return { ok: true, steps, code: 'ALL_SYSTEMS_OPERATIONAL', stage: 'diagnostic_complete', message: 'All Systems Operational', details: { repo: `${config.githubOwner}/${config.githubRepository}`, branch: config.branch, basePath: config.basePath } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(errorPayload('METHOD_NOT_ALLOWED', 'request_validation', 'Method Not Allowed'), 405);
  try {
    if (!authPasscode(req)) return json(errorPayload('ADMIN_AUTHENTICATION_FAILED', 'admin_authentication', 'دسترسی غیرمجاز.'), 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    let config = await getStoredConfig();
    if (body.config) config = normalizeConfig(body.config);

    if (action === 'get-config') {
      return json(okPayload({ config, hasToken: Boolean(GITHUB_TOKEN) }));
    }

    if (action === 'save-config') {
      const repoCheck = await repositoryCheck(config);
      if (!repoCheck.ok) {
        await maybeLog('error', 'github-media', repoCheck.stage, repoCheck.code, repoCheck.message, { action, config, details: repoCheck.details });
        return json(errorPayload(repoCheck.code, repoCheck.stage, repoCheck.message, repoCheck.details), 200);
      }
      const saved = await saveStoredConfig({ ...config, connectionStatus: 'connected', lastTestAt: nowIso() });
      await maybeLog('info', 'github-media', 'save_config', 'CONFIG_SAVED', 'تنظیمات کتابخانه رسانه ذخیره شد.', { config: saved });
      return json(okPayload({ config: saved }));
    }

    if (action === 'test') {
      const result = await runFullDiagnostic(config);
      if (!result.ok) {
        await maybeLog('error', 'github-media', result.stage, result.code, result.message, { action, config, details: result.details });
        return json(errorPayload(result.code, result.stage, result.message, result.details), 200);
      }
      await saveStoredConfig({ ...config, connectionStatus: 'connected', lastTestAt: nowIso() });
      await maybeLog('info', 'github-media', result.stage, result.code, result.message, { action, config, diagnostics: result.steps });
      return json(okPayload({ message: 'اتصال به‌صورت کامل تأیید شد.', details: result.details, diagnostics: result.steps }));
    }

    if (action === 'list') {
      const assets = await listImages(config);
      return json(okPayload({ assets, config }));
    }

    if (action === 'upload') {
      const result = await upload(body, config);
      if ('conflict' in result && result.conflict) return json(errorPayload('FILE_EXISTS', 'github_upload', result.message, { existingSha: result.existingSha }), 200);
      await maybeLog('info', 'github-media', 'github_upload', 'UPLOAD_SUCCESS', 'تصویر با موفقیت در GitHub ذخیره شد.', { path: result.asset.path, sha: result.asset.sha });
      return json(okPayload({ asset: result.asset, message: 'تصویر با موفقیت در GitHub ذخیره شد.' }));
    }

    if (action === 'delete') {
      await remove(body, config);
      await maybeLog('info', 'github-media', 'github_delete', 'DELETE_SUCCESS', 'تصویر با موفقیت حذف شد.', { path: body.path, assetId: body.assetId });
      return json(okPayload({ message: 'تصویر با موفقیت حذف شد.' }));
    }

    if (action === 'migrate') {
      const target = normalizeConfig(body.targetConfig);
      const result = await migrate(body, config, target);
      await maybeLog('info', 'github-media', 'github_migration', 'MIGRATION_SUCCESS', 'عملیات انتقال تصاویر با موفقیت تکمیل شد.', { total: result.total });
      return json(okPayload({ message: `تمام ${result.total} تصویر با موفقیت به مخزن مقصد منتقل شد.`, ...result }));
    }

    return json(errorPayload('INVALID_ACTION', 'request_validation', 'عملیات رسانه نامعتبر است.'), 400);
  } catch (error) {
    console.error('github-media error', error);
    const message = error instanceof Error ? error.message : 'خطای ناشناخته سرور';
    const code = message.includes('GITHUB_MEDIA_TOKEN') ? 'GITHUB_TOKEN_MISSING' : message.includes('Supabase service environment') ? 'SUPABASE_ENV_MISSING' : 'INTERNAL_SERVER_ERROR';
    const stage = message.includes('GITHUB_MEDIA_TOKEN') ? 'github_authentication' : 'server_runtime';
    await maybeLog('error', 'github-media', stage, code, message, { stack: error instanceof Error ? error.stack : undefined });
    return json(errorPayload(code, stage, message), 500);
  }
});
