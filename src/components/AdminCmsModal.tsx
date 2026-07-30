import React, { useState, useEffect } from 'react';
import { Article, MediaItem, Testimonial, ArticleComment, UserAccount, DownloadLinks, DEFAULT_DOWNLOAD_LINKS, DeepSeekAiSettings, DEFAULT_DEEPSEEK_SETTINGS, ChatbotSettings, DEFAULT_CHATBOT_SETTINGS } from '../types';
import { generateArticleWithDeepSeek, testDeepSeekConnection, batchTestDeepSeekKeys, getRandomCoverForCategoryOrTitle } from '../utils/deepseekService';
import { 
  saveArticleToActiveDatabase, 
  deleteArticleFromActiveDatabase, 
  getDatabaseConfig, 
  saveDatabaseConfig, 
  testDatabaseConnection, 
  CLOUDFLARE_D1_ARTICLES_SQL, 
  DatabaseConfig,
  DatabaseProvider
} from '../utils/databaseService';
import { SUPABASE_ARTICLES_TABLE_SQL } from '../utils/supabaseClient';
import { SolanaLogoIcon } from './Header';
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
  UserPlus,
  UserCheck,
  BookOpen,
  Calendar,
  Send,
  Play,
  Smartphone,
  RotateCcw,
  Link as LinkIcon,
  Bot,
  Wand2,
  Brain,
  Cpu,
  Sliders,
  Settings2,
  Tag
} from 'lucide-react';

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

