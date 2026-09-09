type AuthClientErrorLike = {
  status?: number;
  code?: string;
  message?: string;
  statusText?: string;
};

const SAFE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'ایمیل یا رمز عبور صحیح نیست.',
  USERNAME_NOT_FOUND: 'نام کاربری یا رمز عبور صحیح نیست.',
  USER_NOT_FOUND: 'ایمیل یا نام کاربری پیدا نشد.',
  TOO_MANY_REQUESTS: 'تعداد تلاش‌ها زیاد است. چند دقیقه بعد دوباره امتحان کنید.',
  RATE_LIMITED: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
  ACCOUNT_NOT_FOUND: 'حساب موردنظر پیدا نشد.',
  EMAIL_NOT_VERIFIED: 'ایمیل شما هنوز تأیید نشده است. ایمیل تأیید را بررسی کنید و سپس دوباره وارد شوید.',
  USER_ALREADY_EXISTS: 'حسابی با این ایمیل قبلاً ثبت شده است. وارد حساب شوید.',
  USERNAME_ALREADY_EXISTS: 'این نام کاربری قبلاً استفاده شده است.',
  INVALID_EMAIL: 'فرمت ایمیل صحیح نیست.',
  INVALID_USERNAME: 'نام کاربری معتبر نیست.',
  PASSWORD_TOO_SHORT: 'رمز عبور انتخاب‌شده به اندازه کافی قوی نیست.',
  ACCOUNT_NOT_LINKED: 'این حساب Google به حساب SolMint متصل نیست.',
  ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER: 'این حساب Google قبلاً به کاربر دیگری متصل شده است.',
  OAUTH_PROVIDER_NOT_FOUND: 'ورود با Google در این محیط فعال نیست.',
  EMAIL_NOT_FOUND: 'Google ایمیل معتبری برای این حساب برنگرداند.',
  AUTH_CONFIG_MISSING: 'پیکربندی ضروری احراز هویت در این محیط کامل نیست. لطفاً پیکربندی deployment را بررسی کنید.',
  AUTH_GOOGLE_CONFIG: 'پیکربندی Google OAuth در این محیط کامل نیست.',
  AUTH_DATABASE_CONFIG: 'اتصال امن سرویس احراز هویت به پایگاه‌داده آماده نیست.',
  AUTH_RUNTIME_INIT_FAILED: 'سرویس احراز هویت هنگام راه‌اندازی روی سرور با خطا مواجه شد.',
  AUTH_REQUEST_FAILED: 'سرویس احراز هویت هنگام پردازش درخواست با خطا مواجه شد.',
  AUTH_SERVICE_UNAVAILABLE: 'سرویس احراز هویت در حال حاضر در دسترس نیست.',
};

function normalizeCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function getAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  return normalizeCode((error as AuthClientErrorLike).code);
}

export function authErrorMessage(error: unknown, fallback: string): string {
  const candidate = (error && typeof error === 'object') ? error as AuthClientErrorLike : null;
  const code = getAuthErrorCode(error);

  if (candidate?.status === 403 || code === 'EMAIL_NOT_VERIFIED') {
    return SAFE_AUTH_ERROR_MESSAGES.EMAIL_NOT_VERIFIED;
  }

  if (code && SAFE_AUTH_ERROR_MESSAGES[code]) {
    return SAFE_AUTH_ERROR_MESSAGES[code];
  }

  if (candidate?.status === 429) {
    return SAFE_AUTH_ERROR_MESSAGES.RATE_LIMITED;
  }

  if (candidate?.status === 503) {
    return SAFE_AUTH_ERROR_MESSAGES.AUTH_SERVICE_UNAVAILABLE;
  }

  const message = typeof candidate?.message === 'string' ? candidate.message.trim() : '';
  if (message && !/sql|postgres|supabase|database|secret|token|key|stack|undefined|exception|econn|fetch failed/i.test(message)) {
    return message;
  }

  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function authDiagnosticLabel(error: unknown): string | null {
  const code = getAuthErrorCode(error);
  const candidate = (error && typeof error === 'object') ? error as AuthClientErrorLike : null;

  if (code) return code;
  if (candidate?.status === 503) return 'AUTH_SERVICE_UNAVAILABLE';
  if (candidate?.status === 429) return 'RATE_LIMITED';
  if (candidate?.status === 403) return 'EMAIL_NOT_VERIFIED';
  return null;
}
