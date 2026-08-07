import { Article } from '../types';
import { fetchArticlesFromSupabase } from './supabaseClient';

export type DatabaseProvider = 'supabase' | 'cloudflare_d1' | 'local';

export interface DatabaseConfig {
  provider: DatabaseProvider;
  supabaseUrl: string;
  supabaseAnonKey: string;
  cloudflareWorkerEndpoint: string;
  cloudflareApiKey: string;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  provider: 'supabase',
  supabaseUrl: 'https://nvopkbiedorfshwbmyhn.supabase.co',
  supabaseAnonKey: 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt',
  cloudflareWorkerEndpoint: '',
  cloudflareApiKey: ''
};

function getAdminPasscode(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('solmint_admin_passcode') ||
    localStorage.getItem('solmint_passcode') ||
    ''
  ).trim();
}

async function parseApiResponse(res: Response): Promise<any> {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readResponseText(res: Response): Promise<string> {
  try {
    return await res.clone().text();
  } catch {
    return '';
  }
}

async function getReadableResponseMessage(res: Response, fallback: string): Promise<string> {
  try {
    const parsed = await parseApiResponse(res.clone());
    if (parsed && typeof parsed === 'object') {
      const candidates = [parsed.message, parsed.error, parsed.detail, parsed.reason]
        .filter(v => typeof v === 'string' && v.trim().length > 0) as string[];
      if (candidates.length > 0) return candidates[0].trim();
      if (typeof parsed.code === 'string' && parsed.code.trim()) return parsed.code.trim();
    }
  } catch {
    // ignore parsing issues and fall back to raw text below
  }

  const raw = (await readResponseText(res)).trim();
  if (raw) return raw;
  return fallback;
}

function showSuccessPopup(message: string): void {
  if (typeof window !== 'undefined') {
    window.alert(message);
  }
}

export function getDatabaseConfig(): DatabaseConfig {
  const metaEnv = (import.meta as any).env || {};
  const storedProvider = localStorage.getItem('solmint_db_provider') as DatabaseProvider | null;
  const storedCloudflareUrl = localStorage.getItem('solmint_cf_worker_url') || '';
  const storedCloudflareKey = localStorage.getItem('solmint_cf_worker_key') || '';

  const activeProvider: DatabaseProvider =
    storedProvider === 'cloudflare_d1' && storedCloudflareUrl ? 'cloudflare_d1' : 'supabase';

  return {
    provider: activeProvider,
    supabaseUrl: metaEnv.VITE_SUPABASE_URL || localStorage.getItem('solmint_supabase_url') || DEFAULT_CONFIG.supabaseUrl,
    supabaseAnonKey: metaEnv.VITE_SUPABASE_ANON_KEY || localStorage.getItem('solmint_supabase_anon_key') || DEFAULT_CONFIG.supabaseAnonKey,
    cloudflareWorkerEndpoint: storedCloudflareUrl,
    cloudflareApiKey: storedCloudflareKey
  };
}

export function saveDatabaseConfig(config: Partial<DatabaseConfig>): void {
  if (config.provider) localStorage.setItem('solmint_db_provider', config.provider);
  if (config.supabaseUrl !== undefined) localStorage.setItem('solmint_supabase_url', config.supabaseUrl);
  if (config.supabaseAnonKey !== undefined) localStorage.setItem('solmint_supabase_anon_key', config.supabaseAnonKey);
  if (config.cloudflareWorkerEndpoint !== undefined) localStorage.setItem('solmint_cf_worker_url', config.cloudflareWorkerEndpoint);
  if (config.cloudflareApiKey !== undefined) localStorage.setItem('solmint_cf_worker_key', config.cloudflareApiKey);
}

export const CLOUDFLARE_D1_ARTICLES_SQL = `
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  tags TEXT DEFAULT '[]',
  summary TEXT,
  content TEXT,
  cover_image TEXT,
  cover_image_asset_id TEXT,
  video_url TEXT,
  author TEXT,
  published_at TEXT,
  published_at_jalali TEXT,
  published_at_gregorian TEXT,
  read_time_minutes INTEGER DEFAULT 5,
  views_count INTEGER DEFAULT 0,
  comments TEXT DEFAULT '[]',
  seo_score INTEGER DEFAULT 90,
  is_draft INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  permissions TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_id TEXT,
  text TEXT NOT NULL,
  approved INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_settings (
  id TEXT PRIMARY KEY DEFAULT 'main_settings',
  settings_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

/**
 * Reads articles through the trusted backend API first.
 * If the API path is unavailable, fall back to direct Supabase reads so the
 * public site can still render the latest published content.
 */
export async function fetchArticlesFromActiveDatabase(): Promise<Article[] | null> {
  try {
    const res = await fetch('/api/articles', { cache: 'no-store' });
    const data = await parseApiResponse(res);
    if (res.ok && data && Array.isArray(data.articles)) return data.articles;
  } catch (err) {
    console.warn('Error fetching articles from server API:', err);
  }

  const config = getDatabaseConfig();
  if (config.provider === 'cloudflare_d1' && config.cloudflareWorkerEndpoint) {
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/articles`, {
        headers: {
          Authorization: `Bearer ${config.cloudflareApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.articles || data;
      }
    } catch (err) {
      console.warn('Error fetching from Cloudflare D1:', err);
    }
  }

  try {
    const directArticles = await fetchArticlesFromSupabase();
    if (directArticles !== null) return directArticles;
  } catch (err) {
    console.warn('Error fetching articles directly from Supabase:', err);
  }

  return null;
}

/**
 * Manual article publishing goes through the trusted backend API.
 * The browser never writes directly to the protected Supabase table.
 *
 * On success this function shows a production popup. On failure it throws a
 * detailed error so the admin panel can display the real server-side reason.
 */
export async function saveArticleToActiveDatabase(article: Article): Promise<boolean> {
  const config = getDatabaseConfig();

  if (config.provider === 'cloudflare_d1' && config.cloudflareWorkerEndpoint) {
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/articles`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cloudflareApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(article)
      });

      const payload = await parseApiResponse(response);
      if (!response.ok || !payload?.success) {
        const message = payload?.message || `HTTP ${response.status}`;
        throw new Error(`انتشار مقاله ناموفق بود: ${message}`);
      }

      showSuccessPopup(payload?.message || `مقاله «${article.title}» با موفقیت منتشر شد.`);
      return true;
    } catch (err: any) {
      throw err instanceof Error ? err : new Error(`خطا در انتشار مقاله از طریق Cloudflare D1: ${err?.message || err}`);
    }
  }

  try {
    const passcode = getAdminPasscode();
    if (!passcode) {
      throw new Error('رمز ادمین در نشست فعلی پیدا نشد. لطفاً دوباره وارد پنل شوید.');
    }

    const response = await fetch('/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': passcode
      },
      body: JSON.stringify(article)
    });
    const data = await parseApiResponse(response);

    if (!response.ok || !data?.success) {
      const serverMessage = data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(`انتشار مقاله ناموفق بود: ${serverMessage}`);
    }

    showSuccessPopup(data?.message || `مقاله «${article.title}» با موفقیت منتشر شد.`);
    return true;
  } catch (err: any) {
    throw err instanceof Error ? err : new Error(`خطا در انتشار مقاله از طریق سرور: ${err?.message || err}`);
  }
}

