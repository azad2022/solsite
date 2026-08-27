import { generateSlugFromTitle } from '../utils/slugUtils';

export type ArticleTaxonomyType = 'category' | 'tag';

export interface ArticleTaxonomyItem {
  slug: string;
  name: string;
  type: ArticleTaxonomyType;
}

export interface CategorySeoConfig {
  title: string;
  description: string;
  h1: string;
  intro: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
}

// Single source of truth for public taxonomy URLs.
// These slugs are part of the public URL contract and must not be derived
// differently by the client, SSR, sitemap, or API layers.
export const CATEGORY_SLUGS: Record<string, string> = {
  'آموزش سولانا': 'solana',
  'پروژه های سولانا': 'solana-projects',
  'توسعه وب۳': 'web3-development',
  'امنیت': 'security',
  'اخبار و تحلیل': 'crypto-news-analysis',
  'آموزش ساخت میم کوین': 'meme-coin',
  'آموزش ساخت NFT': 'nft',
  'کیف پول سولانا': 'solana-wallet',
  'ترید': 'trading',
  'پراپ تریدینگ': 'prop-trading',
  'میم کوین': 'meme-coins'
};

export const CATEGORY_SEO: Record<string, CategorySeoConfig> = {
  solana: {
    title: 'آموزش سولانا | راهنمای جامع سولانا، Web3 و اکوسیستم | سولمینت',
    description: 'آموزش سولانا از مفاهیم پایه تا کار با کیف پول، تراکنش، توکن و Web3؛ راهنماهای کاربردی برای یادگیری و استفاده امن از اکوسیستم سولانا.',
    h1: 'آموزش سولانا؛ راهنمای کاربردی اکوسیستم Solana',
    intro: 'در این بخش آموزش‌های سولانا را از مفاهیم پایه تا استفاده عملی دنبال می‌کنید؛ از کیف پول و تراکنش تا توکن، برنامه‌های غیرمتمرکز و ابزارهای اکوسیستم. مطالب با تمرکز بر آموزش قابل‌اجرا و نکات امنیتی تهیه می‌شوند.',
    primaryKeyword: 'آموزش سولانا',
    secondaryKeywords: ['سولانا چیست', 'آموزش Solana', 'آموزش شبکه سولانا', 'آموزش Web3']
  },
  'solana-projects': {
    title: 'پروژه های سولانا | معرفی و بررسی پروژه‌های اکوسیستم | سولمینت',
    description: 'معرفی و بررسی پروژه های سولانا در DeFi، DEX، کیف پول، زیرساخت، DePIN، NFT و پرداخت؛ با تمرکز بر کاربرد، وضعیت، داده و ریسک هر پروژه.',
    h1: 'پروژه های سولانا؛ معرفی و بررسی اکوسیستم',
    intro: 'این دسته برای شناخت پروژه‌های مهم سولانا ساخته شده است؛ از پروتکل‌های DeFi و صرافی‌های غیرمتمرکز تا زیرساخت، DePIN، کیف پول و پروژه‌های NFT. هر مطلب تلاش می‌کند کاربرد، مدل محصول، وضعیت اکوسیستم و ریسک‌های اصلی را جداگانه بررسی کند.',
    primaryKeyword: 'پروژه های سولانا',
    secondaryKeywords: ['پروژه های برتر سولانا', 'پروژه های اکوسیستم سولانا', 'بهترین پروژه های سولانا', 'پروژه های DeFi سولانا']
  },
  'web3-development': {
    title: 'توسعه وب۳ و سولانا | آموزش برنامه‌نویسی و ساخت dApp | سولمینت',
    description: 'آموزش توسعه وب۳ و سولانا برای ساخت dApp، کار با API، کیف پول، توکن و زیرساخت‌های غیرمتمرکز؛ با مثال‌های عملی برای توسعه‌دهندگان.',
    h1: 'توسعه وب۳ و سولانا؛ آموزش ساخت برنامه‌های غیرمتمرکز',
    intro: 'در این بخش به توسعه واقعی روی سولانا و Web3 می‌پردازیم؛ از اتصال کیف پول و کار با API تا ساخت dApp و درک زیرساخت‌های غیرمتمرکز. تمرکز اصلی روی مفاهیمی است که توسعه‌دهنده بتواند آن‌ها را در پروژه عملی استفاده کند.',
    primaryKeyword: 'توسعه وب۳',
    secondaryKeywords: ['توسعه سولانا', 'برنامه نویسی سولانا', 'ساخت dApp', 'آموزش Web3 Development']
  },
  security: {
    title: 'امنیت ارز دیجیتال و سولانا | کیف پول، تراکنش و Web3 | سولمینت',
    description: 'راهنمای امنیت ارز دیجیتال و سولانا؛ حفاظت از کیف پول، کلید خصوصی، عبارت بازیابی، تراکنش‌ها، قراردادها و مقابله با فیشینگ و کلاهبرداری.',
    h1: 'امنیت سولانا و ارز دیجیتال؛ راهنماهای عملی',
    intro: 'امنیت در Web3 فقط به انتخاب یک کیف پول محدود نیست. در این بخش تهدیدهای رایج، حفاظت از کلیدها و عبارت بازیابی، بررسی تراکنش و روش‌های مقابله با فیشینگ و کلاهبرداری را به‌صورت کاربردی بررسی می‌کنیم.',
    primaryKeyword: 'امنیت سولانا',
    secondaryKeywords: ['امنیت ارز دیجیتال', 'امنیت کیف پول سولانا', 'امنیت Web3', 'جلوگیری از کلاهبرداری ارز دیجیتال']
  },
  'crypto-news-analysis': {
    title: 'اخبار و تحلیل سولانا و بازار کریپتو | روندها و رویدادهای مهم | سولمینت',
    description: 'آخرین اخبار و تحلیل سولانا و بازار کریپتو؛ بررسی رویدادها، داده‌های بازار، روند قیمت و اتفاقات مهم اکوسیستم با تمرکز بر اطلاعات قابل‌اتکا.',
    h1: 'اخبار و تحلیل سولانا و بازار کریپتو',
    intro: 'در این دسته اخبار مهم سولانا و بازار کریپتو را با نگاه تحلیلی دنبال می‌کنیم؛ از رویدادهای شبکه و پروژه‌ها تا روند بازار و داده‌هایی که برای درک بهتر حرکت قیمت و فضای کلی اکوسیستم اهمیت دارند.',
    primaryKeyword: 'اخبار و تحلیل سولانا',
    secondaryKeywords: ['اخبار سولانا', 'تحلیل سولانا', 'اخبار ارز دیجیتال', 'تحلیل بازار کریپتو']
  },
  'meme-coin': {
    title: 'آموزش ساخت میم کوین روی سولانا | توکن، عرضه و نقدینگی | سولمینت',
    description: 'آموزش ساخت میم کوین روی سولانا؛ از ایجاد توکن و تنظیم اطلاعات تا عرضه، مدیریت نقدینگی و نکات فنی و امنیتی راه‌اندازی پروژه.',
    h1: 'آموزش ساخت میم کوین روی سولانا',
    intro: 'این بخش روی ساخت و مدیریت میم‌کوین در شبکه سولانا تمرکز دارد؛ از ایجاد توکن و آماده‌سازی اطلاعات تا ملاحظات عرضه، نقدینگی و امنیت. هدف، آموزش فرایند فنی بدون وعده سود یا توصیه سرمایه‌گذاری است.',
    primaryKeyword: 'آموزش ساخت میم کوین',
    secondaryKeywords: ['ساخت میم کوین در سولانا', 'ساخت توکن سولانا', 'ایجاد میم کوین', 'ساخت توکن SPL']
  },
  nft: {
    title: 'آموزش ساخت NFT روی سولانا | مینت، متاپلکس و مدیریت مجموعه | سولمینت',
    description: 'آموزش ساخت NFT روی سولانا؛ آشنایی با مینت، متاپلکس، متادیتا، کالکشن و مدیریت دارایی‌های NFT در اکوسیستم Solana.',
    h1: 'آموزش ساخت NFT روی سولانا',
    intro: 'در این دسته با فرایند ساخت و مدیریت NFT در اکوسیستم سولانا آشنا می‌شوید؛ از مفهوم مینت و متادیتا تا ابزارها و استانداردهای رایج و نکات مهم برای سازندگان و مجموعه‌داران.',
    primaryKeyword: 'آموزش ساخت NFT',
    secondaryKeywords: ['ساخت NFT در سولانا', 'Mint NFT سولانا', 'Metaplex', 'آموزش NFT سولانا']
  },
  'solana-wallet': {
    title: 'کیف پول سولانا | آموزش انتخاب، ساخت و امن‌سازی Wallet | سولمینت',
    description: 'راهنمای کیف پول سولانا؛ مقایسه کیف پول‌های رایج، ساخت و بازیابی Wallet، نگهداری امن SOL و اتصال به برنامه‌های Web3.',
    h1: 'کیف پول سولانا؛ انتخاب، ساخت و امنیت Wallet',
    intro: 'این بخش برای کاربرانی است که می‌خواهند کیف پول سولانا را درست انتخاب و امن استفاده کنند؛ از ساخت و بازیابی Wallet تا تفاوت کیف پول حضانتی و غیرحضانتی و اتصال به برنامه‌های Web3.',
    primaryKeyword: 'کیف پول سولانا',
    secondaryKeywords: ['بهترین کیف پول سولانا', 'ساخت کیف پول سولانا', 'کیف پول غیرامانی سولانا', 'امنیت کیف پول سولانا']
  },
  trading: {
    title: 'آموزش ترید سولانا و ارز دیجیتال | تحلیل تکنیکال و مدیریت ریسک | سولمینت',
    description: 'آموزش ترید سولانا و ارز دیجیتال؛ تحلیل تکنیکال، ساختار بازار، مدیریت ریسک و روش‌های بررسی سناریوهای معاملاتی بدون وعده سود قطعی.',
    h1: 'آموزش ترید سولانا و ارز دیجیتال',
    intro: 'در این بخش مفاهیم و ابزارهای ترید را با تمرکز بر بازار سولانا و دارایی‌های کریپتویی بررسی می‌کنیم؛ از تحلیل تکنیکال و ساختار بازار تا مدیریت ریسک و طراحی سناریوهای معاملاتی.',
    primaryKeyword: 'ترید سولانا',
    secondaryKeywords: ['آموزش ترید ارز دیجیتال', 'تحلیل تکنیکال سولانا', 'استراتژی ترید سولانا', 'مدیریت ریسک کریپتو']
  },
  'prop-trading': {
    title: 'پراپ تریدینگ | آموزش چالش فاند، قوانین و مدیریت ریسک | سولمینت',
    description: 'آموزش و بررسی پراپ تریدینگ؛ ساختار چالش‌های فاند، قوانین حساب، مدیریت ریسک و نکات مهم قبل از انتخاب یا استفاده از شرکت‌های پراپ.',
    h1: 'پراپ تریدینگ؛ آموزش، قوانین و مدیریت ریسک',
    intro: 'در این دسته ساختار پراپ تریدینگ و چالش‌های فاند را بررسی می‌کنیم؛ از قوانین رایج حساب و محدودیت‌های ریسک تا نکاتی که پیش از انتخاب یک شرکت پراپ باید در نظر گرفت.',
    primaryKeyword: 'پراپ تریدینگ',
    secondaryKeywords: ['چالش پراپ', 'حساب فاند شده', 'قوانین پراپ تریدینگ', 'مدیریت ریسک پراپ']
  },
  'meme-coins': {
    title: 'میم کوین‌های سولانا | بررسی، تحلیل و رصد پروژه‌های جدید | سولمینت',
    description: 'بررسی و تحلیل میم کوین‌های سولانا؛ رصد پروژه‌های جدید، کاربرد، نقدینگی، روند بازار و ریسک‌های مهم پیش از تصمیم‌گیری.',
    h1: 'میم کوین‌های سولانا؛ بررسی و تحلیل پروژه‌ها',
    intro: 'این بخش به خودِ بازار میم‌کوین‌ها اختصاص دارد؛ از پروژه‌های جدید و روندهای بازار تا بررسی نقدینگی، روایت پروژه و ریسک‌های مهم. هدف، ارائه اطلاعات برای تحقیق بیشتر است و نه توصیه خرید یا فروش.',
    primaryKeyword: 'میم کوین سولانا',
    secondaryKeywords: ['میم کوین های سولانا', 'میم کوین های جدید سولانا', 'بهترین میم کوین سولانا', 'تحلیل میم کوین']
  }
};

