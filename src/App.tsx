import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { SolanaStatus, Article, MediaItem, Testimonial, UserAccount, DownloadLinks, DEFAULT_DOWNLOAD_LINKS, DeepSeekAiSettings, DEFAULT_DEEPSEEK_SETTINGS, ChatbotSettings, DEFAULT_CHATBOT_SETTINGS } from './types';
import { INITIAL_ARTICLES, INITIAL_MEDIA_ITEMS, INITIAL_TESTIMONIALS } from './data/initialBlogData';
import { safeGetLocalStorage, safeSetLocalStorage } from './utils/security';
import { ParticleCanvas } from './components/ParticleCanvas';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { AppFeaturesSection } from './components/AppFeaturesSection';
import { SecuritySection } from './components/SecuritySection';
import { RoadmapSection } from './components/RoadmapSection';
import { FaqSection } from './components/FaqSection';
import { LatestArticlesSection } from './components/LatestArticlesSection';
import { Footer } from './components/Footer';
import { fetchArticlesFromActiveDatabase } from './utils/databaseService';
import { updateRouteSeo } from './utils/seoManager';
import { fetchCmsSettingsFromApi } from './utils/cmsApiClient';

const BlogHub = lazy(() => import('./components/BlogHub').then(m => ({ default: m.BlogHub })));
const AdminCmsModal = lazy(() => import('./components/AdminCmsModal').then(m => ({ default: m.AdminCmsModal })));
const DeepSeekChatbot = lazy(() => import('./components/DeepSeekChatbot').then(m => ({ default: m.DeepSeekChatbot })));
const SolanaWalletPage = lazy(() => import('./components/landing/LandingPages').then(m => ({ default: m.SolanaWalletPage })));
const SolanaTokenPage = lazy(() => import('./components/landing/LandingPages').then(m => ({ default: m.SolanaTokenPage })));
const MemeCoinPage = lazy(() => import('./components/landing/LandingPages').then(m => ({ default: m.MemeCoinPage })));
const NftPage = lazy(() => import('./components/landing/LandingPages').then(m => ({ default: m.NftPage })));
const SecurityPage = lazy(() => import('./components/landing/LandingPages').then(m => ({ default: m.SecurityPage })));
const OfficialDownloadPage = lazy(() => import('./components/landing/LandingPages').then(m => ({ default: m.OfficialDownloadPage })));
const FaqPage = lazy(() => import('./components/landing/LandingPages').then(m => ({ default: m.FaqPage })));
const AppUserGuidePage = lazy(() => import('./components/AppUserGuidePage').then(m => ({ default: m.AppUserGuidePage })));

const SuspenseFallback = () => (
  <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-sm">
    <div className="w-8 h-8 border-2 border-[#14F195] border-t-transparent rounded-full animate-spin" />
  </div>
);

