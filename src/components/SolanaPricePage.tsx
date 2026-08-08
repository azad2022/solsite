import React from 'react';
import { Activity, BarChart3, Clock3, ExternalLink, Gauge, LineChart, ShieldCheck } from 'lucide-react';

const CHART_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co/functions/v1/solana-live-chart-v3';
const PRICE_CARD_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co/functions/v1/solana-price-card';

const SolanaMark: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 397 311" className={className} role="img" aria-label="Solana">
    <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="#00FFA3" />
    <path d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7-62.7z" fill="#DC1FFF" />
    <path d="M332.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H5.5c-5.8 0-8.7 5.8-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="#00FFA3" />
  </svg>
);

export const SolanaPricePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <div className="min-h-screen bg-[#070910] text-slate-100" dir="rtl">
    <section className="relative overflow-hidden border-b border-white/[0.07]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(153,69,255,.18),transparent_35%),radial-gradient(circle_at_85%_30%,rgba(20,241,149,.10),transparent_35%)]" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#14F195]/25 bg-[#14F195]/10 text-[#7fffd0] text-xs font-bold mb-5"><span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" /> داده زنده بازار · SOL/USD</div>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] p-3 shadow-2xl shadow-[#9945FF]/20"><SolanaMark /></div>
            <div><p className="text-sm text-slate-400">Solana · SOL</p><h1 className="text-3xl sm:text-5xl font-black tracking-tight">قیمت لحظه‌ای سولانا</h1></div>
          </div>
          <p className="text-slate-300 leading-8 text-sm sm:text-base max-w-3xl">قیمت لحظه‌ای سولانا (SOL) به دلار را همراه با نمودار واقعی کندلی، تایم‌فریم‌های مختلف، EMA 20 و اطلاعات بازار مشاهده کنید. داده‌های این صفحه از بازار واقعی دریافت می‌شوند و این صفحه برای بررسی اطلاعات بازار طراحی شده است.</p>
        </div>
      </div>
    </section>

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      <section aria-labelledby="live-price-heading" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#9945FF]/30 bg-gradient-to-br from-[#171124] to-[#0c1119] p-4 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-2"><span id="live-price-heading" className="text-xs text-slate-400 font-bold">قیمت لحظه‌ای SOL</span><Activity className="w-4 h-4 text-[#14F195]" aria-hidden="true" /></div>
          <img src={`${PRICE_CARD_URL}?style=hero&v=live`} alt="قیمت لحظه‌ای سولانا SOL به دلار" className="w-full h-auto block rounded-xl" loading="eager" referrerPolicy="no-referrer" />
          <p className="mt-2 text-[11px] text-slate-500">قیمت از منبع بازار دریافت می‌شود؛ عدد ثابت یا ساختگی نیست.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2 text-xs text-slate-400 mb-3"><Clock3 className="w-4 h-4" aria-hidden="true" /> بروزرسانی خودکار</div><p className="text-xl font-black">داده زنده بازار</p><p className="mt-2 text-xs text-slate-500 leading-6">نمودار به‌صورت دوره‌ای داده جدید دریافت می‌کند و در صورت اختلال منبع، عدد جعلی نمایش نمی‌دهد.</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2 text-xs text-slate-400 mb-3"><ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" /> منبع داده</div><p className="text-xl font-black">Kraken · SOL/USD</p><p className="mt-2 text-xs text-slate-500 leading-6">داده OHLC بازار برای نمودار کندلی و داده زنده قیمت استفاده می‌شود.</p></div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#091017] overflow-hidden shadow-2xl" aria-labelledby="chart-heading">
        <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#14F195]" aria-hidden="true" /><h2 id="chart-heading" className="text-xl sm:text-2xl font-black">نمودار زنده قیمت سولانا</h2></div><p className="text-xs text-slate-500 mt-2">کندل‌های واقعی SOL/USD · تایم‌فریم‌های 1 دقیقه تا روزانه · EMA 20</p></div>
          <span className="inline-flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE MARKET</span>
        </div>
        <div className="w-full bg-[#071016] min-h-[330px]"><iframe title="نمودار زنده قیمت سولانا SOL/USD" src={`${CHART_URL}?interval=60`} className="w-full border-0 block" style={{ height: 'min(72vw, 520px)', minHeight: 330 }} loading="eager" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen" /></div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 overflow-hidden"><div className="p-5 border-b border-slate-800"><h2 className="font-black flex items-center gap-2"><LineChart className="w-5 h-5 text-[#9945FF]" aria-hidden="true" /> نمای ۴ ساعته قیمت سولانا</h2><p className="text-xs text-slate-500 mt-1">نمای دوم برای بررسی ساختار میان‌مدت SOL</p></div><iframe title="نمودار چهار ساعته قیمت سولانا" src={`${CHART_URL}?interval=240`} className="w-full border-0 block" style={{ height: 'min(90vw, 430px)', minHeight: 320 }} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen" /></div>
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-[#101521] p-6 sm:p-7"><div className="flex items-center gap-3 mb-5"><Gauge className="w-6 h-6 text-[#14F195]" aria-hidden="true" /><h2 className="text-xl font-black">راهنمای استفاده از نمودار</h2></div><div className="space-y-4 text-sm text-slate-300 leading-7"><p><strong className="text-white">تایم‌فریم:</strong> از 1 دقیقه تا 1 روز انتخاب کنید تا ساختار کوتاه‌مدت یا بلندمدت بازار را ببینید.</p><p><strong className="text-white">کندل:</strong> هر کندل بازشدن، بیشترین، کمترین و بسته‌شدن قیمت را در بازه انتخاب‌شده نشان می‌دهد.</p><p><strong className="text-white">EMA 20:</strong> میانگین متحرک نمایی ۲۰ دوره‌ای روی داده واقعی قیمت محاسبه می‌شود و فقط ابزار اطلاعاتی است.</p><p><strong className="text-white">بروزرسانی:</strong> نمودار داده جدید بازار را دریافت می‌کند و در صورت خطای منبع، مقدار ساختگی تولید نمی‌شود.</p></div></div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6"><h2 className="text-xl font-black mb-4">قیمت سولانا امروز</h2><p className="text-sm text-slate-300 leading-8">قیمت SOL در طول روز با عرضه و تقاضا، حجم معاملات و شرایط کلی بازار تغییر می‌کند. به همین دلیل این صفحه به یک عدد ثابت در متن متکی نیست و داده بازار را هنگام مشاهده ابزار قیمت و نمودار دریافت می‌کند.</p></div><div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6"><h2 className="text-xl font-black mb-4">قیمت SOL به دلار</h2><p className="text-sm text-slate-300 leading-8">مرجع نمودار این صفحه جفت معاملاتی SOL/USD است. اختلاف جزئی قیمت بین بازارها ممکن است به دلیل تفاوت نقدینگی، حجم معاملات و زمان به‌روزرسانی ایجاد شود.</p></div></section>

      <section className="rounded-3xl border border-slate-800 bg-[#0b1018] p-6 sm:p-8"><h2 className="text-2xl font-black mb-6">سوالات متداول درباره قیمت سولانا</h2><div className="grid md:grid-cols-2 gap-6"><div><h3 className="font-bold text-white mb-2">قیمت لحظه‌ای سولانا از کجا می‌آید؟</h3><p className="text-sm text-slate-400 leading-7">کارت قیمت و نمودار این صفحه به زیرساخت داده بازار سولمینت متصل‌اند و برای SOL/USD از داده بازار Kraken استفاده می‌کنند.</p></div><div><h3 className="font-bold text-white mb-2">آیا نمودار قیمت سولانا واقعی است؟</h3><p className="text-sm text-slate-400 leading-7">بله. کندل‌ها از داده OHLC بازار ساخته می‌شوند و نمودار از داده از پیش‌ساخته یا مقادیر نمایشی استفاده نمی‌کند.</p></div><div><h3 className="font-bold text-white mb-2">آیا قیمت سولانا ثابت می‌ماند؟</h3><p className="text-sm text-slate-400 leading-7">خیر. قیمت بازار تغییر می‌کند و ابزار زنده با دریافت داده جدید، اطلاعات خود را به‌روزرسانی می‌کند.</p></div><div><h3 className="font-bold text-white mb-2">آیا این صفحه توصیه خرید یا فروش است؟</h3><p className="text-sm text-slate-400 leading-7">خیر. این صفحه برای نمایش و بررسی داده‌های بازار طراحی شده و توصیه سرمایه‌گذاری ارائه نمی‌کند.</p></div></div></section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#9945FF]/20 bg-[#9945FF]/5 p-5"><div><p className="font-bold">آموزش‌ها و مطالب تخصصی سولانا</p><p className="text-xs text-slate-500 mt-1">برای محتوای آموزشی و تحلیلی به آکادمی سولمینت بروید.</p></div><button type="button" onClick={() => onNavigate('/blog')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-slate-950 text-xs font-black">مشاهده آکادمی <ExternalLink className="w-4 h-4" aria-hidden="true" /></button></div>
    </main>
  </div>
);