/**
 * Manual article deletion remains server-only for the same RLS/security reason.
 */
export async function deleteArticleFromActiveDatabase(articleId: string): Promise<boolean> {
  const config = getDatabaseConfig();

  if (config.provider === 'cloudflare_d1' && config.cloudflareWorkerEndpoint) {
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/articles/${encodeURIComponent(articleId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.cloudflareApiKey}` }
      });
      return response.ok;
    } catch (err) {
      console.warn('Error deleting from Cloudflare D1:', err);
      return false;
    }
  }

  try {
    const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(getAdminPasscode() ? { 'x-admin-passcode': getAdminPasscode() } : {})
      }
    });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting article from server:', err);
    return false;
  }
}

export async function testDatabaseConnection(provider: DatabaseProvider): Promise<{ success: boolean; message: string }> {
  const config = getDatabaseConfig();

  if (provider === 'supabase') {
    try {
      const res = await fetch('/api/articles', { cache: 'no-store' });
      const data = await parseApiResponse(res);
      if (res.ok && data?.success) {
        return { success: true, message: 'اتصال به دیتابیس Supabase از طریق سرور برقرار است.' };
      }
      return { success: false, message: data?.message || `خطا در اتصال سرور به Supabase (HTTP ${res.status})` };
    } catch (err: any) {
      return { success: false, message: `عدم دسترسی به سرور: ${err?.message || err}` };
    }
  }

  if (provider === 'cloudflare_d1') {
    if (!config.cloudflareWorkerEndpoint) {
      return { success: false, message: 'لطفا آدرس Cloudflare Worker Endpoint را وارد کنید.' };
    }
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/health`, {
        headers: { Authorization: `Bearer ${config.cloudflareApiKey}` }
      });
      if (response.ok) return { success: true, message: 'اتصال به Cloudflare Worker / D1 برقرار است.' };
      return { success: false, message: `پاسخ ناموفق از ورکر کلادفلر (کد ${response.status})` };
    } catch (err: any) {
      return { success: false, message: `عدم دسترسی به سرویس کلادفلر: ${err?.message || err}` };
    }
  }

  return { success: true, message: 'حالت ذخیره‌سازی محلی (LocalStorage) فعال است.' };
}
