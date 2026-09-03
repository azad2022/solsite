import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { SolanaStatus, Article, MediaItem, Testimonial, UserAccount, DownloadLinks, DEFAULT_DOWNLOAD_LINKS, DeepSeekAiSettings, DEFAULT_DEEPSEEK_SETTINGS, ChatbotSettings, DEFAULT_CHATBOT_SETTINGS } from './types';
import { INITIAL_ARTICLES, INITIAL_MEDIA_ITEMS, INITIAL_TESTIMONIALS } from './data/initialBlogData';
import { safeGetLocalStorage } from './utils/security';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { Footer } from './components/Footer';
import { DeferredSection } from './components/DeferredSection';
import { fetchArticlesFromActiveDatabase } from './utils/databaseService';
import { fetchCmsSettingsFromApi } from './utils/cmsApiClient';
import { updateRouteSeo } from './utils/seoManager';
import { getArticleCategoryTaxonomy, getArticleTagTaxonomy } from './utils/articleTaxonomy';
import { updateTaxonomySeo } from './utils/taxonomySeo';

const ParticleCanvas = lazy(() => import('./components/ParticleCanvas').then(m => ({ default: m.ParticleCanvas })));
const AppShowcase = lazy(() => import('./components/AppShowcase').then(m => ({ default: m.AppShowcase })));
const MemeTicker = lazy(() => import('./components/MemeTicker').then(m => ({ default: m.MemeTicker })));
const AppFeaturesSection = lazy(() => import('./components/AppFeaturesSection').then(m => ({ default: m.AppFeaturesSection })));
const SecuritySection = lazy(() => import('./components/SecuritySection').then(m => ({ default: m.SecuritySection })));
const RoadmapSection = lazy(() => import('./components/RoadmapSection').then(m => ({ default: m.RoadmapSection })));
const FaqSection = lazy(() => import('./components/FaqSection').then(m => ({ default: m.FaqSection })));
const LatestArticlesSection = lazy(() => import('./components/LatestArticlesSection').then(m => ({ default: m.LatestArticlesSection })));

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
const SolanaTokenToolsHub = lazy(() => import('./components/tools/SolanaTokenToolsHub').then(m => ({ default: m.SolanaTokenToolsHub })));
const SolanaTokenScannerPage = lazy(() => import('./components/tools/SolanaTokenScannerPage').then(m => ({ default: m.SolanaTokenScannerPage })));
const Token2022InspectorPage = lazy(() => import('./components/tools/Token2022InspectorPage').then(m => ({ default: m.Token2022InspectorPage })));
const WalletAnalyzerPage = lazy(() => import('./components/wallet/WalletAnalyzerPage').then(m => ({ default: m.WalletAnalyzerPage })));
const ArticleTaxonomyPage = lazy(() => import('./components/ArticleTaxonomyPage').then(m => ({ default: m.ArticleTaxonomyPage })));
const SolanaPricePage = lazy(() => import('./components/SolanaPricePage').then(m => ({ default: m.SolanaPricePage })));
const SolanaPriceSeoEnhancer = lazy(() => import('./components/SolanaPriceSeoEnhancer').then(m => ({ default: m.SolanaPriceSeoEnhancer })));
const SolanaMarketInsights = lazy(() => import('./components/SolanaMarketInsights').then(m => ({ default: m.SolanaMarketInsights })));
const AppShowcaseAdminPanel = lazy(() => import('./components/AppShowcaseAdminPanel').then(m => ({ default: m.AppShowcaseAdminPanel })));
const MemeTickerAdminPanel = lazy(() => import('./components/MemeTickerAdminPanel').then(m => ({ default: m.MemeTickerAdminPanel })));

