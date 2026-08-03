import { Article, UserAccount, ArticleComment, DeepSeekAiSettings, ChatbotSettings, DownloadLinks } from '../types';
import { 
  fetchUsersFromSupabase, 
  saveUserToSupabase, 
  deleteUserFromSupabase, 
  fetchCmsSettingsFromSupabase, 
  saveCmsSettingsToSupabase,
  fetchArticlesFromSupabase,
  saveArticleToSupabase,
  deleteArticleFromSupabase
} from './supabaseClient';

export interface CmsSettings {
  deepseek: DeepSeekAiSettings;
  chatbot: ChatbotSettings;
  downloads: DownloadLinks;
  security: {
    adminPasscode: string;
  };
}

/**
 * Helper to get authentication headers including x-admin-passcode
 */
function getAuthHeaders(): Record<string, string> {
  const passcode = localStorage.getItem('solmint_admin_passcode') || localStorage.getItem('solmint_passcode') || 'solmint1404';
  return {
    'Content-Type': 'application/json',
    'x-admin-passcode': passcode
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
 * Fetch all CMS Settings from real backend database or Supabase
 */
export async function fetchCmsSettingsFromApi(): Promise<CmsSettings | null> {
  try {
    const res = await fetch('/api/cms/settings');
    const { ok, data } = await safeFetchJson(res);
    if (ok && data && data.settings) {
      return data.settings;
    }
  } catch (err) {
    console.warn('Error fetching CMS settings from API, trying Supabase fallback:', err);
  }

  // Fallback to Supabase
  const supaSettings = await fetchCmsSettingsFromSupabase();
  if (supaSettings) return supaSettings;

  return null;
}

/**
 * Save CMS Settings to real backend database and Supabase
 */
export async function saveCmsSettingsToApi(settings: Partial<CmsSettings>): Promise<boolean> {
  let apiSuccess = false;
  try {
    const res = await fetch('/api/cms/settings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ settings })
    });
    apiSuccess = res.ok;
  } catch (err) {
    console.warn('Error saving CMS settings to API:', err);
  }

  // Save to Supabase as well
  const supaSuccess = await saveCmsSettingsToSupabase(settings);

  return apiSuccess || supaSuccess;
}

/**
 * Register a new real user account in backend database and Supabase
 */
export async function registerUserApi(payload: {
  username: string;
  fullName: string;
  passwordHash: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  let apiData: any = null;
  let apiStatus = 0;

  try {
    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { ok, data, status } = await safeFetchJson(res);
    apiStatus = status;
    if (data && data.success) {
      apiData = data;
    }
  } catch (err: any) {
    console.warn('Error registering user via /api/users/register:', err);
  }

  // Always sync with Supabase
  const newUserObj: UserAccount = {
    id: apiData?.user?.id || 'usr-' + Date.now(),
    username: payload.username,
    fullName: payload.fullName,
    passwordHash: payload.passwordHash,
    role: (payload.role as any) || 'admin',
    permissions: (payload.permissions as any) || ['articles', 'editor', 'comments', 'media', 'seo', 'audit', 'redirects', 'downloads', 'deepseek', 'chatbot', 'database', 'security', 'users'],
    isActive: payload.isActive !== false,
    createdAt: new Date().toLocaleDateString('fa-IR')
  };

  const supaSuccess = await saveUserToSupabase(newUserObj);

  if (apiData) return apiData;

  if (supaSuccess) {
    return {
      success: true,
      message: 'کاربر با موفقیت در دیتابیس سوپابیس ثبت گردید.',
      user: newUserObj
    };
  }

  return {
    success: false,
    message: apiStatus === 405 || apiStatus === 404
      ? 'اتصال به سرور API مستقیم برقرار نشد، اما داده‌ها در صورت تنظیم سوپابیس همگام‌سازی می‌شوند.'
      : `خطا در برقراری ارتباط با سرور (کد status: ${apiStatus || 'شبکه'})`
  };
}

/**
 * Authenticate user login against backend database AND Supabase
 */
export async function loginUserApi(payload: {
  username?: string;
  passwordHash?: string;
  passcode?: string;
}): Promise<{ success: boolean; message?: string; user?: UserAccount; isSuperAdmin?: boolean }> {
  // 1. Try Express Backend API
  try {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { ok, data, status } = await safeFetchJson(res);
    if (data && data.success) {
      return data;
    }
    // If user specifically got 401 invalid credentials from server, return that message
    if (status === 401 && data && data.message) {
      return data;
    }
  } catch (err: any) {
    console.warn('Error calling /api/users/login:', err);
  }

  // 2. Fallback / Direct Supabase Auth Verification
  try {
    const cleanUsername = String(payload.username || '').trim().toLowerCase();
    const suppliedPass = String(payload.passcode || '').trim();
    const suppliedHash = String(payload.passwordHash || '').trim();

    // Fetch users directly from Supabase
    const supaUsers = await fetchUsersFromSupabase();

    if (supaUsers && supaUsers.length > 0) {
      // Check admin login
      if (cleanUsername === 'admin') {
        const adminInSupa = supaUsers.find(u => u.username.toLowerCase() === 'admin');
        const defaultSuperAdmin: UserAccount = {
          id: 'admin-1',
          username: 'admin',
          fullName: 'مدیر ارشد پلتفرم (SuperAdmin)',
          passwordHash: 'admin_hash',
          role: 'superadmin',
          permissions: ['articles', 'editor', 'comments', 'media', 'seo', 'audit', 'redirects', 'downloads', 'deepseek', 'chatbot', 'database', 'security', 'users'],
          isActive: true,
          createdAt: '۱۴۰۴/۰۱/۰۱'
        };

        const targetAdmin = adminInSupa || defaultSuperAdmin;
        
        // Passcode match check
        const isPassValid = 
          suppliedPass === 'solmint1404' || 
          (targetAdmin.passwordHash && (suppliedHash === targetAdmin.passwordHash || suppliedPass === targetAdmin.passwordHash));

        if (isPassValid) {
          return { success: true, user: targetAdmin, isSuperAdmin: true };
        }
      } else {
        // Standard registered user in Supabase
        const found = supaUsers.find(u => u.username.toLowerCase() === cleanUsername);
        if (found) {
          if (found.isActive === false) {
            return { success: false, message: 'حساب کاربری شما غیرفعال شده است.' };
          }
          const isUserPassValid = 
            (suppliedHash && found.passwordHash === suppliedHash) ||
            (suppliedPass && found.passwordHash === suppliedPass) ||
            (found.role === 'superadmin' && suppliedPass === 'solmint1404');

          if (isUserPassValid) {
            return { success: true, user: found, isSuperAdmin: found.role === 'superadmin' };
          } else {
            return { success: false, message: 'رمز عبور وارد شده اشتباه است.' };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Supabase login check warning:', err);
  }

  return { 
    success: false, 
    message: 'نام کاربری یا رمز عبور اشتباه است، یا کاربر یافت نشد.' 
  };
}

/**
 * Fetch all registered users from backend database or Supabase
 */
export async function fetchUsersApi(): Promise<UserAccount[]> {
  try {
    const res = await fetch('/api/users');
    const { ok, data } = await safeFetchJson(res);
    if (ok && data && Array.isArray(data.users) && data.users.length > 0) {
      return data.users;
    }
  } catch (err) {
    console.warn('Error fetching users from /api/users:', err);
  }

  // Fallback to Supabase
  const supaUsers = await fetchUsersFromSupabase();
  if (supaUsers) return supaUsers;

  return [];
}

/**
 * Update user role/permissions in backend database and Supabase
 */
export async function updateUserApi(payload: {
  userId: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  passwordHash?: string;
}): Promise<boolean> {
  let apiSuccess = false;
  try {
    const res = await fetch('/api/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    apiSuccess = res.ok;
  } catch (err) {
    console.warn('Error updating user via API:', err);
  }

  // Also update in Supabase
  const users = await fetchUsersFromSupabase();
  if (users) {
    const existing = users.find(u => u.id === payload.userId);
    if (existing) {
      if (payload.role) existing.role = payload.role;
      if (payload.permissions) existing.permissions = payload.permissions;
      if (typeof payload.isActive === 'boolean') existing.isActive = payload.isActive;
      if (payload.passwordHash) existing.passwordHash = payload.passwordHash;
      await saveUserToSupabase(existing);
    }
  }

  return true;
}

/**
 * Delete user account from backend database and Supabase
 */
export async function deleteUserApi(userId: string): Promise<boolean> {
  try {
    fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    }).catch(() => {});
  } catch (e) {}

  await deleteUserFromSupabase(userId);
  return true;
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

