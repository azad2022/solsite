import React from 'react';
import { motion } from 'motion/react';
import { Key, EyeOff, Cpu, ServerOff } from 'lucide-react';

export const SecuritySection: React.FC = () => {
  const cards = [
    {
      icon: Key,
      colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      title: "ذخیره‌سازی محلی کلیدها",
      desc: "اطلاعات حساس کیف پول در فرآیند کاربرمحور اپلیکیشن مدیریت می‌شود و برای استفاده معمول به سرور وب‌سایت سپرده نمی‌شود."
    },
    {
      icon: ServerOff,
      colorClass: "bg-[#9945FF]/10 border-[#9945FF]/20 text-[#14F195]",
      title: "عدم نگهداری کلید در وب‌سایت",
      desc: "solmint.ir نقش معرفی و آموزش دارد؛ عبارت بازیابی و کلید خصوصی نباید در وب‌سایت یا پیام‌رسان‌ها وارد یا ارسال شوند."
    },
    {
      icon: Cpu,
      colorClass: "bg-sky-500/10 border-sky-500/20 text-sky-400",
      title: "امضای تراکنش روی دستگاه",
      desc: "تراکنش پیش از ارسال به شبکه در اپلیکیشن کاربر بررسی و امضا می‌شود؛ امضای کاربر از مسیر وب‌سایت انجام نمی‌شود."
    },
    {
      icon: EyeOff,
      colorClass: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      title: "نمایش هزینه پیش از تأیید",
      desc: "هزینه‌های مرتبط با تراکنش و شبکه پیش از تأیید نهایی باید برای کاربر قابل بررسی باشد تا تصمیم آگاهانه‌تری بگیرد."
    }
  ];

  return (
    <section id="security-section" className="py-20 border-b border-white/5 relative" aria-labelledby="security-section-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center space-y-4 max-w-2xl mx-auto"
        >
          <h2 id="security-section-title" className="text-[36px] sm:text-[36px] font-black text-white leading-[56px]" style={{ fontSize: '36px', lineHeight: '56px' }}>
            امنیت کیف پول سولانا در معماری غیرامانی
          </h2>

          <p className="text-slate-400 text-[14px] sm:text-[14px] leading-relaxed" style={{ fontSize: '14px' }}>
            در مدل غیرامانی، کنترل کلید و تأیید تراکنش باید در اختیار کاربر باقی بماند. برای جزئیات معماری امنیتی سولمینت، صفحه امنیت را مطالعه کنید.
          </p>

          <a href="/security" className="inline-flex items-center justify-center text-sm font-bold text-[#14F195] hover:text-white transition-colors">
            مشاهده معماری امنیتی سولمینت
          </a>
        </motion.div>

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
