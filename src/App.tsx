import React, { useState, useEffect } from 'react';
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
import { BlogHub } from './components/BlogHub';
import { AdminCmsModal } from './components/AdminCmsModal';
import { DeepSeekChatbot } from './components/DeepSeekChatbot';
import { Footer } from './components/Footer';
import { fetchArticlesFromActiveDatabase } from './utils/databaseService';
import { updateRouteSeo } from './utils/seoManager';
import { 
  SolanaWalletPage, 
  SolanaTokenPage, 
  MemeCoinPage, 
  NftPage, 
  SecurityPage, 
  OfficialDownloadPage, 
  FaqPage 
} from './components/landing/LandingPages';

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

  // Sync SEO metadata whenever route changes
  useEffect(() => {
    updateRouteSeo(currentPath);
  }, [currentPath]);

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

        {currentPath === '/blog' && (
          <div className="py-4">
            <BlogHub
              articles={articles}
              setArticles={setArticles}
              currentUser={currentUser}
              openAuthModal={openAdminModal}
            />
          </div>
        )}
      </main>

      {/* Admin / User Auth CMS Modal */}
      {isAdminModalOpen && (
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
      )}

      {/* Floating DeepSeek AI Chatbot */}
      <DeepSeekChatbot
        chatbotSettings={chatbotSettings}
        deepseekSettings={deepseekSettings}
        openAdminModal={openAdminModal}
      />

      {/* Footer */}
      <Footer onNavigate={handleNavigate} openAdminModal={openAdminModal} />

    </div>
  );
}
