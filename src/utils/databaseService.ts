import { Article } from '../types';
import { 
  fetchArticlesFromSupabase, 
  saveArticleToSupabase, 
  deleteArticleFromSupabase,
  SUPABASE_ARTICLES_TABLE_SQL,
  getSupabaseClient
} from './supabaseClient';

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

export function getDatabaseConfig(): DatabaseConfig {
  const metaEnv = (import.meta as any).env || {};
  const storedProvider = (localStorage.getItem('solmint_db_provider') as DatabaseProvider) || 'supabase';
  const storedCloudflareUrl = localStorage.getItem('solmint_cf_worker_url') || '';
  const storedCloudflareKey = localStorage.getItem('solmint_cf_worker_key') || '';

  return {
    provider: storedProvider,
    supabaseUrl: metaEnv.VITE_SUPABASE_URL || localStorage.getItem('solmint_supabase_url') || DEFAULT_CONFIG.supabaseUrl,
    supabaseAnonKey: metaEnv.VITE_SUPABASE_ANON_KEY || localStorage.getItem('solmint_supabase_anon_key') || DEFAULT_CONFIG.supabaseAnonKey,
    cloudflareWorkerEndpoint: storedCloudflareUrl,
    cloudflareApiKey: storedCloudflareKey
  };
}

export function saveDatabaseConfig(config: Partial<DatabaseConfig>): void {
  if (config.provider) {
    localStorage.setItem('solmint_db_provider', config.provider);
  }
  if (config.supabaseUrl !== undefined) {
    localStorage.setItem('solmint_supabase_url', config.supabaseUrl);
  }
  if (config.supabaseAnonKey !== undefined) {
    localStorage.setItem('solmint_supabase_anon_key', config.supabaseAnonKey);
  }
  if (config.cloudflareWorkerEndpoint !== undefined) {
    localStorage.setItem('solmint_cf_worker_url', config.cloudflareWorkerEndpoint);
  }
  if (config.cloudflareApiKey !== undefined) {
    localStorage.setItem('solmint_cf_worker_key', config.cloudflareApiKey);
  }
}

/**
 * SQL Schema for Cloudflare D1 Database (SQLite)
 */
export const CLOUDFLARE_D1_ARTICLES_SQL = `-- 1. ساخت جدول مقالات در کلادفلر (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    category TEXT,
    tags TEXT DEFAULT '[]',
    summary TEXT,
    content TEXT,
    cover_image TEXT,
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

-- دستور ساخت جدول در Cloudflare CLI (npx wrangler):
-- npx wrangler d1 execute YOUR_DATABASE_NAME --command "KOD_HA_YI_BALA"
`;

/**
 * Universal Fetch Articles from whichever database provider is active
 */
export async function fetchArticlesFromActiveDatabase(): Promise<Article[] | null> {
  const config = getDatabaseConfig();

  if (config.provider === 'supabase') {
    return await fetchArticlesFromSupabase();
  }

  if (config.provider === 'cloudflare_d1') {
    if (!config.cloudflareWorkerEndpoint) {
      console.warn('⚠️ آدرس Cloudflare Worker Endpoint تنظیم نشده است.');
      return null;
    }
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/articles`, {
        headers: {
          'Authorization': `Bearer ${config.cloudflareApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.articles || data;
    } catch (err) {
      console.warn('Error fetching from Cloudflare D1:', err);
      return null;
    }
  }

  return null;
}

/**
 * Universal Save Article to active database
 */
export async function saveArticleToActiveDatabase(article: Article): Promise<boolean> {
  const config = getDatabaseConfig();

  if (config.provider === 'supabase') {
    return await saveArticleToSupabase(article);
  }

  if (config.provider === 'cloudflare_d1') {
    if (!config.cloudflareWorkerEndpoint) return false;
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/articles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudflareApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(article)
      });
      return response.ok;
    } catch (err) {
      console.warn('Error saving to Cloudflare D1:', err);
      return false;
    }
  }

  return true;
}

/**
 * Universal Delete Article from active database
 */
export async function deleteArticleFromActiveDatabase(articleId: string): Promise<boolean> {
  const config = getDatabaseConfig();

  if (config.provider === 'supabase') {
    return await deleteArticleFromSupabase(articleId);
  }

  if (config.provider === 'cloudflare_d1') {
    if (!config.cloudflareWorkerEndpoint) return false;
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/articles/${articleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${config.cloudflareApiKey}`
        }
      });
      return response.ok;
    } catch (err) {
      console.warn('Error deleting from Cloudflare D1:', err);
      return false;
    }
  }

  return true;
}

/**
 * Test Connection to the specified database provider
 */
export async function testDatabaseConnection(provider: DatabaseProvider): Promise<{ success: boolean; message: string }> {
  const config = getDatabaseConfig();

  if (provider === 'supabase') {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, message: 'تنظیمات Supabase (URL / Key) یافت نشد.' };
    }
    try {
      const { data, error } = await client.from('articles').select('id').limit(1);
      if (error) {
        if (error.code === '42P01') {
          return { success: false, message: 'اتصال موفق به Supabase برقرار شد، اما جدول "articles" هنوز ساخته نشده است.' };
        }
        return { success: false, message: `خطا در اتصال: ${error.message}` };
      }
      return { success: true, message: 'اتصال به دیتابیس Supabase کاملاً فعال و برقرار است!' };
    } catch (err: any) {
      return { success: false, message: `خطا در برقراری ارتباط: ${err.message || err}` };
    }
  }

  if (provider === 'cloudflare_d1') {
    if (!config.cloudflareWorkerEndpoint) {
      return { success: false, message: 'لطفا آدرس Cloudflare Worker Endpoint را وارد کنید.' };
    }
    try {
      const response = await fetch(`${config.cloudflareWorkerEndpoint}/api/health`, {
        headers: {
          'Authorization': `Bearer ${config.cloudflareApiKey}`
        }
      });
      if (response.ok) {
        return { success: true, message: 'اتصال به Cloudflare Worker / D1 برقرار است.' };
      }
      return { success: false, message: `پاسخ ناموفق از ورکر کلادفلر (کد ${response.status})` };
    } catch (err: any) {
      return { success: false, message: `عدم دسترسی به سرویس کلادفلر: ${err.message || err}` };
    }
  }

  return { success: true, message: 'حالت ذخیره‌سازی محلی (LocalStorage) فعال است.' };
}
