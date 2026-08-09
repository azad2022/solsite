import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { SolanaStatus, Article, MediaItem, Testimonial, UserAccount, DownloadLinks, DEFAULT_DOWNLOAD_LINKS, DeepSeekAiSettings, DEFAULT_DEEPSEEK_SETTINGS, ChatbotSettings, DEFAULT_CHATBOT_SETTINGS } from './types';
import { INITIAL_ARTICLES, INITIAL_MEDIA_ITEMS, INITIAL_TESTIMONIALS } from './data/initialBlogData';
import { safeGetLocalStorage } from './utils/security';
import { ParticleCanvas } from './components/ParticleCanvas';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { AppFeaturesSection } from './components/AppFeaturesSection';
import { AppShowcase } from './components/AppShowcase';
import { AppShowcaseAdminPanel } from './components/AppShowcaseAdminPanel';
import { MemeTicker } from './components/MemeTicker';
import { MemeTickerAdminPanel } from './components/MemeTickerAdminPanel';
import { SecuritySection } from './components/SecuritySection';
import { RoadmapSection } from './components/RoadmapSection';
import { FaqSection } from './components/FaqSection';
import { LatestArticlesSection } from './components/LatestArticlesSection';
import { Footer } from './components/Footer';
import { fetchArticlesFromActiveDatabase } from './utils/databaseService';
import { fetchCmsSettingsFromApi } from './utils/cmsApiClient';
import { updateRouteSeo } from './utils/seoManager';
import { ArticleTaxonomyPage } from './components/ArticleTaxonomyPage';
import { getArticleCategoryTaxonomy, getArticleTagTaxonomy } from './utils/articleTaxonomy';
import { updateTaxonomySeo } from './utils/taxonomySeo';
import { SolanaPricePage } from './components/SolanaPricePage';
import { SolanaPriceSeoEnhancer } from './components/SolanaPriceSeoEnhancer';
import { SolanaMarketComments, SolanaMarketInsights } from './components/SolanaMarketInsights';

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

