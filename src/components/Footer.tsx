import React from 'react';
import { Zap, Send, ShieldCheck, Lock, Smartphone, Github, ScanSearch, Boxes, ArrowLeft, Sparkles } from 'lucide-react';

interface FooterProps {
  onNavigate?: (path: string) => void;
  openAdminModal: () => void;
}

const toolCards = [
  {
    href: '/tools/solana-token-scanner',
    icon: ScanSearch,
    eyebrow: 'ON-CHAIN ANALYSIS',
    title: 'Solana Token Scanner',
    description: 'بررسی سریع Mint، Authority و وضعیت فنی توکن روی شبکه سولانا.',
    accent: 'emerald',
  },
  {
    href: '/tools/token-2022-inspector',
    icon: Boxes,
    eyebrow: 'TOKEN-2022',
    title: 'Token-2022 Inspector',
    description: 'شناسایی Extensionها و قابلیت‌های فعال روی Mintهای Token-2022.',
    accent: 'violet',
  },
];

export const Footer: React.FC<FooterProps> = ({ onNavigate, openAdminModal }) => {
  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#05050a] border-t border-white/[0.08] pt-16 pb-10 text-slate-300 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <section aria-labelledby="footer-tools-title" className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[radial-gradient(circle_at_15%_20%,rgba(20,241,149,0.09),transparent_34%),radial-gradient(circle_at_85%_80%,rgba(153,69,255,0.10),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#14F195]/[0.06] blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -left-20 -bottom-28 h-64 w-64 rounded-full bg-[#9945FF]/[0.07] blur-3xl" aria-hidden="true" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl text-center lg:text-right">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#14F195]/20 bg-[#14F195]/[0.06] px-3 py-1.5 text-[10px] font-black tracking-[0.12em] text-[#14F195]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                ابزارهای رایگان سولانا
              </div>
              <h2 id="footer-tools-title" className="text-xl font-black tracking-tight text-white sm:text-2xl">
                ابزارهای حرفه‌ای برای بررسی توکن‌های سولانا
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-400 lg:mx-0">
                قبل از تصمیم‌گیری، داده‌های روی زنجیره را بررسی کنید. ابزارهای Solmint بدون نیاز به اتصال کیف پول، برای تحقیق اولیه ساخته شده‌اند.
              </p>
            </div>
            <button type="button" onClick={() => handleNav('/tools/solana-token-tools')} className="group mx-auto inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-extrabold text-slate-200 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white lg:mx-0">
              مشاهده همه ابزارها
              <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2">
            {toolCards.map(({ href, icon: Icon, eyebrow, title, description, accent }) => {
              const emerald = accent === 'emerald';
              return (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => { e.preventDefault(); handleNav(href); }}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 p-4 outline-none transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.045] focus-visible:ring-2 focus-visible:ring-[#14F195]/60"
                >
                  <div className={`pointer-events-none absolute -right-16 -top-20 h-36 w-36 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150 ${emerald ? 'bg-[#14F195]/10' : 'bg-[#9945FF]/10'}`} aria-hidden="true" />
                  <div className="relative flex items-start gap-4">
                    <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 group-hover:rotate-3 group-hover:scale-105 ${emerald ? 'border-[#14F195]/20 bg-[#14F195]/[0.08] text-[#14F195] group-hover:shadow-[0_0_28px_rgba(20,241,149,0.16)]' : 'border-[#9945FF]/20 bg-[#9945FF]/[0.08] text-[#c29aff] group-hover:shadow-[0_0_28px_rgba(153,69,255,0.16)]'}`}>
                      <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <div className={`text-[9px] font-black tracking-[0.14em] ${emerald ? 'text-[#14F195]/70' : 'text-[#c29aff]/70'}`}>{eyebrow}</div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-white transition-colors group-hover:text-white sm:text-base">{title}</h3>
                        <ArrowLeft className="h-4 w-4 shrink-0 text-slate-600 transition-all duration-300 group-hover:-translate-x-1 group-hover:text-slate-300" aria-hidden="true" />
                      </div>
                      <p className="mt-1.5 text-xs leading-6 text-slate-500 transition-colors group-hover:text-slate-400">{description}</p>
                    </div>
                  </div>
                  <div className={`mt-4 h-px origin-right scale-x-0 transition-transform duration-500 group-hover:scale-x-100 ${emerald ? 'bg-gradient-to-l from-[#14F195]/50 to-transparent' : 'bg-gradient-to-l from-[#9945FF]/50 to-transparent'}`} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-right">
            <span className="font-bold text-white text-base block">دسترسی سریع و صفحات رسمی</span>
            <ul className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 text-slate-200">
              <li><a href="/" onClick={(e) => { e.preventDefault(); handleNav('/'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">صفحه اصلی</a></li>
              <li><a href="/app-guide" onClick={(e) => { e.preventDefault(); handleNav('/app-guide'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none font-bold">راهنمای کامل اپلیکیشن</a></li>
              <li><a href="/solana-wallet" onClick={(e) => { e.preventDefault(); handleNav('/solana-wallet'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">کیف پول سولانا</a></li>
              <li><a href="/solana-token" onClick={(e) => { e.preventDefault(); handleNav('/solana-token'); }} className="hover:text-cyan-300 transition-colors cursor-pointer text-inherit decoration-none">ساخت توکن SPL</a></li>
              <li><a href="/solana-meme-coin" onClick={(e) => { e.preventDefault(); handleNav('/solana-meme-coin'); }} className="hover:text-amber-300 transition-colors cursor-pointer text-inherit decoration-none">ساخت میم کوین</a></li>
              <li><a href="/solana-nft" onClick={(e) => { e.preventDefault(); handleNav('/solana-nft'); }} className="hover:text-purple-300 transition-colors cursor-pointer text-inherit decoration-none">ساخت NFT سولانا</a></li>
              <li><a href="/security" onClick={(e) => { e.preventDefault(); handleNav('/security'); }} className="hover:text-emerald-400 transition-colors cursor-pointer text-inherit decoration-none">معماری امنیتی غیرامانی</a></li>
              <li><a href="/download" onClick={(e) => { e.preventDefault(); handleNav('/download'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">دانلود اپلیکیشن اندروید</a></li>
              <li><a href="/faq" onClick={(e) => { e.preventDefault(); handleNav('/faq'); }} className="hover:text-sky-300 transition-colors cursor-pointer text-inherit decoration-none">سوالات متداول</a></li>
              <li><a href="/blog" onClick={(e) => { e.preventDefault(); handleNav('/blog'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">وبلاگ و آکادمی (solmint.ir)</a></li>
              <li><button onClick={openAdminModal} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-emerald-400" /><span>ورود / ثبت‌نام</span></button></li>
            </ul>
          </div>
        </div>

        <div className="pt-2 flex flex-col items-center gap-3">
          <a href="https://www.producthunt.com/products/solmint-3?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-solmint-2" target="_blank" rel="noopener noreferrer" aria-label="Solmint on Product Hunt" className="inline-block transition-opacity hover:opacity-90">
            <img alt="solmint - solana web3 wallet | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1218856&amp;theme=light&amp;t=1786302074692" />
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" className="flex items-center justify-center text-slate-300 hover:text-white transition-colors mt-1">
            <Github className="w-[54px] h-[54px]" aria-hidden="true" />
          </a>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-300 text-xs">
          <span className="w-full text-center sm:text-right leading-6 break-words [overflow-wrap:anywhere]">تمامی حقوق برای برند و پلتفرم سولمینت (solmint.ir) محفوظ است</span>
          <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-4 min-w-0">
            <span className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 font-mono text-slate-200 text-center leading-5 whitespace-nowrap">
              <span>Solmint Wallet —</span>
              <span>Official Android Web3 Platform</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
