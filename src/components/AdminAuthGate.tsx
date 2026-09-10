import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, Mail, MailCheck, ShieldCheck, X } from 'lucide-react';
import { authClient, fetchApplicationUser } from '../utils/authClient';
import { authDiagnosticLabel, authErrorMessage } from '../utils/authErrorMessages';
import type { UserAccount } from '../types';

interface AdminAuthGateProps { isOpen: boolean; onClose: () => void; setCurrentUser: React.Dispatch<React.SetStateAction<UserAccount | null>>; }
type Mode = 'login' | 'register';
type AuthState = 'idle' | 'loading' | 'verification' | 'error';
type SafeApplicationUser = Omit<UserAccount, 'passwordHash'>;
type ApplicationUserResponse = { success?: boolean; user?: unknown };

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  email_not_verified: 'ایمیل حساب Google هنوز تأیید نشده است.', state_mismatch: 'نشست امنیتی ورود با Google منقضی یا نامعتبر شده است. دوباره تلاش کنید.', state_invalid: 'اطلاعات امنیتی ورود با Google معتبر نیست. دوباره تلاش کنید.', invalid_code: 'کد ورود Google معتبر نیست یا قبلاً استفاده شده است. دوباره تلاش کنید.', invalid_grant: 'مجوز Google منقضی شده است. دوباره تلاش کنید.', account_not_linked: 'این حساب Google به حساب سولمینت متصل نیست.', oauth_provider_not_found: 'ورود با Google در این محیط فعال نیست.', email_not_found: 'Google ایمیل معتبری برای این حساب برنگرداند.',
};

function callbackErrorFromLocation(): { message: string; code: string } | null { const error = new URLSearchParams(window.location.search).get('error'); return error ? { message: CALLBACK_ERROR_MESSAGES[error] || `ورود با Google ناموفق بود (${error}).`, code: error.toUpperCase() } : null; }

function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const handheld = /android|iphone|ipad|ipod|mobile/i.test(userAgent);
  const narrow = window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth <= 767;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return handheld || narrow || (coarse && window.innerWidth <= 1024);
}

export function buildGoogleCallbackURL(): string {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('auth_device', isMobileBrowser() ? 'mobile' : 'desktop');
  return url.toString();
}

async function readApplicationUser(): Promise<SafeApplicationUser | null> {
  const response = await fetchApplicationUser(); const payload = (await response.json().catch(() => null)) as ApplicationUserResponse | null;
  if (response.status === 401 || !response.ok || payload?.success !== true || !payload.user || typeof payload.user !== 'object') return null;
  const value = payload.user as Record<string, unknown>; const id = typeof value.id === 'string' ? value.id.trim() : ''; if (!id) return null;
  const role = typeof value.role === 'string' ? value.role : 'user'; if (!['superadmin', 'admin', 'editor', 'writer', 'user'].includes(role)) return null;
  const permissions = Array.isArray(value.permissions) && value.permissions.every(item => typeof item === 'string') ? value.permissions as UserAccount['permissions'] : undefined;
  return { id, username: typeof value.username === 'string' ? value.username : '', fullName: typeof value.fullName === 'string' ? value.fullName : '', role: role as UserAccount['role'], permissions, isActive: value.isActive !== false, createdAt: typeof value.createdAt === 'string' ? value.createdAt : '' };
}

