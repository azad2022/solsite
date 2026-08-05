import { MediaAsset, MediaStorageConfig, DEFAULT_MEDIA_STORAGE_CONFIG } from '../types';
import { 
  fetchMediaAssetsFromSupabase, 
  saveMediaAssetToSupabase, 
  deleteMediaAssetFromSupabase,
  fetchMediaConfigFromSupabase,
  saveMediaConfigToSupabase
} from './supabaseClient';

/**
 * Sanitizes and generates an SEO-friendly filename.
 * Example: "تصویر تست مقاله جدید.png" -> "tasvir-test-maghale-jadid.webp"
 */
export function generateSeoFilename(inputName: string, targetExt: string = 'webp'): string {
  if (!inputName) return `media-${Date.now()}.${targetExt}`;
  const lastDot = inputName.lastIndexOf('.');
  let baseName = lastDot > 0 ? inputName.substring(0, lastDot) : inputName;
  const charMap: Record<string, string> = {
    'آ': 'a', 'ا': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch',
    'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's',
    'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
    'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h',
    'ی': 'y', 'ي': 'y', 'ك': 'k', ' ': '-', '_': '-'
  };
  let cleanStr = baseName.split('').map(c => charMap[c] !== undefined ? charMap[c] : c).join('').toLowerCase()
    .replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!cleanStr) cleanStr = `image-${Date.now()}`;
  return `${cleanStr}.${targetExt}`;
}

export async function optimizeImageFile(file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.82): Promise<{ base64: string; width: number; height: number; mimeType: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const aspect = width / height;
          if (width > maxWidth) { width = maxWidth; height = Math.round(width / aspect); }
          if (height > maxHeight) { height = maxHeight; width = Math.round(height * aspect); }
        }
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context not available')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        let mimeType = 'image/webp';
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) { mimeType = 'image/jpeg'; dataUrl = canvas.toDataURL('image/jpeg', quality); }
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, width, height, mimeType, sizeBytes: Math.round((base64.length * 3) / 4) });
      };
      img.onerror = () => reject(new Error('تصویر بارگذاری نشد'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.readAsDataURL(file);
  });
}

function getAdminAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const passcode = (localStorage.getItem('solmint_admin_passcode') || '').trim();
    if (!passcode) throw new Error('Admin authentication is not configured in this browser session.');
    headers['x-admin-passcode'] = passcode;
    headers['Authorization'] = `Bearer ${passcode}`;
    return headers;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) throw error;
    throw new Error('Admin authentication is not available in this browser session.');
  }
}

export async function getMediaStorageConfig(): Promise<MediaStorageConfig> {
  try {
    const res = await fetch('/api/media/config', { headers: getAdminAuthHeaders() });
    if (res.ok) { const data = await res.json(); if (data && data.config) return data.config; }
  } catch { /* Server-side config is authoritative; continue to safe read-only fallbacks. */ }
  const supaConfig = await fetchMediaConfigFromSupabase();
  if (supaConfig) return supaConfig;
  const local = localStorage.getItem('solmint_media_config');
  if (local) { try { return JSON.parse(local); } catch { /* ignore malformed cache */ } }
  return DEFAULT_MEDIA_STORAGE_CONFIG;
}

export async function saveMediaStorageConfig(config: MediaStorageConfig & { githubToken?: string }): Promise<boolean> {
  const token = config.githubToken;
  const sanitizedConfig: MediaStorageConfig = {
    provider: config.provider || 'github', githubOwner: config.githubOwner, githubRepository: config.githubRepository,
    branch: config.branch || 'main', basePath: config.basePath || 'articles/', connectionStatus: config.connectionStatus || 'untested'
  };
  localStorage.setItem('solmint_media_config', JSON.stringify(sanitizedConfig));
  await saveMediaConfigToSupabase(sanitizedConfig);
  try {
    const res = await fetch('/api/media/config', { method: 'POST', headers: getAdminAuthHeaders(), body: JSON.stringify({ config: { ...sanitizedConfig, githubToken: token || undefined } }) });
    return res.ok;
  } catch { return false; }
}

