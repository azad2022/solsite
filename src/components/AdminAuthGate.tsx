import React, { useEffect, useState } from 'react';
import { AlertCircle, Chrome, Eye, EyeOff, Loader2, LockKeyhole, MailCheck, ShieldCheck, UserPlus, X } from 'lucide-react';
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
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<AuthState>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setState('idle');
    setMessage('');
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('loading');
    setMessage('');

    try {
      if (mode === 'register') {
        if (!name.trim() || !username.trim() || !email.trim() || !password) throw new Error('نام، نام کاربری، ایمیل و رمز عبور الزامی است.');
        const { error } = await authClient.signUp.email({ email: email.trim().toLowerCase(), name: name.trim(), password, username: username.trim() });
        if (error) throw new Error(error.message || 'ثبت‌نام انجام نشد.');
        setState('verification');
        setMessage('حساب ایجاد شد. ایمیل تأیید را باز کنید؛ پس از تأیید، وارد شوید.');
        return;
      }

      const value = identifier.trim();
      if (!value || !password) throw new Error('نام کاربری/ایمیل و رمز عبور الزامی است.');
      const result = value.includes('@')
        ? await authClient.signIn.email({ email: value.toLowerCase(), password })
        : await authClient.signIn.username({ username: value, password });
      if (result.error) throw new Error(result.error.message || 'ورود انجام نشد.');

      const applicationUser = await readApplicationUser();
      if (!applicationUser || applicationUser.isActive === false || !applicationUser.createdAt) {
        throw new Error('احراز هویت انجام شد اما پروفایل کاربردی معتبر یا فعال نیست.');
      }
      setCurrentUser(applicationUser as UserAccount);
      onClose();
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'ارتباط با سرویس احراز هویت برقرار نشد.');
    }
  };

  const continueWithGoogle = async () => {
    setState('loading');
    setMessage('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href });
      if (result.error) throw new Error(result.error.message || 'ورود با Google انجام نشد.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'ورود با Google انجام نشد.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="solmint-auth-title">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><ShieldCheck size={21} /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pink-600">SolMint Security</p><h2 id="solmint-auth-title" className="text-lg font-black text-slate-900">{mode === 'login' ? 'ورود به حساب' : 'ساخت حساب'}</h2></div></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="بستن"><X size={18} /></button>
        </div>
        <div className="p-5">
          <button type="button" onClick={() => void continueWithGoogle()} disabled={state === 'loading'} className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><Chrome size={17} /> ادامه با Google</button>
          <div className="my-4 flex items-center gap-3 text-[11px] font-semibold text-slate-400"><span className="h-px flex-1 bg-slate-100" />یا<span className="h-px flex-1 bg-slate-100" /></div>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' ? <><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="نام و نام خانوادگی" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" /><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="نام کاربری" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" /><input value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" type="email" placeholder="ایمیل" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" /></> : <input value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" placeholder="ایمیل یا نام کاربری" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />}
            <div className="relative"><input value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} placeholder="رمز عبور" className="w-full rounded-2xl border border-slate-200 px-4 py-3 pl-11 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {state === 'verification' ? <div className="flex gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800"><MailCheck className="mt-0.5 shrink-0" size={17} /><span>{message}</span></div> : null}
            {state === 'error' ? <div className="flex gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={17} /><span>{message}</span></div> : null}
            <button type="submit" disabled={state === 'loading'} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{state === 'loading' ? <Loader2 className="animate-spin" size={17} /> : mode === 'login' ? <LockKeyhole size={17} /> : <UserPlus size={17} />}{mode === 'login' ? 'ورود امن' : 'ایجاد حساب'}</button>
          </form>
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="mt-4 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">{mode === 'login' ? 'حساب ندارید؟ ثبت‌نام کنید' : 'حساب دارید؟ وارد شوید'}</button>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><LockKeyhole size={12} /> نشست امن سمت سرور · کوکی HttpOnly</div>
        </div>
      </div>
    </div>
  );
}
