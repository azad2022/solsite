import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Article } from '../types';

let supabase: SupabaseClient | null = null;

function getAdminPasscode(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('solmint_admin_passcode') ||
    localStorage.getItem('solmint_passcode') ||
    ''
  ).trim();
}

function getAdminHeaders(): Record<string, string> {
  const passcode = getAdminPasscode();
  return {
    'Content-Type': 'application/json',
    ...(passcode ? { 'x-admin-passcode': passcode } : {})
  };
}

async function safeReadJson<T = any>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;

  const metaEnv = (import.meta as any).env || {};
  const url = metaEnv.VITE_SUPABASE_URL || localStorage.getItem('solmint_supabase_url') || 'https://nvopkbiedorfshwbmyhn.supabase.co';
  const key = metaEnv.VITE_SUPABASE_ANON_KEY || localStorage.getItem('solmint_supabase_anon_key') || 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt';

  if (url && key) {
    try {
      supabase = createClient(url, key);
      return supabase;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return null;
}

/**
 * SQL script to setup the tables used by the CMS.
 * Keep this available for admin copy/paste flows.
 */
export const SUPABASE_ARTICLES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  content TEXT,
  cover_image TEXT,
  cover_image_asset_id TEXT,
  video_url TEXT,
  author JSONB,
  published_at TEXT,
  published_at_jalali TEXT,
  published_at_gregorian TEXT,
  read_time_minutes INT DEFAULT 5,
  views_count INT DEFAULT 0,
  comments JSONB DEFAULT '[]'::jsonb,
  seo_score INT DEFAULT 90,
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id TEXT PRIMARY KEY,
  provider TEXT DEFAULT 'github',
  github_owner TEXT NOT NULL,
  github_repository TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT,
  file_size INT DEFAULT 0,
  width INT DEFAULT 0,
  height INT DEFAULT 0,
  sha TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_filename TEXT,
  alt_text TEXT DEFAULT '',
  title TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.media_config (
  id TEXT PRIMARY KEY DEFAULT 'active_config',
  provider TEXT DEFAULT 'github',
  github_owner TEXT NOT NULL,
  github_repository TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  base_path TEXT NOT NULL DEFAULT 'articles/',
  connection_status TEXT DEFAULT 'untested',
  last_test_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  permissions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cms_settings (
  id TEXT PRIMARY KEY DEFAULT 'main_settings',
  settings_json JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_id TEXT,
  text TEXT NOT NULL,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

/**
 * Fetch articles from Supabase table 'articles'
 */
export async function fetchArticlesFromSupabase(): Promise<Article[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('⚠️ جدول articles در Supabase هنوز ساخته نشده است.');
      } else {
        console.warn('⚠️ عدم امکان دریافت مقالات از Supabase:', error.message || error);
      }
      return null;
    }

    if (!data) return [];

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      category: item.category || 'آموزش سولانا',
      tags: item.tags || [],
      summary: item.summary || '',
      content: item.content || '',
      coverImage: item.cover_image || '/images/blog-og.jpg',
      videoUrl: item.video_url || undefined,
      author: item.author || { name: 'تیم سولمینت', role: 'مدیریت', avatar: '⚡' },
      publishedAt: item.published_at || item.created_at || new Date().toISOString().split('T')[0],
      publishedAtJalali: item.published_at_jalali || '',
      publishedAtGregorian: item.published_at_gregorian || '',
      readTimeMinutes: item.read_time_minutes || 5,
      viewsCount: item.views_count || 0,
      comments: item.comments || [],
      seoScore: item.seo_score || 90,
      isDraft: Boolean(item.is_draft)
    }));
  } catch (err) {
    console.warn('Catch error in fetchArticlesFromSupabase:', err);
    return null;
  }
}

/**
 * Save or update a single article.
 * Browser executions must use the trusted server API so the client never
 * writes directly to the protected Supabase table.
 */
export async function saveArticleToSupabase(article: Article): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(article)
      });
      if (!res.ok) return false;
      const data = await safeReadJson<{ success?: boolean }>(res);
      return Boolean(data?.success ?? true);
    } catch (err) {
      console.error('Error saving article through server API:', err);
      return false;
    }
  }

  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('articles').upsert({
      id: article.id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      tags: article.tags,
      summary: article.summary,
      content: article.content,
      cover_image: article.coverImage,
      cover_image_asset_id: article.coverImageAssetId || null,
      video_url: article.videoUrl || null,
      author: article.author,
      published_at: article.publishedAt,
      published_at_jalali: article.publishedAtJalali || null,
      published_at_gregorian: article.publishedAtGregorian || null,
      read_time_minutes: article.readTimeMinutes,
      views_count: article.viewsCount,
      comments: article.comments,
      seo_score: article.seoScore || 90,
      is_draft: article.isDraft ? 1 : 0
    }, { onConflict: 'id' });

    if (error) {
      console.error('❌ Supabase article upsert error:', error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Catch error in saveArticleToSupabase:', err);
    return false;
  }
}

/**
 * Delete an article.
 */
