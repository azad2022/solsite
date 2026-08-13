import React from 'react';
import { Zap, Send, ShieldCheck, Lock, Smartphone, Github } from 'lucide-react';

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
    <footer className="bg-[#05050a] border-t border-white/[0.08] pt-16 pb-10 text-slate-300 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
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
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="flex items-center justify-center text-slate-300 hover:text-white transition-colors mt-1"
          >
            <Github className="w-[54px] h-[54px]" aria-hidden="true" />
          </a>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-300 text-xs">
          <span className="w-full text-center sm:text-right leading-6 break-words [overflow-wrap:anywhere]">تمامی حقوق برای برند و پلتفرم سولمینت (solmint.ir) محفوظ است</span>
          <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-4 min-w-0">
            <span className="flex items-center justify-center gap-1 font-mono text-slate-200 text-center leading-6 break-words [overflow-wrap:anywhere]">Solmint Wallet — Official Android Web3 Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
