import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, Chrome, Eye, EyeOff, Loader2, LockKeyhole, Mail, MailCheck, ShieldCheck, UserPlus, X } from 'lucide-react';
import { authClient, fetchApplicationUser } from '../utils/authClient';
import type { UserAccount } from '../types';

interface AdminAuthGateProps {
  isOpen: boolean;
  onClose: () => void;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserAccount | null>>;
}

type Mode = 'login' | 'register';
type AuthState = 'idle' | 'loading' | 'verification' | 'error';
type SafeApplicationUser = Omit<UserAccount, 'passwordHash'>;

type ApplicationUserResponse = {
  success?: boolean;
  user?: unknown;
};

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  email_not_verified: 'ایمیل حساب Google هنوز تأیید نشده است.',
  state_mismatch: 'نشست امنیتی ورود با Google منقضی یا نامعتبر شده است. دوباره تلاش کنید.',
  state_invalid: 'اطلاعات امنیتی ورود با Google معتبر نیست. دوباره تلاش کنید.',
  invalid_code: 'کد ورود Google معتبر نیست یا قبلاً استفاده شده است. دوباره تلاش کنید.',
  invalid_grant: 'مجوز Google منقضی شده است. دوباره تلاش کنید.',
  account_not_linked: 'این حساب Google به حساب سولمینت متصل نیست.',
  oauth_provider_not_found: 'ورود با Google در این محیط فعال نیست.',
  email_not_found: 'Google ایمیل معتبری برای این حساب برنگرداند.',
};

function callbackErrorFromLocation(): string | null {
  const error = new URLSearchParams(window.location.search).get('error');
  return error ? CALLBACK_ERROR_MESSAGES[error] || `ورود با Google ناموفق بود (${error}).` : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const candidate = error as { status?: number; code?: string; message?: string };
    if (candidate.status === 403 || candidate.code === 'EMAIL_NOT_VERIFIED') {
      return 'ایمیل شما هنوز تأیید نشده است. ایمیل تأیید را بررسی کنید و سپس دوباره وارد شوید.';
    }
    if (candidate.code === 'INVALID_EMAIL_OR_PASSWORD') return 'ایمیل یا رمز عبور صحیح نیست.';
    if (candidate.code === 'USERNAME_NOT_FOUND') return 'نام کاربری یا رمز عبور صحیح نیست.';
    if (candidate.code === 'USER_NOT_FOUND') return 'ایمیل یا نام کاربری پیدا نشد.';
    if (candidate.code === 'TOO_MANY_REQUESTS') return 'تعداد تلاش‌ها زیاد است. چند دقیقه بعد دوباره امتحان کنید.';
    if (candidate.code === 'RATE_LIMITED') return 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.';
    if (candidate.code === 'ACCOUNT_NOT_FOUND') return 'حساب موردنظر پیدا نشد.';
    if (candidate.message?.trim()) return candidate.message;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

async function readApplicationUser(): Promise<SafeApplicationUser | null> {
  const response = await fetchApplicationUser();
  const payload = (await response.json().catch(() => null)) as ApplicationUserResponse | null;
  if (response.status === 401) return null;
  if (!response.ok || payload?.success !== true || !payload.user || typeof payload.user !== 'object') return null;

  const value = payload.user as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id.trim()) return null;
  const role = typeof value.role === 'string' ? value.role : 'user';
  if (!['superadmin', 'admin', 'editor', 'writer', 'user'].includes(role)) return null;

  const permissions = Array.isArray(value.permissions) && value.permissions.every((item) => typeof item === 'string')
    ? value.permissions as UserAccount['permissions']
    : undefined;

  return {
    id: value.id,
    username: typeof value.username === 'string' ? value.username : '',
    fullName: typeof value.fullName === 'string' ? value.fullName : '',
    role: role as UserAccount['role'],
    permissions,
    isActive: value.isActive !== false,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
  };
}

