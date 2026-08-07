export interface RouteSeoInfo {
  path: string;
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  ogImage?: string;
  h1: string;
  breadcrumbs: { name: string; url: string }[];
  is404?: boolean;
}

export const SITE_DOMAIN = 'https://solmint.ir';

export const ROUTES_SEO_MAP: Record<string, RouteSeoInfo> = {
  '/': {
    path: '/',
    title: 'سولمینت | اپلیکیشن غیرمتمرکز و کیف پول سولانا (SolMint.ir)',
    description: 'سولمینت رسمی‌ترین وب‌سایت و درگاه معرفی اپلیکیشن غیرمتمرکز سولانا. کیف پول غیرامانی، ساخت توکن SPL، ساخت میم کوین و مدیریت دارایی‌های وب۳ در اندروید.',
    canonical: `${SITE_DOMAIN}/`,
    ogType: 'website',
    ogImage: `${SITE_DOMAIN}/images/solmint-banner.jpg`,
    h1: 'پلتفرم غیرمتمرکز و اپلیکیشن سولانا سولمینت',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }]
  },
  '/solana-wallet': {
    path: '/solana-wallet',
    title: 'کیف پول سولانا (Solana Wallet) | غیرامانی، امن و فارسی - سولمینت',
    description: 'معرفی کیف پول غیرامانی سولانا در اپلیکیشن سولمینت. کلیدهای خصوصی در کنترل کامل کاربر روی حافظه امن دستگاه، مدیریت SOL، USDC و توکن‌های SPL.',
    canonical: `${SITE_DOMAIN}/solana-wallet`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/solana-wallet-og.jpg`,
    h1: 'کیف پول غیرامانی و امن سولانا در اپلیکیشن سولمینت',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'کیف پول سولانا', url: `${SITE_DOMAIN}/solana-wallet` }]
  },
  '/solana-token': {
    path: '/solana-token',
    title: 'ساخت توکن سولانا (SPL Token) | راهنما و ابزار اپلیکیشن - سولمینت',
    description: 'راهنمای کامل ساخت توکن سولانا روی استاندارد SPL بدون نیاز به دانش کدنویسی. نحوه ایجاد، ثبت متادیتا و مدیریت توکن در اپلیکیشن اندروید سولمینت.',
    canonical: `${SITE_DOMAIN}/solana-token`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/solana-token-og.jpg`,
    h1: 'آموزش و قابلیت ساخت توکن سولانا (SPL Token)',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'ساخت توکن سولانا', url: `${SITE_DOMAIN}/solana-token` }]
  },
  '/solana-meme-coin': {
    path: '/solana-meme-coin',
    title: 'ساخت میم کوین سولانا | ساخت ارز دیجیتال میم بدون کد - سولمینت',
    description: 'چگونه در شبکه سولانا میم کوین بسازیم؟ بررسی قابلیت‌های لانچ‌پد و ساخت میم کوین در اپلیکیشن اندروید سولمینت با کمترین کارمزد شبکه‌ای.',
    canonical: `${SITE_DOMAIN}/solana-meme-coin`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/meme-coin-og.jpg`,
    h1: 'راهنمای ساخت میم کوین در شبکه سولانا',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'ساخت میم کوین', url: `${SITE_DOMAIN}/solana-meme-coin` }]
  },
  '/solana-nft': {
    path: '/solana-nft',
    title: 'ساخت و مدیریت NFT سولانا | پلتفرم ان‌اف‌تی - سولمینت',
    description: 'مدیریت و ضرب (Mint) کلکسیون‌های NFT در شبکه سولانا از طریق اپلیکیشن موبایل سولمینت. نگهداری امن ان‌اف‌تی‌ها با پشتیبانی از استاندارد Metaplex.',
    canonical: `${SITE_DOMAIN}/solana-nft`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/solana-nft-og.jpg`,
    h1: 'مدیریت و ضرب NFT در شبکه قدرتمند سولانا',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'NFT سولانا', url: `${SITE_DOMAIN}/solana-nft` }]
  },
  '/app-guide': {
    path: '/app-guide',
    title: 'راهنمای کامل اپلیکیشن سولمینت | آموزش کیف پول، Swap، توکن، NFT و نقدینگی',
    description: 'راهنمای جامع استفاده از اپلیکیشن اندروید سولمینت؛ آموزش مرحله‌به‌مرحله کیف پول سولانا، ساخت توکن، Meme Coin، NFT، Swap، Burn، بازیابی Rent، انتقال گروهی و Raydium CPMM.',
    canonical: `${SITE_DOMAIN}/app-guide`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/solmint-banner.jpg`,
    h1: 'آموزش کامل اپلیکیشن سولمینت',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'راهنمای کامل اپلیکیشن', url: `${SITE_DOMAIN}/app-guide` }]
  },
  '/security': {
    path: '/security',
    title: 'معماری امنیتی غیرامانی سولمینت | حفظ و نگهداری کلید خصوصی',
    description: 'تشریح کامل معماری امنیتی غیرامانی سولمینت. ذخیره‌سازی محلی کلیدهای خصوصی و عبارت‌های بازیابی، امضای آفلاین تراکنش‌ها و عدم دسترسی سرور به دارایی‌ها.',
    canonical: `${SITE_DOMAIN}/security`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/security-og.jpg`,
    h1: 'معماری امنیتی و مدل غیرامانی اپلیکیشن سولمینت',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'امنیت و معماری', url: `${SITE_DOMAIN}/security` }]
  },
  '/download': {
    path: '/download',
    title: 'دانلود رسمی اپلیکیشن سولمینت اندروید (SolMint APK)',
    description: 'دانلود مستقیم آخرین نسخه اپلیکیشن اندروید سولمینت. دانلود امن فایل APK با هش تایید شده، راهنمای نصب و به‌روزرسانی اپلیکیشن غیرامانی سولانا.',
    canonical: `${SITE_DOMAIN}/download`,
    ogType: 'website',
    ogImage: `${SITE_DOMAIN}/images/download-og.jpg`,
    h1: 'دانلود مستقیم نسخه اندروید اپلیکیشن سولمینت',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'دانلود اپلیکیشن', url: `${SITE_DOMAIN}/download` }]
  },
  '/blog': {
    path: '/blog',
    title: 'وبلاگ و آکادمی آموزشی سولمینت | آموزش وب۳، سولانا و کریپتو',
    description: 'مقالات تخصصی و آموزش‌های جامع سولانا، ساخت توکن، مدیریت کیف پول غیرامانی، امنیت کریپتو و اخبار تحلیلی شبکه سولانا در آکادمی solmint.ir.',
    canonical: `${SITE_DOMAIN}/blog`,
    ogType: 'website',
    ogImage: `${SITE_DOMAIN}/images/blog-og.jpg`,
    h1: 'آکادمی و وبلاگ آموزشی سولمینت',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'وبلاگ آموزشی', url: `${SITE_DOMAIN}/blog` }]
  },
  '/faq': {
    path: '/faq',
    title: 'سوالات متداول سولمینت | پاسخ به پرسش‌های کلیدی اپلیکیشن',
    description: 'پاسخ به سوالات متداول درباره کیف پول، امنیت، ساخت توکن، Meme Coin، NFT، Swap، Burn، انتقال دارایی، نقدینگی، تراکنش‌ها و استفاده از اپلیکیشن اندروید سولمینت.',
    canonical: `${SITE_DOMAIN}/faq`,
    ogType: 'website',
    ogImage: `${SITE_DOMAIN}/images/faq-og.jpg`,
    h1: 'سوالات متداول و راهنمای کامل سولمینت',
    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'سوالات متداول', url: `${SITE_DOMAIN}/faq` }]
  }
};