export async function testMediaRepositoryConnection(config: MediaStorageConfig & { githubToken?: string }): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const res = await fetch('/api/media/test-connection', { method: 'POST', headers: getAdminAuthHeaders(), body: JSON.stringify(config) });
    const data = await res.json();
    return { success: res.ok && data.success, message: data.message || (res.ok ? 'اتصال با موفقیت برقرار شد' : 'برقراری ارتباط با مخزن گیت‌هاب ناموفق بود'), details: data.details };
  } catch (err: any) { return { success: false, message: `خطای ارتباط با سرور: ${err.message || 'شبکه غیرقابل دسترس است'}` }; }
}

export async function getAllMediaAssets(): Promise<MediaAsset[]> {
  const supaAssets = await fetchMediaAssetsFromSupabase();
  if (supaAssets && supaAssets.length > 0) { localStorage.setItem('solmint_media_assets_cache', JSON.stringify(supaAssets)); return supaAssets; }
  const cached = localStorage.getItem('solmint_media_assets_cache');
  if (cached) { try { return JSON.parse(cached); } catch { /* ignore malformed cache */ } }
  return [];
}

export async function uploadMediaAsset(file: File, customSeoName?: string, altText: string = '', title: string = '', overwrite: boolean = false): Promise<{ success: boolean; asset?: MediaAsset; message: string; code?: string; existingSha?: string }> {
  try {
    const optimized = await optimizeImageFile(file);
    const targetFilename = generateSeoFilename(customSeoName || file.name, 'webp');
    const config = await getMediaStorageConfig();
    const res = await fetch('/api/media/upload', { method: 'POST', headers: getAdminAuthHeaders(), body: JSON.stringify({ base64: optimized.base64, filename: targetFilename, originalFilename: file.name, mimeType: optimized.mimeType, width: optimized.width, height: optimized.height, altText, title, config, overwrite }) });
    const data = await res.json();
    if (res.status === 409 && data.code === 'FILE_EXISTS') return { success: false, code: 'FILE_EXISTS', existingSha: data.existingSha, message: data.message || 'فایلی با این نام در مخزن گیت‌هاب وجود دارد.' };
    if (!res.ok || !data.success || !data.asset) return { success: false, message: data.message || 'خطا در آپلود فایل تصویر به مخزن گیت‌هاب' };
    const asset: MediaAsset = data.asset;
    await saveMediaAssetToSupabase(asset);
    const existing = await getAllMediaAssets();
    localStorage.setItem('solmint_media_assets_cache', JSON.stringify([asset, ...existing.filter(a => a.id !== asset.id)]));
    return { success: true, asset, message: data.message || 'تصویر با موفقیت در مخزن گیت‌هاب آپلود و ثبت گردید' };
  } catch (err: any) { return { success: false, message: `خطای پردازش تصویر: ${err.message || 'ناشناخته'}` }; }
}

export async function deleteMediaAsset(asset: MediaAsset, force: boolean = false): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/media/delete', { method: 'POST', headers: getAdminAuthHeaders(), body: JSON.stringify({ assetId: asset.id, path: asset.path, sha: asset.sha, githubOwner: asset.githubOwner, githubRepository: asset.githubRepository, branch: asset.branch, force }) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'حذف فایل تصویر از مخزن گیت‌هاب ناموفق بود.' };
    await deleteMediaAssetFromSupabase(asset.id);
    const existing = await getAllMediaAssets();
    localStorage.setItem('solmint_media_assets_cache', JSON.stringify(existing.filter(a => a.id !== asset.id)));
    return { success: true, message: data.message || 'تصویر با موفقیت حذف گردید' };
  } catch (err: any) { return { success: false, message: `خطای ارتباط سرور: ${err.message || 'ناشناخته'}` }; }
}

function validateMigrationConfig(config: MediaStorageConfig, label: string): string | null {
  if (!config || config.provider !== 'github') return `${label}: ارائه‌دهنده ذخیره‌سازی باید GitHub باشد.`;
  if (!config.githubOwner?.trim()) return `${label}: نام Owner مخزن وارد نشده است.`;
  if (!config.githubRepository?.trim()) return `${label}: نام Repository وارد نشده است.`;
  if (!config.branch?.trim()) return `${label}: Branch مشخص نشده است.`;
  return null;
}

