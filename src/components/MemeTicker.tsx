import React, { useEffect, useMemo, useState } from 'react';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const FALLBACK: MemeTickerFeed = { enabled: false, items: [] };

function formatUsd(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 10 })}`;
}

const MarketItem: React.FC<{ item: MemeTickerItem }> = ({ item }) => {
  const change = item.change24h;
  const up = typeof change === 'number' && change >= 0;

  return (
    <div className="flex h-11 shrink-0 items-center gap-2.5 border-l border-white/[0.08] px-4 first:border-l-0" dir="ltr">
      {item.logoUrl ? (
        <img
          src={item.logoUrl}
          alt={`${item.name} logo`}
          className="h-7 w-7 shrink-0 rounded-full object-contain bg-white"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-[11px] font-black tracking-wide text-white">{item.symbol}</span>
        <span className="font-mono text-[11px] font-semibold text-slate-300">{formatUsd(item.priceUsd)}</span>
        <span className={`font-mono text-[10px] font-bold ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
          {change != null && Number.isFinite(change) ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </span>
      </div>
    </div>
  );
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setFeed(await fetchMemeTickerFeed());
    } catch {
      setFeed(current => current.items.length ? { ...current, stale: true } : FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, Math.max(10000, (feed.refreshSeconds || 20) * 1000));
    return () => window.clearInterval(id);
  }, [feed.refreshSeconds]);

  const items = useMemo(
    () => (feed.items || []).filter(item => item.enabled && item.priceUsd !== null && item.logoUrl).sort((a, b) => a.order - b.order),
    [feed.items]
  );

  if (loading || !feed.enabled || items.length === 0) return null;

  const track = [...items, ...items];
  const duration = Math.max(22, feed.speedSeconds || 32);

  return (
    <div className="relative z-30 w-full overflow-hidden border-b border-white/[0.07] bg-[#05050a]/95 backdrop-blur-xl" aria-label="قیمت لحظه‌ای بازار">
      <div className="mx-auto flex h-11 max-w-7xl items-center" dir="ltr">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="flex w-max items-center"
            style={{ animation: `solmintMarketRail ${duration}s linear infinite` }}
          >
            {track.map((item, index) => <MarketItem key={`${item.id}-${index}`} item={item} />)}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#05050a] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#05050a] to-transparent" />
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 border-l border-white/[0.08] pl-4 pr-3 text-[8px] font-black uppercase tracking-[0.16em] text-[#14F195] sm:flex" dir="ltr">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#14F195]" />
          Live
        </div>
      </div>
      <style>{`@keyframes solmintMarketRail{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
};
