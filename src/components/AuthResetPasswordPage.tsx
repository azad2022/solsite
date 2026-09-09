import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { authClient } from '../utils/authClient';
import { authDiagnosticLabel, authErrorMessage } from '../utils/authErrorMessages';

type Mode = 'request' | 'reset' | 'done' | 'error';

function initialMode(): Mode {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error')) return 'error';
  return params.get('token') ? 'reset' : 'request';
}

export default function AuthResetPasswordPage(): React.ReactElement {
  const [mode, setMode] = useState<Mode>(() => initialMode());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [diagnosticCode, setDiagnosticCode] = useState<string | null>(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    return error ? error.toUpperCase() : null;
  });
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token')?.trim() || '', []);

  const fail = (error: unknown, fallback: string) => { setMode('error'); setMessage(authErrorMessage(error, fallback)); setDiagnosticCode(authDiagnosticLabel(error)); };
  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault(); const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { fail(new Error('ایمیل الزامی است.'), 'ایمیل را وارد کنید.'); return; }
    setBusy(true); setMessage(''); setDiagnosticCode(null);
    try {
      const result = await authClient.requestPasswordReset({ email: normalizedEmail, redirectTo: `${window.location.origin}/auth/reset-password` });
      if (result.error) throw result.error;
      setMode('done'); setMessage('اگر برای این ایمیل حسابی وجود داشته باشد، لینک بازنشانی رمز عبور ارسال شده است. صندوق ورودی و Spam را بررسی کنید.');
    } catch (error) { fail(error, 'درخواست بازنشانی رمز عبور انجام نشد.'); } finally { setBusy(false); }
  };
  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) { fail(new Error('توکن بازنشانی وجود ندارد.'), 'لینک بازنشانی معتبر نیست.'); return; }
    if (password.length < 8) { fail(new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.'), 'رمز عبور کوتاه است.'); return; }
    if (password !== confirmPassword) { fail(new Error('تکرار رمز عبور یکسان نیست.'), 'رمزهای عبور یکسان نیستند.'); return; }
    setBusy(true); setMessage(''); setDiagnosticCode(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw result.error;
      window.history.replaceState({}, document.title, '/auth/reset-password'); setMode('done'); setMessage('رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد حساب شوید.');
    } catch (error) { fail(error, 'تغییر رمز عبور انجام نشد. ممکن است لینک منقضی یا قبلاً مصرف شده باشد.'); } finally { setBusy(false); }
  };

  return <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 sm:p-6" dir="rtl"><main className="w-full max-w-md rounded-[30px] bg-white p-6 shadow-2xl sm:p-8">
    <div className="mb-6 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><KeyRound size={23} /></div><div><p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-pink-600">SolMint Account</p><h1 className="mt-1 text-xl font-black text-slate-950">{mode === 'reset' ? 'تغییر رمز عبور' : 'بازیابی رمز عبور'}</h1></div></div>
    {mode === 'request' && <form onSubmit={requestReset} className="space-y-4"><p className="text-sm leading-6 text-slate-500">ایمیل حساب را وارد کنید. پاسخ فرم وجود یا عدم وجود حساب را فاش نمی‌کند.</p><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">ایمیل</span><div className="relative"><Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" inputMode="email" className={inputClassName} dir="ltr" /></div></label>{message && <StatusMessage message={message} diagnosticCode={diagnosticCode} error /> }<button disabled={busy} className={buttonClassName}>{busy ? <Loader2 className="animate-spin" size={17} /> : <Mail size={17} />}ارسال لینک بازیابی</button></form>}
    {mode === 'reset' && <form onSubmit={resetPassword} className="space-y-4"><p className="text-sm leading-6 text-slate-500">رمز عبور جدید را وارد کنید. پس از reset، sessionهای قبلی طبق policy سرور revoke می‌شوند.</p><PasswordField label="رمز عبور جدید" value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword(v => !v)} /><PasswordField label="تکرار رمز عبور" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} toggle={() => setShowConfirm(v => !v)} />{message && <StatusMessage message={message} diagnosticCode={diagnosticCode} error />}<button disabled={busy} className={buttonClassName}>{busy ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}ثبت رمز عبور جدید</button></form>}
    {mode === 'done' && <div className="space-y-4"><StatusMessage message={message} icon={<CheckCircle2 size={19} />} /><a href="/" className="flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-extrabold text-white">بازگشت</a></div>}
    {mode === 'error' && <div className="space-y-4"><StatusMessage message={message || 'لینک بازنشانی معتبر نیست یا منقضی شده است.'} diagnosticCode={diagnosticCode} error /><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => { setMode('request'); setMessage(''); setDiagnosticCode(null); window.history.replaceState({}, document.title, '/auth/reset-password'); }} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white">درخواست لینک جدید</button><a href="/" className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700">بازگشت</a></div></div>}
    <div className="mt-6 flex items-center justify-center gap-2 text-[11px] leading-5 text-slate-500"><ShieldCheck size={13} /><span>احراز هویت و بازنشانی رمز عبور در سمت سرور انجام می‌شود.</span></div>
  </main></div>;
}

function PasswordField({ label, value, onChange, show, toggle }: { label: string; value: string; onChange: (value: string) => void; show: boolean; toggle: () => void }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">{label}</span><div className="relative"><input value={value} onChange={e => onChange(e.target.value)} type={show ? 'text' : 'password'} autoComplete="new-password" className={`${inputClassName} pl-12`} dir="ltr" /><button type="button" onClick={toggle} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400" aria-label={show ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>; }
function StatusMessage({ message, diagnosticCode, error = false, icon = <AlertCircle size={17} /> }: { message: string; diagnosticCode?: string | null; error?: boolean; icon?: React.ReactNode }) { return <div className={`flex items-start gap-2.5 rounded-2xl border p-3 text-xs leading-5 ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`} role="status" aria-live="polite"><span>{icon}</span><div><div>{message}</div>{diagnosticCode && <div className="mt-1 font-mono text-[10px]" dir="ltr">تشخیص: {diagnosticCode}</div>}</div></div>; }
const inputClassName = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-50';
const buttonClassName = 'flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50';
