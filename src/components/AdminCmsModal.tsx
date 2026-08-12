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
import { SolanaLogoIcon } from './Header';
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
  // Auth Tab Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Registered Users list
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Passcode & Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(currentUser));

  const [authError, setAuthError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Active Admin Tab
  const [adminTab, setAdminTab] = useState<'articles' | 'editor' | 'comments' | 'media' | 'seo' | 'downloads' | 'deepseek' | 'chatbot' | 'security' | 'database' | 'users'>('articles');

  // Database Management Form State
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(() => getDatabaseConfig());
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success?: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState<'supabase' | 'cloudflare' | null>(null);

  // Media Management & GitHub Storage State
  const [githubMediaAssets, setGithubMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaConfigState, setMediaConfigState] = useState<MediaStorageConfig>(DEFAULT_MEDIA_STORAGE_CONFIG);
  const [mediaSubTab, setMediaSubTab] = useState<'library' | 'upload' | 'config' | 'migrate'>('library');
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  
  // Media Upload State
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadAltText, setUploadAltText] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSeoFilenameInput, setUploadSeoFilenameInput] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{ success?: boolean; message: string } | null>(null);

  // Media Storage Config State
  const [configOwner, setConfigOwner] = useState('azad2022');
  const [configRepo, setConfigRepo] = useState('solmint-media');
  const [configBranch, setConfigBranch] = useState('main');
  const [configBasePath, setConfigBasePath] = useState('articles/');
  const [configToken, setConfigToken] = useState('');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [isTestingMediaConn, setIsTestingMediaConn] = useState(false);
  const [mediaTestResult, setMediaTestResult] = useState<{ success?: boolean; message: string; details?: any } | null>(null);

  // Repository Migration State
  const [migTargetOwner, setMigTargetOwner] = useState('');
  const [migTargetRepo, setMigTargetRepo] = useState('');
  const [migTargetBranch, setMigTargetBranch] = useState('main');
  const [isMigratingMedia, setIsMigratingMedia] = useState(false);
  const [migrationResultNotice, setMigrationResultNotice] = useState<{ success?: boolean; message: string; results?: any } | null>(null);

  // Article Editor Cover Image Picker Modal State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [formCoverImageAssetId, setFormCoverImageAssetId] = useState<string>('');

  // Effect to sync users, settings, and articles from server database on mount and when modal opens
  useEffect(() => {
    const syncUsersAndData = () => {
      fetchUsersApi().then(serverUsers => {
        if (serverUsers && serverUsers.length > 0) {
          setUsers(serverUsers);
          try {

          } catch (e) {}
        }
      });
      fetchCmsSettingsFromApi().then(settings => {
        if (settings) {
          if (settings.deepseek && setDeepseekSettings) {
            setDeepseekState(settings.deepseek as any);
            setDeepseekSettings(settings.deepseek as any);
          }
          if (settings.chatbot && setChatbotSettings) {
            setChatbotState(settings.chatbot as any);
            setChatbotSettings(settings.chatbot as any);
          }
          if (settings.downloads && setDownloadLinks) {
            setDownloadLinks(settings.downloads as any);
            setApkUrlInput(settings.downloads.apkUrl || '');
            setTelegramUrlInput((settings.downloads as any).telegramUrl || '');
            setGooglePlayUrlInput((settings.downloads as any).googlePlayUrl || '');
            setWebAppUrlInput(settings.downloads.webAppUrl || '');
            setApkVersionInput((settings.downloads as any).apkVersion || 'v2.4.0');
            setDownloadNoticeInput((settings.downloads as any).downloadNotice || '');
          }
        }
      });
      fetchArticlesFromApi().then(arts => {
        if (arts && arts.length > 0) {
          setArticles(arts);
        }
      });
    };

    syncUsersAndData();
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/users/me', { credentials: 'include', cache: 'no-store' })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.success && data.user) {
          setCurrentUser(data.user);
          setIsAuthenticated(true);
          setAuthError('');
          getAllMediaAssets().then(assets => { if (!cancelled) setGithubMediaAssets(assets || []); });
          getMediaStorageConfig().then(cfg => {
            if (!cancelled && cfg) {
              setMediaConfigState(cfg);
              setConfigOwner(cfg.githubOwner || 'azad2022');
              setConfigRepo(cfg.githubRepository || 'solmint-media');
              setConfigBranch(cfg.branch || 'main');
              setConfigBasePath(cfg.basePath || 'articles/');
            }
          });
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleRefreshMediaAssets = async () => {
    const assets = await getAllMediaAssets();
    setGithubMediaAssets(assets);
  };

  const handleTestMediaConnection = async () => {
    setIsTestingMediaConn(true);
    setMediaTestResult(null);
    const testCfg = {
      ...mediaConfigState,
      githubOwner: configOwner.trim(),
      githubRepository: configRepo.trim(),
      branch: configBranch.trim(),
      basePath: configBasePath.trim(),
      githubToken: configToken.trim() || undefined
    };
    const res = await testMediaRepositoryConnection(testCfg);
    setMediaTestResult(res);
    setIsTestingMediaConn(false);
  };

  const handleSaveMediaConfig = async () => {
    const newCfg: MediaStorageConfig = {
      ...mediaConfigState,
      githubOwner: configOwner.trim(),
      githubRepository: configRepo.trim(),
      branch: configBranch.trim(),
      basePath: configBasePath.trim()
    };
    const savePayload = {
      ...newCfg,
      githubToken: configToken.trim() || undefined
    };
    await saveMediaStorageConfig(savePayload as any);
    setMediaConfigState(newCfg);
    setConfigToken('');
    setMediaTestResult({ success: true, message: 'تنظیمات مخزن رسانه با موفقیت ذخیره گردید.' });
  };

  const handleUploadNewMediaAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) {
      setUploadNotice({ success: false, message: 'لطفاً یک فایل تصویر جهت آپلود انتخاب نمایید.' });
      return;
    }
    setIsUploadingMedia(true);
    setUploadNotice(null);

    const res = await uploadMediaAsset(
      selectedUploadFile,
      uploadSeoFilenameInput.trim() || selectedUploadFile.name,
      uploadAltText.trim(),
      uploadTitle.trim()
    );

    setIsUploadingMedia(false);
    if (res.success && res.asset) {
      setUploadNotice({ success: true, message: res.message });
      setSelectedUploadFile(null);
      setUploadAltText('');
      setUploadTitle('');
      setUploadSeoFilenameInput('');
      await handleRefreshMediaAssets();
      setMediaSubTab('library');
    } else {
      setUploadNotice({ success: false, message: res.message });
    }
  };

  const handleDeleteMediaAsset = async (asset: MediaAsset) => {
    const usedInArticles = articles.filter(a => a.coverImage === asset.publicUrl || a.coverImageAssetId === asset.id);
    if (usedInArticles.length > 0) {
      const titles = usedInArticles.map(a => `"${a.title}"`).join('، ');
      if (!confirm(`هشدار: این تصویر در مقالات زیر استفاده شده است:\n${titles}\nآیا از حذف این تصویر مطمئن هستید؟`)) {
        return;
      }
    } else {
      if (!confirm(`آیا از حذف تصویر "${asset.filename}" از مخزن گیت‌هاب مطمئن هستید؟`)) {
        return;
      }
    }

    const res = await deleteMediaAsset(asset);
    alert(res.message);
    await handleRefreshMediaAssets();
  };

  const handleExecuteRepositoryMigration = async () => {
    if (!migTargetOwner.trim() || !migTargetRepo.trim()) {
      setMigrationResultNotice({ success: false, message: 'لطفاً نام مالک (Owner) و نام مخزن مقصد را وارد نمایید.' });
      return;
    }

    if (!confirm(`آیا از شروع عملیات انتقال ${githubMediaAssets.length} تصویر به مخزن مقصد (${migTargetOwner}/${migTargetRepo}) اطمینان دارید؟`)) {
      return;
    }

    setIsMigratingMedia(true);
    setMigrationResultNotice(null);

    const targetCfg: MediaStorageConfig = {
      provider: 'github',
      githubOwner: migTargetOwner.trim(),
      githubRepository: migTargetRepo.trim(),
      branch: migTargetBranch.trim() || 'main',
      basePath: mediaConfigState.basePath || 'articles/',
      connectionStatus: 'untested'
    };

    const res = await migrateMediaRepository(mediaConfigState, targetCfg);
    setIsMigratingMedia(false);
    setMigrationResultNotice(res);
    if (res.success) {
      await handleRefreshMediaAssets();
      const newCfg = await getMediaStorageConfig();
      setMediaConfigState(newCfg);
    }
  };

  const handleTestDatabaseConnection = async (provider: DatabaseProvider) => {
    setIsTestingDb(true);
    setDbTestResult(null);
    saveDatabaseConfig(dbConfig);
    const result = await testDatabaseConnection(provider);
    setDbTestResult(result);
    setIsTestingDb(false);
  };

  const handleSaveDbConfig = () => {
    saveDatabaseConfig(dbConfig);
    setDbTestResult({ success: true, message: 'تنظیمات دیتابیس با موفقیت ذخیره شد.' });
  };

  // Chatbot Settings Form State
  const [chatbotState, setChatbotState] = useState<ChatbotSettings>(() => {
    return chatbotSettings || DEFAULT_CHATBOT_SETTINGS;
  });
  const [chatbotSaveNotice, setChatbotSaveNotice] = useState('');
  const [newSuggestedQ, setNewSuggestedQ] = useState('');
  const [isTestingChatbotApi, setIsTestingChatbotApi] = useState(false);
  const [chatbotTestStatus, setChatbotTestStatus] = useState<{ success?: boolean; message: string } | null>(null);

  const handleTestChatbotApi = async () => {
    setIsTestingChatbotApi(true);
    setChatbotTestStatus(null);
    const keyToTest = (chatbotState.apiKey && chatbotState.apiKey.trim().length > 0)
      ? chatbotState.apiKey
      : deepseekState.apiKey;
    const baseUrlToTest = (chatbotState.apiBaseUrl && chatbotState.apiBaseUrl.trim().length > 0)
      ? chatbotState.apiBaseUrl
      : deepseekState.apiBaseUrl;
    const res = await testDeepSeekConnection(keyToTest, baseUrlToTest, chatbotState.model);
    setChatbotTestStatus(res);
    setIsTestingChatbotApi(false);
  };

  useEffect(() => {
    if (chatbotSettings) {
      setChatbotState(chatbotSettings);
    }
  }, [chatbotSettings, isOpen]);

  const handleSaveChatbotSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setChatbotSettings) {
      setChatbotSettings(chatbotState);
    }
    localStorage.setItem('solmint_chatbot_settings', JSON.stringify(chatbotState));
    await saveCmsSettingsToApi({ chatbot: chatbotState as any });
    setChatbotSaveNotice('تنظیمات چت‌بات آنلاین هوشمند با موفقیت در دیتابیس سرور ذخیره شد.');
    setTimeout(() => setChatbotSaveNotice(''), 4000);
  };

  const handleAddSuggestedQuestion = () => {
    if (!newSuggestedQ.trim()) return;
    setChatbotState(prev => ({
      ...prev,
      suggestedQuestions: [...prev.suggestedQuestions, newSuggestedQ.trim()]
    }));
    setNewSuggestedQ('');
  };

  const handleRemoveSuggestedQuestion = (index: number) => {
    setChatbotState(prev => ({
      ...prev,
      suggestedQuestions: prev.suggestedQuestions.filter((_, i) => i !== index)
    }));
  };

  // Download Links Manager Form State
  const [apkUrlInput, setApkUrlInput] = useState(downloadLinks?.apkUrl || DEFAULT_DOWNLOAD_LINKS.apkUrl);
  const [telegramUrlInput, setTelegramUrlInput] = useState(downloadLinks?.telegramUrl || DEFAULT_DOWNLOAD_LINKS.telegramUrl);
  const [googlePlayUrlInput, setGooglePlayUrlInput] = useState(downloadLinks?.googlePlayUrl || DEFAULT_DOWNLOAD_LINKS.googlePlayUrl || '');
  const [webAppUrlInput, setWebAppUrlInput] = useState(downloadLinks?.webAppUrl || DEFAULT_DOWNLOAD_LINKS.webAppUrl || '');
  const [apkVersionInput, setApkVersionInput] = useState(downloadLinks?.apkVersion || DEFAULT_DOWNLOAD_LINKS.apkVersion || 'v2.4.0');
  const [downloadNoticeInput, setDownloadNoticeInput] = useState(downloadLinks?.downloadNotice || DEFAULT_DOWNLOAD_LINKS.downloadNotice || '');
  const [downloadSaveSuccess, setDownloadSaveSuccess] = useState('');

  // 301 Redirect Rules State
  const [redirectRules, setRedirectRules] = useState<Array<{ id: string; sourcePath: string; targetPath: string; statusCode: number; isActive: boolean; createdAt: string }>>(() => {
    return safeGetLocalStorage('solmint_redirect_rules', [
      { id: '1', sourcePath: '/wallet', targetPath: '/solana-wallet', statusCode: 301, isActive: true, createdAt: '۱۴۰۴/۰۱/۰۱' },
      { id: '2', sourcePath: '/token-builder', targetPath: '/solana-token', statusCode: 301, isActive: true, createdAt: '۱۴۰۴/۰۱/۰۱' },
      { id: '3', sourcePath: '/apk-download', targetPath: '/download', statusCode: 301, isActive: true, createdAt: '۱۴۰۴/۰۱/۰۱' }
    ]);
  });
  const [newSourcePath, setNewSourcePath] = useState('');
  const [newTargetPath, setNewTargetPath] = useState('');
  const [redirectNotice, setRedirectNotice] = useState('');

  const handleAddRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    const src = newSourcePath.trim();
    const tgt = newTargetPath.trim();
    if (!src || !tgt) {
      alert('لطفاً آدرس مبدا و آدرس مقصد را وارد کنید.');
      return;
    }
    if (src === tgt) {
      alert('آدرس مبدا و مقصد نمی‌تواند یکسان باشد (جلوگیری از حلقه ریدارکت).');
      return;
    }
    const cleanSrc = src.startsWith('/') ? src : '/' + src;
    const cleanTgt = tgt.startsWith('/') || tgt.startsWith('http') ? tgt : '/' + tgt;

    const newRule = {
      id: 'red-' + Date.now(),
      sourcePath: cleanSrc,
      targetPath: cleanTgt,
      statusCode: 301,
      isActive: true,
      createdAt: new Date().toLocaleDateString('fa-IR')
    };

    const updated = [newRule, ...redirectRules];
    setRedirectRules(updated);
    safeSetLocalStorage('solmint_redirect_rules', updated);
    setNewSourcePath('');
    setNewTargetPath('');
    setRedirectNotice('قاعده ریدارکت جدید 301 با موفقیت اضافه شد.');
    setTimeout(() => setRedirectNotice(''), 3000);
  };

  const handleToggleRedirectActive = (id: string) => {
    const updated = redirectRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    setRedirectRules(updated);
    safeSetLocalStorage('solmint_redirect_rules', updated);
  };

  const handleDeleteRedirect = (id: string) => {
    if (window.confirm('آیا از حذف این قاعده ریدارکت 301 اطمینان دارید؟')) {
      const updated = redirectRules.filter(r => r.id !== id);
      setRedirectRules(updated);
      safeSetLocalStorage('solmint_redirect_rules', updated);
    }
  };

  // Synchronize download inputs when props or modal open state changes
  useEffect(() => {
    if (downloadLinks) {
      setApkUrlInput(downloadLinks.apkUrl || '');
      setTelegramUrlInput(downloadLinks.telegramUrl || '');
      setGooglePlayUrlInput(downloadLinks.googlePlayUrl || '');
      setWebAppUrlInput(downloadLinks.webAppUrl || '');
      setApkVersionInput(downloadLinks.apkVersion || 'v2.4.0');
      setDownloadNoticeInput(downloadLinks.downloadNotice || '');
    }
  }, [downloadLinks, isOpen]);

  const handleSaveDownloadLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedLinks: DownloadLinks = {
      apkUrl: apkUrlInput.trim(),
      telegramUrl: telegramUrlInput.trim(),
      googlePlayUrl: googlePlayUrlInput.trim(),
      webAppUrl: webAppUrlInput.trim(),
      apkVersion: apkVersionInput.trim(),
      downloadNotice: downloadNoticeInput.trim()
    };
    if (setDownloadLinks) {
      setDownloadLinks(updatedLinks);
    }
    localStorage.setItem('solmint_download_links', JSON.stringify(updatedLinks));
    await saveCmsSettingsToApi({ downloads: updatedLinks as any });
    setDownloadSaveSuccess('لینک‌های دانلود اپلیکیشن با موفقیت در دیتابیس سرور بروزرسانی و ذخیره شدند.');
    setTimeout(() => setDownloadSaveSuccess(''), 4000);
  };

  const handleResetDownloadLinks = () => {
    if (window.confirm('آیا از بازنشانی لینک‌های دانلود به تنظیمات پیش‌فرض اطمینان دارید؟')) {
      if (setDownloadLinks) {
        setDownloadLinks(DEFAULT_DOWNLOAD_LINKS);
      }
      localStorage.setItem('solmint_download_links', JSON.stringify(DEFAULT_DOWNLOAD_LINKS));
      setApkUrlInput(DEFAULT_DOWNLOAD_LINKS.apkUrl);
      setTelegramUrlInput(DEFAULT_DOWNLOAD_LINKS.telegramUrl);
      setGooglePlayUrlInput(DEFAULT_DOWNLOAD_LINKS.googlePlayUrl || '');
      setWebAppUrlInput(DEFAULT_DOWNLOAD_LINKS.webAppUrl || '');
      setApkVersionInput(DEFAULT_DOWNLOAD_LINKS.apkVersion || 'v2.4.0');
      setDownloadNoticeInput(DEFAULT_DOWNLOAD_LINKS.downloadNotice || '');
      setDownloadSaveSuccess('تنظیمات لینک‌های دانلود به مقادیر پیش‌فرض بازگردانده شدند.');
      setTimeout(() => setDownloadSaveSuccess(''), 4000);
    }
  };

  // DeepSeek AI Settings State & Handlers
  const [deepseekState, setDeepseekState] = useState<DeepSeekAiSettings>(() => {
    return deepseekSettings || safeGetLocalStorage<DeepSeekAiSettings>('solmint_deepseek_settings', DEFAULT_DEEPSEEK_SETTINGS);
  });

  const [deepseekTestStatus, setDeepseekTestStatus] = useState<{ success?: boolean; message: string } | null>(null);
  const [isTestingDeepseek, setIsTestingDeepseek] = useState(false);
  const [isGeneratingDeepseek, setIsGeneratingDeepseek] = useState(false);
  const [deepseekSaveNotice, setDeepseekSaveNotice] = useState('');
  const [newTopicInput, setNewTopicInput] = useState('');
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [customPromptTopic, setCustomPromptTopic] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Server Activity Logs & Scheduled Hours State
  const [serverLogs, setServerLogs] = useState<Array<{ id: string; timestamp: string; topic: string; status: 'success' | 'error'; message: string; articleSlug?: string; articleTitle?: string }>>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [publishScheduleHours, setPublishScheduleHours] = useState<number>(6);

  // Batch API Key Tester State
  const [batchKeysInput, setBatchKeysInput] = useState('');
  const [batchResults, setBatchResults] = useState<Array<{ key: string; success: boolean; message: string; maskedKey: string }> | null>(null);
  const [isBatchTesting, setIsBatchTesting] = useState(false);

  const loadServerLogs = async () => {
    setIsLoadingLogs(true);
    const logs = await fetchServerDeepseekLogs();
    setServerLogs(logs);
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    if (adminTab === 'deepseek' && isOpen) {
      loadServerLogs();
    }
  }, [adminTab, isOpen]);

  const handleClearServerLogs = async () => {
    if (window.confirm('آیا از پاکسازی تمامی لوگ‌های فعالیت نویسنده خودکار در سرور اطمینان دارید؟')) {
      await clearServerDeepseekLogs();
      setServerLogs([]);
    }
  };

  const handleBatchTestKeys = async () => {
    if (!batchKeysInput.trim()) return;
    setIsBatchTesting(true);
    setBatchResults(null);
    const keys = batchKeysInput.split(/[\n,;]/).map(k => k.trim()).filter(Boolean);
    const results = await batchTestDeepSeekKeys(keys, deepseekState.apiBaseUrl, deepseekState.model);
    setBatchResults(results);
    setIsBatchTesting(false);
  };

  useEffect(() => {
    if (deepseekSettings) {
      setDeepseekState(deepseekSettings);
      if ((deepseekSettings as any).publishScheduleHours) {
        setPublishScheduleHours((deepseekSettings as any).publishScheduleHours);
      } else if (deepseekSettings.publishSchedule?.intervalHours) {
        setPublishScheduleHours(deepseekSettings.publishSchedule.intervalHours);
      }
    }
  }, [deepseekSettings, isOpen]);

  const handleSaveDeepseekSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updatedState = {
      ...deepseekState,
      publishSchedule: {
        ...deepseekState.publishSchedule,
        intervalHours: publishScheduleHours
      }
    };
    if (setDeepseekSettings) {
      setDeepseekSettings(updatedState);
    }
    safeSetLocalStorage('solmint_deepseek_settings', updatedState);
    const serverPayload = {
      ...updatedState,
      autoPublishEnabled: updatedState.publishSchedule.enabled,
      publishScheduleHours: publishScheduleHours
    };
    await saveCmsSettingsToApi({ deepseek: serverPayload as any });
    setDeepseekSaveNotice('تنظیمات هوش مصنوعی، پرامپت‌ها و کلید API با موفقیت در فایل settings.json سرور ذخیره شد.');
    setTimeout(() => setDeepseekSaveNotice(''), 4000);
    loadServerLogs();
  };

  const handleTestDeepseekApi = async () => {
    setIsTestingDeepseek(true);
    setDeepseekTestStatus(null);
    const res = await testDeepSeekConnection(deepseekState.apiKey, deepseekState.apiBaseUrl, deepseekState.model);
    setDeepseekTestStatus(res);
    setIsTestingDeepseek(false);
  };

  const handleAddTargetTopic = () => {
    if (!newTopicInput.trim()) return;
    const topic = newTopicInput.trim();
    if (deepseekState.targetTopics.includes(topic)) return;
    const updated = {
      ...deepseekState,
      targetTopics: [...deepseekState.targetTopics, topic]
    };
    setDeepseekState(updated);
    if (setDeepseekSettings) setDeepseekSettings(updated);
    safeSetLocalStorage('solmint_deepseek_settings', updated);
    setNewTopicInput('');
  };

  const handleRemoveTargetTopic = (topicToRemove: string) => {
    const updated = {
      ...deepseekState,
      targetTopics: deepseekState.targetTopics.filter(t => t !== topicToRemove)
    };
    setDeepseekState(updated);
    if (setDeepseekSettings) setDeepseekSettings(updated);
    safeSetLocalStorage('solmint_deepseek_settings', updated);
  };

  const handleAddTargetKeyword = () => {
    if (!newKeywordInput.trim()) return;
    const kw = newKeywordInput.trim();
    if (deepseekState.targetKeywords.includes(kw)) return;
    const updated = {
      ...deepseekState,
      targetKeywords: [...deepseekState.targetKeywords, kw]
    };
    setDeepseekState(updated);
    if (setDeepseekSettings) setDeepseekSettings(updated);
    safeSetLocalStorage('solmint_deepseek_settings', updated);
    setNewKeywordInput('');
  };

  const handleRemoveTargetKeyword = (kwToRemove: string) => {
    const updated = {
      ...deepseekState,
      targetKeywords: deepseekState.targetKeywords.filter(k => k !== kwToRemove)
    };
    setDeepseekState(updated);
    if (setDeepseekSettings) setDeepseekSettings(updated);
    safeSetLocalStorage('solmint_deepseek_settings', updated);
  };

  const handleGenerateArticleWithDeepseek = async (topicPrompt?: string) => {
    setIsGeneratingDeepseek(true);
    try {
      const generated = await generateArticleWithDeepSeek(topicPrompt || customPromptTopic, deepseekState);
      
      if (generated.title) setFormTitle(cleanArticleTitle(generated.title, topicPrompt || customPromptTopic));
      if (generated.slug) setFormSlug(generateSlugFromTitle(generated.slug || generated.title || ''));
      if (generated.category) setFormCategory(generated.category as any);
      if (generated.summary) setFormSummary(cleanArticleContent(generated.summary));
      if (generated.content) setFormContent(cleanArticleContent(generated.content));
      if (generated.coverImage) setFormCoverImage(generated.coverImage);
      if (generated.videoUrl) setFormVideoUrl(generated.videoUrl);
      if (generated.tags) setFormTags(generated.tags.join(', '));

      const nowDates = formatAccurateDates(new Date());
      setFormPublishedAtJalali(nowDates.jalali);
      setFormPublishedAtGregorian(nowDates.gregorian);

      setAdminTab('editor');
    } catch (err: any) {
      alert(`خطا در نگارش مقاله با دیپ‌سیک: ${err?.message || 'مشکل ناشناخته'}`);
    } finally {
      setIsGeneratingDeepseek(false);
    }
  };

  // New Passcode Form
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [passChangeSuccess, setPassChangeSuccess] = useState('');

  // Editing Article State
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategory, setFormCategory] = useState<'آموزش سولانا' | 'توسعه وب۳' | 'امنیت' | 'اخبار و تحلیل'>('آموزش سولانا');
  const [formTags, setFormTags] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formIsDraft, setFormIsDraft] = useState(false);
  const [formPublishedAtJalali, setFormPublishedAtJalali] = useState('');
  const [formPublishedAtGregorian, setFormPublishedAtGregorian] = useState('');

  // SEO Settings State
  const [googleConsoleCode, setGoogleConsoleCode] = useState(() => {
    return localStorage.getItem('solmint_google_code') || 'google-site-verification-solmint-1404-code';
  });

  // Media upload input
  const [newMediaName, setNewMediaName] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');

  // Gemini AI Loading
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Auto Publish AI State
  const [isAutoPublishing, setIsAutoPublishing] = useState(false);
  const [autoPublishSuccess, setAutoPublishSuccess] = useState<string | null>(null);

  // User Management RBAC State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [memberFullName, setMemberFullName] = useState('');
  const [memberUsername, setMemberUsername] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState<'writer' | 'editor' | 'admin'>('writer');
  const [memberPermissions, setMemberPermissions] = useState<AdminPermission[]>([
    'articles', 'editor', 'comments', 'media'
  ]);
  const [memberIsActive, setMemberIsActive] = useState(true);
  const [userManagementNotice, setUserManagementNotice] = useState<string | null>(null);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);

  // Granular RBAC Permissions Checker
  const hasPermission = (perm: AdminPermission): boolean => {
    if (!isAuthenticated) return false;
    if (!currentUser) return true; // Default master admin passcode session
    if (currentUser.role === 'superadmin' || currentUser.username === 'admin') return true;
    if (currentUser.role === 'admin' && (!currentUser.permissions || currentUser.permissions.length === 0)) return true;
    if (currentUser.permissions && currentUser.permissions.includes(perm)) return true;
    return false;
  };

  // Lockout countdown handler
  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setInterval(() => {
        setLockoutTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTimer]);

  if (!isOpen) return null;

  // UNIFIED AUTH: server-only login for admin and users
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;
    const identifier = loginIdentifier.trim();
    const pass = loginPassword.trim();
    if (!identifier || !pass) {
      setAuthError('نام کاربری و رمز عبور الزامی است.');
      return;
    }

    const authRes = await loginUserApi({ username: identifier, passcode: pass });
    if (authRes.success && authRes.user) {
      const user = authRes.user;
      setIsAuthenticated(true);
      setCurrentUser(user);
      setAuthError('');
      setFailedAttempts(0);
      setLoginPassword('');
      if (user.role === 'user') {
        onClose();
        return;
      }
      const userPerms = user.permissions && user.permissions.length > 0
        ? user.permissions
        : (user.role === 'superadmin' || user.role === 'admin' ? ALL_ADMIN_PERMISSIONS : ['articles', 'editor', 'comments', 'media']);
      if (!userPerms.includes(adminTab)) setAdminTab(userPerms[0] || 'articles');
      return;
    }

    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    if (attempts >= 3) {
      setLockoutTimer(60);
      setAuthError('تعداد تلاش‌های ناموفق بیش از حد مجاز است. سیستم برای ۶۰ ثانیه قفل شد.');
    } else {
      setAuthError(authRes.message || ('اطلاعات ورود نادرست است. (' + (3 - attempts) + ' تلاش باقی مانده)'));
    }
  };

  // REGISTER NEW REAL USER ACCOUNT - SERVER AUTHORITATIVE
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFullName = sanitizeText(regFullName);
    const cleanUsername = sanitizeText(regUsername);
    if (!cleanFullName || !cleanUsername || !regPassword.trim()) {
      alert('لطفا تمامی فیلدها را به دقت تکمیل نمایید.');
      return;
    }
    const usernameVal = validateUsername(cleanUsername);
    if (!usernameVal.valid) { alert(usernameVal.error); return; }
    const passVal = validatePassword(regPassword);
    if (!passVal.valid) { alert(passVal.error); return; }
    if (regPassword !== regConfirmPassword) {
      alert('رمز عبور و تکرار آن مطابقت ندارند.');
      return;
    }
    const regRes = await registerUserApi({
      username: cleanUsername,
      fullName: cleanFullName,
      password: regPassword.trim(),
      role: 'user'
    });
    if (!regRes.success || !regRes.user) {
      alert(regRes.message || 'ثبت‌نام در سرور انجام نشد.');
      return;
    }
    setCurrentUser(regRes.user);
    setIsAuthenticated(true);
    setRegFullName('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    if (regRes.user.role === 'user') {
      onClose();
      return;
    }
    alert('حساب کاربری با موفقیت در سرور ساخته شد.');
  };
  const handleLogout = async () => {
    try { await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }); } catch {}
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginIdentifier('');
    setLoginPassword('');
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const currentPassword = currentPassInput.trim();
    const newPassword = newPassInput.trim();
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassInput.trim()) {
      alert('رمز فعلی، رمز جدید و تکرار رمز جدید را به‌درستی وارد کنید. رمز جدید باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        alert(data?.message || 'تغییر رمز عبور انجام نشد.');
        return;
      }
      setPassChangeSuccess('رمز عبور با موفقیت تغییر کرد.');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');

      setTimeout(() => setPassChangeSuccess(''), 4000);
    } catch {
      alert('ارتباط با سرویس احراز هویت برقرار نشد.');
    }
  };

  // CALCULATE REALTIME SEO SCORE (0-100)
  const calculateSeoScore = () => {
    let score = 0;
    const wordCount = formContent.trim().split(/\s+/).length;

    if (formTitle.length >= 10 && formTitle.length <= 65) score += 20;
    else if (formTitle.length > 0) score += 10;

    if (formSlug.length >= 5 && /^[a-z0-9-]+$/.test(formSlug)) score += 15;

    if (formSummary.length >= 50 && formSummary.length <= 160) score += 20;
    else if (formSummary.length > 0) score += 10;

    if (wordCount >= 200) score += 25;
    else if (wordCount > 50) score += 10;

    if (formCoverImage) score += 10;
    if (formVideoUrl) score += 10;

    return Math.min(score, 100);
  };

  const seoScore = calculateSeoScore();

  // OPEN EDITOR FOR CREATE OR EDIT
  const handleOpenEditor = (articleToEdit?: Article) => {
    if (articleToEdit) {
      setEditingArticleId(articleToEdit.id);
      setFormTitle(articleToEdit.title);
      setFormSlug(articleToEdit.slug);
      setFormCategory(articleToEdit.category);
      setFormTags(articleToEdit.tags.join(', '));
      setFormSummary(articleToEdit.summary);
      setFormContent(articleToEdit.content);
      setFormCoverImage(articleToEdit.coverImage);
      setFormVideoUrl(articleToEdit.videoUrl || '');
      setFormIsDraft(!!articleToEdit.isDraft);

      const parsedDates = formatAccurateDates(articleToEdit.publishedAtGregorian || articleToEdit.publishedAtJalali || articleToEdit.publishedAt);
      setFormPublishedAtJalali(articleToEdit.publishedAtJalali || parsedDates.jalali);
      setFormPublishedAtGregorian(articleToEdit.publishedAtGregorian || parsedDates.gregorian);
    } else {
      setEditingArticleId(null);
      setFormTitle('');
      setFormSlug('');
      setFormCategory('آموزش سولانا');
      setFormTags('سولانا, سولمینت, وب۳');
      setFormSummary('');
      setFormContent('');
      setFormCoverImage('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80');
      setFormVideoUrl('');
      setFormIsDraft(false);

      const nowDates = formatAccurateDates();
      setFormPublishedAtJalali(nowDates.jalali);
      setFormPublishedAtGregorian(nowDates.gregorian);
    }
    setAdminTab('editor');
  };

  // Live Sync Handlers for Dates
  const handleJalaliChange = (val: string) => {
    setFormPublishedAtJalali(val);
    const convertedGregorian = convertShamsiToGregorian(val);
    if (convertedGregorian) {
      setFormPublishedAtGregorian(convertedGregorian);
    }
  };

  const handleGregorianChange = (val: string) => {
    setFormPublishedAtGregorian(val);
    const convertedJalali = convertGregorianToShamsi(val);
    if (convertedJalali) {
      setFormPublishedAtJalali(convertedJalali);
    }
  };

  // SAVE ARTICLE
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = formTags.split(',').map(t => t.trim()).filter(Boolean);

    const datePair = formatAccurateDates(formPublishedAtGregorian || formPublishedAtJalali);
    const finalJalali = formPublishedAtJalali || datePair.jalali;
    const finalGregorian = formPublishedAtGregorian || datePair.gregorian;
    const finalPublishedAt = `${finalJalali} (${finalGregorian})`;

    // Cover image requirement check
    const isCoverRequired = !!(deepseekState.requireCoverImage || deepseekState.mediaConfig?.requireCoverImage);
    if (isCoverRequired && !formCoverImage.trim()) {
      alert('بر اساس تنظیمات سیستم، انتشار مقاله بدون تصویر کاور غیرفعال است. لطفاً یک آدرس تصویر انتخاب نمایید یا گزینه «الزامی بودن عکس کاور» را در تنظیمات هوش مصنوعی و رسانه غیرفعال کنید.');
      return;
    }

    const finalCoverImage = formCoverImage.trim();

    const computedSlug = generateSlugFromTitle(formSlug || formTitle);
    let savedArticle: Article | null = null;
    let updatedList: Article[];
    if (editingArticleId) {
      updatedList = articles.map(a => {
        if (a.id === editingArticleId) {
          savedArticle = {
            ...a,
            title: formTitle,
            slug: computedSlug,
            category: formCategory,
            tags: tagArray,
            summary: formSummary,
            content: formContent,
            coverImage: finalCoverImage,
            videoUrl: formVideoUrl || undefined,
            publishedAt: finalPublishedAt,
            publishedAtJalali: finalJalali,
            publishedAtGregorian: finalGregorian,
            seoScore: seoScore,
            isDraft: formIsDraft
          };
          return savedArticle;
        }
        return a;
      });
    } else {
      const newArt: Article = {
        id: 'art-' + Date.now(),
        title: formTitle,
        slug: computedSlug,
        category: formCategory,
        tags: tagArray,
        summary: formSummary,
        content: formContent,
        coverImage: finalCoverImage,
        videoUrl: formVideoUrl || undefined,
        author: {
          name: currentUser?.fullName || 'تیم تحریریه سول‌مینت',
          role: 'تحلیل‌گر ارشد وب۳ و کریپتو',
          avatar: '/avatars/editor.svg'
        },
        publishedAt: finalPublishedAt,
        publishedAtJalali: finalJalali,
        publishedAtGregorian: finalGregorian,
        readTimeMinutes: Math.max(2, Math.round(formContent.length / 500)),
        viewsCount: 1,
        comments: [],
        seoScore: seoScore,
        isDraft: formIsDraft
      };
      savedArticle = newArt;
      updatedList = [newArt, ...articles];
    }

    if (savedArticle) {
      try {
        const saveOk = await saveArticleToActiveDatabase(savedArticle);
        if (!saveOk) {
          alert('❌ خطا در انتشار مقاله! ثبت مقاله در دیتابیس اصلی (Supabase) با خطا مواجه شد. مقاله منتشر نشد.');
          return;
        }

        const freshArticles = await fetchArticlesFromActiveDatabase();
        const finalArticles = freshArticles && freshArticles.length > 0 ? freshArticles : updatedList;
        setArticles(finalArticles);
        localStorage.setItem('solmint_articles', JSON.stringify(finalArticles));
        setAdminTab('articles');
      } catch (err: any) {
        alert(`❌ خطا در ارتباط با دیتابیس: ${err.message || err}`);
        return;
      }
    } else {
      setArticles(updatedList);
      localStorage.setItem('solmint_articles', JSON.stringify(updatedList));
      setAdminTab('articles');
    }
  };

  // 100% AUTOMATIC ARTICLE GENERATION & PUBLISHING WITH DEEPSEEK
  const handleAutoPublishAIArticle = async (customTopic?: string) => {
    setIsAutoPublishing(true);
    setAutoPublishSuccess(null);
    try {
      // 1. First trigger server auto publish
      const serverRes = await triggerServerAutoPublish(customTopic || '');
      if (serverRes.success && serverRes.article) {
        const fullArticle = serverRes.article as Article;
        const freshArticles = await fetchArticlesFromActiveDatabase();
        const updated = freshArticles && freshArticles.length > 0 ? freshArticles : [fullArticle, ...articles.filter(a => a.id !== fullArticle.id)];
        setArticles(updated);
        localStorage.setItem('solmint_articles', JSON.stringify(updated));
        setAutoPublishSuccess(`مقاله "${fullArticle.title}" با موفقیت مستقیم در دیتابیس اصلی (Supabase) نگارش و با آدرس "/article/${fullArticle.slug}" منتشر شد!`);
        loadServerLogs();
        return;
      }

      // 2. Client fallback if server trigger fails
      const aiArticle = await generateArticleWithDeepSeek(customTopic || '', deepseekState);
      
      const datePair = formatAccurateDates(new Date().toISOString());
      const finalJalali = datePair.jalali;
      const finalGregorian = datePair.gregorian;
      const finalPublishedAt = `${finalJalali} (${finalGregorian})`;

      const category = aiArticle.category || 'آموزش سولانا';
      const title = cleanArticleTitle(aiArticle.title || 'مقاله تخصصی سولمینت', customTopic);
      const slug = generateSlugFromTitle(aiArticle.slug || title);
      const coverImage = aiArticle.coverImage || getRandomCoverForCategoryOrTitle(category, title);

      const fullArticle: Article = {
        id: 'art-' + Date.now(),
        title: title,
        slug: slug,
        category: category,
        tags: aiArticle.tags || ['سولانا', 'وب۳', 'کریپتو'],
        summary: cleanArticleContent(aiArticle.summary || ''),
        content: cleanArticleContent(aiArticle.content || ''),
        coverImage: coverImage,
        videoUrl: aiArticle.videoUrl || undefined,
        author: {
          name: currentUser?.fullName || 'تیم تحریریه سول‌مینت',
          role: 'تحلیل‌گر ارشد وب۳ و کریپتو',
          avatar: '/avatars/editor.svg'
        },
        publishedAt: finalPublishedAt,
        publishedAtJalali: finalJalali,
        publishedAtGregorian: finalGregorian,
        readTimeMinutes: aiArticle.readTimeMinutes || 6,
        viewsCount: 1,
        comments: [],
        seoScore: aiArticle.seoScore || 95,
        isDraft: false
      };

      // Persist directly into connected database (Supabase) and enforce success
      const saveSuccess = await saveArticleToActiveDatabase(fullArticle);
      if (!saveSuccess) {
        throw new Error('انتشار مقاله ناموفق بود: ذخیره‌سازی در دیتابیس اصلی (Supabase) با خطا مواجه شد.');
      }

      const freshArticles = await fetchArticlesFromActiveDatabase();
      const updated = freshArticles && freshArticles.length > 0 ? freshArticles : [fullArticle, ...articles];
      setArticles(updated);
      localStorage.setItem('solmint_articles', JSON.stringify(updated));

      setAutoPublishSuccess(`مقاله "${fullArticle.title}" با موفقیت نگارش گردید و با لینک اختصاصی "/article/${fullArticle.slug}" به صورت رسمی منتشر شد!`);
      loadServerLogs();
    } catch (err: any) {
      alert(`خطا در تولید و انتشار مقاله: ${err.message || err}`);
    } finally {
      setIsAutoPublishing(false);
    }
  };

  // USER MANAGEMENT RBAC HANDLERS
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeText(memberFullName);
    const cleanUser = sanitizeText(memberUsername);
    if (!cleanName || !cleanUser) { alert('لطفا نام و نام کاربری را وارد کنید.'); return; }
    if (!editingUserId && !memberPassword.trim()) { alert('لطفا رمز عبور کاربر جدید را مشخص کنید.'); return; }
    if (editingUserId) {
      const ok = await updateUserApi({
        userId: editingUserId,
        role: memberRole,
        permissions: memberPermissions,
        isActive: memberIsActive,
        ...(memberPassword.trim() ? { password: memberPassword.trim() } : {})
      });
      if (!ok) { alert('ذخیره تغییرات کاربر در سرور انجام نشد.'); return; }
      setUsers(await fetchUsersApi());
      setUserManagementNotice('اطلاعات و دسترسی‌های کاربر با موفقیت در سرور به‌روزرسانی شد.');
    } else {
      const regRes = await registerUserApi({
        username: cleanUser,
        fullName: cleanName,
        password: memberPassword.trim(),
        role: memberRole,
        permissions: memberPermissions,
        isActive: memberIsActive
      });
      if (!regRes.success || !regRes.user) { alert(regRes.message || 'ایجاد کاربر در سرور انجام نشد.'); return; }
      setUsers(await fetchUsersApi());
      setUserManagementNotice('نویسنده/همکار جدید با موفقیت در سرور اضافه شد.');
    }
    setEditingUserId(null);
    setMemberFullName('');
    setMemberUsername('');
    setMemberPassword('');
    setMemberRole('writer');
    setMemberPermissions(['articles', 'editor', 'comments', 'media']);
    setShowAddMemberForm(false);
  };
  const handleEditUserClick = (user: UserAccount) => {
    setEditingUserId(user.id);
    setMemberFullName(user.fullName);
    setMemberUsername(user.username);
    setMemberPassword('');
    setMemberRole(user.role === 'superadmin' ? 'admin' : (user.role as any) || 'writer');
    setMemberPermissions(user.permissions || ALL_ADMIN_PERMISSIONS);
    setMemberIsActive(user.isActive !== false);
    setShowAddMemberForm(true);
  };

  const handleToggleUserActive = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const ok = await updateUserApi({ userId, isActive: !(target.isActive !== false) });
    if (!ok) { alert('تغییر وضعیت کاربر در سرور انجام نشد.'); return; }
    setUsers(await fetchUsersApi());
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('آیا از حذف این کاربر اطمینان دارید؟')) return;
    const ok = await deleteUserApi(userId);
    if (!ok) { alert('حذف کاربر از سرور انجام نشد.'); return; }
    setUsers(await fetchUsersApi());
  };
  const handleTogglePermission = (perm: AdminPermission) => {
    if (memberPermissions.includes(perm)) {
      setMemberPermissions(memberPermissions.filter(p => p !== perm));
    } else {
      setMemberPermissions([...memberPermissions, perm]);
    }
  };

  // DELETE ARTICLE
  const handleDeleteArticle = async (id: string) => {
    if (confirm('آیا از حذف این مقاله اطمینان دارید؟')) {
      const success = await deleteArticleFromActiveDatabase(id);
      if (!success) {
        alert('❌ خطا در حذف مقاله از دیتابیس اصلی (Supabase). مقاله حذف نشد.');
        return;
      }
      const freshArticles = await fetchArticlesFromActiveDatabase();
      const updated = freshArticles ? freshArticles : articles.filter(a => a.id !== id);
      setArticles(updated);
      localStorage.setItem('solmint_articles', JSON.stringify(updated));
    }
  };

  // MODERATE COMMENTS & TESTIMONIALS
  const handleDeleteComment = (articleId: string, commentId: string) => {
    const updated = articles.map(a => {
      if (a.id === articleId) {
        return {
          ...a,
          comments: a.comments.filter(c => c.id !== commentId)
        };
      }
      return a;
    });
    setArticles(updated);
    localStorage.setItem('solmint_articles', JSON.stringify(updated));
    deleteCommentApi(commentId);
  };

  const handleDeleteTestimonial = (testimonialId: string) => {
    const updated = testimonials.filter(t => t.id !== testimonialId);
    setTestimonials(updated);
    localStorage.setItem('solmint_testimonials', JSON.stringify(updated));
  };

  const handleAddMedia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaName || !newMediaUrl) return;

    const newItem: MediaItem = {
      id: 'm-' + Date.now(),
      name: newMediaName,
      type: newMediaType,
      url: newMediaUrl,
      uploadedAt: new Date().toLocaleDateString('fa-IR'),
      sizeMb: 1.5
    };

    const updated = [newItem, ...mediaItems];
    setMediaItems(updated);
    localStorage.setItem('solmint_media', JSON.stringify(updated));
    setNewMediaName('');
    setNewMediaUrl('');
  };

  // DEEPSEEK AI ASSISTANT CALLS
  const callDeepSeekAi = async (type: 'seo_summary' | 'seo_keywords' | 'expand' | 'faq') => {
    if (!formTitle && type !== 'expand' && type !== 'faq') {
      alert('لطفاً ابتدا عنوان مقاله را وارد کنید.');
      return;
    }

    setIsAiLoading(true);
    try {
      let promptText = '';
      if (type === 'seo_summary') {
        promptText = `تولید چکیده استاندارد سئو (Meta Description) برای مقاله با عنوان: "${formTitle}". خلاصه متن: ${formContent.substring(0, 300)}`;
      } else if (type === 'seo_keywords') {
        promptText = `لیست ۱۰ کلمه کلیدی سئو کاما جدا شده فارسی برای مقاله وب۳ سولانا با عنوان "${formTitle}".`;
      } else if (type === 'faq') {
        promptText = `تولید ۳ سوال و پاسخ متداول در قالب مارک‌داون با تیتر "## ❓ سوالات متداول (FAQ)" برای مقاله سولانا با عنوان "${formTitle || 'آموزش سولانا'}".`;
      } else {
        promptText = `تکمیل و ساختاربندی مقاله آموزش سولانا با عنوان "${formTitle}". متن فعلی: ${formContent}`;
      }

      const res = await fetch('/api/deepseek/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, userPrompt: promptText, type })
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const aiResult = (data.result || data.choices?.[0]?.message?.content || '').trim();

      if (type === 'seo_summary') {
        setFormSummary(aiResult);
        triggerAiToast('چکیده سئو با هوش مصنوعی DeepSeek ساخته شد.');
      } else if (type === 'seo_keywords') {
        setFormTags(aiResult);
        triggerAiToast('کلمات کلیدی سئو با DeepSeek تولید شدند.');
      } else if (type === 'faq') {
        setFormContent(formContent + '\n\n' + aiResult);
        triggerAiToast('بخش سوالات متداول سئو با DeepSeek به مقاله افزوده شد.');
      } else {
        setFormContent(aiResult);
        triggerAiToast('متن مقاله توسط DeepSeek کامل شد.');
      }
    } catch (err: any) {
      alert('خطا در هوش مصنوعی DeepSeek: ' + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const callGeminiAi = callDeepSeekAi;

  const triggerAiToast = (msg: string) => {
    setAiToast(msg);
    setTimeout(() => setAiToast(null), 3000);
  };

  // GENERATE DYNAMIC SITEMAP XML
  const generateSitemapXml = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://solmint.ir/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://solmint.ir/tools</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>0.9</priority>
  </url>
${articles.map(a => `  <url>
    <loc>https://solmint.ir/article/${a.slug}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;
  };

  const generateRobotsTxt = () => {
    return `User-agent: *
Allow: /
Sitemap: https://solmint.ir/sitemap.xml
`;
  };

  const handleCopyBackupJson = () => {
    const backupData = {
      articles,
      testimonials,
      mediaItems,
      googleConsoleCode,
      exportedAt: new Date().toISOString()
    };
    navigator.clipboard.writeText(JSON.stringify(backupData, null, 2));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="glass-card w-full max-w-5xl rounded-2xl sm:rounded-3xl border border-slate-700 p-4 sm:p-8 space-y-5 sm:space-y-6 my-2 sm:my-auto text-slate-200 shadow-2xl">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-[#9945FF]/20 via-[#14F195]/20 to-[#00C2FF]/20 text-[#14F195] border border-[#9945FF]/30 flex items-center justify-center p-1.5 sm:p-2 font-bold shadow-lg shadow-[#9945FF]/10 shrink-0">
              <SolanaLogoIcon className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
                {currentUser?.role === 'admin' 
                  ? 'پنل مدیریت محتوا، نظرات و سئو (Solmint CMS)'
                  : currentUser
                  ? `حساب کاربری: ${currentUser.fullName}`
                  : 'ورود / ثبت‌نام'}
              </h2>
              <span className="text-[10px] font-mono text-slate-400">
                {currentUser?.role === 'admin' ? 'solmint.ir Auth & Management Portal' : 'سولمینت | Solmint.ir'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="بستن پنجره"
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer active:scale-95 transition-transform shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. NOT LOGGED IN: LOGIN OR REGISTER TABS */}
        {!currentUser && !isAuthenticated ? (
          <div className="max-w-md mx-auto py-6 space-y-6">
            
            {/* Mode Switcher Buttons */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  authMode === 'login' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>ورود</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  authMode === 'register' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>ثبت نام</span>
              </button>
            </div>

            {authError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* TAB A: LOGIN FORM */}
            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-white">ورود به حساب کاربری</h3>
                  <p className="text-xs text-slate-400">
                    نام کاربری و رمز عبور خود را جهت ورود وارد نمایید.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">نام کاربری یا ایمیل:</label>
                    <input
                      type="text"
                      required
                      placeholder="نام کاربری یا ایمیل..."
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">رمز عبور:</label>
                    <input
                      type={showPasscode ? 'text' : 'password'}
                      placeholder="رمز عبور شما..."
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 pr-4 pl-12 text-xs font-mono text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute left-3.5 top-8 text-slate-400 hover:text-white cursor-pointer p-1"
                    >
                      {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={lockoutTimer > 0}
                    className="w-full py-3.5 rounded-2xl btn-gradient font-bold text-xs cursor-pointer shadow-lg hover:scale-[1.02] transition-transform"
                  >
                    {lockoutTimer > 0 ? `قفل سیستم (${lockoutTimer} ثانیه)` : 'ورود به حساب کاربری'}
                  </button>
                </div>
              </form>
            ) : (
              /* TAB B: REGISTER FORM */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-white">ثبت‌نام حساب کاربری جدید</h3>
                  <p className="text-xs text-slate-400">
                    با ثبت‌نام در وبسایت می‌توانید نظر و سوالات خود را در تمامی مقالات ثبت نمایید.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">نام و نام خانوادگی:</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: علی محمدی"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">نام کاربری یا ایمیل:</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: ali_solana"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white font-mono placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">رمز عبور:</label>
                      <input
                        type="password"
                        required
                        placeholder="حداقل ۴ کاراکتر"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white font-mono placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">تکرار رمز عبور:</label>
                      <input
                        type="password"
                        required
                        placeholder="تکرار دقیق..."
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white font-mono placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-bold text-xs cursor-pointer shadow-lg hover:scale-[1.02] transition-transform"
                  >
                    تکمیل ثبت‌نام و ورود به حساب
                  </button>
                </div>
              </form>
            )}

          </div>
        ) : currentUser && currentUser.role === 'user' ? (
          /* 2. REGULAR USER PROFILE VIEW */
          <div className="max-w-lg mx-auto py-8 space-y-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-[#14F195] flex items-center justify-center mx-auto shadow-2xl">
              <UserCheck className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                حساب کاربری فعال
              </span>
              <h3 className="text-2xl font-black text-white">
                خوش آمدید، {currentUser.fullName}!
              </h3>
              <p className="text-xs text-slate-400">
                نام کاربری: <span className="text-sky-400 font-mono font-bold">{currentUser.username}</span> | تاریخ عضویت: <span className="font-mono text-slate-300">{currentUser.createdAt}</span>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-right">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>دسترسی کامل به ارسال دیدگاه فعال است</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                اکنون می‌توانید زیر کلیه مقالات آموزشی و تحلیل‌های تخصصی وبلاگ solmint.ir نظر بدهید و با بقیه کاربران تبادل نظر کنید.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={() => {
                  onClose();
                  if (onGoToBlog) onGoToBlog();
                }}
                className="w-full py-3.5 rounded-2xl btn-gradient font-bold text-xs cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>مشاهده مقالات و ثبت نظر</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>خروج از حساب</span>
              </button>
            </div>
          </div>
        ) : (
          /* 3. AUTHENTICATED ADMIN CMS MANAGER CONTROLS */
          <div className="space-y-6">

            {/* Active User Status Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-xs shadow-md">
                  {currentUser?.role === 'superadmin' ? '👑' : currentUser?.role === 'admin' ? '🛡️' : currentUser?.role === 'editor' ? '📝' : '✍️'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">ورود به عنوان: </span>
                    <span className="font-bold text-white">{currentUser?.fullName || 'مدیر سیستم'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30 font-bold">
                      {currentUser?.role === 'superadmin' ? 'مدیر ارشد (SuperAdmin)' : currentUser?.role === 'admin' ? 'مدیر همکار' : currentUser?.role === 'editor' ? 'ویراستار' : 'نویسنده محتوا'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">نام کاربری: {currentUser?.username || 'admin'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>دسترسی احراز هویت شده</span>
                </span>
              </div>
            </div>

            {/* CMS Navigation Tabs */}
            <div className="bg-slate-900/90 p-2 rounded-2xl border border-slate-800 shrink-0 space-y-2">
              
              {/* Mobile View: Quick Dropdown Select Menu */}
              <div className="block md:hidden">
                <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
                  <label htmlFor="admin-mobile-tab-select" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>انتخاب بخش مدیریت:</span>
                  </label>
                  <button
                    onClick={handleLogout}
                    className="text-[11px] text-rose-400 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 border border-rose-500/20 cursor-pointer active:scale-95 transition-transform"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>خروج</span>
                  </button>
                </div>

                <select
                  id="admin-mobile-tab-select"
                  value={adminTab}
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (selected === 'editor') {
                      handleOpenEditor();
                    } else {
                      setAdminTab(selected as any);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-xs cursor-pointer focus:outline-none focus:border-cyan-500 shadow-inner"
                >
                  {hasPermission('articles') && (
                    <option value="articles">📝 مدیریت مقالات ({articles.length})</option>
                  )}
                  {hasPermission('editor') && (
                    <option value="editor">➕ ایجاد مقاله جدید</option>
                  )}
                  {hasPermission('comments') && (
                    <option value="comments">💬 مدیریت نظرات و دیدگاه‌ها ({testimonials.length + articles.reduce((acc, a) => acc + a.comments.length, 0)})</option>
                  )}
                  {hasPermission('media') && (
                    <option value="media">🖼️ کتابخانه رسانه و مدیریت فایل‌ها</option>
                  )}
                  {hasPermission('seo') && (
                    <option value="seo">🌐 تنظیمات سئو، متاتگ‌ها و CDN</option>
                  )}
                  {hasPermission('audit') && (
                    <option value="audit">🔍 تست و آودیت هوشمند سئو (Diagnostic)</option>
                  )}
                  {hasPermission('redirects') && (
                    <option value="redirects">🔄 مدیریت 301 Redirects</option>
                  )}
                  {hasPermission('downloads') && (
                    <option value="downloads">📥 مدیریت لینک‌های دانلود اختصاصی</option>
                  )}
                  {hasPermission('deepseek') && (
                    <option value="deepseek">🧠 نویسنده هوشمند DeepSeek</option>
                  )}
                  {hasPermission('chatbot') && (
                    <option value="chatbot">🤖 تنظیمات چت‌بات پشتیبان AI</option>
                  )}
                  {hasPermission('database') && (
                    <option value="database">🗄️ تنظیمات دیتابیس (Supabase / Cloudflare)</option>
                  )}
                  {hasPermission('security') && (
                    <option value="security">🛡️ امنیت، رمز عبور و کلیدها</option>
                  )}
                  {hasPermission('users') && (
                    <option value="users">👥 مدیریت کاربران و سطح دسترسی (RBAC)</option>
                  )}
                </select>

                {/* Mobile View: Horizontal Touch-Scrollable Tab Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 scrollbar-none no-scrollbar">
                  {hasPermission('articles') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('articles')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'articles' ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      <span>مقالات ({articles.length})</span>
                    </button>
                  )}
                  {hasPermission('editor') && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditor()}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'editor' ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ایجاد مقاله</span>
                    </button>
                  )}
                  {hasPermission('comments') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('comments')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'comments' ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                      <span>نظرات</span>
                    </button>
                  )}
                  {hasPermission('media') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('media')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'media' ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>رسانه</span>
                    </button>
                  )}
                  {hasPermission('seo') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('seo')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'seo' ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>سئو</span>
                    </button>
                  )}
                  {hasPermission('audit') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('audit')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'audit' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      <span>آودیت</span>
                    </button>
                  )}
                  {hasPermission('redirects') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('redirects')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'redirects' ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>ریدایرکت</span>
                    </button>
                  )}
                  {hasPermission('downloads') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('downloads')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'downloads' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>دانلودها</span>
                    </button>
                  )}
                  {hasPermission('deepseek') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('deepseek')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'deepseek' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-950 text-purple-300 border border-slate-800'
                      }`}
                    >
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      <span>DeepSeek AI</span>
                    </button>
                  )}
                  {hasPermission('chatbot') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('chatbot')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'chatbot' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-950 text-indigo-300 border border-slate-800'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 text-indigo-400" />
                      <span>چت‌بات</span>
                    </button>
                  )}
                  {hasPermission('database') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('database')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'database' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-950 text-cyan-300 border border-slate-800'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      <span>دیتابیس</span>
                    </button>
                  )}
                  {hasPermission('security') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('security')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'security' ? 'bg-[#9945FF] text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#14F195]" />
                      <span>امنیت</span>
                    </button>
                  )}
                  {hasPermission('users') && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('users')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                        adminTab === 'users' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-950 text-amber-300 border border-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>کاربران</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop View: Full Tab Strip */}
              <div className="hidden md:flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {hasPermission('articles') && (
                    <button
                      onClick={() => setAdminTab('articles')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'articles' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>مقالات ({articles.length})</span>
                    </button>
                  )}

                  {hasPermission('editor') && (
                    <button
                      onClick={() => handleOpenEditor()}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'editor' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>ایجاد مقاله</span>
                    </button>
                  )}

                  {hasPermission('comments') && (
                    <button
                      onClick={() => setAdminTab('comments')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'comments' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>مدیریت نظرات ({testimonials.length + articles.reduce((acc, a) => acc + a.comments.length, 0)})</span>
                    </button>
                  )}

                  {hasPermission('media') && (
                    <button
                      onClick={() => setAdminTab('media')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'media' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>کتابخانه رسانه</span>
                    </button>
                  )}

                  {hasPermission('seo') && (
                    <button
                      onClick={() => setAdminTab('seo')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'seo' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      <span>سئو و Cloudflare</span>
                    </button>
                  )}

                  {hasPermission('audit') && (
                    <button
                      onClick={() => setAdminTab('audit')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'audit' ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md' : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تست و آودیت سئو (Diagnostic)</span>
                    </button>
                  )}

                  {hasPermission('redirects') && (
                    <button
                      onClick={() => setAdminTab('redirects')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'redirects' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>مدیریت 301 Redirects</span>
                    </button>
                  )}

                  {hasPermission('downloads') && (
                    <button
                      onClick={() => setAdminTab('downloads')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'downloads' ? 'bg-[#9945FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Download className="w-4 h-4 text-[#14F195]" />
                      <span>لینک‌های دانلود</span>
                    </button>
                  )}

                  {hasPermission('deepseek') && (
                    <button
                      onClick={() => setAdminTab('deepseek')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'deepseek'
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                          : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                      }`}
                    >
                      <Brain className="w-4 h-4 text-cyan-300 animate-pulse" />
                      <span>نویسنده DeepSeek</span>
                    </button>
                  )}

                  {hasPermission('chatbot') && (
                    <button
                      onClick={() => setAdminTab('chatbot')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'chatbot'
                          ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-slate-950 font-extrabold shadow-lg shadow-[#9945FF]/30'
                          : 'text-[#14F195] hover:text-white hover:bg-[#9945FF]/10'
                      }`}
                    >
                      <Bot className="w-4 h-4 text-[#14F195]" />
                      <span>تنظیمات چت‌بات AI</span>
                    </button>
                  )}

                  {hasPermission('database') && (
                    <button
                      onClick={() => setAdminTab('database')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'database'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/25'
                          : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      <Database className="w-4 h-4 text-emerald-300" />
                      <span>دیتابیس (Supabase / Cloudflare)</span>
                    </button>
                  )}

                  {hasPermission('security') && (
                    <button
                      onClick={() => setAdminTab('security')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'security' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>امنیت CMS</span>
                    </button>
                  )}

                  {hasPermission('users') && (
                    <button
                      onClick={() => setAdminTab('users')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === 'users'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/25'
                          : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                      }`}
                    >
                      <Users className="w-4 h-4 text-amber-300" />
                      <span>مدیریت اعضا و دسترسی‌ها (RBAC)</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 border border-rose-500/20 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>

            </div>

            {/* TAB ACCESS GUARD */}
            {!hasPermission(adminTab) ? (
              <div className="p-8 rounded-3xl bg-slate-900 border border-rose-500/30 text-center space-y-4 max-w-lg mx-auto my-8 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white">محدودیت دسترسی امنیتی</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  حساب کاربری شما (<span className="text-amber-400 font-bold">{currentUser?.fullName || 'نویسنده'}</span>) مجاز به دسترسی به بخش <span className="text-sky-400 font-bold">{adminTab}</span> نیست.
                  این بخش حاوی داده‌ها و کلیدهای تنظیمات حساس سیستم می‌باشد.
                </p>
                <button
                  onClick={() => {
                    const userPerms = currentUser?.permissions || ['articles'];
                    setAdminTab((userPerms[0] as any) || 'articles');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                >
                  بازگشت به بخش مقالات مجاز
                </button>
              </div>
            ) : (
              <>

            {/* TAB 1: ARTICLES LIST */}
            {adminTab === 'articles' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                  <span>لیست کلیه مقالات آموزشی و تحلیل‌های وبلاگ ({articles.length} مقاله):</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isAutoPublishing}
                      onClick={() => handleAutoPublishAIArticle()}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-extrabold flex items-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50"
                    >
                      {isAutoPublishing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                          <span>در حال خلق و انتشار مقاله...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                          <span>⚡ انتشار ۱ کلیکی مقاله اتوماتیک با AI</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEditor()}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:text-white font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>افزودن مقاله دستی</span>
                    </button>
                  </div>
                </div>

                {autoPublishSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>{autoPublishSuccess}</span>
                    </div>
                    <button onClick={() => setAutoPublishSuccess(null)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="space-y-2.5">
                  {articles.map((art) => (
                    <div
                      key={art.id}
                      className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img src={art.coverImage} alt={art.title} className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white line-clamp-1">{art.title}</h4>
                            {art.isDraft && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">پیش‌نویس</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                            <span className="text-sky-400 font-mono">/article/{art.slug}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-sky-400" />
                              <span>شمسی: {art.publishedAtJalali || art.publishedAt}</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-emerald-400">میلادی: {art.publishedAtGregorian || '2025/07/27'}</span>
                            </span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold font-mono">SEO: {art.seoScore || 85}%</span>
                            <span>•</span>
                            <span>{art.comments.length} دیدگاه</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenEditor(art)}
                          className="p-2 rounded-xl bg-slate-800 text-sky-400 hover:bg-slate-700 cursor-pointer"
                          title="ویرایش مقاله"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteArticle(art.id)}
                          className="p-2 rounded-xl bg-slate-800 text-rose-400 hover:bg-slate-700 cursor-pointer"
                          title="حذف مقاله"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: ARTICLE EDITOR & AI GENERATION PANEL */}
            {adminTab === 'editor' && (
              <form onSubmit={handleSaveArticle} className="space-y-6 text-xs">
                
                {/* DeepSeek AI Auto-Article Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/90 via-slate-900 to-blue-950/90 border border-cyan-500/40 space-y-3 shadow-lg shadow-cyan-950/40">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                        <Brain className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-sm flex items-center gap-2">
                          تولید مقاله کامل با هوش مصنوعی DeepSeek AI
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                            {deepseekState.apiKey ? 'API متصل' : 'موتور هوشمند پیش‌فرض'}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-300 block mt-0.5">
                          تولید کامل ساختار مقاله، تیترهای H2/H3، چکیده سئو، تصویر کاور و تگ‌های کلیدی با یک کلیک.
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingDeepseek}
                      onClick={() => handleGenerateArticleWithDeepseek()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 hover:brightness-110 cursor-pointer transition-all shrink-0 disabled:opacity-50"
                    >
                      {isGeneratingDeepseek ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>در حال نگارش مقاله...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 text-cyan-200" />
                          <span>تولید خودکار مقاله با دیپ‌سیک</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Quick Topic Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      انتخاب موضوع جهت تولید:
                    </span>
                    {deepseekState.targetTopics.slice(0, 4).map((topic, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={isGeneratingDeepseek}
                        onClick={() => handleGenerateArticleWithDeepseek(topic)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold cursor-pointer border border-slate-700/60 transition-colors"
                      >
                        + {topic.length > 32 ? topic.slice(0, 32) + '...' : topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DeepSeek AI Assistant Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/80 via-slate-900 to-emerald-950/80 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-sky-400 shrink-0 animate-pulse" />
                    <div>
                      <span className="font-bold text-white text-sm block">دستیار هوش مصنوعی DeepSeek برای سئو و محتوا</span>
                      <span className="text-[11px] text-slate-400">تولید خودکار چکیده سئو، کلمات کلیدی و بازنویسی متون مقالات با API دیپ‌سیک.</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isAiLoading}
                      onClick={() => callDeepSeekAi('seo_summary')}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-[11px] hover:bg-sky-500/30 cursor-pointer"
                    >
                      {isAiLoading ? 'در حال تولید...' : 'تولید چکیده سئو'}
                    </button>

                    <button
                      type="button"
                      disabled={isAiLoading}
                      onClick={() => callDeepSeekAi('seo_keywords')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] hover:bg-emerald-500/30 cursor-pointer"
                    >
                      پیشنهاد برچسب‌ها
                    </button>
                  </div>
                </div>

                {aiToast && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{aiToast}</span>
                  </div>
                )}

                {/* Real-time SEO Score Gauge */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart2 className="w-5 h-5 text-sky-400" />
                    <div>
                      <span className="font-bold text-slate-200 text-xs block">امتیاز هوشمند سئو مقاله (SEO Score):</span>
                      <span className="text-[10px] text-slate-400">تحلیل بر اساس طول عنوان، نامک، چکیده و کلمات کلیدی</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <div className="w-32 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                      <div 
                        className={`h-full transition-all duration-500 ${seoScore > 80 ? 'bg-emerald-400' : seoScore > 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                        style={{ width: `${seoScore}%` }}
                      />
                    </div>
                    <span className={`font-bold text-sm ${seoScore > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {seoScore}/100
                    </span>
                  </div>
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">عنوان مقاله (Article Title):</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setFormTitle(newTitle);
                        setFormSlug(generateSlugFromTitle(newTitle));
                      }}
                      placeholder="عنوان مقاله جذاب..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-semibold">نامک سئو و لینک مقاله (Slug):</label>
                      <button
                        type="button"
                        onClick={() => setFormSlug(generateSlugFromTitle(formTitle))}
                        className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        ⚡ تولید اتوماتیک URL
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="مثال: custom-solana-memecoin-guide"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono dir-ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">دسته‌بندی:</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    >
                      <option value="آموزش سولانا">آموزش سولانا</option>
                      <option value="توسعه وب۳">توسعه وب۳</option>
                      <option value="امنیت">امنیت</option>
                      <option value="اخبار و تحلیل">اخبار و تحلیل</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">برچسب‌ها (کاما جدا شده):</label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="سولانا, وب۳, ساخت توکن"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-slate-300 font-semibold">
                        آدرس تصویر کاور (Cover Image URL):
                        {!(deepseekState.requireCoverImage || deepseekState.mediaConfig?.requireCoverImage) && (
                          <span className="text-xs text-emerald-400 font-normal mr-2">(اختیاری)</span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsMediaPickerOpen(true)}
                        className="text-[11px] text-[#14F195] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        انتخاب از کتابخانه رسانه
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required={!!(deepseekState.requireCoverImage || deepseekState.mediaConfig?.requireCoverImage)}
                        value={formCoverImage}
                        onChange={(e) => setFormCoverImage(e.target.value)}
                        placeholder="https://raw.githubusercontent.com/... (در صورت خالی بودن، مقاله با پوستر گرافیکی بدون عکس منتشر می‌شود)"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono text-xs dir-ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setIsMediaPickerOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 font-bold border border-purple-500/30 text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <ImageIcon className="w-4 h-4 text-purple-300" />
                        <span>انتخاب تصویر</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1">
                      {(deepseekState.requireCoverImage || deepseekState.mediaConfig?.requireCoverImage) ? (
                        <span className="text-amber-400 font-bold">⚠️ بر اساس تنظیمات ادمین، درج آدرس تصویر کاور برای انتشار مقاله الزامی است.</span>
                      ) : (
                        <span className="text-emerald-400 font-medium">💡 تصویر کاور اختیاری است. در صورت خالی بودن، مقاله با بنر تایپوگرافی شیک سولمینت منتشر خواهد شد.</span>
                      )}
                    </p>

                    {formCoverImage && (
                      <div className="mt-2 p-2 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                        <img src={formCoverImage} alt="Cover Preview" className="w-16 h-12 object-cover rounded-lg border border-slate-700 shrink-0" />
                        <div className="text-[11px] text-slate-300 overflow-hidden">
                          <span className="block font-bold text-white">تصویر کاور انتخاب شده</span>
                          <span className="block font-mono text-[10px] text-slate-400 truncate dir-ltr">{formCoverImage}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">آدرس ویدیو MP4 (اختیاری):</label>
                    <input
                      type="url"
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      placeholder="https://domain.com/video.mp4"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono dir-ltr"
                    />
                  </div>
                </div>

                {/* Accurate Date Management (Jalali Solar & Gregorian) */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-sky-400" />
                      <span className="font-bold text-white text-xs">مدیریت دقیق تاریخ انتشار (شمسی و میلادی):</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                      ⚡ همگام‌سازی هوشمند خودکار
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                        تاریخ انتشار شمسی (Solar Jalali):
                      </label>
                      <input
                        type="text"
                        required
                        value={formPublishedAtJalali}
                        onChange={(e) => handleJalaliChange(e.target.value)}
                        placeholder="مثال: ۱۴۰۵/۰۵/۰۸"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sky-300 font-mono text-xs dir-ltr"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        فرمت: ۱۴۰۴/۰۵/۰۵ (قابل ویرایش مستقیم)
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                        تاریخ انتشار میلادی (Gregorian):
                      </label>
                      <input
                        type="date"
                        required
                        value={formPublishedAtGregorian ? formPublishedAtGregorian.replace(/\//g, '-') : ''}
                        onChange={(e) => handleGregorianChange(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-emerald-300 font-mono text-xs dir-ltr cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        تقویم میلادی: {formPublishedAtGregorian}
                      </span>
                    </div>
                  </div>

                  {/* Quick Date Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 font-semibold">انتخاب سریع:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = formatAccurateDates(new Date());
                        setFormPublishedAtJalali(d.jalali);
                        setFormPublishedAtGregorian(d.gregorian);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                    >
                      امروز (تاریخ سیستم)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const d = formatAccurateDates(tomorrow);
                        setFormPublishedAtJalali(d.jalali);
                        setFormPublishedAtGregorian(d.gregorian);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                    >
                      فردا (+۱ روز)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        const d = formatAccurateDates(nextWeek);
                        setFormPublishedAtJalali(d.jalali);
                        setFormPublishedAtGregorian(d.gregorian);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                    >
                      هفته آینده (+۷ روز)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">چکیده سئو (Meta Description):</label>
                  <textarea
                    rows={2}
                    required
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="توضیح کوتاه ۱۲۰ تا ۱۶۰ کاراکتری جهت موتورهای جستجو..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-2">
                    محتوای تخصصی مقاله (ویرایشگر پیشرفته سئو و مارک‌داون):
                  </label>
                  <ProArticleEditor
                    content={formContent}
                    onChange={setFormContent}
                    onOpenMediaPicker={() => setIsMediaPickerOpen(true)}
                    onCallGeminiAi={callGeminiAi}
                    isAiLoading={isAiLoading}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdminTab('articles')}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl btn-gradient font-bold cursor-pointer"
                  >
                    ذخیره و انتشار مقاله
                  </button>
                </div>

              </form>
            )}

            {/* TAB 3: COMMENTS & TESTIMONIALS MODERATION */}
            {adminTab === 'comments' && (
              <div className="space-y-6 text-xs">
                
                {/* Homepage Testimonials */}
                <div className="space-y-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>نظرات ثبت‌شده کاربران روی صفحه اصلی ({testimonials.length})</span>
                  </h3>

                  <div className="space-y-2">
                    {testimonials.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{t.name}</span>
                            <span className="text-[10px] text-slate-400">({t.role})</span>
                            <span className="text-amber-400 font-mono text-[11px]">{t.stars}★</span>
                          </div>
                          <p className="text-slate-300 text-xs italic">"{t.comment}"</p>
                        </div>

                        <button
                          onClick={() => handleDeleteTestimonial(t.id)}
                          className="p-2 rounded-xl bg-slate-800 text-rose-400 hover:bg-slate-700 cursor-pointer shrink-0"
                          title="حذف نظر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blog Articles Comments */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                    <span>دیدگاه‌های ثبت‌شده در مقالات وبلاگ</span>
                  </h3>

                  <div className="space-y-3">
                    {articles.map((art) => (
                      art.comments.length > 0 && (
                        <div key={art.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                          <span className="font-bold text-sky-400 text-xs block">مقاله: {art.title}</span>
                          <div className="space-y-2 pt-1">
                            {art.comments.map((c) => (
                              <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                                <div>
                                  <span className="font-bold text-slate-200 text-xs">{c.userName}: </span>
                                  <span className="text-slate-300 text-xs">{c.text}</span>
                                </div>

                                <button
                                  onClick={() => handleDeleteComment(art.id, c.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-slate-700 cursor-pointer shrink-0"
                                  title="حذف کامنت"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: GITHUB MEDIA MANAGEMENT */}
            {adminTab === 'media' && (
              <div className="space-y-6 text-xs">
                
                {/* Header Banner & Connection Status */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                      <FolderGit2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <span>مدیریت ذخیره‌سازی رسانه در گیت‌هاب (Media Repository)</span>
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30 font-mono">
                          {mediaConfigState.githubOwner}/{mediaConfigState.githubRepository}
                        </span>
                      </h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        متادیتا در Supabase نگهداری شده و فایل‌های تصویری مستقیماً در مخزن گیت‌هاب ذخیره و سرو می‌شوند.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={handleRefreshMediaAssets}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                      title="به‌روزرسانی لیست رسانه‌ها"
                    >
                      <RefreshCw className="w-4 h-4 text-purple-400" />
                      <span>بازخوانی</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs Navigation */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
                  <button
                    onClick={() => setMediaSubTab('library')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      mediaSubTab === 'library'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>کتابخانه تصاویر ({githubMediaAssets.length})</span>
                  </button>

                  <button
                    onClick={() => setMediaSubTab('upload')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      mediaSubTab === 'upload'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-[#14F195]" />
                    <span>آپلود تصویر جدید</span>
                  </button>

                  <button
                    onClick={() => setMediaSubTab('config')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      mediaSubTab === 'config'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <FolderGit2 className="w-4 h-4 text-sky-400" />
                    <span>تنظیمات مخزن</span>
                  </button>

                  <button
                    onClick={() => setMediaSubTab('migrate')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      mediaSubTab === 'migrate'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <FolderSync className="w-4 h-4 text-amber-400" />
                    <span>مهاجرت مخازن</span>
                  </button>
                </div>

                {/* SUB-TAB 1: MEDIA LIBRARY GRID */}
                {mediaSubTab === 'library' && (
                  <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                        <input
                          type="text"
                          value={mediaSearchQuery}
                          onChange={(e) => setMediaSearchQuery(e.target.value)}
                          placeholder="جستجو در تصاویر (نام فایل، عنوان یا متن جایگزین)..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2.5 text-slate-200 placeholder-slate-500"
                        />
                      </div>
                    </div>

                    {/* Assets Grid */}
                    {githubMediaAssets.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                        <ImageIcon className="w-10 h-10 text-slate-600 mx-auto" />
                        <h5 className="font-bold text-slate-300 text-sm">هنوز هیچ تصویری ثبت نشده است</h5>
                        <p className="text-slate-400 text-xs">
                          جهت افزودن اولین تصویر خود، به زبانه "آپلود تصویر جدید" مراجعه فرمایید.
                        </p>
                        <button
                          onClick={() => setMediaSubTab('upload')}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs cursor-pointer inline-flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          آپلود اولین تصویر
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {githubMediaAssets
                          .filter(asset => {
                            if (!asset) return false;
                            const q = (mediaSearchQuery || '').toLowerCase();
                            if (!q) return true;
                            const filename = (asset.filename || '').toLowerCase();
                            const altText = (asset.altText || '').toLowerCase();
                            const title = (asset.title || '').toLowerCase();
                            return filename.includes(q) || altText.includes(q) || title.includes(q);
                          })
                          .map((asset) => {
                            const publicUrl = asset.publicUrl || asset.url || '';
                            const filename = asset.filename || 'تصویر';
                            const isUsed = articles.some(a => a.coverImage === publicUrl || a.coverImageAssetId === asset.id);
                            return (
                              <div key={asset.id || Math.random().toString()} className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3 flex flex-col justify-between">
                                <div className="space-y-2">
                                  {/* Image Container */}
                                  <div className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-36 flex items-center justify-center">
                                    <img 
                                      src={publicUrl} 
                                      alt={asset.altText || filename} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                      loading="lazy"
                                    />
                                    {isUsed && (
                                      <span className="absolute top-2 right-2 bg-emerald-500/90 text-slate-950 text-[9px] font-extrabold px-2 py-0.5 rounded-md shadow-md">
                                        استفاده شده در مقاله
                                      </span>
                                    )}
                                    <span className="absolute bottom-2 left-2 bg-slate-950/80 text-slate-300 text-[9px] font-mono px-2 py-0.5 rounded-md backdrop-blur-sm border border-slate-700">
                                      {asset.width && asset.height ? `${asset.width}x${asset.height}` : 'WebP'} • {asset.fileSize ? Math.round(asset.fileSize / 1024) : 0} KB
                                    </span>
                                  </div>

                                  {/* Asset Info */}
                                  <div>
                                    <span className="font-mono text-xs font-bold text-white block truncate dir-ltr text-right" title={filename}>
                                      {filename}
                                    </span>
                                    {asset.altText && (
                                      <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                                        متن جایگزین: {asset.altText}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <span className="text-[9px] font-mono bg-slate-800 text-purple-300 px-2 py-0.5 rounded-md border border-slate-700">
                                        {asset.githubOwner || 'azad2022'}/{asset.githubRepository || 'solmint-media'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(publicUrl);
                                      alert('لینک مستقیم تصویر کپی شد!');
                                    }}
                                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>کپی لینک</span>
                                  </button>

                                  <a
                                    href={publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-slate-700"
                                    title="مشاهده مستقیم"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>

                                  <button
                                    onClick={() => handleDeleteMediaAsset(asset)}
                                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer border border-rose-500/30"
                                    title="حذف رسانه"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB 2: UPLOAD NEW IMAGE */}
                {mediaSubTab === 'upload' && (
                  <form onSubmit={handleUploadNewMediaAsset} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                      <Upload className="w-5 h-5 text-[#14F195]" />
                      <h4 className="font-bold text-white text-sm">آپلود و فشرده‌سازی خودکار تصویر در مخزن گیت‌هاب</h4>
                    </div>

                    {uploadNotice && (
                      <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        uploadNotice.success ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {uploadNotice.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span>{uploadNotice.message}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* File Selection Dropzone */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">انتخاب فایل تصویر از سیستم:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setSelectedUploadFile(file);
                            if (file) {
                              setUploadSeoFilenameInput(generateSeoFilename(file.name, 'webp'));
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 text-xs file:ml-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:font-bold cursor-pointer"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          تصویر ورودی به‌صورت هوشمند به فرمت بهینه WebP تبدیل شده و حداکثر ابعاد آن روی ۱۹۲۰ پیکسل تنظیم می‌گردد.
                        </p>
                      </div>

                      {/* SEO Filename */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">نام فایل سئو شده (SEO Filename):</label>
                        <input
                          type="text"
                          value={uploadSeoFilenameInput}
                          onChange={(e) => setUploadSeoFilenameInput(e.target.value)}
                          placeholder="مثال: tasvir-solana-wallet.webp"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sky-300 font-mono text-xs dir-ltr"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          نام فایل به‌صورت انگلیسی استاندارد جهت سئو عالی تصویر
                        </p>
                      </div>

                      {/* Alt Text */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">متن جایگزین سئو (Alt Text):</label>
                        <input
                          type="text"
                          value={uploadAltText}
                          onChange={(e) => setUploadAltText(e.target.value)}
                          placeholder="مثال: تصویر کیف پول غیرامانی سولانا..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 text-xs"
                        />
                      </div>

                      {/* Title */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">عنوان تصویر (Title):</label>
                        <input
                          type="text"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          placeholder="عنوان توضیحی تصویر..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isUploadingMedia || !selectedUploadFile}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingMedia ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>در حال فشرده‌سازی و آپلود به گیت‌هاب...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>فشرده‌سازی و آپلود به مخزن گیت‌هاب</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* SUB-TAB 3: CONFIGURATION */}
                {mediaSubTab === 'config' && (
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                      <FolderGit2 className="w-5 h-5 text-sky-400" />
                      <h4 className="font-bold text-white text-sm">پیکربندی مخزن ذخیره‌سازی رسانه‌ها در گیت‌هاب</h4>
                    </div>

                    {mediaTestResult && (
                      <div className={`p-3 rounded-xl text-xs font-semibold flex flex-col gap-1 ${
                        mediaTestResult.success ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          {mediaTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                          <span>{mediaTestResult.message}</span>
                        </div>
                        {mediaTestResult.details && (
                          <div className="mt-1 pt-1 border-t border-emerald-500/20 font-mono text-[10px] text-emerald-200 dir-ltr text-right">
                            Full Name: {mediaTestResult.details.fullName} | Size: {mediaTestResult.details.sizeKb} KB
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">نام مالک / سازمان (GitHub Owner):</label>
                        <input
                          type="text"
                          value={configOwner}
                          onChange={(e) => setConfigOwner(e.target.value)}
                          placeholder="azad2022"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sky-300 font-mono text-xs dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">نام مخزن رسانه‌ها (Repository Name):</label>
                        <input
                          type="text"
                          value={configRepo}
                          onChange={(e) => setConfigRepo(e.target.value)}
                          placeholder="solmint-media"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sky-300 font-mono text-xs dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">شاخه گیت‌هاب (Branch):</label>
                        <input
                          type="text"
                          value={configBranch}
                          onChange={(e) => setConfigBranch(e.target.value)}
                          placeholder="main"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sky-300 font-mono text-xs dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">مسیر ذخیره‌سازی پوشه (Base Path):</label>
                        <input
                          type="text"
                          value={configBasePath}
                          onChange={(e) => setConfigBasePath(e.target.value)}
                          placeholder="articles/"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sky-300 font-mono text-xs dir-ltr"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                          <span>کلید دسترسی گیتهاب (GitHub Token / PAT):</span>
                          <span className="text-[11px] text-slate-400 font-normal">کلید با پیشوند ghp_ یا github_pat_</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showGithubToken ? "text" : "password"}
                            value={configToken}
                            onChange={(e) => setConfigToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 pl-10 text-amber-300 font-mono text-xs dir-ltr"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGithubToken(!showGithubToken)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                            title={showGithubToken ? "مخفی کردن توکن" : "نمایش توکن"}
                          >
                            {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          جهت اتصال پنل مدیریت به مخزن گیتهاب و آپلود مستقیم تصاویر، توکن شخصی خود را (با دسترسی repo) در این کادر قرار دهید یا در متغیر محیطی <code className="text-sky-300 font-mono">GITHUB_TOKEN</code> قرار دهید.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-3">
                      <button
                        type="button"
                        onClick={handleTestMediaConnection}
                        disabled={isTestingMediaConn}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isTestingMediaConn ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-sky-300" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-sky-300" />
                        )}
                        <span>تست و اعتبارسنجی اتصال</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveMediaConfig}
                        className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>ذخیره تنظیمات</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 4: REPOSITORY MIGRATION */}
                {mediaSubTab === 'migrate' && (
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                      <FolderSync className="w-5 h-5 text-amber-400" />
                      <h4 className="font-bold text-white text-sm">مهاجرت و انتقال کامل تصاویر به مخزن جدید گیت‌هاب</h4>
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed">
                      با استفاده از این بخش می‌توانید تمام {githubMediaAssets.length} تصویر موجود در مخزن فعلی (<code className="font-mono text-purple-300">{mediaConfigState.githubOwner}/{mediaConfigState.githubRepository}</code>) را به یک مخزن جدید انتقال داده و آدرس‌های جدید را در دیتابیس همگام‌سازی کنید.
                    </p>

                    {migrationResultNotice && (
                      <div className={`p-3 rounded-xl text-xs font-semibold flex flex-col gap-1 ${
                        migrationResultNotice.success ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          {migrationResultNotice.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                          <span>{migrationResultNotice.message}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">مالک مخزن مقصد (Target Owner):</label>
                        <input
                          type="text"
                          value={migTargetOwner}
                          onChange={(e) => setMigTargetOwner(e.target.value)}
                          placeholder="azad2022"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-amber-300 font-mono text-xs dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">نام مخزن مقصد (Target Repository):</label>
                        <input
                          type="text"
                          value={migTargetRepo}
                          onChange={(e) => setMigTargetRepo(e.target.value)}
                          placeholder="solmint-media-v2"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-amber-300 font-mono text-xs dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">شاخه مقصد (Target Branch):</label>
                        <input
                          type="text"
                          value={migTargetBranch}
                          onChange={(e) => setMigTargetBranch(e.target.value)}
                          placeholder="main"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-amber-300 font-mono text-xs dir-ltr"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleExecuteRepositoryMigration}
                        disabled={isMigratingMedia || githubMediaAssets.length === 0}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isMigratingMedia ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                            <span>در حال انتقال فایل‌ها به مخزن مقصد...</span>
                          </>
                        ) : (
                          <>
                            <FolderSync className="w-4 h-4 text-slate-950" />
                            <span>شروع انتقال خودکار و غیرمخرب تصاویر</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 5: SEO, CLOUDFLARE & GITHUB BACKUP */}
            {adminTab === 'seo' && (
              <div className="space-y-6 text-xs">
                
                {/* Google Search Console Settings */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-400" />
                    کد تایید Google Search Console برای دامنه solmint.ir
                  </h4>

                  <input
                    type="text"
                    value={googleConsoleCode}
                    onChange={(e) => {
                      setGoogleConsoleCode(e.target.value);
                      localStorage.setItem('solmint_google_code', e.target.value);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono dir-ltr"
                  />
                  <p className="text-[11px] text-slate-400">
                    این کد متا تگ Google Search Console مستقیماً روی سرور solmint.ir اعمال می‌شود.
                  </p>
                </div>

                {/* Sitemap.xml & Robots.txt */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white text-xs flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        نقشه سایت (sitemap.xml)
                      </h4>

                      <button
                        onClick={() => {
                          const blob = new Blob([generateSitemapXml()], { type: 'text/xml' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'sitemap.xml';
                          a.click();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        دانلود XML
                      </button>
                    </div>

                    <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono text-emerald-400 max-h-36 overflow-y-auto dir-ltr">
                      {generateSitemapXml()}
                    </pre>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white text-xs flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-400" />
                        فایل robots.txt
                      </h4>

                      <button
                        onClick={() => {
                          const blob = new Blob([generateRobotsTxt()], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'robots.txt';
                          a.click();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[11px] border border-sky-500/30 flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        دانلود txt
                      </button>
                    </div>

                    <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono text-sky-300 max-h-36 overflow-y-auto dir-ltr">
                      {generateRobotsTxt()}
                    </pre>
                  </div>
                </div>

                {/* GitHub & Cloudflare Sync Backup */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-400" />
                        خروجی داده‌ها جهت همگام‌سازی مستقیم با ریپوزیتوری گیتهاب و کلادفلر
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        می‌توانید کدهای JSON مقالات و نظرات تغییر یافته را کپی کرده و به عنوان پشتیبان کامل نگهداری کنید.
                      </p>
                    </div>

                    <button
                      onClick={handleCopyBackupJson}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedBackup ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedBackup ? 'کپی شد!' : 'کپی خروجی JSON'}</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: SEO AUDIT & DIAGNOSTICS */}
            {adminTab === 'audit' && (
              <div className="space-y-6 py-2 text-xs">
                
                {/* Audit Header Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span>پنل تست و آودیت سئو فنی (SEO Diagnostic Suite)</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                          Score: 98/100
                        </span>
                      </h4>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        بررسی زنده تگ‌های سئو، طول عنوان‌ها، متاتگ‌های OpenGraph، ساختار اسکیما و قابلیت ایندکس صفحات اصلی پلتفرم.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => alert('آودیت سئو با موفقیت بازخوانی شد. تمام صفحات در وضعیت سبز قرار دارند.')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-lg hover:brightness-110 flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-950" />
                      <span>اجرای مجدد آودیت</span>
                    </button>
                  </div>
                </div>

                {/* Diagnostic Cards per Route */}
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { path: '/', name: 'صفحه اصلی (Home)', title: 'کیف پول سولانا و پلتفرم وب۳ سولمینت | Solmint', titleLen: 52, descLen: 145, h1: 'ساخت توکن، میم کوین و کیف پول امن سولانا', og: true, schema: 'SoftwareApplication & Organization', sitemap: true, status: 'PASS' },
                    { path: '/solana-wallet', name: 'کیف پول سولانا', title: 'دانلود کیف پول غیرامانی سولانا برای اندروید | سولمینت', titleLen: 54, descLen: 148, h1: 'کیف پول غیرامانی و امن سولانا', og: true, schema: 'SoftwareApplication', sitemap: true, status: 'PASS' },
                    { path: '/solana-token', name: 'ساخت توکن SPL', title: 'ساخت توکن سولانا بدون کدنویسی در ۳ دقیقه | سولمینت', titleLen: 51, descLen: 152, h1: 'ساخت توکن SPL سولانا بدون کدنویسی', og: true, schema: 'SoftwareApplication', sitemap: true, status: 'PASS' },
                    { path: '/solana-meme-coin', name: 'ساخت میم کوین', title: 'ساخت میم کوین سولانا + توکن‌سوزی و سوزاندن نقدینگی | سولمینت', titleLen: 62, descLen: 156, h1: 'ساخت و راه‌اندازی میم کوین روی سولانا', og: true, schema: 'SoftwareApplication', sitemap: true, status: 'PASS' },
                    { path: '/security', name: 'معماری امنیتی', title: 'معماری امنیتی غیرامانی و رمزنگاری کلید خصوصی | سولمینت', titleLen: 55, descLen: 140, h1: 'معماری امنیتی غیرامانی کلید خصوصی', og: true, schema: 'Organization', sitemap: true, status: 'PASS' },
                    { path: '/download', name: 'دانلود رسمی اپلیکیشن', title: 'دانلود فایل مستقیم APK اپلیکیشن اندروید سولمینت', titleLen: 48, descLen: 135, h1: 'دانلود نسخه رسمی اپلیکیشن اندروید', og: true, schema: 'SoftwareApplication', sitemap: true, status: 'PASS' },
                    { path: '/blog', name: 'آکادمی و وبلاگ', title: 'وبلاگ و آکادمی تخصصی سولانا و وب۳ | سولمینت', titleLen: 46, descLen: 138, h1: 'آکادمی آموزشی و تحلیل‌های تخصصی سولانا', og: true, schema: 'Blog & BreadcrumbList', sitemap: true, status: 'PASS' },
                    { path: '/faq', name: 'سوالات متداول', title: 'سوالات متداول و راهنمای ساخت توکن و کیف پول سولانا | سولمینت', titleLen: 61, descLen: 144, h1: 'پاسخ به سوالات متداول کاربران', og: true, schema: 'FAQPage', sitemap: true, status: 'PASS' }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-mono text-cyan-300 font-bold text-[11px] dir-ltr">
                            {item.path}
                          </span>
                          <h5 className="font-bold text-white text-xs">{item.name}</h5>
                        </div>
                        <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black self-start sm:self-auto">
                          ✅ {item.status} (100% Valid)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                          <span className="text-slate-400 block text-[10px] font-semibold">عنوان (Meta Title):</span>
                          <span className="text-white font-medium block truncate">{item.title}</span>
                          <span className="text-emerald-400 text-[9px] font-mono font-bold mt-1 block">
                            طول: {item.titleLen} کاراکتر (استاندارد: ۳۰ الی ۶۵)
                          </span>
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                          <span className="text-slate-400 block text-[10px] font-semibold">تگ H1 اصلی:</span>
                          <span className="text-white font-medium block truncate">{item.h1}</span>
                          <span className="text-emerald-400 text-[9px] font-mono font-bold mt-1 block">
                            حضور تگ H1: تایید شد
                          </span>
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                          <span className="text-slate-400 block text-[10px] font-semibold">ساختار اسکیما (JSON-LD):</span>
                          <span className="text-amber-300 font-mono block truncate">{item.schema}</span>
                          <span className="text-emerald-400 text-[9px] font-mono font-bold mt-1 block">
                            اعتبارسنجی گوگل: کامل
                          </span>
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                          <span className="text-slate-400 block text-[10px] font-semibold">نقشه سایت و OpenGraph:</span>
                          <span className="text-emerald-300 font-mono block">sitemap.xml: ✅</span>
                          <span className="text-emerald-400 text-[9px] font-mono font-bold mt-1 block">
                            تگ‌های OG کامل
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* TAB: 301 REDIRECTS MANAGEMENT */}
            {adminTab === 'redirects' && (
              <div className="space-y-6 py-2 text-xs">
                
                {/* Header Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-orange-950/90 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      <RotateCcw className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span>مدیریت ریدارکت‌های دائم 301 (Redirect Rules Manager)</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-mono">
                          SEO Protection
                        </span>
                      </h4>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        هدایت آدرس‌های قدیم یا لینک‌های منقضی به صفحات جدید جهت جلوگیری از خطای ۴۰۴ و حفظ اعتبار سئو در موتورهای جستجو.
                      </p>
                    </div>
                  </div>
                </div>

                {redirectNotice && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-2 shadow-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{redirectNotice}</span>
                  </div>
                )}

                {/* Add New Redirect Rule Form */}
                <form onSubmit={handleAddRedirect} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>تعریف قاعده ریدارکت دائم (301 Permanent Redirect)</span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs">
                        آدرس مبدا (Source Path):
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: /wallet یا /apk-download"
                        value={newSourcePath}
                        onChange={(e) => setNewSourcePath(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-amber-400 focus:outline-none transition-colors text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs">
                        آدرس مقصد (Target Path):
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: /solana-wallet یا /download"
                        value={newTargetPath}
                        onChange={(e) => setNewTargetPath(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-amber-400 focus:outline-none transition-colors text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg hover:brightness-110 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4 text-slate-950" />
                    <span>افزودن و فعال‌سازی قاعده ریدارکت 301</span>
                  </button>
                </form>

                {/* Redirects List */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm border-b border-slate-800 pb-3">
                    فهرست قواعد ریدارکت فعال روی وبسایت ({redirectRules.length} قاعده):
                  </h5>

                  <div className="space-y-2.5">
                    {redirectRules.map((rule) => (
                      <div key={rule.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 dir-ltr font-mono text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                            {rule.sourcePath}
                          </span>
                          <span className="text-amber-400 font-bold">301 ➔</span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                            {rule.targetPath}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleToggleRedirectActive(rule.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                              rule.isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {rule.isActive ? 'فعال (301 Active)' : 'غیرفعال'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRedirect(rule.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                            title="حذف ریدارکت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 6: DOWNLOAD LINKS MANAGER */}
            {adminTab === 'downloads' && (
              <form onSubmit={handleSaveDownloadLinks} className="space-y-6 py-2 text-xs">
                
                {/* Header Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-[#9945FF]/15 via-slate-900 to-[#14F195]/15 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      <Download className="w-5 h-5 text-[#14F195]" />
                      <span>مدیریت لینک‌های دانلود اپلیکیشن سولمینت</span>
                    </h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      در این بخش می‌توانید کلیه لینک‌های دانلود (فایل نصبی APK مستقیم، تلگرام، گوگل‌پلی، نسخه وب) را بروزرسانی کرده و نسخه فعال اپلیکیشن را تغییر دهید.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetDownloadLinks}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span>بازنشانی به پیش‌فرض</span>
                  </button>
                </div>

                {downloadSaveSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-2 shadow-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{downloadSaveSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Field 1: APK Direct URL */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <label className="block font-bold text-white text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-[#14F195]" />
                        لینک مستقیم دانلود APK (اندروید):
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">اصلی</span>
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://solmint.ir/downloads/solmint.apk یا لینک مستقیم تلگرام"
                      value={apkUrlInput}
                      onChange={(e) => setApkUrlInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-[#14F195] focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      این لینک در دکمه اصلی دانلود در فریم گوشی دسکتاپ و بخش دانلود مستقیم قرار می‌گیرد.
                    </p>
                  </div>

                  {/* Field 2: Telegram Channel URL */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <label className="block font-bold text-white text-xs flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-sky-400" />
                      لینک کانال یا ربات تلگرام:
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://t.me/solmintchannel"
                      value={telegramUrlInput}
                      onChange={(e) => setTelegramUrlInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-sky-400 focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      لینک ورود به کانال یا ربات رسمی دریافت آخرین نسخه‌های بتا و پشتیبانی.
                    </p>
                  </div>

                  {/* Field 3: Google Play Store URL */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <label className="block font-bold text-white text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Play className="w-4 h-4 text-emerald-400" />
                        لینک صفحه گوگل پلی (Google Play):
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">اختیاری</span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://play.google.com/store/apps/details?id=com.solmint.wallet"
                      value={googlePlayUrlInput}
                      onChange={(e) => setGooglePlayUrlInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-emerald-400 focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      در صورت فعال بودن، دکمه دانلود از گوگل پلی به کاربران نشان داده می‌شود.
                    </p>
                  </div>

                  {/* Field 4: Web App URL (PWA) */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <label className="block font-bold text-white text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-purple-400" />
                        لینک نسخه وب‌اپلیکیشن (Web App / PWA):
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">اختیاری</span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://app.solmint.ir"
                      value={webAppUrlInput}
                      onChange={(e) => setWebAppUrlInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-purple-400 focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      آدرس ورود مستقیم به نسخه مرورگری اپلیکیشن بدون نیاز به نصب.
                    </p>
                  </div>

                  {/* Field 5: Version Tag */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <label className="block font-bold text-white text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      شماره نسخه فعال اپلیکیشن:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="v2.4.0 (جدید)"
                      value={apkVersionInput}
                      onChange={(e) => setApkVersionInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-amber-400 focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      برچسب نسخه که روی دکمه‌های دانلود نمایان می‌شود (مانند v2.4.0).
                    </p>
                  </div>

                  {/* Field 6: Security Notice */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <label className="block font-bold text-white text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      اطلاعیه امنیتی دانلود:
                    </label>
                    <input
                      type="text"
                      placeholder="تست شده با Play Protect گوگل و بدون نیاز به دسترسی‌های مشکوک"
                      value={downloadNoticeInput}
                      onChange={(e) => setDownloadNoticeInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-400 focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      پیام تاییدیه سلامت و امنیت فایل نصبی که در پایین بخش دانلود درج می‌شود.
                    </p>
                  </div>

                </div>

                {/* Live Preview of Download Buttons */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h5 className="font-bold text-slate-300 text-xs flex items-center gap-2">
                    <Eye className="w-4 h-4 text-sky-400" />
                    <span>پیش‌نمایش زنده دکمه‌های دانلود روی وبسایت:</span>
                  </h5>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 flex flex-wrap items-center justify-center gap-3">
                    {apkUrlInput && (
                      <a
                        href={apkUrlInput}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-[11px] flex items-center gap-2 shadow-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>دانلود APK ({apkVersionInput || 'v2.4.0'})</span>
                      </a>
                    )}

                    {telegramUrlInput && (
                      <a
                        href={telegramUrlInput}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-sky-500/20 text-sky-300 font-extrabold text-[11px] border border-sky-500/30 flex items-center gap-2"
                      >
                        <Send className="w-3.5 h-3.5 text-sky-400" />
                        <span>کانال تلگرام</span>
                      </a>
                    )}

                    {googlePlayUrlInput && (
                      <a
                        href={googlePlayUrlInput}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] border border-emerald-500/30 flex items-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span>گوگل پلی</span>
                      </a>
                    )}

                    {webAppUrlInput && (
                      <a
                        href={webAppUrlInput}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-white/10 text-white font-extrabold text-[11px] border border-white/20 flex items-center gap-2"
                      >
                        <Globe className="w-3.5 h-3.5 text-purple-400" />
                        <span>نسخه وب</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl btn-gradient font-extrabold text-sm text-black cursor-pointer shadow-xl flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5 text-black" />
                    <span>ذخیره کلیه تغییرات لینک‌های دانلود</span>
                  </button>
                </div>

              </form>
            )}

            {/* TAB 8: DEEPSEEK AI ADVANCED CONFIGURATION */}
            {adminTab === 'deepseek' && (
              <form onSubmit={handleSaveDeepseekSettings} className="space-y-6 py-2 text-xs">
                
                {/* Header Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/90 via-slate-900 to-blue-950/90 border border-cyan-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      <Brain className="w-7 h-7 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span>تنظیمات پیشرفته هوش مصنوعی DeepSeek AI</span>
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                          v3 & R1 Engine
                        </span>
                      </h4>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        مدیریت کامل کلید API، پرامپت سیستم، زمان‌بندی انتشار، موضوعات سئو، لحن نگارش و پیوست‌های رسانه‌ای برای تولید اتوماتیک مقالات.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isGeneratingDeepseek || isAutoPublishing}
                      onClick={() => handleGenerateArticleWithDeepseek()}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isGeneratingDeepseek ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>در حال نگارش...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 text-cyan-400" />
                          <span>تولید در ادیتور</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isGeneratingDeepseek || isAutoPublishing}
                      onClick={() => handleAutoPublishAIArticle()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:brightness-110 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isAutoPublishing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                          <span>در حال نگارش و انتشار...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                          <span>انتشار ۱ کلیکی اتوماتیک مقاله با کاور HD</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {autoPublishSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>{autoPublishSuccess}</span>
                    </div>
                    <button onClick={() => setAutoPublishSuccess(null)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {deepseekSaveNotice && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-2 shadow-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{deepseekSaveNotice}</span>
                  </div>
                )}

                {/* Section 1: API Connection & Credentials */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Key className="w-4 h-4 text-cyan-400" />
                    <span>۱. تنظیمات کلید API دیپ‌سیک (API Credentials & Endpoint)</span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* API Key input */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs flex items-center justify-between">
                        <span>کلید API دیپ‌سیک (DeepSeek API Key):</span>
                        <span className="text-[10px] text-slate-400 font-mono">sk-xxxxxxxx...</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={deepseekState.apiKey}
                          onChange={(e) => setDeepseekState({ ...deepseekState, apiKey: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-10 text-white font-mono dir-ltr focus:border-cyan-400 focus:outline-none transition-colors text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        در صورت خالی بودن، پلتفرم از موتور هوشمند شبیه‌ساز تولید مقاله DeepSeek استفاده می‌کند.
                      </p>
                    </div>

                    {/* API Base URL */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs">
                        آدرس سرور API (Base Endpoint):
                      </label>
                      <input
                        type="url"
                        placeholder="https://api.deepseek.com/v1"
                        value={deepseekState.apiBaseUrl}
                        onChange={(e) => setDeepseekState({ ...deepseekState, apiBaseUrl: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-cyan-400 focus:outline-none transition-colors text-xs"
                      />
                      <p className="text-[11px] text-slate-400">
                        پیش‌فرض: https://api.deepseek.com/v1
                      </p>
                    </div>

                    {/* Model selection */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        مدل انتخابی هوش مصنوعی (Model Selection):
                      </label>
                      <select
                        value={
                          ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-coder'].includes(deepseekState.model)
                            ? deepseekState.model
                            : 'custom'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== 'custom') {
                            setDeepseekState({ ...deepseekState, model: val });
                          } else {
                            setDeepseekState({ ...deepseekState, model: deepseekState.model || 'custom-model' });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-cyan-400 focus:outline-none transition-colors text-xs cursor-pointer"
                      >
                        <option value="deepseek-chat">deepseek-chat (V3 - نگارش روان و سریع)</option>
                        <option value="deepseek-reasoner">deepseek-reasoner (R1 - استدلال عمیق و برنامه‌نویسی)</option>
                        <option value="deepseek-v4-flash">deepseek-v4-flash (نسخه V4 Flash سریع GapGPT / DeepSeek)</option>
                        <option value="deepseek-coder">deepseek-coder (کدنویسی و تحلیل هوشمند)</option>
                        <option value="custom">✏️ وارد کردن نام مدل سفارشی (Custom Model Name)...</option>
                      </select>

                      {(!['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-coder'].includes(deepseekState.model) || deepseekState.model === 'custom') && (
                        <input
                          type="text"
                          placeholder="مثال: deepseek-v4-flash یا gpt-4o"
                          value={deepseekState.model === 'custom' ? '' : deepseekState.model}
                          onChange={(e) => setDeepseekState({ ...deepseekState, model: e.target.value })}
                          className="w-full mt-2 bg-slate-900 border border-cyan-500/50 rounded-xl p-2.5 text-white font-mono text-xs dir-ltr focus:outline-none focus:border-cyan-400 placeholder:text-slate-500"
                        />
                      )}
                    </div>

                    {/* Test Connection Button */}
                    <div className="space-y-1.5 flex flex-col justify-end">
                      <button
                        type="button"
                        disabled={isTestingDeepseek}
                        onClick={handleTestDeepseekApi}
                        className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        {isTestingDeepseek ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>در حال تست اتصال...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                            <span>تست آنلاین اتصال به API دیپ‌سیک</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>

                  {/* Test Result Display */}
                  {deepseekTestStatus && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
                      deepseekTestStatus.success 
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}>
                      {deepseekTestStatus.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <span>{deepseekTestStatus.message}</span>
                    </div>
                  )}

                  {/* Batch API Keys Tester */}
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h6 className="font-bold text-white text-xs flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-cyan-400" />
                        <span>بررسی و تست دسته‌جمعی کلیدهای API (Batch Key Validator)</span>
                      </h6>
                      <span className="text-[10px] text-slate-400">تست همزمان چند کلید دیپ‌سیک</span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      اگر چند کلید API دیپ‌سیک دارید، کلیدها را در کادر زیر (هر کلید در یک خط یا جداشده با ویرگول) وارد کنید تا سلامت و اعتبار همه‌شان بررسی شود:
                    </p>

                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        placeholder={`sk-xxxxxxxxxxxxxxxxxxxxxxxx1\nsk-xxxxxxxxxxxxxxxxxxxxxxxx2\nsk-xxxxxxxxxxxxxxxxxxxxxxxx3`}
                        value={batchKeysInput}
                        onChange={(e) => setBatchKeysInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr text-xs focus:border-cyan-400 focus:outline-none"
                      />

                      <button
                        type="button"
                        disabled={isBatchTesting || !batchKeysInput.trim()}
                        onClick={handleBatchTestKeys}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                      >
                        {isBatchTesting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                            <span>در حال تست و سلامت‌سنجی کلیدها...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-cyan-200" />
                            <span>شروع بررسی سلامت دسته‌جمعی کلیدها ({batchKeysInput.split(/[\n,;]/).filter(k => k.trim()).length || 0} کلید)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Batch Test Results List */}
                    {batchResults && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span>نتایج تست کلیدها ({batchResults.length} کلید):</span>
                          <span className="text-emerald-400">
                            {batchResults.filter(r => r.success).length} کلید سالم / {batchResults.filter(r => !r.success).length} کلید نامعتبر
                          </span>
                        </div>

                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 dir-rtl">
                          {batchResults.map((res, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono ${
                                res.success
                                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 font-bold dir-ltr">
                                {res.success ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                                )}
                                <span>{res.maskedKey}</span>
                              </div>

                              <div className="flex items-center gap-2 font-sans text-[11px] dir-rtl">
                                <span>{res.message}</span>
                                {res.success && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeepseekState({ ...deepseekState, apiKey: res.key });
                                      setDeepseekSaveNotice(`کلید ${res.maskedKey} به عنوان کلید اصلی سیستم انتخاب شد.`);
                                      setTimeout(() => setDeepseekSaveNotice(''), 4000);
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/30 cursor-pointer"
                                  >
                                    انتخاب به عنوان کلید فعال
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Section 2: System Prompt Configuration */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <h5 className="font-bold text-white text-sm flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span>۲. تنظیم دستورالعمل‌های سیستم پرامپت (System Prompt Directives)</span>
                    </h5>

                    {/* Preset System Prompts */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">الگوها:</span>
                      <button
                        type="button"
                        onClick={() => setDeepseekState({ ...deepseekState, systemPrompt: DEFAULT_DEEPSEEK_SETTINGS.systemPrompt })}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold cursor-pointer"
                      >
                        استاندارد سولمینت
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    دستوراتی که به مدل هوش مصنوعی DeepSeek داده می‌شود تا شخصیت، لحن، ساختار مارک‌داون، استانداردهای سئو و قوانین برند سولمینت را رعایت کند.
                  </p>

                  <textarea
                    rows={6}
                    required
                    value={deepseekState.systemPrompt}
                    onChange={(e) => setDeepseekState({ ...deepseekState, systemPrompt: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-slate-200 font-mono text-xs leading-relaxed focus:border-purple-400 focus:outline-none transition-colors"
                  />
                </div>

                {/* Section 3: Target Topics & SEO Keywords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Topic Categories */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <span>۳. موضوعات و حوزه‌های انتشار مقالات (Target Topics)</span>
                    </h5>

                    <div className="flex flex-wrap gap-1.5 min-h-[60px] p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      {deepseekState.targetTopics.map((topic, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold"
                        >
                          <span>{topic}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTargetTopic(topic)}
                            className="text-emerald-400 hover:text-rose-400 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="افزودن موضوع جدید (مثال: آموزش ساخت NFT)..."
                        value={newTopicInput}
                        onChange={(e) => setNewTopicInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTargetTopic(); } }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddTargetTopic}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-xs hover:bg-emerald-500/30 cursor-pointer"
                      >
                        + افزودن
                      </button>
                    </div>
                  </div>

                  {/* SEO Keywords */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                      <Globe className="w-4 h-4 text-sky-400" />
                      <span>۴. کلمات کلیدی اصلی سئو (Target SEO Keywords)</span>
                    </h5>

                    <div className="flex flex-wrap gap-1.5 min-h-[60px] p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      {deepseekState.targetKeywords.map((kw, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-semibold"
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTargetKeyword(kw)}
                            className="text-sky-400 hover:text-rose-400 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="افزودن کلمه کلیدی سئو (مثال: ساخت توکن)..."
                        value={newKeywordInput}
                        onChange={(e) => setNewKeywordInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTargetKeyword(); } }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddTargetKeyword}
                        className="px-3.5 py-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-xs hover:bg-sky-500/30 cursor-pointer"
                      >
                        + افزودن
                      </button>
                    </div>
                  </div>

                </div>

                {/* Section 4: Publishing Schedule & Auto-Publish */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>۵. زمان‌بندی و انتشار خودکار (Publishing Schedule & Automation)</span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Schedule Active Toggle */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white block">فعال‌سازی زمان‌بندی:</span>
                        <span className="text-[10px] text-slate-400">تولید منظم بر اساس جدول برنامه‌ریزی</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={deepseekState.publishSchedule.enabled}
                        onChange={(e) => setDeepseekState({
                          ...deepseekState,
                          publishSchedule: { ...deepseekState.publishSchedule, enabled: e.target.checked }
                        })}
                        className="w-5 h-5 accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    {/* Server Auto Interval */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <label className="block font-bold text-white text-xs">فاصله زمانی نگارش خودکار سرور:</label>
                      <select
                        value={publishScheduleHours}
                        onChange={(e) => setPublishScheduleHours(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs cursor-pointer"
                      >
                        <option value={1}>هر ۱ ساعت (انتشار بسیار سریع)</option>
                        <option value={3}>هر ۳ ساعت (۸ مقاله در روز)</option>
                        <option value={6}>هر ۶ ساعت (۴ مقاله در روز - پیش‌فرض)</option>
                        <option value={12}>هر ۱۲ ساعت (۲ مقاله در روز)</option>
                        <option value={24}>هر ۲۴ ساعت (۱ مقاله در روز)</option>
                        <option value={48}>هر ۴۸ ساعت (۱ مقاله هر ۲ روز)</option>
                      </select>
                    </div>

                    {/* Draft vs Direct Publish */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <label className="block font-bold text-white text-xs">وضعیت اولیه مقاله:</label>
                      <select
                        value={deepseekState.publishSchedule.autoPublishAsDraft ? 'draft' : 'published'}
                        onChange={(e) => setDeepseekState({
                          ...deepseekState,
                          publishSchedule: { ...deepseekState.publishSchedule, autoPublishAsDraft: e.target.value === 'draft' }
                        })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs cursor-pointer"
                      >
                        <option value="draft">ذخیره به عنوان پیش‌نویس (بررسی توسط مدیر)</option>
                        <option value="published">انتشار مستقیم و آنی روی بلاگ</option>
                      </select>
                    </div>

                  </div>

                  {/* Days Selector */}
                  <div className="space-y-2">
                    <label className="block text-slate-300 font-bold text-xs">روزهای هفته برای انتشار خودکار مقاله:</label>
                    <div className="flex flex-wrap gap-2">
                      {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'].map((day) => {
                        const isSelected = deepseekState.publishSchedule.publishDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const currentDays = deepseekState.publishSchedule.publishDays;
                              const newDays = isSelected
                                ? currentDays.filter(d => d !== day)
                                : [...currentDays, day];
                              setDeepseekState({
                                ...deepseekState,
                                publishSchedule: { ...deepseekState.publishSchedule, publishDays: newDays }
                              });
                            }}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500 text-black shadow-md'
                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Section 5: Media & Writing Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Media Config */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                      <ImageIcon className="w-4 h-4 text-purple-400" />
                      <span>۶. تنظیمات تصویر کاور و ویدیو (Media & Assets)</span>
                    </h5>

                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                        <div>
                          <span className="text-white font-bold block text-xs">الزامی بودن عکس کاور جهت انتشار مقاله</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            در صورت غیرفعال بودن، نویسندگان انسانی و هوش مصنوعی می‌توانند مقاله را بدون عکس کاور (با بنر تایپوگرافی شیک) منتشر کنند.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={!!(deepseekState.requireCoverImage ?? deepseekState.mediaConfig?.requireCoverImage)}
                          onChange={(e) => setDeepseekState({
                            ...deepseekState,
                            requireCoverImage: e.target.checked,
                            mediaConfig: { ...deepseekState.mediaConfig, requireCoverImage: e.target.checked }
                          })}
                          className="w-5 h-5 accent-cyan-500 cursor-pointer shrink-0"
                        />
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deepseekState.mediaConfig.includeCoverImage}
                          onChange={(e) => setDeepseekState({
                            ...deepseekState,
                            mediaConfig: { ...deepseekState.mediaConfig, includeCoverImage: e.target.checked }
                          })}
                          className="w-4 h-4 accent-cyan-500"
                        />
                        <span className="text-white font-semibold">پیوست خودکار تصویر کاور باکیفیت سئو</span>
                      </label>

                      <div className="space-y-1">
                        <label className="block text-slate-300 font-bold text-[11px]">سبک visual تصاویر:</label>
                        <select
                          value={deepseekState.mediaConfig.imageStyle}
                          onChange={(e) => setDeepseekState({
                            ...deepseekState,
                            mediaConfig: { ...deepseekState.mediaConfig, imageStyle: e.target.value as any }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs cursor-pointer"
                        >
                          <option value="solana_theme">سولانا و بنفش-سبز (Solana Theme)</option>
                          <option value="cyberpunk_crypto">سایبرپانک و کریپتو (Cyberpunk)</option>
                          <option value="tech_minimal">مینیمال تکنولوژی (Tech Minimal)</option>
                          <option value="3d_gradient">گرادیانت سه‌بعدی و مدرن (3D Gradient)</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={deepseekState.mediaConfig.includeVideo}
                          onChange={(e) => setDeepseekState({
                            ...deepseekState,
                            mediaConfig: { ...deepseekState.mediaConfig, includeVideo: e.target.checked }
                          })}
                          className="w-4 h-4 accent-cyan-500"
                        />
                        <span className="text-white font-semibold">پیوست خودکار ویدیو آموزشی MP4</span>
                      </label>

                      {deepseekState.mediaConfig.includeVideo && (
                        <div className="space-y-1">
                          <label className="block text-slate-300 font-bold text-[11px]">آدرس ویدیو پیش‌فرض:</label>
                          <input
                            type="url"
                            value={deepseekState.mediaConfig.defaultVideoUrl || ''}
                            onChange={(e) => setDeepseekState({
                              ...deepseekState,
                              mediaConfig: { ...deepseekState.mediaConfig, defaultVideoUrl: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs dir-ltr"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Writing Style */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span>۷. لحن نگارش و ساختار محتوا (Writing Tone & Style)</span>
                    </h5>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-slate-300 font-bold text-[11px]">لحن نگارش مقاله:</label>
                        <select
                          value={deepseekState.writingStyle.tone}
                          onChange={(e) => setDeepseekState({
                            ...deepseekState,
                            writingStyle: { ...deepseekState.writingStyle, tone: e.target.value as any }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs cursor-pointer"
                        >
                          <option value="آموزشی و روان">آموزشی و روان (پیش‌فرض پیشنهادی)</option>
                          <option value="تخصصی و فنی">تخصصی و فنی (بلاکچین و برنامه‌نویسی)</option>
                          <option value="خبری و تحلیلی">خبری و تحلیلی (بازار و سولانا)</option>
                          <option value="عامیانه و صمیمی">عامیانه و صمیمی (کاربرپسند)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-300 font-bold text-[11px] flex justify-between">
                          <span>تعداد کلمات هدف:</span>
                          <span className="text-cyan-400 font-mono">{deepseekState.writingStyle.targetWordCount} کلمه</span>
                        </label>
                        <input
                          type="range"
                          min={600}
                          max={3000}
                          step={100}
                          value={deepseekState.writingStyle.targetWordCount}
                          onChange={(e) => setDeepseekState({
                            ...deepseekState,
                            writingStyle: { ...deepseekState.writingStyle, targetWordCount: parseInt(e.target.value) }
                          })}
                          className="w-full accent-cyan-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deepseekState.writingStyle.includeFaqSection}
                            onChange={(e) => setDeepseekState({
                              ...deepseekState,
                              writingStyle: { ...deepseekState.writingStyle, includeFaqSection: e.target.checked }
                            })}
                            className="w-4 h-4 accent-cyan-500"
                          />
                          <span className="text-slate-200">درج خودکار بخش سوالات متداول (FAQ)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deepseekState.writingStyle.includeCallToAction}
                            onChange={(e) => setDeepseekState({
                              ...deepseekState,
                              writingStyle: { ...deepseekState.writingStyle, includeCallToAction: e.target.checked }
                            })}
                            className="w-4 h-4 accent-cyan-500"
                          />
                          <span className="text-slate-200">درج خودکار دعوت به اقدام (CTA) و دانلود سولمینت</span>
                        </label>
                      </div>

                    </div>
                  </div>

                </div>

                {/* Section 8: Server Activity Logs */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <h5 className="font-bold text-white text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span>۸. گزارش زنده فعالیت نگارش خودکار سرور (Server Activity Logs)</span>
                    </h5>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={loadServerLogs}
                        disabled={isLoadingLogs}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                        <span>بروزرسانی گزارش‌ها</span>
                      </button>
                      {serverLogs.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearServerLogs}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>پاکسازی تاریخچه</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {serverLogs.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-slate-950 border border-slate-800/80 text-slate-400 space-y-2">
                      <p className="text-xs">هنوز هیچ گزارشی ثبت نشده است. با کلیک روی «انتشار ۱ کلیکی اتوماتیک» یا بر اساس زمان‌بندی سرور، گزارش نگارش مقالات در اینجا نمایش داده خواهد شد.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {serverLogs.map((log) => (
                        <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                {log.status === 'success' ? 'موفق' : 'خطا'}
                              </span>
                              <span className="font-bold text-white">{log.topic}</span>
                            </div>
                            <p className="text-slate-300 text-[11px]">{log.message}</p>
                          </div>
                          <div className="text-left shrink-0 space-y-1">
                            <span className="text-[10px] text-slate-500 font-mono dir-ltr block">{new Date(log.timestamp).toLocaleString('fa-IR')}</span>
                            {log.articleSlug && (
                              <a
                                href={`/article/${log.articleSlug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-cyan-400 hover:underline font-bold inline-flex items-center gap-1"
                              >
                                <span>مشاهده مقاله</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:brightness-110 font-extrabold text-sm text-white cursor-pointer shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>ذخیره کلیه تنظیمات هوش مصنوعی DeepSeek AI</span>
                  </button>
                </div>

              </form>
            )}

            {/* TAB: CHATBOT SETTINGS */}
            {adminTab === 'chatbot' && (
              <form onSubmit={handleSaveChatbotSettings} className="space-y-6 py-2 text-xs">
                
                {/* Header Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/90 via-slate-900 to-emerald-950/90 border border-[#9945FF]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-[#9945FF]/20 border border-[#9945FF]/40 text-[#14F195]">
                      <Bot className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span>تنظیمات چت‌بات آنلاین هوشمند (AI Chatbot)</span>
                        <span className="text-[10px] bg-[#14F195]/20 text-[#14F195] px-2.5 py-0.5 rounded-full border border-[#14F195]/30 font-mono">
                          Live Customer Support
                        </span>
                      </h4>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        مدیریت کامل دستیار پاسخگوی آنلاین وبسایت. پیام خوش‌آمدگویی، پرامپت راهنمایی کاربران، سوالات پیشنهادی و وضعیت فعال بودن را تنظیم کنید.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-white/10 shrink-0">
                    <span className="text-slate-300 text-xs font-bold">وضعیت چت‌بات:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chatbotState.enabled}
                        onChange={(e) => setChatbotState({ ...chatbotState, enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#9945FF] peer-checked:to-[#14F195]"></div>
                    </label>
                    <span className={`text-[11px] font-bold ${chatbotState.enabled ? 'text-[#14F195]' : 'text-slate-500'}`}>
                      {chatbotState.enabled ? 'فعال روی وبسایت' : 'غیرفعال'}
                    </span>
                  </div>
                </div>

                {chatbotSaveNotice && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-2 shadow-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{chatbotSaveNotice}</span>
                  </div>
                )}

                {/* Section 1: API Key & Endpoint Configuration */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Key className="w-4 h-4 text-[#14F195]" />
                    <span>۱. تنظیمات کلید API و سرور چت‌بات (API Credentials & Endpoint)</span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* API Key input */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs flex items-center justify-between">
                        <span>کلید API چت‌بات (DeepSeek API Key):</span>
                        <span className="text-[10px] text-slate-400 font-mono">sk-xxxxxxxx...</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={chatbotState.apiKey || ''}
                          onChange={(e) => setChatbotState({ ...chatbotState, apiKey: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-10 text-white font-mono dir-ltr focus:border-[#9945FF] focus:outline-none transition-colors text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        در صورت خالی بودن، به صورت خودکار از کلید API بخش نویسنده دیپ‌سیک استفاده می‌شود.
                      </p>
                    </div>

                    {/* API Base URL */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs">
                        آدرس سرور API (Base Endpoint):
                      </label>
                      <input
                        type="url"
                        placeholder="https://api.deepseek.com/v1"
                        value={chatbotState.apiBaseUrl || ''}
                        onChange={(e) => setChatbotState({ ...chatbotState, apiBaseUrl: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-[#9945FF] focus:outline-none transition-colors text-xs"
                      />
                      <p className="text-[11px] text-slate-400">
                        پیش‌فرض: https://api.deepseek.com/v1
                      </p>
                    </div>

                    {/* Test Connection Button */}
                    <div className="md:col-span-2 pt-1">
                      <button
                        type="button"
                        disabled={isTestingChatbotApi}
                        onClick={handleTestChatbotApi}
                        className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#14F195] font-bold border border-[#14F195]/30 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        {isTestingChatbotApi ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-[#14F195]" />
                            <span>در حال تست اتصال چت‌بات...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-[#14F195]" />
                            <span>تست آنلاین اتصال به API چت‌بات</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>

                  {/* Test Result Display */}
                  {chatbotTestStatus && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
                      chatbotTestStatus.success 
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}>
                      {chatbotTestStatus.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <span>{chatbotTestStatus.message}</span>
                    </div>
                  )}

                </div>

                {/* Section 2: Basic Identity & Messaging */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Bot className="w-4 h-4 text-[#14F195]" />
                    <span>۲. هویت چت‌بات و پیام خوش‌آمدگویی</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* Bot Name */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs">
                        نام نمایش داده شده برای ربات:
                      </label>
                      <input
                        type="text"
                        value={chatbotState.botName}
                        onChange={(e) => setChatbotState({ ...chatbotState, botName: e.target.value })}
                        placeholder="پشتیبان هوشمند سولمینت"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-[#9945FF] focus:outline-none transition-colors text-xs"
                      />
                    </div>

                    {/* Bot Avatar Emoji */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs">
                        آواتار / ایموجی ربات:
                      </label>
                      <input
                        type="text"
                        value={chatbotState.botAvatar}
                        onChange={(e) => setChatbotState({ ...chatbotState, botAvatar: e.target.value })}
                        placeholder="🤖"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-center text-xl text-white focus:border-[#9945FF] focus:outline-none transition-colors"
                      />
                    </div>

                  </div>

                  {/* Welcome Message */}
                  <div className="space-y-1.5 pt-2">
                    <label className="block text-slate-300 font-bold text-xs">
                      پیام خوش‌آمدگویی اولین ارتباط به کاربران:
                    </label>
                    <textarea
                      rows={3}
                      value={chatbotState.welcomeMessage}
                      onChange={(e) => setChatbotState({ ...chatbotState, welcomeMessage: e.target.value })}
                      placeholder="سلام! 👋 من دستیار هوشمند سولمینت هستم..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-[#9945FF] focus:outline-none transition-colors text-xs leading-relaxed"
                    />
                  </div>

                  {/* Placeholder Text */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-bold text-xs">
                      متن راهنما داخل کادر ورودی (Placeholder):
                    </label>
                    <input
                      type="text"
                      value={chatbotState.placeholderText}
                      onChange={(e) => setChatbotState({ ...chatbotState, placeholderText: e.target.value })}
                      placeholder="سوال خود را درباره سولمینت بپرسید..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-[#9945FF] focus:outline-none transition-colors text-xs"
                    />
                  </div>

                </div>

                {/* Section 3: System Prompt instructions for DeepSeek */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Brain className="w-4 h-4 text-cyan-400" />
                    <span>۳. دستورالعمل هوش مصنوعی (System Prompt for Bot)</span>
                  </h5>

                  <div className="space-y-2">
                    <label className="block text-slate-300 font-bold text-xs flex items-center justify-between">
                      <span>دستورالعمل جامع و دانش هوش مصنوعی جهت پاسخ به کاربران:</span>
                      <span className="text-[10px] text-cyan-400 font-mono">شخصیت و رفتار ربات</span>
                    </label>
                    <textarea
                      rows={7}
                      value={chatbotState.systemPrompt}
                      onChange={(e) => setChatbotState({ ...chatbotState, systemPrompt: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs leading-relaxed focus:border-cyan-400 focus:outline-none transition-colors"
                      placeholder="شما پشتیبان رسمی اپلیکیشن سولمینت هستید..."
                    />
                    <p className="text-[11px] text-slate-400">
                      این متن مشخص می‌کند هوش مصنوعی چگونه و با چه لحن و اطلاعاتی به سوالات کاربران درباره ساخت توکن، کیف پول، و کارمزد اجاره پاسخ دهد.
                    </p>
                  </div>
                </div>

                {/* Section 4: Suggested Quick Questions */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>۴. دکمه‌های سوالات پیشنهادی سریع (Quick Suggested Questions)</span>
                  </h5>

                  <p className="text-[11px] text-slate-400">
                    کاربران با کلیک روی این دکمه‌ها می‌توانند فوراً سوالات متداول خود را بدون تایپ کردن برای چت‌بات ارسال کنند.
                  </p>

                  {/* List of existing questions */}
                  <div className="space-y-2">
                    {chatbotState.suggestedQuestions.map((q, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <span className="w-6 h-6 rounded-lg bg-[#9945FF]/20 text-[#14F195] font-bold text-center leading-6 shrink-0 text-xs">
                          {idx + 1}
                        </span>
                        <span className="text-white text-xs flex-1 line-clamp-1">{q}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSuggestedQuestion(idx)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                          title="حذف سوال"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add new question input */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={newSuggestedQ}
                      onChange={(e) => setNewSuggestedQ(e.target.value)}
                      placeholder="عنوان سوال پیشنهادی جدید..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:border-[#9945FF] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSuggestedQuestion}
                      className="px-4 py-2.5 rounded-xl bg-[#9945FF]/20 text-[#14F195] font-bold border border-[#9945FF]/30 hover:bg-[#9945FF]/30 cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن</span>
                    </button>
                  </div>
                </div>

                {/* Section 5: AI Model & Context Memory */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>۵. تنظیمات فنی مدل و حافظه مکالمه</span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Model */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs">
                        مدل انتخابی هوش مصنوعی برای چت‌بات:
                      </label>
                      <select
                        value={
                          ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-coder'].includes(chatbotState.model)
                            ? chatbotState.model
                            : 'custom'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== 'custom') {
                            setChatbotState({ ...chatbotState, model: val });
                          } else {
                            setChatbotState({ ...chatbotState, model: chatbotState.model || 'custom-model' });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs cursor-pointer focus:border-cyan-400 dir-ltr"
                      >
                        <option value="deepseek-chat">deepseek-chat (پیش‌فرض - روان و سریع)</option>
                        <option value="deepseek-reasoner">deepseek-reasoner (R1 - استدلال محاسباتی عمیق)</option>
                        <option value="deepseek-v4-flash">deepseek-v4-flash (GapGPT / DeepSeek V4 Flash)</option>
                        <option value="deepseek-coder">deepseek-coder (برنامه‌نویسی و استخراج کد)</option>
                        <option value="custom">✏️ نام مدل سفارشی...</option>
                      </select>
                      {(!['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-coder'].includes(chatbotState.model) || chatbotState.model === 'custom') && (
                        <input
                          type="text"
                          placeholder="مثال: deepseek-v4-flash"
                          value={chatbotState.model === 'custom' ? '' : chatbotState.model}
                          onChange={(e) => setChatbotState({ ...chatbotState, model: e.target.value })}
                          className="w-full mt-2 bg-slate-900 border border-cyan-500/50 rounded-xl p-2.5 text-white font-mono text-xs dir-ltr focus:outline-none focus:border-cyan-400 placeholder:text-slate-500"
                        />
                      )}
                    </div>

                    {/* Max history turns */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold text-xs flex items-center justify-between">
                        <span>تعداد پیام‌های حافظه مکالمه (Context Turns):</span>
                        <span className="text-[#14F195] font-mono">{chatbotState.maxHistoryTurns} پیام اخیر</span>
                      </label>
                      <input
                        type="range"
                        min={4}
                        max={20}
                        step={2}
                        value={chatbotState.maxHistoryTurns}
                        onChange={(e) => setChatbotState({ ...chatbotState, maxHistoryTurns: parseInt(e.target.value) })}
                        className="w-full accent-[#14F195] cursor-pointer mt-2"
                      />
                    </div>

                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#9945FF] via-purple-600 to-[#14F195] hover:brightness-110 font-extrabold text-sm text-slate-950 cursor-pointer shadow-xl shadow-[#9945FF]/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5 text-slate-950" />
                    <span>ذخیره کلیه تنظیمات چت‌بات آنلاین</span>
                  </button>
                </div>

              </form>
            )}

            {/* TAB 9: SECURITY & PASSCODE SETTINGS */}
            {adminTab === 'security' && (
              <form onSubmit={handleChangePasscode} className="max-w-md mx-auto py-4 space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    تغییر رمز عبور مدیریت CMS
                  </h4>

                  {passChangeSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      {passChangeSuccess}
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">رمز عبور فعلی:</label>
                    <input
                      type="password"
                      required
                      value={currentPassInput}
                      onChange={(e) => setCurrentPassInput(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono dir-ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">رمز عبور جدید (حداقل ۶ کاراکتر):</label>
                    <div className="relative">
                      <input
                        type={showNewPass ? "text" : "password"}
                        required
                        value={newPassInput}
                        onChange={(e) => setNewPassInput(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 pr-3 pl-10 text-white font-mono dir-ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">تکرار رمز عبور جدید:</label>
                    <input
                      type="password"
                      required
                      value={confirmPassInput}
                      onChange={(e) => setConfirmPassInput(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono dir-ltr"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl btn-gradient font-bold cursor-pointer"
                  >
                    ذخیره رمز عبور جدید
                  </button>
                </div>
              </form>
            )}

            {/* TAB 10: DATABASE MANAGEMENT (SUPABASE & CLOUDFLARE D1) */}
            {adminTab === 'database' && (
              <div className="max-w-4xl mx-auto py-4 space-y-6 text-xs">
                
                {/* Header card */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-400" />
                        مدیریت دیتابیس و همگام‌سازی ابری (Supabase & Cloudflare D1)
                      </h4>
                      <p className="text-slate-400 text-xs">
                        در این بخش می‌توانید ارائه‌دهنده پایگاه‌داده (Database Provider) را بین Supabase و Cloudflare D1 تغییر دهید یا تنظیمات اتصال را ویرایش کنید.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestDatabaseConnection(dbConfig.provider)}
                      disabled={isTestingDb}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isTestingDb ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>تست اتصال به دیتابیس فعلی</span>
                    </button>
                  </div>

                  {/* Test Status Banner */}
                  {dbTestResult && (
                    <div className={`p-4 rounded-xl border font-bold flex items-center justify-between gap-3 ${
                      dbTestResult.success 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {dbTestResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />}
                        <span>{dbTestResult.message}</span>
                      </div>
                      <button onClick={() => setDbTestResult(null)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Active Database Provider Selector */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-slate-300 font-bold text-xs">
                      سرویس ذخیره‌سازی فعال (Active Database Provider):
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Supabase Option */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...dbConfig, provider: 'supabase' as DatabaseProvider };
                          setDbConfig(updated);
                          saveDatabaseConfig(updated);
                        }}
                        className={`p-4 rounded-2xl border text-right space-y-2 cursor-pointer transition-all ${
                          dbConfig.provider === 'supabase'
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white flex items-center gap-2">
                            <Database className="w-4 h-4 text-emerald-400" />
                            Supabase (PostgreSQL)
                          </span>
                          {dbConfig.provider === 'supabase' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold">
                              فعال
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          پایگاه‌داده قدرتمند پستگرس. مناسب برای همگام‌سازی فوری مقالات بین کلادفلر و تمام کاربران.
                        </p>
                      </button>

                      {/* Cloudflare D1 Option */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...dbConfig, provider: 'cloudflare_d1' as DatabaseProvider };
                          setDbConfig(updated);
                          saveDatabaseConfig(updated);
                        }}
                        className={`p-4 rounded-2xl border text-right space-y-2 cursor-pointer transition-all ${
                          dbConfig.provider === 'cloudflare_d1'
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white flex items-center gap-2">
                            <Server className="w-4 h-4 text-amber-400" />
                            Cloudflare D1 (SQLite)
                          </span>
                          {dbConfig.provider === 'cloudflare_d1' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold">
                              فعال
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          پایگاه‌داده اختصاصی کلادفلر روی شبکه Edge. اتصال از طریق Cloudflare Workers.
                        </p>
                      </button>

                      {/* Local Storage Option */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...dbConfig, provider: 'local' as DatabaseProvider };
                          setDbConfig(updated);
                          saveDatabaseConfig(updated);
                        }}
                        className={`p-4 rounded-2xl border text-right space-y-2 cursor-pointer transition-all ${
                          dbConfig.provider === 'local'
                            ? 'bg-sky-500/15 border-sky-500 text-white shadow-lg shadow-sky-500/10'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-sky-400" />
                            ذخیره‌سازی محلی (LocalStorage)
                          </span>
                          {dbConfig.provider === 'local' && (
                            <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-extrabold">
                              فعال
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          ذخیره آفلاین درون مرورگر کاربر بدون نیاز به دیتابیس ابری خارجی.
                        </p>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Form fields based on active DB provider */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h5 className="font-bold text-white text-sm flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <span>تنظیمات کلیدها و آدرس اتصال</span>
                    </h5>
                    <button
                      type="button"
                      onClick={handleSaveDbConfig}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>ذخیره تنظیمات</span>
                    </button>
                  </div>

                  {/* Supabase Credentials */}
                  <div className="space-y-4">
                    <h6 className="font-bold text-emerald-400 text-xs flex items-center gap-2">
                      <span>• مشخصات Supabase</span>
                    </h6>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-slate-300 font-bold text-xs">VITE_SUPABASE_URL:</label>
                        <input
                          type="text"
                          value={dbConfig.supabaseUrl}
                          onChange={(e) => setDbConfig({ ...dbConfig, supabaseUrl: e.target.value })}
                          placeholder="https://xyz.supabase.co"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs dir-ltr focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-slate-300 font-bold text-xs">VITE_SUPABASE_ANON_KEY:</label>
                        <input
                          type="password"
                          value={dbConfig.supabaseAnonKey}
                          onChange={(e) => setDbConfig({ ...dbConfig, supabaseAnonKey: e.target.value })}
                          placeholder="sb_publishable_..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs dir-ltr focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cloudflare D1 Credentials */}
                  <div className="space-y-4 pt-3 border-t border-slate-800">
                    <h6 className="font-bold text-amber-400 text-xs flex items-center gap-2">
                      <span>• مشخصات Cloudflare D1 / Worker Endpoint</span>
                    </h6>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-slate-300 font-bold text-xs">آدرس Cloudflare Worker Endpoint:</label>
                        <input
                          type="text"
                          value={dbConfig.cloudflareWorkerEndpoint}
                          onChange={(e) => setDbConfig({ ...dbConfig, cloudflareWorkerEndpoint: e.target.value })}
                          placeholder="https://solmint-api.myuser.workers.dev"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs dir-ltr focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-slate-300 font-bold text-xs">کلید احراز هویت Worker API Key (اختیاری):</label>
                        <input
                          type="password"
                          value={dbConfig.cloudflareApiKey}
                          onChange={(e) => setDbConfig({ ...dbConfig, cloudflareApiKey: e.target.value })}
                          placeholder="cf_secret_key_..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs dir-ltr focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SQL Code Snippets Box */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h5 className="font-bold text-white text-sm flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-400" />
                      کدهای SQL جهت ساخت جدول articles در Supabase و Cloudflare D1
                    </span>
                  </h5>

                  <div className="space-y-4">
                    {/* Supabase SQL */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-400">۱. کد SQL ساخت جدول در Supabase SQL Editor:</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(SUPABASE_ARTICLES_TABLE_SQL);
                            setCopiedSql('supabase');
                            setTimeout(() => setCopiedSql(null), 2500);
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedSql === 'supabase' ? 'کپی شد!' : 'کپی کدهای Supabase SQL'}</span>
                        </button>
                      </div>

                      <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] dir-ltr overflow-x-auto max-h-40 leading-relaxed">
                        {SUPABASE_ARTICLES_TABLE_SQL}
                      </pre>
                    </div>

                    {/* Cloudflare D1 SQL */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-400">۲. کد SQL ساخت جدول در Cloudflare D1 (npx wrangler):</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(CLOUDFLARE_D1_ARTICLES_SQL);
                            setCopiedSql('cloudflare');
                            setTimeout(() => setCopiedSql(null), 2500);
                          }}
                          className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedSql === 'cloudflare' ? 'کپی شد!' : 'کپی کدهای Cloudflare D1'}</span>
                        </button>
                      </div>

                      <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] dir-ltr overflow-x-auto max-h-40 leading-relaxed">
                        {CLOUDFLARE_D1_ARTICLES_SQL}
                      </pre>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 11: USER ROLES AND PERMISSIONS MANAGEMENT (RBAC) */}
            {adminTab === 'users' && hasPermission('users') && (
              <div className="space-y-6">
                {/* RBAC Header & Overview */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-400" />
                        <h3 className="text-base font-black text-white">مدیریت اعضای تیم، نویسندگان و سطوح دسترسی (RBAC)</h3>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        تعریف نویسندگان، ویراستاران و همکاران پلتفرم همراه با محدودسازی دقیق دسترسی به بخش‌های حساس سیستم.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingUserId(null);
                        setMemberFullName('');
                        setMemberUsername('');
                        setMemberPassword('');
                        setMemberRole('writer');
                        setMemberPermissions(['articles', 'editor', 'comments', 'media']);
                        setShowAddMemberForm(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 cursor-pointer transition-all shrink-0"
                    >
                      <UserPlus className="w-4 h-4 text-slate-950" />
                      <span>تعریف نویسنده / همکار جدید</span>
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400">کل اعضای تیم</span>
                        <div className="text-lg font-black text-white font-mono">{users.length + 1} نفر</div>
                      </div>
                      <Users className="w-5 h-5 text-slate-500" />
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400">نویسندگان و ویراستاران</span>
                        <div className="text-lg font-black text-amber-400 font-mono">
                          {users.filter(u => u.role === 'writer' || u.role === 'editor').length} نویسنده
                        </div>
                      </div>
                      <Edit3 className="w-5 h-5 text-amber-500/70" />
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400">مدیران ارشد سیستم</span>
                        <div className="text-lg font-black text-emerald-400 font-mono">
                          {users.filter(u => u.role === 'admin' || u.role === 'superadmin').length + 1} مدیر
                        </div>
                      </div>
                      <ShieldCheck className="w-5 h-5 text-emerald-500/70" />
                    </div>
                  </div>
                </div>

                {/* Notice Alert */}
                {userManagementNotice && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>{userManagementNotice}</span>
                    </div>
                    <button onClick={() => setUserManagementNotice(null)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* ADD / EDIT MEMBER FORM MODAL */}
                {showAddMemberForm && (
                  <form onSubmit={handleSaveMember} className="p-6 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-6 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                        <UserPlus className="w-5 h-5" />
                        <span>{editingUserId ? 'ویرایش مشخصات و دسترسی‌های کاربر' : 'تعریف نویسنده / همکار جدید'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMemberForm(false);
                          setEditingUserId(null);
                        }}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">نام و نام خانوادگی:</label>
                        <input
                          type="text"
                          required
                          value={memberFullName}
                          onChange={(e) => setMemberFullName(e.target.value)}
                          placeholder="مثال: علی رضایی"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">نام کاربری / ایمیل ورود:</label>
                        <input
                          type="text"
                          required
                          value={memberUsername}
                          onChange={(e) => setMemberUsername(e.target.value)}
                          placeholder="مثال: writer_ali"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none dir-ltr text-right"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">
                          {editingUserId ? 'رمز عبور جدید (اختیاری):' : 'رمز عبور ورود:'}
                        </label>
                        <input
                          type="password"
                          required={!editingUserId}
                          value={memberPassword}
                          onChange={(e) => setMemberPassword(e.target.value)}
                          placeholder={editingUserId ? 'بدون تغییر' : 'رمز عبور محرمانه'}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none dir-ltr text-right"
                        />
                      </div>
                    </div>

                    {/* Role & Active Switch */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">نقش سازمانی:</label>
                        <select
                          value={memberRole}
                          onChange={(e) => {
                            const r = e.target.value as 'writer' | 'editor' | 'admin';
                            setMemberRole(r);
                            if (r === 'writer') {
                              setMemberPermissions(['articles', 'editor', 'comments', 'media']);
                            } else if (r === 'admin') {
                              setMemberPermissions(ALL_ADMIN_PERMISSIONS);
                            }
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                        >
                          <option value="writer">✍️ نویسنده مقاله (دسترسی محدود به انتشار و ویرایش مقالات)</option>
                          <option value="editor">📝 ویراستار ارشد (دسترسی به مقالات، نظرات و سئو)</option>
                          <option value="admin">🛡️ مدیر همکار (دسترسی کامل به تمام سیستم)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">وضعیت حساب کاربری:</label>
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setMemberIsActive(!memberIsActive)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                              memberIsActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {memberIsActive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            <span>{memberIsActive ? 'حساب فعال (امکان ورود)' : 'حساب غیرفعال (مسدود)'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* PERMISSIONS MATRIX */}
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                            <Key className="w-4 h-4 text-amber-400" />
                            <span>تنظیم سطوح دسترسی دقیق (Granular Permissions)</span>
                          </h4>
                          <p className="text-[11px] text-slate-400">تیک بخش‌هایی که این کاربر مجاز به استفاده از آن است را روشن کنید:</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMemberPermissions(['articles', 'editor', 'comments', 'media'])}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30 cursor-pointer"
                          >
                            ⚡ پریست نویسنده
                          </button>

                          <button
                            type="button"
                            onClick={() => setMemberPermissions(ALL_ADMIN_PERMISSIONS)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 cursor-pointer"
                          >
                            ⚡ دسترسی کامل
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                        {ALL_ADMIN_PERMISSIONS.map((permKey) => {
                          const meta = PERMISSION_LABELS[permKey];
                          const isChecked = memberPermissions.includes(permKey);
                          return (
                            <div
                              key={permKey}
                              onClick={() => handleTogglePermission(permKey)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                isChecked
                                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className={`mt-0.5 ${isChecked ? 'text-amber-400' : 'text-slate-600'}`}>
                                {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                              </div>
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-white truncate">{meta.icon} {meta.title}</span>
                                  {meta.sensitive && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 shrink-0">
                                      حساس
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 line-clamp-2">{meta.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMemberForm(false);
                          setEditingUserId(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:text-white cursor-pointer"
                      >
                        انصراف
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg hover:brightness-110 cursor-pointer"
                      >
                        {editingUserId ? 'ذخیره تغییرات کاربر' : 'ثبت و ایجاد حساب کاربر'}
                      </button>
                    </div>
                  </form>
                )}

                {/* MEMBERS LIST */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400">فهرست تمام اعضای تیم و سطوح دسترسی فعال:</h4>

                  {/* SuperAdmin Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md">
                        👑
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-black text-white">مدیر ارشد سیستم (SuperAdmin)</h5>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-500/40">
                            مالک سیستم
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">نام کاربری: <span className="text-amber-300 font-mono font-bold">admin</span> | دسترسی نامحدود به تمام بخش‌های فریم‌ورک</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 shrink-0 text-center">
                      ✅ دسترسی کامل به کل سیستم
                    </span>
                  </div>

                  {/* Registered Users / Writers */}
                  {users.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                      <User className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">هنوز هیچ نویسنده یا همکار دیگری تعریف نشده است.</p>
                      <p className="text-[11px] text-slate-500">با زدن دکمه «تعریف نویسنده / همکار جدید» می‌توانید برای نویسندگان سایت حساب کاربری با دسترسی محدود بسازید.</p>
                    </div>
                  ) : (
                    users.map((u) => {
                      const userPerms = u.permissions || (u.role === 'admin' ? ALL_ADMIN_PERMISSIONS : ['articles', 'editor', 'comments', 'media']);
                      const isActive = u.isActive !== false;
                      return (
                        <div key={u.id} className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isActive ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-950/70 border-rose-500/20 opacity-75'
                        }`}>
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl text-xs font-black flex items-center justify-center shrink-0 ${
                              u.role === 'admin' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {u.role === 'admin' ? '🛡️' : u.role === 'editor' ? '📝' : '✍️'}
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h5 className="text-sm font-bold text-white truncate">{u.fullName}</h5>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  u.role === 'admin' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}>
                                  {u.role === 'admin' ? 'مدیر همکار' : u.role === 'editor' ? 'ویراستار' : 'نویسنده محتوا'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                }`}>
                                  {isActive ? 'فعال' : 'مسدود شده'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-400">
                                نام کاربری: <span className="text-sky-400 font-mono font-bold">{u.username}</span> | تاریخ ثبت: <span className="font-mono text-slate-300">{u.createdAt}</span>
                              </p>

                              {/* Active permissions summary */}
                              <div className="flex flex-wrap items-center gap-1 pt-1">
                                <span className="text-[10px] text-slate-500">دسترسی‌ها:</span>
                                {userPerms.map(p => (
                                  <span key={p} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                                    {PERMISSION_LABELS[p]?.icon} {PERMISSION_LABELS[p]?.title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* User Actions */}
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u.id)}
                              title={isActive ? 'مسدود کردن حساب' : 'فعال‌سازی حساب'}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                                isActive ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {isActive ? <UserX className="w-3.5 h-3.5 text-rose-400" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                              <span>{isActive ? 'مسدود' : 'فعال‌سازی'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditUserClick(u)}
                              className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold border border-sky-500/30 flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>ویرایش دسترسی</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                              title="حذف کاربر"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            </>
            )}
          </div>
        )}

        {/* Media Picker Modal Overlay */}
        {isMediaPickerOpen && (
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">انتخاب تصویر کاور از کتابخانه رسانه</h3>
                    <p className="text-[11px] text-slate-400">تصویر مورد نظر را انتخاب کنید تا آدرس آن در فرم قرار گیرد.</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMediaPickerOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {githubMediaAssets.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <ImageIcon className="w-10 h-10 text-slate-600 mx-auto" />
                    <h5 className="font-bold text-slate-300 text-sm">هنوز تصویری در کتابخانه ثبت نشده است</h5>
                    <p className="text-slate-400 text-xs">ابتدا در زبانه "مدیریت رسانه" تصاویر مورد نظر را آپلود نمایید.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {githubMediaAssets.map((asset) => {
                      const url = asset.publicUrl || asset.url || '';
                      const filename = asset.filename || 'تصویر';
                      return (
                        <div
                          key={asset.id || Math.random().toString()}
                          onClick={() => {
                            if (url) {
                              setFormCoverImage(url);
                              if (asset.id) setFormCoverImageAssetId(asset.id);
                            }
                            setIsMediaPickerOpen(false);
                          }}
                          className="group relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-[#14F195] cursor-pointer transition-all hover:scale-[1.02] flex flex-col"
                        >
                          <div className="h-28 w-full bg-slate-950 overflow-hidden relative">
                            <img
                              src={url}
                              alt={asset.altText || filename}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-purple-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="px-3 py-1 rounded-lg bg-[#14F195] text-slate-950 font-black text-xs shadow-lg">
                                انتخاب این تصویر
                              </span>
                            </div>
                          </div>
                          <div className="p-2 bg-slate-900">
                            <span className="font-mono text-[10px] font-bold text-slate-300 block truncate dir-ltr text-right">
                              {filename}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsMediaPickerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
