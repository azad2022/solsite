import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GITHUB_TOKEN = (Deno.env.get("GITHUB_MEDIA_TOKEN") || "").trim();
const ADMIN_PASSCODE = (Deno.env.get("MEDIA_ADMIN_PASSCODE") || "").trim();
const DEFAULT_CONFIG = {
  provider: "github",
  githubOwner: "azad2022",
  githubRepository: "solsite",
  branch: "main",
  basePath: "public/media/articles/",
  connectionStatus: "untested"
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-passcode",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

function cleanBasePath(value: string) {
  const cleaned = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  return cleaned ? `${cleaned}/` : "";
}

function cleanRepoPart(value: string) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_.-]/g, "");
}

function normalizeConfig(input: any) {
  return {
    provider: "github",
    githubOwner: cleanRepoPart(input?.githubOwner || DEFAULT_CONFIG.githubOwner),
    githubRepository: cleanRepoPart(input?.githubRepository || DEFAULT_CONFIG.githubRepository),
    branch: String(input?.branch || DEFAULT_CONFIG.branch).trim().replace(/[^A-Za-z0-9._\/-]/g, ""),
    basePath: cleanBasePath(input?.basePath || DEFAULT_CONFIG.basePath),
    connectionStatus: input?.connectionStatus || "untested"
  };
}

function isImagePath(path: string) {
  const lower = path.toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) if (lower.endsWith(ext)) return true;
  return false;
}

function safeRelativePath(path: string) {
  const normalized = String(path || "").replace(/\\/g, "/");
  return normalized.startsWith("/") || normalized.includes("..") || normalized.includes("//") ? null : normalized;
}

function githubHeaders() {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_MEDIA_TOKEN is not configured on the server.");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Solmint-GitHub-Media-Gateway"
  };
}

async function githubFetch(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...githubHeaders(), ...(init.headers || {}) }
  });
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase service environment is not configured.");
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
}

async function getStoredConfig() {
  const response = await supabaseFetch("media_config?id=eq.active_config&select=*");
  if (!response.ok) return DEFAULT_CONFIG;
  const rows = await response.json();
  return normalizeConfig(rows?.[0] || DEFAULT_CONFIG);
}

async function saveStoredConfig(config: any) {
  const normalized = normalizeConfig(config);
  const response = await supabaseFetch("media_config?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: "active_config",
      ...normalized,
      last_test_at: normalized.connectionStatus === "connected" ? new Date().toISOString() : null
    })
  });
  if (!response.ok) throw new Error(`Supabase media config save failed (${response.status}).`);
  return normalized;
}

