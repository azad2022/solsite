import { Article, UserAccount, ArticleComment, DeepSeekAiSettings, ChatbotSettings, DownloadLinks } from '../types';
import {
  saveUserToSupabase,
  deleteUserFromSupabase,
  fetchArticlesFromSupabase,
  saveArticleToSupabase,
  deleteArticleFromSupabase
} from './supabaseClient';

export interface CmsSettings {
  deepseek: DeepSeekAiSettings;
  chatbot: ChatbotSettings;
  downloads: DownloadLinks;
  security?: { adminPasscode?: string };
}

const authFetchInit = (init: RequestInit = {}): RequestInit => ({
  ...init,
  credentials: 'include',
  headers: { ...(init.headers || {}) },
  cache: init.cache || 'no-store'
});

async function safeFetchJson<T = any>(res: Response): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) return { ok: res.ok, status: res.status, data: null };
    return { ok: res.ok, status: res.status, data: JSON.parse(text) as T };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}

export async function fetchCmsSettingsFromApi(): Promise<CmsSettings | null> {
  try {
    const res = await fetch('/api/cms/settings', authFetchInit());
    const { ok, data } = await safeFetchJson(res);
    if (ok && data && data.settings) return data.settings;
  } catch (err) { console.warn('Error fetching CMS settings from API:', err); }
  return null;
}

export async function saveCmsSettingsToApi(settings: Partial<CmsSettings>): Promise<boolean> {
  try {
    const res = await fetch('/api/cms/settings', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) }));
    return res.ok;
  } catch (err) { console.warn('Error saving CMS settings to API:', err); return false; }
}

export async function registerUserApi(payload: { username: string; fullName: string; passwordHash?: string; password?: string; role?: string; permissions?: string[]; isActive?: boolean }): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  const res = await fetch('/api/users/register', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
  const { data, status } = await safeFetchJson(res);
  if (data) return data;
  throw new Error(`خطا در ثبت حساب روی سرور (کد ${status || 'شبکه'}). ثبت‌نام محلی مجاز نیست.`);
}

/**
 * The server is authoritative. A failed authentication is deliberately returned
 * as a non-authenticated result with no user so legacy UI fallback branches
 * cannot turn an unavailable/invalid server into a local login.
 */
export async function loginUserApi(payload: { username?: string; password?: string; passwordHash?: string; passcode?: string }): Promise<{ success: boolean; message?: string; user?: UserAccount; isSuperAdmin?: boolean }> {
  try {
    const res = await fetch('/api/users/login', authFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: payload.username, password: payload.password || payload.passcode })
    }));
    const { data, status } = await safeFetchJson(res);

    if (data?.success && data.user) return data;

    // IMPORTANT: never return success:false here. The legacy modal contains
    // a fallback branch; this prevents that branch from ever authenticating.
    return {
      success: true,
      user: undefined,
      isSuperAdmin: false,
      message: data?.message || (status >= 500
        ? 'سرویس احراز هویت در دسترس نیست.'
        : 'نام کاربری یا رمز عبور اشتباه است.')
    };
  } catch (err) {
    console.warn('Error calling /api/users/login:', err);
    return {
      success: true,
      user: undefined,
      isSuperAdmin: false,
      message: 'ارتباط با سرور احراز هویت برقرار نشد.'
    };
  }
}

export async function fetchUsersApi(): Promise<UserAccount[]> {
  try {
    const res = await fetch('/api/users', authFetchInit());
    const { ok, data } = await safeFetchJson(res);
    if (ok && data && Array.isArray(data.users)) return data.users;
  } catch (err) { console.warn('Error fetching users from /api/users:', err); }
  return [];
}

export async function updateUserApi(payload: { userId: string; role?: string; permissions?: string[]; isActive?: boolean; passwordHash?: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/users/update', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    return res.ok;
  } catch (err) { console.warn('Error updating user via API:', err); return false; }
}

export async function deleteUserApi(userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/users/delete', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }));
    return res.ok;
  } catch (err) { console.warn('Error deleting user via API:', err); return false; }
}

export async function addCommentApi(payload: { articleId: string; userName: string; userId?: string; text: string }): Promise<{ success: boolean; comment?: ArticleComment; message?: string }> {
  try {
    const res = await fetch('/api/comments/add', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    const { data, status } = await safeFetchJson(res);
    if (data) return data;
    return { success: false, message: `خطا در ثبت دیدگاه (کد ${status})` };
  } catch (err: any) { return { success: false, message: err.message || 'خطا در ثبت دیدگاه.' }; }
}

export async function deleteCommentApi(commentId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/comments/delete', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId }) }));
    return res.ok;
  } catch (err) { console.warn('Error deleting comment:', err); return false; }
}

export async function fetchArticlesFromApi(): Promise<Article[] | null> {
  try {
    const res = await fetch('/api/articles', authFetchInit());
    const { ok, data } = await safeFetchJson(res);
    if (!ok || !data) return null;
    return data.articles || null;
  } catch (err) { console.warn('Error fetching articles from API:', err); return null; }
}

export async function saveArticleToApi(article: Article): Promise<boolean> {
  try {
    const res = await fetch('/api/articles', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(article) }));
    return res.ok;
  } catch (err) { console.warn('Error saving article to API:', err); return false; }
}

export async function deleteArticleFromApi(articleId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/articles/${articleId}`, authFetchInit({ method: 'DELETE' }));
    return res.ok;
  } catch (err) { console.warn('Error deleting article via API:', err); return false; }
}
