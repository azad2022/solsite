import { Article, UserAccount, ArticleComment, DeepSeekAiSettings, ChatbotSettings, DownloadLinks } from '../types';
import { saveUserToSupabase, deleteUserFromSupabase, fetchArticlesFromSupabase, saveArticleToSupabase, deleteArticleFromSupabase } from './supabaseClient';

export interface CmsSettings {
  deepseek: DeepSeekAiSettings;
  chatbot: ChatbotSettings;
  downloads: DownloadLinks;
  security: { adminPasscode: string };
}

function getAuthHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

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
    const res = await fetch('/api/cms/settings', { cache: 'no-store' });
    const { ok, data } = await safeFetchJson(res);
    if (ok && data && data.settings) return data.settings;
  } catch (err) { console.warn('Error fetching CMS settings from API:', err); }
  return null;
}

export async function saveCmsSettingsToApi(settings: Partial<CmsSettings>): Promise<boolean> {
  try {
    const res = await fetch('/api/cms/settings', { method: 'POST', headers: getAuthHeaders(), cache: 'no-store', body: JSON.stringify({ settings }) });
    return res.ok;
  } catch (err) { console.warn('Error saving CMS settings to API:', err); return false; }
}

export async function registerUserApi(payload: { username: string; fullName: string; passwordHash: string; role?: string; permissions?: string[]; isActive?: boolean }): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch('/api/users/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const { data, status } = await safeFetchJson(res);
    if (data) return data;
    return { success: false, message: `خطا در برقراری ارتباط با سرور (کد ${status || 'شبکه'})` };
  } catch (err: any) { return { success: false, message: err?.message || 'خطا در برقراری ارتباط با سرور.' }; }
}

export async function loginUserApi(payload: { username?: string; password?: string; passwordHash?: string; passcode?: string }): Promise<{ success: boolean; message?: string; user?: UserAccount; isSuperAdmin?: boolean }> {
  try {
    const password = String(payload.password ?? payload.passcode ?? '').trim();
    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ username: payload.username, password })
    });
    const { data, status } = await safeFetchJson(res);
    if (data) return data;
    return { success: false, message: status >= 500 ? 'سرویس احراز هویت سرور در دسترس نیست.' : 'نام کاربری یا رمز عبور اشتباه است.' };
  } catch (err: any) {
    console.warn('Error calling /api/users/login:', err);
    return { success: false, message: 'ارتباط با سرور احراز هویت برقرار نشد.' };
  }
}

export async function getCurrentAuthUserApi(): Promise<{ success: boolean; user?: UserAccount; isSuperAdmin?: boolean }> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
    const { data } = await safeFetchJson(res);
    return data || { success: false };
  } catch { return { success: false }; }
}

export async function logoutUserApi(): Promise<void> {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' }); } catch (err) { console.warn('Logout request failed:', err); }
}

export async function fetchUsersApi(): Promise<UserAccount[]> {
  try {
    const res = await fetch('/api/users', { cache: 'no-store' });
    const { ok, data } = await safeFetchJson(res);
    if (ok && data && Array.isArray(data.users)) return data.users;
  } catch (err) { console.warn('Error fetching users from /api/users:', err); }
  return [];
}

export async function updateUserApi(payload: { userId: string; role?: string; permissions?: string[]; isActive?: boolean; passwordHash?: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/users/update', { method: 'POST', headers: getAuthHeaders(), cache: 'no-store', body: JSON.stringify(payload) });
    return res.ok;
  } catch (err) { console.warn('Error updating user via API:', err); return false; }
}

export async function deleteUserApi(userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/users/delete', { method: 'POST', headers: getAuthHeaders(), cache: 'no-store', body: JSON.stringify({ userId }) });
    return res.ok;
  } catch (err) { console.warn('Error deleting user via API:', err); return false; }
}

export async function addCommentApi(payload: { articleId: string; userName: string; userId?: string; text: string }): Promise<{ success: boolean; comment?: ArticleComment; message?: string }> {
  try {
    const res = await fetch('/api/comments/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const { data, status } = await safeFetchJson(res);
    if (data) return data;
    return { success: false, message: `خطا در ثبت دیدگاه (کد ${status})` };
  } catch (err: any) { return { success: false, message: err.message || 'خطا در ثبت دیدگاه.' }; }
}

export async function deleteCommentApi(commentId: string): Promise<boolean> {
  try { const res = await fetch('/api/comments/delete', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ commentId }) }); return res.ok; }
  catch (err) { console.warn('Error deleting comment:', err); return false; }
}

export async function fetchArticlesFromApi(): Promise<Article[] | null> {
  try {
    const res = await fetch('/api/articles', { cache: 'no-store' });
    const { ok, data } = await safeFetchJson(res);
    if (!ok || !data) return null;
    return data.articles || null;
  } catch (err) { console.warn('Error fetching articles from API:', err); return null; }
}

export async function saveArticleToApi(article: Article): Promise<boolean> {
  try { const res = await fetch('/api/articles', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(article) }); return res.ok; }
  catch (err) { console.warn('Error saving article to API:', err); return false; }
}

export async function deleteArticleFromApi(articleId: string): Promise<boolean> {
  try { const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE', headers: getAuthHeaders() }); return res.ok; }
  catch (err) { console.warn('Error deleting article from API:', err); return false; }
}