async function saveAsset(asset: any) {
  const row = {
    id: asset.id,
    provider: "github",
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
    alt_text: asset.altText || "",
    title: asset.title || "",
    updated_at: new Date().toISOString()
  };
  const response = await supabaseFetch("media_assets?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  });
  if (!response.ok) throw new Error(`Supabase media asset save failed (${response.status}).`);
}

async function deleteAssetMetadata(id: string) {
  if (!id) return;
  await supabaseFetch(`media_assets?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function loadAssetMetadata(owner: string, repo: string, branch: string) {
  const query = new URLSearchParams({
    github_owner: `eq.${owner}`,
    github_repository: `eq.${repo}`,
    branch: `eq.${branch}`,
    select: "*",
    limit: "1000"
  });
  const response = await supabaseFetch(`media_assets?${query.toString()}`);
  if (!response.ok) return [];
  return await response.json();
}

function toAsset(row: any, fallback?: any) {
  return {
    id: row?.id || fallback?.id,
    provider: "github",
    githubOwner: row?.github_owner || fallback?.githubOwner,
    githubRepository: row?.github_repository || fallback?.githubRepository,
    branch: row?.branch || fallback?.branch,
    path: row?.path || fallback?.path,
    filename: row?.filename || fallback?.filename,
    publicUrl: row?.public_url || fallback?.publicUrl,
    mimeType: row?.mime_type || fallback?.mimeType || "image/*",
    fileSize: row?.file_size || fallback?.fileSize || 0,
    width: row?.width || fallback?.width || 0,
    height: row?.height || fallback?.height || 0,
    sha: row?.sha || fallback?.sha,
    createdAt: row?.created_at || fallback?.createdAt || new Date().toISOString(),
    updatedAt: row?.updated_at || fallback?.updatedAt,
    originalFilename: row?.original_filename || fallback?.originalFilename || fallback?.filename,
    altText: row?.alt_text || fallback?.altText || "",
    title: row?.title || fallback?.title || fallback?.filename
  };
}

async function authenticate(req: Request) {
  const supplied = (req.headers.get("x-admin-passcode") || "").trim();
  return Boolean(ADMIN_PASSCODE && supplied && supplied === ADMIN_PASSCODE);
}

async function listImages(config: any) {
  const treeResponse = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepository}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
  if (!treeResponse.ok) throw new Error(`GitHub tree request failed (${treeResponse.status}).`);
  const tree = await treeResponse.json();
  if (tree.truncated) throw new Error("مخزن گیت‌هاب بزرگ است و فهرست فایل‌ها توسط GitHub ناقص شد. مسیر کتابخانه تصاویر را محدودتر کنید.");
  const rows = await loadAssetMetadata(config.githubOwner, config.githubRepository, config.branch);
  const metadata = new Map(rows.map((r: any) => [r.path, r]));
  return (tree.tree || [])
    .filter((item: any) => item.type === "blob" && item.path.startsWith(config.basePath) && isImagePath(item.path))
    .map((item: any) => {
      const filename = item.path.split("/").pop() || item.path;
      const encodedPath = item.path.split("/").map(encodeURIComponent).join("/");
      const fallback = {
        id: `github_${config.githubOwner}_${config.githubRepository}_${item.sha}`,
        githubOwner: config.githubOwner,
        githubRepository: config.githubRepository,
        branch: config.branch,
        path: item.path,
        filename,
        publicUrl: `https://raw.githubusercontent.com/${config.githubOwner}/${config.githubRepository}/${encodeURIComponent(config.branch)}/${encodedPath}`,
        mimeType: `image/${filename.split(".").pop()}`,
        fileSize: 0,
        sha: item.sha,
        createdAt: new Date().toISOString(),
        originalFilename: filename,
        altText: "",
        title: filename
      };
      return toAsset(metadata.get(item.path), fallback);
    });
}

async function repositoryTest(config: any) {
  const response = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepository}`);
  if (!response.ok) {
    const message = response.status === 404 ? `مخزن ${config.githubOwner}/${config.githubRepository} یافت نشد یا Token به آن دسترسی ندارد.` : `خطای GitHub (${response.status}).`;
    throw new Error(message);
  }
  const repo = await response.json();
  const branchResponse = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepository}/branches/${encodeURIComponent(config.branch)}`);
  if (!branchResponse.ok) throw new Error(`شاخه ${config.branch} در مخزن وجود ندارد یا قابل دسترسی نیست.`);
  return { fullName: repo.full_name, private: repo.private, defaultBranch: repo.default_branch, sizeKb: repo.size };
}

