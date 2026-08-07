import { MediaAsset, MediaStorageConfig, DEFAULT_MEDIA_STORAGE_CONFIG } from '../types';
import { getSupabaseClient } from './supabaseClient';

const MEDIA_FUNCTION_NAME = 'github-media';

function getAdminPasscode(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('solmint_admin_passcode') ||
    localStorage.getItem('solmint_passcode') ||
    ''
  ).trim();
}

async function invokeMediaGateway(action: string, body: Record<string, any> = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('اتصال Supabase برای سرویس کتابخانه تصاویر در دسترس نیست.');
  const passcode = getAdminPasscode();
  if (!passcode) throw new Error('نشست مدیر سیستم معتبر نیست. لطفاً دوباره وارد پنل شوید.');

  const { data, error } = await client.functions.invoke(MEDIA_FUNCTION_NAME, {
    body: { action, ...body },
    headers: { 'x-admin-passcode': passcode }
  });

  if (error) {
    let message = error.message || 'ارتباط با سرویس کتابخانه تصاویر ناموفق بود.';
    try {
      const context = (error as any).context;
      if (context && typeof context.json === 'function') {
        const payload = await context.json();
        message = payload?.message || message;
      }
    } catch { /* keep original error */ }
    throw new Error(message);
  }

  return data || {};
}

export function generateSeoFilename(inputName: string, targetExt: string = 'webp'): string {
  if (!inputName) return `media-${Date.now()}.${targetExt}`;
  const lastDot = inputName.lastIndexOf('.');
  const baseName = lastDot > 0 ? inputName.substring(0, lastDot) : inputName;
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

export async function getMediaStorageConfig(): Promise<MediaStorageConfig> {
  try {
    const data = await invokeMediaGateway('get-config');
    if (data?.config) {
      localStorage.setItem('solmint_media_config', JSON.stringify(data.config));
      return data.config as MediaStorageConfig;
    }
  } catch { /* use cached/default config for resilient UI */ }
  const local = localStorage.getItem('solmint_media_config');
  if (local) { try { return JSON.parse(local); } catch { /* ignore malformed cache */ } }
  return DEFAULT_MEDIA_STORAGE_CONFIG;
}

export async function saveMediaStorageConfig(config: MediaStorageConfig & { githubToken?: string }): Promise<boolean> {
  const sanitizedConfig: MediaStorageConfig = {
    provider: 'github',
    githubOwner: config.githubOwner.trim(),
    githubRepository: config.githubRepository.trim(),
    branch: (config.branch || 'main').trim(),
    basePath: (config.basePath || 'public/media/articles/').trim(),
    connectionStatus: config.connectionStatus || 'untested'
  };
  // githubToken is intentionally ignored. GitHub credentials never enter browser requests.
  const data = await invokeMediaGateway('save-config', { config: sanitizedConfig });
  if (!data?.success) return false;
  localStorage.setItem('solmint_media_config', JSON.stringify(data.config || sanitizedConfig));
  return true;
}

export async function testMediaRepositoryConnection(config: MediaStorageConfig & { githubToken?: string }): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const data = await invokeMediaGateway('test', {
      config: {
        provider: 'github',
        githubOwner: config.githubOwner,
        githubRepository: config.githubRepository,
        branch: config.branch,
        basePath: config.basePath
      }
    });
    return { success: Boolean(data?.success), message: data?.message || 'اتصال با موفقیت برقرار شد.', details: data?.details };
  } catch (err: any) {
    return { success: false, message: err.message || 'برقراری ارتباط با مخزن گیت‌هاب ناموفق بود.' };
  }
}

export async function getAllMediaAssets(): Promise<MediaAsset[]> {
  try {
    const data = await invokeMediaGateway('list');
    if (Array.isArray(data?.assets)) {
      localStorage.setItem('solmint_media_assets_cache', JSON.stringify(data.assets));
      return data.assets as MediaAsset[];
    }
  } catch { /* fall back to cache so the admin UI remains usable */ }
  const cached = localStorage.getItem('solmint_media_assets_cache');
  if (cached) { try { return JSON.parse(cached); } catch { /* ignore malformed cache */ } }
  return [];
}

