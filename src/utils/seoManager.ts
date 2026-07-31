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
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` }
    ]
  },
  '/solana-wallet': {
    path: '/solana-wallet',
    title: 'کیف پول سولانا (Solana Wallet) | غیرامانی، امن و فارسی - سولمینت',
    description: 'معرفی کیف پول غیرامانی سولانا در اپلیکیشن سولمینت. کلیدهای خصوصی در کنترل کامل کاربر روی حافظه امن دستگاه، مدیریت SOL، USDC و توکن‌های SPL.',
    canonical: `${SITE_DOMAIN}/solana-wallet`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/solana-wallet-og.jpg`,
    h1: 'کیف پول غیرامانی و امن سولانا در اپلیکیشن سولمینت',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'کیف پول سولانا', url: `${SITE_DOMAIN}/solana-wallet` }
    ]
  },
  '/solana-token': {
    path: '/solana-token',
    title: 'ساخت توکن سولانا (SPL Token) | راهنما و ابزار اپلیکیشن - سولمینت',
    description: 'راهنمای کامل ساخت توکن سولانا روی استاندارد SPL بدون نیاز به دانش کدنویسی. نحوه ایجاد، ثبت متادیتا و مدیریت توکن در اپلیکیشن اندروید سولمینت.',
    canonical: `${SITE_DOMAIN}/solana-token`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/solana-token-og.jpg`,
    h1: 'آموزش و قابلیت ساخت توکن سولانا (SPL Token)',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'ساخت توکن سولانا', url: `${SITE_DOMAIN}/solana-token` }
    ]
  },
  '/solana-meme-coin': {
    path: '/solana-meme-coin',
    title: 'ساخت میم کوین سولانا | ساخت ارز دیجیتال میم بدون کد - سولمینت',
    description: 'چگونه در شبکه سولانا میم کوین بسازیم؟ بررسی قابلیت‌های لانچ‌پد و ساخت میم کوین در اپلیکیشن اندروید سولمینت با کمترین کارمزد شبکه‌ای.',
    canonical: `${SITE_DOMAIN}/solana-meme-coin`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/meme-coin-og.jpg`,
    h1: 'راهنمای ساخت میم کوین در شبکه سولانا',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'ساخت میم کوین', url: `${SITE_DOMAIN}/solana-meme-coin` }
    ]
  },
  '/solana-nft': {
    path: '/solana-nft',
    title: 'ساخت و مدیریت NFT سولانا | پلتفرم ان‌اف‌تی - سولمینت',
    description: 'مدیریت و ضرب (Mint) کلکسیون‌های NFT در شبکه سولانا از طریق اپلیکیشن موبایل سولمینت. نگهداری امن ان‌اف‌تی‌ها با پشتیبانی از استاندارد Metaplex.',
    canonical: `${SITE_DOMAIN}/solana-nft`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/solana-nft-og.jpg`,
    h1: 'مدیریت و ضرب NFT در شبکه قدرتمند سولانا',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'NFT سولانا', url: `${SITE_DOMAIN}/solana-nft` }
    ]
  },
  '/security': {
    path: '/security',
    title: 'معماری امنیتی غیرامانی سولمینت | حفظ و نگهداری کلید خصوصی',
    description: 'تشریح کامل معماری امنیتی غیرامانی سولمینت. ذخیره‌سازی محلی کلیدهای خصوصی و عبارت‌های بازیابی، امضای آفلاین تراکنش‌ها و عدم دسترسی سرور به دارایی‌ها.',
    canonical: `${SITE_DOMAIN}/security`,
    ogType: 'article',
    ogImage: `${SITE_DOMAIN}/images/security-og.jpg`,
    h1: 'معماری امنیتی و مدل غیرامانی اپلیکیشن سولمینت',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'امنیت و معماری', url: `${SITE_DOMAIN}/security` }
    ]
  },
  '/download': {
    path: '/download',
    title: 'دانلود رسمی اپلیکیشن سولمینت اندروید (SolMint APK)',
    description: 'دانلود مستقیم آخرین نسخه اپلیکیشن اندروید سولمینت. دانلود امن فایل APK با هش تایید شده، راهنمای نصب و به‌روزرسانی اپلیکیشن غیرامانی سولانا.',
    canonical: `${SITE_DOMAIN}/download`,
    ogType: 'website',
    ogImage: `${SITE_DOMAIN}/images/download-og.jpg`,
    h1: 'دانلود مستقیم نسخه اندروید اپلیکیشن سولمینت',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'دانلود اپلیکیشن', url: `${SITE_DOMAIN}/download` }
    ]
  },
  '/blog': {
    path: '/blog',
    title: 'وبلاگ و آکادمی آموزشی سولمینت | آموزش وب۳، سولانا و کریپتو',
    description: 'مقالات تخصصی و آموزش‌های جامع سولانا، ساخت توکن، مدیریت کیف پول غیرامانی، امنیت کریپتو و اخبار تحلیلی شبکه سولانا در آکادمی solmint.ir.',
    canonical: `${SITE_DOMAIN}/blog`,
    ogType: 'blog',
    ogImage: `${SITE_DOMAIN}/images/blog-og.jpg`,
    h1: 'آکادمی و وبلاگ آموزشی سولمینت',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'وبلاگ آموزشی', url: `${SITE_DOMAIN}/blog` }
    ]
  },
  '/faq': {
    path: '/faq',
    title: 'سوالات متداول سولمینت | پاسخ به پرسش‌های کلیدی اپلیکیشن',
    description: 'پاسخ به سوالات متداول درباره نحوه کارکرد اپلیکیشن سولمینت، امنیت کلیدهای خصوصی، ساخت توکن سولانا، بازیابی کیف پول و پشتیبانی.',
    canonical: `${SITE_DOMAIN}/faq`,
    ogType: 'website',
    ogImage: `${SITE_DOMAIN}/images/faq-og.jpg`,
    h1: 'سوالات متداول و راهنمای کامل سولمینت',
    breadcrumbs: [
      { name: 'خانه', url: `${SITE_DOMAIN}/` },
      { name: 'سوالات متداول', url: `${SITE_DOMAIN}/faq` }
    ]
  }
};

/**
 * Returns structured RouteSeoInfo for a given URL path and optional article
 */
export function getRouteSeoInfo(path: string, articleData?: { title: string; summary: string; slug: string; coverImage?: string }): RouteSeoInfo {
  let info = ROUTES_SEO_MAP[path];

  if (!info) {
    if (path.startsWith('/article/') || path.startsWith('/blog/')) {
      if (articleData) {
        info = {
          path: `/article/${articleData.slug}`,
          title: `${articleData.title} | وبلاگ و آموزش سولمینت`,
          description: articleData.summary,
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
      } else {
        info = {
          path,
          title: 'صفحه مورد نظر یافت نشد (۴۰۴) | سولمینت',
          description: 'متأسفانه مقاله یا صفحه مورد نظر در آکادمی و وب‌سایت سولمینت یافت نشد.',
          canonical: `${SITE_DOMAIN}${path}`,
          ogType: 'website',
          ogImage: `${SITE_DOMAIN}/images/solmint-banner.jpg`,
          h1: '۴۰۴ - مقاله مورد نظر یافت نشد',
          breadcrumbs: [
            { name: 'خانه', url: `${SITE_DOMAIN}/` },
            { name: 'وبلاگ', url: `${SITE_DOMAIN}/blog` },
            { name: 'صفحه ۴۰۴', url: `${SITE_DOMAIN}${path}` }
          ],
          is404: true
        };
      }
    } else {
      info = {
        path,
        title: 'صفحه مورد نظر یافت نشد (۴۰۴) | سولمینت',
        description: 'متأسفانه صفحه مورد نظر در آکادمی و وب‌سایت سولمینت یافت نشد.',
        canonical: `${SITE_DOMAIN}${path}`,
        ogType: 'website',
        ogImage: `${SITE_DOMAIN}/images/solmint-banner.jpg`,
        h1: '۴۰۴ - صفحه مورد نظر یافت نشد',
        breadcrumbs: [
          { name: 'خانه', url: `${SITE_DOMAIN}/` },
          { name: 'صفحه ۴۰۴', url: `${SITE_DOMAIN}${path}` }
        ],
        is404: true
      };
    }
  }

  return info;
}

/**
 * Updates browser DOM head metadata dynamically according to current route
 */
export function updateRouteSeo(path: string, articleData?: { title: string; summary: string; slug: string; coverImage?: string }) {
  if (typeof document === 'undefined') return;

  const info = getRouteSeoInfo(path, articleData);

  // 1. Title
  document.title = info.title;

  // 2. Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', info.description);

  // 3. Canonical URL
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', info.canonical);

  // 4. OpenGraph Meta Tags
  setMetaProperty('og:title', info.title);
  setMetaProperty('og:description', info.description);
  setMetaProperty('og:url', info.canonical);
  setMetaProperty('og:type', info.ogType || 'website');
  setMetaProperty('og:site_name', 'سولمینت - SolMint');
  setMetaProperty('og:locale', 'fa_IR');
  if (info.ogImage) {
    setMetaProperty('og:image', info.ogImage);
  }

  // 5. Inject JSON-LD Schema
  injectJsonLdSchema(info);
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

function injectJsonLdSchema(info: RouteSeoInfo) {
  // Remove existing dynamic script
  const existingScript = document.getElementById('solmint-dynamic-jsonld');
  if (existingScript) {
    existingScript.remove();
  }

  const schemas: any[] = [
    // Organization Schema
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "SolMint",
      "alternateName": "سولمینت",
      "url": SITE_DOMAIN,
      "logo": `${SITE_DOMAIN}/images/logo.png`,
      "description": "پلتفرم رسمی و مرجع آموزشی اپلیکیشن غیرامانی سولانا و ساخت توکن SPL"
    },
    // SoftwareApplication Schema (Android App explicitly)
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "SolMint Solana App",
      "alternateName": "اپلیکیشن اندروید سولمینت",
      "operatingSystem": "Android",
      "applicationCategory": "FinanceApplication",
      "downloadUrl": `${SITE_DOMAIN}/download`,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description": "اپلیکیشن غیرامانی سولانا برای مدیریت کیف پول، ساخت توکن SPL و میم کوین در سیستم‌عامل اندروید"
    },
    // BreadcrumbList Schema
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": info.breadcrumbs.map((b, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "name": b.name,
        "item": b.url
      }))
    }
  ];

  const script = document.createElement('script');
  script.id = 'solmint-dynamic-jsonld';
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schemas);
  document.head.appendChild(script);
}
