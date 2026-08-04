export interface SolanaStatus {
  price: number;
  change24h: number;
  tps: number;
  avgFeeUsd: number;
  avgFeeSol: number;
  status: string;
  slot: number;
}

export interface WalletTransaction {
  id: string;
  type: 'receive' | 'send' | 'airdrop' | 'rent_claim' | 'token_create' | 'nft_mint';
  amount: number;
  token: 'SOL' | 'USDC' | 'SMT';
  fromTo: string;
  timestamp: string;
  signature: string;
  status: 'confirmed' | 'pending';
}

export interface WalletState {
  address: string;
  solBalance: number;
  usdcBalance: number;
  smtBalance: number; // Solmint Token
  isConnected: boolean;
  transactions: WalletTransaction[];
}

export interface RentAccount {
  id: string;
  mintAddress: string;
  tokenName: string;
  tokenSymbol: string;
  balance: number;
  rentSol: number; // e.g. 0.00203928
  status: 'empty' | 'active';
  selected: boolean;
}

export type AdminPermission = 
  | 'articles' 
  | 'editor' 
  | 'comments' 
  | 'media' 
  | 'seo' 
  | 'downloads' 
  | 'deepseek' 
  | 'chatbot' 
  | 'database' 
  | 'security' 
  | 'users'
  | 'audit'
  | 'redirects';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  passwordHash: string;
  role: 'superadmin' | 'admin' | 'editor' | 'writer' | 'user';
  permissions?: AdminPermission[];
  isActive?: boolean;
  createdAt: string;
  createdAtJalali?: string;
  lastLogin?: string;
}

export interface ArticleComment {
  id: string;
  userName: string;
  userId?: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
  createdAtJalali?: string;
  createdAtGregorian?: string;
  approved?: boolean;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  category: 'آموزش سولانا' | 'توسعه وب۳' | 'امنیت' | 'اخبار و تحلیل' | 'آموزش ساخت میم کوین' | 'آموزش ساخت NFT' | 'کیف پول سولانا';
  tags: string[];
  summary: string;
  content: string;
  coverImage: string;
  coverImageAssetId?: string;
  videoUrl?: string; // MP4 video URL
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  publishedAt: string;
  publishedAtJalali?: string;
  publishedAtGregorian?: string;
  readTimeMinutes: number;
  viewsCount: number;
  comments: ArticleComment[];
  seoScore?: number;
  isDraft?: boolean;
}

export interface MediaAsset {
  id: string; // unique assetId
  provider: 'github';
  githubOwner: string;
  githubRepository: string;
  branch: string;
  path: string;
  filename: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  sha?: string;
  createdAt: string;
  updatedAt?: string;
  originalFilename: string;
  altText: string;
  title?: string;
  usageCount?: number;
  usedInArticleSlugs?: string[];
}

export interface MediaStorageConfig {
  provider: 'github';
  githubOwner: string;
  githubRepository: string;
  branch: string;
  basePath: string;
  connectionStatus?: 'connected' | 'disconnected' | 'untested';
  lastTestAt?: string;
}

export const DEFAULT_MEDIA_STORAGE_CONFIG: MediaStorageConfig = {
  provider: 'github',
  githubOwner: 'azad2022',
  githubRepository: 'solmint-media',
  branch: 'main',
  basePath: 'articles/',
  connectionStatus: 'untested'
};

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  uploadedAt: string;
  uploadedAtJalali?: string;
  uploadedAtGregorian?: string;
  sizeMb: number;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  comment: string;
  avatar: string;
  stars: number;
  createdAt: string;
  createdAtJalali?: string;
  createdAtGregorian?: string;
  approved?: boolean;
}

export interface DownloadLinks {
  apkUrl: string;
  telegramUrl: string;
  googlePlayUrl?: string;
  webAppUrl?: string;
  apkVersion?: string;
  downloadNotice?: string;
}

