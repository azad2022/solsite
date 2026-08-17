import React, { useEffect, useState } from 'react';
import { getLocalizedPath } from '../../utils/i18n';
import { HeroSection } from '../HeroSection';

type EnglishSiteProps = { path: string; onNavigate: (path: string) => void };

const EnglishHeader: React.FC<{ path: string; onNavigate: (path: string) => void }> = ({ path, onNavigate }) => (
  <header className="relative w-full z-40 bg-[#05050a]/90 backdrop-blur-xl border-b border-white/[0.08]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
      <button type="button" onClick={() => onNavigate('/en')} className="flex items-center gap-2.5 cursor-pointer group shrink-0 bg-transparent border-0 p-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] via-[#14F195] to-[#00C2FF] p-0.5 shadow-lg shadow-[#9945FF]/20 group-hover:scale-105 transition-transform flex items-center justify-center">
          <div className="w-full h-full bg-[#05050a] rounded-[10px] flex items-center justify-center"><span className="font-black text-white text-base">S</span></div>
        </div>
        <span className="font-extrabold text-lg tracking-tight text-white">Solmint</span>
      </button>

      <nav className="hidden lg:flex items-center gap-0.5 bg-white/[0.03] p-1 rounded-full border border-white/10 whitespace-nowrap overflow-visible">
        {[
          ['/en', 'Home'],
          ['/en/solana-price', 'Solana Price'],
          ['/en#wallet', 'Wallet'],
          ['/en#web3', 'Web3'],
          ['/en#open-source', 'Open Source']
        ].map(([href, label]) => {
          const route = href.startsWith('/en/') ? href : href.split('#')[0];
          const active = route && path === route;
          return <a key={href} href={href.startsWith('/en#') ? href : href} onClick={e => { if (href.startsWith('/en#')) { e.preventDefault(); onNavigate('/en'); } else { e.preventDefault(); onNavigate(route); } }} className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer text-inherit decoration-none ${active ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white'}`}>{label}</a>;
        })}
        <a href={getLocalizedPath(path, 'fa')} className="shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white">فارسی</a>
      </nav>

      <a href={getLocalizedPath(path, 'fa')} className="sm:hidden rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300">فارسی</a>
    </div>
  </header>
);

const EnglishHome: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <>
    <HeroSection locale="en" onExploreFeatures={() => onNavigate('/en#features')} />
    <section id="features" dir="ltr" className="py-20 border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#9945FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-[#14F195]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-[48px] font-bold text-white leading-[62.5px]">Solmint platform <br className="hidden sm:block" /><span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">at a glance</span></h2>
          <p className="text-slate-400 text-[13px] leading-relaxed">The English experience uses the same visual system and layout language as the existing Solmint platform.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            ['Non-Custodial Direction', 'A wallet architecture centered on user-controlled keys and transparent client-side signing.'],
            ['Solana Market Data', 'Live SOL market information is served from the same production infrastructure used by the current site.'],
            ['Open-Source Development', 'The public codebase gives the international version the same transparent development model.']
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
);

const EnglishSolanaPrice: React.FC = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/solana/status').then(res => res.ok ? res.json() : null).then(data => { if (!cancelled && data) { setPrice(Number(data.price)); setChange(Number(data.change24h)); } }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return (
    <section dir="ltr" className="relative pt-12 pb-20 overflow-hidden border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8 text-left">
          <h1 className="text-[42px] sm:text-[48px] font-black text-white leading-tight tracking-tight">Solana (SOL) price and live market data</h1>
          <p className="text-slate-300 text-[13px] sm:text-[14px] max-w-3xl leading-7">Track the current SOL price and 24-hour movement using the same production market endpoint as the existing Solmint platform.</p>
          <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><div className="text-xs text-slate-400">SOL price</div><div className="mt-2 text-4xl font-black text-white">{price == null ? '—' : `$${price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><div className="text-xs text-slate-400">24h change</div><div className="mt-2 text-4xl font-black text-white">{change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}</div></div>
          </div>
        </div>
      </div>
    </section>
  );
};

const EnglishNotFound: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <section dir="ltr" className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#14F195]">404</p>
    <h1 className="mt-3 text-4xl font-black text-white">Page not found</h1>
    <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-400">The requested English page does not exist yet.</p>
    <button onClick={() => onNavigate('/en')} className="mt-8 rounded-xl bg-[#14F195] px-5 py-3 font-extrabold text-black">Back to Solmint</button>
  </section>
);

export const EnglishSite: React.FC<EnglishSiteProps> = ({ path, onNavigate }) => {
  const normalized = path === '/en' ? '/en' : path.replace(/\/+$/, '');
  return (
    <div dir="ltr" className="min-h-screen bg-[#08080f] text-slate-100 antialiased">
      <EnglishHeader path={normalized} onNavigate={onNavigate} />
      <main>
        {normalized === '/en' && <EnglishHome onNavigate={onNavigate} />}
        {normalized === '/en/solana-price' && <EnglishSolanaPrice />}
        {normalized !== '/en' && normalized !== '/en/solana-price' && <EnglishNotFound onNavigate={onNavigate} />}
      </main>
    </div>
  );
};
