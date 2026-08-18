import React, { useEffect, useState } from 'react';
import { getLocalizedPath } from '../../utils/i18n';
import { HeroSection } from '../HeroSection';
import { EnglishBlogHub } from './EnglishBlogHub';
import { EnglishHeader } from './EnglishHeader';
import { EnglishHomeSections } from './EnglishHomeSections';
import { EnglishAppGuidePage, EnglishDownloadPage, EnglishFaqPage, EnglishMemeCoinPage, EnglishNftPage, EnglishSecurityPage, EnglishTokenPage, EnglishToolsPage, EnglishWalletPage } from './EnglishLandingPages';
import { EnglishTokenScannerPage, EnglishWalletAnalyzerPage } from './EnglishFunctionalTools';
import { EnglishToken2022InspectorPage } from './EnglishToken2022InspectorPage';
import { Article, SolanaStatus, UserAccount } from '../../types';
import { safeGetLocalStorage } from '../../utils/security';

type EnglishSiteProps = { path: string; onNavigate: (path: string) => void };
type LocalizedEnglishArticle = Article & { translationGroupId?: string | null };
const defaultSolanaStatus: SolanaStatus = { price: 0, change24h: 0, tps: 0, avgFeeUsd: 0, avgFeeSol: 0, status: 'Mainnet Beta Online', slot: 0 };

const EnglishFooter: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <footer className="border-t border-white/10 bg-[#05050a] py-12 text-sm text-slate-400" dir="ltr">
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div><div className="text-base font-black text-white">Solmint</div><p className="mt-3 leading-7">Solana-focused non-custodial wallet and Web3 platform for the Android ecosystem.</p></div>
        <div><div className="font-black text-white">Product</div><div className="mt-3 space-y-2"><button onClick={() => onNavigate('/en/solana-wallet')} className="block hover:text-white">Solana Wallet</button><button onClick={() => onNavigate('/en/solana-token')} className="block hover:text-white">Token Creator</button><button onClick={() => onNavigate('/en/solana-meme-coin')} className="block hover:text-white">Meme Coin</button><button onClick={() => onNavigate('/en/solana-nft')} className="block hover:text-white">NFT</button></div></div>
        <div><div className="font-black text-white">Resources</div><div className="mt-3 space-y-2"><button onClick={() => onNavigate('/en/solana-price')} className="block hover:text-white">Live SOL Price</button><button onClick={() => onNavigate('/en/tools')} className="block hover:text-white">Solana Tools</button><button onClick={() => onNavigate('/en/blog')} className="block hover:text-white">Blog &amp; Academy</button><button onClick={() => onNavigate('/en/faq')} className="block hover:text-white">FAQ</button></div></div>
        <div><div className="font-black text-white">Project</div><div className="mt-3 space-y-2"><a href="https://github.com/azad2022/solsite" target="_blank" rel="noreferrer" className="block hover:text-white">GitHub</a><button onClick={() => onNavigate('/')} className="block hover:text-white">فارسی</button></div></div>
      </div>
      <div className="border-t border-white/10 pt-6 text-xs text-slate-500">© Solmint. Existing Persian URLs remain unchanged.</div>
    </div>
  </footer>
);

