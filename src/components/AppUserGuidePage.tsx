import React from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Coins,
  Flame,
  Image as ImageIcon,
  KeyRound,
  Layers3,
  LockKeyhole,
  Repeat2,
  Send,
  ShieldCheck,
  WalletCards,
  CircleHelp
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  intro: string;
  steps: string[];
  tips: string[];
}

const sections: GuideSection[] = [
  {
    id: 'wallet',
    title: 'کیف پول سولانا',
    subtitle: 'ایجاد، بازیابی و مدیریت دارایی‌ها',
    icon: WalletCards,
    intro: 'کیف پول بخش مرکزی SolMint است و برای مدیریت SOL و حساب‌های توکنی، مشاهده موجودی و امضای عملیات بلاکچینی استفاده می‌شود.',
    steps: [
      'پس از نصب، کیف پول جدید ایجاد کنید یا کیف پول قبلی خود را با عبارت بازیابی وارد کنید.',
      'عبارت بازیابی را فقط در محیط امن خود نگهداری کنید و آن را با هیچ فرد یا وب‌سایتی به اشتراک نگذارید.',
      'پس از ورود، موجودی SOL و توکن‌های حساب را بررسی کنید و برای عملیات موردنظر وارد ابزار مربوط شوید.',
      'قبل از هر تراکنش، آدرس مقصد، مقدار و کارمزد شبکه را بررسی و سپس تراکنش را در خود اپلیکیشن امضا کنید.'
    ],
    tips: [
      'عبارت بازیابی کلید دسترسی به دارایی است؛ آن را در پیام‌رسان، ایمیل یا فضای عمومی ذخیره نکنید.',
      'برای دریافت دارایی، آدرس عمومی کیف پول را بررسی کنید؛ برای امضا یا انتقال، اطلاعات تراکنش را دوباره کنترل کنید.'
    ]
  },
  {
    id: 'token',
    title: 'ساخت توکن سولانا',
    subtitle: 'SPL Token Creation',
    icon: Coins,
    intro: 'در ابزار ساخت توکن می‌توانید مشخصات اصلی Mint را تعیین کنید و عملیات ساخت را از طریق کیف پول خود روی شبکه Solana انجام دهید.',
    steps: [
      'نام، نماد، مقدار عرضه و تعداد اعشار توکن را مشخص کنید.',
      'در صورت وجود گزینه‌های متادیتا، اطلاعات و تصویر موردنظر را وارد کنید.',
      'جزئیات نهایی تراکنش و هزینه شبکه را بررسی کنید.',
      'تراکنش را با کیف پول خود امضا و تا ثبت نتیجه در شبکه صبر کنید.',
      'Mint Address را ذخیره کنید؛ این آدرس شناسه اصلی توکن شما روی Solana است.'
    ],
    tips: [
      'قبل از ساخت، decimals و supply را با دقت انتخاب کنید؛ این مشخصات بخش مهمی از مدل توکن هستند.',
      'Mint Address را با نام توکن اشتباه نگیرید و هنگام انتشار عمومی آن را از منبع معتبر کپی کنید.'
    ]
  },
  {
    id: 'meme-coin',
    title: 'ساخت Meme Coin',
    subtitle: 'ساخت و تنظیم توکن میم روی Solana',
    icon: Flame,
    intro: 'ابزار Meme Coin همان جریان ساخت توکن را برای راه‌اندازی پروژه‌های میم‌کوین ساده‌تر می‌کند و گزینه‌های مربوط به authority را در اختیار کاربر قرار می‌دهد.',
    steps: [
      'اطلاعات پایه پروژه، نام، نماد، decimals و مقدار اولیه را وارد کنید.',
      'تنظیمات authority موردنظر را با دقت بررسی کنید.',
      'تراکنش‌های ایجاد Mint و عرضه اولیه را بررسی و امضا کنید.',
      'پس از تأیید شبکه، Mint Address و اطلاعات توکن را برای استفاده‌های بعدی نگهداری کنید.'
    ],
    tips: [
      'سلب یا تغییر authority می‌تواند برگشت‌پذیری برخی عملیات مدیریتی را محدود کند؛ قبل از امضا تصمیم نهایی را بررسی کنید.',
      'برای معرفی عمومی پروژه، اطلاعات واقعی توکن و وضعیت authority را شفاف اعلام کنید.'
    ]
  },
  {
    id: 'nft',
    title: 'ساخت و Mint NFT',
    subtitle: 'NFT و Metadata روی Solana',
    icon: ImageIcon,
    intro: 'بخش NFT برای ساخت دارایی‌های NFT و ثبت metadata مرتبط در اکوسیستم Solana طراحی شده است.',
    steps: [
      'اطلاعات NFT مانند نام و داده‌های metadata را وارد کنید.',
      'تصویر و اطلاعات موردنیاز metadata را بررسی کنید.',
      'تراکنش ساخت و Mint را مشاهده و با کیف پول امضا کنید.',
      'پس از تأیید شبکه، شناسه‌های NFT و اطلاعات metadata را نگهداری کنید.'
    ],
    tips: [
      'پیش از Mint، محتوای نهایی تصویر و metadata را بررسی کنید؛ تغییرات بعدی به مدل metadata وابسته است.',
      'برای انتقال یا نمایش NFT، آدرس‌ها و شناسه‌های on-chain را مرجع قرار دهید.'
    ]
  },
  {
    id: 'swap',
    title: 'Swap توکن‌ها',
    subtitle: 'تبدیل توکن‌های Solana با Jupiter',
    icon: Repeat2,
    intro: 'بخش Swap برای دریافت Quote و ساخت معامله تبدیل توکن‌ها از زیرساخت Jupiter استفاده می‌کند و امضای نهایی با کیف پول کاربر انجام می‌شود.',
    steps: [
      'توکن مبدا و توکن مقصد را انتخاب کنید.',
      'مقدار معامله را وارد کنید و Quote دریافت‌شده را بررسی کنید.',
      'مقدار دریافتی، Slippage و اطلاعات مسیر معامله را قبل از ادامه بررسی کنید.',
      'تراکنش Swap را دریافت کرده و آن را با کیف پول خود امضا کنید.',
      'پس از ارسال، وضعیت تراکنش را تا تأیید نهایی شبکه بررسی کنید.'
    ],
    tips: [
      'قبل از تأیید، Mint Address توکن‌های مبدا و مقصد را در صورت وجود ابهام بررسی کنید.',
      'Slippage بالاتر می‌تواند تحمل تغییر قیمت بیشتری ایجاد کند؛ مقدار آن را متناسب با شرایط معامله انتخاب کنید.'
    ]
  },
  {
    id: 'burn',
    title: 'Burn و سوزاندن توکن',
    subtitle: 'Single Burn و Batch Burn',
    icon: Flame,
    intro: 'ابزار Burn برای سوزاندن یک یا چند توکن طراحی شده است و از مسیرهای دقیق تراکنش برای کاهش موجودی Mint استفاده می‌کند.',
    steps: [
      'حساب توکن و Mint موردنظر را انتخاب کنید.',
      'مقدار Burn را تعیین کنید؛ در حالت درصدی مقدار بر اساس موجودی واقعی حساب محاسبه می‌شود.',
      'جزئیات عملیات، حساب توکن و authority مربوطه را بررسی کنید.',
      'تراکنش Burn را امضا و ارسال کنید.',
      'رسید عملیات و وضعیت تأیید on-chain را بررسی کنید.'
    ],
    tips: [
      'Burn عملیات کاهش عرضه یا موجودی است و باید قبل از امضا با دقت بررسی شود.',
      'در Batch Burn نتیجه هر Mint را جداگانه بررسی کنید.'
    ]
  },
  {
    id: 'rent',
    title: 'بازیابی Rent حساب‌های توکن',
    subtitle: 'بستن حساب‌های قابل‌بستن و بازیابی SOL',
    icon: Coins,
    intro: 'حساب‌های توکن خالی در شرایط مناسب می‌توانند بسته شوند و Rent آن‌ها به حساب مجاز بازگردد.',
    steps: [
      'فهرست Token Accountهای کیف پول را بررسی کنید.',
      'حساب‌های قابل‌بستن را انتخاب کنید.',
      'حساب و authority مربوط به Close را کنترل کنید.',
      'تراکنش Close Account را امضا و ارسال کنید.',
      'نتیجه شبکه و تغییر موجودی SOL را بررسی کنید.'
    ],
    tips: [
      'فقط حسابی را ببندید که از حذف آن مطمئن هستید.',
      'Close Authority ممکن است با Owner حساب متفاوت باشد؛ در این حالت باید authority مناسب در دسترس باشد.'
    ]
  },
  {
    id: 'batch-transfer',
    title: 'ارسال گروهی SOL و توکن',
    subtitle: 'Batch Transfer / Airdrop',
    icon: Send,
    intro: 'ابزارهای انتقال گروهی برای ارسال دارایی به چندین آدرس در یک جریان کاری طراحی شده‌اند.',
    steps: [
      'فهرست دریافت‌کنندگان و مقدار هر انتقال را وارد یا انتخاب کنید.',
      'آدرس‌ها و مقدارها را پیش از ساخت تراکنش دوباره کنترل کنید.',
      'نوع دارایی، شبکه و هزینه مورد انتظار را بررسی کنید.',
      'تراکنش گروهی را امضا و ارسال کنید.',
      'نتیجه انتقال‌ها و signatureهای مربوط را پیگیری کنید.'
    ],
    tips: [
      'در عملیات گروهی، یک اشتباه در آدرس می‌تواند روی یک دریافت‌کننده واقعی اثر بگذارد؛ داده ورودی را قبل از امضا بازبینی کنید.'
    ]
  },
  {
    id: 'cpmm',
    title: 'ساخت استخر Raydium CPMM',
    subtitle: 'ایجاد استخر نقدینگی',
    icon: Layers3,
    intro: 'بخش CPMM برای ایجاد استخر نقدینگی در Raydium و آماده‌سازی حساب‌های موردنیاز استخر ارائه شده است.',
    steps: [
      'توکن و دارایی‌های موردنظر برای نقدینگی اولیه را انتخاب کنید.',
      'مقدارهای اولیه و پارامترهای نمایش‌داده‌شده را بررسی کنید.',
      'حساب‌های لازم و LP Mint مربوط به استخر را ایجاد کنید.',
      'دستور Initialize Pool را بررسی و تراکنش را امضا کنید.',
      'پس از تأیید شبکه، اطلاعات Pool و LP را ذخیره کنید.'
    ],
    tips: [
      'ایجاد استخر یک عملیات on-chain است؛ قبل از امضا مقدار دارایی و مقصد تراکنش را کنترل کنید.',
      'اطلاعات Pool Address و Mintهای مربوط را برای مدیریت بعدی نگهداری کنید.'
    ]
  },
  {
    id: 'lp',
    title: 'مدیریت LP و عملیات استخر',
    subtitle: 'LP Burn / Lock',
    icon: LockKeyhole,
    intro: 'SolMint ابزارهایی برای عملیات مرتبط با LP Token ارائه می‌کند تا کاربر بتواند جریان‌های مدیریت LP را از موبایل انجام دهد.',
    steps: [
      'استخر و LP Token موردنظر را انتخاب کنید.',
      'عملیات موردنظر مانند Burn یا Lock را انتخاب کنید.',
      'مقدار و حساب‌های مرتبط را بررسی کنید.',
      'تراکنش را با کیف پول امضا کنید.',
      'نتیجه on-chain و وضعیت LP را پس از تأیید بررسی کنید.'
    ],
    tips: [
      'Burn و Lock از نظر اثر اقتصادی متفاوت‌اند؛ قبل از امضا هدف عملیات را مشخص کنید.'
    ]
  },
  {
    id: 'history',
    title: 'تاریخچه و پیگیری تراکنش‌ها',
    subtitle: 'Transaction History',
    icon: BarChart3,
    intro: 'بخش History برای مشاهده عملیات و داده‌های تراکنشی مرتبط با کیف پول استفاده می‌شود.',
    steps: [
      'وارد بخش History شوید.',
      'تراکنش موردنظر را از فهرست انتخاب کنید.',
      'signature، وضعیت، زمان و جزئیات قابل نمایش را بررسی کنید.',
      'برای راستی‌آزمایی مستقل، signature را در Solana Explorer بررسی کنید.'
    ],
    tips: [
      'برای تصمیم مالی مهم، وضعیت on-chain را مرجع نهایی قرار دهید و صرفاً به پیام موفقیت رابط کاربری اکتفا نکنید.'
    ]
  }
];

