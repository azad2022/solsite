import React, { useEffect, useState } from 'react';
import { getLocalizedPath } from '../../utils/i18n';

type EnglishSiteProps = { path: string; onNavigate: (path: string) => void };

const EnglishHeader: React.FC<{ path: string; onNavigate: (path: string) => void }> = ({ path, onNavigate }) => (
  <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05050a]/95 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <button type="button" onClick={() => onNavigate('/en')} className="flex items-center gap-3 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#9945FF] via-[#14F195] to-[#00C2FF] p-0.5">
          <span className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#05050a] text-sm font-black text-white">S</span>
        </span>
        <span className="font-extrabold tracking-tight text-white">Solmint</span>
      </button>
      <nav className="hidden items-center gap-1 sm:flex">
        <button onClick={() => onNavigate('/en')} className={`rounded-full px-3 py-2 text-sm ${path === '/en' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}>Home</button>
        <button onClick={() => onNavigate('/en/solana-price')} className={`rounded-full px-3 py-2 text-sm ${path === '/en/solana-price' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}>Solana Price</button>
        <a href={getLocalizedPath(path, 'fa')} className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300 hover:text-white">فارسی</a>
      </nav>
      <a href={getLocalizedPath(path, 'fa')} className="sm:hidden rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300">فارسی</a>
    </div>
  </header>
);

const EnglishHome: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <>
    <section className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#14F195]">Solana • Web3 • Open Source</p>
        <h1 className="text-4xl font-black leading-tight text-white sm:text-6xl">Solmint — a Solana-focused platform for wallets, market data and Web3 education.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Solmint is building an open, non-custodial ecosystem around Solana. Explore live SOL market data, learn about Solana and follow the development of the upcoming open-source wallet.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={() => onNavigate('/en/solana-price')} className="rounded-xl bg-[#14F195] px-5 py-3 font-extrabold text-black">View SOL Price</button>
          <a href="https://github.com/azad2022/solsite" target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10">View Source on GitHub</a>
        </div>
      </div>
    </section>
    <section className="border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        {[
          ['Non-custodial direction', 'The wallet roadmap is designed around user-controlled keys and a transparent architecture.'],
          ['Solana market data', 'Live network and price experiences are integrated into the same platform.'],
          ['Open-source approach', 'The public codebase allows the product direction to be reviewed and developed openly.']
        ].map(([title, body]) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-[#0b0b13] p-6">
            <h2 className="text-lg font-extrabold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">{body}</p>
          </article>
        ))}
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-[#9945FF]/20 bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/5 p-8 sm:p-10">
        <h2 className="text-2xl font-black text-white">Building the wallet in public</h2>
        <p className="mt-3 max-w-3xl leading-8 text-slate-300">The English site will become the international surface of Solmint while the existing Persian URLs remain stable. This page is the first production slice of that migration.</p>
      </div>
    </section>
  </>
);

const EnglishSolanaPrice: React.FC = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/solana/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled && data) { setPrice(Number(data.price)); setChange(Number(data.change24h)); } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#14F195]">Solana market</p>
        <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Solana (SOL) price and live market data</h1>
        <p className="mt-5 text-lg leading-8 text-slate-300">Track the current SOL price and 24-hour market movement on Solmint. This English route is connected to the same production market endpoint used by the existing platform.</p>
      </div>
      <div className="mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0b0b13] p-6">
          <div className="text-sm text-slate-400">SOL price</div>
          <div className="mt-2 text-4xl font-black text-white">{price == null ? '—' : `$${price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0b0b13] p-6">
          <div className="text-sm text-slate-400">24h change</div>
          <div className="mt-2 text-4xl font-black text-white">{change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}</div>
        </div>
      </div>
    </section>
  );
};

const EnglishNotFound: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
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
