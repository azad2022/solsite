import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, CheckCircle2, Clock3, Coins, ShieldCheck, Sparkles, Wallet, XCircle } from 'lucide-react';
import { applyToolSeo } from '../../utils/toolsSeo';

interface Props {
  onNavigate: (path: string) => void;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const plannedFeatures = [
  { icon: Wallet, title: 'موجودی و دارایی‌ها', text: 'نمایش SOL، توکن‌ها و دارایی‌های قابل مشاهده در آدرس عمومی کیف پول.' },
  { icon: Activity, title: 'فعالیت و تراکنش‌ها', text: 'جمع‌بندی فعالیت‌های اخیر و بررسی تراکنش‌های ثبت‌شده روی شبکه.' },
  { icon: BarChart3, title: 'تحلیل عملکرد', text: 'در مراحل بعد، شاخص‌های عملکرد، سود و زیان و رفتار معاملاتی اضافه می‌شوند.' },
  { icon: ShieldCheck, title: 'تحلیل ریسک', text: 'بررسی الگوهای قابل استخراج از داده عمومی، بدون ادعای شناسایی قطعی مالک کیف پول.' },
];

const faq = [
  ['آیا برای بررسی کیف پول باید آن را متصل کنم؟', 'خیر. نسخه read-only این ابزار با آدرس عمومی کیف پول کار می‌کند و برای بررسی اطلاعات عمومی بلاکچین نیازی به اتصال کیف پول ندارد.'],
  ['آیا Seed Phrase یا Private Key لازم است؟', 'خیر. هرگز Seed Phrase، Private Key یا رمز کیف پول را وارد نکنید. Wallet Analyzer فقط برای بررسی داده‌های عمومی طراحی می‌شود.'],
  ['آیا می‌توان کیف پول ارز دیجیتال را بررسی کرد؟', 'بله، هدف این صفحه ساخت یک لایه تحلیل برای آدرس‌های عمومی است. در نسخه فعلی، تمرکز اولیه روی داده‌های شبکه سولاناست و معماری برای اضافه‌شدن شبکه‌های دیگر در آینده آماده شده است.'],
  ['آیا اطلاعات این ابزار قطعی و مالکیت کیف پول را مشخص می‌کند؟', 'خیر. اطلاعات روی بلاکچین عمومی هستند، اما از روی یک آدرس عمومی نمی‌توان هویت واقعی صاحب آن را صرفاً از روی داده زنجیره‌ای اثبات کرد.'],
];

function isValidAddress(value: string) {
  return BASE58.test(value.trim());
}

export const WalletAnalyzerPage: React.FC<Props> = ({ onNavigate }) => {
  const [address, setAddress] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const pasteFromClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value) return;
      setAddress(value.trim());
      setSubmitted(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main dir="rtl" className="relative overflow-hidden pb-16 pt-8 sm:pt-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_10%,rgba(20,241,149,.12),transparent_48%),radial-gradient(circle_at_82%_20%,rgba(153,69,255,.10),transparent_38%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          <button type="button" onClick={() => onNavigate('/')} className="transition hover:text-white">خانه</button>
          <span>/</span>
          <button type="button" onClick={() => onNavigate('/tools/solana-token-tools')} className="transition hover:text-white">ابزارها</button>
          <span>/</span>
          <span className="text-slate-300">تحلیل کیف پول</span>
        </div>

        <section className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] lg:items-stretch">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/65 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-9">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-1 text-[11px] font-black text-[#14F195]">WALLET INTELLIGENCE</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-400">Read-only</span>
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[1.2] tracking-tight text-white sm:text-5xl">بررسی کیف پول ارز دیجیتال؛ تحلیل یک آدرس کریپتویی بدون اتصال به کیف پول</h1>
            <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-400 sm:text-base">آدرس عمومی یک کیف پول را وارد کنید تا در لایه تحلیل Solmint، موجودی، دارایی‌ها، فعالیت و شاخص‌های قابل استخراج از بلاکچین بررسی شود. این ابزار برای تحقیق روی <strong className="text-slate-200">کیف پول سولانا</strong> و در آینده برای شبکه‌های بیشتر طراحی شده است.</p>

            <form onSubmit={submit} className="mt-7 rounded-3xl border border-slate-800 bg-black/20 p-4 sm:p-5">
              <label htmlFor="wallet-address" className="text-sm font-black text-slate-200">آدرس کیف پول</label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <input
                    id="wallet-address"
                    value={address}
                    onChange={event => { setAddress(event.target.value); setSubmitted(false); }}
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                    placeholder="مثلاً 7xK..."
                    aria-describedby="wallet-address-help"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-4 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#14F195]/60 focus:ring-4 focus:ring-[#14F195]/5"
                  />
                </div>
                <button type="button" onClick={pasteFromClipboard} className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">{copied ? 'کپی شد' : 'چسباندن آدرس'}</button>
                <button type="submit" className="rounded-2xl bg-[#14F195] px-6 py-4 text-sm font-black text-slate-950 transition hover:brightness-110">تحلیل کیف پول</button>
              </div>
              <p id="wallet-address-help" className="mt-3 text-xs leading-6 text-slate-500">فقط آدرس عمومی لازم است. Seed Phrase و Private Key را هرگز وارد نکنید.</p>
              {submitted && !valid && <p role="alert" className="mt-2 text-xs font-bold text-rose-400">آدرس واردشده از نظر قالب Base58 معتبر به نظر نمی‌رسد.</p>}
            </form>

            {submitted && valid && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                <div><strong>آدرس دریافت شد.</strong><p className="mt-1 leading-6 text-amber-100/70">لایه داده on-chain در مرحله بعد به این رابط متصل می‌شود. تا قبل از فعال‌شدن آن، این صفحه هیچ داده ساختگی درباره موجودی یا عملکرد کیف پول نمایش نمی‌دهد.</p></div>
              </div>
            )}
          </div>

