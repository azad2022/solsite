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

export interface ModerationComment extends ArticleComment {
  approved?: boolean;
  parentId?: string | null;
  likeCount?: number;
  dislikeCount?: number;
  createdAtIso?: string | null;
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
  } catch (err) { console.warn('Error saving CMS settings from API:', err); return false; }
}

export async function registerUserApi(payload: { username: string; fullName: string; password?: string; role?: string; permissions?: string[]; isActive?: boolean }): Promise<{ success: boolean; message: string; user?: UserAccount; requestId?: string }> {
  try {
    const res = await fetch('/api/users/register', authFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }));
    const { data, status } = await safeFetchJson<{ success?: boolean; message?: string; user?: UserAccount; requestId?: string }>(res);
    if (data) {
      return {
        success: Boolean(data.success) && Boolean(data.user),
        message: data.message || (res.ok ? 'ثبت‌نام انجام نشد.' : 'ثبت‌نام انجام نشد.'),
        user: data.user,
        requestId: data.requestId
      };
    }
    return {
      success: false,
      message: status >= 500
        ? 'سرویس ثبت‌نام در دسترس نیست. لطفاً دوباره تلاش کنید.'
        : `ثبت‌نام انجام نشد (کد ${status || 'نامشخص'}).`
    };
  } catch (err) {
    console.warn('Error calling /api/users/register:', err);
    return { success: false, message: 'ارتباط با سرور ثبت‌نام برقرار نشد.' };
  }
}

/** Server is authoritative. Authentication state is never synthesized in the browser. */
export async function loginUserApi(payload: { username?: string; password?: string; passcode?: string }): Promise<{ success: boolean; message?: string; user?: UserAccount; isSuperAdmin?: boolean; requestId?: string }> {
  try {
    const res = await fetch('/api/users/login', authFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: payload.username, password: payload.password || payload.passcode })
    }));
    const { data, status } = await safeFetchJson<{ success?: boolean; message?: string; user?: UserAccount; isSuperAdmin?: boolean; requestId?: string }>(res);

    if (data?.success && data.user) return data;

    return {
      success: false,
      user: undefined,
      isSuperAdmin: false,
      requestId: data?.requestId,
      message: data?.message || (status >= 500
        ? 'سرویس احراز هویت در دسترس نیست.'
        : 'نام کاربری یا رمز عبور اشتباه است.')
    };
  } catch (err) {
    console.warn('Error calling /api/users/login:', err);
    return {
      success: false,
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

export async function updateUserApi(payload: { userId: string; role?: string; permissions?: string[]; isActive?: boolean; password?: string }): Promise<boolean> {
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

export async function addCommentApi(payload: { articleId: string; userName: string; userId?: string; text: string; parentId?: string | null }): Promise<{ success: boolean; comment?: ArticleComment; message?: string }> {
  try {
    const res = await fetch('/api/comments/add', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    const { data, status } = await safeFetchJson(res);
    if (data) return data;
    return { success: false, message: `خطا در ثبت دیدگاه (کد ${status})` };
  } catch (err: any) { return { success: false, message: err.message || 'خطا در ثبت دیدگاه.' }; }
}

export async function fetchCommentsForAdminApi(): Promise<{ success: boolean; comments: ModerationComment[]; message?: string }> {
  try {
    const res = await fetch('/api/comments?admin=1', authFetchInit());
    const { data, status } = await safeFetchJson<{ success?: boolean; comments?: ModerationComment[]; message?: string }>(res);
    if (data) return { success: !!data.success, comments: Array.isArray(data.comments) ? data.comments : [], message: data.message };
    return { success: false, comments: [], message: `خطا در دریافت دیدگاه‌ها (کد ${status})` };
  } catch (err: any) {
    return { success: false, comments: [], message: err?.message || 'خطا در دریافت دیدگاه‌ها.' };
  }
}

export async function approveCommentApi(commentId: string, approved: boolean): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/comments/approve', authFetchInit({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId, approved }) }));
    const { data } = await safeFetchJson<{ success?: boolean; message?: string }>(res);
    return { success: res.ok && !!data?.success, message: data?.message };
  } catch (err: any) {
    return { success: false, message: err?.message || 'خطا در تغییر وضعیت دیدگاه.' };
  }
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
