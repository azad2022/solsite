import { MediaAsset, MediaStorageConfig, DEFAULT_MEDIA_STORAGE_CONFIG } from '../types';

async function serverJson<T = any>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store', headers: { ...(init.headers || {}) } });
    const text = await res.text();
    let data: T | null = null;
    try { data = text ? JSON.parse(text) as T : null; } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  } catch { return { ok: false, status: 0, data: null }; }
}

/** All privileged media operations are session-authenticated server requests. GitHub credentials never leave the server. */
async function invokeMediaGateway(action: string, body: Record<string, any> = {}) {
  const routes: Record<string, { method: string; path: string }> = {
    'get-config': { method: 'GET', path: '/api/media/config' },
    'save-config': { method: 'POST', path: '/api/media/config' },
    'test': { method: 'POST', path: '/api/media/test-connection' },
    'list': { method: 'GET', path: '/api/media/assets' },
    'upload': { method: 'POST', path: '/api/media/upload' },
    'delete': { method: 'POST', path: '/api/media/delete' },
    'migrate': { method: 'POST', path: '/api/media/migrate' }
  };
  const route = routes[action];
  if (!route) throw new Error('عملیات رسانه ناشناخته است.');
  const init: RequestInit = { method: route.method };
  if (route.method !== 'GET') { init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify(body); }
  const result = await serverJson(route.path, init);
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) throw new Error('نشست مدیر معتبر نیست. لطفاً دوباره وارد پنل شوید.');
    throw new Error((result.data as any)?.message || 'ارتباط با سرویس کتابخانه تصاویر ناموفق بود.');
  }
  return result.data || {};
}

export function generateSeoFilename(inputName: string, targetExt: string = 'webp'): string {
  if (!inputName) return `media-${Date.now()}.${targetExt}`;
  const lastDot = inputName.lastIndexOf('.');
  const baseName = lastDot > 0 ? inputName.substring(0, lastDot) : inputName;
  const charMap: Record<string, string> = {
    'آ': 'a', 'ا': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't',
    'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'و': 'v', 'ه': 'h', 'ی': 'y', 'ي': 'y', 'ك': 'k', ' ': '-', '_': '-'
  };
  let cleanStr = baseName.split('').map(c => charMap[c] !== undefined ? charMap[c] : c).join('').toLowerCase().replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!cleanStr) cleanStr = `image-${Date.now()}`;
  return `${cleanStr}.${targetExt}`;
}

export async function optimizeImageFile(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.82): Promise<{ base64: string; width: number; height: number; mimeType: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
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
  try { const data = await invokeMediaGateway('get-config'); if (data?.config) return data.config as MediaStorageConfig; } catch {}
  return DEFAULT_MEDIA_STORAGE_CONFIG;
}

export async function saveMediaStorageConfig(config: MediaStorageConfig): Promise<boolean> {
  const payload = { config: {
    provider: 'github', githubOwner: config.githubOwner.trim(), githubRepository: config.githubRepository.trim(), branch: (config.branch || 'main').trim(),
    basePath: (config.basePath || 'public/media/articles/').trim(), connectionStatus: 'untested'
  }};
  try {
    const data = await invokeMediaGateway('save-config', payload);
    return Boolean(data?.success);
  } catch { return false; }
}

export async function testMediaRepositoryConnection(config: MediaStorageConfig): Promise<{ success: boolean; message: string; details?: any; diagnostics?: any[]; code?: string; stage?: string }> {
  try {
    const data = await invokeMediaGateway('test', { config: {
      provider: 'github', githubOwner: config.githubOwner, githubRepository: config.githubRepository, branch: config.branch, basePath: config.basePath
    }});
    return { success: Boolean(data?.success), message: data?.message || 'اتصال با موفقیت برقرار نشد.', details: data?.details, diagnostics: data?.diagnostics, code: data?.errorCode, stage: data?.stage };
  } catch (err: any) { return { success: false, message: err.message || 'برقراری ارتباط با مخزن گیت‌هاب ناموفق بود.' }; }
}

export async function runMediaFullDiagnostic(config: MediaStorageConfig) { return testMediaRepositoryConnection(config); }

export async function getAllMediaAssets(): Promise<MediaAsset[]> {
  try { const data = await invokeMediaGateway('list'); return Array.isArray(data?.assets) ? data.assets as MediaAsset[] : []; } catch { return []; }
}

export async function uploadMediaAsset(file: File, customSeoName?: string, altText = '', title = '', overwrite = false): Promise<{ success: boolean; asset?: MediaAsset; message: string; code?: string; existingSha?: string }> {
  try {
    const optimized = await optimizeImageFile(file);
    const targetFilename = generateSeoFilename(customSeoName || file.name, 'webp');
    const data = await invokeMediaGateway('upload', { base64: optimized.base64, filename: targetFilename, originalFilename: file.name, mimeType: optimized.mimeType, width: optimized.width, height: optimized.height, altText, title, overwrite });
    if (!data?.success) return { success: false, code: data?.code || data?.errorCode, existingSha: data?.existingSha, message: data?.message || 'آپلود تصویر ناموفق بود.' };
    return { success: true, asset: data.asset as MediaAsset, message: data.message || 'تصویر با موفقیت آپلود شد.' };
  } catch (err: any) { return { success: false, message: err.message || 'خطای پردازش تصویر.' }; }
}

export async function deleteMediaAsset(asset: MediaAsset, force = false): Promise<{ success: boolean; message: string }> {
  try { const data = await invokeMediaGateway('delete', { assetId: asset.id, path: asset.path, sha: asset.sha, force }); return { success: Boolean(data?.success), message: data?.message || 'حذف رسانه ناموفق بود.' }; }
  catch (err: any) { return { success: false, message: err.message || 'حذف رسانه ناموفق بود.' }; }
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
    const sameRepo = sourceConfig.githubOwner.trim().toLowerCase() === targetConfig.githubOwner.trim().toLowerCase() && sourceConfig.githubRepository.trim().toLowerCase() === targetConfig.githubRepository.trim().toLowerCase() && (sourceConfig.branch || 'main') === (targetConfig.branch || 'main') && (sourceConfig.basePath || '') === (targetConfig.basePath || '');
    if (sameRepo) return { success: false, message: 'مخزن مبدا و مقصد یکسان هستند؛ مهاجرتی برای انجام وجود ندارد.' };
    const assets = await getAllMediaAssets();
    const data = await invokeMediaGateway('migrate', { sourceConfig, targetConfig, assets });
    if (!data?.success) return { success: false, message: data?.message || 'مهاجرت کامل نشد؛ تنظیمات فعال بدون تغییر باقی ماند.', results: data?.results };
    return { success: true, message: data.message || 'مهاجرت با موفقیت تکمیل شد.', results: data.results };
  } catch (err: any) { return { success: false, message: `خطای سرور در انجام مهاجرت؛ تنظیمات فعلی بدون تغییر باقی ماند: ${err.message || 'ناشناخته'}` }; }
}