          <aside className="rounded-[30px] border border-[#9945FF]/20 bg-[linear-gradient(180deg,rgba(153,69,255,.10),rgba(8,8,15,.72))] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-black tracking-[.14em] text-violet-300">ANALYZER PREVIEW</span><Sparkles className="h-5 w-5 text-violet-300" /></div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">Wallet status</span><span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-black text-slate-400">در انتظار داده</span></div>
              <div className="mt-4 space-y-3">
                {['موجودی SOL', 'ارزش تقریبی دارایی‌ها', 'تعداد توکن‌ها', 'آخرین فعالیت', 'سابقه تراکنش‌ها'].map(label => <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3"><span className="text-xs text-slate-500">{label}</span><span className="font-mono text-sm font-bold text-slate-700">—</span></div>)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"><span className="text-[11px] font-bold text-slate-500">حالت فعلی</span><strong className="mt-2 block text-sm text-white">Read-only</strong></div><div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"><span className="text-[11px] font-bold text-slate-500">نیاز به Seed</span><strong className="mt-2 block text-sm text-[#14F195]">خیر</strong></div></div>
          </aside>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plannedFeatures.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5 transition hover:-translate-y-0.5 hover:border-slate-700"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#14F195]/20 bg-[#14F195]/5"><Icon className="h-5 w-5 text-[#14F195]" /></div><h2 className="mt-4 text-sm font-black text-white">{title}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></article>)}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6 sm:p-8">
            <span className="text-xs font-black text-[#14F195]">چرا تحلیل آدرس کیف پول؟</span>
            <h2 className="mt-3 text-2xl font-black text-white">از یک آدرس عمومی، چه چیزهایی می‌توان فهمید؟</h2>
            <p className="mt-4 text-sm leading-8 text-slate-400">بلاکچین اطلاعات زیادی را به‌صورت عمومی ثبت می‌کند. بررسی کیف پول می‌تواند تصویری از موجودی، دارایی‌ها، تعامل با برنامه‌ها، تاریخچه تراکنش و الگوهای فعالیت یک آدرس ارائه دهد؛ اما نباید این داده‌ها را با هویت واقعی فرد یا یک گزارش قطعی از سود و زیان اشتباه گرفت.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-2 text-sm font-black text-slate-100"><CheckCircle2 className="h-4 w-4 text-[#14F195]" /> داده عمومی بلاکچین</div><p className="mt-2 text-xs leading-6 text-slate-500">بدون نیاز به Private Key یا دسترسی به دارایی.</p></div><div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-2 text-sm font-black text-slate-100"><XCircle className="h-4 w-4 text-rose-300" /> نه مالکیت قطعی</div><p className="mt-2 text-xs leading-6 text-slate-500">از روی آدرس عمومی نمی‌توان هویت واقعی مالک را اثبات کرد.</p></div></div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6 sm:p-8"><span className="text-xs font-black text-violet-300">برای توسعه آینده</span><h2 className="mt-3 text-xl font-black text-white">از سولانا شروع می‌کنیم، اما محدود به سولانا نمی‌مانیم</h2><p className="mt-3 text-sm leading-7 text-slate-400">معماری صفحه به‌گونه‌ای طراحی شده که در آینده بتوان شبکه‌های دیگر را به آن اضافه کرد؛ بدون تغییر اساسی در رابط کاربری و تجربه کاربر.</p><div className="mt-5 flex flex-wrap gap-2">{['Solana', 'Ethereum', 'Base', 'Arbitrum', 'BNB Chain'].map(chain => <span key={chain} className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-[11px] font-bold text-slate-400">{chain}</span>)}</div></div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-950/55 p-6 sm:p-8" aria-labelledby="wallet-analyzer-faq-title">
          <h2 id="wallet-analyzer-faq-title" className="text-2xl font-black text-white">سؤالات متداول درباره بررسی کیف پول ارز دیجیتال</h2>
          <div className="mt-5 space-y-3">{faq.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-slate-800 bg-slate-900/50 px-5"><summary className="cursor-pointer list-none py-4 text-sm font-extrabold text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#14F195]/50">{question}</summary><div className="border-t border-slate-800/80 pb-4 pt-3 text-sm leading-7 text-slate-400">{answer}</div></details>)}</div>
        </section>

        <section className="mt-8 rounded-3xl border border-[#14F195]/15 bg-[#14F195]/5 p-5 text-sm leading-7 text-slate-300 sm:p-6">
          <strong className="text-white">نکته امنیتی:</strong> Wallet Analyzer فقط باید با آدرس عمومی کار کند. اگر سایتی برای «بررسی کیف پول» از شما Seed Phrase، Private Key یا رمز عبور می‌خواهد، آن اطلاعات را وارد نکنید.
        </section>
      </div>
    </main>
  );
};