const normalizePath = (path: string) => { const withoutQuery = (path || '/').split('?')[0].split('#')[0]; const normalized = withoutQuery.replace(/\/+$/, ''); return normalized || '/'; };
const SuspenseFallback = () => <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-sm"><div className="w-8 h-8 border-2 border-[#14F195] border-t-transparent rounded-full animate-spin" /></div>;

function readArticleBootstrap(): Article[] {
  if (typeof document === 'undefined') return [];
  const node = document.getElementById('solmint-article-bootstrap');
  if (!node?.textContent) return [];
  try {
    const source = JSON.parse(node.textContent) as Record<string, unknown>;
    const rawAuthor = source.author;
    const authorObject = typeof rawAuthor === 'object' && rawAuthor !== null ? rawAuthor as Record<string, unknown> : null;
    const article = {
      id: String(source.id || ''), title: String(source.title || ''), slug: String(source.slug || ''),
      category: (String(source.category || 'اخبار و تحلیل')) as Article['category'],
      tags: Array.isArray(source.tags) ? source.tags.map(String) : [],
      summary: String(source.summary || ''), content: String(source.content || ''),
      coverImage: String(source.cover_image || ''), coverImageAssetId: source.cover_image_asset_id ? String(source.cover_image_asset_id) : undefined,
      videoUrl: source.video_url ? String(source.video_url) : undefined,
      author: { name: String(authorObject?.name || rawAuthor || 'تیم تحریریه سولمینت'), role: String(authorObject?.role || ''), avatar: String(authorObject?.avatar || '') },
      publishedAt: String(source.published_at || ''), publishedAtJalali: source.published_at_jalali ? String(source.published_at_jalali) : undefined, publishedAtGregorian: source.published_at_gregorian ? String(source.published_at_gregorian) : undefined,
      readTimeMinutes: Number(source.read_time_minutes || 5), viewsCount: Number(source.views_count || 0), comments: Array.isArray(source.comments) ? source.comments : [],
      seoScore: source.seo_score ? Number(source.seo_score) : undefined, isDraft: Boolean(source.is_draft),
    } as Article;
    return article.id && article.slug && article.title ? [article] : [];
  } catch { return []; }
}

function readTaxonomyBootstrap(): Article[] {
  if (typeof document === 'undefined') return [];
  const node = document.getElementById('solmint-taxonomy-bootstrap');
  if (!node?.textContent) return [];
  try {
    const source = JSON.parse(node.textContent) as { articles?: unknown };
    if (!Array.isArray(source.articles)) return [];
    return source.articles.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return [];
      const raw = item as Record<string, unknown>;
      const article = {
        id: String(raw.id || ''), title: String(raw.title || ''), slug: String(raw.slug || ''),
        category: (String(raw.category || 'اخبار و تحلیل')) as Article['category'],
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        summary: String(raw.summary || ''), content: String(raw.content || ''),
        coverImage: String(raw.coverImage || ''), coverImageAssetId: raw.coverImageAssetId ? String(raw.coverImageAssetId) : undefined,
        videoUrl: raw.videoUrl ? String(raw.videoUrl) : undefined,
        author: { name: String((raw.author as Record<string, unknown> | undefined)?.name || 'تیم تحریریه سولمینت'), role: String((raw.author as Record<string, unknown> | undefined)?.role || ''), avatar: String((raw.author as Record<string, unknown> | undefined)?.avatar || '') },
        publishedAt: String(raw.publishedAt || ''), publishedAtJalali: raw.publishedAtJalali ? String(raw.publishedAtJalali) : undefined, publishedAtGregorian: raw.publishedAtGregorian ? String(raw.publishedAtGregorian) : undefined,
        readTimeMinutes: Number(raw.readTimeMinutes || 5), viewsCount: Number(raw.viewsCount || 0), comments: [],
        isDraft: Boolean(raw.isDraft)
      } as Article;
      return article.id && article.slug && article.title ? [article] : [];
    });
  } catch { return []; }
}