type ArticleSeoData = {
  title: string;
  summary: string;
  slug: string;
  coverImage?: string;
  publishedAt?: string;
  publishedAtGregorian?: string;
  updatedAt?: string | null;
  author?: { name?: string; role?: string };
  category?: string;
  tags?: string[];
  content?: string;
};

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildArticleTitle(title: string): string {
  const cleanTitle = cleanText(title);
  if (!cleanTitle) return 'مقاله | سولمینت';
  if (/سولمینت|solmint/i.test(cleanTitle)) return cleanTitle;
  return `${cleanTitle} | سولمینت`;
}

function buildArticleDescription(summary: string, title: string): string {
  const fallback = `راهنمای تخصصی ${cleanText(title)} در وبلاگ سولمینت؛ آموزش، نکات کاربردی و اطلاعات مرتبط با سولانا و وب۳.`;
  const value = cleanText(summary) || fallback;
  return value.length > 180 ? `${value.slice(0, 177).trim()}...` : value;
}

function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  const normalized = raw.replace(/\//g, '-');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized}T00:00:00+03:30`;
  return undefined;
}

function countWords(content?: string): number | undefined {
  if (!content) return undefined;
  const text = cleanText(content);
  if (!text) return undefined;
  return text.split(/\s+/u).filter(Boolean).length;
}

