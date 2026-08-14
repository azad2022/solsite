import React from 'react';

interface Props { onNavigate: (path: string) => void; }

const tools = [
  {
    path: '/tools/solana-token-scanner',
    eyebrow: 'Token Scanner',
    title: 'بررسی توکن سولانا',
    description: 'اطلاعات فنی یک Mint را بررسی کنید؛ از عرضه و مجوزها تا برنامه توکن و متادیتای قابل مشاهده روی شبکه.',
    badge: 'تحلیل پایه',
  },
  {
    path: '/tools/token-2022-inspector',
    eyebrow: 'Token-2022 Inspector',
    title: 'بازرس Token-2022',
    description: 'قابلیت‌ها و Extensionهای Token-2022 را جداگانه بررسی کنید و بفهمید هر قابلیت چه اثری روی توکن دارد.',
    badge: 'تحلیل تخصصی',
  },
];

export const SolanaTokenToolsHub: React.FC<Props> = ({ onNavigate }) => (
  <section className="relative overflow-hidden py-16 sm:py-20">
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,rgba(153,69,255,.12),transparent_32%),radial-gradient(circle_at_85%_30%,rgba(20,241,149,.08),transparent_30%)]" />
    <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
      <div className="max-w-3xl mb-10">
        <span className="inline-flex rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-xs font-bold text-slate-300">Solmint Tools</span>
        <h1 className="mt-5 text-3xl sm:text-5xl font-black tracking-tight text-white">ابزارهای بررسی توکن سولانا</h1>
        <p className="mt-4 text-sm sm:text-base leading-8 text-slate-400">دو ابزار تخصصی برای بررسی اطلاعات on-chain توکن‌های سولانا. این ابزارها فقط داده‌های عمومی شبکه را می‌خوانند و هیچ تراکنشی از طرف شما ارسال نمی‌کنند.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {tools.map(tool => (
          <article key={tool.path} className="group rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 sm:p-8 shadow-[0_20px_70px_rgba(0,0,0,.22)] transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-[.18em] text-[#14F195]">{tool.eyebrow}</span>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-400">{tool.badge}</span>
            </div>
            <h2 className="mt-5 text-2xl font-black text-white">{tool.title}</h2>
            <p className="mt-3 min-h-20 text-sm leading-7 text-slate-400">{tool.description}</p>
            <button type="button" onClick={() => onNavigate(tool.path)} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-extrabold text-white transition hover:border-[#14F195]/50 hover:text-[#14F195]">
              ورود به ابزار <span aria-hidden="true">←</span>
            </button>
          </article>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5 text-sm leading-7 text-slate-400">
        <strong className="text-slate-200">نکته:</strong> این ابزارها برای ارزیابی فنی و مشاهده داده‌های عمومی طراحی شده‌اند و به‌تنهایی امنیت، اعتبار پروژه یا ارزش سرمایه‌گذاری یک توکن را تضمین نمی‌کنند.
      </div>
    </div>
  </section>
);
