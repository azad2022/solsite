import React, { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, User, UserPlus, X } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}

type Mode = 'login' | 'register' | 'forgot';
type LoginMethod = 'email' | 'username';

type AuthResponse = { url?: string; redirect?: boolean; };

const parseResponse = async (response: Response): Promise<AuthResponse> => {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try { return JSON.parse(text) as AuthResponse; } catch { return {}; }
};

const errorMessage = (response: Response) => {
  if (response.status === 429) return 'تعداد تلاش‌ها بیش از حد مجاز است. کمی بعد دوباره امتحان کنید.';
  if (response.status === 401) return 'اطلاعات ورود صحیح نیست.';
  if (response.status === 409) return 'این ایمیل یا نام کاربری قبلاً ثبت شده است.';
  if (response.status === 400) return 'درخواست احراز هویت معتبر نیست یا این قابلیت هنوز فعال نشده است.';
  if (response.status >= 500) return 'سرویس احراز هویت موقتاً در دسترس نیست. دوباره تلاش کنید.';
  return 'درخواست احراز هویت انجام نشد. دوباره تلاش کنید.';
};

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onAuthenticated }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(''); setSuccess(''); setPassword(''); setConfirmPassword('');
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const postJson = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(path, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    await parseResponse(response);
    if (!response.ok) throw new Error(errorMessage(response));
  };

  const submitRegister = async () => {
    if (!email.trim() || !name.trim() || !username.trim()) throw new Error('نام، ایمیل و نام کاربری الزامی هستند.');
    if (password.length < 8) throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');
    if (password !== confirmPassword) throw new Error('تکرار رمز عبور با رمز عبور یکسان نیست.');
    await postJson('/api/auth/sign-up/email', { name: name.trim(), email: email.trim(), password, username: username.trim() });
  };

  const submitForgotPassword = async () => {
    if (!email.trim()) throw new Error('ایمیل را وارد کنید.');
    await postJson('/api/auth/request-password-reset', { email: email.trim(), redirectTo: `${window.location.origin}/reset-password` });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'forgot') {
        await submitForgotPassword();
        setSuccess('اگر حسابی با این ایمیل وجود داشته باشد، دستور بازیابی رمز عبور ارسال خواهد شد.');
        return;
      }
      if (mode === 'register') {
        await submitRegister();
        setSuccess('حساب با موفقیت ایجاد شد.');
      } else if (loginMethod === 'username') {
        if (!username.trim()) throw new Error('نام کاربری را وارد کنید.');
        await postJson('/api/auth/sign-in/username', { username: username.trim(), password });
        setSuccess('ورود با موفقیت انجام شد.');
      } else {
        if (!email.trim()) throw new Error('ایمیل را وارد کنید.');
        await postJson('/api/auth/sign-in/email', { email: email.trim(), password });
        setSuccess('ورود با موفقیت انجام شد.');
      }
      onAuthenticated?.();
      window.setTimeout(() => window.location.reload(), 250);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'خطای ناشناخته در احراز هویت.');
    } finally { setBusy(false); }
  };

  const startGoogleOAuth = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/sign-in/social', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL: window.location.href }),
      });
      const payload = await parseResponse(response);
      if (!response.ok) throw new Error(errorMessage(response));
      if (!payload.url || payload.redirect === false) throw new Error('آدرس ورود Google از سرویس احراز هویت دریافت نشد.');
      const target = new URL(payload.url, window.location.origin);
      if (!['https:', 'http:'].includes(target.protocol)) throw new Error('آدرس بازگشت Google معتبر نیست.');
      window.location.assign(target.href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ورود با Google انجام نشد.');
      setBusy(false);
    }
  };

  const switchMode = (nextMode: Mode) => { setMode(nextMode); setError(''); setSuccess(''); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="احراز هویت سولمینت">
      <button type="button" aria-label="بستن" onClick={() => !busy && onClose()} className="absolute inset-0 cursor-default" />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b13] p-5 text-slate-100 shadow-2xl shadow-black/50 sm:p-7" dir="rtl">
        <button type="button" aria-label="بستن پنجره" disabled={busy} onClick={onClose} className="absolute left-4 top-4 rounded-xl p-2 text-slate-500 transition hover:bg-white/5 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
        <div className="mb-6 pr-1"><div className="mb-3 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#14F195]/20 bg-[#14F195]/10 text-[#14F195]"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-white">حساب سولمینت</h2><p className="mt-0.5 text-xs text-slate-500">احراز هویت امن با نشست HttpOnly</p></div></div></div>
        {mode !== 'forgot' && <button type="button" onClick={() => void startGoogleOAuth()} disabled={busy} className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true" className="text-base">G</span>ورود با Google</button>}
        {mode === 'login' && <div className="mb-4 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1"><button type="button" onClick={() => setLoginMethod('email')} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${loginMethod === 'email' ? 'bg-[#9945FF]/20 text-white' : 'text-slate-500 hover:text-slate-300'}`}>ایمیل</button><button type="button" onClick={() => setLoginMethod('username')} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${loginMethod === 'username' ? 'bg-[#9945FF]/20 text-white' : 'text-slate-500 hover:text-slate-300'}`}>نام کاربری</button></div>}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && <><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">نام نمایشی</span><div className="relative"><User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pr-10 pl-3 text-sm outline-none transition focus:border-[#14F195]/40 focus:bg-white/[0.06]" placeholder="نام شما" /></div></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">نام کاربری</span><div className="relative"><UserPlus className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pr-10 pl-3 text-sm outline-none transition focus:border-[#14F195]/40 focus:bg-white/[0.06]" placeholder="مثلاً solmint_user" /></div></label></>}
          {(mode !== 'login' || loginMethod === 'email') && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">ایمیل</span><div className="relative"><Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pr-10 pl-3 text-sm outline-none transition focus:border-[#14F195]/40 focus:bg-white/[0.06]" placeholder="you@example.com" /></div></label>}
          {mode === 'login' && loginMethod === 'username' && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">نام کاربری</span><div className="relative"><User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pr-10 pl-3 text-sm outline-none transition focus:border-[#14F195]/40 focus:bg-white/[0.06]" placeholder="نام کاربری" /></div></label>}
          {mode !== 'forgot' && <><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">رمز عبور</span><div className="relative"><LockKeyhole className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pr-10 pl-11 text-sm outline-none transition focus:border-[#14F195]/40 focus:bg-white/[0.06]" placeholder="••••••••" /><button type="button" aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'} onClick={() => setShowPassword(value => !value)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"><EyeOff className={`h-4 w-4 ${showPassword ? 'hidden' : ''}`} /><Eye className={`h-4 w-4 ${showPassword ? '' : 'hidden'}`} /></button></div></label>{mode === 'register' && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">تکرار رمز عبور</span><input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm outline-none transition focus:border-[#14F195]/40 focus:bg-white/[0.06]" placeholder="••••••••" /></label>}</>}
          {error && <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-xs leading-5 text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          {success && <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-3 text-xs leading-5 text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</div>}
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9945FF] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-[#9945FF]/15 transition hover:bg-[#a558ff] disabled:cursor-not-allowed disabled:opacity-50">{mode === 'login' ? <KeyRound className="h-4 w-4" /> : mode === 'register' ? <UserPlus className="h-4 w-4" /> : <Mail className="h-4 w-4" />}{busy ? 'در حال پردازش…' : mode === 'login' ? 'ورود امن' : mode === 'register' ? 'ایجاد حساب' : 'ارسال لینک بازیابی'}</button>
        </form>
        <div className="mt-5 flex items-center justify-between gap-2 text-xs">{mode === 'login' && <><button type="button" onClick={() => switchMode('forgot')} className="font-bold text-slate-500 hover:text-slate-200">رمز عبور را فراموش کرده‌اید؟</button><button type="button" onClick={() => switchMode('register')} className="font-bold text-[#14F195] hover:text-white">ثبت‌نام</button></>}{mode === 'register' && <button type="button" onClick={() => switchMode('login')} className="font-bold text-[#14F195] hover:text-white">بازگشت به ورود</button>}{mode === 'forgot' && <button type="button" onClick={() => switchMode('login')} className="font-bold text-[#14F195] hover:text-white">بازگشت به ورود</button>}</div>
        <p className="mt-5 flex items-start gap-2 border-t border-white/5 pt-4 text-[11px] leading-5 text-slate-600"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />نشست احراز هویت در کوکی امن HttpOnly نگهداری می‌شود و این رابط هیچ توکن یا session را در localStorage ذخیره نمی‌کند.</p>
      </div>
    </div>
  );
};
