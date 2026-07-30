import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, 
  Layers, 
  Image as ImageIcon, 
  Repeat, 
  Flame, 
  Coins, 
  Send, 
  BarChart3, 
  CheckCircle2, 
  X, 
  Shield, 
  Sparkles,
  ArrowLeft,
  Smartphone
} from 'lucide-react';

interface FeatureItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  description: string;
  detailedSteps: string[];
  inAppBenefits: string[];
}

export const AppFeaturesSection: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<FeatureItem | null>(null);

  const features: FeatureItem[] = [
    {
      id: 'wallet',
      title: 'کیف پول غیرمتمرکز و امن',
      subtitle: 'Non-Custodial Wallet Engine',
      badge: 'امنیت ۱۰۰٪',
      badgeColor: 'text-[#14F195] bg-[#14F195]/10 border-[#14F195]/30',
      icon: Key,
      description: 'مدیریت کامل کلیدهای خصوصی روی حافظه داخلی موبایل کاربر بدون ذخیره‌سازی روی هیچ سرور واسطه‌ای.',
      detailedSteps: [
        'تولید عبارت بازیابی (Seed Phrase) ۱۲ یا ۲۴ کلمه‌ای بر اساس پروتکل استاندارد BIP-39.',
        'رمزنگاری AES-256 داده‌های کلید خصوصی روی چیپ امنیتی دستگاه.',
        'امضای آفلاین تمامی تراکنش‌ها روی گوشی پیش از ارسال به شبکه سولانا.'
      ],
      inAppBenefits: [
        'کنترل مطلق و صددرصدی بر دارایی‌ها',
        'عدم نیاز به احراز هویت (No KYC)',
        'پشتیبانی از زیست‌سنجی (Fingerprint/FaceID)'
      ]
    },
    {
      id: 'token-creator',
      title: 'ساخت توکن SPL و میم‌کوین',
      subtitle: 'SPL Token Creator',
      badge: 'بدون کدنویسی',
      badgeColor: 'text-[#9945FF] bg-[#9945FF]/10 border-[#9945FF]/30',
      icon: Layers,
      description: 'ساخت توکن اختصاصی شبکه سولانا با نام، نماد، تصویر، تعداد واحد و قابلیت‌های پیشرفته مدیریت دسترسی.',
      detailedSteps: [
        'وارد کردن نام، نماد (Symbol) و تعداد کاراکتر اعشار (Decimals).',
        'آپلود لوگوی توکن روی شبکه غیرمتمرکز IPFS / Arweave.',
        'تعیین اختیاری لغو Freeze Authority و Revoke Mint Authority برای جلب اعتماد خریداران.'
      ],
      inAppBenefits: [
        'ساخت توکن کامل در کمتر از ۵ ثانیه',
        'سازگاری ۱۰۰٪ با Raydium و Phantom',
        'عدم نیاز به برنامه نویسی Rust یا Anchor'
      ]
    },
    {
      id: 'nft-mint',
      title: 'ضرب NFT با استاندارد متالپیکس',
      subtitle: 'Metaplex NFT Minter',
      badge: 'کارمزد < ۰.۵٪',
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
      icon: ImageIcon,
      description: 'تبدیل آثار هنری، عکس‌ها و فایل‌ها به NFT معتبر روی بلاکچین سولانا با تنظیم حق امتیاز سازنده.',
      detailedSteps: [
        'انتخاب فایل تصویر یا اثر هنری از گالری موبایل.',
        'وارد کردن متادیتا، خصوصیات (Attributes) و درصد Royalty برای فروش‌های بعدی.',
        'ضرب مستقیم روی پروتکل Metaplex و اضافه شدن به کیف پول.'
      ],
      inAppBenefits: [
        'نمایش فوری NFT در مارکت‌پلیس‌های Tensor و Magic Eden',
        'کمترین کارمزد ساخت در شبکه سولانا',
        'قابلیت انتقال و هدیه دادن آسان'
      ]
    },
    {
      id: 'smart-swap',
      title: 'سواپ هوشمند و سریع',
      subtitle: 'DEX Aggregator Swap',
      badge: 'بهترین نرخ',
      badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
      icon: Repeat,
      description: 'تبدیل آنی توکن‌ها به یکدیگر با مسیریابی هوشمند در میان صرافی‌های غیرمتمرکز سولانا.',
      detailedSteps: [
        'انتخاب توکن مبدا و مقصد (مانند SOL به USDC یا میم‌کوین‌ها).',
        'یافتن بهترین مسیر معامله از بین استخرهای Raydium, Orca و Meteora.',
        'انجام معامله با حداقل کارمزد شبکه و جلوگیری از Front-Running.'
      ],
      inAppBenefits: [
        'کاهش لغزش قیمت (Slippage)',
        'سرعت تسویه زیر ۱ ثانیه',
        'بدون کارمزد مخفی واسطه'
      ]
    },
    {
      id: 'raydium-pool',
      title: 'استخر نقدینگی و لیستینگ رایدیوم',
      subtitle: 'Raydium Liquidity Pool',
      badge: 'ارزش‌دهی فوری',
      badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
      icon: Flame,
      description: 'ایجاد استخر نقدینگی و بازار خرید و فروش برای توکن‌های جدید ساخته‌شده در صرافی Raydium.',
      detailedSteps: [
        'اتصال توکن ساخته شده به مقدار مشخصی SOL یا USDC.',
        'ایجاد OpenBook Market ID و واریز نقدینگی اولیه.',
        'فعال‌سازی امکان معامله برای تمامی کاربران جهانی.'
      ],
      inAppBenefits: [
        'لیست شدن خودکار در معتبرترین DEX سولانا',
        'قابلیت قفل کردن نقدینگی (LP Lock)',
        'قابلیت سوزاندن توکن‌های LP'
      ]
    },
    {
      id: 'rent-recovery',
      title: 'بازیابی کارمزد اجاره حساب‌ها',
      subtitle: 'Solana Rent Claiming',
      badge: 'بازپس‌گیری SOL',
      badgeColor: 'text-[#14F195] bg-[#14F195]/10 border-[#14F195]/30',
      icon: Coins,
      description: 'شناسایی و بستن اتوماتیک حساب‌های Token Account بدون موجودی و بازگرداندن SOL قفل‌شده.',
      detailedSteps: [
        'اسکن کامل آدرس کیف پول جهت یافتن حساب‌های ATA خالی از توکن.',
        'محاسبه مقدار دقیق SOL قفل‌شده به عنوان Rent Exemption (حدود 0.002 SOL به ازای هر حساب).',
        'بستن حساب‌ها با ۱ کلیک و انتقال SOL بازیابی شده به موجودی اصلی.'
      ],
      inAppBenefits: [
        'آزادسازی رایگان سولانای قفل شده',
        'تمیزسازی و بهینه‌سازی کیف پول',
        'عملیات ۱۰۰٪ امن و برگشت‌پذیر'
      ]
    },
    {
      id: 'airdrop-batch',
      title: 'ارسال گروهی و ایردراپ',
      subtitle: 'Batch Token Airdrop',
      badge: 'توزیع انبوه',
      badgeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
      icon: Send,
      description: 'توزیع توکن یا SOL بین صدها آدرس مختلف در قالب یک تراکنش تجمیعی.',
      detailedSteps: [
        'وارد کردن لیست آدرس‌های دریافت‌کننده به صورت متنی یا فایل CSV.',
        'تعیین مقدار توکن تخصیصی برای هر آدرس.',
        'ارسال سریع ایردراپ با صرفه‌جویی در کارمزد تراکنش‌ها.'
      ],
      inAppBenefits: [
        'مناسب کمپین‌های مارکتینگ پروژه‌ها',
        'کاهش ۹۰ درصدی زمان ارسال',
        'تاییدیه دقیق گزارش ارسال'
      ]
    },
    {
      id: 'portfolio-analytics',
      title: 'مدیریت و تحلیل پورتفولیو',
      subtitle: 'Portfolio & History Tracker',
      badge: 'آمار زنده',
      badgeColor: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
      icon: BarChart3,
      description: 'نمایش آمار لحضه‌ای ارزش دارایی‌ها، نمودار تغییرات قیمت و تاریخچه دقیق تراکنش‌ها.',
      detailedSteps: [
        'استعلام قیمت زنده تمامی توکن‌ها از اوراکل‌های معتبر.',
        'محاسبه مجموع ارزش کیف پول به دلار و تومان.',
        'تفکیک تراکنش‌ها بر اساس واریز، برداشت، سواپ و ساخت توکن.'
      ],
      inAppBenefits: [
        'رابط کاربری فوق‌العاده شیک و خوانا',
        'بروزرسانی زنده بدون تاخیر',
        'امکان خروجی گرفتن از گزارش‌ها'
      ]
    }
  ];

  return (
    <section id="app-features" className="py-20 border-b border-white/5 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs for dynamic scroll feel */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#9945FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-[#14F195]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">

        {/* Section Title with Motion Scroll Effect */}
        <motion.div 
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, margin: '-50px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center space-y-4 max-w-3xl mx-auto"
        >
          <h2 className="text-[48px] font-bold text-white leading-[62.5px] text-center" style={{ fontSize: '48px', lineHeight: '62.5px' }}>
            همه امکانات وب۳ سولانا <br className="hidden sm:block" />
            در <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">یک اپلیکیشن موبایل</span>
          </h2>

          <p className="text-slate-400 text-[12px] sm:text-[12px] leading-relaxed" style={{ fontSize: '12px' }}>
            اپلیکیشن سولمینت تمامی پیچیدگی‌های بلاکچین سولانا را حذف کرده است. برای استفاده از هیچ‌یک از ابزارهای زیر نیازی به سیستم خانگی یا کدنویسی ندارید.
          </p>
        </motion.div>

        {/* Features Bento Grid with Staggered Scroll Animations */}
        <motion.div 
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, margin: '-60px' }}
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {features.map((feat) => {
            const IconComp = feat.icon;
            return (
              <motion.div
                key={feat.id}
                onClick={() => setSelectedFeature(feat)}
                variants={{
                  hidden: { opacity: 0, y: 35, scale: 0.94 },
                  show: { 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
                  }
                }}
                whileHover={{ 
                  y: -8, 
                  scale: 1.02,
                  transition: { duration: 0.25, ease: 'easeOut' }
                }}
                whileTap={{ scale: 0.98 }}
                className="glass-panel-interactive rounded-2xl p-6 flex flex-col justify-between group cursor-pointer border border-white/10 hover:border-[#14F195]/40 hover:shadow-xl hover:shadow-[#9945FF]/10 transition-colors"
              >
                <div className="space-y-4">
                  
                  {/* Top Bar inside Card */}
                  <div className="flex items-center justify-between">
                    <motion.div 
                      whileHover={{ rotate: 12, scale: 1.1 }}
                      className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#9945FF]/20 to-[#14F195]/20 border border-white/10 text-[#14F195] flex items-center justify-center group-hover:border-[#9945FF]/40 transition-colors"
                    >
                      <IconComp className="w-5 h-5 stroke-[2]" />
                    </motion.div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${feat.badgeColor}`}>
                      {feat.badge}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-[#14F195] transition-colors leading-snug">
                      {feat.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      {feat.subtitle}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 font-normal">
                    {feat.description}
                  </p>

                </div>

                {/* Footer Link inside Card */}
                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-[#14F195] transition-colors">
                  <span>بررسی قابلیت</span>
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1.5 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Feature Detail Modal with AnimatePresence */}
        <AnimatePresence>
          {selectedFeature && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFeature(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#101020] w-full max-w-2xl rounded-3xl border border-white/15 p-6 sm:p-8 space-y-6 text-slate-200 my-auto shadow-2xl relative"
              >
                
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#9945FF]/20 text-[#14F195] border border-[#9945FF]/30 flex items-center justify-center font-bold">
                      <selectedFeature.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{selectedFeature.title}</h3>
                      <span className="text-xs text-slate-400 font-mono">{selectedFeature.subtitle}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedFeature(null)}
                    className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <p className="text-sm text-slate-300 leading-relaxed">
                  {selectedFeature.description}
                </p>

                {/* Steps inside App */}
                <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/10">
                  <span className="text-xs font-bold text-white block">مراحل انجام کار داخل اپلیکیشن سولمینت:</span>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {selectedFeature.detailedSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#9945FF]/20 text-[#14F195] text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Benefits */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-400 block">مزایای اختصاصی اپلیکیشن:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {selectedFeature.inAppBenefits.map((ben, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[11px] font-medium">{ben}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Download Footer inside Modal */}
                <div className="pt-2">
                  <a
                    href="https://t.me/solmintchannel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:brightness-110 transition-all"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>دانلود اپلیکیشن سولمینت از تلگرام</span>
                  </a>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
};
