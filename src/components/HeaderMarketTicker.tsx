import React, { useEffect, useMemo, useState } from 'react';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const CACHE_KEY = 'solmint_market_ticker_feed_v1';
const FALLBACK_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'LTC'];
const LOCAL_LOGOS: Record<string, string> = {
  SOL: '/assets/crypto/sol.svg', BTC: '/assets/crypto/btc.svg', ETH: '/assets/crypto/eth.svg',
  XRP: '/assets/crypto/xrp.svg', DOGE: '/assets/crypto/doge.svg', ADA: '/assets/crypto/ada.svg',
  LINK: '/assets/crypto/link.svg', DOT: '/assets/crypto/polkadot.svg', LTC: '/assets/crypto/litecoin.svg',
  BNB: '/assets/crypto/bnb.svg', AVAX: '/assets/crypto/avax.svg',
};
const FALLBACK: MemeTickerFeed = {
  enabled: true, provider: 'local-first', refreshSeconds: 30, speedSeconds: 120,
  items: FALLBACK_SYMBOLS.map((symbol, index) => ({ id: `fallback-${symbol}`, source: 'binance', pair: `${symbol}USDT`, mint: '', symbol, name: symbol, logoUrl: '', enabled: true, order: index, priceUsd: null, change24h: null })),
};

function readCache(): MemeTickerFeed | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemeTickerFeed;
    return parsed && Array.isArray(parsed.items) ? parsed : null;
  } catch { return null; }
}

function writeCache(feed: MemeTickerFeed) {
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...feed, fetchedAt: feed.fetchedAt || new Date().toISOString() })); } catch {}
}

function normalizeFeed(feed: MemeTickerFeed): MemeTickerFeed {
  if (feed.enabled === false) return { ...feed, enabled: false, items: [] };
  const live = (feed.items || [])
    .map(item => ({ ...item, symbol: item.symbol.toUpperCase(), logoUrl: LOCAL_LOGOS[item.symbol.toUpperCase()] || '' }))
    .filter(item => item.enabled && LOCAL_LOGOS[item.symbol]);
  const bySymbol = new Map(live.map(item => [item.symbol, item]));
  const items = FALLBACK_SYMBOLS.map((symbol, index) => bySymbol.get(symbol) || FALLBACK.items[index]).map((item, index) => ({ ...item, order: index }));
  return { ...feed, enabled: true, items };
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
  const logo = LOCAL_LOGOS[symbol];
  if (!logo) return null;
  const change = item.change24h;
  const up = typeof change === 'number' && change >= 0;
  const content = (
    <>
      <img src={logo} alt="" aria-hidden="true" width={22} height={22} loading="lazy" decoding="async" className="h-[22px] w-[22px] shrink-0 rounded-full bg-white object-contain" />
      <span className="text-[12px] font-black tracking-wide text-white">{symbol}</span>
      <span className="font-mono text-[11px] font-semibold text-slate-300">{formatUsd(item.priceUsd)}</span>
      <span className={`font-mono text-[11px] font-bold ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
        {change != null && Number.isFinite(change) ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>
    </>
  );
  if (symbol === 'SOL') return <a href="/solana-price" aria-label="قیمت لحظه‌ای سولانا SOL" className="flex h-10 shrink-0 items-center gap-2 border-l border-white/[0.06] px-3 no-underline" dir="ltr">{content}</a>;
  return <div className="flex h-10 shrink-0 items-center gap-2 border-l border-white/[0.06] px-3" dir="ltr">{content}</div>;
};

export const HeaderMarketTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(() => typeof window === 'undefined' ? FALLBACK : normalizeFeed(readCache() || FALLBACK));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const fresh = normalizeFeed(await fetchMemeTickerFeed());
        if (cancelled) return;
        setFeed(fresh);
        writeCache(fresh);
      } catch {}
    };

    // Market data is enhancement-only. Render the cached/local feed first and
    // wait for idle time before loading the Supabase-dependent code path.
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(() => { void load(); }, { timeout: 2500 });
      } else {
        timeoutId = window.setTimeout(() => { void load(); }, 1500);
      }
    };
    schedule();

    const timer = window.setInterval(load, Math.max(30000, (feed.refreshSeconds || 30) * 1000));
    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      window.clearInterval(timer);
    };
  }, [feed.refreshSeconds]);

  const items = useMemo(() => feed.items.slice().sort((a, b) => a.order - b.order), [feed.items]);
  if (!feed.enabled || !items.length) return null;
  const visible = items.filter(item => Boolean(LOCAL_LOGOS[item.symbol.toUpperCase()]));
  if (!visible.length) return null;
  const track = [...visible, ...visible];
  const duration = Math.max(110, feed.speedSeconds || 120);

  return (
    <section className="absolute left-[68px] right-[52px] top-1 h-14 overflow-hidden lg:static lg:h-9 lg:w-full lg:border-t lg:border-white/[0.07]" aria-label="قیمت لحظه‌ای ارزهای دیجیتال">
      <h2 className="sr-only">قیمت لحظه‌ای ارزهای دیجیتال</h2>
      <div className="relative h-full overflow-hidden" dir="ltr">
        <div className="solmint-header-market-rail flex h-full w-max items-center" style={{ animation: `solmintHeaderMarketRail ${duration}s linear infinite` }}>
          {track.map((item, index) => <MarketItem key={`${item.id}-${index}`} item={item} />)}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-9 bg-gradient-to-r from-[#05050a] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-9 bg-gradient-to-l from-[#05050a] to-transparent" />
      </div>
      <style>{`
        @keyframes solmintHeaderMarketRail {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .solmint-header-market-rail { animation: none !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
};