/**
 * Fail-safe repository migration coordinator.
 *
 * Guarantees on the client side:
 * 1) No migration request is sent with an invalid source/target configuration.
 * 2) The target repository is preflight-tested before any copy starts when credentials are supplied.
 * 3) The existing Supabase media metadata is NOT changed until the server reports the whole copy as successful.
 * 4) A partial/failed migration never replaces the local metadata cache.
 *
 * The server remains responsible for the actual copy and must keep the source intact until verification succeeds.
 */
export async function migrateMediaRepository(sourceConfig: MediaStorageConfig, targetConfig: MediaStorageConfig): Promise<{ success: boolean; message: string; results?: any }> {
  try {
    const sourceError = validateMigrationConfig(sourceConfig, 'مخزن مبدا');
    if (sourceError) return { success: false, message: sourceError };
    const targetError = validateMigrationConfig(targetConfig, 'مخزن مقصد');
    if (targetError) return { success: false, message: targetError };

    const sameRepo = sourceConfig.githubOwner.trim().toLowerCase() === targetConfig.githubOwner.trim().toLowerCase()
      && sourceConfig.githubRepository.trim().toLowerCase() === targetConfig.githubRepository.trim().toLowerCase()
      && (sourceConfig.branch || 'main') === (targetConfig.branch || 'main')
      && (sourceConfig.basePath || '') === (targetConfig.basePath || '');
    if (sameRepo) return { success: false, message: 'مخزن مبدا و مقصد یکسان هستند؛ مهاجرتی برای انجام وجود ندارد.' };

    const assets = await getAllMediaAssets();
    if (!Array.isArray(assets)) return { success: false, message: 'فهرست تصاویر قابل اعتماد نیست؛ عملیات متوقف شد.' };

    const sourceMismatch = assets.find(asset => {
      const owner = String(asset.githubOwner || '').trim().toLowerCase();
      const repo = String(asset.githubRepository || '').trim().toLowerCase();
      return owner && repo && (owner !== sourceConfig.githubOwner.trim().toLowerCase() || repo !== sourceConfig.githubRepository.trim().toLowerCase());
    });
    if (sourceMismatch) return { success: false, message: 'برخی تصاویر به مخزن دیگری تعلق دارند؛ برای جلوگیری از مهاجرت ناقص، عملیات متوقف شد.' };

    // If a target credential is available, perform an explicit preflight against the destination.
    // The server must not begin copying until the destination has been proven reachable.
    if ((targetConfig as MediaStorageConfig & { githubToken?: string }).githubToken) {
      const preflight = await testMediaRepositoryConnection(targetConfig as MediaStorageConfig & { githubToken?: string });
      if (!preflight.success) return { success: false, message: `پیش‌آزمایش مخزن مقصد ناموفق بود: ${preflight.message}` };
    }

    const res = await fetch('/api/media/migrate', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ sourceConfig, targetConfig, assets, mode: 'copy-verify-switch', requireFullSuccess: true })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'مهاجرت کامل نشد؛ اطلاعات فعلی بدون تغییر باقی ماند.', results: data.results };
    }

    // Metadata switch happens only after the server confirms the complete migration.
    if (data.migratedAssets && Array.isArray(data.migratedAssets)) {
      if (data.migratedAssets.length !== assets.length) {
        return { success: false, message: 'سرور مهاجرت را موفق اعلام کرد اما تعداد تصاویر مقصد با مبدا برابر نیست؛ اطلاعات فعلی دست‌نخورده باقی ماند.', results: data.results };
      }
      for (const updatedAsset of data.migratedAssets) await saveMediaAssetToSupabase(updatedAsset);
      localStorage.setItem('solmint_media_assets_cache', JSON.stringify(data.migratedAssets));
    }

    return { success: true, message: data.message || 'عملیات انتقال تصاویر با موفقیت تکمیل شد و مقصد جدید فعال گردید.', results: data.results };
  } catch (err: any) {
    return { success: false, message: `خطای سرور در انجام مهاجرت؛ اطلاعات فعلی بدون تغییر باقی ماند: ${err.message || 'ناشناخته'}` };
  }
}