export const DEFAULT_DOWNLOAD_LINKS: DownloadLinks = {
  apkUrl: 'https://t.me/solmintchannel',
  telegramUrl: 'https://t.me/solmintchannel',
  googlePlayUrl: 'https://play.google.com/store/apps',
  webAppUrl: 'https://app.solmint.ir',
  apkVersion: 'v2.4.0',
  downloadNotice: 'تست شده با Play Protect گوگل و بدون نیاز به دسترسی‌های مشکوک'
};

export interface DeepSeekAiSettings {
  apiKey: string;
  apiKeyConfigured?: boolean;
  apiBaseUrl: string;
  model: string; // 'deepseek-chat' | 'deepseek-reasoner'
  systemPrompt: string;
  requireCoverImage?: boolean;
  targetTopics: string[];
  targetKeywords: string[];
  publishSchedule: {
    enabled: boolean;
    publishDays: string[]; // ['شنبه', 'دوشنبه', 'چهارشنبه']
    publishTime: string; // "10:00"
    publishMode?: 'published' | 'draft';
    autoPublishAsDraft: boolean; // false = publish immediately as public, true = save as draft
    timezone?: string; // e.g. "Asia/Tehran"
    intervalHours?: number;
  };
  mediaConfig: {
    includeCoverImage: boolean;
    requireCoverImage?: boolean;
    imageStyle: 'solana_theme' | 'cyberpunk_crypto' | 'tech_minimal' | '3d_gradient';
    includeVideo: boolean;
    defaultVideoUrl?: string;
  };
  writingStyle: {
    tone: 'آموزشی و روان' | 'تخصصی و فنی' | 'خبری و تحلیلی' | 'عامیانه و صمیمی';
    targetWordCount: number;
    includeFaqSection: boolean;
    includeCallToAction: boolean;
  };
  autoPublishEnabled?: boolean;
  publishScheduleHours?: number;
  lastAutoPublishedAt?: string;
  lastPublishedSlot?: string;
  lastExecutionStatus?: 'success' | 'error' | 'running';
  lastExecutionMessage?: string;
}

export const DEFAULT_DEEPSEEK_SETTINGS: DeepSeekAiSettings = {
  apiKey: '',
  apiKeyConfigured: false,
  apiBaseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  systemPrompt: `شما دستیار نویسنده ارشد وبسایت "سولمینت (Solmint App)" هستید - اولین و امن‌ترین کیف پول غیرامانی سولانا و پلتفرم ساخت توکن، میم کوین و بازیابی کارمزد اجاره (Rent Claim) در ایران.

دستورالعمل‌های تولید مقاله:
۱. مقاله باید کاملاً به زبان فارسی روان، جذاب، کاربردی و آموزنده نوشته شود.
۲. مقاله شامل یک ساختار کامل: عنوان جذاب و بدون عبارات اضافی، خلاصه مقاله (Meta Description)، متون اصلی با تیترهای H2 و H3 به صورت مارک‌داون، جدول یا نکات کلیدی، بخش سوالات متداول (FAQ) و دعوت به اقدام (CTA) جهت دانلود اپلیکیشن سولمینت باشد.
۳. حتماً از کلمات کلیدی سئو تعیین شده در طول متن به طور طبیعی استفاده کنید.
۴. لحن مقاله روان و کاربردی برای علاقه‌مندان به بلاکچین، ارز دیجیتال و سولانا باشد.
۵. قوانین اکید عنوان و محتوا: به هیچ عنوان کلماتی نظیر "مقاله سئو شده"، "آموزش سئو شده"، "سئو شده" یا نام‌های هوش مصنوعی (مانند DeepSeek) را در عنوان مقاله یا متن یا به عنوان نویسنده یا لینک وارد نکنید. فقط عنوان اصلی مقاله درج شود.`,
  requireCoverImage: false,
  targetTopics: [
    'آموزش جامع ساخت توکن در شبکه‌ی سولانا بدون کدنویسی',
    'راهنمای ساخت میم کوین با سولمینت و افزودن نقدینگی',
    'بازیابی کارمزد اجاره حساب‌های خالی سولانا (SOL Rent Claim)',
    'آموزش ضرب NFT با استاندارد Metaplex در اپلیکیشن موبایل',
    'بررسی امنیت کیف پول‌های غیرامانی و الگوریتم Ed25519',
    'مقایسه کارمزد و سرعت سولانا با اتریوم و تون‌کوین (TON)',
    'چگونه اولین آردراپ (Airdrop) خود را در بلاکچین سولانا دریافت کنیم؟'
  ],
  targetKeywords: [
    'سولمینت',
    'کیف پول سولانا',
    'ساخت توکن سولانا',
    'بازیابی اجاره SOL',
    'ساخت میم کوین',
    'کیف پول غیرامانی',
    'ضرب NFT سولانا',
    'برنامه سولمینت'
  ],
  publishSchedule: {
    enabled: true,
    publishDays: ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'],
    publishTime: '10:00',
    publishMode: 'published',
    autoPublishAsDraft: false,
    timezone: 'Asia/Tehran',
    intervalHours: 6
  },
  mediaConfig: {
    includeCoverImage: true,
    imageStyle: 'solana_theme',
    includeVideo: false,
    defaultVideoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-code-42898-large.mp4'
  },
  writingStyle: {
    tone: 'آموزشی و روان',
    targetWordCount: 1200,
    includeFaqSection: true,
    includeCallToAction: true
  }
};

