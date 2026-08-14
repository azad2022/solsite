import React, { useEffect, useMemo, useState } from 'react';
import { applyToolSeo } from '../../utils/toolsSeo';

interface Props { onNavigate: (path: string) => void; }
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const SolanaTokenScannerPage: React.FC<Props> = ({ onNavigate }) => {
  const [mint, setMint] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const valid = useMemo(() => BASE58.test(mint.trim()), [mint]);
  useEffect(() => { applyToolSeo({ title: 'بررسی توکن سولانا | Solana Token Scanner | سولمینت', description: 'بررسی فنی توکن‌های سولانا با Mint Address؛ مشاهده اطلاعات Mint، Supply، Decimals، Authority و Token Program بدون اتصال کیف پول.', path: '/tools/solana-token-scanner' }); }, []);
  const submit = (event: React.FormEvent) => { event.preventDefault(); setSubmitted(true); if (valid) window.history.replaceState({}, '', `/tools/solana-token-scanner?mint=${encodeURIComponent(mint.trim())}`); };
  return <section className="relative py-12 sm:py-16"><div className="mx-auto max-w-5xl px-4 sm:px-6">
    <button type="button" onClick={() => onNavigate('/tools/solana-token-tools')} className="text-sm font-bold text-slate-400 hover:text-white">← ابزارهای توکن سولانا</button>
    <div className="mt-8 max-w-3xl"><span className="text-xs font-bold uppercase tracking-[.18em] text-[#14F195]">Solana Token Scanner</span><h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white">بررسی توکن سولانا</h1><p className="mt-4 text-sm sm:text-base leading-8 text-slate-400">Mint Address را وارد کنید تا اطلاعات پایه و وضعیت مجوزهای توکن را بررسی کنیم. این ابزار در حالت فقط‌خواندنی کار می‌کند.</p></div>
    <form onSubmit={submit} className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-5 sm:p-7"><label htmlFor="token-mint" className="block text-sm font-bold text-slate-200">آدرس Mint توکن</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="token-mint" value={mint} onChange={e => { setMint(e.target.value); setSubmitted(false); }} dir="ltr" inputMode="text" autoComplete="off" placeholder="مثلاً 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-sm text-white outline-none transition focus:border-[#14F195]/60" /><button type="submit" className="rounded-xl bg-[#14F195] px-6 py-3.5 text-sm font-black text-slate-950 transition hover:brightness-110">بررسی توکن</button></div>{submitted && !valid && <p className="mt-3 text-xs font-bold text-rose-400">آدرس واردشده از نظر طول و قالب Base58 معتبر نیست.</p>}</form>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{['اطلاعات Mint', 'Supply و Decimals', 'Mint / Freeze Authority', 'Token Program'].map(item => <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5"><div className="h-2 w-2 rounded-full bg-[#14F195]" /><h2 className="mt-4 text-sm font-extrabold text-slate-200">{item}</h2><p className="mt-2 text-xs leading-6 text-slate-500">پس از اتصال لایه خواندن on-chain در همین بخش نمایش داده می‌شود.</p></div>)}</div>
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-7 text-slate-400"><strong className="text-slate-200">مرز ابزار:</strong> این صفحه فقط برای تحلیل فنی است. هیچ private key، seed phrase یا مجوز امضای تراکنش از کاربر درخواست نمی‌شود.</div>
  </div></section>;
};