const AdminQuickActionsPortal: React.FC<{ enabled: boolean; onOpenMarket: () => void; onOpenShowcase: () => void; }> = ({ enabled, onOpenMarket, onOpenShowcase }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!enabled) { setTarget(null); return; }
    let attempts = 0; let timer: number | undefined;
    const findTarget = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.glass-card'));
      const card = cards.find(el => el.textContent?.includes('انتخاب بخش مدیریت:') || el.textContent?.includes('مقالات'));
      if (!card) { if (attempts++ < 30) timer = window.setTimeout(findTarget, 50); return; }
      const candidates = Array.from(card.querySelectorAll<HTMLElement>('div'));
      const nav = candidates.find(el => { const text = el.textContent || ''; const cls = el.className || ''; return text.includes('مقالات') && text.includes('چت‌بات') && cls.includes('bg-slate-900'); });
      if (nav) setTarget(nav); else if (attempts++ < 30) timer = window.setTimeout(findTarget, 50);
    };
    findTarget();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [enabled]);
  if (!enabled || !target) return null;
  return createPortal(<div className="flex flex-wrap items-center gap-1.5 basis-full w-full pt-1 mt-1 border-t border-slate-800/70">
    <button type="button" onClick={onOpenMarket} className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border border-transparent"><span aria-hidden="true">📈</span><span>مدیریت نرخ بازار</span></button>
    <button type="button" onClick={onOpenShowcase} className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 border border-transparent"><span aria-hidden="true">📱</span><span>مدیریت نمایش اپلیکیشن</span></button>
  </div>, target);
};

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => normalizePath(window.location.pathname || '/'));
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks>(() => safeGetLocalStorage<DownloadLinks>('solmint_download_links', DEFAULT_DOWNLOAD_LINKS));
  const [deepseekSettings, setDeepseekSettings] = useState<DeepSeekAiSettings>(() => safeGetLocalStorage<DeepSeekAiSettings>('solmint_deepseek_settings', DEFAULT_DEEPSEEK_SETTINGS));
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettings>(() => safeGetLocalStorage<ChatbotSettings>('solmint_chatbot_settings', DEFAULT_CHATBOT_SETTINGS));
  const [solanaStatus, setSolanaStatus] = useState<SolanaStatus>({ price: 184.25, change24h: 4.38, tps: 2890, avgFeeUsd: 0.00025, avgFeeSol: 0.000005, status: 'Mainnet Beta Online', slot: 284910283 });
  const [articles, setArticles] = useState<Article[]>(() => {
    const cached = safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES);
    const seeds = [...readTaxonomyBootstrap(), ...readArticleBootstrap()];
    if (seeds.length === 0) return cached;
    return seeds.reduce((acc, seed) => [seed, ...acc.filter(article => article.slug !== seed.slug)], cached);
  });
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => safeGetLocalStorage<MediaItem[]>('solmint_media', INITIAL_MEDIA_ITEMS));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => safeGetLocalStorage<Testimonial[]>('solmint_testimonials', INITIAL_TESTIMONIALS));
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isShowcaseAdminOpen, setIsShowcaseAdminOpen] = useState(false);
  const [isMemeTickerAdminOpen, setIsMemeTickerAdminOpen] = useState(false);

  // Authentication is server-owned. Restore the current account from the HttpOnly cookie on refresh.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/users/me', { credentials: 'include', cache: 'no-store' })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.success && data.user) setCurrentUser(data.user);
      })
      .catch(() => { /* Anonymous browsing is the valid fallback state. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previousRestoration; };
  }, []);

  const scrollToRouteTop = () => {
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    window.requestAnimationFrame(() => {
      reset();
      window.requestAnimationFrame(() => {
        reset();
        window.setTimeout(reset, 0);
      });
    });
  };

  const handleNavigate = (path: string) => {
    const normalizedPath = normalizePath(path);
    setCurrentPath(normalizedPath);
    if (normalizePath(window.location.pathname) !== normalizedPath) window.history.pushState({}, '', normalizedPath);
  };

  useEffect(() => { scrollToRouteTop(); }, [currentPath]);
  useEffect(() => { const handlePopState = () => setCurrentPath(normalizePath(window.location.pathname || '/')); window.addEventListener('popstate', handlePopState); return () => window.removeEventListener('popstate', handlePopState); }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;
    const syncPublicSettings = async () => {
      const settings = await fetchCmsSettingsFromApi();
      if (cancelled || !settings) return;
      if (settings.chatbot) setChatbotSettings(prev => ({ ...prev, ...settings.chatbot, enabled: Boolean(settings.chatbot.enabled) }));
      if (settings.downloads) setDownloadLinks(prev => ({ ...prev, ...settings.downloads }));
    };
    const timer = window.setTimeout(() => {
      void syncPublicSettings();
      interval = window.setInterval(syncPublicSettings, 30000);
    }, 1200);
    return () => { cancelled = true; window.clearTimeout(timer); if (interval) window.clearInterval(interval); };
  }, []);

  const activeArticleSlug = useMemo(() => currentPath.startsWith('/article/') ? currentPath.slice('/article/'.length).trim() : '', [currentPath]);
  const taxonomyMatch = useMemo(() => { const match = currentPath.match(/^\/blog\/(category|tag)\/([^/]+)\/?$/); return match ? { type: match[1] as 'category' | 'tag', slug: decodeURIComponent(match[2]) } : null; }, [currentPath]);
  const activeArticle = useMemo(() => activeArticleSlug ? articles.find(a => a.slug === activeArticleSlug) || null : null, [activeArticleSlug, articles]);
  const activeTaxonomy = useMemo(() => { if (!taxonomyMatch) return null; const candidates = taxonomyMatch.type === 'category' ? articles.map(article => getArticleCategoryTaxonomy(article.category)).filter(Boolean) : articles.flatMap(article => getArticleTagTaxonomy(article.tags)); return candidates.find(item => item?.slug === taxonomyMatch.slug) || null; }, [articles, taxonomyMatch]);
  const taxonomyArticleCount = useMemo(() => { if (!taxonomyMatch) return 0; return articles.filter(article => taxonomyMatch.type === 'category' ? getArticleCategoryTaxonomy(article.category)?.slug === taxonomyMatch.slug : getArticleTagTaxonomy(article.tags).some(item => item.slug === taxonomyMatch.slug)).length; }, [articles, taxonomyMatch]);

  useEffect(() => {
    if (taxonomyMatch && activeTaxonomy) {
      updateTaxonomySeo({ type: taxonomyMatch.type, slug: taxonomyMatch.slug, name: activeTaxonomy.name, count: taxonomyArticleCount });
      return;
    }
    if (activeArticle) {
      updateRouteSeo(`/article/${activeArticle.slug}`, activeArticle);
      return;
    }
    if (activeArticleSlug) return;
    if (currentPath !== '/solana-price') updateRouteSeo(currentPath);
  }, [currentPath, activeArticle, activeArticleSlug, taxonomyMatch, activeTaxonomy, taxonomyArticleCount]);

  const handleLogout = () => { setCurrentUser(null); setIsShowcaseAdminOpen(false); setIsMemeTickerAdminOpen(false); localStorage.removeItem('solmint_current_user'); localStorage.removeItem('solmint_admin_session'); };

  useEffect(() => {
    let cancelled = false;
    const loadDatabaseArticles = async () => {
      const dbArticles = await fetchArticlesFromActiveDatabase();
      if (!cancelled && dbArticles && dbArticles.length > 0) setArticles(dbArticles);
    };
    const load = () => { void loadDatabaseArticles(); };
    const delay = currentPath === '/' ? 1600 : 0;
    const timer = window.setTimeout(load, delay);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [currentPath]);

  const refreshSolanaStatus = async () => { try { const res = await fetch('/api/solana/status', { cache: 'no-store' }); if (res.ok) setSolanaStatus(await res.json()); } catch {} };
  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshSolanaStatus(); }, 1400);
    const interval = window.setInterval(refreshSolanaStatus, 30000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, []);

  const openAdminModal = () => setIsAdminModalOpen(true);
  const isPrivilegedAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || currentUser?.username === 'admin';
  const scrollToFeatures = () => { if (currentPath !== '/') { handleNavigate('/'); setTimeout(() => document.getElementById('app-features')?.scrollIntoView({ behavior: 'smooth' }), 150); } else document.getElementById('app-features')?.scrollIntoView({ behavior: 'smooth' }); };

  return <div className="min-h-screen bg-[#08080f] text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] antialiased relative selection:bg-[#9945FF] selection:text-white">
    <Suspense fallback={null}><ParticleCanvas /></Suspense>
    <Header solanaStatus={solanaStatus} refreshStatus={refreshSolanaStatus} currentPath={currentPath} onNavigate={handleNavigate} openAdminModal={openAdminModal} currentUser={currentUser} onLogout={handleLogout} />
    <main className="flex-1 relative z-10"><Suspense fallback={<SuspenseFallback />}>
      {currentPath === '/' && <>
        <HeroSection onExploreFeatures={scrollToFeatures} downloadLinks={downloadLinks} />
        <DeferredSection estimatedHeight={650}>
          <AppShowcase />
        </DeferredSection>
        <DeferredSection estimatedHeight={1}>
          <MemeTicker />
        </DeferredSection>
        <DeferredSection estimatedHeight={700}>
          <AppFeaturesSection />
        </DeferredSection>
        <DeferredSection estimatedHeight={600}>
          <SecuritySection />
        </DeferredSection>
        <DeferredSection estimatedHeight={700}>
          <RoadmapSection />
        </DeferredSection>
        <DeferredSection estimatedHeight={650}>
          <FaqSection />
        </DeferredSection>
        <DeferredSection estimatedHeight={850}>
          <LatestArticlesSection articles={articles} setArticles={setArticles} onGoToBlog={() => handleNavigate('/blog')} onNavigate={handleNavigate} />
        </DeferredSection>
      </>}
      {currentPath === '/solana-price' && <><SolanaPriceSeoEnhancer><SolanaPricePage onNavigate={handleNavigate} /></SolanaPriceSeoEnhancer><SolanaMarketInsights /></>}
      {currentPath === '/solana-wallet' && <SolanaWalletPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/solana-token' && <SolanaTokenPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/solana-meme-coin' && <MemeCoinPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/solana-nft' && <NftPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/security' && <SecurityPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/download' && <OfficialDownloadPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/faq' && <FaqPage onNavigate={handleNavigate} downloadLinks={downloadLinks} />}
      {currentPath === '/app-guide' && <AppUserGuidePage onNavigate={handleNavigate} />}
      {currentPath === '/wallet-analyzer' && <WalletAnalyzerPage onNavigate={handleNavigate} />}
      {currentPath === '/tools/solana-token-tools' && <SolanaTokenToolsHub onNavigate={handleNavigate} />}
      {currentPath === '/tools/solana-token-scanner' && <SolanaTokenScannerPage onNavigate={handleNavigate} />}
      {currentPath === '/tools/token-2022-inspector' && <Token2022InspectorPage onNavigate={handleNavigate} />}
      {taxonomyMatch && activeTaxonomy && <ArticleTaxonomyPage articles={articles} type={taxonomyMatch.type} slug={taxonomyMatch.slug} onNavigate={handleNavigate} />}
      {(currentPath === '/blog' || currentPath.startsWith('/article/')) && <div className="py-4"><BlogHub articles={articles} setArticles={setArticles} initialArticleSlug={activeArticleSlug} onNavigate={handleNavigate} /></div>}
    </Suspense></main>
    {isAdminModalOpen && <div className="relative z-[60]"><Suspense fallback={null}><AdminCmsModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} articles={articles} setArticles={setArticles} mediaItems={mediaItems} setMediaItems={setMediaItems} testimonials={testimonials} setTestimonials={setTestimonials} currentUser={currentUser} setCurrentUser={setCurrentUser} downloadLinks={downloadLinks} setDownloadLinks={setDownloadLinks} deepseekSettings={deepseekSettings} setDeepseekSettings={setDeepseekSettings} chatbotSettings={chatbotSettings} setChatbotSettings={setChatbotSettings} onGoToBlog={() => handleNavigate('/blog')} /></Suspense><AdminQuickActionsPortal enabled={isPrivilegedAdmin} onOpenMarket={() => setIsMemeTickerAdminOpen(true)} onOpenShowcase={() => setIsShowcaseAdminOpen(true)} />{isPrivilegedAdmin && <><Suspense fallback={null}><MemeTickerAdminPanel isOpen={isMemeTickerAdminOpen} onClose={() => setIsMemeTickerAdminOpen(false)} /></Suspense><Suspense fallback={null}><AppShowcaseAdminPanel isOpen={isShowcaseAdminOpen} onClose={() => setIsShowcaseAdminOpen(false)} /></Suspense></>}</div>}
    {!isAdminModalOpen && <Suspense fallback={null}><DeepSeekChatbot chatbotSettings={chatbotSettings} deepseekSettings={deepseekSettings} openAdminModal={openAdminModal} /></Suspense>}
    <Footer onNavigate={handleNavigate} openAdminModal={openAdminModal} currentPath={currentPath} articles={articles} />
  </div>;
}
