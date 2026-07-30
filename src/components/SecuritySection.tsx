import React from 'react';
import { motion } from 'motion/react';
import { Key, EyeOff, Cpu, ServerOff } from 'lucide-react';

export const SecuritySection: React.FC = () => {
  const cards = [
    {
      icon: Key,
      colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      title: "ذخیره‌سازی محلی کلیدها",
      desc: "عبارات بازیابی (Seed Phrase) با الگوریتم AES-256 روی حافظه امن موبایل کدگذاری می‌شود."
    },
    {
      icon: ServerOff,
      colorClass: "bg-[#9945FF]/10 border-[#9945FF]/20 text-[#14F195]",
      title: "بدون سرور مرکزی",
      desc: "تمامی درخواست‌ها مستقیماً از گوشی کاربر به RPCهای غیرمتمرکز شبکه سولانا منتقل می‌شوند."
    },
    {
      icon: Cpu,
      colorClass: "bg-sky-500/10 border-sky-500/20 text-sky-400",
      title: "امضای آفلاین تراکنش",
      desc: "تراکنش‌ها پیش از ارسال، روی دستگاه امضا و سپس به شبکه برودکست می‌گردند."
    },
    {
      icon: EyeOff,
      colorClass: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      title: "شفافیت کامل کارمزد",
      desc: "تمام هزینه‌های شبکه سولانا (Network Fee) پیش از امضا به کاربر نمایش داده می‌شود."
    }
  ];

  return (
    <section id="security-section" className="py-20 border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center space-y-4 max-w-2xl mx-auto"
        >
          <h2 className="text-[36px] sm:text-[36px] font-black text-white leading-[56px]" style={{ fontSize: '36px', lineHeight: '56px' }}>
            کلیدهای خصوصی شما <br />
            <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
              تنها نزد خود شماست
            </span>
          </h2>

          <p className="text-slate-400 text-[14px] sm:text-[14px] leading-relaxed" style={{ fontSize: '14px' }}>
            معماری امنیتی سولمینت به گونه‌ای است که هیچ کلید، عبارت بازیابی یا رمز عبوری به هیچ سروری منتقل نمی‌شود.
          </p>
        </motion.div>

        {/* Security Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
                className="glass-panel rounded-2xl p-6 space-y-3"
              >
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${card.colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">{card.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed font-normal">
                  {card.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

