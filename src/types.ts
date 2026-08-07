export interface SolanaStatus {
  price: number;
  change24h: number;
  tps: number;
  avgFeeUsd: number;
  avgFeeSol: number;
  status: string;
  slot: number;
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
  category: 'آموزش سولانا' | 'توسعه وب۳' | 'امنیت' | 'اخبار و تحلیل' | 'آموزش ساخت میم کوین' | 'آموزش ساخت NFT' | 'کیف پول سولانا' | 'ترید' | 'پراپ تریدینگ';
  tags: string[];
  summary: string;
  content: string;
  coverImage: string;
  coverImageAssetId?: string;
  videoUrl?: string;
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
  id: string;
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