export function AdminAuthGate({ isOpen, onClose, setCurrentUser }: AdminAuthGateProps): React.ReactElement | null {
  const titleId = useId();
  const identifierId = useId();
  const nameId = useId();
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [state, setState] = useState<AuthState>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const callbackMessage = callbackErrorFromLocation();
    setState(callbackMessage ? 'error' : 'idle');
    setMessage(callbackMessage || '');
    setPendingVerificationEmail('');
    if (callbackMessage && window.location.search.includes('error=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state !== 'loading') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, state]);

  useEffect(() => {
    if (!isOpen) return;
    const focusTarget = document.querySelector<HTMLInputElement>(mode === 'login' ? `#${identifierId}` : `#${nameId}`);
    focusTarget?.focus();
  }, [identifierId, isOpen, mode, nameId]);

  if (!isOpen) return null;

  const isLoading = state === 'loading';

  const resetMode = (nextMode: Mode) => {
    if (isLoading) return;
    setMode(nextMode);
    setState('idle');
    setMessage('');
    setPendingVerificationEmail('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setState('loading');
    setMessage('');

    try {
      if (mode === 'register') {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim().toLowerCase();
        if (!name.trim() || !normalizedUsername || !normalizedEmail || !password) {
          throw new Error('نام، نام کاربری، ایمیل و رمز عبور الزامی است.');
        }
        const { error } = await authClient.signUp.email({
          email: normalizedEmail,
          name: name.trim(),
          password,
          username: normalizedUsername,
        });
        if (error) throw error;
        setPendingVerificationEmail(normalizedEmail);
        setState('verification');
        setMessage('حساب ایجاد شد. ایمیل تأیید برای شما ارسال شده است. پس از تأیید ایمیل، با همین اطلاعات وارد شوید.');
        return;
      }

      const value = identifier.trim();
      if (!value || !password) throw new Error('ایمیل یا نام کاربری و رمز عبور الزامی است.');
      const result = value.includes('@')
        ? await authClient.signIn.email({ email: value.toLowerCase(), password })
        : await authClient.signIn.username({ username: value.toLowerCase(), password });

      if (result.error) {
        if (result.error.status === 403 || result.error.code === 'EMAIL_NOT_VERIFIED') {
          setPendingVerificationEmail(value.includes('@') ? value.toLowerCase() : '');
          setState('verification');
          setMessage('ایمیل شما هنوز تأیید نشده است. ایمیل تأیید را بررسی کنید و سپس دوباره وارد شوید.');
          return;
        }
        throw result.error;
      }

      const applicationUser = await readApplicationUser();
      if (!applicationUser || applicationUser.isActive === false || !applicationUser.createdAt) {
        throw new Error('ورود انجام شد اما پروفایل کاربردی معتبر یا فعال نیست.');
      }
      setCurrentUser(applicationUser as UserAccount);
      onClose();
    } catch (error) {
      setState('error');
      setMessage(errorMessage(error, 'ارتباط با سرویس احراز هویت برقرار نشد.'));
    }
  };

  const continueWithGoogle = async () => {
    if (isLoading) return;
    setState('loading');
    setMessage('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
      if (result.error) throw result.error;
    } catch (error) {
      setState('error');
      setMessage(errorMessage(error, 'ورود با Google انجام نشد.'));
    }
  };

  const resendVerification = async () => {
    if (isLoading || !pendingVerificationEmail) return;
    setState('loading');
    setMessage('');
    try {
      const result = await authClient.sendVerificationEmail({ email: pendingVerificationEmail, callbackURL: '/' });
      if (result.error) throw result.error;
      setState('verification');
      setMessage('ایمیل تأیید دوباره ارسال شد. صندوق ورودی و پوشهٔ Spam را بررسی کنید.');
    } catch (error) {
      setState('error');
      setMessage(errorMessage(error, 'ارسال دوبارهٔ ایمیل تأیید انجام نشد.'));
    }
  };

  const switchLabel = mode === 'login' ? 'ساخت حساب جدید' : 'ورود به حساب';

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose();
      }}
      dir="rtl"
    >
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_100px_-35px_rgba(15,23,42,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500" />

        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-pink-50 text-pink-600 ring-1 ring-pink-100">
              <ShieldCheck size={23} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-pink-600">SolMint Account</p>
              <h2 id={titleId} className="mt-1 truncate text-xl font-black tracking-tight text-slate-950 sm:text-[22px]">
                {mode === 'login' ? 'خوش آمدید' : 'حساب SolMint'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {mode === 'login' ? 'برای ادامه وارد حساب خود شوید.' : 'حساب خود را برای استفاده از سرویس‌های SolMint بسازید.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="بستن پنجره ورود"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 sm:px-7 sm:pb-7">
          <button
            type="button"
            onClick={() => void continueWithGoogle()}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={17} className="animate-spin" /> : <Chrome size={18} />}
            ادامه با Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold text-slate-400" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-100" />
            <span>یا با ایمیل و رمز عبور</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          <form onSubmit={submit} noValidate className="space-y-3.5">
            {mode === 'register' ? (
              <>
                <Field label="نام و نام خانوادگی" htmlFor={nameId} icon={<UserPlus size={16} />}>
                  <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className={inputClassName} />
                </Field>
                <Field label="نام کاربری" htmlFor={usernameId} icon={<UserPlus size={16} />} hint="نام کاربری پس از ثبت‌نام قابل تغییر نیست.">
                  <input id={usernameId} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className={inputClassName} />
                </Field>
                <Field label="ایمیل" htmlFor={emailId} icon={<Mail size={16} />}>
                  <input id={emailId} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" inputMode="email" className={inputClassName} dir="ltr" />
                </Field>
              </>
            ) : (
              <Field label="ایمیل یا نام کاربری" htmlFor={identifierId} icon={<UserPlus size={16} />}>
                <input id={identifierId} value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" className={inputClassName} />
              </Field>
            )}

            <Field label="رمز عبور" htmlFor={passwordId} icon={<LockKeyhole size={16} />}>
              <div className="relative">
                <input
                  id={passwordId}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputClassName} pl-12`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
                  aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            {state === 'verification' ? (
              <>
                <StatusMessage tone="success" icon={<MailCheck size={17} />} message={message} />
                {pendingVerificationEmail ? (
                  <button
                    type="button"
                    onClick={() => void resendVerification()}
                    disabled={isLoading}
                    className="w-full rounded-2xl border border-pink-100 bg-pink-50 px-4 py-2.5 text-xs font-extrabold text-pink-700 transition hover:bg-pink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ارسال دوبارهٔ ایمیل تأیید
                  </button>
                ) : null}
              </>
            ) : null}
            {state === 'error' ? (
              <StatusMessage tone="error" icon={<AlertCircle size={17} />} message={message} />
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={17} className="animate-spin" /> : mode === 'login' ? <LockKeyhole size={17} /> : <UserPlus size={17} />}
              {mode === 'login' ? 'ورود امن' : 'ایجاد حساب'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => resetMode(mode === 'login' ? 'register' : 'login')}
            disabled={isLoading}
            className="mt-3.5 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {switchLabel}
          </button>

          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] leading-5 text-slate-400">
            <ShieldCheck size={13} />
            <span>نشست احراز هویت در سمت سرور و با کوکی HttpOnly مدیریت می‌شود.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClassName = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-pink-400 focus:ring-4 focus:ring-pink-50';

function Field({
  label,
  htmlFor,
  icon,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <span className="text-pink-500">{icon}</span>
          {label}
        </label>
        {hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function StatusMessage({
  tone,
  icon,
  message,
}: {
  tone: 'success' | 'error';
  icon: React.ReactNode;
  message: string;
}) {
  const className = tone === 'success'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
    : 'border-red-100 bg-red-50 text-red-700';

  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border p-3 text-xs font-medium leading-5 ${className}`} role="status" aria-live="polite">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{message}</span>
    </div>
  );
}