const normalizePath = (path: string) => { const withoutQuery = (path || '/').split('?')[0].split('#')[0]; const normalized = withoutQuery.replace(/\/+$/, ''); return normalized || '/'; };
const SuspenseFallback = () => <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-sm"><div className="w-8 h-8 border-2 border-[#14F195] border-t-transparent rounded-full animate-spin" /></div>;

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => normalizePath(window.location.pathname || '/'));
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => safeGetLocalStorage<UserAccount | null>('solmint_current_user', null));
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks>(() => safeGetLocalStorage<DownloadLinks>('solmint_download_links', DEFAULT_DOWNLOAD_LINKS));
  const [deepseekSettings, setDeepseekSettings] = useState<DeepSeekAiSettings>(() => safeGetLocalStorage<DeepSeekAiSettings>('solmint_deepseek_settings', DEFAULT_DEEPSEEK_SETTINGS));
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettings>(() => safeGetLocalStorage<ChatbotSettings>('solmint_chatbot_settings', DEFAULT_CHATBOT_SETTINGS));
  const [solanaStatus, setSolanaStatus] = useState<SolanaStatus>({ price: 184.25, change24h: 4.38, tps: 2890, avgFeeUsd: 0.00025, avgFeeSol: 0.000005, status: 'Mainnet Beta Online', slot: 284910283 });
  const [articles, setArticles] = useState<Article[]>(() => safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES));
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => safeGetLocalStorage<MediaItem[]>('solmint_media', INITIAL_MEDIA_ITEMS));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => safeGetLocalStorage<Testimonial[]>('solmint_testimonials', INITIAL_TESTIMONIALS));
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isShowcaseAdminOpen, setIsShowcaseAdminOpen] = useState(false);
  const [isMemeTickerAdminOpen, setIsMemeTickerAdminOpen] = useState(false);

  const handleNavigate = (path: string) => { const normalizedPath = normalizePath(path); setCurrentPath(normalizedPath); if (normalizePath(window.location.pathname) !== normalizedPath) window.history.pushState({}, '', normalizedPath); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  useEffect(() => { const handlePopState = () => setCurrentPath(normalizePath(window.location.pathname || '/')); window.addEventListener('popstate', handlePopState); return () => window.removeEventListener('popstate', handlePopState); }, []);

  // Public site settings are server-authoritative. LocalStorage is only a bootstrap cache and never overrides the server value.
  useEffect(() => {
    let cancelled = false;
    const syncPublicSettings = async () => {
      const settings = await fetchCmsSettingsFromApi();
      if (cancelled || !settings) return;
      if (settings.chatbot) setChatbotSettings(prev => ({ ...prev, ...settings.chatbot, enabled: Boolean(settings.chatbot.enabled) }));
      if (settings.downloads) setDownloadLinks(prev => ({ ...prev, ...settings.downloads }));
    };
    syncPublicSettings();
    const interval = window.setInterval(syncPublicSettings, 10000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const activeArticleSlug = useMemo(() => currentPath.startsWith('/article/') ? currentPath.slice('/article/'.length).trim() : '', [currentPath]);
  const taxonomyMatch = useMemo(() => { const match = currentPath.match(/^\/blog\/(category|tag)\/([^/]+)\/?$/); return match ? { type: match[1] as 'category' | 'tag', slug: decodeURIComponent(match[2]) } : null; }, [currentPath]);
  const activeArticle = useMemo(() => activeArticleSlug ? articles.find(a => a.slug === activeArticleSlug) || null : null, [activeArticleSlug, articles]);
  const activeTaxonomy = useMemo(() => { if (!taxonomyMatch) return null; const candidates = taxonomyMatch.type === 'category' ? articles.map(article => getArticleCategoryTaxonomy(article.category)).filter(Boolean) : articles.flatMap(article => getArticleTagTaxonomy(article.tags)); return candidates.find(item => item?.slug === taxonomyMatch.slug) || null; }, [articles, taxonomyMatch]);
  const taxonomyArticleCount = useMemo(() => { if (!taxonomyMatch) return 0; return articles.filter(article => taxonomyMatch.type === 'category' ? getArticleCategoryTaxonomy(article.category)?.slug === taxonomyMatch.slug : getArticleTagTaxonomy(article.tags).some(item => item.slug === taxonomyMatch.slug)).length; }, [articles, taxonomyMatch]);

  useEffect(() => { if (taxonomyMatch && activeTaxonomy) updateTaxonomySeo({ type: taxonomyMatch.type, slug: taxonomyMatch.slug, name: activeTaxonomy.name, count: taxonomyArticleCount }); else if (activeArticle) updateRouteSeo(`/article/${activeArticle.slug}`, activeArticle); else if (currentPath !== '/solana-price') updateRouteSeo(currentPath); }, [currentPath, activeArticle, taxonomyMatch, activeTaxonomy, taxonomyArticleCount]);
  const handleLogout = () => { setCurrentUser(null); setIsShowcaseAdminOpen(false); setIsMemeTickerAdminOpen(false); localStorage.removeItem('solmint_current_user'); localStorage.removeItem('solmint_admin_session'); };
  useEffect(() => { async function loadDatabaseArticles() { const dbArticles = await fetchArticlesFromActiveDatabase(); if (dbArticles && dbArticles.length > 0) setArticles(dbArticles); } loadDatabaseArticles(); }, []);
  const refreshSolanaStatus = async () => { try { const res = await fetch('/api/solana/status'); if (res.ok) setSolanaStatus(await res.json()); } catch {} };
  useEffect(() => { const interval = setInterval(refreshSolanaStatus, 10000); return () => clearInterval(interval); }, []);
  const openAdminModal = () => setIsAdminModalOpen(true);
  const isPrivilegedAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || currentUser?.username === 'admin';
  const scrollToFeatures = () => { if (currentPath !== '/') { handleNavigate('/'); setTimeout(() => document.getElementById('app-features')?.scrollIntoView({ behavior: 'smooth' }), 150); } else document.getElementById('app-features')?.scrollIntoView({ behavior: 'smooth' }); };

  return <div className="min-h-screen bg-[#08080f] text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] antialiased relative selection:bg-[#9945FF] selection:text-white">
    <ParticleCanvas />
    <Header solanaStatus={solanaStatus} refreshStatus={refreshSolanaStatus} currentPath={currentPath} onNavigate={handleNavigate} openAdminModal={openAdminModal} currentUser={currentUser} onLogout={handleLogout} />
    <main className="flex-1 relative z-10"><Suspense fallback={<SuspenseFallback />}>
      {currentPath === '/' && <><HeroSection onExploreFeatures={scrollToFeatures} downloadLinks={downloadLinks} /><AppShowcase /><MemeTicker /><AppFeaturesSection /><SecuritySection /><RoadmapSection /><FaqSection /><LatestArticlesSection articles={articles} setArticles={setArticles} onGoToBlog={() => handleNavigate('/blog')} onNavigate={handleNavigate} /></>}
      {currentPath === '/solana-price' && <><SolanaPriceSeoEnhancer><SolanaPricePage onNavigate={handleNavigate} downloadLinks={downloadLinks} /></SolanaPriceSeoEnhancer><SolanaMarketInsights /><SolanaMarketComments currentUser={currentUser} openAuthModal={openAdminModal} /></>}
      {currentPath === '/solana-wallet' && <SolanaWalletPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/solana-token' && <SolanaTokenPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/solana-meme-coin' && <MemeCoinPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/solana-nft' && <NftPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/security' && <SecurityPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/download' && <OfficialDownloadPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/faq' && <FaqPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/app-guide' && <AppUserGuidePage onNavigate={handleNavigate} />}
      {taxonomyMatch && activeTaxonomy && <ArticleTaxonomyPage articles={articles} type={taxonomyMatch.type} slug={taxonomyMatch.slug} onNavigate={handleNavigate} />}
      {(currentPath === '/blog' || currentPath.startsWith('/article/')) && <div className="py-4"><BlogHub articles={articles} setArticles={setArticles} currentUser={currentUser} openAuthModal={openAdminModal} initialArticleSlug={activeArticleSlug} onNavigate={handleNavigate} /></div>}
    </Suspense></main>
    {isAdminModalOpen && <div className="relative z-[60]"><Suspense fallback={null}><AdminCmsModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} articles={articles} setArticles={setArticles} mediaItems={mediaItems} setMediaItems={setMediaItems} testimonials={testimonials} setTestimonials={setTestimonials} currentUser={currentUser} setCurrentUser={setCurrentUser} downloadLinks={downloadLinks} setDownloadLinks={setDownloadLinks} deepseekSettings={deepseekSettings} setDeepseekSettings={setDeepseekSettings} chatbotSettings={chatbotSettings} setChatbotSettings={setChatbotSettings} onGoToBlog={() => handleNavigate('/blog')} /></Suspense>{isPrivilegedAdmin && <><div className="fixed top-[96px] left-2 right-2 sm:left-auto sm:right-8 sm:top-8 z-[80] flex flex-wrap justify-center sm:justify-end gap-2 pointer-events-none"><button type="button" onClick={() => setIsMemeTickerAdminOpen(true)} className="pointer-events-auto px-3 py-2 rounded-xl bg-slate-950/95 border border-[#14F195]/25 text-white font-black text-[11px] shadow-2xl backdrop-blur flex items-center gap-2 hover:bg-slate-900 transition-colors">📈 مدیریت نرخ بازار</button><button type="button" onClick={() => setIsShowcaseAdminOpen(true)} className="pointer-events-auto px-3 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-slate-950 font-black text-[11px] shadow-2xl border border-white/10 flex items-center gap-2 hover:opacity-95 transition-opacity">📱 مدیریت نمایش اپلیکیشن</button></div><MemeTickerAdminPanel isOpen={isMemeTickerAdminOpen} onClose={() => setIsMemeTickerAdminOpen(false)} /><AppShowcaseAdminPanel isOpen={isShowcaseAdminOpen} onClose={() => setIsShowcaseAdminOpen(false)} /></>}</div>}
    {!isAdminModalOpen && <Suspense fallback={null}><DeepSeekChatbot chatbotSettings={chatbotSettings} deepseekSettings={deepseekSettings} openAdminModal={openAdminModal} /></Suspense>}
    <Footer onNavigate={handleNavigate} openAdminModal={openAdminModal} />
  </div>;
}
