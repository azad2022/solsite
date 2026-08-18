import React, { useEffect, useState } from 'react';
import { getLocalizedPath } from '../../utils/i18n';
import { HeroSection } from '../HeroSection';
import { Header } from '../Header';
import { EnglishBlogHub } from './EnglishBlogHub';
import { Article, SolanaStatus, UserAccount } from '../../types';
import { safeGetLocalStorage } from '../../utils/security';

type EnglishSiteProps = { path: string; onNavigate: (path: string) => void };

const defaultSolanaStatus: SolanaStatus = { price: 0, change24h: 0, tps: 0, avgFeeUsd: 0, avgFeeSol: 0, status: 'Mainnet Beta Online', slot: 0 };

type LocalizedEnglishArticle = Article & { translationGroupId?: string | null };

export const EnglishSite: React.FC<EnglishSiteProps> = ({ path, onNavigate }) => {
  const normalized = path === '/en' ? '/en' : path.replace(/\/+$/, '');
  const [articles, setArticles] = useState<Article[]>([]);
  const [solanaStatus, setSolanaStatus] = useState<SolanaStatus>(defaultSolanaStatus);
  const [currentUser] = useState<UserAccount | null>(() => safeGetLocalStorage<UserAccount | null>('solmint_current_user', null));
  const [languageSwitchPath, setLanguageSwitchPath] = useState(() => getLocalizedPath(path, 'fa'));
  const articleMatch = normalized.match(/^\/en\/articles\/([^/]+)$/);
  const articleSlug = articleMatch ? decodeURIComponent(articleMatch[1]) : '';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/articles/localized?language=en', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!cancelled && data && Array.isArray(data.articles)) setArticles(data.articles); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try { const response = await fetch('/api/solana/status', { cache: 'no-store' }); const data = response.ok ? await response.json() : null; if (!cancelled && data) setSolanaStatus(data); } catch {}
    };
    loadStatus();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolveTranslation = async () => {
      if (!articleSlug) {
        setLanguageSwitchPath(getLocalizedPath(path, 'fa'));
        return;
      }

      let article = articles.find(item => item.slug === articleSlug) as LocalizedEnglishArticle | undefined;

      if (!article) {
        try {
          const response = await fetch(`/api/articles/localized?language=en&slug=${encodeURIComponent(articleSlug)}`, { credentials: 'same-origin', cache: 'no-store' });
          const data = response.ok ? await response.json() : null;
          const exactArticle = Array.isArray(data?.articles) ? data.articles[0] : null;
          if (exactArticle?.slug === articleSlug) {
            article = exactArticle as LocalizedEnglishArticle;
            if (!cancelled) {
              setArticles(previous => previous.some(item => item.id === exactArticle.id) ? previous : [...previous, exactArticle]);
            }
          }
        } catch {
          article = undefined;
        }
      }

      const groupId = article?.translationGroupId || article?.id;
      if (!groupId) {
        setLanguageSwitchPath('/');
        return;
      }
      try {
        const response = await fetch(`/api/articles/translation?groupId=${encodeURIComponent(groupId)}&language=fa`, { credentials: 'same-origin', cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        const slug = data?.article?.slug;
        if (!cancelled) setLanguageSwitchPath(slug ? `/article/${encodeURIComponent(slug)}` : '/');
      } catch {
        if (!cancelled) setLanguageSwitchPath('/');
      }
    };
    resolveTranslation();
    return () => { cancelled = true; };
  }, [path, articleSlug, articles]);

  const refreshStatus = () => {
    fetch('/api/solana/status', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(data => { if (data) setSolanaStatus(data); }).catch(() => undefined);
  };
  const openAuth = () => { window.location.href = '/'; };

  return (
    <div dir="ltr" className="min-h-screen bg-[#08080f] text-slate-100 antialiased font-['Vazirmatn',sans-serif]">
      <Header
        locale="en"
        currentPath={normalized}
        onNavigate={onNavigate}
        solanaStatus={solanaStatus}
        refreshStatus={refreshStatus}
        openAdminModal={openAuth}
        currentUser={currentUser}
        onLogout={() => undefined}
      />
      <main>
        {normalized === '/en' && (
          <>
            <HeroSection locale="en" onExploreFeatures={() => onNavigate('/en#features')} />
            <section id="features" dir="ltr" className="py-20 border-b border-white/5 relative overflow-hidden">
              <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#9945FF]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-[#14F195]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
                <div className="text-center space-y-4 max-w-3xl mx-auto">
                  <h2 className="text-[48px] font-bold text-white leading-[62.5px]">Solmint platform <br className="hidden sm:block" /><span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">at a glance</span></h2>
                  <p className="text-slate-400 text-[13px] leading-relaxed">The English experience uses the same visual system, spacing and component language as the existing Solmint platform.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[
                    ['Non-Custodial Direction', 'A wallet architecture centered on user-controlled keys and transparent client-side signing.'],
                    ['Solana Market Data', 'Live SOL market information is served from the same production infrastructure used by the existing site.'],
                    ['Open-Source Development', 'The international surface uses the same public codebase and deployment pipeline.']
                  ].map(([title, body]) => (
                    <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-colors">
                      <h3 className="text-lg font-black text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
            <section id="open-source" dir="ltr" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="rounded-3xl border border-[#9945FF]/20 bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/5 p-8 sm:p-10">
                <h2 className="text-2xl font-black text-white">Building Solmint in public</h2>
                <p className="mt-3 max-w-3xl leading-8 text-slate-300">The English surface is being added without moving or breaking the existing Persian URLs. The same production project remains the single source of code, data and deployment.</p>
                <a href="https://github.com/azad2022/solsite" target="_blank" rel="noreferrer" className="inline-flex mt-6 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10">View source on GitHub</a>
              </div>
            </section>
          </>
        )}
        {normalized === '/en/solana-price' && (
          <section dir="ltr" className="relative pt-12 pb-20 overflow-hidden border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="max-w-4xl mx-auto space-y-8 text-left">
              <h1 className="text-[42px] sm:text-[48px] font-black text-white leading-tight tracking-tight">Solana (SOL) price and live market data</h1>
              <p className="text-slate-300 text-[13px] sm:text-[14px] max-w-3xl leading-7">Track the current SOL price and 24-hour movement using the same production market endpoint as the existing Solmint platform.</p>
              <div className="grid max-w-3xl gap-5 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><div className="text-xs text-slate-400">SOL price</div><div className="mt-2 text-4xl font-black text-white">{solanaStatus.price ? `$${solanaStatus.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—'}</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><div className="text-xs text-slate-400">24h change</div><div className="mt-2 text-4xl font-black text-white">{solanaStatus.price ? `${solanaStatus.change24h >= 0 ? '+' : ''}${solanaStatus.change24h.toFixed(2)}%` : '—'}</div></div></div>
            </div></div>
          </section>
        )}
        {(normalized === '/en/blog' || Boolean(articleSlug)) && <EnglishBlogHub articles={articles} setArticles={setArticles} currentUser={currentUser} openAuthModal={openAuth} initialArticleSlug={articleSlug || undefined} onNavigate={onNavigate} />}
        {normalized !== '/en' && normalized !== '/en/solana-price' && normalized !== '/en/blog' && !articleSlug && <section dir="ltr" className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8"><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#14F195]">404</p><h1 className="mt-3 text-4xl font-black text-white">Page not found</h1><p className="mx-auto mt-4 max-w-xl leading-8 text-slate-400">The requested English page does not exist yet.</p><button onClick={() => onNavigate('/en')} className="mt-8 rounded-xl bg-[#14F195] px-5 py-3 font-extrabold text-black">Back to Solmint</button></section>}
      </main>
      <span className="sr-only"><a href={languageSwitchPath}>Switch to Persian</a></span>
    </div>
  );
};
