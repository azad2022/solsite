import React, { useState } from 'react';
import { SolanaStatus, UserAccount } from '../types';
import { Menu, X, BookOpen, User, LogOut, ShieldCheck, Smartphone, Wrench, ChevronDown, Search, Activity } from 'lucide-react';
import { HeaderMarketTicker } from './HeaderMarketTicker';

export const SolanaLogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M5.2 16.4h12.55c.55 0 .84.67.44 1.04l-1.72 1.58a1.45 1.45 0 0 1-.98.38H2.95c-.55 0-.84-.67-.44-1.04l1.72-1.58c.27-.25.62-.38.97-.38Z" fill="currentColor"/>
    <path d="M5.2 4.6h12.55c.55 0 .84-.67.44-1.04L16.47 1.98a1.45 1.45 0 0 0-.98-.38H2.95c-.55 0-.84.67-.44 1.04l1.72 1.58c.27.25.62.38.97.38Z" fill="currentColor"/>
    <path d="M19.8 10.5H7.25c-.55 0-.84.67-.44 1.04l1.72 1.58c.27.25.62.38.98.38h12.55c.55 0 .84-.67.44-1.04l-1.72-1.58a1.45 1.45 0 0 0-.98-.38Z" fill="currentColor"/>
  </svg>
);

interface HeaderProps {
  solanaStatus: SolanaStatus;
  refreshStatus: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
  openAdminModal: () => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
}