export function getRouteSeoInfo(path: string, articleData?: ArticleSeoData): RouteSeoInfo {
  let info = ROUTES_SEO_MAP[path];

  if (!info && (path.startsWith('/article/') || path.startsWith('/blog/')) && articleData) {
    info = {
      path: `/article/${articleData.slug}`,
      title: buildArticleTitle(articleData.title),
      description: buildArticleDescription(articleData.summary, articleData.title),
      canonical: `${SITE_DOMAIN}/article/${articleData.slug}`,
      ogType: 'article',
      ogImage: articleData.coverImage || `${SITE_DOMAIN}/images/blog-og.jpg`,
      h1: articleData.title,
      breadcrumbs: [
        { name: 'خانه', url: `${SITE_DOMAIN}/` },
        { name: 'وبلاگ', url: `${SITE_DOMAIN}/blog` },
        { name: articleData.title, url: `${SITE_DOMAIN}/article/${articleData.slug}` }
      ]
    };
  }

  if (!info) {
    info = {
      path,
      title: 'صفحه مورد نظر یافت نشد (۴۰۴) | سولمینت',
      description: path.startsWith('/article/') || path.startsWith('/blog/')
        ? 'متأسفانه مقاله مورد نظر در آکادمی و وب‌سایت سولمینت یافت نشد.'
        : 'متأسفانه صفحه مورد نظر در آکادمی و وب‌سایت سولمینت یافت نشد.',
      canonical: `${SITE_DOMAIN}${path}`,
      ogType: 'website',
      ogImage: `${SITE_DOMAIN}/images/solmint-banner.jpg`,
      h1: path.startsWith('/article/') || path.startsWith('/blog/') ? '۴۰۴ - مقاله مورد نظر یافت نشد' : '۴۰۴ - صفحه مورد نظر یافت نشد',
      breadcrumbs: path.startsWith('/article/') || path.startsWith('/blog/')
        ? [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'وبلاگ', url: `${SITE_DOMAIN}/blog` }, { name: 'صفحه ۴۰۴', url: `${SITE_DOMAIN}${path}` }]
        : [{ name: 'خانه', url: `${SITE_DOMAIN}/` }, { name: 'صفحه ۴۰۴', url: `${SITE_DOMAIN}${path}` }],
      is404: true
    };
  }

  return info;
}

