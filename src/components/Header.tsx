import React, { useState } from 'react';
import { SolanaStatus, UserAccount } from '../types';
import { Menu, X, BookOpen, User, LogOut, ShieldCheck, Smartphone, Wrench, ChevronDown, Search, Activity } from 'lucide-react';
import { getLocalizedPath } from '../utils/i18n';

export const SolanaLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-4.6-4.6-11.1l62.7-62.7z" fill="url(#sol_grad_1)"/>
    <path d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-4.6-4.6-11.1l62.7-62.7z" fill="url(#sol_grad_2)"/>
    <path d="M332.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H5.5c-5.8 0-8.7 5.8-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-5.8 4.6-11.1l-62.7-62.7z" fill="url(#sol_grad_3)"/>
    <defs>
      <linearGradient id="sol_grad_1" x1="391" y1="234" x2="3" y2="311" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient>
      <linearGradient id="sol_grad_2" x1="391" y1="0" x2="3" y2="77" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient>
      <linearGradient id="sol_grad_3" x1="3" y1="116" x2="391" y2="194" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient>
    </defs>
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
  locale?: 'fa' | 'en';
}

const navClass = (active: boolean) => `shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer text-inherit decoration-none ${active ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white'}`;
const mobileNavClass = (active: boolean, english: boolean) => `w-full ${english ? 'text-left' : 'text-right'} px-4 py-2.5 rounded-xl text-xs font-semibold ${active ? 'bg-[#9945FF]/20 text-[#14F195] border border-[#9945FF]/40' : 'text-slate-300 bg-white/5'}`;

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate, openAdminModal, currentUser, onLogout, locale = 'fa' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const english = locale === 'en';
  const homePath = getLocalizedPath('/', locale);
  const pricePath = getLocalizedPath('/solana-price', locale);
  const blogPath = english ? '/en/blog' : '/blog';
  const languageSwitchPath = getLocalizedPath(currentPath, english ? 'fa' : 'en');
  const handleNav = (path: string) => { setMobileMenuOpen(false); setToolsOpen(false); onNavigate(path); };
  const canManageShowcase = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const toolsActive = !english && currentPath.startsWith('/tools/');
  const walletAnalyzerActive = !english && currentPath === '/wallet-analyzer';

  const labels = english ? {
    home: 'Home', wallet: 'Solana Wallet', analyzer: 'Wallet Analysis', price: 'Live SOL Price', token: 'Token Creator', meme: 'Meme Coin', security: 'Security', tools: 'Tools', faq: 'FAQ', blog: 'Blog & Academy', download: 'Android App', language: 'فارسی', login: 'Login / Sign up', admin: 'Admin', show: 'App Showcase',
    tokenTools: 'Solana Token Tools', tokenScanner: 'Solana Token Scanner', token2022: 'Token-2022 Inspector', languageLabel: 'فارسی'
  } : {
    home: 'صفحه اصلی', wallet: 'کیف پول سولانا', analyzer: 'تحلیل کیف پول', price: 'قیمت لحظه‌ای سولانا', token: 'ساخت توکن', meme: 'میم کوین', security: 'امنیت', tools: 'ابزارها', faq: 'سوالات متداول', blog: 'وبلاگ و آکادمی solmint.ir', download: 'دانلود نسخه اندروید', language: 'English', login: 'ورود / ثبت‌نام', admin: 'مدیر', show: 'مدیریت نمایش اپلیکیشن', tokenTools: 'ابزارهای توکن سولانا', tokenScanner: 'بررسی توکن سولانا', token2022: 'Token-2022 Inspector', languageLabel: 'English'
  };

  return (
    <header dir={english ? 'ltr' : 'rtl'} className="relative w-full z-40 bg-[#05050a]/90 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div onClick={() => handleNav(homePath)} className="flex items-center gap-2.5 cursor-pointer group shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] via-[#14F195] to-[#00C2FF] p-0.5 shadow-lg shadow-[#9945FF]/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <div className="w-full h-full bg-[#05050a] rounded-[10px] flex items-center justify-center p-2"><SolanaLogoIcon className="w-full h-full" /></div>
          </div>
          <div className="hidden sm:flex flex-col"><span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">{english ? 'Solmint' : 'سولمینت'} <span className="text-[10px] font-mono text-[#14F195] font-bold bg-[#14F195]/10 px-2 py-0.5 rounded-full border border-[#14F195]/20">Solmint</span></span></div>
        </div>
        <nav className="hidden lg:flex items-center gap-0.5 bg-white/[0.03] p-1 rounded-full border border-white/10 whitespace-nowrap overflow-visible">
          <a href={homePath} onClick={e => { e.preventDefault(); handleNav(homePath); }} className={navClass(currentPath === homePath)}>{labels.home}</a>
          {!english ? <>
            <a href="/solana-wallet" onClick={e => { e.preventDefault(); handleNav('/solana-wallet'); }} className={navClass(currentPath === '/solana-wallet')}>{labels.wallet}</a>
            <a href="/wallet-analyzer" onClick={e => { e.preventDefault(); handleNav('/wallet-analyzer'); }} className={`${navClass(walletAnalyzerActive)} inline-flex items-center gap-1.5 ${walletAnalyzerActive ? 'bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/25' : ''}`}><Activity className="h-3.5 w-3.5" /><span>{labels.analyzer}</span></a>
          </> : null}
          <a href={pricePath} onClick={e => { e.preventDefault(); handleNav(pricePath); }} className={`${navClass(currentPath === pricePath)} ${currentPath === pricePath ? 'bg-[#14F195]/15 text-[#14F195] border border-[#14F195]/30' : ''}`}>{labels.price}</a>
          {!english ? <>
            <a href="/solana-token" onClick={e => { e.preventDefault(); handleNav('/solana-token'); }} className={navClass(currentPath === '/solana-token')}>{labels.token}</a>
            <a href="/solana-meme-coin" onClick={e => { e.preventDefault(); handleNav('/solana-meme-coin'); }} className={navClass(currentPath === '/solana-meme-coin')}>{labels.meme}</a>
            <a href="/security" onClick={e => { e.preventDefault(); handleNav('/security'); }} className={navClass(currentPath === '/security')}>{labels.security}</a>
            <div className="relative flex items-center" onMouseEnter={() => setToolsOpen(true)} onMouseLeave={() => setToolsOpen(false)}>
              <a href="/tools/solana-token-tools" onClick={e => { e.preventDefault(); handleNav('/tools/solana-token-tools'); }} className={`${navClass(toolsActive)} inline-flex items-center gap-1.5 ${toolsActive ? 'bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/25' : ''}`} aria-label={labels.tools}><Wrench className="w-3.5 h-3.5" /><span>{labels.tools}</span></a>
              <button type="button" aria-haspopup="menu" aria-expanded={toolsOpen} aria-label={labels.tools} onClick={() => setToolsOpen(v => !v)} className={`${navClass(toolsActive)} !px-1 inline-flex items-center ${toolsActive ? 'bg-[#14F195]/10 text-[#14F195]' : ''}`}><ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} /></button>
              {toolsOpen && <div role="menu" className="absolute right-0 top-full pt-2 w-72"><div className="rounded-2xl border border-white/10 bg-[#0a0a12]/98 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <button type="button" onClick={() => handleNav('/tools/solana-token-tools')} className="w-full rounded-xl px-3 py-3 text-right hover:bg-white/5 transition-colors" role="menuitem"><span className="flex items-center gap-2 text-sm font-black text-white"><Wrench className="w-4 h-4 text-[#14F195]" />{labels.tokenTools}</span></button>
                <button type="button" onClick={() => handleNav('/tools/solana-token-scanner')} className="w-full rounded-xl px-3 py-3 text-right hover:bg-white/5 transition-colors" role="menuitem"><span className="flex items-center gap-2 text-sm font-bold text-slate-200"><Search className="w-4 h-4 text-cyan-300" />{labels.tokenScanner}</span></button>
                <button type="button" onClick={() => handleNav('/tools/token-2022-inspector')} className="w-full rounded-xl px-3 py-3 text-right hover:bg-white/5 transition-colors" role="menuitem"><span className="flex items-center gap-2 text-sm font-bold text-slate-200"><ShieldCheck className="w-4 h-4 text-[#9945FF]" />{labels.token2022}</span></button>
              </div></div>}
            </div>
          </> : null}
          <a href={english ? blogPath : '/faq'} onClick={e => { e.preventDefault(); handleNav(english ? blogPath : '/faq'); }} className={navClass(currentPath === (english ? blogPath : '/faq'))}>{english ? labels.blog : labels.faq}</a>
          {!english && <a href="/blog" onClick={e => { e.preventDefault(); handleNav('/blog'); }} className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-inherit decoration-none ${currentPath === '/blog' || currentPath.startsWith('/article/') ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black shadow-md' : 'text-slate-300 hover:text-white'}`}><BookOpen className="w-3.5 h-3.5 shrink-0" /><span>{labels.blog}</span></a>}
          <a href={languageSwitchPath} className="shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white">{labels.languageLabel}</a>
        </nav>
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200">
              {canManageShowcase && <button onClick={() => handleNav('/showcase-admin')} title={labels.show} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#14F195]/10 text-[#14F195] hover:bg-[#14F195]/20 border border-[#14F195]/20 font-bold cursor-pointer"><Smartphone className="w-3.5 h-3.5" /><span>{labels.show}</span></button>}
              <button onClick={openAdminModal} className="flex items-center gap-1.5 hover:text-[#14F195] transition-colors cursor-pointer font-bold">{canManageShowcase ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <User className="w-4 h-4 text-sky-400" />}<span>{currentUser.fullName}</span>{canManageShowcase && <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-mono">{labels.admin}</span>}</button>
              <span className="text-slate-600">|</span><button onClick={onLogout} title={english ? 'Log out' : 'خروج از حساب'} aria-label={english ? 'Log out' : 'خروج از حساب'} className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer p-0.5"><LogOut className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={openAdminModal} title={labels.login} aria-label={labels.login} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors cursor-pointer text-xs font-bold"><User className="w-4 h-4 text-[#14F195]" /><span>{labels.login}</span></button>
          )}
        </div>
        <button onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? (english ? 'Close menu' : 'بستن منوی اصلی') : (english ? 'Open menu' : 'باز کردن منوی اصلی')} className="lg:hidden p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white border border-white/10">{mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      </div>
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#08080f]/98 border-b border-white/10 px-4 py-5 space-y-2 backdrop-blur-2xl max-h-[calc(100vh-4rem)] overflow-y-auto">
          <button onClick={() => handleNav(homePath)} className={mobileNavClass(currentPath === homePath, english)}>{labels.home}</button>
          {!english && <>
            <button onClick={() => handleNav('/solana-wallet')} className={mobileNavClass(currentPath === '/solana-wallet', english)}>{labels.wallet}</button>
            <button onClick={() => handleNav('/wallet-analyzer')} className={mobileNavClass(walletAnalyzerActive, english)}>{labels.analyzer}</button>
          </>}
          <button onClick={() => handleNav(pricePath)} className={mobileNavClass(currentPath === pricePath, english)}>{labels.price}</button>
          {!english && <>
            <button onClick={() => handleNav('/solana-token')} className={mobileNavClass(currentPath === '/solana-token', english)}>{labels.token}</button>
            <button onClick={() => handleNav('/solana-meme-coin')} className={mobileNavClass(currentPath === '/solana-meme-coin', english)}>{labels.meme}</button>
            <button onClick={() => handleNav('/security')} className={mobileNavClass(currentPath === '/security', english)}>{labels.security}</button>
            <div className={`rounded-2xl border p-2 ${toolsActive ? 'border-[#14F195]/30 bg-[#14F195]/5' : 'border-white/10 bg-white/[0.02]'}`}><div className="px-3 py-2 flex items-center gap-2"><Wrench className="w-4 h-4 text-[#14F195]" /><span className="text-xs font-black text-white">{labels.tools}</span></div><button onClick={() => handleNav('/tools/solana-token-tools')} className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5">{labels.tokenTools}</button><button onClick={() => handleNav('/tools/solana-token-scanner')} className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5">{labels.tokenScanner}</button><button onClick={() => handleNav('/tools/token-2022-inspector')} className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5">{labels.token2022}</button></div>
            <button onClick={() => handleNav('/download')} className={mobileNavClass(currentPath === '/download', english)}>{labels.download}</button>
            <button onClick={() => handleNav('/faq')} className={mobileNavClass(currentPath === '/faq', english)}>{labels.faq}</button>
          </>}
          <button onClick={() => handleNav(blogPath)} className={mobileNavClass(currentPath === blogPath, english)}><BookOpen className="w-4 h-4 inline mr-1" /><span>{labels.blog}</span></button>
          <a href={languageSwitchPath} className={mobileNavClass(false, english)}>{labels.languageLabel}</a>
          {currentUser ? <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900 border border-slate-700/80 px-4 py-3 mt-2"><button onClick={openAdminModal} className="flex items-center gap-2 text-xs font-bold text-slate-200">{canManageShowcase ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <User className="w-4 h-4 text-sky-400" />}<span>{currentUser.fullName}</span></button><button onClick={onLogout} title={english ? 'Log out' : 'خروج از حساب'} aria-label={english ? 'Log out' : 'خروج از حساب'} className="text-slate-400 hover:text-rose-400 p-1"><LogOut className="w-4 h-4" /></button></div> : <button onClick={openAdminModal} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold"><User className="w-4 h-4 text-[#14F195]" />{labels.login}</button>}
        </div>
      )}
    </header>
  );
};
