import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'کیف پول سولانا',
    question: 'چرا سولمینت بهترین کیف پول سولانا و امن ترین کیف پول غیرامانی است؟',
    answer: 'سولمینت (Solmint) به عنوان بهترین کیف پول غیر متمرکز و کیف پول غیرامانی ایرانی، کلیدهای خصوصی را فقط روی حافظه امن دستگاه کاربر رمزشده نگه می‌دارد. امکان ساخت توکن بدون کدنویسی، ساخت میم کوین، ضرب NFT، استخر نقدینگی و بازیابی کارمزد اجاره سولانا بدون وابستگی به سرورهای مرکزی میسر شده است.'
  },
  {
    id: 'faq-2',
    category: 'ساخت میم کوین',
    question: 'چطوری میم کوین اختصاصی و ساخت توکن بدون کدنویسی در شبکه سولانا انجام دهیم؟',
    answer: 'در اپلیکیشن سولمینت، بدون نیاز به دانش برنامه‌نویسی می‌توانید با وارد کردن نام، نماد، آپلود لوگو و تعیین تعداد اعشار، ظرف کمتر از ۲ دقیقه ساخت میم کوین شبکه سولانا و ساخت توکن SPL را انجام داده و با گزینه Revoke Mint دسترسی ساخت مجدد را سلب کنید.'
  },
  {
    id: 'faq-3',
    category: 'استخر نقدینگی',
    question: 'چگونه پس از ساخت توکن و میم کوین، استخر نقدینگی در Raydium بسازیم؟',
    answer: 'با استفاده از بخش "استخر نقدینگی" در اپلیکیشن کیف پول سولمینت، می‌توانید توکن جدید خلق‌شده را با واریز مقدار مشخصی SOL یا USDC وارد استخر کرده و جفت معامله ایجاد کنید تا خریداران فوراً قادر به خرید و فروش توکن شما باشند.'
  },
  {
    id: 'faq-4',
    category: 'ساخت و فروش NFT',
    question: 'آموزش ساخت NFT و خرید و فروش NFT در کیف پول سولمینت چگونه است؟',
    answer: 'در بخش ساخت NFT اپلیکیشن سولمینت، فایل تصویر یا اثر دیجیتال خود را آپلود کرده، درصد رویالتی سازنده را تعیین می‌کنید و با استاندارد رسمی Metaplex آن را ضرب می‌کنید. ان‌اف‌تی‌های ساخته شده فوراً در کیف پول قابل مشاهده و خرید و فروش هستند.'
  },
  {
    id: 'faq-5',
    category: 'امنیت و غیرامانی',
    question: 'آیا کلیدهای خصوصی و دارایی‌ها در کیف پول سولمینت تحریم‌پذیر یا قابل مسدودی هستند؟',
    answer: 'به هیچ وجه! تمامی عبارات ۱۲ یا ۲۴ کلمه‌ای بازیابی به صورت رمزنگاری‌شده (AES-256) فقط در موبایل شما ذخیره می‌شوند. هیچ سرور میانجی به دارایی‌های شما دسترسی ندارد و امکان مسدودی حساب به دلیل غیرامانی بودن کاملاً صفر است.'
  },
  {
    id: 'faq-6',
    category: 'بازیابی کارمزد اجاره',
    question: 'بازیابی کارمزد اجاره (Rent Claiming) سولانا چگونه باعث بازگشت SOL به کیف پول می‌شود؟',
    answer: 'در شبکه سولانا به ازای هر توکنی که دریافت می‌کنید حدود ۰.۰۰۲ SOL جهت اجاره حساب قفل می‌شود. وقتی موجودی توکن صفر شود، این مبلغ قفل باقی می‌ماند. ابزار بازیابی کارمزد سولمینت حساب‌های خالی را شناسایی کرده و با بستن آنها، SOL قفل‌شده را به حساب اصلی شما باز می‌گرداند.'
  }
];

export const FaqSection: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('faq-1');

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faq-section" className="py-20 border-b border-white/5 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center space-y-4 max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-5xl font-black text-white">
            سوالات متداول <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">کاربران</span>
          </h2>
        </motion.div>

        {/* Accordion List */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openId === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
                className={`bg-[#101020]/80 rounded-3xl border transition-colors backdrop-blur-xl overflow-hidden ${
                  isOpen ? 'border-[#9945FF]/50 bg-[#101020]' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <button
                  onClick={() => toggleAccordion(item.id)}
                  className="w-full text-right p-6 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="font-bold text-sm sm:text-base text-white flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#14F195]"></span>
                    {item.question}
                  </span>
                  <div className={`p-2 rounded-xl bg-white/5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#14F195]' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="px-6 pb-6 pt-1 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-white/5"
                    >
                      <p className="bg-black/40 p-4 rounded-2xl border border-white/5">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