function decodeRouteSegment(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => safeGetLocalStorage<UserAccount | null>('solmint_current_user', null));
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks>(() => safeGetLocalStorage<DownloadLinks>('solmint_download_links', DEFAULT_DOWNLOAD_LINKS));
  const [deepseekSettings, setDeepseekSettings] = useState<DeepSeekAiSettings>(() => safeGetLocalStorage<DeepSeekAiSettings>('solmint_deepseek_settings', DEFAULT_DEEPSEEK_SETTINGS));
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettings>(() => safeGetLocalStorage<ChatbotSettings>('solmint_chatbot_settings', DEFAULT_CHATBOT_SETTINGS));
  const [solanaStatus, setSolanaStatus] = useState<SolanaStatus>({ price: 184.25, change24h: 4.38, tps: 2890, avgFeeUsd: 0.00025, avgFeeSol: 0.000005, status: 'Mainnet Beta Online', slot: 284910283 });
  const [articles, setArticles] = useState<Article[]>(() => safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES));
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => safeGetLocalStorage<MediaItem[]>('solmint_media', INITIAL_MEDIA_ITEMS));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => safeGetLocalStorage<Testimonial[]>('solmint_testimonials', INITIAL_TESTIMONIALS));
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const handleNavigate = (path: string) => {
    const normalizedPath = path || '/';
    setCurrentPath(normalizedPath);
    if (window.location.pathname !== normalizedPath) window.history.pushState({}, '', normalizedPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isAdminRoute = useMemo(() => {
    const lower = currentPath.toLowerCase();
    return lower === '/admin' || lower === '/cms' || lower === '/login' || lower === '/dashboard';
  }, [currentPath]);

  useEffect(() => {
    if (isAdminRoute) setIsAdminModalOpen(true);
  }, [isAdminRoute]);

  const activeArticleSlug = useMemo(() => {
    if (currentPath.startsWith('/article/')) return decodeRouteSegment(currentPath.slice('/article/'.length).trim());
    if (currentPath.startsWith('/blog/')) return decodeRouteSegment(currentPath.slice('/blog/'.length).trim());
    return '';
  }, [currentPath]);

  const activeArticle = useMemo(() => activeArticleSlug ? articles.find(a => a.slug === activeArticleSlug) || null : null, [activeArticleSlug, articles]);

  useEffect(() => {
    if (activeArticle) updateRouteSeo(`/article/${activeArticle.slug}`, activeArticle);
    else updateRouteSeo(currentPath);
  }, [currentPath, activeArticle]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('solmint_current_user');
    localStorage.removeItem('solmint_admin_session');
  };

  useEffect(() => {
    let cancelled = false;
    async function loadInitialServerData() {
      try {
        const dbArticles = await fetchArticlesFromActiveDatabase();
        if (!cancelled && Array.isArray(dbArticles) && dbArticles.length > 0) {
          setArticles(dbArticles);
          safeSetLocalStorage('solmint_articles', dbArticles);
        }
      } catch (error) { console.warn('Initial article refresh failed; keeping cached articles.', error); }
      try {
        const settings = await fetchCmsSettingsFromApi();
        if (!cancelled && settings) {
          if (settings.deepseek) setDeepseekSettings(settings.deepseek as any);
          if (settings.chatbot) setChatbotSettings(settings.chatbot as any);
          if (settings.downloads) setDownloadLinks(settings.downloads as any);
        }
      } catch (error) { console.warn('Initial CMS settings refresh failed; keeping cached settings.', error); }
    }
    loadInitialServerData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncPublicChatbotState = async () => {
      try {
        const settings = await fetchCmsSettingsFromApi();
        if (!cancelled && settings?.chatbot) setChatbotSettings(settings.chatbot as ChatbotSettings);
      } catch { /* Keep last known state during transient network failures. */ }
    };
    const intervalId = window.setInterval(syncPublicChatbotState, 15000);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') void syncPublicChatbotState(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const refreshSolanaStatus = async () => {
    try {
      const res = await fetch('/api/solana/status');
      if (res.ok) setSolanaStatus(await res.json());
    } catch { /* Keep cached status safely. */ }
  };

  useEffect(() => {
    const interval = setInterval(refreshSolanaStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const openAdminModal = () => setIsAdminModalOpen(true);
  const scrollToFeatures = () => {
    if (currentPath !== '/') {
      handleNavigate('/');
      setTimeout(() => document.getElementById('app-features')?.scrollIntoView({ behavior: 'smooth' }), 150);
    } else document.getElementById('app-features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#08080f] text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] antialiased relative selection:bg-[#9945FF] selection:text-white">
      <style>{`\n        @media (max-width: 767px) {\n          .admin-cms-mobile-host > .fixed.inset-0.z-50 {\n            padding: max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left));\n            overflow: hidden;\n          }\n          .admin-cms-mobile-host > .fixed.inset-0.z-50 > .glass-card {\n            width: 100%;\n            max-width: 100%;\n            height: calc(100dvh - 12px);\n            max-height: calc(100dvh - 12px);\n            margin: 0;\n            padding: 12px;\n            overflow-x: hidden;\n            overflow-y: auto;\n            overscroll-behavior: contain;\n            -webkit-overflow-scrolling: touch;\n            min-width: 0;\n          }\n          .admin-cms-mobile-host > .fixed.inset-0.z-50 > .glass-card > .flex.items-center.justify-between {\n            position: sticky;\n            top: 0;\n            z-index: 30;\n            margin: -12px -12px 0;\n            padding: 10px 12px 12px;\n            background: rgba(15, 23, 42, 0.96);\n            backdrop-filter: blur(12px);\n          }\n          .admin-cms-mobile-host input, .admin-cms-mobile-host select, .admin-cms-mobile-host textarea, .admin-cms-mobile-host button {\n            max-width: 100%;\n          }\n          .admin-cms-mobile-host pre { max-width: 100%; overflow-x: auto; }\n          .admin-cms-mobile-host img { max-width: 100%; }\n        }\n      `}</style>
      <ParticleCanvas />
      <Header solanaStatus={solanaStatus} refreshStatus={refreshSolanaStatus} currentPath={currentPath} onNavigate={handleNavigate} openAdminModal={openAdminModal} currentUser={currentUser} onLogout={handleLogout} />
      <main className="flex-1 relative z-10">
        <Suspense fallback={<SuspenseFallback />}>
          {currentPath === '/' && <><HeroSection onExploreFeatures={scrollToFeatures} downloadLinks={downloadLinks} /><AppFeaturesSection /><SecuritySection /><RoadmapSection /><FaqSection /><LatestArticlesSection articles={articles} setArticles={setArticles} onGoToBlog={() => handleNavigate('/blog')} onNavigate={handleNavigate} /></>}
          {currentPath === '/solana-wallet' && <SolanaWalletPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
          {currentPath === '/solana-token' && <SolanaTokenPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
          {currentPath === '/solana-meme-coin' && <MemeCoinPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
          {currentPath === '/solana-nft' && <NftPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
          {currentPath === '/security' && <SecurityPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
          {currentPath === '/download' && <OfficialDownloadPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
          {currentPath === '/faq' && <FaqPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
          {currentPath === '/app-guide' && <AppUserGuidePage onNavigate={handleNavigate} />}
          {(currentPath === '/blog' || currentPath.startsWith('/article/') || currentPath.startsWith('/blog/')) && <div className="py-4"><BlogHub articles={articles} setArticles={setArticles} currentUser={currentUser} openAuthModal={openAdminModal} initialArticleSlug={activeArticleSlug} onNavigate={handleNavigate} /></div>}
        </Suspense>
      </main>
      {isAdminModalOpen && <div className="admin-cms-mobile-host"><Suspense fallback={null}><AdminCmsModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} articles={articles} setArticles={setArticles} mediaItems={mediaItems} setMediaItems={setMediaItems} testimonials={testimonials} setTestimonials={setTestimonials} currentUser={currentUser} setCurrentUser={setCurrentUser} downloadLinks={downloadLinks} setDownloadLinks={setDownloadLinks} deepseekSettings={deepseekSettings} setDeepseekSettings={setDeepseekSettings} chatbotSettings={chatbotSettings} setChatbotSettings={setChatbotSettings} onGoToBlog={() => handleNavigate('/blog')} /></Suspense></div>}
      {!isAdminRoute && <Suspense fallback={null}><DeepSeekChatbot chatbotSettings={chatbotSettings} deepseekSettings={deepseekSettings} openAdminModal={openAdminModal} /></Suspense>}
      <Footer onNavigate={handleNavigate} openAdminModal={openAdminModal} />
    </div>
  );
}
