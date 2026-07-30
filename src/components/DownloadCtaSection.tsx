import React from 'react';
import { DownloadLinks } from '../types';
import { Download, Send, Smartphone, ShieldCheck, Globe, Play } from 'lucide-react';

interface DownloadCtaSectionProps {
  downloadLinks?: DownloadLinks;
}

export const DownloadCtaSection: React.FC<DownloadCtaSectionProps> = ({ downloadLinks }) => {
  const apkUrl = downloadLinks?.apkUrl || 'https://t.me/solmintchannel';
  const telegramUrl = downloadLinks?.telegramUrl || 'https://t.me/solmintchannel';
  const googlePlayUrl = downloadLinks?.googlePlayUrl;
  const webAppUrl = downloadLinks?.webAppUrl;
  const apkVersion = downloadLinks?.apkVersion || 'v2.4.0';
  const notice = downloadLinks?.downloadNotice || 'تست شده با Play Protect گوگل و بدون نیاز به دسترسی‌های مشکوک';

  return (
    <section id="download-section" className="py-20 border-b border-white/5 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="relative group overflow-hidden rounded-3xl bg-gradient-to-r from-[#9945FF]/20 via-[#101020] to-[#14F195]/20 border border-white/15 p-8 sm:p-12 text-center space-y-8 backdrop-blur-2xl shadow-2xl">
          
          {/* Subtle Ambient Background Gradient */}
          <div className="absolute -inset-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] opacity-10 blur-3xl group-hover:opacity-25 transition-opacity" />

          <div className="relative space-y-3 max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              نسخه رسمی اپلیکیشن {apkVersion}
            </span>
            
            <h2 
              className="text-3xl sm:text-4xl font-black text-white leading-tight" 
              style={{ fontFamily: "'Vazirmatn', sans-serif" }}
            >
              دانلود مستقیم <br />
              <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
                اپلیکیشن سولمینت برای اندروید و وب
              </span>
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">
              کیف پول غیرامانی سولانا با قابلیت ساخت توکن، میم‌کوین، NFT و بازیابی کارمزد اجاره حساب‌ها.
            </p>
          </div>

          {/* Download Buttons Grid */}
          <div className="relative flex flex-wrap items-center justify-center gap-3 pt-2">
            
            {/* Direct APK Link */}
            {apkUrl && (
              <a
                href={apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-xs flex items-center gap-2.5 shadow-xl shadow-[#9945FF]/25 hover:scale-105 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>دانلود مستقیم فایل APK ({apkVersion})</span>
              </a>
            )}

            {/* Telegram Channel Link */}
            {telegramUrl && (
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-extrabold text-xs border border-sky-500/40 flex items-center gap-2.5 hover:scale-105 transition-all cursor-pointer backdrop-blur-md"
              >
                <Send className="w-4 h-4 text-sky-400 stroke-[2.5]" />
                <span>کانال تلگرام سولمینت</span>
              </a>
            )}

            {/* Google Play Link */}
            {googlePlayUrl && (
              <a
                href={googlePlayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-xs border border-emerald-500/40 flex items-center gap-2.5 hover:scale-105 transition-all cursor-pointer backdrop-blur-md"
              >
                <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                <span>گوگل پلی (Google Play)</span>
              </a>
            )}

            {/* Web App Link */}
            {webAppUrl && (
              <a
                href={webAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs border border-white/20 flex items-center gap-2.5 hover:scale-105 transition-all cursor-pointer backdrop-blur-md"
              >
                <Globe className="w-4 h-4 text-purple-400" />
                <span>ورود به وب‌اپلیکیشن (PWA)</span>
              </a>
            )}

          </div>

          {/* Security notice */}
          {notice && (
            <div className="relative pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

        </div>

      </div>
    </section>
  );
};