function setMetaProperty(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function setMetaName(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export function updateRouteSeo(path: string, articleData?: ArticleSeoData) {
  if (typeof document === 'undefined') return;

  const info = getRouteSeoInfo(path, articleData);
  document.title = info.title;

  setMetaName('description', info.description);
  setMetaName('robots', info.is404 ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  if (articleData?.author?.name) setMetaName('author', articleData.author.name);

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', info.canonical);

  setMetaProperty('og:title', info.title);
  setMetaProperty('og:description', info.description);
  setMetaProperty('og:url', info.canonical);
  setMetaProperty('og:type', info.ogType || 'website');
  setMetaProperty('og:site_name', 'سولمینت - SolMint');
  setMetaProperty('og:locale', 'fa_IR');
  setMetaProperty('og:image', info.ogImage || `${SITE_DOMAIN}/images/blog-og.jpg`);
  setMetaProperty('og:image:alt', articleData?.title || info.title);

  setMetaName('twitter:card', 'summary_large_image');
  setMetaName('twitter:title', info.title);
  setMetaName('twitter:description', info.description);
  setMetaName('twitter:url', info.canonical);
  setMetaName('twitter:image', info.ogImage || `${SITE_DOMAIN}/images/blog-og.jpg`);

  if (articleData && info.ogType === 'article') {
    const published = toIsoDate(articleData.publishedAt || articleData.publishedAtGregorian);
    const modified = toIsoDate(articleData.updatedAt) || published;
    if (published) setMetaProperty('article:published_time', published);
    if (modified) setMetaProperty('article:modified_time', modified);
    if (articleData.category) setMetaProperty('article:section', articleData.category);
    (articleData.tags || []).slice(0, 8).forEach((tag, index) => setMetaProperty(`article:tag:${index}`, tag));
  }

  injectJsonLdSchema(info, articleData);
}

function injectJsonLdSchema(info: RouteSeoInfo, articleData?: ArticleSeoData) {
  const existingScript = document.getElementById('solmint-dynamic-jsonld');
  if (existingScript) existingScript.remove();

  const schemas: any[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_DOMAIN}#organization`,
      name: 'SolMint',
      alternateName: 'سولمینت',
      url: SITE_DOMAIN,
      logo: `${SITE_DOMAIN}/images/logo.png`,
      description: 'پلتفرم و مرجع آموزشی اپلیکیشن غیرامانی سولانا و ساخت توکن SPL'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_DOMAIN}#website`,
      name: 'سولمینت',
      url: SITE_DOMAIN,
      inLanguage: 'fa-IR',
      publisher: { '@id': `${SITE_DOMAIN}#organization` }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: info.breadcrumbs.map((b, idx) => ({
        '@type': 'ListItem', position: idx + 1, name: b.name, item: b.url
      }))
    }
  ];

  if (!info.is404 && articleData && info.ogType === 'article') {
    const published = toIsoDate(articleData.publishedAt || articleData.publishedAtGregorian);
    const modified = toIsoDate(articleData.updatedAt) || published;
    const articleSchema: any = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': `${info.canonical}#article`,
      url: info.canonical,
      headline: cleanText(articleData.title),
      description: buildArticleDescription(articleData.summary, articleData.title),
      image: [articleData.coverImage || `${SITE_DOMAIN}/images/blog-og.jpg`],
      author: {
        '@type': 'Organization',
        name: articleData.author?.name || 'تیم تحریریه سولمینت'
      },
      publisher: { '@id': `${SITE_DOMAIN}#organization` },
      mainEntityOfPage: { '@type': 'WebPage', '@id': info.canonical },
      inLanguage: 'fa-IR'
    };
    if (published) articleSchema.datePublished = published;
    if (modified) articleSchema.dateModified = modified;
    if (articleData.category) articleSchema.articleSection = articleData.category;
    if (articleData.tags?.length) articleSchema.keywords = articleData.tags.slice(0, 8).join(', ');
    const wordCount = countWords(articleData.content);
    if (wordCount) articleSchema.wordCount = wordCount;
    schemas.push(articleSchema);
  }

  if (!info.is404 && info.path === '/faq') {
    const faqQuestions = [
      ['اپلیکیشن سولمینت (SolMint) چیست و چه کارهایی می‌توان با آن انجام داد؟', 'سولمینت یک اپلیکیشن اندرویدی برای کار با شبکه Solana است که قابلیت‌هایی مانند کیف پول غیرامانی، مدیریت SOL و توکن‌ها، ساخت توکن، ساخت Meme Coin، ساخت و Mint NFT، Swap، سوزاندن توکن، بازیابی Rent، انتقال گروهی دارایی‌ها، ایجاد استخر CPMM و مدیریت برخی عملیات مرتبط با نقدینگی را در یک محیط واحد ارائه می‌کند.'],
      ['آیا سولمینت یک کیف پول غیرامانی (Non-Custodial) است؟', 'بله. مدل کیف پول سولمینت غیرامانی است؛ یعنی کنترل کلیدهای کیف پول و امضای تراکنش‌ها در اختیار کاربر باقی می‌ماند و عملیات بلاکچینی از طریق دستگاه کاربر انجام می‌شود.'],
      ['چگونه در سولمینت کیف پول سولانا ایجاد یا بازیابی کنم؟', 'پس از ورود به بخش کیف پول، می‌توانید فرآیند ایجاد کیف پول یا بازیابی کیف پول موجود را دنبال کنید. اطلاعات بازیابی را با دقت و به‌صورت آفلاین نگهداری کنید و هرگز عبارت بازیابی یا کلید خصوصی را در اختیار شخص دیگری قرار ندهید.'],
      ['آیا برای استفاده از سولمینت باید عبارت بازیابی یا کلید خصوصی خود را در وب‌سایت وارد کنم؟', 'خیر. وب‌سایت solmint.ir برای معرفی و آموزش است. اطلاعات حساس کیف پول را در وب‌سایت، پیام‌رسان‌ها، فرم‌های ناشناس یا برای پشتیبانی ارسال نکنید.'],
      ['اگر گوشی من گم یا خراب شود، چگونه کیف پولم را بازیابی کنم؟', 'بازیابی کیف پول به اطلاعات بازیابی آن وابسته است. بدون اطلاعات لازم برای بازیابی، هیچ سرویس غیرامانی نمی‌تواند مالکیت کیف پول را برای شما بازگرداند.'],
      ['آیا می‌توانم بدون برنامه‌نویسی در سولمینت توکن سولانا بسازم؟', 'بله. بخش ساخت توکن برای ایجاد توکن روی شبکه Solana طراحی شده است و اطلاعاتی مانند نام، نماد، عرضه و تعداد اعشار را در فرآیند ایجاد در اختیار شما قرار می‌دهد.'],
      ['هنگام ساخت توکن چه اطلاعاتی باید تعیین کنم؟', 'بسته به نوع توکن و گزینه‌های فعال، اطلاعاتی مانند نام توکن، Symbol، Supply، Decimals و اطلاعات Metadata و تصویر توکن مورد نیاز است.'],
      ['چگونه با سولمینت یک Meme Coin روی Solana ایجاد کنم؟', 'در بخش Meme Coin اطلاعات اصلی پروژه مانند نام، نماد، تصویر و پارامترهای توکن را تعیین می‌کنید، سپس تراکنش‌های لازم ساخته و پس از بررسی توسط کاربر امضا می‌شوند.'],
      ['Mint Authority و Freeze Authority در توکن سولانا چه اهمیتی دارند؟', 'Mint Authority تعیین می‌کند چه حسابی اختیار ایجاد واحدهای جدید توکن را دارد و Freeze Authority می‌تواند در شرایط مربوط به Token Program برای حساب‌های توکن محدودیت ایجاد کند.'],
      ['آیا می‌توان با سولمینت NFT روی شبکه Solana ساخت و Mint کرد؟', 'بله. بخش NFT سولمینت برای ایجاد و Mint دارایی‌های NFT در اکوسیستم Solana طراحی شده است.'],
      ['برای ساخت NFT چه اطلاعاتی لازم است؟', 'معمولاً به اطلاعاتی مانند نام اثر، تصویر یا فایل مربوط به اثر، توضیحات و اطلاعات Metadata نیاز دارید.'],
      ['Swap در سولمینت چیست و چگونه کار می‌کند؟', 'بخش Swap برای تبدیل یک دارایی Solana به دارایی دیگر از مسیرهای نقدینگی و زیرساخت Jupiter طراحی شده است. کاربر توکن ورودی، توکن مقصد و مقدار را انتخاب می‌کند، Quote را بررسی می‌کند و پس از تأیید تراکنش را امضا و ارسال می‌کند.'],
      ['قبل از انجام Swap چه مواردی را باید بررسی کنم؟', 'توکن ورودی و خروجی، مقدار Swap، Quote، Slippage، کارمزد شبکه و مقدار SOL موردنیاز را بررسی کنید و در موارد حساس آدرس Mint توکن‌ها را کنترل کنید.'],
      ['قابلیت Burn در سولمینت چه کاربردی دارد؟', 'Burn برای سوزاندن واحدهای یک توکن و کاهش موجودی آن Token Account طراحی شده است.'],
      ['آیا می‌توان چند توکن را به‌صورت گروهی Burn کرد؟', 'بله. سولمینت قابلیت Batch Burn را برای پردازش چند Token Account فراهم می‌کند.'],
      ['Rent Recovery در سولانا چیست و سولمینت چگونه از آن استفاده می‌کند؟', 'وقتی یک Token Account دیگر موردنیاز نیست و شرایط بسته‌شدن آن فراهم باشد، بستن حساب می‌تواند SOL مرتبط با آن حساب را به مقصد مجاز بازگرداند.'],
      ['آیا سولمینت از انتقال گروهی SOL و توکن‌ها پشتیبانی می‌کند؟', 'بله. بخش انتقال گروهی برای ارسال SOL یا توکن‌ها به چند مقصد طراحی شده است.'],
      ['آیا می‌توان با سولمینت استخر نقدینگی CPMM ایجاد کرد؟', 'بله. سولمینت بخشی برای کار با استخرهای CPMM در اکوسیستم Raydium دارد.'],
      ['LP Token چیست و چه ارتباطی با استخر نقدینگی دارد؟', 'LP Token معمولاً نماینده سهم کاربر در یک استخر نقدینگی است و مدیریت آن باید با دقت انجام شود.'],
      ['چگونه وضعیت تراکنش‌های سولمینت را بررسی کنم؟', 'پس از ارسال تراکنش، Signature را می‌توانید برای پیگیری وضعیت آن در شبکه Solana استفاده کنید. سولمینت همچنین بخش تاریخچه تراکنش‌ها را در اختیار کاربر قرار می‌دهد.'],
      ['کارمزد استفاده از سولمینت چقدر است؟', 'هزینه نهایی هر عملیات به نوع تراکنش، وضعیت شبکه Solana، عملیات پروتکل‌های شخص ثالث و پارامترهای همان سرویس بستگی دارد.'],
      ['اگر یک تراکنش در سولمینت ناموفق شود چه کاری انجام دهم؟', 'ابتدا Signature تراکنش و وضعیت آن روی شبکه بررسی کنید، سپس موجودی SOL، Token Account، حساب مقصد، مقدار دارایی و پارامترهای عملیات را بررسی کنید.'],
      ['چرا یک توکن در کیف پول من نمایش داده نمی‌شود؟', 'نمایش توکن به وجود Token Account مناسب، اطلاعات Mint، وضعیت شبکه و اطلاعات دریافت‌شده از RPC وابسته است.'],
      ['آیا سولمینت می‌تواند دارایی‌های کیف پول من را بدون اجازه من منتقل کند؟', 'در مدل غیرامانی، انتقال دارایی‌های متعلق به کیف پول به امضای معتبر تراکنش نیاز دارد. همیشه جزئیات تراکنش و مقصد را قبل از امضا بررسی کنید.'],
      ['اپلیکیشن سولمینت را از کجا دانلود کنم؟', 'برای کاهش ریسک دریافت نسخه جعلی، نسخه رسمی اپلیکیشن را فقط از مسیرهای دانلود رسمی معرفی‌شده در وب‌سایت solmint.ir دریافت کنید.'],
      ['سولمینت روی کدام شبکه کار می‌کند؟', 'قابلیت‌های اصلی اپلیکیشن برای شبکه Solana طراحی شده‌اند.'],
      ['آیا برای استفاده از قابلیت‌های سولمینت آموزش مرحله‌به‌مرحله وجود دارد؟', 'بله. در وب‌سایت solmint.ir بخش «راهنمای کامل اپلیکیشن» برای آموزش استفاده از قابلیت‌های اصلی اپلیکیشن در نظر گرفته شده است.'],
      ['تفاوت کیف پول غیرامانی سولمینت با یک صرافی متمرکز چیست؟', 'در کیف پول غیرامانی، کاربر کنترل کلیدهای کیف پول و امضای تراکنش‌ها را در اختیار دارد؛ در یک صرافی متمرکز معمولاً دارایی‌ها تحت زیرساخت و حساب‌های آن سرویس نگهداری می‌شوند.']
    ];

    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${info.canonical}#faq`,
      mainEntity: faqQuestions.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer
        }
      }))
    });
  }

  const script = document.createElement('script');
  script.id = 'solmint-dynamic-jsonld';
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schemas);
  document.head.appendChild(script);
}
