import { Article, MediaItem, Testimonial } from '../types';

export const INITIAL_TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    name: 'مهندس محمدرضا شریفی',
    role: 'توسعه‌دهنده Web3 و کریپتو',
    comment: 'سولمینت واقعاً سرعت کار روی سولانا را بالا برد. ساخت توکن با لغو Freeze Authority بدون نیاز به کدهای Rust دقیقاً همان چیزی بود که نیاز داشتم.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    stars: 5,
    createdAt: '۱۴۰۴/۰۵/۰۱',
    createdAtJalali: '۱۴۰۴/۰۵/۰۱',
    createdAtGregorian: '2025/07/23',
    approved: true
  },
  {
    id: 't-2',
    name: 'سارا کریمی',
    role: 'بنیان‌گذار پروژه NFT',
    comment: 'رابط کاربری غیرامانی بسیار امن و تمیز است. قابلیت ضرب NFT متالپیکس روی موبایل با کارمزد بسیار ناچیزی انجام شد و فوراً در Phantom قرار گرفت.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    stars: 5,
    createdAt: '۱۴۰۴/۰۵/۰۲',
    createdAtJalali: '۱۴۰۴/۰۵/۰۲',
    createdAtGregorian: '2025/07/24',
    approved: true
  },
  {
    id: 't-3',
    name: 'علی احمدی',
    role: 'فعال اکوسیستم سولانا',
    comment: 'قابلیت Rent Claim یا بازیابی کارمزد اجاره عالی بود! بیش از ۲.۵ سولانای قفل شده در حساب‌های قدیمی توکن‌هایم را با یک کلیک آزاد کردم.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    stars: 5,
    createdAt: '۱۴۰۴/۰۵/۰۳',
    createdAtJalali: '۱۴۰۴/۰۵/۰۳',
    createdAtGregorian: '2025/07/25',
    approved: true
  }
];

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-memecoin-tutorial',
    title: 'چطوری میم کوین اختصاصی بسازیم؟ آموزش کامل ساخت میم کوین و ایجاد استخر نقدینگی در سولانا',
    slug: 'how-to-create-custom-memecoin-solana',
    category: 'آموزش ساخت میم کوین',
    tags: ['ساخت میم کوین', 'ساخت توکن بدون کدنویسی', 'استخر نقدینگی', 'ساخت میم کوین شبکه سولانا', 'آموزش ساخت میم کوین'],
    summary: 'راهنمای جامع و تصویری ساخت میم کوین شبکه سولانا بدون نیاز به کدنویسی. نحوه تنظیم لوگو، سلب دسترسی Mint و ایجاد استخر نقدینگی (Liquidity Pool) در Raydium.',
    content: `
# چطوری میم کوین اختصاصی بسازیم؟ (راهنمای جامع بدون کدنویسی)

ساخت میم کوین در شبکه سولانا به دلیل سرعت بالا و کارمزد نزدیک به صفر، محبوب‌ترین روش راه‌اندازی پروژه‌های جدید وب۳ است. با ابزار **ساخت توکن و میم کوین سولمینت (Solmint App)**، می‌توانید ظرف کمتر از ۲ دقیقه میم کوین خود را ایجاد و به بازار عرضه کنید.

## مراحل ساخت میم کوین اختصاصی در سولانا:

### ۱. انتخاب نام، نماد و لوگوی جذاب
اولین قدم برای موفقیت یک میم کوین، برندینگ و جامعه‌سازی است. نام (Name)، نماد (Symbol) و آیکون تصویر باکیفیت برای توکن خود آماده کنید.

### ۲. وارد کردن پارامترها در اپلیکیشن سولمینت
در بخش **ساخت توکن SPL** در اپلیکیشن غیرامانی سولمینت:
- **نام و نماد:** مثلاً SolCat (SCAT)
- **تعداد اعشار (Decimals):** عدد ۹ برای اکثر توکن‌های سولانا
- **عرضه کل (Total Supply):** مثلاً ۱,۰۰۰,۰۰۰,۰۰۰ توکن
- **آپلود عکس لوگو:** تصویر گرافیکی میم کوین خود را آپلود کنید.

### ۳. سلب دسترسی ساخت و مسدودی (Revoke Authorities)
برای جلب اعتماد خریداران و لیستینگ در سایت‌های تحلیلی مانند DexScreener و Birdeye، حتماً تیک **Revoke Mint Authority** و **Revoke Freeze Authority** را بزنید تا کسی نتواند عرضه توکن را افزایش دهد یا حساب کاربران را مسدود کند.

### ۴. ایجاد استخر نقدینگی (Liquidity Pool)
پس از ساخت توکن، توکن شما در کیف پول شما قرار دارد. برای اینکه دیگران بتوانند آن را بخرند و بفروشند:
۱. وارد بخش **استخر نقدینگی** در سولمینت شوید.
۲. جفت‌ارز توکن خود و SOL یا USDC را تعیین کنید (مثلاً ۱۰,۰۰۰ توکن + ۵ SOL).
۳. استخر نقدینگی را ایجاد کنید. اکنون میم کوین شما در Raydium، Jupiter و تمامی صرافی‌های غیرمتمرکز قابل معامله است!
    `,
    coverImage: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1200&q=80',
    author: {
      name: 'آزاد آذرخش',
      role: 'توسعه‌دهنده ارشد وب۳ سولمینت',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    },
    publishedAt: '۱۴۰۴/۰۵/۰۵',
    publishedAtJalali: '۱۴۰۴/۰۵/۰۵',
    publishedAtGregorian: '2025/07/27',
    readTimeMinutes: 6,
    viewsCount: 3890,
    comments: [
      {
        id: 'c-mc-1',
        userName: 'رضا کامرانی',
        text: 'عالی‌ترین آموزش ساخت میم کوین بود! من اولین میم کوینم رو ساختم و توی رادیوم استخر نقدینگی ساختم.',
        createdAt: '۱۴۰۴/۰۵/۰۶',
        createdAtJalali: '۱۴۰۴/۰۵/۰۶',
        createdAtGregorian: '2025/07/28',
        approved: true
      }
    ],
    seoScore: 98
  },
  {
    id: 'art-nft-tutorial',
    title: 'آموزش ساخت NFT و ضرب متالپیکس؛ راهنمای خرید و فروش NFT در سولانا',
    slug: 'how-to-create-and-trade-nfts-solana',
    category: 'آموزش ساخت NFT',
    tags: ['ساخت NFT', 'آموزش ساخت NFT', 'خرید و فروش NFT', 'کیف پول غیر متمرکز', 'کیف پول سولانا'],
    summary: 'چگونه اثر هنری یا کلکسیون دیجیتال خود را به NFT تبدیل کنیم؟ بررسی فرآیند ساخت NFT با استاندارد Metaplex روی سولانا با کارمزد اپلیکیشن سولمینت.',
    content: `
# آموزش ساخت NFT و ضرب کلکسیون دیجیتال روی سولانا

ان‌اف‌تی‌ها (NFT) دارایی‌های غیرقابل تعویض روی بلاک‌چین هستند که اثبات مالکیت اثر هنری، کارت بازی یا دارایی مجازی را ممکن می‌سازند. شبکه سولانا به دلیل کارمزد بسیار پایین، بهترین بستر برای **ساخت NFT** و **خرید و فروش NFT** است.

## مراحل ساخت NFT در اپلیکیشن سولمینت:

۱. **آپلود تصویر اثر:** فایل تصویر، GIF یا ویدئوی خود را انتخاب کنید.
۲. **تکمیل متاداده (Metadata):** عنوان اثر، توضیحات و ویژگی‌های خاص (Attributes) را وارد نمایید.
۳. **تعیین رویالتی (Royalty Percentage):** درصدی که با هر بار خرید و فروش NFT به حساب سازنده واریز می‌شود (مثلاً ۵٪).
۴. **ضرب (Mint) با استاندار متالپیکس:** با کلیک روی دکمه ضرب، NFT شما مستقیماً روی بلاک‌چین سولانا ثبت شده و در کیف پول سولمینت قرار می‌گیرد.

## راهنمای خرید و فروش NFT
پس از ضرب NFT، می‌توانید آن را به مارکت‌پلیس‌های معتبر سولانا ارسال کرده یا مستقیماً از داخل کیف پول غیرمتمرکز سولمینت به سایر آدرس‌ها منتقل کرده و به فروش برسانید.
    `,
    coverImage: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    author: {
      name: 'سارا کریمی',
      role: 'بنیان‌گذار پروژه NFT و متخصص متالپیکس',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80'
    },
    publishedAt: '۱۴۰۴/۰۵/۰۴',
    publishedAtJalali: '۱۴۰۴/۰۵/۰۴',
    publishedAtGregorian: '2025/07/26',
    readTimeMinutes: 5,
    viewsCount: 2740,
    comments: [],
    seoScore: 96
  },
  {
    id: 'art-wallet-security',
    title: 'چرا سولمینت بهترین کیف پول سولانا و امن ترین کیف پول غیرامانی ایرانی است؟',
    slug: 'best-solana-wallet-solmint-security',
    category: 'کیف پول سولانا',
    tags: ['کیف پول سولانا', 'کیف پول سولمینت', 'بهترین کیف پول سولانا', 'امن ترین کیف پول جهان', 'کیف پول ایرانی', 'کیف پول غیر متمرکز'],
    summary: 'بررسی دلایلی که سولمینت را به محبوب‌ترین و امن‌ترین کیف پول غیرامانی سولانا برای کاربران تبدیل کرده است. ذخیره‌سازی ایزوله محلی و عدم تحریم‌پذیری.',
    content: `
# ویژگی‌های بهترین کیف پول غیر متمرکز سولانا (سولمینت)

در دنیای کریپتوکارنسی، امنیت حرف اول را می‌زند. کاربران ایرانی همواره با چالش تحریم و خطر مسدود شدن حساب‌ها در صرافی‌ها و کیف‌پول‌های متمرکز روبه‌رو بوده‌اند. **کیف پول سولمینت (Solmint App)** به عنوان یک **کیف پول غیرامانی ایرانی**، این مشکل را به طور ۱۰۰٪ ریشه‌ای حل کرده است.

## چرا سولمینت امن‌ترین کیف پول غیرامانی است؟

۱. **ذخیره‌سازی ۱۰۰٪ محلی (Local Encryption):** عبارت‌های ۱۲ کلمه‌ای یا ۲۴ کلمه‌ای بازیابی شما با الگوریتم AES-256 روی پردازنده گوشی رمزنگاری می‌شوند و هرگز از دستگاه شما خارج نمی‌شوند.
۲. **عدم وابستگی به سرور مرکزی:** تمام درخواست‌ها و تراکنش‌ها مستقیماً بین گوشی شما و نودهای بلاک‌چین سولانا ردوبدل می‌شوند.
۳. **مجموعه کامل ابزارهای وب۳:** نیازی به نصب اپلیکیشن‌های متعدد ندارید؛ ساخت توکن بدون کدنویسی، ساخت میم کوین، ضرب NFT، سواپ توکن‌ها و بازیابی کارمزد اجاره همگی در کیف پول سولمینت یکجا فراهم شده است.
    `,
    coverImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    author: {
      name: 'مریم حسینی',
      role: 'تحلیل‌گر امنیت بلاک‌چین',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80'
    },
    publishedAt: '۱۴۰۴/۰۵/۰۳',
    publishedAtJalali: '۱۴۰۴/۰۵/۰۳',
    publishedAtGregorian: '2025/07/25',
    readTimeMinutes: 4,
    viewsCount: 3120,
    comments: [],
    seoScore: 97
  },
  {
    id: 'art-1',
    title: 'راهنمای جامع بازیابی کارمزد اجاره (Rent Exemption) در اکوسیستم سولانا',
    slug: 'solana-rent-recovery-guide',
    category: 'آموزش سولانا',
    tags: ['سولانا', 'بازیابی کارمزد', 'Rent Exemption', 'مدیریت کیف پول'],
    summary: 'چگونه می‌توان سولانای قفل شده در حساب‌های توکن خالی (Associated Token Accounts) را شناسایی و بازپس گرفت؟ بررسی کامل فرآیند بازیابی غیرامانی.',
    content: `
# راهنمای کامل بازیابی SOL قفل شده در حساب‌های خالی سولانا

در شبکه سولانا، هر زمان که یک توکن جدید (مانند USDC، BONK یا هر توکن SPL دیگر) دریافت می‌کنید، شبکه یک حساب فرعی به نام **Associated Token Account (ATA)** ایجاد می‌کند. برای نگهداری داده‌های این حساب روی بلاک‌چین، مقداری سولانا (معمولاً حدود ۰.۰۰۲۰۳۹ SOL) به عنوان **کارمزد اجاره یا Rent Exemption** قفل می‌شود.

## چرا کارمزد اجاره قفل می‌شود؟
معماری بلاک‌چین سولانا طوری طراحی شده است که ولیدیتورها داده‌ها را در حافظه RAM نگهداری کنند. برای جلوگیری از اسپم حساب‌های بی‌مصرف، سپرده‌ای از جنس SOL در حساب قفل می‌شود. اگر موجودی توکن آن حساب صفر شود و شما دیگر به آن نیاز نداشته باشید، این سپرده SOL همچنان معلق باقی می‌ماند!

## چگونه با سولمینت سولانای قفل‌شده را بازیابی کنیم؟
با استفاده از ابزار **Rent Recovery در پلتفرم سولمینت (solmint.ir)**، آدرس کیف پول شما به‌طور هوشمند اسکن می‌شود:
۱. حساب‌های توکنی که موجودی آن‌ها **صفر** است شناسایی می‌شوند.
۲. دستور بستن حساب (\`CloseAccount\`) آماده می‌شود.
۳. با امضای شما، تمام SOLهای قفل‌شده فوراً به موجودی اصلی کیف پول شما بازمی‌گردد.
    `,
    coverImage: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    author: {
      name: 'آزاد آذرخش',
      role: 'توسعه‌دهنده ارشد وب۳ سولمینت',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    },
    publishedAt: '۱۴۰۴/۰۵/۰۲',
    publishedAtJalali: '۱۴۰۴/۰۵/۰۲',
    publishedAtGregorian: '2025/07/24',
    readTimeMinutes: 5,
    viewsCount: 1420,
    comments: [
      {
        id: 'c-1',
        userName: 'امیرحسین رضایی',
        text: 'عالی بود! من حدود ۰.۰۵ SOL قفل شده داشتم که با این ابزار آزادش کردم. ممنون از تیم سولمینت.',
        createdAt: '۱۴۰۴/۰۵/۰۳',
        createdAtJalali: '۱۴۰۴/۰۵/۰۳',
        createdAtGregorian: '2025/07/25',
        approved: true
      }
    ],
    seoScore: 92
  }
];

export const INITIAL_MEDIA_ITEMS: MediaItem[] = [
  {
    id: 'm-1',
    name: 'solana-network-banner.jpg',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    uploadedAt: '۱۴۰۴/۰۵/۰۱',
    sizeMb: 1.2
  },
  {
    id: 'm-2',
    name: 'security-vault.jpg',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    uploadedAt: '۱۴۰۴/۰۴/۲۵',
    sizeMb: 0.9
  },
  {
    id: 'm-3',
    name: 'solana-tutorial-demo.mp4',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    uploadedAt: '۱۴۰۴/۰۵/۰۲',
    sizeMb: 14.5
  }
];
