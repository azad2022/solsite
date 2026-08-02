import { Article, UserAccount, ArticleComment, DeepSeekAiSettings, ChatbotSettings, DownloadLinks } from '../types';

export interface CmsSettings {
  deepseek: DeepSeekAiSettings;
  chatbot: ChatbotSettings;
  downloads: DownloadLinks;
  security: {
    adminPasscode: string;
  };
}

/**
 * Helper to safely parse JSON from a fetch Response without throwing 'Unexpected end of JSON input'
 */
async function safeFetchJson<T = any>(res: Response): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return { ok: res.ok, status: res.status, data: null };
    }
    const parsed = JSON.parse(text) as T;
    return { ok: res.ok, status: res.status, data: parsed };
  } catch (err) {
    return { ok: res.ok, status: res.status, data: null };
  }
}

/**
 * Fetch all CMS Settings from real backend database
 */
export async function fetchCmsSettingsFromApi(): Promise<CmsSettings | null> {
  try {
    const res = await fetch('/api/cms/settings');
    const { ok, data } = await safeFetchJson(res);
    if (!ok || !data) return null;
    return data.settings || null;
  } catch (err) {
    console.warn('Error fetching CMS settings from API:', err);
    return null;
  }
}

/**
 * Save CMS Settings to real backend database
 */
export async function saveCmsSettingsToApi(settings: Partial<CmsSettings>): Promise<boolean> {
  try {
    const res = await fetch('/api/cms/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    return res.ok;
  } catch (err) {
    console.warn('Error saving CMS settings to API:', err);
    return false;
  }
}

/**
 * Register a new real user account in backend database
 */
export async function registerUserApi(payload: {
  username: string;
  fullName: string;
  passwordHash: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { ok, data, status } = await safeFetchJson(res);
    if (data) {
      return data;
    }
    return { 
      success: false, 
      message: ok 
        ? 'پاسخ معتبری از سرور دریافت نشد.' 
        : `خطا در برقراری ارتباط با سرور (کد status: ${status})` 
    };
  } catch (err: any) {
    return { success: false, message: `خطا در برقراری ارتباط با سرور: ${err.message || err}` };
  }
}

/**
 * Authenticate user login against backend database
 */
export async function loginUserApi(payload: {
  username?: string;
  passwordHash?: string;
  passcode?: string;
}): Promise<{ success: boolean; message?: string; user?: UserAccount; isSuperAdmin?: boolean }> {
  try {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { ok, data, status } = await safeFetchJson(res);
    if (data) {
      return data;
    }
    return { 
      success: false, 
      message: ok 
        ? 'پاسخ معتبری از سرور دریافت نشد.' 
        : `خطا در اتصال به سرور (کد status: ${status})` 
    };
  } catch (err: any) {
    return { success: false, message: `خطا در اتصال به سرور: ${err.message || err}` };
  }
}

/**
 * Fetch all registered users from backend database
 */
export async function fetchUsersApi(): Promise<UserAccount[]> {
  try {
    const res = await fetch('/api/users');
    const { ok, data } = await safeFetchJson(res);
    if (!ok || !data) return [];
    return data.users || [];
  } catch (err) {
    console.warn('Error fetching users:', err);
    return [];
  }
}

/**
 * Update user role/permissions in backend database
 */
export async function updateUserApi(payload: {
  userId: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.warn('Error updating user:', err);
    return false;
  }
}

/**
 * Delete user account from backend database
 */
export async function deleteUserApi(userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting user:', err);
    return false;
  }
}

/**
 * Submit real user comment for an article in backend database
 */
export async function addCommentApi(payload: {
  articleId: string;
  userName: string;
  userId?: string;
  text: string;
}): Promise<{ success: boolean; comment?: ArticleComment; message?: string }> {
  try {
    const res = await fetch('/api/comments/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { ok, data, status } = await safeFetchJson(res);
    if (data) {
      return data;
    }
    return { success: false, message: `خطا در ثبت دیدگاه (کد status: ${status})` };
  } catch (err: any) {
    return { success: false, message: err.message || 'خطا در ثبت دیدگاه.' };
  }
}

/**
 * Delete a comment from backend database
 */
export async function deleteCommentApi(commentId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/comments/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId })
    });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting comment:', err);
    return false;
  }
}

/**
 * Fetch articles from real backend database
 */
export async function fetchArticlesFromApi(): Promise<Article[] | null> {
  try {
    const res = await fetch('/api/articles');
    const { ok, data } = await safeFetchJson(res);
    if (!ok || !data) return null;
    return data.articles || null;
  } catch (err) {
    console.warn('Error fetching articles from API:', err);
    return null;
  }
}

/**
 * Save / publish article in real backend database
 */
export async function saveArticleToApi(article: Article): Promise<boolean> {
  try {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(article)
    });
    return res.ok;
  } catch (err) {
    console.warn('Error saving article to API:', err);
    return false;
  }
}

/**
 * Delete article from real backend database
 */
export async function deleteArticleFromApi(articleId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/articles/${articleId}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting article from API:', err);
    return false;
  }
}
