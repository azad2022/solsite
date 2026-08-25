import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const CACHE_KEY = 'solmint_market_ticker_feed_v1';
const FALLBACK_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'LTC'];
const FALLBACK: MemeTickerFeed = {
  enabled: true,
  provider: 'local-first',
  refreshSeconds: 20,
  speedSeconds: 30,
  items: FALLBACK_SYMBOLS.map((symbol, index) => ({ id: `fallback-${symbol}`, source: 'binance', pair: `${symbol}USDT`, mint: '', symbol, name: symbol, logoUrl: '', enabled: true, order: index, priceUsd: null, change24h: null }))
};

const LOCAL_LOGOS: Record<string, string> = {
  SOL: '/assets/crypto/sol.svg', BTC: '/assets/crypto/btc.svg', ETH: '/assets/crypto/eth.svg',
  XRP: '/assets/crypto/xrp.svg', DOGE: '/assets/crypto/doge.svg', ADA: '/assets/crypto/ada.svg',
  LINK: '/assets/crypto/link.svg', DOT: '/assets/crypto/polkadot.svg', LTC: '/assets/crypto/litecoin.svg',
  BNB: '/assets/crypto/bnb.svg', AVAX: '/assets/crypto/avax.svg'
};

function readCachedFeed(): MemeTickerFeed | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemeTickerFeed;
    return parsed && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedFeed(feed: MemeTickerFeed) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...feed, fetchedAt: feed.fetchedAt || new Date().toISOString() }));
  } catch {
    // Local caching is an optimization only.
  }
}

function normalizeFeed(feed: MemeTickerFeed): MemeTickerFeed {
  const liveItems = (feed.items || [])
    .map(item => ({ ...item, symbol: item.symbol.toUpperCase(), logoUrl: LOCAL_LOGOS[item.symbol.toUpperCase()] || '' }))
    .filter(item => item.enabled && LOCAL_LOGOS[item.symbol]);
  const bySymbol = new Map(liveItems.map(item => [item.symbol, item]));
  const merged = FALLBACK_SYMBOLS.map((symbol, index) => bySymbol.get(symbol) || FALLBACK.items[index]).map((item, index) => ({ ...item, order: index }));
  return { ...feed, enabled: true, items: merged };
}

function formatUsd(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 10 })}`;
}

const MarketItem: React.FC<{ item: MemeTickerItem }> = ({ item }) => {
  const symbol = item.symbol.toUpperCase();
  const change = item.change24h;
  const up = typeof change === 'number' && change >= 0;
  const localLogo = LOCAL_LOGOS[symbol];
  if (!localLogo) return null;

  const content = (
    <>
      <img src={localLogo} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full object-contain bg-white/95" width={24} height={24} loading="eager" decoding="async" />
      <span className="text-[11px] font-black tracking-wide text-white">{symbol}</span>
      <span className="font-mono text-[10px] font-semibold text-slate-300">{formatUsd(item.priceUsd)}</span>
      <span className={`font-mono text-[10px] font-bold ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
        {change != null && Number.isFinite(change) ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>
    </>
  );

  if (symbol === 'SOL') return <a href="/solana-price" aria-label="قیمت لحظه‌ای سولانا SOL" className="flex h-10 shrink-0 items-center gap-2.5 border-l border-white/[0.07] px-4 first:border-l-0 no-underline" dir="ltr">{content}</a>;
  return <div className="flex h-10 shrink-0 items-center gap-2.5 border-l border-white/[0.07] px-4 first:border-l-0" dir="ltr">{content}</div>;
};

const TickerRow: React.FC<{ items: MemeTickerItem[]; reverse?: boolean; duration: number }> = ({ items, reverse = false, duration }) => {
  const visible = items.filter(item => Boolean(LOCAL_LOGOS[item.symbol.toUpperCase()]));
  if (!visible.length) return null;
  const track = [...visible, ...visible];
  return <div className="relative h-10 min-w-0 overflow-hidden" role="presentation"><div className="flex h-full w-max items-center will-change-transform" style={{ animation: `solmintMarketRail ${duration}s linear infinite`, animationDirection: reverse ? 'reverse' : 'normal' }}>{track.map((item, index) => <MarketItem key={`${item.id}-${index}`} item={item} />)}</div><div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#05050a] to-transparent" aria-hidden="true"/><div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#05050a] to-transparent" aria-hidden="true"/></div>;
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(() => {
    if (typeof window === 'undefined') return FALLBACK;
    return normalizeFeed(readCachedFeed() || FALLBACK);
  });
  const [header, setHeader] = useState<HTMLElement | null>(null);

  useEffect(() => { setHeader(document.querySelector('header')); }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const fresh = normalizeFeed(await fetchMemeTickerFeed());
        if (cancelled) return;
        setFeed(fresh);
        writeCachedFeed(fresh);
      } catch {
        // Keep cached/fallback UI visible; market data never blocks page rendering.
      }
    };
    void load();
    const id = window.setInterval(load, Math.max(15000, (feed.refreshSeconds || 20) * 1000));
    return () => { cancelled = true; window.clearInterval(id); };
  }, [feed.refreshSeconds]);

  const items = useMemo(() => feed.items.slice().sort((a, b) => a.order - b.order), [feed.items]);
  if (!header || !items.length) return null;

  const midpoint = Math.ceil(items.length / 2);
  const firstRow = items.slice(0, midpoint);
  const secondRow = items.slice(midpoint);
  const baseDuration = Math.max(110, feed.speedSeconds || 120);

  return createPortal(
    <section className="relative block w-full overflow-hidden border-t border-white/[0.06] bg-[#05050a]/95" aria-label="قیمت لحظه‌ای ارزهای دیجیتال">
      <h2 className="sr-only">قیمت لحظه‌ای ارزهای دیجیتال</h2>
      <div className="mx-auto max-w-7xl" dir="ltr">
        <TickerRow items={firstRow} duration={baseDuration}/>
        <div className="h-px bg-white/[0.045]" aria-hidden="true"/>
        <TickerRow items={secondRow} duration={baseDuration + 15} reverse/>
      </div>
      <style>{`@keyframes solmintMarketRail{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>,
    header
  );
};
