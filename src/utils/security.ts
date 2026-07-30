// Utility functions for security, sanitization, and local storage safety

/**
 * Safely parse JSON from localStorage with a fallback
 */
export function safeGetLocalStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch (err) {
    console.warn(`[Security] Failed to parse localStorage key "${key}":`, err);
    return fallback;
  }
}

/**
 * Safely save data to localStorage
 */
export function safeSetLocalStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[Security] Failed to set localStorage key "${key}":`, err);
    return false;
  }
}

/**
 * Sanitize plain text strings against XSS / HTML injection attacks
 */
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

/**
 * Validate username format
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (trimmed.length < 3) {
    return { valid: false, error: 'نام کاربری باید حداقل ۳ کاراکتر باشد.' };
  }
  if (trimmed.length > 30) {
    return { valid: false, error: 'نام کاربری نمی‌تواند بیش از ۳۰ کاراکتر باشد.' };
  }
  // Allow letters, numbers, underscores, and Persian characters
  const validRegex = /^[\w\d_@.\u0600-\u06FF\s-]+$/;
  if (!validRegex.test(trimmed)) {
    return { valid: false, error: 'نام کاربری شامل کاراکترهای غیرمجاز است.' };
  }
  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 5) {
    return { valid: false, error: 'رمز عبور باید حداقل ۵ کاراکتر باشد.' };
  }
  return { valid: true };
}