const navClass = (active: boolean) => `shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer text-inherit decoration-none ${active ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white'}`;
const mobileNavClass = (active: boolean) => `w-full text-right px-4 py-2.5 rounded-xl text-xs font-semibold ${active ? 'bg-[#9945FF]/20 text-[#14F195] border border-[#9945FF]/40' : 'text-slate-300 bg-white/5'}`;

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate, openAdminModal, currentUser, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const handleNav = (path: string) => { setMobileMenuOpen(false); setToolsOpen(false); onNavigate(path); };
  const canManageShowcase = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const toolsActive = currentPath.startsWith('/tools/');
  const walletAnalyzerActive = currentPath === '/wallet-analyzer';

  return (
    <header className="relative z-40 w-full bg-[#08080f]">
      <div className="mx-auto max-w-7xl px-2 py-2 sm:px-4 lg:px-6">
        <div className="overflow-visible rounded-2xl border border-white/[0.10] bg-[#05050a]/95 shadow-[0_14px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
            <div onClick={() => handleNav('/')} className="flex shrink-0 cursor-pointer items-center gap-2.5 group">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible transition-transform group-hover:scale-105">
                <img src="/assets/solmint-mascot-solana-coin.webp?v=2" alt="" aria-hidden="true" className="absolute left-1/2 top-1/2 z-10 h-[68px] w-[68px] -translate-x-1/2 -translate-y-[54%] object-contain pointer-events-none" width="68" height="68" decoding="async" />
              </div>
              <div className="hidden sm:flex flex-col"><span className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-white">سولمینت <span className="rounded-full border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#14F195]">Solmint</span></span></div>
            </div>

            <nav className="hidden items-center gap-0.5 overflow-visible whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] p-1 lg:flex">
              <a href="/" onClick={e => { e.preventDefault(); handleNav('/'); }} className={navClass(currentPath === '/')}>صفحه اصلی</a>
              <a href="/solana-wallet" onClick={e => { e.preventDefault(); handleNav('/solana-wallet'); }} className={navClass(currentPath === '/solana-wallet')}>کیف پول سولانا</a>
              <a href="/wallet-analyzer" onClick={e => { e.preventDefault(); handleNav('/wallet-analyzer'); }} className={`${navClass(walletAnalyzerActive)} inline-flex items-center gap-1.5 ${walletAnalyzerActive ? 'border border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]' : ''}`}><Activity className="h-3.5 w-3.5" /><span>تحلیل کیف پول</span></a>
              <a href="/solana-price" onClick={e => { e.preventDefault(); handleNav('/solana-price'); }} className={`${navClass(currentPath === '/solana-price')} ${currentPath === '/solana-price' ? 'border border-[#14F195]/30 bg-[#14F195]/15 text-[#14F195]' : ''}`}>قیمت لحظه‌ای سولانا</a>
              <a href="/solana-token" onClick={e => { e.preventDefault(); handleNav('/solana-token'); }} className={navClass(currentPath === '/solana-token')}>ساخت توکن</a>
              <a href="/solana-meme-coin" onClick={e => { e.preventDefault(); handleNav('/solana-meme-coin'); }} className={navClass(currentPath === '/solana-meme-coin')}>میم کوین</a>
              <a href="/security" onClick={e => { e.preventDefault(); handleNav('/security'); }} className={navClass(currentPath === '/security')}>امنیت</a>
              <div className="relative flex items-center" onMouseEnter={() => setToolsOpen(true)} onMouseLeave={() => setToolsOpen(false)}>
                <a href="/tools/solana-token-tools" onClick={e => { e.preventDefault(); handleNav('/tools/solana-token-tools'); }} className={`${navClass(toolsActive)} inline-flex items-center gap-1.5 ${toolsActive ? 'border border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]' : ''}`} aria-label="ابزارهای سولمینت"><Wrench className="h-3.5 w-3.5" /><span>ابزارها</span></a>
                <button type="button" aria-haspopup="menu" aria-expanded={toolsOpen} aria-label="نمایش فهرست ابزارها" onClick={() => setToolsOpen(v => !v)} className={`${navClass(toolsActive)} !px-1 inline-flex items-center ${toolsActive ? 'bg-[#14F195]/10 text-[#14F195]' : ''}`}><ChevronDown className={`h-3 w-3 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} /></button>
                {toolsOpen && <div role="menu" className="absolute right-0 top-full z-50 w-72 pt-2"><div className="rounded-2xl border border-white/10 bg-[#0a0a12]/98 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  <button type="button" onClick={() => handleNav('/tools/solana-token-tools')} className="w-full rounded-xl px-3 py-3 text-right transition-colors hover:bg-white/5" role="menuitem"><span className="flex items-center gap-2 text-sm font-black text-white"><Wrench className="h-4 w-4 text-[#14F195]" />ابزارهای توکن سولانا</span><span className="mt-1 block pr-6 text-[11px] leading-5 text-slate-500">مرکز ابزارهای بررسی فنی توکن‌ها</span></button>
                  <button type="button" onClick={() => handleNav('/tools/solana-token-scanner')} className="w-full rounded-xl px-3 py-3 text-right transition-colors hover:bg-white/5" role="menuitem"><span className="flex items-center gap-2 text-sm font-bold text-slate-200"><Search className="h-4 w-4 text-cyan-300" />بررسی توکن سولانا</span><span className="mt-1 block pr-6 text-[11px] leading-5 text-slate-500">Authority، Supply، Metadata و توزیع</span></button>
                  <button type="button" onClick={() => handleNav('/tools/token-2022-inspector')} className="w-full rounded-xl px-3 py-3 text-right transition-colors hover:bg-white/5" role="menuitem"><span className="flex items-center gap-2 text-sm font-bold text-slate-200"><ShieldCheck className="h-4 w-4 text-[#9945FF]" />Token-2022 Inspector</span><span className="mt-1 block pr-6 text-[11px] leading-5 text-slate-500">بررسی Extensionهای Token-2022</span></button>
                </div></div>}
              </div>
              <a href="/faq" onClick={e => { e.preventDefault(); handleNav('/faq'); }} className={navClass(currentPath === '/faq')}>سوالات متداول</a>
              <a href="/blog" onClick={e => { e.preventDefault(); handleNav('/blog'); }} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-bold transition-all ${currentPath === '/blog' || currentPath.startsWith('/article/') ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black shadow-md' : 'text-slate-300 hover:text-white'}`}><BookOpen className="h-3.5 w-3.5" />وبلاگ</a>
            </nav>

            <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
              {currentUser ? <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-xs text-slate-200">
                {canManageShowcase && <button onClick={() => handleNav('/showcase-admin')} title="مدیریت نمایش اپلیکیشن" className="flex items-center gap-1.5 rounded-lg border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-1 font-bold text-[#14F195] hover:bg-[#14F195]/20"><Smartphone className="h-3.5 w-3.5" />Showcase</button>}
                <button onClick={openAdminModal} className="flex items-center gap-1.5 font-bold transition-colors hover:text-[#14F195]">{canManageShowcase ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <User className="h-4 w-4 text-sky-400" />}<span>{currentUser.fullName}</span>{canManageShowcase && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">مدیر</span>}</button>
                <span className="text-slate-600">|</span><button onClick={onLogout} title="خروج از حساب" aria-label="خروج از حساب" className="p-0.5 text-slate-400 transition-colors hover:text-rose-400"><LogOut className="h-3.5 w-3.5" /></button>
              </div> : <button onClick={openAdminModal} title="ورود / ثبت‌نام" aria-label="ورود / ثبت‌نام" className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10"><User className="h-4 h-4" />ورود / ثبت‌نام</button>}
            </div>

            <button onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? 'بستن منوی اصلی' : 'باز کردن منوی اصلی'} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white lg:hidden">{mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
          </div>

          <HeaderMarketTicker />

          {mobileMenuOpen && <div className="border-t border-white/10 bg-[#08080f]/98 px-4 py-5 backdrop-blur-2xl lg:hidden">
            <div className="space-y-2">
              <button onClick={() => handleNav('/')} className={mobileNavClass(currentPath === '/')}>صفحه اصلی</button>
              <button onClick={() => handleNav('/solana-wallet')} className={mobileNavClass(currentPath === '/solana-wallet')}>کیف پول سولانا</button>
              <button onClick={() => handleNav('/wallet-analyzer')} className={mobileNavClass(walletAnalyzerActive)}>تحلیل کیف پول ارز دیجیتال</button>
              <button onClick={() => handleNav('/solana-price')} className={mobileNavClass(currentPath === '/solana-price')}>قیمت لحظه‌ای سولانا</button>
              <button onClick={() => handleNav('/solana-token')} className={mobileNavClass(currentPath === '/solana-token')}>ساخت توکن</button>
              <button onClick={() => handleNav('/solana-meme-coin')} className={mobileNavClass(currentPath === '/solana-meme-coin')}>ساخت میم کوین</button>
              <button onClick={() => handleNav('/security')} className={mobileNavClass(currentPath === '/security')}>معماری امنیتی غیرامانی</button>
              <div className={`rounded-2xl border p-2 ${toolsActive ? 'border-[#14F195]/30 bg-[#14F195]/5' : 'border-white/10 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-2 px-3 py-2"><Wrench className="h-4 w-4 text-[#14F195]" /><span className="text-xs font-black text-white">ابزارهای Solmint</span></div>
                <button onClick={() => handleNav('/tools/solana-token-tools')} className="w-full rounded-xl px-3 py-2.5 text-right text-xs font-bold text-slate-300 hover:bg-white/5">مرکز ابزارهای توکن سولانا</button>
                <button onClick={() => handleNav('/tools/solana-token-scanner')} className="w-full rounded-xl px-3 py-2.5 text-right text-xs font-semibold text-slate-300 hover:bg-white/5">بررسی توکن سولانا</button>
                <button onClick={() => handleNav('/tools/token-2022-inspector')} className="w-full rounded-xl px-3 py-2.5 text-right text-xs font-semibold text-slate-300 hover:bg-white/5">Token-2022 Inspector</button>
              </div>
              <button onClick={() => handleNav('/download')} className={mobileNavClass(currentPath === '/download')}>دانلود نسخه اندروید</button>
              <button onClick={() => handleNav('/faq')} className={mobileNavClass(currentPath === '/faq')}>سوالات متداول</button>
              <button onClick={() => handleNav('/blog')} className={`flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-right text-xs font-bold ${currentPath === '/blog' ? 'border border-[#9945FF]/40 bg-[#9945FF]/20 text-[#14F195]' : 'bg-white/5 text-slate-300'}`}><BookOpen className="h-4 w-4 text-[#14F195]" />وبلاگ و آکادمی solmint.ir</button>
              {currentUser && canManageShowcase && <button onClick={() => handleNav('/showcase-admin')} className="flex w-full items-center gap-2 rounded-xl border border-[#14F195]/25 bg-[#14F195]/10 px-4 py-2.5 text-right text-xs font-bold text-[#14F195]"><Smartphone className="h-4 w-4" />مدیریت نمایش اپلیکیشن</button>}
              {currentUser ? <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-3"><button onClick={openAdminModal} className="flex items-center gap-2 text-xs font-bold text-slate-200">{canManageShowcase ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <User className="h-4 w-4 text-sky-400" />}<span>{currentUser.fullName}</span></button><button onClick={onLogout} title="خروج از حساب" aria-label="خروج از حساب" className="p-1 text-slate-400 hover:text-rose-400"><LogOut className="h-4 w-4" /></button></div> : <button onClick={openAdminModal} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-white/10"><User className="h-4 w-4 text-[#14F195]" />ورود / ثبت‌نام</button>}
            </div>
          </div>}
        </div>
      </div>
    </header>
  );
};