async function upload(payload: any, config: any) {
  const cleanFilename = String(payload.filename || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!cleanFilename || cleanFilename.includes("..")) throw new Error("نام فایل نامعتبر است.");
  const base64 = String(payload.base64 || "");
  if (!base64) throw new Error("محتوای تصویر خالی است.");
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_UPLOAD_BYTES) throw new Error("حجم تصویر بیش از حد مجاز ۸ مگابایت است.");
  const path = `${config.basePath}${cleanFilename}`;
  const safePath = safeRelativePath(path);
  if (!safePath || !safePath.startsWith(config.basePath)) throw new Error("مسیر فایل نامعتبر است.");
  const endpoint = `/repos/${config.githubOwner}/${config.githubRepository}/contents/${safePath.split("/").map(encodeURIComponent).join("/")}`;
  const existing = await githubFetch(`${endpoint}?ref=${encodeURIComponent(config.branch)}`);
  let existingSha = "";
  if (existing.ok) {
    const data = await existing.json();
    existingSha = data.sha || "";
    if (!payload.overwrite) return { conflict: true, existingSha, message: `فایلی با نام ${cleanFilename} در مخزن وجود دارد.` };
  } else if (existing.status !== 404) {
    throw new Error(`خطا در بررسی فایل موجود (${existing.status}).`);
  }
  const put = await githubFetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Upload media asset: ${cleanFilename} via Solmint Admin`,
      content: base64,
      branch: config.branch,
      ...(existingSha ? { sha: existingSha } : {})
    })
  });
  if (!put.ok) throw new Error(`GitHub upload failed (${put.status}).`);
  const data = await put.json();
  const encodedPath = safePath.split("/").map(encodeURIComponent).join("/");
  const asset = {
    id: `asset_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    provider: "github",
    githubOwner: config.githubOwner,
    githubRepository: config.githubRepository,
    branch: config.branch,
    path: safePath,
    filename: cleanFilename,
    publicUrl: `https://raw.githubusercontent.com/${config.githubOwner}/${config.githubRepository}/${encodeURIComponent(config.branch)}/${encodedPath}`,
    mimeType: payload.mimeType || "image/webp",
    fileSize: bytes,
    width: Number(payload.width || 0),
    height: Number(payload.height || 0),
    sha: data.content?.sha || existingSha,
    createdAt: new Date().toISOString(),
    originalFilename: payload.originalFilename || cleanFilename,
    altText: payload.altText || "",
    title: payload.title || cleanFilename
  };
  await saveAsset(asset);
  return { asset };
}