export const AppUserGuidePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  return (
    <main className="max-w-6xl mx-auto px-4 py-12 sm:py-16 space-y-14 dir-rtl">
      <header className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#14F195]/10 border border-[#14F195]/25 text-[#14F195] text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          راهنمای رسمی استفاده از اپلیکیشن SolMint
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
          آموزش کامل اپلیکیشن سولمینت؛ از کیف پول تا Swap، توکن، NFT و نقدینگی
        </h1>
        <p className="text-slate-300 leading-8 text-sm sm:text-base">
          در این راهنما، قابلیت‌های اصلی اپلیکیشن اندروید سولمینت و روش استفاده از هر بخش را مرحله‌به‌مرحله می‌بینید. سولمینت برای انجام عملیات واقعی روی شبکه Solana طراحی شده است و امضای تراکنش‌های مرتبط با کیف پول در خود اپلیکیشن انجام می‌شود.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button onClick={() => onNavigate('/download')} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" /> دانلود اپلیکیشن
          </button>
          <button onClick={() => onNavigate('/security')} className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#14F195]" /> معماری امنیتی
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {sections.map((section) => (
          <a key={section.id} href={`#guide-${section.id}`} className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-[#14F195]/40 transition-colors">
            <section.icon className="w-5 h-5 text-[#14F195] mb-3" />
            <span className="text-xs sm:text-sm font-bold text-white leading-6">{section.title}</span>
          </a>
        ))}
      </section>

      <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/5 border border-white/10 space-y-5">
        <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2"><KeyRound className="w-6 h-6 text-[#14F195]" /> قبل از انجام هر عملیات</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-300 leading-7">
          <p><strong className="text-white">۱.</strong> مطمئن شوید آدرس‌ها و Mint Addressها را از منبع درست وارد کرده‌اید.</p>
          <p><strong className="text-white">۲.</strong> مقدار، decimals، Slippage و هزینه شبکه را قبل از امضا کنترل کنید.</p>
          <p><strong className="text-white">۳.</strong> بعد از ارسال، signature و وضعیت on-chain را برای عملیات مهم بررسی کنید.</p>
        </div>
      </section>

      {sections.map((section, index) => (
        <article id={`guide-${section.id}`} key={section.id} className="scroll-mt-8 p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/10 space-y-7">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#9945FF]/15 border border-[#9945FF]/25 flex items-center justify-center">
              <section.icon className="w-6 h-6 text-[#14F195]" />
            </div>
            <div>
              <span className="text-xs text-[#14F195] font-bold">راهنمای بخش {index + 1}</span>
              <h2 className="text-2xl font-black text-white mt-1">{section.title}</h2>
              <p className="text-sm text-slate-400 mt-1">{section.subtitle}</p>
            </div>
          </div>
          <p className="text-slate-300 leading-8 text-sm sm:text-base">{section.intro}</p>
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-base font-extrabold text-white mb-4">مراحل استفاده</h3>
              <ol className="space-y-4">
                {section.steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="flex gap-3 text-sm text-slate-300 leading-7">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[#14F195]/10 border border-[#14F195]/25 text-[#14F195] flex items-center justify-center font-bold">{stepIndex + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="p-5 rounded-2xl bg-black/20 border border-white/5">
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2"><CircleHelp className="w-5 h-5 text-sky-400" /> نکات مهم</h3>
              <ul className="space-y-3">
                {section.tips.map((tip, tipIndex) => (
                  <li key={tipIndex} className="text-sm text-slate-400 leading-7 flex gap-2">
                    <ArrowRight className="w-4 h-4 text-[#14F195] mt-1 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      ))}

      <section className="p-7 sm:p-10 rounded-3xl bg-gradient-to-r from-[#9945FF]/15 to-[#14F195]/10 border border-[#14F195]/20 text-center space-y-5">
        <h2 className="text-2xl font-black text-white">آماده استفاده از SolMint هستید؟</h2>
        <p className="text-slate-300 text-sm leading-7">نسخه اندروید را از صفحه رسمی دانلود دریافت کنید و پیش از انجام عملیات مالی، راهنمای مربوط به همان قابلیت را مطالعه کنید.</p>
        <button onClick={() => onNavigate('/download')} className="px-7 py-3.5 rounded-2xl bg-white text-slate-950 font-extrabold inline-flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5" /> دانلود رسمی SolMint
        </button>
      </section>
    </main>
  );
};
