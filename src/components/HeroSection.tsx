import React from 'react';
import { DownloadLinks } from '../types';
import { ArrowLeft, ArrowRight, Download } from 'lucide-react';

interface HeroSectionProps {
  onExploreFeatures: () => void;
  downloadLinks?: DownloadLinks;
  locale?: 'fa' | 'en';
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExploreFeatures, locale = 'fa' }) => {
  const isEnglish = locale === 'en';
  return (
    <section className="relative pt-12 pb-20 overflow-hidden border-b border-white/5" aria-labelledby="hero-title" dir={isEnglish ? 'ltr' : 'rtl'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-12 max-w-4xl mx-auto space-y-8 text-center">
            <h1 id="hero-title" className="text-[42px] font-black text-white leading-[1.65] tracking-tight" style={{ fontSize: '42px', lineHeight: '1.65', minHeight: '138.6px', margin: 0 }}>
              {isEnglish ? <>Solana Non-Custodial Wallet <br className="hidden sm:block" /></> : <>کیف پول غیر متمرکز سولانا <br className="hidden sm:block" /></>}
              <span className="bg-gradient-to-r from-[#9945FF] via-indigo-400 to-[#14F195] bg-clip-text text-transparent">
                {isEnglish ? 'Token, Meme Coin & NFT Tools' : 'ساخت توکن، میم کوین و NFT'}
              </span>
            </h1>

            <p className="text-slate-300 text-[13px] sm:text-[14px] max-w-2xl mx-auto leading-[32px] font-normal">
              {isEnglish ? <><strong>Solmint</strong> is a Solana-focused non-custodial wallet and Web3 platform for Android, with locally controlled keys, SPL token creation, meme coin tools and SOL rent recovery.</> : <><strong>سولمینت (Solmint)</strong> پلتفرم و کیف پول غیرامانی سولانا برای سیستم‌عامل اندروید است. مدیریت کامل کلیدهای خصوصی محلی، ساخت توکن SPL بدون کدنویسی، راه‌اندازی میم کوین و بازیابی کارمزد اجاره حساب.</>}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
              <a
                href="https://t.me/solmintchannel"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-solana px-7 py-3.5 rounded-full text-xs flex items-center gap-2.5 cursor-pointer shadow-lg shadow-[#9945FF]/25"
              >
                <Download className="w-4 h-4 text-black stroke-[2.5]" />
                <span>{isEnglish ? 'Download the App (APK)' : 'دانلود مستقیم اپلیکیشن (APK)'}</span>
              </a>

              <button
                type="button"
                onClick={onExploreFeatures}
                className="px-6 py-3.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>{isEnglish ? 'Key Features' : 'قابلیت‌های کلیدی'}</span>
                {isEnglish ? <ArrowRight className="w-4 h-4 text-[#14F195]" /> : <ArrowLeft className="w-4 h-4 text-[#14F195]" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