export function AdminAuthGate({ isOpen, onClose, setCurrentUser }: AdminAuthGateProps): React.ReactElement | null {
  const titleId = useId(); const identifierId = useId(); const nameId = useId(); const usernameId = useId(); const emailId = useId(); const passwordId = useId();
  const [mode, setMode] = useState<Mode>('login'); const [identifier, setIdentifier] = useState(''); const [name, setName] = useState(''); const [username, setUsername] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [showPassword, setShowPassword] = useState(false); const [pendingVerificationEmail, setPendingVerificationEmail] = useState(''); const [state, setState] = useState<AuthState>('idle'); const [message, setMessage] = useState(''); const [diagnosticCode, setDiagnosticCode] = useState<string | null>(null);

  useEffect(() => { if (!isOpen) return; const callback = callbackErrorFromLocation(); setState(callback ? 'error' : 'idle'); setMessage(callback?.message || ''); setDiagnosticCode(callback?.code || null); setPendingVerificationEmail(''); if (callback) window.history.replaceState({}, document.title, window.location.pathname); }, [isOpen, mode]);
  useEffect(() => { if (!isOpen) return; const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && state !== 'loading') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [isOpen, onClose, state]);
  useEffect(() => { if (!isOpen) return; document.querySelector<HTMLInputElement>(mode === 'login' ? `#${identifierId}` : `#${nameId}`)?.focus(); }, [identifierId, isOpen, mode, nameId]);
  if (!isOpen) return null;
  const isLoading = state === 'loading';
  const switchMode = () => { if (isLoading) return; setMode(mode === 'login' ? 'register' : 'login'); setState('idle'); setMessage(''); setDiagnosticCode(null); setPendingVerificationEmail(''); };
  const setFailure = (error: unknown, fallback: string) => { setState('error'); setMessage(authErrorMessage(error, fallback)); setDiagnosticCode(authDiagnosticLabel(error)); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (isLoading) return; setState('loading'); setMessage(''); setDiagnosticCode(null);
    try {
      if (mode === 'register') { const normalizedEmail = email.trim().toLowerCase(); const normalizedUsername = username.trim().toLowerCase(); if (!name.trim() || !normalizedUsername || !normalizedEmail || !password) throw new Error('نام، نام کاربری، ایمیل و رمز عبور الزامی است.'); const result = await authClient.signUp.email({ email: normalizedEmail, name: name.trim(), password, username: normalizedUsername }); if (result.error) throw result.error; setPendingVerificationEmail(normalizedEmail); setState('verification'); setMessage('حساب ایجاد شد. ایمیل تأیید برای شما ارسال شده است. پس از تأیید ایمیل، دوباره وارد شوید.'); return; }
      const value = identifier.trim(); if (!value || !password) throw new Error('ایمیل یا نام کاربری و رمز عبور الزامی است.'); const result = value.includes('@') ? await authClient.signIn.email({ email: value.toLowerCase(), password }) : await authClient.signIn.username({ username: value.toLowerCase(), password });
      if (result.error) { if (result.error.status === 403 || result.error.code === 'EMAIL_NOT_VERIFIED') { setPendingVerificationEmail(value.includes('@') ? value.toLowerCase() : ''); setState('verification'); setMessage('ایمیل شما هنوز تأیید نشده است. ایمیل تأیید را بررسی کنید و سپس دوباره وارد شوید.'); setDiagnosticCode('EMAIL_NOT_VERIFIED'); return; } throw result.error; }
      const applicationUser = await readApplicationUser(); if (!applicationUser || applicationUser.isActive === false || !applicationUser.createdAt) throw new Error('ورود انجام شد اما پروفایل کاربردی معتبر یا فعال نیست.'); setCurrentUser(applicationUser as UserAccount); onClose();
    } catch (error) { setFailure(error, mode === 'register' ? 'ثبت‌نام انجام نشد.' : 'ورود انجام نشد.'); }
  };
  const continueWithGoogle = async () => { if (isLoading) return; setState('loading'); setMessage(''); setDiagnosticCode(null); try { const result = await authClient.signIn.social({ provider: 'google', callbackURL: buildGoogleCallbackURL() }); if (result.error) throw result.error; } catch (error) { setFailure(error, 'ورود با Google انجام نشد.'); } };
  const resendVerification = async () => { if (isLoading || !pendingVerificationEmail) return; setState('loading'); try { const result = await authClient.sendVerificationEmail({ email: pendingVerificationEmail, callbackURL: buildGoogleCallbackURL() }); if (result.error) throw result.error; setState('verification'); setMessage('ایمیل تأیید دوباره ارسال شد. صندوق ورودی و Spam را بررسی کنید.'); } catch (error) { setFailure(error, 'ارسال دوبارهٔ ایمیل تأیید انجام نشد.'); } };

  return <div className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId} dir="rtl" onMouseDown={event => { if (event.target === event.currentTarget && !isLoading) onClose(); }}><div className="w-full max-w-[440px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-2xl"><div className="h-1 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500" /><div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-7"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-pink-50 text-pink-600"><ShieldCheck size={23} /></div><div><p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-pink-600">SolMint Account</p><h2 id={titleId} className="mt-1 text-xl font-black text-slate-950">{mode === 'login' ? 'ورود به حساب' : 'ایجاد حساب'}</h2></div></div><button type="button" onClick={onClose} disabled={isLoading} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40" aria-label="بستن پنجره ورود"><X size={18} /></button></div><div className="px-6 pb-6 sm:px-7 sm:pb-7">
    <button type="button" onClick={() => void continueWithGoogle()} disabled={isLoading} className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">{isLoading ? <Loader2 size={17} className="animate-spin" /> : <GoogleIcon />}ادامه با Google</button>
    <div className="my-5 flex items-center gap-3 text-[11px] font-semibold text-slate-400"><span className="h-px flex-1 bg-slate-100" /><span>یا با ایمیل و رمز عبور</span><span className="h-px flex-1 bg-slate-100" /></div>
    <form onSubmit={submit} noValidate className="space-y-3.5">{mode === 'register' ? <><Field label="نام و نام خانوادگی" htmlFor={nameId}><input id={nameId} value={name} onChange={e => setName(e.target.value)} autoComplete="name" className={inputClassName} /></Field><Field label="نام کاربری" htmlFor={usernameId}><input id={usernameId} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className={inputClassName} /></Field><Field label="ایمیل" htmlFor={emailId}><input id={emailId} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" type="email" inputMode="email" className={inputClassName} dir="ltr" /></Field></> : <Field label="ایمیل یا نام کاربری" htmlFor={identifierId}><input id={identifierId} value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" className={inputClassName} /></Field>}<Field label="رمز عبور" htmlFor={passwordId}><div className="relative"><input id={passwordId} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} className={`${inputClassName} pl-12`} dir="ltr" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400" aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>{state === 'verification' && <><StatusMessage tone="success" icon={<MailCheck size={17} />} message={message} />{pendingVerificationEmail && <button type="button" onClick={() => void resendVerification()} disabled={isLoading} className="w-full rounded-2xl border border-pink-100 bg-pink-50 px-4 py-2.5 text-xs font-extrabold text-pink-700 disabled:opacity-50">ارسال دوبارهٔ ایمیل تأیید</button>}</>}{state === 'error' && <StatusMessage tone="error" icon={<AlertCircle size={17} />} message={message} diagnosticCode={diagnosticCode} />}<button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-extrabold text-white disabled:opacity-50">{isLoading ? <Loader2 size={17} className="animate-spin" /> : <LockKeyhole size={17} />}{mode === 'login' ? 'ورود امن' : 'ایجاد حساب'}</button></form>
    {mode === 'login' && <button type="button" onClick={() => { window.location.href = '/auth/reset-password'; }} className="mt-3 w-full rounded-2xl border border-pink-100 bg-pink-50 px-4 py-2.5 text-xs font-extrabold text-pink-700 hover:bg-pink-100">رمز عبور را فراموش کرده‌اید؟</button>}
    <button type="button" onClick={switchMode} disabled={isLoading} className="mt-3.5 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">{mode === 'login' ? 'ساخت حساب جدید' : 'ورود به حساب'}</button>
  </div></div></div>;
}

