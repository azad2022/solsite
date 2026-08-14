import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, Pause, Play, TrendingDown, TrendingUp } from 'lucide-react';
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

const CoinLogo: React.FC<{ item: MemeTickerItem }> = ({ item }) => (
  item.logoUrl ? (
    <img src={item.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-white/10 ring-1 ring-white/10" loading="lazy" decoding="async" />
  ) : (
    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-slate-950 flex items-center justify-center text-[10px] font-black ring-1 ring-white/10">{item.symbol.slice(0, 4)}</span>
  )
);

const MarketCard: React.FC<{ item: MemeTickerItem; onToggle: () => void }> = ({ item, onToggle }) => {
  const change = item.change24h;
  const positive = typeof change === 'number' && change >= 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group shrink-0 w-[230px] sm:w-[250px] rounded-2xl border border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.065] hover:border-[#14F195]/20 transition-all duration-200 text-left px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,.16)]"
      aria-label={`${item.symbol} ${formatUsd(item.priceUsd)}. ${change === null ? 'Change unavailable' : `${change.toFixed(2)} percent in 24 hours`}. Click to pause ticker.`}
    >
      <span className="flex items-center justify-between gap-3" dir="ltr">
        <span className="flex min-w-0 items-center gap-3">
          <CoinLogo item={item} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-sm font-black text-white tracking-wide">{item.symbol}</span>
              <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">{item.name}</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-600">{item.source === 'jupiter' ? 'Solana' : item.pair || 'Spot'}</span>
          </span>
        </span>
        <span className="text-slate-600 group-hover:text-slate-300 transition-colors"><ChevronRight className="w-4 h-4" /></span>
      </span>
      <span className="mt-3 flex items-end justify-between gap-3" dir="ltr">
        <span className="text-lg font-black font-mono tracking-tight text-slate-50">{formatUsd(item.priceUsd)}</span>
        {change !== null && Number.isFinite(change) ? (
          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black ${positive ? 'text-[#14F195] bg-[#14F195]/10' : 'text-rose-300 bg-rose-500/10'}`}>
            {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {positive ? '+' : ''}{change.toFixed(2)}%
          </span>
        ) : <span className="text-[11px] text-slate-500">—</span>}
      </span>
    </button>
  );
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const next = await fetchMemeTickerFeed();
      setFeed(next || FALLBACK);
    } catch {
      setFeed(current => current.items.length ? { ...current, stale: true } : FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const refresh = window.setInterval(load, Math.max(10000, (feed.refreshSeconds || 20) * 1000));
    return () => window.clearInterval(refresh);
  }, [feed.refreshSeconds]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const items = useMemo(() => (feed.items || []).filter(i => i.enabled && i.priceUsd !== null).sort((a, b) => a.order - b.order), [feed.items]);
  if (loading || !feed.enabled || items.length === 0) return null;

  const track = [...items, ...items];
  const isPaused = paused || hovered || reducedMotion;
  const duration = Math.max(12, feed.speedSeconds || 30);
  const updateLabel = formatTime(feed.fetchedAt || items[items.length - 1]?.fetchedAt);

  return (
    <section className="relative overflow-hidden border-y border-white/[0.07] bg-[radial-gradient(circle_at_20%_0%,rgba(153,69,255,.11),transparent_28%),radial-gradient(circle_at_90%_100%,rgba(20,241,149,.07),transparent_30%)] bg-slate-950/80 backdrop-blur-xl" aria-label="بازار لحظه‌ای ارزهای دیجیتال">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 mb-4">
          <div className="flex items-center justify-between gap-4 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 border border-white/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#14F195]" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-black text-white">بازار لحظه‌ای</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#14F195]/10 text-[#14F195] text-[9px] font-black uppercase tracking-[0.14em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] shadow-[0_0_10px_rgba(20,241,149,.8)]" /> LIVE
                  </span>
                </span>
                <span className="block text-[10px] text-slate-500 mt-1">قیمت‌های لحظه‌ای بازار، بدون امکان معامله در وب‌سایت</span>
              </span>
            </div>
            <button type="button" onClick={() => setPaused(value => !value)} className="sm:hidden shrink-0 w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white flex items-center justify-center" aria-label={paused ? 'Resume market ticker' : 'Pause market ticker'}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>
          <div className="sm:mr-auto flex items-center gap-3 text-[10px] text-slate-500">
            <span>آخرین بروزرسانی {updateLabel}</span>
            {feed.stale && <span className="text-amber-300">داده قدیمی</span>}
          </div>
        </div>

        <div className="relative overflow-hidden" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-950 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-950 to-transparent z-10" />
          <div
            className="flex w-max items-stretch gap-3"
            style={{ animation: `solmintMarketTicker ${duration}s linear infinite`, animationPlayState: isPaused ? 'paused' : 'running' }}
          >
            {track.map((item, index) => <MarketCard key={`${item.id}-${index}`} item={item} onToggle={() => setPaused(value => !value)} />)}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-slate-500">
          <span>برای توقف روی بازار مکث کنید.</span>
          <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#14F195]" /> فقط داده عمومی بازار</span>
        </div>
      </div>
      <style>{`@keyframes solmintMarketTicker { from { transform: translateX(-50%); } to { transform: translateX(0); } }`}</style>
    </section>
  );
};