const EnglishPricePage: React.FC<{ status: SolanaStatus; onNavigate: (path: string) => void }> = ({ status, onNavigate }) => (
  <main dir="ltr" className="pb-20">
    <section className="border-b border-white/5 py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="max-w-4xl"><div className="text-xs font-black uppercase tracking-[.18em] text-[#14F195]">Solana market</div><h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">Solana price, live market data and network activity</h1><p className="mt-5 max-w-3xl text-sm leading-8 text-slate-400 sm:text-base">Track SOL price and 24-hour movement using the same production market endpoint used by Solmint. Network metrics remain read-only and update automatically.</p></div><div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"><article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"><span className="text-xs text-slate-500">SOL price</span><strong className="mt-2 block text-4xl font-black text-white">${status.price ? status.price.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</strong></article><article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"><span className="text-xs text-slate-500">24h change</span><strong className={`mt-2 block text-4xl font-black ${status.change24h >= 0 ? 'text-[#14F195]' : 'text-rose-400'}`}>{status.price ? `${status.change24h >= 0 ? '+' : ''}${status.change24h.toFixed(2)}%` : '—'}</strong></article><article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"><span className="text-xs text-slate-500">Network TPS</span><strong className="mt-2 block text-4xl font-black text-white">{status.tps ? status.tps.toLocaleString('en-US') : '—'}</strong></article><article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"><span className="text-xs text-slate-500">Average fee</span><strong className="mt-2 block text-4xl font-black text-white">{status.avgFeeUsd ? `$${status.avgFeeUsd.toFixed(5)}` : '—'}</strong></article></div></div></section>
    <section className="py-16"><div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8"><div className="grid gap-5 md:grid-cols-3"><article className="rounded-3xl border border-white/10 bg-slate-950/60 p-6"><h2 className="text-lg font-black text-white">Market context</h2><p className="mt-3 text-sm leading-7 text-slate-400">Price and percentage movement are fetched from the live Solmint market service rather than hard-coded into the English page.</p></article><article className="rounded-3xl border border-white/10 bg-slate-950/60 p-6"><h2 className="text-lg font-black text-white">Network context</h2><p className="mt-3 text-sm leading-7 text-slate-400">TPS, slot and fee metrics come from the same production Solana status endpoint used by the existing platform.</p></article><article className="rounded-3xl border border-white/10 bg-slate-950/60 p-6"><h2 className="text-lg font-black text-white">Research</h2><p className="mt-3 text-sm leading-7 text-slate-400">For analysis, education and ecosystem coverage, continue to the English Blog &amp; Academy.</p><button onClick={() => onNavigate('/en/blog')} className="mt-4 rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10">Open English Blog</button></article></div></div></section>
  </main>
);

export const EnglishSite: React.FC<EnglishSiteProps> = ({ path, onNavigate }) => {
  const normalized = path.replace(/\/+$/, '') || '/en';
  const [articles, setArticles] = useState<Article[]>([]);
  const [solanaStatus, setSolanaStatus] = useState<SolanaStatus>(defaultSolanaStatus);
  const [currentUser] = useState<UserAccount | null>(() => safeGetLocalStorage<UserAccount | null>('solmint_current_user', null));
  const [languageSwitchPath, setLanguageSwitchPath] = useState(() => getLocalizedPath(path, 'fa'));
  const articleMatch = normalized.match(/^\/en\/articles\/([^/]+)$/);
  const articleSlug = articleMatch ? decodeURIComponent(articleMatch[1]) : '';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/articles/localized?language=en', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (!cancelled && Array.isArray(data?.articles)) setArticles(data.articles); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => { try { const r = await fetch('/api/solana/status', { cache: 'no-store' }); const data = r.ok ? await r.json() : null; if (!cancelled && data) setSolanaStatus(data); } catch {} };
    loadStatus(); const id = window.setInterval(loadStatus, 10000); return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolveTranslation = async () => {
      if (!articleSlug) { setLanguageSwitchPath(getLocalizedPath(path, 'fa')); return; }
      let article = articles.find(item => item.slug === articleSlug) as LocalizedEnglishArticle | undefined;
      if (!article) {
        try { const r = await fetch(`/api/articles/localized?language=en&slug=${encodeURIComponent(articleSlug)}`, { credentials: 'same-origin', cache: 'no-store' }); const data = r.ok ? await r.json() : null; const exact = Array.isArray(data?.articles) ? data.articles[0] : null; if (exact?.slug === articleSlug) { article = exact as LocalizedEnglishArticle; if (!cancelled) setArticles(prev => prev.some(item => item.id === exact.id) ? prev : [...prev, exact]); } } catch { article = undefined; }
      }
      const groupId = article?.translationGroupId || article?.id;
      if (!groupId) { setLanguageSwitchPath('/'); return; }
      try { const r = await fetch(`/api/articles/translation?groupId=${encodeURIComponent(groupId)}&language=fa`, { credentials: 'same-origin', cache: 'no-store' }); const data = r.ok ? await r.json() : null; const slug = data?.article?.slug; if (!cancelled) setLanguageSwitchPath(slug ? `/article/${encodeURIComponent(slug)}` : '/'); } catch { if (!cancelled) setLanguageSwitchPath('/'); }
    };
    resolveTranslation(); return () => { cancelled = true; };
  }, [path, articleSlug, articles]);

  const openAuth = () => { window.location.href = '/'; };
  const isKnownRoute = normalized === '/en' || normalized === '/en/solana-price' || normalized === '/en/blog' || Boolean(articleSlug) || ['/en/solana-wallet','/en/wallet-analyzer','/en/tools/solana-token-scanner','/en/tools/token-2022-inspector','/en/solana-token','/en/solana-meme-coin','/en/solana-nft','/en/security','/en/faq','/en/app-guide','/en/download','/en/tools'].includes(normalized);

  return <div dir="ltr" className="min-h-screen bg-[#08080f] font-['Vazirmatn',sans-serif] text-slate-100 antialiased">
    <EnglishHeader currentPath={normalized} onNavigate={onNavigate} solanaStatus={solanaStatus} currentUser={currentUser} openAuth={openAuth} />
    <main>
      {normalized === '/en' && <><HeroSection locale="en" onExploreFeatures={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} /><EnglishHomeSections articles={articles} status={solanaStatus} onNavigate={onNavigate} />}</>}
      {normalized === '/en/solana-price' && <EnglishPricePage status={solanaStatus} onNavigate={onNavigate} />}
      {normalized === '/en/solana-wallet' && <EnglishWalletPage onNavigate={onNavigate} />}
      {normalized === '/en/wallet-analyzer' && <EnglishWalletAnalyzerPage onNavigate={onNavigate} />}
      {normalized === '/en/solana-token' && <EnglishTokenPage onNavigate={onNavigate} />}
      {normalized === '/en/solana-meme-coin' && <EnglishMemeCoinPage onNavigate={onNavigate} />}
      {normalized === '/en/solana-nft' && <EnglishNftPage onNavigate={onNavigate} />}
      {normalized === '/en/security' && <EnglishSecurityPage onNavigate={onNavigate} />}
      {normalized === '/en/faq' && <EnglishFaqPage onNavigate={onNavigate} />}
      {normalized === '/en/app-guide' && <EnglishAppGuidePage onNavigate={onNavigate} />}
      {normalized === '/en/download' && <EnglishDownloadPage onNavigate={onNavigate} />}
      {normalized === '/en/tools' && <EnglishToolsPage onNavigate={onNavigate} />}
      {normalized === '/en/tools/solana-token-scanner' && <EnglishTokenScannerPage onNavigate={onNavigate} />}
      {normalized === '/en/tools/token-2022-inspector' && <EnglishToken2022InspectorPage onNavigate={onNavigate} />}
      {(normalized === '/en/blog' || Boolean(articleSlug)) && <EnglishBlogHub articles={articles} setArticles={setArticles} currentUser={currentUser} openAuthModal={openAuth} initialArticleSlug={articleSlug || undefined} onNavigate={onNavigate} />}
      {!isKnownRoute && <section className="mx-auto max-w-3xl px-4 py-24 text-center"><p className="text-sm font-black uppercase tracking-widest text-[#14F195]">404</p><h1 className="mt-3 text-4xl font-black text-white">Page not found</h1><p className="mt-4 text-slate-400">The requested English page does not exist yet.</p><button onClick={() => onNavigate('/en')} className="mt-8 rounded-xl bg-[#14F195] px-5 py-3 font-black text-slate-950">Back to Solmint</button></section>}
    </main>
    <EnglishFooter onNavigate={onNavigate} />
    <a href={languageSwitchPath} className="sr-only">Switch to Persian</a>
  </div>;
};