function GoogleIcon(): React.ReactElement {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.49 4.49 0 0 1-1.95 2.94v2.46h3.16c1.85-1.7 2.9-4.2 2.9-7.23Z"/>
    <path fill="#34A853" d="M12 21.98c2.7 0 4.96-.89 6.61-2.41l-3.16-2.46c-.88.59-2 .94-3.45.94-2.64 0-4.88-1.78-5.68-4.18H3.05v2.54A9.98 9.98 0 0 0 12 21.98Z"/>
    <path fill="#4A90E2" d="M6.32 13.87A6 6 0 0 1 6 12c0-.65.11-1.28.32-1.87V7.59H3.05A9.98 9.98 0 0 0 2 12c0 1.61.39 3.13 1.05 4.41l3.27-2.54Z"/>
    <path fill="#FBBC05" d="M12 5.95c1.55 0 2.94.53 4.03 1.57l3.02-3.02C16.96 2.92 14.7 2.02 12 2.02a9.98 9.98 0 0 0-8.95 5.57l3.27 2.54C7.12 7.73 9.36 5.95 12 5.95Z"/>
  </svg>;
}

const inputClassName = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-50';
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div><label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-slate-700">{label}</label>{children}</div>; }
function StatusMessage({ tone, icon, message, diagnosticCode }: { tone: 'success' | 'error'; icon: React.ReactNode; message: string; diagnosticCode?: string | null }) { const className = tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'; return <div className={`flex items-start gap-2.5 rounded-2xl border p-3 text-xs font-medium leading-5 ${className}`} role="status" aria-live="polite"><span>{icon}</span><div><div>{message}</div>{diagnosticCode && <div className="mt-1 font-mono text-[10px]" dir="ltr">تشخیص: {diagnosticCode}</div>}</div></div>; }
