import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';

export const RoadmapSection: React.FC = () => {
  const roadmapItems = [
    {
      phase: 'فاز ۱',
      title: 'هسته اصلی اپلیکیشن غیرامانی',
      description: 'راه‌اندازی ساختار کیف پول، تولید عبارت بازیابی ۱۲ و ۲۴ کلمه‌ای، ارسال و دریافت توکن‌ها روی Mainnet سولانا.',
      status: 'completed',
      date: 'انجام شده'
    },
    {
      phase: 'فاز ۲',
      title: 'سواپ هوشمند DEX Aggregator',
      description: 'اتصال به صرافی‌های غیرمتمرکز سولانا جهت تبادل سریع توکن‌ها با کمترین کارمزد و اسلیپیج.',
      status: 'completed',
      date: 'انجام شده'
    },
    {
      phase: 'فاز ۳',
      title: 'استودیو ساخت توکن SPL & Memecoin',
      description: 'امکان ساخت توکن با لوگو، متادیتا، تنظیمات اعشار و لغو اختیاری Freeze/Mint Authority.',
      status: 'completed',
      date: 'انجام شده'
    },
    {
      phase: 'فاز ۴',
      title: 'ضرب NFT با استاندارد Metaplex',
      description: 'ماژول ضرب NFT تصویری و ویدیویی با تنظیم درصد حق امتیاز سازنده (Royalty) و متادیتا.',
      status: 'completed',
      date: 'انجام شده'
    },
    {
      phase: 'فاز ۵',
      title: 'ماژول استخر نقدینگی Raydium',
      description: 'ایجاد مستقیم استخر خرید و فروش برای توکن‌های جدید در Raydium DEX همراه با قفل LP.',
      status: 'in_progress',
      date: 'در حال توسعه'
    },
    {
      phase: 'فاز ۶',
      title: 'نسخه iOS و دسکتاپ سولمینت',
      description: 'توسعه نسخه‌های آیفون (iOS) و دسکتاپ برای همگام‌سازی کامل تجربه کاربری در تمام دستگاه‌ها.',
      status: 'planned',
      date: 'برنامه‌ریزی آینده'
    }
  ];

  return (
    <section id="roadmap-section" className="py-20 border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center space-y-4 max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-5xl font-black text-white">
            نقشه راه و <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">گام‌های پیش‌رو</span>
          </h2>

          <p className="text-slate-400 text-[14px] sm:text-[14px] leading-relaxed" style={{ fontSize: '14px' }}>
            ما متعهد به توسعه مستمر اپلیکیشن سولمینت هستیم. در زیر وضعیت گام‌های طراحی‌شده را مشاهده می‌کنید.
          </p>
        </motion.div>

        {/* Roadmap Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {roadmapItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
              className={`p-6 rounded-2xl transition-all space-y-3 relative ${
                item.status === 'completed'
                  ? 'glass-panel border-emerald-500/30'
                  : item.status === 'in_progress'
                  ? 'glass-panel border-[#9945FF]/50 shadow-lg shadow-[#9945FF]/10'
                  : 'glass-panel opacity-65'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-400">
                  {item.phase}
                </span>

                {item.status === 'completed' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>تکمیل شده</span>
                  </span>
                )}

                {item.status === 'in_progress' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#9945FF]/20 border border-[#9945FF]/40 text-[#14F195] text-[10px] font-bold flex items-center gap-1 animate-pulse">
                    <Sparkles className="w-3 h-3" />
                    <span>در حال اجرا</span>
                  </span>
                )}

                {item.status === 'planned' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>آینده</span>
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white">{item.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-normal">{item.description}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

