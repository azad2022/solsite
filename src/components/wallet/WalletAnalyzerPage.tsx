import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Clock3, Eye, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { applyToolSeo } from '../../utils/toolsSeo';

interface Props {
  onNavigate: (path: string) => void;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const plannedFeatures = [
  { title: 'موجودی و دارایی‌ها', text: 'نمایش دارایی‌های قابل مشاهده، موجودی و توکن‌های مرتبط با آدرس عمومی.' },
  { title: 'فعالیت و تراکنش‌ها', text: 'خلاصه‌ای خوانا از فعالیت اخیر و تعاملات ثبت‌شده روی شبکه.' },
  { title: 'تحلیل عملکرد', text: 'در فاز بعد، شاخص‌های عملکرد و محاسبات تاریخی با داده معتبر اضافه می‌شوند.' },
  { title: 'تحلیل ریسک', text: 'پرچم‌های تحلیلی بر اساس داده عمومی؛ بدون نتیجه‌گیری قطعی درباره مالک آدرس.' },
];

const chains = [
  { key: 'solana', name: 'Solana', status: 'فعال در فاز اول', short: 'SOL' },
  { key: 'ethereum', name: 'Ethereum', status: 'برنامه توسعه', short: 'ETH' },
  { key: 'base', name: 'Base', status: 'برنامه توسعه', short: 'BASE' },
  { key: 'arbitrum', name: 'Arbitrum', status: 'برنامه توسعه', short: 'ARB' },
  { key: 'bnb', name: 'BNB Chain', status: 'برنامه توسعه', short: 'BNB' },
];

const faq = [
  ['آیا برای بررسی کیف پول باید آن را متصل کنم؟', 'خیر. این ابزار برای خواندن داده عمومی بلاکچین طراحی شده و برای مشاهده آدرس نباید به کیف پول متصل شود.'],
  ['آیا Seed Phrase یا Private Key لازم است؟', 'خیر. برای Wallet Analyzer فقط آدرس عمومی لازم است. Seed Phrase و Private Key نباید در این صفحه وارد شوند.'],
  ['آیا می‌توان کیف پول ارز دیجیتال را بررسی کرد؟', 'هدف این صفحه ساخت یک تحلیل‌گر چندزنجیره‌ای است. فاز اول روی Solana متمرکز است و لایه‌های بعدی برای شبکه‌های دیگر طراحی شده‌اند.'],
  ['آیا تحلیل یک آدرس، هویت مالک را مشخص می‌کند؟', 'خیر. داده زنجیره‌ای عمومی درباره یک آدرس الزاماً هویت واقعی صاحب آن را اثبات نمی‌کند.'],
];

function isValidAddress(value: string) {
  return BASE58.test(value.trim());
}

const SolmintMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M7 6.5h15.6c1.8 0 2.7 2.2 1.4 3.5l-2.3 2.3H7.2A3.2 3.2 0 0 1 4 9.1V9.7A3.2 3.2 0 0 1 7 6.5Z" fill="currentColor" opacity=".95" />
    <path d="M25 12.8H9.4c-1.8 0-2.7-2.2-1.4-3.5l2.3-2.3h14.5a3.2 3.2 0 0 1 .2 5.8Z" fill="currentColor" opacity=".55" />
    <path d="M7 19.5h17.6c1.8 0 2.7 2.2 1.4 3.5l-2.3 2.3H7a3.2 3.2 0 0 1 0-5.8Z" fill="currentColor" opacity=".72" />
  </svg>
);

