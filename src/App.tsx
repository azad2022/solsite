import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { SolanaStatus, Article, MediaItem, Testimonial, UserAccount, DownloadLinks, DEFAULT_DOWNLOAD_LINKS, DeepSeekAiSettings, DEFAULT_DEEPSEEK_SETTINGS, ChatbotSettings, DEFAULT_CHATBOT_SETTINGS } from './types';
import { INITIAL_ARTICLES, INITIAL_MEDIA_ITEMS, INITIAL_TESTIMONIALS } from './data/initialBlogData';
import { safeGetLocalStorage } from './utils/security';
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

// Lazy-loaded heavy components & sub-routes to minimize initial JavaScript bundle size
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

const SuspenseFallback = () => (
  <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-sm">
    <div className="w-8 h-8 border-2 border-[#14F195] border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  // Current browser route path
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  // Current logged in user (normal user or admin)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    return safeGetLocalStorage<UserAccount | null>('solmint_current_user', null);
  });

  // Persistent Download Links state
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks>(() => {
    return safeGetLocalStorage<DownloadLinks>('solmint_download_links', DEFAULT_DOWNLOAD_LINKS);
  });

  // Persistent DeepSeek AI Settings state
  const [deepseekSettings, setDeepseekSettings] = useState<DeepSeekAiSettings>(() => {
    const saved = safeGetLocalStorage<DeepSeekAiSettings>('solmint_deepseek_settings', DEFAULT_DEEPSEEK_SETTINGS);
    if (!saved.apiKey || saved.apiKey.trim() === '' || saved.apiBaseUrl === 'https://api.deepseek.com/v1') {
      return {
        ...saved,
        apiKey: DEFAULT_DEEPSEEK_SETTINGS.apiKey,
        apiBaseUrl: DEFAULT_DEEPSEEK_SETTINGS.apiBaseUrl
      };
    }
    return saved;
  });

  // Persistent Chatbot Settings state
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettings>(() => {
    const saved = safeGetLocalStorage<ChatbotSettings>('solmint_chatbot_settings', DEFAULT_CHATBOT_SETTINGS);
    if (!saved.apiKey || saved.apiKey.trim() === '' || saved.apiBaseUrl === 'https://api.deepseek.com/v1') {
      return {
        ...saved,
        apiKey: DEFAULT_CHATBOT_SETTINGS.apiKey,
        apiBaseUrl: DEFAULT_CHATBOT_SETTINGS.apiBaseUrl
      };
    }
    return saved;
  });

  // Live Solana Ticker State
  const [solanaStatus, setSolanaStatus] = useState<SolanaStatus>({
    price: 184.25,
    change24h: 4.38,
    tps: 2890,
    avgFeeUsd: 0.00025,
    avgFeeSol: 0.000005,
    status: 'Mainnet Beta Online',
    slot: 284910283
  });

  // Persistent Articles, Media & Testimonials state
  const [articles, setArticles] = useState<Article[]>(() => {
    return safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES);
  });

  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    return safeGetLocalStorage<MediaItem[]>('solmint_media', INITIAL_MEDIA_ITEMS);
  });

  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => {
    return safeGetLocalStorage<Testimonial[]>('solmint_testimonials', INITIAL_TESTIMONIALS);
  });

  // Admin / Auth CMS Modal
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Navigate handler with pushState and SEO head update
  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Popstate listener for browser forward/back buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Extract active article slug if on an article route
  const activeArticleSlug = useMemo(() => {
    if (currentPath.startsWith('/article/')) {
      return currentPath.replace('/article/', '').trim();
    }
    if (currentPath.startsWith('/blog/')) {
      return currentPath.replace('/blog/', '').trim();
    }
    return '';
  }, [currentPath]);

  const activeArticle = useMemo(() => {
    if (!activeArticleSlug) return null;
    return articles.find(a => a.slug === activeArticleSlug) || null;
  }, [activeArticleSlug, articles]);

  // Sync SEO metadata whenever route changes
  useEffect(() => {
    if (activeArticle) {
      updateRouteSeo(`/article/${activeArticle.slug}`, activeArticle);
    } else {
      updateRouteSeo(currentPath);
    }
  }, [currentPath, activeArticle]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('solmint_current_user');
    localStorage.removeItem('solmint_admin_session');
  };

  // Fetch articles from active database on mount
  useEffect(() => {
    async function loadDatabaseArticles() {
      const dbArticles = await fetchArticlesFromActiveDatabase();
      if (dbArticles && dbArticles.length > 0) {
        setArticles(dbArticles);
      }
    }
    loadDatabaseArticles();
  }, []);

  // Live status ticker auto-refresh
  const refreshSolanaStatus = async () => {
    try {
      const res = await fetch('/api/solana/status');
      if (res.ok) {
        const data = await res.json();
        setSolanaStatus(data);
      }
    } catch {
      // Keep cached status safely
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      refreshSolanaStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const openAdminModal = () => {
    setIsAdminModalOpen(true);
  };

  const scrollToFeatures = () => {
    if (currentPath !== '/') {
      handleNavigate('/');
      setTimeout(() => {
        const el = document.getElementById('app-features');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      const el = document.getElementById('app-features');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#08080f] text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] antialiased relative selection:bg-[#9945FF] selection:text-white">
      
      {/* Background Particle Canvas */}
      <ParticleCanvas />

      {/* Clean Top Header & Navigation */}
      <Header
        solanaStatus={solanaStatus}
        refreshStatus={refreshSolanaStatus}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        openAdminModal={openAdminModal}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        <Suspense fallback={<SuspenseFallback />}>
          {currentPath === '/' && (
            <>
              <HeroSection onExploreFeatures={scrollToFeatures} downloadLinks={downloadLinks} />
              <AppFeaturesSection />
              <SecuritySection />
              <RoadmapSection />
              <FaqSection />
              <LatestArticlesSection
                articles={articles}
                setArticles={setArticles}
                onGoToBlog={() => handleNavigate('/blog')}
              />
            </>
          )}

          {currentPath === '/solana-wallet' && (
            <SolanaWalletPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />
          )}

          {currentPath === '/solana-token' && (
            <SolanaTokenPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />
          )}

          {currentPath === '/solana-meme-coin' && (
            <MemeCoinPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />
          )}

          {currentPath === '/solana-nft' && (
            <NftPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />
          )}

          {currentPath === '/security' && (
            <SecurityPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />
          )}

          {currentPath === '/download' && (
            <OfficialDownloadPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />
          )}

          {currentPath === '/faq' && (
            <FaqPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />
          )}

          {(currentPath === '/blog' || currentPath.startsWith('/article/') || currentPath.startsWith('/blog/')) && (
            <div className="py-4">
              <BlogHub
                articles={articles}
                setArticles={setArticles}
                currentUser={currentUser}
                openAuthModal={openAdminModal}
                initialArticleSlug={activeArticleSlug}
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </Suspense>
      </main>

      {/* Admin / User Auth CMS Modal */}
      {isAdminModalOpen && (
        <Suspense fallback={null}>
          <AdminCmsModal
            isOpen={isAdminModalOpen}
            onClose={() => setIsAdminModalOpen(false)}
            articles={articles}
            setArticles={setArticles}
            mediaItems={mediaItems}
            setMediaItems={setMediaItems}
            testimonials={testimonials}
            setTestimonials={setTestimonials}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            downloadLinks={downloadLinks}
            setDownloadLinks={setDownloadLinks}
            deepseekSettings={deepseekSettings}
            setDeepseekSettings={setDeepseekSettings}
            chatbotSettings={chatbotSettings}
            setChatbotSettings={setChatbotSettings}
            onGoToBlog={() => handleNavigate('/blog')}
          />
        </Suspense>
      )}

      {/* Floating DeepSeek AI Chatbot */}
      <Suspense fallback={null}>
        <DeepSeekChatbot
          chatbotSettings={chatbotSettings}
          deepseekSettings={deepseekSettings}
          openAdminModal={openAdminModal}
        />
      </Suspense>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} openAdminModal={openAdminModal} />

    </div>
  );
}
