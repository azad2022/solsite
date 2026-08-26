import React from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Construction, ShieldCheck } from 'lucide-react';

export const AppFeaturesPaymentGatewaySection: React.FC = () => (
  <section className="relative mt-10 overflow-hidden rounded-3xl border border-white/10 bg-[#101020]/85 p-6 shadow-xl sm:p-8" dir="rtl" aria-labelledby="solmint-payment-gateway-title">
    <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[#14F195]/10 blur-3xl" aria-hidden="true" />
    <div className="pointer-events-none absolute -bottom-20 -right-16 h-44 w-44 rounded-full bg-[#9945FF]/10 blur-3xl" aria-hidden="true" />
    <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-1.5 text-[11px] font-extrabold text-[#14F195]">
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            درگاه پرداخت ارز دیجیتال
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-300">
            <Construction className="h-3.5 w-3.5" aria-hidden="true" />
            در حال تکمیل
          </span>
        </div>
        <h3 id="solmint-payment-gateway-title" className="text-2xl font-black leading-tight text-white sm:text-3xl">درگاه پرداخت ارز دیجیتال برای کاربران Solmint</h3>
        <p className="text-sm leading-8 text-slate-300 sm:text-[15px]">درگاه پرداخت ارز دیجیتال Solmint در دست توسعه است تا کاربران و کسب‌وکارها بتوانند پرداخت‌های رمزارزی را با تجربه‌ای ساده، شفاف و سازگار با اکوسیستم سولانا مدیریت کنند. این سرویس با تمرکز بر پرداخت‌های آن‌چین، تسویه قابل‌پیگیری و زیرساخت مناسب برای فروشگاه، وب‌سایت و اپلیکیشن طراحی می‌شود.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><ShieldCheck className="mb-2 h-5 w-5 text-[#14F195]" aria-hidden="true" /><span className="block text-xs font-bold text-slate-200">پرداخت آن‌چین</span><span className="mt-1 block text-[11px] leading-5 text-slate-400">قابل بررسی روی شبکه</span></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><CreditCard className="mb-2 h-5 w-5 text-cyan-300" aria-hidden="true" /><span className="block text-xs font-bold text-slate-200">پرداخت رمزارزی</span><span className="mt-1 block text-[11px] leading-5 text-slate-400">مناسب پرداخت کالا و خدمات</span></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><CheckCircle2 className="mb-2 h-5 w-5 text-[#9945FF]" aria-hidden="true" /><span className="block text-xs font-bold text-slate-200">در حال توسعه</span><span className="mt-1 block text-[11px] leading-5 text-slate-400">جزئیات نهایی پس از تکمیل اعلام می‌شود</span></div>
        </div>
      </div>
      <div className="shrink-0 lg:w-52">
        <a href="/security" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-xs font-bold text-slate-200 transition-colors hover:border-[#14F195]/40 hover:text-[#14F195]">مشاهده معماری امنیتی<ArrowLeft className="h-4 w-4" aria-hidden="true" /></a>
      </div>
    </div>
  </section>
);
