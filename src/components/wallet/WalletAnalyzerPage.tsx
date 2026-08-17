import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Clock3, Eye, ShieldCheck, Sparkles } from 'lucide-react';
import { applyToolSeo } from '../../utils/toolsSeo';

interface Props { onNavigate: (path: string) => void; }

type WalletAnalysis = {
  success: boolean;
  wallet: { address: string; network: string; mode: string };
  observedAt: string;
  balance: { lamports: number; sol: number; priceUsd: number | null; valueUsd: number | null };
  assets: { tokenAccountCount: number; nonZeroTokenCount: number; nftCount: number; tokens: Array<{ mint: string | null; uiAmount: number | null; uiAmountString: string | null; type: string | null; program?: string }> };
  activity: {
    transactionCountSampled: number;
    successfulTransactionCountSampled: number;
    transferCount: number;
    firstActivity: number | null;
    lastActivity: number | null;
    transactions: Array<{ signature: string | null; blockTime: number | null; status: string | null }>;
    transfers: Array<{ transactionHash: string | null; action: string | null; timestamp: number | null; token: string | null; amount: number | null }>;
  };
  analysis: { pnl: null; tradingStats: null; riskScore: null; note: string };
  capabilities: { rpcBalance: boolean; rpcTokenAccounts: boolean; rpcTransactionSignatures: boolean; solanaFmEnrichment: boolean; solPrice: boolean; pnl: boolean; riskScoring: boolean };
  source: { rpc: string; enriched: string; market: string | null };
  caveats: string[];
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const plannedFeatures = [
  { title: 'موجودی و دارایی‌ها', text: 'نمایش موجودی SOL، Token Accountها و دارایی‌های غیرصفر آدرس عمومی.' },
  { title: 'فعالیت و تراکنش‌ها', text: 'نمونه‌ای از تراکنش‌ها و انتقال‌های ثبت‌شده روی شبکه برای بررسی سریع رفتار آدرس.' },
  { title: 'تحلیل عملکرد', text: 'PnL و آمار معاملاتی بعد از تکمیل داده تاریخی و طبقه‌بندی تراکنش‌ها اضافه می‌شوند.' },
  { title: 'تحلیل ریسک', text: 'شاخص‌های ریسک فقط زمانی فعال می‌شوند که داده کافی برای نتیجه‌گیری قابل اتکا داشته باشیم.' },
];

const faq = [
  ['آیا برای بررسی کیف پول باید آن را متصل کنم؟', 'خیر. Wallet Analyzer یک ابزار read-only است و فقط به آدرس عمومی نیاز دارد.'],
  ['آیا Seed Phrase یا Private Key لازم است؟', 'خیر. برای تحلیل آدرس عمومی هیچ‌کدام از این اطلاعات نباید وارد شوند.'],
  ['آیا داده‌ها واقعی هستند؟', 'بله. بعد از تحلیل، داده‌های اصلی از RPC شبکه Solana و در صورت دسترسی، داده غنی‌تر از SolanaFM دریافت می‌شوند.'],
  ['آیا تحلیل یک آدرس هویت مالک را مشخص می‌کند؟', 'خیر. داده‌های on-chain عمومی هستند، اما یک آدرس به‌تنهایی هویت واقعی مالک را اثبات نمی‌کند.'],
];

function isValidAddress(value: string) { return BASE58.test(value.trim()); }
function formatNumber(value: number | null, max = 6) { if (value === null || !Number.isFinite(value)) return '—'; return new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(value); }
function formatUsd(value: number | null) { if (value === null || !Number.isFinite(value)) return '—'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value); }
function formatDate(unixSeconds: number | null) { if (!unixSeconds) return '—'; try { return new Date(unixSeconds * 1000).toLocaleString('fa-IR'); } catch { return '—'; } }

const SolmintMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M7 6.5h15.6c1.8 0 2.7 2.2 1.4 3.5l-2.3 2.3H7.2A3.2 3.2 0 0 1 4 9.1V9.7A3.2 3.2 0 0 1 7 6.5Z" fill="currentColor" opacity=".95" />
    <path d="M25 12.8H9.4c-1.8 0-2.7-2.2-1.4-3.5l2.3-2.3h14.5a3.2 3.2 0 0 1 .2 5.8Z" fill="currentColor" opacity=".55" />
    <path d="M7 19.5h17.6c1.8 0 2.7 2.2 1.4 3.5l-2.3 2.3H7a3.2 3.2 0 0 1 0-5.8Z" fill="currentColor" opacity=".72" />
  </svg>
);

