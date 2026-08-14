import React, { useEffect, useMemo, useState } from 'react';
import { applyToolSeo } from '../../utils/toolsSeo';

interface Props { onNavigate: (path: string) => void; }
interface TokenResult {
  ok: boolean;
  mint: string;
  tokenProgram: string;
  owner: string;
  slot: number | null;
  decimals: number;
  supply: string;
  isInitialized: boolean;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  extensions: Array<{ type: string; data?: unknown }>;
  error?: string;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const short = (value: string | null) => value ? `${value.slice(0, 8)}…${value.slice(-8)}` : 'غیرفعال / لغو شده';
const formatSupply = (value: string, decimals: number) => {
  try {
    const raw = BigInt(value);
    const divisor = 10 ** decimals;
    const number = Number(raw) / divisor;
    return Number.isFinite(number) ? number.toLocaleString('en-US', { maximumFractionDigits: Math.min(decimals, 8) }) : value;
  } catch { return value; }
};

export const SolanaTokenScannerPage: React.FC<Props> = ({ onNavigate }) => {
  const [mint, setMint] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TokenResult | null>(null);
  const [error, setError] = useState('');
  const valid = useMemo(() => BASE58.test(mint.trim()), [mint]);

  useEffect(() => {
    applyToolSeo({ title: 'بررسی توکن سولانا | Solana Token Scanner | سولمینت', description: 'بررسی فنی توکن‌های سولانا با Mint Address؛ مشاهده Supply، Decimals، Authority و Token Program با داده مستقیم شبکه و بدون اتصال کیف پول.', path: '/tools/solana-token-scanner' });
    const queryMint = new URLSearchParams(window.location.search).get('mint');
    if (queryMint && BASE58.test(queryMint)) { setMint(queryMint); void analyze(queryMint); }
  }, []);

  async function analyze(address: string) {
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch(`/api/tools/solana-token?mint=${encodeURIComponent(address)}`);
      const payload = await response.json() as TokenResult;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'دریافت اطلاعات ناموفق بود.');
      setResult(payload);
      window.history.replaceState({}, '', `/tools/solana-token-scanner?mint=${encodeURIComponent(address)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای نامشخص در دریافت اطلاعات.');
    } finally { setLoading(false); }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setSubmitted(true);
    if (valid) void analyze(mint.trim());
  };

  return <section className="relative py-12 sm:py-16"><div className="mx-auto max-w-5xl px-4 sm:px-6">
    <button type="button" onClick={() => onNavigate('/tools/solana-token-tools')} className="text-sm font-bold text-slate-400 hover:text-white">← ابزارهای توکن سولانا</button>
    <div className="mt-8 max-w-3xl"><span className="text-xs font-bold uppercase tracking-[.18em] text-[#14F195]">Solana Token Scanner</span><h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white">بررسی توکن سولانا</h1><p className="mt-4 text-sm sm:text-base leading-8 text-slate-400">Mint Address را وارد کنید تا اطلاعات واقعی Mint و وضعیت Authorityهای آن را مستقیماً از شبکه بررسی کنیم. ابزار کاملاً read-only است.</p></div>

    <form onSubmit={submit} className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-5 sm:p-7"><label htmlFor="token-mint" className="block text-sm font-bold text-slate-200">آدرس Mint توکن</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="token-mint" value={mint} onChange={e => { setMint(e.target.value); setSubmitted(false); setError(''); setResult(null); }} dir="ltr" inputMode="text" autoComplete="off" placeholder="مثلاً 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-sm text-white outline-none transition focus:border-[#14F195]/60" /><button disabled={loading} type="submit" className="rounded-xl bg-[#14F195] px-6 py-3.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{loading ? 'در حال بررسی…' : 'بررسی توکن'}</button></div>{submitted && !valid && <p className="mt-3 text-xs font-bold text-rose-400">آدرس واردشده از نظر طول و قالب Base58 معتبر نیست.</p>}{error && <p role="alert" className="mt-3 text-sm font-bold text-rose-400">{error}</p>}</form>

    {result && <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-2 rounded-2xl border border-[#14F195]/20 bg-[#14F195]/5 p-5 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-xs font-bold text-[#14F195]">Mint معتبر و قابل خواندن</span><p dir="ltr" className="mt-2 break-all font-mono text-xs text-slate-300">{result.mint}</p></div><span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">{result.tokenProgram}</span></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Supply', formatSupply(result.supply, result.decimals)],
        ['Decimals', String(result.decimals)],
        ['Mint Authority', short(result.mintAuthority)],
        ['Freeze Authority', short(result.freezeAuthority)]
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><p className="text-xs font-bold text-slate-500">{label}</p><p dir={label === 'Supply' ? 'ltr' : undefined} className="mt-3 break-all text-sm font-extrabold text-slate-100">{value}</p></div>)}</div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><div className="flex items-center justify-between gap-4"><h2 className="text-base font-black text-white">وضعیت فنی</h2><span className="text-xs text-slate-500">Slot {result.slot ?? '—'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-900 p-4"><span className="text-xs text-slate-500">Mint Authority</span><p className="mt-2 text-sm font-bold text-slate-200">{result.mintAuthority ? 'فعال' : 'لغو شده'}</p></div><div className="rounded-xl bg-slate-900 p-4"><span className="text-xs text-slate-500">Freeze Authority</span><p className="mt-2 text-sm font-bold text-slate-200">{result.freezeAuthority ? 'فعال' : 'لغو شده'}</p></div><div className="rounded-xl bg-slate-900 p-4"><span className="text-xs text-slate-500">Initialized</span><p className="mt-2 text-sm font-bold text-slate-200">{result.isInitialized ? 'بله' : 'خیر'}</p></div></div></div>
      {result.tokenProgram === 'Token-2022' && <div className="rounded-2xl border border-[#9945FF]/30 bg-[#9945FF]/5 p-5"><h2 className="text-base font-black text-white">این توکن از Token-2022 استفاده می‌کند</h2><p className="mt-2 text-sm leading-7 text-slate-400">برای مشاهده جزئیات Extensionها، ابزار تخصصی Token-2022 Inspector را باز کنید.</p><button type="button" onClick={() => onNavigate(`/tools/token-2022-inspector?mint=${encodeURIComponent(result.mint)}`)} className="mt-4 rounded-xl border border-[#9945FF]/40 px-4 py-2 text-sm font-bold text-white hover:bg-[#9945FF]/10">باز کردن Token-2022 Inspector</button></div>}
    </div>}

    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-7 text-slate-400"><strong className="text-slate-200">مرز ابزار:</strong> این صفحه فقط برای تحلیل فنی on-chain است. هیچ private key، seed phrase یا مجوز امضای تراکنش از کاربر درخواست نمی‌شود. وضعیت Authority یا سایر داده‌های on-chain به‌تنهایی تضمین‌کننده امنیت یا ارزش یک پروژه نیست.</div>
  </div></section>;
};