const ChainGlyph = ({ chain }: { chain: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {chain === 'solana' ? (
      <>
        <path d="M5.2 7.2h12.7c.6 0 .9.7.5 1.1l-2.1 2.1H3.8c-.7 0-1-.8-.5-1.3l1.4-1.4a.7.7 0 0 1 .5-.2Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.2 13.6h12.5c.7 0 1 .8.5 1.3l-1.4 1.4a.7.7 0 0 1-.5.2H4.6c-.6 0-.9-.7-.5-1.1l2.1-1.8Z" stroke="currentColor" strokeWidth="1.7" />
      </>
    ) : (
      <><circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.7" /><path d="M8 12.4 11 15l5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>
    )}
  </svg>
);

export const WalletAnalyzerPage: React.FC<Props> = ({ onNavigate }) => {
  const [address, setAddress] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    applyToolSeo({
      title: 'بررسی کیف پول ارز دیجیتال | تحلیل کیف پول سولانا | Wallet Analyzer | سولمینت',
      description: 'ابزار بررسی و تحلیل کیف پول ارز دیجیتال برای آدرس‌های عمومی؛ موجودی، دارایی‌ها، تراکنش‌ها و شاخص‌های فعالیت کیف پول را بررسی کنید. نسخه اولیه با تمرکز بر سولانا و بدون نیاز به Seed Phrase یا اتصال کیف پول.',
      path: '/wallet-analyzer',
    });

    const query = new URLSearchParams(window.location.search).get('address');
    if (query && isValidAddress(query)) setAddress(query);
  }, []);

  const valid = useMemo(() => isValidAddress(address), [address]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    window.history.replaceState({}, '', `/wallet-analyzer?address=${encodeURIComponent(address.trim())}`);
  };

  return (
    <main dir="rtl" className="relative overflow-hidden pb-20 pt-7 sm:pt-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_55%_0%,rgba(20,241,149,.10),transparent_38%),radial-gradient(circle_at_18%_16%,rgba(153,69,255,.08),transparent_34%)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          <button type="button" onClick={() => onNavigate('/')} className="transition hover:text-white">خانه</button>
          <span className="text-slate-700">/</span>
          <button type="button" onClick={() => onNavigate('/tools/solana-token-tools')} className="transition hover:text-white">ابزارها</button>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300">Wallet Analyzer</span>
        </div>

        <section className="mt-6 overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0b12]/90 shadow-[0_30px_100px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
            <div className="border-b border-white/10 p-6 sm:p-9 lg:border-b-0 lg:border-l">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#14F195]/20 bg-[#14F195]/10 text-[#14F195]"><SolmintMark size={23} /></span>
                <div><div className="text-sm font-black text-white">Solmint Wallet Analyzer</div><div className="mt-0.5 text-[11px] text-slate-500">تحلیل آدرس عمومی • Read-only</div></div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {chains.slice(0, 1).map(chain => <span key={chain.key} className="inline-flex items-center gap-2 rounded-full border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-1.5 text-[11px] font-black text-[#14F195]"><ChainGlyph chain={chain.key} />{chain.name}</span>)}
                <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-[11px] font-bold text-slate-500">Multi-chain architecture</span>
              </div>

              <h1 className="mt-6 max-w-4xl text-3xl font-black leading-[1.18] tracking-tight text-white sm:text-5xl">بررسی کیف پول ارز دیجیتال؛ یک آدرس را دقیق و خوانا تحلیل کنید</h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-400 sm:text-base">آدرس عمومی کیف پول را وارد کنید. Wallet Analyzer برای نمایش داده‌های واقعی on-chain طراحی شده است؛ بدون اتصال کیف پول و بدون درخواست اطلاعات حساس. تمرکز فاز اول روی <strong className="text-slate-200">بررسی کیف پول سولانا</strong> است.</p>

              <form onSubmit={submit} className="mt-8 rounded-[26px] border border-slate-800 bg-black/20 p-4 sm:p-5">
                <label htmlFor="wallet-address" className="text-sm font-black text-slate-200">آدرس عمومی کیف پول</label>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    id="wallet-address"
                    value={address}
                    onChange={event => { setAddress(event.target.value); setSubmitted(false); }}
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                    placeholder="Wallet address"
                    aria-describedby="wallet-address-help"
                    className="min-w-0 rounded-2xl border border-slate-700 bg-[#101019] px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#14F195]/60 focus:ring-4 focus:ring-[#14F195]/5"
                  />
                  <button type="submit" className="rounded-2xl bg-[#14F195] px-7 py-4 text-sm font-black text-slate-950 transition hover:brightness-110">تحلیل کیف پول</button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span id="wallet-address-help">فقط آدرس عمومی لازم است.</span><span>Seed Phrase و Private Key هرگز وارد نشوند.</span></div>
                {submitted && !valid && <p role="alert" className="mt-3 text-xs font-bold text-rose-400">آدرس واردشده از نظر قالب Base58 معتبر به نظر نمی‌رسد.</p>}
              </form>

              {submitted && valid && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><strong>آدرس دریافت شد.</strong><p className="mt-1 leading-6 text-amber-100/70">لایه داده on-chain در مرحله بعد متصل می‌شود. تا آن زمان، هیچ موجودی یا عملکرد ساختگی نمایش داده نمی‌شود.</p></div></div>}
            </div>

            <aside className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(153,69,255,.10),rgba(8,8,15,.1))] p-6 sm:p-8">
              <div className="absolute right-[-60px] top-[-60px] h-44 w-44 rounded-full border border-violet-400/10" />
              <div className="absolute left-[-70px] bottom-[-70px] h-52 w-52 rounded-full border border-[#14F195]/10" />
              <div className="relative flex items-center justify-between"><span className="text-[11px] font-black tracking-[.18em] text-violet-300">ANALYSIS LAYER</span><Sparkles className="h-5 w-5 text-violet-300" /></div>
              <div className="relative mt-7 rounded-[26px] border border-white/10 bg-black/25 p-5">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[.04] text-slate-400"><Eye className="h-5 w-5" /></span><div><div className="text-sm font-black text-white">مشاهده‌پذیر، نه حساس</div><div className="mt-1 text-[11px] text-slate-500">Public blockchain data</div></div></div>
                <div className="mt-6 space-y-2.5">
                  {['موجودی و دارایی‌ها', 'توکن‌های موجود', 'آخرین فعالیت', 'تراکنش‌ها', 'تعامل با برنامه‌ها'].map((label, index) => <div key={label} className="flex items-center justify-between rounded-2xl border border-white/[.05] bg-white/[.02] px-4 py-3"><span className="text-xs text-slate-500">{label}</span><span className="font-mono text-xs text-slate-700">{index === 0 ? '— SOL' : '—'}</span></div>)}
                </div>
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[11px] text-slate-500">مدل تحلیل</div><div className="mt-2 text-sm font-black text-white">Read-only</div></div><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[11px] text-slate-500">اطلاعات حساس</div><div className="mt-2 text-sm font-black text-[#14F195]">نیاز نیست</div></div></div>
            </aside>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plannedFeatures.map((feature, index) => <article key={feature.title} className="group rounded-3xl border border-slate-800 bg-slate-950/60 p-5 transition hover:-translate-y-0.5 hover:border-slate-700"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.03] text-slate-400"><SolmintMark size={18} /></span><span className="font-mono text-[10px] text-slate-700">0{index + 1}</span></div><h2 className="mt-4 text-sm font-black text-white">{feature.title}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{feature.text}</p></article>)}
        </section>

        <section className="mt-8 rounded-[30px] border border-slate-800 bg-slate-950/60 p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><span className="text-xs font-black tracking-[.16em] text-violet-300">NETWORK ROADMAP</span><h2 className="mt-3 text-2xl font-black text-white">از یک تحلیل‌گر سولانا به یک Wallet Intelligence چندزنجیره‌ای</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">فاز اول برای سولانا ساخته می‌شود، اما رابط و لایه تحلیل را از ابتدا به شبکه‌های دیگر قابل توسعه نگه می‌داریم. شبکه‌های آینده فعلاً نمایش داده می‌شوند و هنوز فعال نیستند.</p></div><div className="rounded-2xl border border-[#14F195]/15 bg-[#14F195]/5 px-4 py-3 text-right"><div className="text-[10px] font-black text-[#14F195]">CURRENT FOCUS</div><div className="mt-1 text-sm font-black text-white">Solana</div></div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {chains.map((chain, index) => <div key={chain.key} className={`rounded-2xl border p-4 ${index === 0 ? 'border-[#14F195]/25 bg-[#14F195]/5' : 'border-slate-800 bg-slate-900/40'}`}><div className="flex items-center justify-between gap-2"><span className={index === 0 ? 'text-[#14F195]' : 'text-slate-500'}><ChainGlyph chain={chain.key} /></span><span className="font-mono text-[10px] text-slate-700">{chain.short}</span></div><div className="mt-4 text-sm font-black text-white">{chain.name}</div><div className={`mt-1 text-[10px] font-bold ${index === 0 ? 'text-[#14F195]' : 'text-slate-600'}`}>{chain.status}</div></div>)}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <div className="rounded-[30px] border border-slate-800 bg-slate-950/60 p-6 sm:p-8">
            <span className="text-xs font-black text-[#14F195]">ON-CHAIN CONTEXT</span>
            <h2 className="mt-3 text-2xl font-black text-white">از یک آدرس عمومی، چه چیزهایی می‌توان فهمید؟</h2>
            <p className="mt-4 text-sm leading-8 text-slate-400">بلاکچین اطلاعاتی مثل موجودی، انتقال‌ها، توکن‌ها و تعاملات را عمومی ثبت می‌کند. تحلیل‌گر خوب این داده‌ها را به یک نمای قابل فهم تبدیل می‌کند، اما بین «داده قابل مشاهده» و «نتیجه قطعی» تفاوت می‌گذارد.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[#14F195]/15 bg-[#14F195]/5 p-4"><div className="flex items-center gap-2 text-sm font-black text-slate-100"><CheckCircle2 className="h-4 w-4 text-[#14F195]" /> داده عمومی</div><p className="mt-2 text-xs leading-6 text-slate-500">بدون Private Key و بدون دسترسی به دارایی.</p></div><div className="rounded-2xl border border-rose-500/15 bg-rose-500/[.04] p-4"><div className="flex items-center gap-2 text-sm font-black text-slate-100"><XCircle className="h-4 w-4 text-rose-300" /> هویت قطعی نیست</div><p className="mt-2 text-xs leading-6 text-slate-500">یک آدرس عمومی به‌تنهایی هویت واقعی مالک را ثابت نمی‌کند.</p></div></div>
          </div>
          <div className="rounded-[30px] border border-slate-800 bg-slate-950/60 p-6 sm:p-8"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/5 text-violet-300"><ShieldCheck className="h-5 w-5" /></span><div><div className="text-sm font-black text-white">اصل امنیتی</div><div className="mt-1 text-[11px] text-slate-500">Public address only</div></div></div><p className="mt-5 text-sm leading-8 text-slate-400">برای بررسی کیف پول، فقط آدرس عمومی را وارد کنید. هیچ بخش از Wallet Analyzer نباید Seed Phrase، Private Key یا رمز کیف پول را درخواست کند.</p><div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs font-black text-slate-200">قانون ساده</div><div className="mt-2 text-xs leading-6 text-slate-500">مشاهده داده عمومی ≠ واگذاری کنترل کیف پول</div></div></div>
        </section>

        <section className="mt-8 rounded-[30px] border border-slate-800 bg-slate-950/60 p-6 sm:p-8" aria-labelledby="wallet-analyzer-faq-title">
          <h2 id="wallet-analyzer-faq-title" className="text-2xl font-black text-white">سؤالات متداول درباره بررسی کیف پول ارز دیجیتال</h2>
          <div className="mt-5 space-y-3">{faq.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-slate-800 bg-slate-900/50 px-5"><summary className="cursor-pointer list-none py-4 text-sm font-extrabold text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#14F195]/50">{question}</summary><div className="border-t border-slate-800/80 pb-4 pt-3 text-sm leading-7 text-slate-400">{answer}</div></details>)}</div>
        </section>
      </div>
    </main>
  );
};