export const WalletAnalyzerPage: React.FC<Props> = ({ onNavigate }) => {
  const [address, setAddress] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null);

  useEffect(() => {
    applyToolSeo({
      title: 'بررسی کیف پول ارز دیجیتال | تحلیل کیف پول سولانا | Wallet Analyzer | سولمینت',
      description: 'ابزار بررسی و تحلیل کیف پول ارز دیجیتال با داده واقعی on-chain؛ موجودی SOL، دارایی‌ها، تراکنش‌ها و فعالیت آدرس عمومی را بدون Seed Phrase بررسی کنید.',
      path: '/wallet-analyzer',
    });
    const query = new URLSearchParams(window.location.search).get('address');
    if (query && isValidAddress(query)) setAddress(query);
  }, []);

  const valid = useMemo(() => isValidAddress(address), [address]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true); setError(''); setAnalysis(null);
    if (!valid) return;
    const value = address.trim();
    window.history.replaceState({}, '', `/wallet-analyzer?address=${encodeURIComponent(value)}`);
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`/api/wallet/analyze?address=${encodeURIComponent(value)}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'تحلیل کیف پول انجام نشد.');
      setAnalysis(payload as WalletAnalysis);
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'AbortError' ? 'زمان پاسخ‌گویی منبع داده تمام شد. دوباره تلاش کنید.' : (err as Error)?.message || 'خطا در دریافت داده کیف پول.');
    } finally { window.clearTimeout(timeout); setLoading(false); }
  };

  return (
    <main dir="rtl" className="relative overflow-hidden pb-20 pt-7 sm:pt-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[650px] bg-[radial-gradient(circle_at_55%_0%,rgba(20,241,149,.10),transparent_38%),radial-gradient(circle_at_18%_16%,rgba(153,69,255,.08),transparent_34%)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500"><button type="button" onClick={() => onNavigate('/')} className="transition hover:text-white">خانه</button><span>/</span><button type="button" onClick={() => onNavigate('/tools/solana-token-tools')} className="transition hover:text-white">ابزارها</button><span>/</span><span className="text-slate-300">Wallet Analyzer</span></div>
        <section className="mt-6 overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0b12]/90 shadow-[0_30px_100px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
            <div className="border-b border-white/10 p-6 sm:p-9 lg:border-b-0 lg:border-l">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#14F195]/20 bg-[#14F195]/10 text-[#14F195]"><SolmintMark size={23} /></span><div><div className="text-sm font-black text-white">Solmint Wallet Analyzer</div><div className="mt-0.5 text-[11px] text-slate-500">تحلیل آدرس عمومی • Read-only • On-chain</div></div></div>
              <div className="mt-8 flex flex-wrap gap-2"><span className="rounded-full border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-1.5 text-[11px] font-black text-[#14F195]">Solana فعال</span><span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-[11px] font-bold text-slate-500">Multi-chain architecture</span></div>
              <h1 className="mt-6 max-w-4xl text-3xl font-black leading-[1.18] tracking-tight text-white sm:text-5xl">بررسی کیف پول ارز دیجیتال؛ یک آدرس را دقیق و خوانا تحلیل کنید</h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-400 sm:text-base">آدرس عمومی کیف پول را وارد کنید تا موجودی، دارایی‌ها، فعالیت و تراکنش‌های قابل استخراج از شبکه بررسی شوند. در این صفحه هیچ Seed Phrase یا Private Key دریافت نمی‌شود.</p>
              <form onSubmit={submit} className="mt-8 rounded-[26px] border border-slate-800 bg-black/20 p-4 sm:p-5">
                <label htmlFor="wallet-address" className="text-sm font-black text-slate-200">آدرس عمومی کیف پول</label>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><input id="wallet-address" value={address} onChange={event => { setAddress(event.target.value); setSubmitted(false); setError(''); setAnalysis(null); }} inputMode="text" autoComplete="off" spellCheck={false} dir="ltr" placeholder="Wallet address" aria-describedby="wallet-address-help" className="min-w-0 rounded-2xl border border-slate-700 bg-[#101019] px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#14F195]/60 focus:ring-4 focus:ring-[#14F195]/5" /><button type="submit" disabled={loading} className="rounded-2xl bg-[#14F195] px-7 py-4 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{loading ? 'در حال تحلیل…' : 'تحلیل کیف پول'}</button></div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span id="wallet-address-help">فقط آدرس عمومی لازم است.</span><span>Seed Phrase و Private Key هرگز وارد نشوند.</span></div>
                {submitted && !valid && <p role="alert" className="mt-3 text-xs font-bold text-rose-400">آدرس واردشده از نظر قالب Base58 معتبر نیست.</p>}
                {error && <p role="alert" className="mt-3 text-xs font-bold text-rose-400">{error}</p>}
              </form>
            </div>
            <aside className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(153,69,255,.10),rgba(8,8,15,.1))] p-6 sm:p-8">
              <div className="relative flex items-center justify-between"><span className="text-[11px] font-black tracking-[.18em] text-violet-300">ON-CHAIN DATA</span><Sparkles className="h-5 w-5 text-violet-300" /></div>
              <div className="relative mt-7 rounded-[26px] border border-white/10 bg-black/25 p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[.04] text-slate-400"><Eye className="h-5 w-5" /></span><div><div className="text-xs font-bold text-slate-500">وضعیت منبع</div><div className="mt-1 text-sm font-black text-white">{analysis ? (analysis.capabilities.solanaFmEnrichment ? 'RPC + SolanaFM' : 'RPC') : 'آماده تحلیل'}</div></div></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><span className="text-[11px] text-slate-500">SOL</span><strong className="mt-2 block font-mono text-sm text-white">{analysis ? formatNumber(analysis.balance.sol, 6) : '—'}</strong></div><div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><span className="text-[11px] text-slate-500">USD</span><strong className="mt-2 block font-mono text-sm text-white">{analysis ? formatUsd(analysis.balance.valueUsd) : '—'}</strong></div></div></div>
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs leading-6 text-slate-500">داده‌های این بخش فقط از آدرس عمومی و منابع on-chain دریافت می‌شوند.</div>
            </aside>
          </div>
        </section>

        {analysis && <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"><span className="text-xs text-slate-500">موجودی SOL</span><strong className="mt-2 block font-mono text-xl text-white">{formatNumber(analysis.balance.sol, 6)}</strong><span className="mt-1 block text-xs text-slate-500">{formatUsd(analysis.balance.valueUsd)}</span></article>
            <article className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"><span className="text-xs text-slate-500">توکن‌های غیرصفر</span><strong className="mt-2 block font-mono text-xl text-white">{formatNumber(analysis.assets.nonZeroTokenCount, 0)}</strong><span className="mt-1 block text-xs text-slate-500">از {formatNumber(analysis.assets.tokenAccountCount, 0)} Token Account</span></article>
            <article className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"><span className="text-xs text-slate-500">تراکنش‌های نمونه</span><strong className="mt-2 block font-mono text-xl text-white">{formatNumber(analysis.activity.transactionCountSampled, 0)}</strong><span className="mt-1 block text-xs text-slate-500">موفق: {formatNumber(analysis.activity.successfulTransactionCountSampled, 0)}</span></article>
            <article className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"><span className="text-xs text-slate-500">NFT قابل مشاهده</span><strong className="mt-2 block font-mono text-xl text-white">{formatNumber(analysis.assets.nftCount, 0)}</strong><span className="mt-1 block text-xs text-slate-500">در داده منبع</span></article>
          </section>
          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]"><div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-white">آخرین فعالیت</h2><Activity className="h-5 w-5 text-[#14F195]" /></div><div className="mt-5 space-y-3">{analysis.activity.transactions.slice(0, 8).map((tx, index) => <div key={`${tx.signature}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4"><div className="min-w-0"><div className="truncate font-mono text-xs text-slate-300">{tx.signature || 'بدون Signature'}</div><div className="mt-1 text-xs text-slate-500">{formatDate(tx.blockTime)}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{tx.status === 'success' ? 'موفق' : 'نامشخص'}</span></div>)}</div></div><aside className="rounded-3xl border border-violet-500/15 bg-violet-500/5 p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-violet-300" /><h2 className="text-xl font-black text-white">منابع و محدودیت‌ها</h2></div><p className="mt-4 text-sm leading-7 text-slate-400">RPC: {analysis.source.rpc} · Enrichment: {analysis.source.enriched}</p><ul className="mt-4 space-y-2 text-xs leading-6 text-slate-500">{analysis.caveats.slice(0, 4).map(item => <li key={item}>• {item}</li>)}</ul></aside></section>
        </>}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{plannedFeatures.map(({ title, text }, index) => <article key={title} className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#14F195]/20 bg-[#14F195]/5 text-[#14F195]">{index === 0 ? <BarChart3 className="h-5 w-5" /> : index === 1 ? <Activity className="h-5 w-5" /> : index === 2 ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</div><h2 className="mt-4 text-sm font-black text-white">{title}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></article>)}</section>

        <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-950/55 p-6 sm:p-8"><span className="text-xs font-black text-[#14F195]">راهنمای تحلیل کیف پول</span><h2 className="mt-3 text-2xl font-black text-white">از یک آدرس عمومی چه چیزهایی می‌توان فهمید؟</h2><p className="mt-4 text-sm leading-8 text-slate-400">موجودی، Token Accountها، بخشی از تاریخچه تراکنش و انتقال‌ها و شاخص‌های فعالیت را می‌توان مستقیم از داده عمومی شبکه بررسی کرد. اما PnL، سود و زیان و امتیاز ریسک نیازمند داده تاریخی و طبقه‌بندی دقیق‌تری هستند و تا فراهم‌شدن داده کافی، عدد ساختگی نمایش داده نمی‌شود.</p></section>
        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/55 p-6 sm:p-8"><h2 className="text-2xl font-black text-white">سؤالات متداول درباره بررسی کیف پول ارز دیجیتال</h2><div className="mt-5 space-y-3">{faq.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-slate-800 bg-slate-900/50 px-5"><summary className="cursor-pointer list-none py-4 text-sm font-extrabold text-slate-100">{question}</summary><div className="border-t border-slate-800/80 pb-4 pt-3 text-sm leading-7 text-slate-400">{answer}</div></details>)}</div></section>
        <section className="mt-8 rounded-3xl border border-[#14F195]/15 bg-[#14F195]/5 p-5 text-sm leading-7 text-slate-300 sm:p-6"><strong className="text-white">نکته امنیتی:</strong> برای تحلیل فقط آدرس عمومی را وارد کنید. Solmint نباید Seed Phrase، Private Key یا رمز عبور شما را دریافت کند.</section>
      </div>
    </main>
  );
};
