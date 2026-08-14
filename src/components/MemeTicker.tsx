import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Pause, Play, RefreshCw, Radio, Waves } from 'lucide-react';
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

function sourceLabel(item: MemeTickerItem) {
  return item.source === 'jupiter' ? 'Solana DEX' : item.pair || 'Spot';
}

const CoinLogo: React.FC<{ item: MemeTickerItem; large?: boolean }> = ({ item, large = false }) => (
  item.logoUrl ? (
    <img src={item.logoUrl} alt="" className={`${large ? 'w-11 h-11' : 'w-9 h-9'} rounded-full object-cover bg-white/10 ring-1 ring-white/10`} loading="lazy" decoding="async" />
  ) : (
    <span className={`${large ? 'w-11 h-11 text-xs' : 'w-9 h-9 text-[10px]'} rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-slate-950 flex items-center justify-center font-black ring-1 ring-white/10`}>{item.symbol.slice(0, 4)}</span>
  )
);

const ChangeBadge: React.FC<{ change: number | null; large?: boolean }> = ({ change, large = false }) => {
  if (change === null || !Number.isFinite(change)) return <span className="text-[11px] text-slate-500">—</span>;
  const positive = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg ${large ? 'px-2.5 py-1.5 text-xs' : 'px-2 py-1 text-[10px]'} font-black ${positive ? 'text-[#14F195] bg-[#14F195]/10 border border-[#14F195]/10' : 'text-rose-300 bg-rose-500/10 border border-rose-500/10'}`}>
      {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {positive ? '+' : ''}{change.toFixed(2)}%
    </span>
  );
};

const FeaturedMarketCard: React.FC<{ item: MemeTickerItem }> = ({ item }) => (
  <article className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-white/[0.035] p-4 sm:p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)]">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#9945FF]/60 to-transparent" />
    <div className="flex items-start justify-between gap-3" dir="ltr">
      <div className="flex items-center gap-3 min-w-0">
        <CoinLogo item={item} large />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-wide text-white">{item.symbol}</span>
            <span className="text-[9px] uppercase tracking-[0.15em] text-slate-600">{sourceLabel(item)}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate max-w-[130px]">{item.name}</div>
        </div>
      </div>
      <ChangeBadge change={item.change24h} large />
    </div>
    <div className="mt-5 flex items-end justify-between gap-4" dir="ltr">
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Price</div>
        <div className="mt-1 text-2xl sm:text-[1.65rem] leading-none font-black font-mono tracking-tight text-white">{formatUsd(item.priceUsd)}</div>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-[#14F195]" /> Spot</span>
    </div>
  </article>
);

const MarketRow: React.FC<{ item: MemeTickerItem; rank: number }> = ({ item, rank }) => (
  <div className="grid grid-cols-[26px_minmax(130px,1.25fr)_minmax(100px,1fr)_minmax(90px,.8fr)_90px] items-center gap-3 px-3 py-3.5 sm:px-4 rounded-xl border border-white/[0.05] bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/[0.09] transition-colors" dir="ltr">
    <span className="text-[10px] font-bold text-slate-600 text-center">{String(rank).padStart(2, '0')}</span>
    <div className="flex items-center gap-3 min-w-0">
      <CoinLogo item={item} />
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="text-xs sm:text-sm font-black text-white">{item.symbol}</span><span className="hidden sm:inline text-[9px] uppercase tracking-[0.12em] text-slate-600">{sourceLabel(item)}</span></div>
        <div className="text-[10px] text-slate-500 truncate">{item.name}</div>
      </div>
    </div>
    <div className="text-right"><span className="text-xs sm:text-sm font-black font-mono text-slate-100">{formatUsd(item.priceUsd)}</span></div>
    <div className="text-right"><ChangeBadge change={item.change24h} /></div>
    <div className="text-right text-[9px] uppercase tracking-[0.12em] text-slate-600">USD</div>
  </div>
);

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
  const featured = useMemo(() => items.slice(0, 3), [items]);
  const sourceCount = useMemo(() => new Set(items.map(item => item.source || 'unknown')).size, [items]);
  const positiveCount = useMemo(() => items.filter(item => typeof item.change24h === 'number' && item.change24h >= 0).length, [items]);

  if (loading || !feed.enabled || items.length === 0) return null;

  const isPaused = paused || hovered || reducedMotion;
  const updateLabel = formatTime(feed.fetchedAt || items[items.length - 1]?.fetchedAt);
  const track = [...items, ...items];
  const duration = Math.max(16, feed.speedSeconds || 32);

  return (
    <section className="relative overflow-hidden border-y border-white/[0.07] bg-[#070910]" aria-label="بازار لحظه‌ای ارزهای دیجیتال">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_0%,rgba(153,69,255,.12),transparent_28%),radial-gradient(circle_at_88%_100%,rgba(20,241,149,.07),transparent_24%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-9" dir="rtl">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center shadow-[0_8px_30px_rgba(20,241,149,.08)]"><Activity className="w-5 h-5 text-[#14F195]" /></div>
            <div>
              <div className="flex items-center gap-2.5"><h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">بازار لحظه‌ای</h2><span className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/15 bg-[#14F195]/10 px-2.5 py-1 text-[9px] font-black tracking-[0.16em] text-[#14F195]"><span className="w-1.5 h-1.5 rounded-full bg-[#14F195] shadow-[0_0_12px_rgba(20,241,149,.9)]" /> LIVE</span></div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">نمای زنده بازار برای رصد قیمت‌ها؛ بدون معامله و بدون نگهداری دارایی.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2"><Radio className="w-3.5 h-3.5 text-[#14F195]" />{items.length} بازار فعال</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2"><Waves className="w-3.5 h-3.5 text-violet-300" />{sourceCount} منبع داده</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2"><span className="w-1.5 h-1.5 rounded-full bg-[#14F195]" />{positiveCount} صعودی</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6">{featured.map(item => <FeaturedMarketCard key={item.id} item={item} />)}</div>

        <div className="rounded-[1.5rem] border border-white/[0.08] bg-black/20 overflow-hidden shadow-[0_22px_80px_rgba(0,0,0,.2)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-2.5"><span className="text-sm font-black text-white">بازارهای منتخب</span><span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.16em]">Live Spot Markets</span></div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500"><span>آخرین بروزرسانی {updateLabel}</span>{feed.stale && <span className="text-amber-300">داده قدیمی</span>}<button type="button" onClick={() => setPaused(value => !value)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors" aria-label={paused ? 'Resume market animation' : 'Pause market animation'}>{paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}</button></div>
          </div>
          <div className="hidden md:grid grid-cols-[26px_minmax(130px,1.25fr)_minmax(100px,1fr)_minmax(90px,.8fr)_90px] gap-3 px-4 py-2 border-b border-white/[0.05] text-[9px] uppercase tracking-[0.16em] text-slate-600" dir="ltr"><span>#</span><span>Asset</span><span className="text-right">Price</span><span className="text-right">24H</span><span className="text-right">Quote</span></div>
          <div className="p-2.5 sm:p-3 space-y-1.5">{items.map((item, index) => <MarketRow key={item.id} item={item} rank={index + 1} />)}</div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between text-[9px] uppercase tracking-[0.15em] text-slate-600"><span>Market Tape</span><span>Public Data</span></div>
          <div className="relative overflow-hidden py-2.5"><div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#070910] to-transparent z-10" /><div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#070910] to-transparent z-10" /><div className="flex w-max items-center gap-2" style={{ animation: `solmintMarketTape ${duration}s linear infinite`, animationPlayState: isPaused ? 'paused' : 'running' }}>{track.map((item, index) => <span key={`${item.id}-${index}`} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-1.5" dir="ltr"><span className="text-[10px] font-black text-white">{item.symbol}</span><span className="text-[10px] font-mono text-slate-400">{formatUsd(item.priceUsd)}</span><ChangeBadge change={item.change24h} /></span>)}</div></div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[9px] text-slate-600"><span className="inline-flex items-center gap-1.5"><RefreshCw className="w-3 h-3" />به‌روزرسانی خودکار هر {feed.refreshSeconds || 20} ثانیه</span><span className="hidden sm:inline">قیمت‌ها برای اطلاع‌رسانی بازار نمایش داده می‌شوند.</span></div>
      </div>
      <style>{`@keyframes solmintMarketTape { from { transform: translateX(-50%); } to { transform: translateX(0); } }`}</style>
    </section>
  );
};