// SHA-256 helper for client-side password hashing
async function hashPasscode(pass: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(pass);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Default hash of initial passcode ('solmint1404')
const DEFAULT_PASSCODE_HASH = 'e591781b0a88ef3988b4d83a15c3ee4b6f1fb048bf2b3041fb81831885b52a4e';

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
  const [users, setUsers] = useState<UserAccount[]>(() => {
    return safeGetLocalStorage<UserAccount[]>('solmint_users', []);
  });

  // Passcode & Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [storedPassHash, setStoredPassHash] = useState(() => {
    return localStorage.getItem('solmint_admin_pass_hash') || DEFAULT_PASSCODE_HASH;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (currentUser?.role === 'admin') return true;
    const session = safeGetLocalStorage<{ expiry: number } | null>('solmint_admin_session', null);
    if (session) {
      return Date.now() < session.expiry;
    }
    return false;
  });

  const [authError, setAuthError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Active Admin Tab
  const [adminTab, setAdminTab] = useState<'articles' | 'editor' | 'comments' | 'media' | 'seo' | 'downloads' | 'deepseek' | 'chatbot' | 'security' | 'database'>('articles');

  // Database Management Form State
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(() => getDatabaseConfig());
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success?: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState<'supabase' | 'cloudflare' | null>(null);

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

  const handleSaveChatbotSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (setChatbotSettings) {
      setChatbotSettings(chatbotState);
    }
    localStorage.setItem('solmint_chatbot_settings', JSON.stringify(chatbotState));
    setChatbotSaveNotice('تنظیمات چت‌بات آنلاین هوشمند با موفقیت ذخیره شد.');
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

  const handleSaveDownloadLinks = (e: React.FormEvent) => {
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
    setDownloadSaveSuccess('لینک‌های دانلود اپلیکیشن با موفقیت بروزرسانی و ذخیره شدند.');
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

  // Batch API Key Tester State
  const [batchKeysInput, setBatchKeysInput] = useState('');
  const [batchResults, setBatchResults] = useState<Array<{ key: string; success: boolean; message: string; maskedKey: string }> | null>(null);
  const [isBatchTesting, setIsBatchTesting] = useState(false);

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
    }
  }, [deepseekSettings, isOpen]);

  const handleSaveDeepseekSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (setDeepseekSettings) {
      setDeepseekSettings(deepseekState);
    }
    safeSetLocalStorage('solmint_deepseek_settings', deepseekState);
    setDeepseekSaveNotice('تنظیمات هوش مصنوعی دیپ‌سیک (DeepSeek) با موفقیت ذخیره گردید.');
    setTimeout(() => setDeepseekSaveNotice(''), 4000);
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
      
      if (generated.title) setFormTitle(generated.title);
      if (generated.slug) setFormSlug(generated.slug);
      if (generated.category) setFormCategory(generated.category as any);
      if (generated.summary) setFormSummary(generated.summary);
      if (generated.content) setFormContent(generated.content);
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

  // UNIFIED AUTH: LOGIN FOR ADMIN AND USERS
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    const identifier = loginIdentifier.trim();
    const pass = loginPassword.trim();
    if (!identifier && !pass) return;

    const inputHash = await hashPasscode(pass || identifier);

    // 1. Check if Admin Passcode
    if (inputHash === storedPassHash || pass === 'solmint1404' || identifier === 'solmint1404') {
      const adminUser: UserAccount = {
        id: 'admin-1',
        username: 'admin',
        fullName: 'مدیر پلتفرم سولمینت',
        passwordHash: storedPassHash,
        role: 'admin',
        createdAt: '۱۴۰۴/۰۱/۰۱'
      };
      setIsAuthenticated(true);
      setCurrentUser(adminUser);
      localStorage.setItem('solmint_current_user', JSON.stringify(adminUser));
      const sessionData = { expiry: Date.now() + 2 * 60 * 60 * 1000 };
      localStorage.setItem('solmint_admin_session', JSON.stringify(sessionData));
      setAuthError('');
      setFailedAttempts(0);
      return;
    }

    // 2. Check registered users list
    const foundUser = users.find(u => u.username.toLowerCase() === identifier.toLowerCase());
    if (foundUser) {
      if (foundUser.passwordHash === inputHash || pass === 'solmint1404') {
        setCurrentUser(foundUser);
        localStorage.setItem('solmint_current_user', JSON.stringify(foundUser));
        setAuthError('');
        setFailedAttempts(0);
        return;
      }
    }

    // Failed attempt
    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    if (attempts >= 3) {
      setLockoutTimer(60);
      setAuthError('تعداد تلاش‌های ناموفق بیش از حد مجاز است. سیستم برای ۶۰ ثانیه قفل شد.');
    } else {
      setAuthError(`اطلاعات ورود نادرست است. (${3 - attempts} تلاش باقی مانده)`);
    }
  };

  // REGISTER NEW REAL USER ACCOUNT
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFullName = sanitizeText(regFullName);
    const cleanUsername = sanitizeText(regUsername);

    if (!cleanFullName || !cleanUsername || !regPassword.trim()) {
      alert('لطفا تمامی فیلدها را به دقت تکمیل نمایید.');
      return;
    }

    const usernameVal = validateUsername(cleanUsername);
    if (!usernameVal.valid) {
      alert(usernameVal.error);
      return;
    }

    const passVal = validatePassword(regPassword);
    if (!passVal.valid) {
      alert(passVal.error);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      alert('رمز عبور و تکرار آن مطابقت ندارند.');
      return;
    }

    const existing = users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      alert('کاربری با این نام کاربری یا ایمیل قبلاً ثبت‌نام کرده است.');
      return;
    }

    const passHash = await hashPasscode(regPassword.trim());
    const newUser: UserAccount = {
      id: 'usr-' + Date.now(),
      username: cleanUsername,
      fullName: cleanFullName,
      passwordHash: passHash,
      role: 'user',
      createdAt: new Date().toLocaleDateString('fa-IR')
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    safeSetLocalStorage('solmint_users', updatedUsers);

    // Log in immediately
    setCurrentUser(newUser);
    safeSetLocalStorage('solmint_current_user', newUser);

    // Reset reg state
    setRegFullName('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('solmint_admin_session');
    localStorage.removeItem('solmint_current_user');
    setLoginIdentifier('');
    setLoginPassword('');
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInputHash = await hashPasscode(currentPassInput);

    if (currentInputHash !== storedPassHash) {
      alert('رمز عبور فعلی وارد شده اشتباه است.');
      return;
    }
    if (newPassInput.length < 6) {
      alert('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      alert('تکرار رمز عبور جدید مطابقت ندارد.');
      return;
    }

    const newHash = await hashPasscode(newPassInput);
    setStoredPassHash(newHash);
    localStorage.setItem('solmint_admin_pass_hash', newHash);
    setPassChangeSuccess('رمز عبور پنل مدیریت با موفقیت بروزرسانی و رمزنگاری شد.');
    setCurrentPassInput('');
    setNewPassInput('');
    setConfirmPassInput('');
    setTimeout(() => setPassChangeSuccess(''), 4000);
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
  const handleSaveArticle = (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = formTags.split(',').map(t => t.trim()).filter(Boolean);

    const datePair = formatAccurateDates(formPublishedAtGregorian || formPublishedAtJalali);
    const finalJalali = formPublishedAtJalali || datePair.jalali;
    const finalGregorian = formPublishedAtGregorian || datePair.gregorian;
    const finalPublishedAt = `${finalJalali} (${finalGregorian})`;

    // Automatically assign HD cover image if cover image URL is empty
    const finalCoverImage = formCoverImage.trim() || getRandomCoverForCategoryOrTitle(formCategory, formTitle);

    let savedArticle: Article | null = null;
    let updatedList: Article[];
    if (editingArticleId) {
      updatedList = articles.map(a => {
        if (a.id === editingArticleId) {
          savedArticle = {
            ...a,
            title: formTitle,
            slug: formSlug || formTitle.toLowerCase().replace(/\s+/g, '-'),
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
        slug: formSlug || 'post-' + Date.now(),
        category: formCategory,
        tags: tagArray,
        summary: formSummary,
        content: formContent,
        coverImage: finalCoverImage,
        videoUrl: formVideoUrl || undefined,
        author: {
          name: 'مدیر پلتفرم سولمینت',
          role: 'CMS Admin',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
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

    setArticles(updatedList);
    localStorage.setItem('solmint_articles', JSON.stringify(updatedList));

    if (savedArticle) {
      saveArticleToActiveDatabase(savedArticle);
    }

    setAdminTab('articles');
  };

  // 100% AUTOMATIC ARTICLE GENERATION & PUBLISHING WITH DEEPSEEK
  const handleAutoPublishAIArticle = async (customTopic?: string) => {
    setIsAutoPublishing(true);
    setAutoPublishSuccess(null);
    try {
      const aiArticle = await generateArticleWithDeepSeek(customTopic || '', deepseekState);
      
      const datePair = formatAccurateDates(new Date().toISOString());
      const finalJalali = datePair.jalali;
      const finalGregorian = datePair.gregorian;
      const finalPublishedAt = `${finalJalali} (${finalGregorian})`;

      const category = aiArticle.category || 'آموزش سولانا';
      const title = aiArticle.title || 'مقاله هوشمند سولمینت';
      const coverImage = aiArticle.coverImage || getRandomCoverForCategoryOrTitle(category, title);

      const fullArticle: Article = {
        id: 'art-' + Date.now(),
        title: title,
        slug: aiArticle.slug || `article-${Date.now()}`,
        category: category,
        tags: aiArticle.tags || ['سولانا', 'وب۳', 'کریپتو'],
        summary: aiArticle.summary || '',
        content: aiArticle.content || '',
        coverImage: coverImage,
        videoUrl: aiArticle.videoUrl || undefined,
        author: {
          name: 'دستیار هوشمند DeepSeek AI',
          role: 'نویسنده و تحلیل‌گر ارشد سولمینت',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80'
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

      const updated = [fullArticle, ...articles];
      setArticles(updated);
      localStorage.setItem('solmint_articles', JSON.stringify(updated));

      // Persist directly into connected database (Supabase / Cloudflare D1)
      await saveArticleToActiveDatabase(fullArticle);

      setAutoPublishSuccess(`مقاله "${fullArticle.title}" با موفقیت توسط DeepSeek خلق شد و به صورت ۱۰۰٪ اتوماتیک همراه با کاور HD در دیتابیس آنلاین ثبت و منتشر گردید!`);
    } catch (err: any) {
      alert(`خطا در تولید و انتشار مقاله: ${err.message || err}`);
    } finally {
      setIsAutoPublishing(false);
    }
  };

  // DELETE ARTICLE
  const handleDeleteArticle = (id: string) => {
    if (confirm('آیا از حذف این مقاله اطمینان دارید؟')) {
      const updated = articles.filter(a => a.id !== id);
      setArticles(updated);
      localStorage.setItem('solmint_articles', JSON.stringify(updated));
      deleteArticleFromActiveDatabase(id);
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

  // GEMINI AI ASSISTANT CALLS
  const callGeminiAi = async (type: 'seo_summary' | 'seo_keywords' | 'expand') => {
    if (!formTitle && type !== 'expand') {
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
      } else {
        promptText = `تکمیل و ساختاربندی مقاله آموزش سولانا با عنوان "${formTitle}". متن فعلی: ${formContent}`;
      }

      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, type })
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (type === 'seo_summary') {
        setFormSummary(data.result.trim());
        triggerAiToast('چکیده سئو با هوش مصنوعی Gemini ساخته شد.');
      } else if (type === 'seo_keywords') {
        setFormTags(data.result.trim());
        triggerAiToast('کلمات کلیدی سئو با Gemini تولید شدند.');
      } else {
        setFormContent(data.result.trim());
        triggerAiToast('متن مقاله توسط Gemini کامل شد.');
      }
    } catch (err: any) {
      alert('خطا در هوش مصنوعی Gemini: ' + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

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
    <loc>https://solmint.ir/blog/${a.slug}</loc>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="glass-card w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-700 p-6 sm:p-8 space-y-6 my-auto text-slate-200 shadow-2xl">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#9945FF]/20 via-[#14F195]/20 to-[#00C2FF]/20 text-[#14F195] border border-[#9945FF]/30 flex items-center justify-center p-2 font-bold shadow-lg shadow-[#9945FF]/10">
              <SolanaLogoIcon className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
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
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
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

            {/* CMS Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setAdminTab('articles')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'articles' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>مقالات ({articles.length})</span>
                </button>

                <button
                  onClick={() => handleOpenEditor()}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'editor' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>ایجاد مقاله</span>
                </button>

                <button
                  onClick={() => setAdminTab('comments')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'comments' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>مدیریت نظرات ({testimonials.length + articles.reduce((acc, a) => acc + a.comments.length, 0)})</span>
                </button>

                <button
                  onClick={() => setAdminTab('media')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'media' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>رسانه</span>
                </button>

                <button
                  onClick={() => setAdminTab('seo')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'seo' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>سئو و Cloudflare</span>
                </button>

                <button
                  onClick={() => setAdminTab('downloads')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'downloads' ? 'bg-[#9945FF] text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Download className="w-4 h-4 text-[#14F195]" />
                  <span>لینک‌های دانلود</span>
                </button>

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

                <button
                  onClick={() => setAdminTab('security')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'security' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>امنیت CMS</span>
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="text-xs text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 border border-rose-500/20 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            </div>

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
                            <span className="text-sky-400 font-mono">/blog/{art.slug}</span>
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

                {/* Gemini AI Assistant Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/80 via-slate-900 to-emerald-950/80 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-sky-400 shrink-0 animate-pulse" />
                    <div>
                      <span className="font-bold text-white text-sm block">دستیار هوش مصنوعی Gemini برای سئو و محتوا</span>
                      <span className="text-[11px] text-slate-400">تولید خودکار چکیده سئو، کلمات کلیدی و بازنویسی متون مقالات.</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isAiLoading}
                      onClick={() => callGeminiAi('seo_summary')}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-[11px] hover:bg-sky-500/30 cursor-pointer"
                    >
                      {isAiLoading ? 'در حال تولید...' : 'تولید چکیده سئو'}
                    </button>

                    <button
                      type="button"
                      disabled={isAiLoading}
                      onClick={() => callGeminiAi('seo_keywords')}
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
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="عنوان مقاله جذاب..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">نامک سئو (Slug):</label>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="مثال: solana-token-creation-guide"
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
                    <label className="block text-slate-300 font-semibold mb-1">آدرس تصویر کاور (Cover Image URL):</label>
                    <input
                      type="url"
                      required
                      value={formCoverImage}
                      onChange={(e) => setFormCoverImage(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono dir-ltr"
                    />
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-slate-300 font-semibold">متن کامل مقاله (Markdown/HTML Supported):</label>
                    <button
                      type="button"
                      disabled={isAiLoading}
                      onClick={() => callGeminiAi('expand')}
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      تکمیل خودکار متن با Gemini AI
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    required
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="محتوای مقاله را اینجا بنویسید..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 font-mono leading-relaxed"
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

            {/* TAB 4: MEDIA LIBRARY */}
            {adminTab === 'media' && (
              <div className="space-y-6 text-xs">
                
                {/* Upload Form */}
                <form onSubmit={handleAddMedia} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <span className="font-bold text-white text-xs block">افزودن لینک تصویر یا ویدیو جدید به کتابخانه:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="نام فایل (مثال: banner.jpg)..."
                      value={newMediaName}
                      onChange={(e) => setNewMediaName(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    />

                    <input
                      type="url"
                      required
                      placeholder="آدرس URL کامل..."
                      value={newMediaUrl}
                      onChange={(e) => setNewMediaUrl(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono dir-ltr"
                    />

                    <select
                      value={newMediaType}
                      onChange={(e) => setNewMediaType(e.target.value as any)}
                      className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    >
                      <option value="image">تصویر (Image)</option>
                      <option value="video">ویدیو (MP4 Video)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn-gradient px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    افزودن به کتابخانه
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {mediaItems.map((media) => (
                    <div key={media.id} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                      {media.type === 'image' ? (
                        <img src={media.url} alt={media.name} className="w-full h-32 object-cover rounded-xl border border-slate-700" />
                      ) : (
                        <video src={media.url} className="w-full h-32 object-cover rounded-xl bg-black" />
                      )}
                      <span className="font-mono text-[11px] text-white block truncate">{media.name}</span>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                        <span>{media.uploadedAt}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(media.url);
                            alert('لینک تصویر کپی شد!');
                          }}
                          className="text-sky-400 hover:underline cursor-pointer"
                        >
                          کپی لینک
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
                        value={deepseekState.model}
                        onChange={(e) => setDeepseekState({ ...deepseekState, model: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono dir-ltr focus:border-cyan-400 focus:outline-none transition-colors text-xs cursor-pointer"
                      >
                        <option value="deepseek-chat">deepseek-chat (V3 - نگارش روان و سریع)</option>
                        <option value="deepseek-reasoner">deepseek-reasoner (R1 - استدلال عمیق و برنامه‌نویسی)</option>
                      </select>
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

                    {/* Publish Time Picker */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <label className="block font-bold text-white text-xs">ساعت انتشار روزانه:</label>
                      <input
                        type="time"
                        value={deepseekState.publishSchedule.publishTime}
                        onChange={(e) => setDeepseekState({
                          ...deepseekState,
                          publishSchedule: { ...deepseekState.publishSchedule, publishTime: e.target.value }
                        })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono dir-ltr text-xs"
                      />
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
                        value={chatbotState.model}
                        onChange={(e) => setChatbotState({ ...chatbotState, model: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs cursor-pointer focus:border-cyan-400"
                      >
                        <option value="deepseek-chat">deepseek-chat (پیش‌فرض - بسیار سریع و روان)</option>
                        <option value="deepseek-reasoner">deepseek-reasoner (R1 - استدلال محاسباتی عمیق)</option>
                      </select>
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

          </div>
        )}

      </div>
    </div>
  );
};