export async function uploadMediaAsset(file: File, customSeoName?: string, altText: string = '', title: string = '', overwrite: boolean = false): Promise<{ success: boolean; asset?: MediaAsset; message: string; code?: string; existingSha?: string }> {
  try {
    const optimized = await optimizeImageFile(file);
    const targetFilename = generateSeoFilename(customSeoName || file.name, 'webp');
    const config = await getMediaStorageConfig();
    const data = await invokeMediaGateway('upload', {
      base64: optimized.base64,
      filename: targetFilename,
      originalFilename: file.name,
      mimeType: optimized.mimeType,
      width: optimized.width,
      height: optimized.height,
      altText,
      title,
      overwrite,
      config
    });
    if (!data?.success) return { success: false, code: data?.code, existingSha: data?.existingSha, message: data?.message || 'خطا در آپلود فایل تصویر به مخزن گیت‌هاب.' };
    const asset = data.asset as MediaAsset;
    const existing = await getAllMediaAssets();
    localStorage.setItem('solmint_media_assets_cache', JSON.stringify([asset, ...existing.filter(a => a.id !== asset.id)]));
    return { success: true, asset, message: data.message || 'تصویر با موفقیت در مخزن گیت‌هاب آپلود و ثبت گردید.' };
  } catch (err: any) {
    return { success: false, message: `خطای پردازش تصویر: ${err.message || 'ناشناخته'}` };
  }
}

export async function deleteMediaAsset(asset: MediaAsset, force: boolean = false): Promise<{ success: boolean; message: string }> {
  try {
    const data = await invokeMediaGateway('delete', { assetId: asset.id, path: asset.path, sha: asset.sha, force });
    if (!data?.success) return { success: false, message: data?.message || 'حذف فایل تصویر از مخزن گیت‌هاب ناموفق بود.' };
    const existing = await getAllMediaAssets();
    localStorage.setItem('solmint_media_assets_cache', JSON.stringify(existing.filter(a => a.id !== asset.id && a.path !== asset.path)));
    return { success: true, message: data.message || 'تصویر با موفقیت حذف گردید.' };
  } catch (err: any) {
    return { success: false, message: `خطای ارتباط سرور: ${err.message || 'ناشناخته'}` };
  }
}

function validateMigrationConfig(config: MediaStorageConfig, label: string): string | null {
  if (!config || config.provider !== 'github') return `${label}: ارائه‌دهنده ذخیره‌سازی باید GitHub باشد.`;
  if (!config.githubOwner?.trim()) return `${label}: نام Owner مخزن وارد نشده است.`;
  if (!config.githubRepository?.trim()) return `${label}: نام Repository وارد نشده است.`;
  if (!config.branch?.trim()) return `${label}: Branch مشخص نشده است.`;
  return null;
}

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

    const data = await invokeMediaGateway('migrate', { sourceConfig, targetConfig, assets });
    if (!data?.success) return { success: false, message: data?.message || 'مهاجرت کامل نشد؛ اطلاعات فعلی بدون تغییر باقی ماند.', results: data?.results };

    const migratedAssets = Array.isArray(data.migratedAssets) ? data.migratedAssets : [];
    localStorage.setItem('solmint_media_assets_cache', JSON.stringify(migratedAssets));
    localStorage.setItem('solmint_media_config', JSON.stringify(targetConfig));
    return { success: true, message: data.message || 'عملیات انتقال تصاویر با موفقیت تکمیل شد و مقصد جدید فعال گردید.', results: data.results };
  } catch (err: any) {
    return { success: false, message: `خطای سرور در انجام مهاجرت؛ اطلاعات فعلی بدون تغییر باقی ماند: ${err.message || 'ناشناخته'}` };
  }
}
