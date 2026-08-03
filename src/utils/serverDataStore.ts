import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`Error reading ${filename} from disk:`, err);
    return defaultValue;
  }
}

function writeJsonFile<T>(filename: string, data: T): boolean {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = path.join(DATA_DIR, `${filename}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`Error writing ${filename} to disk:`, err);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
    return false;
  }
}

// ------------------- USERS PERSISTENCE -------------------
export interface ServerUser {
  id: string;
  username: string;
  fullName: string;
  passwordHash: string;
  role: 'superadmin' | 'admin' | 'editor' | 'writer' | 'user';
  permissions?: string[];
  isActive?: boolean;
  createdAt: string;
}

const DEFAULT_ADMIN_USER: ServerUser = {
  id: 'admin-1',
  username: 'admin',
  fullName: 'مدیر ارشد پلتفرم (SuperAdmin)',
  passwordHash: 'e6b8c8d0e7e1f2a3', // Fallback identifier
  role: 'superadmin',
  permissions: ['articles', 'editor', 'comments', 'media', 'seo', 'downloads', 'deepseek', 'chatbot', 'security', 'database', 'users'],
  isActive: true,
  createdAt: '۱۴۰۴/۰۱/۰۱'
};

export function getAllUsers(): ServerUser[] {
  const users = readJsonFile<ServerUser[]>('users.json', [DEFAULT_ADMIN_USER]);
  if (!users.some(u => u.username === 'admin')) {
    users.unshift(DEFAULT_ADMIN_USER);
    writeJsonFile('users.json', users);
  }
  return users;
}

export function saveUsers(users: ServerUser[]): boolean {
  return writeJsonFile('users.json', users);
}

export function registerUser(newUser: ServerUser): { success: boolean; message: string; user?: ServerUser } {
  const users = getAllUsers();
  const cleanUsername = newUser.username.trim().toLowerCase();
  
  if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
    return { success: false, message: 'کاربری با این نام کاربری قبلاً ثبت‌نام کرده است.' };
  }

  users.push(newUser);
  saveUsers(users);
  return { success: true, message: 'ثبت‌نام با موفقیت در دیتابیس سرور انجام گردید.', user: newUser };
}

// ------------------- SETTINGS PERSISTENCE -------------------
export interface ServerAutoLog {
  id: string;
  timestamp: string;
  topic: string;
  status: 'success' | 'error';
  message: string;
  articleSlug?: string;
  articleTitle?: string;
}

export interface ServerSettings {
  deepseek: {
    apiKey: string;
    baseUrl: string;
    apiBaseUrl?: string;
    model: string;
    defaultCategory?: string;
    systemPrompt: string;
    targetTopics?: string[];
    targetKeywords?: string[];
    requireCoverImage?: boolean;
    publishSchedule?: {
      enabled: boolean;
      publishDays?: string[];
      publishTime?: string;
      autoPublishAsDraft?: boolean;
    };
    mediaConfig?: {
      includeCoverImage?: boolean;
      requireCoverImage?: boolean;
      imageStyle?: string;
      includeVideo?: boolean;
      defaultVideoUrl?: string;
    };
    writingStyle?: {
      tone?: string;
      targetWordCount?: number;
      includeFaqSection?: boolean;
      includeCallToAction?: boolean;
    };
    autoPublishEnabled?: boolean;
    publishScheduleHours?: number;
    lastAutoPublishedAt?: string;
    autoLogs?: ServerAutoLog[];
  };
  chatbot: {
    enabled: boolean;
    title: string;
    initialMessage: string;
    systemPrompt: string;
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  downloads: {
    apkUrl: string;
    directApkUrl: string;
    webAppUrl: string;
    iosPwaUrl: string;
  };
  security: {
    adminPasscode: string;
  };
}

const DEFAULT_SETTINGS: ServerSettings = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: 'https://api.deepseek.com/v1',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    defaultCategory: 'آموزش سولانا',
    systemPrompt: `شما نویسنده و تحلیل‌گر ارشد وب۳، بلاک‌چین و سولانا در رسانه تخصصی سولمینت (solmint.ir) هستید. مقالاتی کاملاً حرفه‌ای، جذاب، کاربردی و آموزنده به زبان فارسی بنویسید.
قوانین:
۱. از بکار بردن کلماتی نظیر "مقاله سئو شده"، "DeepSeek" یا "هوش مصنوعی" در عنوان مقاله جداً خودداری کنید.
۲. نویسنده مقاله فقط "تیم تحریریه سولمینت" است.`,
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
      publishDays: ['شنبه', 'دوشنبه', 'چهارشنبه'],
      publishTime: '10:00',
      autoPublishAsDraft: false
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
    },
    autoPublishEnabled: true,
    publishScheduleHours: 6,
    autoLogs: []
  },
  chatbot: {
    enabled: true,
    title: 'پشتیبان هوشمند سولمینت',
    initialMessage: 'سلام! چطور می‌توانم در زمینه ساخت توکن، میم‌کوین، NFT یا کیف پول سولانا به شما کمک کنم؟',
    systemPrompt: 'شما پشتیبان هوشمند پلتفرم سولمینت هستید.',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat'
  },
  downloads: {
    apkUrl: 'https://solmint.ir/app-release.apk',
    directApkUrl: 'https://solmint.ir/app-release.apk',
    webAppUrl: 'https://solmint.ir',
    iosPwaUrl: 'https://solmint.ir'
  },
  security: {
    adminPasscode: process.env.ADMIN_PASSCODE || 'solmint1404'
  }
};

export function getCmsSettings(): ServerSettings {
  const loaded = readJsonFile<ServerSettings>('settings.json', DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...loaded,
    deepseek: {
      ...DEFAULT_SETTINGS.deepseek,
      ...(loaded.deepseek || {}),
      publishSchedule: {
        ...DEFAULT_SETTINGS.deepseek.publishSchedule,
        ...(loaded.deepseek?.publishSchedule || {})
      },
      mediaConfig: {
        ...DEFAULT_SETTINGS.deepseek.mediaConfig,
        ...(loaded.deepseek?.mediaConfig || {})
      },
      writingStyle: {
        ...DEFAULT_SETTINGS.deepseek.writingStyle,
        ...(loaded.deepseek?.writingStyle || {})
      },
      autoLogs: loaded.deepseek?.autoLogs || []
    },
    chatbot: { ...DEFAULT_SETTINGS.chatbot, ...(loaded.chatbot || {}) },
    downloads: { ...DEFAULT_SETTINGS.downloads, ...(loaded.downloads || {}) },
    security: { ...DEFAULT_SETTINGS.security, ...(loaded.security || {}) }
  };
}

export function saveCmsSettings(newSettings: Partial<ServerSettings>): ServerSettings {
  const current = getCmsSettings();
  const updated: ServerSettings = {
    ...current,
    ...newSettings,
    deepseek: {
      ...current.deepseek,
      ...(newSettings.deepseek || {}),
      publishSchedule: {
        ...current.deepseek.publishSchedule,
        ...(newSettings.deepseek?.publishSchedule || {})
      },
      mediaConfig: {
        ...current.deepseek.mediaConfig,
        ...(newSettings.deepseek?.mediaConfig || {})
      },
      writingStyle: {
        ...current.deepseek.writingStyle,
        ...(newSettings.deepseek?.writingStyle || {})
      }
    },
    chatbot: { ...current.chatbot, ...(newSettings.chatbot || {}) },
    downloads: { ...current.downloads, ...(newSettings.downloads || {}) },
    security: { ...current.security, ...(newSettings.security || {}) }
  };
  writeJsonFile('settings.json', updated);
  return updated;
}

export function addDeepseekLog(log: Omit<ServerAutoLog, 'id' | 'timestamp'>): ServerAutoLog {
  const settings = getCmsSettings();
  const now = new Date();
  const jalaliDate = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'medium' }).format(now);
  const newLog: ServerAutoLog = {
    id: 'log_' + Date.now(),
    timestamp: jalaliDate,
    ...log
  };
  const logs = [newLog, ...(settings.deepseek.autoLogs || [])].slice(0, 50); // Keep last 50 logs
  saveCmsSettings({
    deepseek: {
      ...settings.deepseek,
      autoLogs: logs
    }
  });
  return newLog;
}

export function clearDeepseekLogs(): void {
  const settings = getCmsSettings();
  saveCmsSettings({
    deepseek: {
      ...settings.deepseek,
      autoLogs: []
    }
  });
}

// ------------------- COMMENTS PERSISTENCE -------------------
export interface ServerComment {
  id: string;
  articleId: string;
  userName: string;
  userId?: string;
  text: string;
  createdAt: string;
  approved?: boolean;
}

export function getAllComments(): ServerComment[] {
  return readJsonFile<ServerComment[]>('comments.json', []);
}

export function saveComment(comment: ServerComment): ServerComment[] {
  const comments = getAllComments();
  // If editing existing comment or adding new
  const index = comments.findIndex(c => c.id === comment.id);
  if (index >= 0) {
    comments[index] = comment;
  } else {
    comments.unshift(comment);
  }
  writeJsonFile('comments.json', comments);
  return comments;
}

export function deleteComment(commentId: string): ServerComment[] {
  const comments = getAllComments().filter(c => c.id !== commentId);
  writeJsonFile('comments.json', comments);
  return comments;
}

// ------------------- ARTICLES PERSISTENCE (SERVER FALLBACK) -------------------
export function getStoredArticles(): any[] {
  return readJsonFile<any[]>('articles.json', []);
}

export function saveArticleToDisk(article: any): any[] {
  const articles = getStoredArticles();
  const index = articles.findIndex(a => a.id === article.id || a.slug === article.slug);
  if (index >= 0) {
    articles[index] = { ...articles[index], ...article };
  } else {
    articles.unshift(article);
  }
  writeJsonFile('articles.json', articles);
  return articles;
}

export function deleteArticleFromDisk(articleIdOrSlug: string): any[] {
  const articles = getStoredArticles().filter(a => a.id !== articleIdOrSlug && a.slug !== articleIdOrSlug);
  writeJsonFile('articles.json', articles);
  return articles;
}
