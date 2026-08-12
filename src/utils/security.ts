// Utility functions for security, sanitization, and local storage safety

const LEGACY_AUTH_KEYS = new Set([
  'solmint_admin_passcode',
  'solmint_admin_pass_hash',
  'solmint_admin_session',
  'solmint_current_user'
]);

let authStorageGuardInstalled = false;

export function installAuthStorageGuard(): void {
  if (typeof window === 'undefined' || authStorageGuardInstalled) return;
  authStorageGuardInstalled = true;

  try {
    const storage = window.localStorage;
    for (const key of LEGACY_AUTH_KEYS) storage.removeItem(key);

    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;

    Storage.prototype.setItem = function(key: string, value: string): void {
      if (this === storage && LEGACY_AUTH_KEYS.has(key)) return;
      return originalSetItem.call(this, key, value);
    };

    Storage.prototype.getItem = function(key: string): string | null {
      if (this === storage && LEGACY_AUTH_KEYS.has(key)) return null;
      return originalGetItem.call(this, key);
    };
  } catch {
    // Server authorization remains authoritative even if this defense-in-depth guard cannot install.
  }
}

installAuthStorageGuard();

export function safeGetLocalStorage<T>(key: string, fallback: T): T {
  try {
    if (LEGACY_AUTH_KEYS.has(key)) return fallback;
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch (err) {
    console.warn(`[Security] Failed to parse localStorage key "${key}":`, err);
    return fallback;
  }
}

export function safeSetLocalStorage<T>(key: string, value: T): boolean {
  try {
    if (LEGACY_AUTH_KEYS.has(key)) return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[Security] Failed to set localStorage key "${key}":`, err);
    return false;
  }
}

/** Safely escape plain text before it is stored or rendered into HTML-capable contexts. */
export function sanitizeText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (trimmed.length < 3) return { valid: false, error: 'نام کاربری باید حداقل ۳ کاراکتر باشد.' };
  if (trimmed.length > 30) return { valid: false, error: 'نام کاربری نمی‌تواند بیش از ۳۰ کاراکتر باشد.' };
  const validRegex = /^[\w\d_@.\u0600-\u06FF\s-]+$/u;
  if (!validRegex.test(trimmed)) return { valid: false, error: 'نام کاربری شامل کاراکترهای غیرمجاز است.' };
  return { valid: true };
}

/** Keep client validation aligned with the production auth endpoint. */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' };
  if (password.length > 1024) return { valid: false, error: 'رمز عبور بیش از حد مجاز طولانی است.' };
  return { valid: true };
}
