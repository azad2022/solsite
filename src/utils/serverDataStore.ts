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
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename} to disk:`, err);
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
export interface ServerSettings {
  deepseek: {
    apiKey: string;
    baseUrl: string;
    model: string;
    defaultCategory: string;
    systemPrompt: string;
    autoPublishEnabled?: boolean;
    publishScheduleHours?: number;
    targetCategory?: string;
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
    baseUrl: 'https://api.gapgpt.app/v1',
    model: 'deepseek-chat',
    defaultCategory: 'آموزش سولانا',
    systemPrompt: 'شما نویسنده و تحلیل‌گر ارشد وب۳، بلاک‌چین و سولانا در رسانه تخصصی سولمینت (solmint.ir) هستید. مقالاتی کاملاً حرفه‌ای، جذاب و دقیق بنویسید.'
  },
  chatbot: {
    enabled: true,
    title: 'پشتیبان هوشمند سولمینت',
    initialMessage: 'سلام! چطور می‌توانم در زمینه ساخت توکن، میم‌کوین، NFT یا کیف پول سولانا به شما کمک کنم؟',
    systemPrompt: 'شما پشتیبان هوشمند پلتفرم سولمینت هستید.',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: 'https://api.gapgpt.app/v1',
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
    deepseek: { ...DEFAULT_SETTINGS.deepseek, ...(loaded.deepseek || {}) },
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
    deepseek: { ...current.deepseek, ...(newSettings.deepseek || {}) },
    chatbot: { ...current.chatbot, ...(newSettings.chatbot || {}) },
    downloads: { ...current.downloads, ...(newSettings.downloads || {}) },
    security: { ...current.security, ...(newSettings.security || {}) }
  };
  writeJsonFile('settings.json', updated);
  return updated;
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
