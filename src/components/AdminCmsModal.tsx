import React, { useState, useEffect } from 'react';
import { 
  Article, 
  MediaItem, 
  Testimonial, 
  ArticleComment, 
  UserAccount, 
  AdminPermission, 
  DownloadLinks, 
  DEFAULT_DOWNLOAD_LINKS, 
  DeepSeekAiSettings, 
  DEFAULT_DEEPSEEK_SETTINGS, 
  ChatbotSettings, 
  DEFAULT_CHATBOT_SETTINGS,
  MediaAsset,
  MediaStorageConfig,
  DEFAULT_MEDIA_STORAGE_CONFIG
} from '../types';
import { generateArticleWithDeepSeek, testDeepSeekConnection, batchTestDeepSeekKeys, getRandomCoverForCategoryOrTitle, cleanArticleTitle, cleanArticleContent, triggerServerAutoPublish, fetchServerDeepseekLogs, clearServerDeepseekLogs } from '../utils/deepseekService';
import { generateSlugFromTitle, DEFAULT_ARTICLE_AUTHOR } from '../utils/slugUtils';
import {
  fetchCmsSettingsFromApi,
  saveCmsSettingsToApi,
  registerUserApi,
  loginUserApi,
  fetchUsersApi,
  updateUserApi,
  deleteUserApi,
  deleteCommentApi,
  saveArticleToApi,
  deleteArticleFromApi,
  fetchArticlesFromApi
} from '../utils/cmsApiClient';
import { 
  saveArticleToActiveDatabase, 
  deleteArticleFromActiveDatabase,
  fetchArticlesFromActiveDatabase, 
  getDatabaseConfig, 
  saveDatabaseConfig, 
  testDatabaseConnection, 
  CLOUDFLARE_D1_ARTICLES_SQL, 
  DatabaseConfig,
  DatabaseProvider
} from '../utils/databaseService';
import { 
  uploadMediaAsset, 
  getAllMediaAssets, 
  deleteMediaAsset, 
  getMediaStorageConfig, 
  saveMediaStorageConfig, 
  testMediaRepositoryConnection, 
  migrateMediaRepository,
  generateSeoFilename
} from '../utils/mediaService';
import { SUPABASE_ARTICLES_TABLE_SQL } from '../utils/supabaseClient';
import { UserAccountWelcome } from './UserAccountWelcome';
import { ProArticleEditor } from './ProArticleEditor';
import { 
  formatAccurateDates, 
  convertShamsiToGregorian, 
  convertGregorianToShamsi,
  toPersianDigits 
} from '../utils/dateUtils';
import { 
  safeGetLocalStorage, 
  safeSetLocalStorage, 
  sanitizeText, 
  validateUsername, 
  validatePassword 
} from '../utils/security';
import { 
  Lock, 
  Key, 
  Activity,
  Plus, 
  Edit3, 
  Trash2, 
  Sparkles, 
  ShieldAlert, 
  FileText, 
  Image as ImageIcon, 
  Globe, 
  Check, 
  Database,
  Server, 
  X, 
  Video, 
  BarChart2, 
  Zap, 
  Download,
  Copy,
  MessageSquare,
  Star,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  LogOut,
  User,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  BookOpen,
  Calendar,
  Send,
  Play,
  Smartphone,
  RotateCcw,
  Sliders,
  Link as LinkIcon,
  Bot,
  Wand2,
  Brain,
  Cpu,
  Settings2,
  Tag,
  Upload,
  FolderGit2,
  Search,
  Filter,
  ExternalLink,
  FolderSync,
  Image,
  FileImage,
  Layers,
  HardDrive,
  AlertCircle
} from 'lucide-react';

const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'articles',
  'editor',
  'comments',
  'media',
  'seo',
  'audit',
  'redirects',
  'downloads',
  'deepseek',
  'chatbot',
  'database',
  'security',
  'users'
];

const PERMISSION_LABELS: Record<AdminPermission, { title: string; desc: string; icon: string; sensitive?: boolean }> = {
  articles: { title: 'مدیریت و انتشار مقالات', desc: 'مشاهده، ویرایش و حذف مقالات وبلاگ', icon: '📄' },
  editor: { title: 'ایجاد مقاله جدید', desc: 'دسترسی به نگارش مقاله دستی و تولید AI', icon: '✍️' },
  comments: { title: 'مدیریت نظرات', desc: 'تایید، پاسخ و حذف دیدگاه‌های کاربران', icon: '💬' },
  media: { title: 'کتابخانه رسانه', desc: 'آپلود و مدیریت تصاویر و ویدیوها', icon: '🖼️' },
  seo: { title: 'سئو و پیکربندی', desc: 'کنسول گوگل، فاویکون و کلودفلر', icon: '🌐' },
  audit: { title: 'آودیت و تست سئو', desc: 'بررسی سلامت ساختار سئو، متاتگ‌ها و اسکیما', icon: '🔍' },
  redirects: { title: 'مدیریت 301 Redirects', desc: 'مدیریت ریدارکت‌های دائم و حفظ رتبه صفحات', icon: '↪️' },
  downloads: { title: 'لینک‌های دانلود', desc: 'تغییر لینک‌های دانلود مستقیم، APK و تلگرام', icon: '📥' },
  deepseek: { title: 'نویسنده DeepSeek AI', desc: 'تنظیمات و کلیدهای API تولید مقاله هوشمند', icon: '🤖', sensitive: true },
  chatbot: { title: 'تنظیمات چت‌بات AI', desc: 'پیکربندی هوش مصنوعی پشتیبانی', icon: '🤖', sensitive: true },
  database: { title: 'دیتابیس آنلاین', desc: 'اتصال به Supabase و Cloudflare D1', icon: '🗄️', sensitive: true },
  security: { title: 'امنیت پنل CMS', desc: 'رمز عبور ادمین و لاگین امنیتی', icon: '🛡️', sensitive: true },
  users: { title: 'مدیریت اعضا و دسترسی‌ها', desc: 'تعریف نویسندگان و تعیین سطوح دسترسی RBAC', icon: '👥', sensitive: true }
};

interface AdminCmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  mediaItems: MediaItem[];
  setMediaItems: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  testimonials: Testimonial[];
  setTestimonials: React.Dispatch<React.SetStateAction<Testimonial[]>>;
  currentUser: UserAccount | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserAccount | null>>;
  downloadLinks?: DownloadLinks;
  setDownloadLinks?: React.Dispatch<React.SetStateAction<DownloadLinks>>;
  deepseekSettings?: DeepSeekAiSettings;
  setDeepseekSettings?: React.Dispatch<React.SetStateAction<DeepSeekAiSettings>>;
  chatbotSettings?: ChatbotSettings;
  setChatbotSettings?: React.Dispatch<React.SetStateAction<ChatbotSettings>>;
  onGoToBlog?: () => void;
}

export const AdminCmsModal: React.FC<AdminCmsModalProps> = ({
  isOpen,
  onClose,
  articles,
  setArticles,
  mediaItems,
  setMediaItems,
  testimonials,
  setTestimonials,
  currentUser,
  setCurrentUser,
  downloadLinks,
  setDownloadLinks,
  deepseekSettings,
  setDeepseekSettings,
  chatbotSettings,
  setChatbotSettings,
  onGoToBlog
}) => {