export async function deleteArticleFromSupabase(articleId: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      if (!res.ok) return false;
      const data = await safeReadJson<{ success?: boolean }>(res);
      return Boolean(data?.success ?? true);
    } catch (err) {
      console.error('Error deleting article through server API:', err);
      return false;
    }
  }

  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('articles').delete().eq('id', articleId);
    if (error) {
      console.warn('Supabase delete warning:', error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Catch error in deleteArticleFromSupabase:', err);
    return false;
  }
}

/**
 * Fetch all MediaAssets from Supabase
 */
export async function fetchMediaAssetsFromSupabase(): Promise<any[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from('media_assets').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('⚠️ Could not fetch media assets from Supabase:', error.message);
      return null;
    }
    if (!data) return [];

    return data.map((item: any) => ({
      id: item.id,
      provider: item.provider || 'github',
      githubOwner: item.github_owner,
      githubRepository: item.github_repository,
      branch: item.branch || 'main',
      path: item.path,
      filename: item.filename,
      publicUrl: item.public_url,
      mimeType: item.mime_type,
      fileSize: item.file_size || 0,
      width: item.width || 0,
      height: item.height || 0,
      sha: item.sha || '',
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      originalFilename: item.original_filename || item.filename,
      altText: item.alt_text || '',
      title: item.title || ''
    }));
  } catch (err) {
    console.warn('Catch error in fetchMediaAssetsFromSupabase:', err);
    return null;
  }
}

export async function saveMediaAssetToSupabase(asset: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('media_assets').upsert({
      id: asset.id,
      provider: asset.provider || 'github',
      github_owner: asset.githubOwner,
      github_repository: asset.githubRepository,
      branch: asset.branch || 'main',
      path: asset.path,
      filename: asset.filename,
      public_url: asset.publicUrl,
      mime_type: asset.mimeType,
      file_size: asset.fileSize || 0,
      width: asset.width || 0,
      height: asset.height || 0,
      sha: asset.sha || '',
      original_filename: asset.originalFilename || asset.filename,
      alt_text: asset.altText || '',
      title: asset.title || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase media asset upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Catch error in saveMediaAssetToSupabase:', err);
    return false;
  }
}

export async function deleteMediaAssetFromSupabase(assetId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('media_assets').delete().eq('id', assetId);
    if (error) {
      console.warn('Supabase media asset delete warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Catch error in deleteMediaAssetFromSupabase:', err);
    return false;
  }
}

export async function fetchMediaConfigFromSupabase(): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from('media_config').select('*').eq('id', 'active_config').single();
    if (error || !data) return null;
    return {
      provider: data.provider || 'github',
      githubOwner: data.github_owner,
      githubRepository: data.github_repository,
      branch: data.branch || 'main',
      basePath: data.base_path || 'articles/',
      connectionStatus: data.connection_status || 'untested',
      lastTestAt: data.last_test_at || null
    };
  } catch {
    return null;
  }
}

export async function saveMediaConfigToSupabase(config: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('media_config').upsert({
      id: 'active_config',
      provider: config.provider || 'github',
      github_owner: config.githubOwner,
      github_repository: config.githubRepository,
      branch: config.branch || 'main',
      base_path: config.basePath || 'articles/',
      connection_status: config.connectionStatus || 'untested',
      last_test_at: config.lastTestAt || new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase media config upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Catch error in saveMediaConfigToSupabase:', err);
    return false;
  }
}

export async function fetchUsersFromSupabase(): Promise<any[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('⚠️ Could not fetch users from Supabase:', error.message);
      return null;
    }
    if (!data) return [];
    return data.map((item: any) => ({
      id: item.id,
      username: item.username,
      fullName: item.full_name,
      passwordHash: item.password_hash,
      role: item.role || 'admin',
      permissions: Array.isArray(item.permissions) ? item.permissions : (item.permissions ? JSON.parse(item.permissions) : []),
      isActive: item.is_active !== false,
      createdAt: item.created_at
    }));
  } catch (err) {
    console.warn('Catch error in fetchUsersFromSupabase:', err);
    return null;
  }
}

export async function saveUserToSupabase(user: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('users').upsert({
      id: user.id || 'usr-' + Date.now(),
      username: String(user.username).trim(),
      full_name: String(user.fullName || user.full_name || '').trim(),
      password_hash: String(user.passwordHash || user.password_hash || '').trim(),
      role: user.role || 'admin',
      permissions: user.permissions || [],
      is_active: user.isActive !== false
    }, { onConflict: 'username' });

    if (error) {
      console.warn('Supabase user upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Catch error in saveUserToSupabase:', err);
    return false;
  }
}

export async function deleteUserFromSupabase(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('users').delete().eq('id', userId);
    if (error) {
      console.warn('Supabase user delete warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Catch error in deleteUserFromSupabase:', err);
    return false;
  }
}

export async function fetchCmsSettingsFromSupabase(): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from('cms_settings').select('*').eq('id', 'main_settings').single();
    if (error || !data || !data.settings_json) return null;
    return typeof data.settings_json === 'string' ? JSON.parse(data.settings_json) : data.settings_json;
  } catch {
    return null;
  }
}

export async function saveCmsSettingsToSupabase(settings: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('cms_settings').upsert({
      id: 'main_settings',
      settings_json: settings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase cms_settings upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Catch error in saveCmsSettingsToSupabase:', err);
    return false;
  }
}
