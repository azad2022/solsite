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
  if (feed.enabled === false) return { ...feed, enabled: false, items: [] };

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
      <img src={localLogo} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full object-contain bg-white/95" width={20} height={20} loading="eager" decoding="async" />
      <span className="text-[10px] font-black tracking-wide text-white sm:text-[11px]">{symbol}</span>
      <span className="font-mono text-[9px] font-semibold text-slate-300 sm:text-[10px]">{formatUsd(item.priceUsd)}</span>
      <span className={`font-mono text-[9px] font-bold sm:text-[10px] ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
        {change != null && Number.isFinite(change) ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>
    </>
  );

  if (symbol === 'SOL') return <a href="/solana-price" aria-label="قیمت لحظه‌ای سولانا SOL" className="flex h-9 shrink-0 items-center gap-2 border-l border-white/[0.07] px-3 first:border-l-0 no-underline sm:gap-2.5 sm:px-4" dir="ltr">{content}</a>;
  return <div className="flex h-9 shrink-0 items-center gap-2 border-l border-white/[0.07] px-3 first:border-l-0 sm:gap-2.5 sm:px-4" dir="ltr">{content}</div>;
};

const TickerRow: React.FC<{ items: MemeTickerItem[]; duration: number }> = ({ items, duration }) => {
  const visible = items.filter(item => Boolean(LOCAL_LOGOS[item.symbol.toUpperCase()]));
  if (!visible.length) return null;
  const track = [...visible, ...visible];
  return (
    <div className="relative h-9 min-w-0 overflow-hidden" role="presentation">
      <div className="flex h-full w-max items-center will-change-transform" style={{ animation: `solmintMarketRail ${duration}s linear infinite` }}>
        {track.map((item, index) => <MarketItem key={`${item.id}-${index}`} item={item} />)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#05050a] to-transparent sm:w-14" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#05050a] to-transparent sm:w-14" aria-hidden="true" />
    </div>
  );
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(() => {
    if (typeof window === 'undefined') return FALLBACK;
    return normalizeFeed(readCachedFeed() || FALLBACK);
  });
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;

    const existingSlot = header.querySelector<HTMLElement>('[data-solmint-market-ticker-slot="true"]');
    if (existingSlot) {
      setHeaderSlot(existingSlot);
      return;
    }

    const slot = document.createElement('div');
    slot.setAttribute('data-solmint-market-ticker-slot', 'true');
    slot.className = 'relative w-full h-9 overflow-hidden border-t border-white/[0.06] bg-transparent';
    header.appendChild(slot);
    setHeaderSlot(slot);

    return () => {
      setHeaderSlot(null);
      if (slot.parentElement === header) slot.remove();
    };
  }, []);

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
  if (!headerSlot || !feed.enabled || !items.length) return null;

  const baseDuration = Math.max(90, feed.speedSeconds || 120);

  return createPortal(
    <section className="relative block h-9 w-full overflow-hidden" aria-label="قیمت لحظه‌ای ارزهای دیجیتال">
      <h2 className="sr-only">قیمت لحظه‌ای ارزهای دیجیتال</h2>
      <div className="mx-auto max-w-7xl" dir="ltr">
        <TickerRow items={items} duration={baseDuration} />
      </div>
      <style>{`
        @keyframes solmintMarketRail {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-solmint-market-ticker-slot="true"] [style*="solmintMarketRail"] {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>,
    headerSlot
  );
};