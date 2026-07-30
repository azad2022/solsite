import React from 'react';
import { Zap, Send, ShieldCheck, Lock, Smartphone } from 'lucide-react';

interface FooterProps {
  setActiveTab: (tab: 'home' | 'features' | 'blog' | 'admin') => void;
  openAdminModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab, openAdminModal }) => {
  const scrollToSection = (id: string) => {
    setActiveTab('home');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <footer className="bg-[#05050a] border-t border-white/[0.08] pt-16 pb-10 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Quick Links */}
          <div className="space-y-3 text-center md:text-right">
            <span className="font-bold text-white text-sm block">دسترسی سریع</span>
            <ul className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 text-slate-300">
              <li>
                <button onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#14F195] transition-colors cursor-pointer">
                  معرفی اپلیکیشن سولمینت
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('app-features')} className="hover:text-[#14F195] transition-colors cursor-pointer">
                  قابلیت‌ها و امکانات اپلیکیشن
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('security-section')} className="hover:text-[#14F195] transition-colors cursor-pointer">
                  معماری امنیتی غیرامانی
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('blog')} className="hover:text-[#14F195] transition-colors cursor-pointer">
                  وبلاگ و آکادمی (solmint.ir)
                </button>
              </li>
              <li>
                <button onClick={openAdminModal} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>ورود / ثبت‌نام</span>
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
          <span>تمامی حقوق برای کیف پول سولمینت محفوظ است</span>
          <span className="flex items-center gap-1 font-mono text-slate-400">
            Solmint Wallet — Official Web
          </span>
        </div>

      </div>
    </footer>
  );
};