async function remove(payload: any, config: any) {
  const safePath = safeRelativePath(payload.path);
  if (!safePath || !safePath.startsWith(config.basePath)) throw new Error("مسیر فایل برای این کتابخانه معتبر نیست.");
  const endpoint = `/repos/${config.githubOwner}/${config.githubRepository}/contents/${safePath.split("/").map(encodeURIComponent).join("/")}`;
  const existing = await githubFetch(`${endpoint}?ref=${encodeURIComponent(config.branch)}`);
  if (existing.status === 404) {
    if (payload.assetId) await deleteAssetMetadata(payload.assetId);
    return;
  }
  if (!existing.ok) throw new Error(`خطا در خواندن فایل برای حذف (${existing.status}).`);
  const data = await existing.json();
  const del = await githubFetch(endpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Delete media asset: ${safePath} via Solmint Admin`, sha: payload.sha || data.sha, branch: config.branch })
  });
  if (!del.ok) throw new Error(`GitHub delete failed (${del.status}).`);
  if (payload.assetId) await deleteAssetMetadata(payload.assetId);
}

async function migrate(payload: any, source: any, target: any) {
  if (source.githubOwner === target.githubOwner && source.githubRepository === target.githubRepository && source.branch === target.branch && source.basePath === target.basePath) throw new Error("مخزن مبدا و مقصد یکسان هستند.");
  await repositoryTest(source);
  await repositoryTest(target);
  const assets = Array.isArray(payload.assets) ? payload.assets : await listImages(source);
  const migrated: any[] = [];
  for (const asset of assets) {
    const sourcePath = safeRelativePath(asset.path);
    if (!sourcePath || !sourcePath.startsWith(source.basePath)) throw new Error(`مسیر مبدا نامعتبر است: ${asset.path}`);
    const sourceEndpoint = `/repos/${source.githubOwner}/${source.githubRepository}/contents/${sourcePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(source.branch)}`;
    const sourceResponse = await githubFetch(sourceEndpoint);
    if (!sourceResponse.ok) throw new Error(`خواندن ${asset.filename} از مبدا ناموفق بود.`);
    const sourceData = await sourceResponse.json();
    const targetPath = `${target.basePath}${asset.filename}`;
    const targetEndpoint = `/repos/${target.githubOwner}/${target.githubRepository}/contents/${targetPath.split("/").map(encodeURIComponent).join("/")}`;
    const targetExisting = await githubFetch(`${targetEndpoint}?ref=${encodeURIComponent(target.branch)}`);
    let targetSha = "";
    if (targetExisting.ok) targetSha = (await targetExisting.json()).sha || "";
    else if (targetExisting.status !== 404) throw new Error(`بررسی مقصد برای ${asset.filename} ناموفق بود.`);
    const put = await githubFetch(targetEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Migrate media asset: ${asset.filename} from ${source.githubOwner}/${source.githubRepository}`,
        content: sourceData.content,
        branch: target.branch,
        ...(targetSha ? { sha: targetSha } : {})
      })
    });
    if (!put.ok) throw new Error(`نوشتن ${asset.filename} در مقصد ناموفق بود.`);
    const putData = await put.json();
    const encodedPath = targetPath.split("/").map(encodeURIComponent).join("/");
    migrated.push({
      ...asset,
      githubOwner: target.githubOwner,
      githubRepository: target.githubRepository,
      branch: target.branch,
      path: targetPath,
      publicUrl: `https://raw.githubusercontent.com/${target.githubOwner}/${target.githubRepository}/${encodeURIComponent(target.branch)}/${encodedPath}`,
      sha: putData.content?.sha || targetSha
    });
  }
  for (const asset of migrated) await saveAsset(asset);
  const oldRows = await loadAssetMetadata(source.githubOwner, source.githubRepository, source.branch);
  for (const row of oldRows) await deleteAssetMetadata(row.id);
  await saveStoredConfig({ ...target, connectionStatus: "connected" });
  return { migratedAssets: migrated, total: assets.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method Not Allowed" }, 405);
  try {
    if (!(await authenticate(req))) return json({ success: false, message: "دسترسی غیرمجاز." }, 401);
    if (!GITHUB_TOKEN) return json({ success: false, code: "GITHUB_TOKEN_MISSING", message: "کلید GitHub روی سرور تنظیم نشده است." }, 503);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    let config = await getStoredConfig();
    if (body.config) config = normalizeConfig(body.config);

    if (action === "get-config") return json({ success: true, config, hasToken: true });
    if (action === "save-config") {
      await repositoryTest(config);
      const saved = await saveStoredConfig({ ...config, connectionStatus: "connected" });
      return json({ success: true, config: saved });
    }
    if (action === "test") {
      const details = await repositoryTest(config);
      await saveStoredConfig({ ...config, connectionStatus: "connected" });
      return json({ success: true, message: `اتصال به مخزن ${config.githubOwner}/${config.githubRepository} با موفقیت تایید شد.`, details });
    }
    if (action === "list") return json({ success: true, assets: await listImages(config), config });
    if (action === "upload") {
      const result = await upload(body, config);
      if (result.conflict) return json({ success: false, code: "FILE_EXISTS", existingSha: result.existingSha, message: result.message });
      return json({ success: true, asset: result.asset, message: "تصویر با موفقیت در GitHub ذخیره شد." });
    }
    if (action === "delete") {
      await remove(body, config);
      return json({ success: true, message: "تصویر با موفقیت حذف شد." });
    }
    if (action === "migrate") {
      const target = normalizeConfig(body.targetConfig);
      const result = await migrate(body, config, target);
      return json({ success: true, message: `تمام ${result.total} تصویر با موفقیت به مخزن مقصد منتقل شد.`, ...result });
    }
    return json({ success: false, message: "عملیات رسانه نامعتبر است." }, 400);
  } catch (error) {
    console.error("github-media error", error);
    return json({ success: false, message: error instanceof Error ? error.message : "خطای ناشناخته سرور" }, 500);
  }
});
