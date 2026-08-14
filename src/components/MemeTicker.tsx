import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
    <div className="flex h-9 shrink-0 items-center gap-2.5 border-l border-white/[0.07] px-3.5 first:border-l-0" dir="ltr">
      <img
        src={item.logoUrl!}
        alt={`${item.name} logo`}
        className="h-6 w-6 shrink-0 rounded-full object-contain bg-white"
        loading="eager"
        decoding="async"
      />
      <span className="text-[11px] font-black tracking-wide text-white">{item.symbol}</span>
      <span className="font-mono text-[10px] font-semibold text-slate-300">{formatUsd(item.priceUsd)}</span>
      <span className={`font-mono text-[10px] font-bold ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
        {change != null && Number.isFinite(change) ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>
    </div>
  );
};

const TickerRow: React.FC<{ items: MemeTickerItem[]; reverse?: boolean; duration: number }> = ({ items, reverse = false, duration }) => {
  if (!items.length) return null;
  const track = [...items, ...items];
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <div
        className="flex w-max items-center"
        style={{
          animation: `solmintMarketRail ${duration}s linear infinite`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {track.map((item, index) => <MarketItem key={`${item.id}-${index}`} item={item} />)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#05050a] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#05050a] to-transparent" />
    </div>
  );
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<HTMLElement | null>(null);

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

  useEffect(() => {
    const findHeader = () => setHeader(document.querySelector('header'));
    findHeader();
    const observer = new MutationObserver(findHeader);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const items = useMemo(
    () => (feed.items || [])
      .filter(item => item.enabled && item.priceUsd !== null && Boolean(item.logoUrl))
      .sort((a, b) => a.order - b.order),
    [feed.items]
  );

  if (loading || !feed.enabled || !items.length || !header) return null;

  const firstRow = items.filter((_, index) => index % 2 === 0);
  const secondRow = items.filter((_, index) => index % 2 === 1);
  const duration = Math.max(22, feed.speedSeconds || 30);

  return createPortal(
    <div className="w-full overflow-hidden border-t border-white/[0.06] bg-[#05050a]/95" aria-label="قیمت لحظه‌ای بازار">
      <div className="mx-auto max-w-7xl" dir="ltr">
        <TickerRow items={firstRow} duration={duration} />
        <div className="border-t border-white/[0.05]" />
        <TickerRow items={secondRow} duration={duration + 4} reverse />
      </div>
      <div className="pointer-events-none absolute inset-x-0 h-0" aria-hidden="true" />
      <style>{`@keyframes solmintMarketRail{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>,
    header
  );
};
