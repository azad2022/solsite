import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Article } from '../types';

let supabase: SupabaseClient | null = null;

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
 * SQL script to setup the articles table in Supabase
 */
export const SUPABASE_ARTICLES_TABLE_SQL = `-- 1. ساخت جدول مقالات سولمینت
CREATE TABLE IF NOT EXISTS public.articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    category TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    content TEXT,
    cover_image TEXT,
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

-- 2. فعال‌سازی دسترسی خواندن و نوشتن همگانی (Row Level Security Policy)
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Articles" ON public.articles;
CREATE POLICY "Public Read Articles" ON public.articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Articles" ON public.articles;
CREATE POLICY "Public Insert Articles" ON public.articles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Articles" ON public.articles;
CREATE POLICY "Public Update Articles" ON public.articles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Articles" ON public.articles;
CREATE POLICY "Public Delete Articles" ON public.articles FOR DELETE USING (true);

-- 3. ساخت جدول مدیریت رسانه‌های گیت‌هاب (Media Assets)
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

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Media Assets" ON public.media_assets;
CREATE POLICY "Public Read Media Assets" ON public.media_assets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Media Assets" ON public.media_assets;
CREATE POLICY "Public Write Media Assets" ON public.media_assets FOR ALL USING (true);

-- 4. ساخت جدول تنظیمات مخزن رسانه (Media Config)
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

ALTER TABLE public.media_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Media Config" ON public.media_config;
CREATE POLICY "Public Read Media Config" ON public.media_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Media Config" ON public.media_config;
CREATE POLICY "Public Write Media Config" ON public.media_config FOR ALL USING (true);
`;

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
        console.warn('⚠️ جدول articles در Supabase هنوز ساخته نشده است. لطفاً کدهای SQL ساخت جدول را در Supabase اجرا کنید.');
      } else {
        console.warn('⚠️ عدم امکان دریافت مقالات از Supabase:', error.message || error);
      }
      return null;
    }

    if (!data || data.length === 0) return null;

    // Map database snake_case fields back to Article object
    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      category: item.category,
      tags: item.tags || [],
      summary: item.summary,
      content: item.content,
      coverImage: item.cover_image,
      videoUrl: item.video_url,
      author: item.author || { name: 'تیم سولمینت', role: 'مدیریت', avatar: '⚡' },
      publishedAt: item.published_at,
      publishedAtJalali: item.published_at_jalali,
      publishedAtGregorian: item.published_at_gregorian,
      readTimeMinutes: item.read_time_minutes || 5,
      viewsCount: item.views_count || 0,
      comments: item.comments || [],
      seoScore: item.seo_score || 90,
      isDraft: item.is_draft || false
    }));
  } catch (err) {
    console.warn('Catch error in fetchArticlesFromSupabase:', err);
    return null;
  }
}

/**
 * Save or update a single article in Supabase
 */
export async function saveArticleToSupabase(article: Article): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const dbPayload = {
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
      is_draft: article.isDraft || false
    };

    const { error } = await client
      .from('articles')
      .upsert(dbPayload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert warning:', error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Catch error in saveArticleToSupabase:', err);
    return false;
  }
}

/**
 * Delete an article from Supabase
 */
export async function deleteArticleFromSupabase(articleId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('articles')
      .delete()
      .eq('id', articleId);

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
    const { data, error } = await client
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });

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

/**
 * Save or update a MediaAsset in Supabase
 */
export async function saveMediaAssetToSupabase(asset: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const dbPayload = {
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
    };

    const { error } = await client
      .from('media_assets')
      .upsert(dbPayload, { onConflict: 'id' });

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

/**
 * Delete a MediaAsset from Supabase
 */
export async function deleteMediaAssetFromSupabase(assetId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('media_assets')
      .delete()
      .eq('id', assetId);

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

/**
 * Fetch MediaStorageConfig from Supabase
 */
export async function fetchMediaConfigFromSupabase(): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('media_config')
      .select('*')
      .eq('id', 'active_config')
      .single();

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
  } catch (err) {
    return null;
  }
}

/**
 * Save MediaStorageConfig to Supabase
 */
export async function saveMediaConfigToSupabase(config: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const dbPayload = {
      id: 'active_config',
      provider: config.provider || 'github',
      github_owner: config.githubOwner,
      github_repository: config.githubRepository,
      branch: config.branch || 'main',
      base_path: config.basePath || 'articles/',
      connection_status: config.connectionStatus || 'untested',
      last_test_at: config.lastTestAt || new Date().toISOString()
    };

    const { error } = await client
      .from('media_config')
      .upsert(dbPayload, { onConflict: 'id' });

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

