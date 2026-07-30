import React, { useState } from 'react';
import { SolanaStatus, UserAccount } from '../types';
import { 
  Send, 
  Lock, 
  Menu, 
  X, 
  BookOpen,
  User,
  LogOut,
  ShieldCheck
} from 'lucide-react';

// Official Solana SVG Logo Icon
export const SolanaLogoIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sol_grad_1)"/>
    <path d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sol_grad_2)"/>
    <path d="M332.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H5.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sol_grad_3)"/>
    <defs>
      <linearGradient id="sol_grad_1" x1="391" y1="234" x2="3" y2="311" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <linearGradient id="sol_grad_2" x1="391" y1="0" x2="3" y2="77" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <linearGradient id="sol_grad_3" x1="3" y1="116" x2="391" y2="194" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
    </defs>
  </svg>
);

interface HeaderProps {
  solanaStatus: SolanaStatus;
  refreshStatus: () => void;
  activeTab: 'home' | 'features' | 'blog' | 'admin';
  setActiveTab: (tab: 'home' | 'features' | 'blog' | 'admin') => void;
  openAdminModal: () => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  openAdminModal,
  currentUser,
  onLogout
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setActiveTab('home');
    setMobileMenuOpen(false);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <header className="relative w-full z-40 bg-[#05050a]/90 backdrop-blur-xl border-b border-white/[0.08]">
      {/* Main Header Nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo with Official Solana Icon */}
        <div 
          onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] via-[#14F195] to-[#00C2FF] p-0.5 shadow-lg shadow-[#9945FF]/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <div className="w-full h-full bg-[#05050a] rounded-[10px] flex items-center justify-center p-2">
              <SolanaLogoIcon className="w-full h-full" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
              سولمینت <span className="text-[10px] font-mono text-[#14F195] font-bold bg-[#14F195]/10 px-2 py-0.5 rounded-full border border-[#14F195]/20" style={{ fontFamily: "'Courier New', Courier, monospace" }}>Solmint</span>
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/[0.03] p-1 rounded-full border border-white/10">
          <button
            onClick={() => scrollToSection('security-section')}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            معماری و امنیت
          </button>

          <button
            onClick={() => scrollToSection('faq-section')}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            سوالات متداول
          </button>

          <button
            onClick={() => setActiveTab('blog')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'blog'
                ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>وبلاگ آموزشی</span>
          </button>
        </nav>

        {/* Header Actions */}
        <div className="hidden sm:flex items-center gap-2.5">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200">
              <button 
                onClick={openAdminModal}
                className="flex items-center gap-1.5 hover:text-[#14F195] transition-colors cursor-pointer font-bold"
              >
                {currentUser.role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <User className="w-4 h-4 text-sky-400" />
                )}
                <span>{currentUser.fullName}</span>
                {currentUser.role === 'admin' && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-mono">مدیر</span>
                )}
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={onLogout}
                title="خروج از حساب"
                className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer p-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={openAdminModal}
              title="ورود / ثبت‌نام"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors cursor-pointer text-xs font-bold"
            >
              <User className="w-4 h-4 text-[#14F195]" />
              <span>ورود / ثبت‌نام</span>
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white border border-white/10"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#08080f]/95 border-b border-white/10 px-4 py-5 space-y-3 backdrop-blur-2xl">
          <button
            onClick={() => { setActiveTab('home'); setMobileMenuOpen(false); }}
            className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold ${
              activeTab === 'home' ? 'bg-[#9945FF]/20 text-[#14F195] border border-[#9945FF]/40' : 'text-slate-300 bg-white/5'
            }`}
          >
            معرفی اپلیکیشن سولمینت
          </button>

          <button
            onClick={() => scrollToSection('app-features')}
            className="w-full text-right px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5"
          >
            قابلیت‌ها و ابزارهای داخل اپ
          </button>

          <button
            onClick={() => scrollToSection('security-section')}
            className="w-full text-right px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5"
          >
            معماری امنیتی غیرامانی
          </button>

          <button
            onClick={() => scrollToSection('roadmap-section')}
            className="w-full text-right px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5"
          >
            نقشه راه توسعه
          </button>

          <button
            onClick={() => scrollToSection('faq-section')}
            className="w-full text-right px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5"
          >
            سوالات متداول
          </button>

          <button
            onClick={() => { setActiveTab('blog'); setMobileMenuOpen(false); }}
            className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
              activeTab === 'blog' ? 'bg-[#9945FF]/20 text-[#14F195] border border-[#9945FF]/40' : 'text-slate-300 bg-white/5'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#14F195]" />
            <span>وبلاگ و آکادمی solmint.ir</span>
          </button>

          <button
            onClick={() => { openAdminModal(); setMobileMenuOpen(false); }}
            className="w-full text-right px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-2"
          >
            <User className="w-4 h-4 text-emerald-400" />
            <span>{currentUser ? `حساب کاربری (${currentUser.fullName})` : 'ورود / ثبت‌نام'}</span>
          </button>

          <a
            href="https://t.me/solmintchannel"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black flex items-center justify-between shadow-lg"
          >
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              <span>دانلود نسخه جدید اپلیکیشن</span>
            </span>
            <span className="text-[10px] dir-ltr font-mono font-bold">@solmintchannel</span>
          </a>
        </div>
      )}
    </header>
  );
};

