import React from 'react';
import { Zap, Send, ShieldCheck, Lock, Smartphone } from 'lucide-react';

interface FooterProps {
  onNavigate?: (path: string) => void;
  openAdminModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, openAdminModal }) => {
  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#05050a] border-t border-white/[0.08] pt-16 pb-10 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Quick Links */}
          <div className="space-y-3 text-center md:text-right">
            <span className="font-bold text-white text-sm block">دسترسی سریع و صفحات رسمی</span>
            <ul className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 text-slate-300">
              <li>
                <button onClick={() => handleNav('/')} className="hover:text-[#14F195] transition-colors cursor-pointer">
                  صفحه اصلی
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/solana-wallet')} className="hover:text-[#14F195] transition-colors cursor-pointer">
                  کیف پول سولانا
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/solana-token')} className="hover:text-cyan-300 transition-colors cursor-pointer">
                  ساخت توکن SPL
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/solana-meme-coin')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  ساخت میم کوین
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/security')} className="hover:text-emerald-400 transition-colors cursor-pointer">
                  معماری امنیتی غیرامانی
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/download')} className="hover:text-[#14F195] transition-colors cursor-pointer">
                  دانلود اپلیکیشن اندروید
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/faq')} className="hover:text-sky-300 transition-colors cursor-pointer">
                  سوالات متداول
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/blog')} className="hover:text-[#14F195] transition-colors cursor-pointer">
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
          <span>تمامی حقوق برای برند و پلتفرم سولمینت (solmint.ir) محفوظ است</span>
          <span className="flex items-center gap-1 font-mono text-slate-400">
            Solmint Wallet — Official Android Web3 Platform
          </span>
        </div>

      </div>
    </footer>
  );
};