export function getArticleCategoryTaxonomy(category?: string | null): ArticleTaxonomyItem | null {
  const name = String(category || '').trim();
  if (!name) return null;
  return { slug: CATEGORY_SLUGS[name] || generateSlugFromTitle(name), name, type: 'category' };
}

export function getArticleTagTaxonomy(tags: string[] = []): ArticleTaxonomyItem[] {
  return Array.from(new Set(tags.map(tag => String(tag || '').trim()).filter(Boolean))).map(tag => ({
    slug: generateSlugFromTitle(tag),
    name: tag,
    type: 'tag'
  }));
}

export function buildTaxonomyUrl(item: ArticleTaxonomyItem): string {
  return item.type === 'category' ? `/blog/category/${encodeURIComponent(item.slug)}` : `/blog/tag/${encodeURIComponent(item.slug)}`;
}

export function getCanonicalCategorySlug(slug: string): string | null {
  const normalized = decodeURIComponent(String(slug || '')).trim().toLowerCase();
  const entry = Object.entries(CATEGORY_SLUGS).find(([, value]) => value === normalized);
  return entry ? entry[1] : null;
}

export function findCategoryNameBySlug(slug: string): string | null {
  const normalized = decodeURIComponent(String(slug || '')).trim().toLowerCase();
  const entry = Object.entries(CATEGORY_SLUGS).find(([, value]) => value === normalized);
  return entry ? entry[0] : null;
}

export function getCanonicalTagSlug(tag: string): string {
  return generateSlugFromTitle(String(tag || '').trim());
}
