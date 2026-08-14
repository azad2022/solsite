import React from 'react';
import { Zap, Send, ShieldCheck, Lock, Smartphone, Github, ScanSearch, Boxes, ArrowLeft, Sparkles, Activity, Shield } from 'lucide-react';

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
    description: 'Mint، Authority، عرضه و شاخص‌های فنی توکن را مستقیماً از داده‌های شبکه بررسی کنید.',
    accent: 'emerald',
    metric: 'MINT ANALYSIS',
  },
  {
    href: '/tools/token-2022-inspector',
    icon: Boxes,
    eyebrow: 'TOKEN-2022',
    title: 'Token-2022 Inspector',
    description: 'Extensionهای فعال و قابلیت‌های فنی Mintهای Token-2022 را شناسایی و بررسی کنید.',
    accent: 'violet',
    metric: 'EXTENSION CHECK',
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
        <section aria-labelledby="footer-tools-title" className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#08090f] p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
            <div className="absolute -right-28 -top-32 h-72 w-72 rounded-full bg-[#14F195]/[0.07] blur-3xl" />
            <div className="absolute -left-28 -bottom-36 h-80 w-80 rounded-full bg-[#9945FF]/[0.08] blur-3xl" />
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#14F195]/40 to-transparent" />
          </div>

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl text-center lg:text-right">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#14F195]/20 bg-[#14F195]/[0.055] px-3 py-1.5 text-[10px] font-black tracking-[0.12em] text-[#14F195]">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                ابزارهای آن‌چین رایگان
              </div>
              <h2 id="footer-tools-title" className="text-xl font-black tracking-tight text-white sm:text-2xl">
                قبل از تصمیم، توکن را بررسی کنید
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-400 lg:mx-0">
                دو ابزار تخصصی Solmint برای بررسی داده‌های واقعی شبکه سولانا؛ بدون اتصال کیف پول و بدون ارسال تراکنش.
              </p>
            </div>
            <button type="button" onClick={() => handleNav('/tools/solana-token-tools')} className="group mx-auto inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-extrabold text-slate-200 transition-all duration-300 hover:border-[#14F195]/25 hover:bg-[#14F195]/[0.06] hover:text-white lg:mx-0">
              مرکز ابزارها
              <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mt-6 grid gap-4 md:grid-cols-2">
            {toolCards.map(({ href, icon: Icon, eyebrow, title, description, accent, metric }) => {
              const emerald = accent === 'emerald';
              return (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => { e.preventDefault(); handleNav(href); }}
                  className="group relative overflow-hidden rounded-[1.45rem] border border-white/[0.09] bg-black/30 p-5 outline-none transition-[transform,border-color,background-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-white/[0.18] hover:bg-white/[0.035] hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-[#14F195]/60"
                >
                  <div className={`pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-125 ${emerald ? 'bg-[#14F195]/10' : 'bg-[#9945FF]/11'}`} aria-hidden="true" />
                  <div className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 opacity-0 transition-all duration-1000 group-hover:left-[125%] group-hover:opacity-100 ${emerald ? 'bg-gradient-to-r from-transparent via-[#14F195]/[0.08] to-transparent' : 'bg-gradient-to-r from-transparent via-[#9945FF]/[0.09] to-transparent'}`} aria-hidden="true" />

                  <div className="relative flex items-start gap-4">
                    <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 group-hover:scale-105 ${emerald ? 'border-[#14F195]/20 bg-[#14F195]/[0.07] text-[#14F195] group-hover:border-[#14F195]/40 group-hover:shadow-[0_0_30px_rgba(20,241,149,0.14)]' : 'border-[#9945FF]/20 bg-[#9945FF]/[0.07] text-[#c29aff] group-hover:border-[#9945FF]/40 group-hover:shadow-[0_0_30px_rgba(153,69,255,0.15)]'}`}>
                      <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                      <span className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-[#08090f] ${emerald ? 'bg-[#14F195]' : 'bg-[#9945FF]'}`} aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1 text-right">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[9px] font-black tracking-[0.13em] ${emerald ? 'text-[#14F195]/65' : 'text-[#c29aff]/65'}`}>{eyebrow}</span>
                        <span className="text-[9px] font-bold tracking-[0.08em] text-slate-600">{metric}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-white sm:text-base">{title}</h3>
                        <ArrowLeft className="h-4 w-4 shrink-0 text-slate-600 transition-all duration-300 group-hover:-translate-x-1 group-hover:text-slate-300" aria-hidden="true" />
                      </div>
                      <p className="mt-2 text-xs leading-6 text-slate-500 transition-colors duration-300 group-hover:text-slate-400">{description}</p>
                    </div>
                  </div>

                  <div className="relative mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:text-slate-400">
                      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${emerald ? 'bg-[#14F195]' : 'bg-[#9945FF]'}`} aria-hidden="true" />
                      داده زنده شبکه
                    </span>
                    <span className={`text-[10px] font-black opacity-0 translate-x-2 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 ${emerald ? 'text-[#14F195]' : 'text-[#c29aff]'}`}>شروع بررسی ←</span>
                  </div>
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
          <a href="https://www.producthunt.com/products/solmint-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-solmint-2" target="_blank" rel="noopener noreferrer" aria-label="Solmint on Product Hunt" className="inline-block transition-opacity hover:opacity-90">
            <img alt="solmint - solana web3 wallet | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1218856&theme=light&t=1786302074692" />
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
