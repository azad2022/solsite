import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Pause, Play } from 'lucide-react';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const FALLBACK: MemeTickerFeed = { enabled: false, items: [] };

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 10 })}`;
}

function formatTime(value?: string) {
  if (!value) return '—';
  try { return new Date(value).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return '—'; }
}

const CoinLogo: React.FC<{ item: MemeTickerItem }> = ({ item }) => item.logoUrl ? (
  <img src={item.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" loading="lazy" decoding="async" />
) : (
  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-[9px] font-black text-slate-950">{item.symbol.slice(0, 4)}</span>
);

const MarketItem: React.FC<{ item: MemeTickerItem }> = ({ item }) => {
  const change = item.change24h;
  const up = typeof change === 'number' && change >= 0;
  return (
    <div className="flex min-w-[218px] items-center gap-3 border-l border-white/[0.08] px-4 py-1.5 first:border-l-0" dir="ltr">
      <CoinLogo item={item} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-wide text-white">{item.symbol}</span>
          <span className="max-w-[70px] truncate text-[9px] uppercase tracking-[0.13em] text-slate-600">{item.source === 'jupiter' ? 'DEX' : item.pair || 'SPOT'}</span>
        </div>
        <div className="mt-0.5 text-[10px] font-mono text-slate-400">{formatUsd(item.priceUsd)}</div>
      </div>
      {change !== null && Number.isFinite(change) ? (
        <span className={`ml-auto whitespace-nowrap font-mono text-[11px] font-bold ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
          {up ? '+' : ''}{change.toFixed(2)}%
        </span>
      ) : <span className="ml-auto text-[11px] text-slate-600">—</span>}
    </div>
  );
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setFeed(await fetchMemeTickerFeed()); }
    catch { setFeed(current => current.items.length ? { ...current, stale: true } : FALLBACK); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, Math.max(10000, (feed.refreshSeconds || 20) * 1000));
    return () => window.clearInterval(id);
  }, [feed.refreshSeconds]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const items = useMemo(() => (feed.items || []).filter(item => item.enabled && item.priceUsd !== null).sort((a, b) => a.order - b.order), [feed.items]);
  if (loading || !feed.enabled || items.length === 0) return null;

  const track = [...items, ...items];
  const isPaused = paused || hovered || reducedMotion;
  const duration = Math.max(18, feed.speedSeconds || 32);

  return (
    <section className="relative overflow-hidden border-y border-white/[0.07] bg-[#070a12]/95" aria-label="بازار لحظه‌ای ارزهای دیجیتال">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(153,69,255,.09),transparent_24%),radial-gradient(circle_at_90%_100%,rgba(20,241,149,.05),transparent_22%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-4 sm:px-6" dir="rtl">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025]"><Activity className="h-4 w-4 text-[#14F195]" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white sm:text-base">بازار لحظه‌ای</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14F195]/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-[#14F195]"><span className="h-1.5 w-1.5 rounded-full bg-[#14F195] shadow-[0_0_10px_rgba(20,241,149,.9)]" />Live</span>
              </div>
              <div className="mt-0.5 text-[9px] text-slate-600">قیمت‌های لحظه‌ای بازار، بدون معامله در وب‌سایت</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-slate-500">
            <span className="hidden sm:inline">بروزرسانی {formatTime(feed.fetchedAt)}</span>
            {feed.stale && <span className="text-amber-300">داده قدیمی</span>}
            <button type="button" onClick={() => setPaused(value => !value)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white" aria-label={paused ? 'Resume market ticker' : 'Pause market ticker'}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden pt-1" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#070a12] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#070a12] to-transparent" />
          <div className="flex w-max items-center" style={{ animation: `solmintMarketStrip ${duration}s linear infinite`, animationPlayState: isPaused ? 'paused' : 'running' }}>
            {track.map((item, index) => <MarketItem key={`${item.id}-${index}`} item={item} />)}
          </div>
        </div>
      </div>
      <style>{`@keyframes solmintMarketStrip { from { transform: translateX(-50%); } to { transform: translateX(0); } } @media (prefers-reduced-motion: reduce) { .solmint-market-strip { animation: none !important; } }`}</style>
    </section>
  );
};