export interface ChatbotSettings {
  enabled: boolean;
  apiKey?: string;
  apiBaseUrl?: string;
  botName: string;
  botAvatar: string;
  welcomeMessage: string;
  systemPrompt: string;
  suggestedQuestions: string[];
  placeholderText: string;
  model: string;
  maxHistoryTurns: number;
}

export const DEFAULT_CHATBOT_SETTINGS: ChatbotSettings = {
  enabled: true,
  apiKey: '',
  apiBaseUrl: 'https://api.deepseek.com/v1',
  botName: 'پشتیبان هوشمند سولمینت',
  botAvatar: '🤖',
  welcomeMessage: 'سلام! 👋 من دستیار هوشمند سولمینت هستم. چطور می‌توانم در زمینه ساخت توکن، کیف پول سولانا، یا بازیابی کارمزد اجاره (Rent Claim) به شما کمک کنم؟',
  systemPrompt: `شما "پشتیبان هوشمند رسمی وبسایت و اپلیکیشن سولمینت (Solmint App)" هستید - اولین و امن‌ترین کیف پول غیرامانی سولانا و پلتفرم ساخت توکن، میم کوین و بازیابی کارمزد اجاره (Rent Claim) در ایران.

دستورالعمل‌های پاسخ‌دهی به کاربران:
۱. پاسخ‌های شما باید بسیار محترمانه، صمیمی، دقیق، کاربردی و به زبان فارسی روان باشد.
۲. ویژگی‌های سولمینت:
  - ساخت توکن و میم‌کوین بدون نیاز به هیچ‌گونه کدنویسی یا سیستم خانگی (کاملاً با گوشی موبایل).
  - بازیابی کارمزد اجاره حساب‌های خالی سولانا (SOL Rent Claim) جهت بازگرداندن سولانای قفل شده.
  - کیف پول غیرامانی (Non-Custodial): کلیدهای خصوصی تنها روی دستگاه کاربر نگهداری می‌شوند.
  - ضرب NFT، انتقال سریع و کارمزد نزدیک به صفر.
۳. در صورت پرسش درباره لینک دانلود، کاربر را به کانال تلگرام رسمی @solmintchannel یا وبسایت solmint.ir راهنمایی کنید.
۴. از ایموجی‌های مناسب و فرمت‌بندی خوانا (بولت‌پوینت) استفاده کنید.`,
  suggestedQuestions: [
    'چگونه در سولمینت توکن بسازم؟',
    'بازیابی کارمزد اجاره (Rent Claim) چیست؟',
    'آیا سولمینت کلید خصوصی من را ذخیره می‌کند؟',
    'لینک دانلود مستقیم اپلیکیشن سولمینت'
  ],
  placeholderText: 'سوال خود را بپرسید...',
  model: 'deepseek-chat',
  maxHistoryTurns: 8
};


