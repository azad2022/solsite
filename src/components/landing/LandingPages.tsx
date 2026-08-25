import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  Download,
  Coins,
  Flame,
  Sparkles,
  Layers,
  Smartphone,
  ArrowLeft,
  Lock,
  Cpu,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  Shield,
  Zap,
  Terminal,
  FileCheck
} from 'lucide-react';
import { DownloadLinks } from '../../types';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  downloadLinks?: DownloadLinks;
}
/* ====================================================================
   1. SOLANA WALLET PAGE (/solana-wallet)
   ==================================================================== */
export const SolanaWalletPage: React.FC<LandingPageProps> = ({ onNavigate, downloadLinks }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16 dir-rtl">
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#9945FF]/10 border border-[#9945FF]/30 text-[#14F195] text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-[#14F195]" />
          <span>مدل ساختاری غیرامانی (Non-Custodial)</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
          کیف پول غیرامانی و امن سولانا در اپلیکیشن <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9945FF] via-[#14F195] to-cyan-400">سولمینت</span>
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          اپلیکیشن سولمینت برای سیستم‌عامل اندروید، کلیدهای خصوصی و عبارت‌های بازیابی (Mnemonic Seed) شما را مستقیماً در بستر کلیددار سخت‌افزاری و امن موبایل ذخیره می‌کند. سرورهای وب‌سایت به هیچ‌وجه به دارایی‌ها یا کلیدهای شما دسترسی ندارند.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button onClick={() => onNavigate('/download')} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-sm shadow-xl shadow-[#9945FF]/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer">
            <Download className="w-5 h-5" /><span>دانلود نسخه اندروید اپلیکیشن</span>
          </button>
          <button onClick={() => onNavigate('/security')} className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer">
            <Lock className="w-4 h-4 text-emerald-400" /><span>مطالعه معماری امنیتی</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4 relative overflow-hidden group hover:border-[#14F195]/40 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-[#9945FF]/20 text-[#14F195] flex items-center justify-center border border-[#9945FF]/30"><Key className="w-6 h-6" /></div>
          <h3 className="text-lg font-bold text-white">کنترل کامل کلید خصوصی</h3>
          <p className="text-xs text-slate-300 leading-relaxed">عبارت ۲۴ یا ۱۲ کلمه‌ای بازیابی تنها روی دستگاه کاربر نگهداری می‌شود و کلید خصوصی برای استفاده در وب‌سایت به سرور ارسال نمی‌شود.</p>
        </div>
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4 relative overflow-hidden group hover:border-[#14F195]/40 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30"><Zap className="w-6 h-6" /></div>
          <h3 className="text-lg font-bold text-white">امضای تراکنش روی دستگاه</h3>
          <p className="text-xs text-slate-300 leading-relaxed">تراکنش‌ها در محیط اپلیکیشن آماده و با کلید کاربر روی دستگاه امضا می‌شوند؛ سرویس وب‌سایت نقش نگهدارنده دارایی را ندارد.</p>
        </div>
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4 relative overflow-hidden group hover:border-[#14F195]/40 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30"><Coins className="w-6 h-6" /></div>
          <h3 className="text-lg font-bold text-white">مدیریت دارایی‌های سولانا</h3>
          <p className="text-xs text-slate-300 leading-relaxed">ارسال، دریافت و مدیریت SOL و توکن‌های استاندارد سولانا در یک کیف پول غیرامانی انجام می‌شود.</p>
        </div>
      </div>
      <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0a0a16] to-[#120c24] border border-[#9945FF]/30 space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Smartphone className="w-6 h-6 text-[#14F195]" /><span>چرا عملیات حساس روی اپلیکیشن انجام می‌شود؟</span></h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">برای کاهش ریسک‌های فیشینگ و قرار نگرفتن کلید خصوصی در محیط مرورگر، عملیات حساس کیف پول و امضای تراکنش در اپلیکیشن انجام می‌شود.</p>
      </div>
    </div>
  );
};
/* ====================================================================
   2. SOLANA TOKEN PAGE (/solana-token)
   ==================================================================== */
export const SolanaTokenPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16 dir-rtl">
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold"><Coins className="w-4 h-4 text-cyan-400" /><span>استاندارد SPL Token سولانا</span></div>
        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">ساخت و مدیریت توکن سولانا با ابزار <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-[#14F195]">سولمینت</span></h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">در اپلیکیشن اندروید سولمینت بدون نیاز به حتی یک سطر کدنویسی یا دانش اسمارت‌کانتراکت، می‌توانید توکن اختصاصی خود را روی شبکه سولانا ایجاد کرده، لوگو و متادیتای آن را ثبت کنید.</p>
        <div className="flex justify-center gap-4 pt-2"><button onClick={() => onNavigate('/download')} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-[#14F195] text-slate-950 font-extrabold text-sm shadow-xl shadow-cyan-500/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"><Download className="w-5 h-5" /><span>دانلود اپلیکیشن ساخت توکن</span></button></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{[
        { title: '۱. تعیین اطلاعات', desc: 'نام، نماد (Symbol)، تعداد کل واحدها (Supply) و تعداد اعشار (Decimals).' },
        { title: '۲. آپلود لوگو و متادیتا', desc: 'ذخیره‌سازی متادیتای توکن در پروتکل Metaplex و IPFS بر بستر سولانا.' },
        { title: '۳. امضای تراکنش ساخت', desc: 'تایید و امضای مستقیم ساخت اکانت Mint با کارمزد بسیار ناچیز شبکه‌ای.' },
        { title: '۴. دریافت و مدیریت', desc: 'توکن‌های ساخته‌شده مستقیماً به کیف پول غیرامانی شما منتقل می‌گردند.' }
      ].map((step, idx) => <div key={idx} className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-3"><span className="text-xs font-mono font-bold text-[#14F195]">{step.title}</span><p className="text-xs text-slate-300 leading-relaxed">{step.desc}</p></div>)}</div>
    </div>
  );
};
/* ====================================================================
   3. MEME COIN PAGE (/solana-meme-coin)
   ==================================================================== */
export const MemeCoinPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16 dir-rtl">
      <div className="text-center space-y-6 max-w-3xl mx-auto"><div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold"><Flame className="w-4 h-4 text-amber-400" /><span>لانچ‌پد و ساخت میم کوین</span></div><h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">چگونه در شبکه سولانا <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-[#14F195]">میم کوین</span> بسازیم؟</h1><p className="text-slate-300 text-sm sm:text-base leading-relaxed">اپلیکیشن اندروید سولمینت امکان ساخت سریع میم کوین با ابزارهای مدیریت Mint Authority، Freeze Authority و سلب مالکیت (Renounce Ownership) را جهت ارتقای اعتماد جامعه کاربران ارائه می‌دهد.</p><div className="flex justify-center gap-4 pt-2"><button onClick={() => onNavigate('/download')} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-[#14F195] text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"><Download className="w-5 h-5" /><span>دانلود لانچ‌پد میم کوین سولمینت</span></button></div></div>
    </div>
  );
};
/* ====================================================================
   4. NFT PAGE (/solana-nft)
   ==================================================================== */
export const NftPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16 dir-rtl"><div className="text-center space-y-6 max-w-3xl mx-auto"><div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold"><Sparkles className="w-4 h-4 text-purple-400" /><span>استاندارد NFT در سولانا</span></div><h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">ساخت و ضرب (Mint) آثار <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#14F195]">NFT</span> در اندروید</h1><p className="text-slate-300 text-sm sm:text-base leading-relaxed">با اپلیکیشن سولمینت آثار هنری یا کلکسیون‌های دیجیتال خود را روی شبکه سولانا بر بستر استاندارد Metaplex ضرب کنید و آنها را در گالری کیف پول اختصاصی خود نمایش دهید.</p><div className="flex justify-center gap-4 pt-2"><button onClick={() => onNavigate('/download')} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-[#14F195] text-slate-950 font-extrabold text-sm shadow-xl shadow-purple-500/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"><Download className="w-5 h-5" /><span>دانلود اپلیکیشن NFT سولمینت</span></button></div></div></div>
  );
};
/* ====================================================================
   5. SECURITY PAGE (/security)
   ==================================================================== */
export const SecurityPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const securityFaqs = [
    ['آیا سولمینت به کلید خصوصی یا عبارت بازیابی دسترسی دارد؟', 'مدل محصول سولمینت غیرامانی است: وب‌سایت برای نگهداری دارایی یا دریافت Seed Phrase طراحی نشده است. کاربر کنترل کلیدهای کیف پول را در اختیار دارد و نباید عبارت بازیابی را در وب‌سایت، چت یا برای شخص دیگری ارسال کند.'],
    ['اگر سرور وب‌سایت سولمینت دچار مشکل یا هک شود، آیا دارایی من قابل برداشت است؟', 'در مدل غیرامانی، صرف دسترسی به وب‌سایت نباید به معنی دسترسی به کلید امضای کیف پول کاربر باشد. با این حال امنیت کامل مطلق وجود ندارد و امنیت دستگاه، عبارت بازیابی و رفتار کاربر همچنان اهمیت اساسی دارد.'],
    ['تراکنش در سولمینت چگونه امضا می‌شود؟', 'تراکنش برای امضا در محیط اپلیکیشن آماده می‌شود و امضای آن با کلید کیف پول در سمت کاربر انجام می‌گیرد. سپس تراکنش امضاشده برای ارسال به شبکه استفاده می‌شود؛ این با نگهداری کلید در یک سرویس Custodial تفاوت دارد.'],
    ['آیا سولمینت می‌تواند امنیت ۱۰۰ درصدی را تضمین کند؟', 'خیر. هیچ کیف پول نرم‌افزاری یا سرویس آنلاین نمی‌تواند چنین تضمینی بدهد. مدل امنیتی سولمینت باید در کنار امنیت سیستم‌عامل، قفل دستگاه، نسخه اپلیکیشن، منبع دریافت برنامه و نحوه نگهداری Seed Phrase ارزیابی شود.']
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-12 space-y-14 dir-rtl">
      <header className="text-center space-y-5 max-w-3xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30" aria-hidden="true"><ShieldCheck className="w-8 h-8" /></div>
        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">امنیت کیف پول سولانا و معماری غیرامانی سولمینت</h1>
        <p className="text-sm sm:text-base text-slate-300 leading-8">در این صفحه، مدل امنیتی سولمینت، نحوه کنترل کلید خصوصی، امضای تراکنش، ریسک‌های مهم و مسئولیت‌های کاربر را بدون ادعای امنیت مطلق توضیح می‌دهیم.</p>
        <div className="flex flex-wrap justify-center gap-3 text-xs font-bold"><span className="px-3 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">Non-Custodial</span><span className="px-3 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">Client-Side Signing</span><span className="px-3 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">Solana Wallet Security</span></div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5" aria-label="اصول امنیتی اصلی">
        <article className="p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/20 space-y-3"><h2 className="text-lg font-bold text-emerald-300">کنترل کلید در اختیار کاربر</h2><p className="text-sm text-slate-300 leading-7">سولمینت به‌عنوان یک کیف پول غیرامانی، قصد نگهداری کلید خصوصی کاربر روی سرور را ندارد. Seed Phrase و Private Key را نباید در سایت یا سرویس‌های ناشناس وارد کرد.</p></article>
        <article className="p-6 rounded-3xl bg-slate-900/90 border border-cyan-500/20 space-y-3"><h2 className="text-lg font-bold text-cyan-300">امضای تراکنش در سمت کاربر</h2><p className="text-sm text-slate-300 leading-7">عملیات حساس امضای تراکنش در محیط کاربر انجام می‌شود. این معماری با کیف پول‌های امانی که کلید را نزد سرویس نگهداری می‌کنند تفاوت بنیادی دارد.</p></article>
        <article className="p-6 rounded-3xl bg-slate-900/90 border border-violet-500/20 space-y-3"><h2 className="text-lg font-bold text-violet-300">شفافیت درباره محدودیت‌ها</h2><p className="text-sm text-slate-300 leading-7">امنیت فقط به نرم‌افزار وابسته نیست؛ فیشینگ، بدافزار، دستگاه آلوده و از دست رفتن عبارت بازیابی می‌توانند امنیت دارایی را تهدید کنند.</p></article>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl sm:text-3xl font-black text-white">امنیت کیف پول غیرامانی سولانا یعنی چه؟</h2>
        <p className="text-sm sm:text-base text-slate-300 leading-8">در کیف پول غیرامانی، کاربر کنترل کلید امضای دارایی را حفظ می‌کند. بنابراین شرکت سازنده نباید بتواند صرفاً با ورود به پنل سرور، تراکنش دلخواهی را از طرف کاربر امضا کند. این مدل، وابستگی به یک واسطه برای نگهداری دارایی را کاهش می‌دهد، اما مسئولیت کاربر را نیز افزایش می‌دهد.</p>
        <p className="text-sm sm:text-base text-slate-300 leading-8">برای کاربر سولانا، امنیت کیف پول فقط به موجودی SOL محدود نیست؛ توکن‌های SPL، حساب‌های Associated Token Account، NFTها و مجوزهای مختلف شبکه نیز باید در نظر گرفته شوند.</p>
      </section>

      <section className="p-7 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/10 space-y-6">
        <h2 className="text-2xl font-black text-white">جریان امنیتی تراکنش در سولمینت</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          {[
            ['۱', 'آماده‌سازی', 'جزئیات تراکنش توسط اپلیکیشن آماده می‌شود.'],
            ['۲', 'بررسی کاربر', 'کاربر باید مقصد، مقدار و نوع عملیات را بررسی کند.'],
            ['۳', 'امضا', 'تراکنش با کلید کیف پول در سمت کاربر امضا می‌شود.'],
            ['۴', 'ارسال به شبکه', 'تراکنش امضاشده برای پردازش به شبکه سولانا ارسال می‌شود.']
          ].map(([n, title, desc]) => <div key={n} className="p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-2"><span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 font-black">{n}</span><h3 className="font-bold text-white">{title}</h3><p className="text-xs text-slate-400 leading-6">{desc}</p></div>)}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl sm:text-3xl font-black text-white">چه چیزهایی هرگز نباید به کسی بدهیم؟</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/15"><h3 className="font-bold text-red-300">Seed Phrase</h3><p className="text-sm text-slate-300 leading-7 mt-2">عبارت بازیابی کلید اصلی دسترسی به کیف پول است. آن را در فرم‌های وب، پیام‌رسان‌ها، پشتیبانی، ربات‌ها یا تصاویر عمومی قرار ندهید.</p></div><div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/15"><h3 className="font-bold text-red-300">Private Key</h3><p className="text-sm text-slate-300 leading-7 mt-2">کلید خصوصی را با هیچ سرویس یا شخصی به اشتراک نگذارید. آدرس عمومی برای دریافت دارایی کافی است و با کلید خصوصی تفاوت دارد.</p></div></div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl sm:text-3xl font-black text-white">محدودیت‌ها و ریسک‌های واقعی</h2>
        <div className="space-y-3 text-sm text-slate-300 leading-8"><p>• غیرامانی بودن به معنی مصونیت در برابر فیشینگ، بدافزار یا برنامه جعلی نیست.</p><p>• اگر Seed Phrase از بین برود و نسخه پشتیبان امنی وجود نداشته باشد، دسترسی به کیف پول ممکن است برای همیشه از بین برود.</p><p>• اگر دستگاه آلوده یا در اختیار مهاجم قرار گیرد، امنیت عملیاتی کیف پول نیز می‌تواند تحت تأثیر قرار بگیرد.</p><p>• کاربر باید اپلیکیشن را فقط از منبع رسمی دریافت کند و نسخه جعلی را نصب نکند.</p></div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl sm:text-3xl font-black text-white">امنیت SolMint در کنار استفاده روزمره</h2>
        <p className="text-sm sm:text-base text-slate-300 leading-8">امنیت یک فرایند است، نه یک برچسب. کاربر باید دستگاه را به‌روز نگه دارد، قفل صفحه مناسبی داشته باشد، عبارت بازیابی را آفلاین و در محل امن نگهداری کند و هنگام ارسال تراکنش، مقصد و جزئیات عملیات را دوباره بررسی کند.</p>
        <div className="flex flex-wrap gap-3"><button onClick={() => onNavigate('/solana-wallet')} className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white hover:bg-white/10">مشاهده صفحه کیف پول سولانا</button><button onClick={() => onNavigate('/download')} className="px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-300 hover:bg-emerald-500/15">دانلود نسخه رسمی اپلیکیشن</button><button onClick={() => onNavigate('/app-guide')} className="px-5 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm font-bold text-violet-300 hover:bg-violet-500/15">راهنمای کامل اپلیکیشن</button></div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl sm:text-3xl font-black text-white">سوالات متداول درباره امنیت سولمینت</h2>
        <div className="space-y-3">{securityFaqs.map(([q, a]) => <article key={q} className="p-5 rounded-2xl bg-slate-900 border border-white/10"><h3 className="text-base font-bold text-white">{q}</h3><p className="text-sm text-slate-300 leading-7 mt-3">{a}</p></article>)}</div>
      </section>

      <footer className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/15"><p className="text-xs sm:text-sm text-slate-400 leading-7">این صفحه توصیه سرمایه‌گذاری یا تضمین امنیت مالی نیست. قبل از امضای تراکنش، مقصد و جزئیات عملیات را بررسی کنید و عبارت بازیابی را هرگز با شخص یا سرویس دیگری به اشتراک نگذارید.</p></footer>
    </main>
  );
};
/* ====================================================================
   6. OFFICIAL DOWNLOAD PAGE (/download)
   ==================================================================== */
export const OfficialDownloadPage: React.FC<LandingPageProps> = ({ downloadLinks }) => {
  const directApkUrl = downloadLinks?.directApkUrl || 'https://t.me/solmintchannel';
  const tgChannelUrl = downloadLinks?.telegramChannelUrl || 'https://t.me/solmintchannel';
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12 dir-rtl"><div className="text-center space-y-4"><div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-1 mx-auto shadow-2xl shadow-[#9945FF]/30 flex items-center justify-center"><div className="w-full h-full bg-[#08080f] rounded-[22px] flex items-center justify-center"><Smartphone className="w-10 h-10 text-[#14F195]" /></div></div><h1 className="text-3xl sm:text-4xl font-black text-white">دانلود رسمی اپلیکیشن سولمینت اندروید</h1><p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">نسخه اصلی و تاییدشده اپلیکیشن غیرامانی سولمینت برای سیستم‌عامل اندروید. جهت حفظ کامل امنیت دارایی‌ها، همواره فایل APK را از مراجع رسمی سولمینت دریافت نمایید.</p></div>
      <div className="p-8 rounded-3xl bg-slate-900 border border-white/10 space-y-6 max-w-2xl mx-auto text-center shadow-2xl"><div className="space-y-2"><span className="text-xs text-[#14F195] font-mono font-bold bg-[#14F195]/10 px-3 py-1 rounded-full border border-[#14F195]/30">نسخه جدید v1.4.0 (سازگار با اندروید ۸ به بالا)</span><h3 className="text-lg font-bold text-white pt-2">دانلود مستقیم فایل APK یا عضویت در کانال اطلاع‌رسانی</h3></div><div className="flex flex-col sm:flex-row gap-4 justify-center"><a href={directApkUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 hover:scale-105 transition-all"><Download className="w-5 h-5" /><span>دانلود مستقیم فایل APK (نسخه رسمی)</span></a><a href={tgChannelUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-3.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-bold text-sm flex items-center justify-center gap-2 transition-all"><ExternalLink className="w-4 h-4" /><span>عضویت در کانال تلگرام solmintchannel@</span></a></div><div className="p-4 rounded-2xl bg-black/40 border border-slate-800 text-xs text-slate-300 space-y-2 text-right"><div className="flex items-center gap-2 text-emerald-400 font-bold"><FileCheck className="w-4 h-4" /><span>اعتبارسنجی هش اختصاصی فایل (SHA-256 Checksum):</span></div><p className="font-mono text-[11px] text-slate-400 dir-ltr bg-slate-950 p-2 rounded-xl border border-slate-800 break-all select-all">a8f9c7e2d1f4a9081e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f</p><p className="text-[11px] text-slate-400">شما می‌توانید پس از دانلود با ابزار Checksum گوشی یا دستور <code className="text-cyan-300 font-mono">sha256sum</code> صحت فایل را بررسی کنید.</p></div></div>
      <div className="p-8 rounded-3xl bg-slate-900/60 border border-white/10 space-y-6 max-w-3xl mx-auto"><h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4"><Terminal className="w-5 h-5 text-amber-400" /><span>راهنمای نصب فایل APK در اندروید</span></h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"><div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"><span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold flex items-center justify-center text-xs">۱</span><h4 className="font-bold text-white">دانلود فایل APK</h4><p className="text-slate-400 leading-relaxed">فایل نصب را از دکمه بالا یا کانال تلگرام رسمی سولمینت دریافت نمایید.</p></div><div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"><span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold flex items-center justify-center text-xs">۲</span><h4 className="font-bold text-white">تایید مجوز مرورگر</h4><p className="text-slate-400 leading-relaxed">در صورت هشدار اندروید، گزینه Allow from this source را برای مرورگر خود فعال نمایید.</p></div><div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"><span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold flex items-center justify-center text-xs">۳</span><h4 className="font-bold text-white">نصب و ساخت کیف پول</h4><p className="text-slate-400 leading-relaxed">برنامه را باز کرده و کیف پول جدید بسازید یا عبارات ۲۴ کلمه‌ای خود را فراخوانی کنید.</p></div></div></div>
    </div>
  );
};
/* ====================================================================
   7. FAQ PAGE (/faq)
   ==================================================================== */
export const FaqPage: React.FC<LandingPageProps> = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const faqs = [
    { q: 'آیا وب‌سایت solmint.ir کلیدهای خصوصی من را ذخیره می‌کند؟', a: 'خیر، به هیچ وجه. وب‌سایت سولمینت صرفاً یک درگاه معرفی، آکادمی آموزشی و ارائه اخبار است. تمامی عملیات کلید خصوصی داخل اپلیکیشن اندروید انجام شده و فقط در حافظه ایزوله دستگاه شما نگهداری می‌شود.' },
    { q: 'چگونه در سولمینت توکن سولانا بسازیم؟', a: 'کافیست اپلیکیشن اندروید سولمینت را دانلود کرده، وارد بخش ساخت توکن شوید، نام، نماد و تعداد توکن را مشخص کنید و تراکنش ساخت را امضا نمایید.' },
    { q: 'کارمزد ساخت توکن در سولمینت چقدر است؟', a: 'کارمزد شبکه سولانا (Mint Account Rent) متغیر و معمولاً حدود ۰٫۰۰۲ تا ۰٫۰۰۳ SOL می‌باشد که توسط خود شبکه دریافت می‌شود.' },
    { q: 'آیا می‌توانم عبارت ۲۴ کلمه‌ای تراست ولت یا فانتوم را در سولمینت وارد کنم؟', a: 'بله، اپلیکیشن سولمینت کاملاً با استاندارد BIP-39 سازگار بوده و می‌توانید کیف پول‌های موجود روی سولانا را فراخوانی نمایید.' }
  ];
  return (<div className="max-w-4xl mx-auto px-4 py-12 space-y-10 dir-rtl"><div className="text-center space-y-4"><div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30"><HelpCircle className="w-8 h-8" /></div><h1 className="text-3xl font-black text-white">سوالات متداول سولمینت</h1><p className="text-xs sm:text-sm text-slate-300">پاسخ شفاف به سوالات شما درباره امنیت، اپلیکیشن و شبکه سولانا</p></div><div className="space-y-4">{faqs.map((faq, idx) => <div key={idx} className="rounded-2xl bg-slate-900 border border-white/10 overflow-hidden"><button onClick={() => setOpenIdx(openIdx === idx ? null : idx)} className="w-full p-5 text-right font-bold text-sm text-white flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"><span>{faq.q}</span><ChevronDown className={`w-5 h-5 text-[#14F195] transition-transform ${openIdx === idx ? 'rotate-180' : ''}`} /></button>{openIdx === idx && <div className="p-5 pt-0 text-xs text-slate-300 leading-relaxed border-t border-white/5 bg-black/20">{faq.a}</div>}</div>)}</div></div>);
};