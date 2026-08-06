import React, { useEffect, useMemo, useState } from 'react';
import { Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchCmsSettingsFromApi } from '../utils/cmsApiClient';

export interface AppShowcaseSlide {
  id: string;
  title: string;
  description: string;
  assetId: string;
  imageUrl: string;
  altText: string;
  order: number;
  enabled: boolean;
}

export interface AppShowcaseConfig {
  enabled: boolean;
  model: string;
  screenWidth: number;
  screenHeight: number;
  autoplayMs: number;
  slides: AppShowcaseSlide[];
}

const DEFAULT_CONFIG: AppShowcaseConfig = {
  enabled: false,
  model: 'Samsung Galaxy S26 Ultra',
  screenWidth: 1440,
  screenHeight: 3120,
  autoplayMs: 5000,
  slides: []
};

export const AppShowcase: React.FC = () => {
  const [config, setConfig] = useState<AppShowcaseConfig>(DEFAULT_CONFIG);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCmsSettingsFromApi().then(settings => {
      const showcase = (settings as any)?.appShowcase;
      if (!cancelled && showcase) setConfig({ ...DEFAULT_CONFIG, ...showcase });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const slides = useMemo(
    () => (config.slides || []).filter(s => s && s.enabled && s.imageUrl).sort((a, b) => a.order - b.order),
    [config.slides]
  );

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [slides.length, activeIndex]);

  useEffect(() => {
    if (slides.length < 2 || config.autoplayMs < 1500) return;
    const id = window.setInterval(() => setActiveIndex(i => (i + 1) % slides.length), config.autoplayMs);
    return () => window.clearInterval(id);
  }, [slides.length, config.autoplayMs]);

  if (!config.enabled || slides.length === 0) return null;

  const slide = slides[activeIndex];
  const previous = () => setActiveIndex(i => (i - 1 + slides.length) % slides.length);
  const next = () => setActiveIndex(i => (i + 1) % slides.length);

  return (
    <section id="app-showcase" className="relative overflow-hidden py-24 px-4" aria-labelledby="app-showcase-title">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_35%,rgba(153,69,255,.16),transparent_38%),radial-gradient(circle_at_75%_65%,rgba(20,241,149,.10),transparent_32%)]" />
      <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-[.9fr_1.1fr] gap-14 items-center">
        <div dir="rtl" className="space-y-6 text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#14F195] text-xs font-bold">
            <Smartphone className="w-4 h-4" />
            نمای اپلیکیشن Solmint
          </div>
          <h2 id="app-showcase-title" className="text-4xl sm:text-5xl font-black text-white leading-tight">
            Solmint را همان‌طور که روی موبایل می‌بینید، ببینید
          </h2>
          <p className="text-slate-300 leading-8 max-w-xl">
            تصاویر این بخش مستقیماً از رابط کاربری نسخه انگلیسی اپلیکیشن تهیه می‌شوند؛ بنابراین هر زمان ظاهر اپلیکیشن تغییر کند، تنها با جایگزین کردن اسکرین‌شات‌ها می‌توان نمای وب‌سایت را به‌روز کرد.
          </p>
          <div className="flex flex-wrap gap-2">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${index === activeIndex ? 'bg-[#14F195] text-slate-950 border-[#14F195]' : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/25'}`}
                aria-label={`نمایش ${item.title}`}
                aria-pressed={index === activeIndex}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <div className="relative w-[min(78vw,360px)] drop-shadow-[0_35px_80px_rgba(0,0,0,.65)]">
            <div className="relative rounded-[3rem] p-[8px] bg-gradient-to-br from-slate-500 via-slate-950 to-slate-700 shadow-2xl border border-white/15">
              <div className="relative overflow-hidden rounded-[2.55rem] bg-black aspect-[1440/3120] border border-black">
                <img
                  src={slide.imageUrl}
                  alt={slide.altText || slide.title}
                  width={config.screenWidth}
                  height={config.screenHeight}
                  className="absolute inset-0 w-full h-full object-fill select-none"
                  draggable={false}
                  loading="eager"
                  decoding="async"
                />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-black/95 pointer-events-none" aria-hidden="true" />
              </div>
              <div className="absolute inset-x-1/2 bottom-2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/45" aria-hidden="true" />
            </div>

            <button type="button" onClick={previous} aria-label="تصویر قبلی" className="absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-950/90 border border-white/15 text-white flex items-center justify-center hover:scale-105 transition-transform shadow-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={next} aria-label="تصویر بعدی" className="absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-950/90 border border-white/15 text-white flex items-center justify-center hover:scale-105 transition-transform shadow-xl">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div dir="rtl" className="relative z-10 max-w-6xl mx-auto mt-10 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white">{slide.title}</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">{slide.description}</p>
        </div>
        <div className="text-xs text-slate-500 font-mono shrink-0">{activeIndex + 1} / {slides.length}</div>
      </div>
    </section>
  );
};
