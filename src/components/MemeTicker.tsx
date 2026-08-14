import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Pause, Play, RefreshCw, Radio, TrendingUp, Waves } from 'lucide-react';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const FALLBACK: MemeTickerFeed = { enabled: false, items: [] };
const formatUsd = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 10 })}`;
};
const formatTime = (value?: string) => { if (!value) return '—'; try { return new Date(value).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return '—'; } };
const sourceLabel = (item: MemeTickerItem) => item.source === 'jupiter' ? 'Solana DEX' : item.pair || 'Spot';

const CoinLogo: React.FC<{ item: MemeTickerItem; large?: boolean }> = ({ item, large = false }) => item.logoUrl ? (
  <img src={item.logoUrl} alt="" className={`${large ? 'w-10 h-10' : 'w-8 h-8'} rounded-full object-cover ring-1 ring-white/10 bg-white/5`} loading="lazy" decoding="async" />
) : (
  <span className={`${large ? 'w-10 h-10' : 'w-8 h-8'} shrink-0 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-slate-950 flex items-center justify-center text-[10px] font-black shadow-sm`}>{item.symbol.slice(0, 4)}</span>
);

const Change: React.FC<{ value: number | null; pill?: boolean }> = ({ value, pill = false }) => {
  if (value == null || !Number.isFinite(value)) return <span className="text-xs text-slate-500">—</span>;
  const up = value >= 0;
  const cls = up ? 'text-[#14F195]' : 'text-rose-400';
  if (!pill) return <span className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold ${cls}`}>{up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{up ? '+' : ''}{value.toFixed(2)}%</span>;
  return <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black ${up ? 'bg-[#14F195]/10 border border-[#14F195]/10 text-[#14F195]' : 'bg-rose-500/10 border border-rose-500/10 text-rose-300'}`}>{up ? '+' : ''}{value.toFixed(2)}%</span>;
};

const MarketRow: React.FC<{ item: MemeTickerItem; rank: number }> = ({ item, rank }) => (
  <div className="grid grid-cols-[28px_minmax(150px,1.35fr)_minmax(100px,1fr)_88px_92px] items-center gap-3 rounded-xl px-3 py-3.5 border border-transparent hover:border-white/[0.08] hover:bg-white/[0.025] transition-colors" dir="ltr">
    <span className="text-center font-mono text-[10px] text-slate-600">{String(rank).padStart(2, '0')}</span>
    <div className="flex items-center gap-3 min-w-0"><CoinLogo item={item} /><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-black text-white">{item.symbol}</span><span className="hidden sm:inline text-[9px] uppercase tracking-[0.12em] text-slate-600">{sourceLabel(item)}</span></div><div className="text-[10px] text-slate-500 truncate">{item.name}</div></div></div>
    <div className="text-right font-mono text-sm font-bold text-slate-100">{formatUsd(item.priceUsd)}</div>
    <div className="text-right"><Change value={item.change24h} pill /></div>
    <div className="text-right text-[9px] uppercase tracking-[0.14em] text-slate-600">USD</div>
  </div>
);

const PulseRow: React.FC<{ item: MemeTickerItem }> = ({ item }) => <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors" dir="ltr"><div className="flex min-w-0 items-center gap-2.5"><CoinLogo item={item} /><div className="min-w-0"><div className="text-xs font-black text-white">{item.symbol}</div><div className="text-[9px] text-slate-600 truncate">{item.name}</div></div></div><div className="text-right"><div className="font-mono text-xs font-bold text-slate-100">{formatUsd(item.priceUsd)}</div><Change value={item.change24h} /></div></div>;

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => { try { setFeed(await fetchMemeTickerFeed()); } catch { setFeed(current => current.items.length ? { ...current, stale: true } : FALLBACK); } finally { setLoading(false); } };
  useEffect(() => { load(); const id = window.setInterval(load, Math.max(10000, (feed.refreshSeconds || 20) * 1000)); return () => window.clearInterval(id); }, [feed.refreshSeconds]);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(media.matches); update(); media.addEventListener?.('change', update); return () => media.removeEventListener?.('change', update); }, []);

  const items = useMemo(() => feed.items.filter(i => i.enabled && i.priceUsd !== null).sort((a, b) => a.order - b.order), [feed.items]);
  const topGainers = useMemo(() => [...items].filter(i => typeof i.change24h === 'number').sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity)).slice(0, 4), [items]);
  const topLosers = useMemo(() => [...items].filter(i => typeof i.change24h === 'number').sort((a, b) => (a.change24h ?? Infinity) - (b.change24h ?? Infinity)).slice(0, 4), [items]);
  const featured = useMemo(() => items.slice(0, 3), [items]);
  const sourceCount = useMemo(() => new Set(items.map(item => item.source || 'unknown')).size, [items]);
  const rising = useMemo(() => items.filter(item => typeof item.change24h === 'number' && item.change24h >= 0).length, [items]);

  if (loading || !feed.enabled || !items.length) return null;
  const pausedNow = paused || hovered || reducedMotion;
  const tapeDuration = Math.max(20, feed.speedSeconds || 32);

  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-[#070a12]" aria-label="بازار لحظه‌ای ارزهای دیجیتال">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(153,69,255,.10),transparent_25%),radial-gradient(circle_at_85%_100%,rgba(20,241,149,.06),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10" dir="rtl">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0f19]/95 shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl">
          <header className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035]"><Activity className="h-5 w-5 text-[#14F195]" /></div>
                <div>
                  <div className="flex items-center gap-2.5"><h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">بازار لحظه‌ای</h2><span className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/15 bg-[#14F195]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#14F195]"><span className="h-1.5 w-1.5 rounded-full bg-[#14F195] shadow-[0_0_10px_rgba(20,241,149,.9)]"/>LIVE</span></div>
                  <p className="mt-1 text-xs text-slate-500">قیمت و حرکت بازارهای منتخب، بدون معامله در وب‌سایت.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <span className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-slate-400"><b className="text-white">{items.length}</b> بازار</span>
                <span className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-slate-400"><b className="text-white">{sourceCount}</b> منبع</span>
                <span className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-slate-400"><b className="text-[#14F195]">{rising}</b> صعودی</span>
                <span className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-slate-500">{feed.stale ? 'داده قدیمی' : `به‌روزرسانی ${formatTime(feed.fetchedAt)}`}</span>
              </div>
            </div>
          </header>

          <div className="grid border-b border-white/[0.07] md:grid-cols-3" dir="ltr">
            {featured.map((item, index) => <div key={item.id} className={`px-5 py-4 ${index ? 'border-t border-white/[0.06] md:border-l md:border-t-0' : ''}`}><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-2.5"><CoinLogo item={item} large /><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-black text-white">{item.symbol}</span><span className="text-[9px] uppercase tracking-[0.14em] text-slate-600">{sourceLabel(item)}</span></div><div className="mt-1 truncate text-[10px] text-slate-500">{item.name}</div></div></div><div className="text-right"><div className="font-mono text-lg font-black text-slate-100">{formatUsd(item.priceUsd)}</div><Change value={item.change24h} /></div></div></div>)}
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_290px]">
            <div className="min-w-0 p-3 sm:p-4">
              <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#090d16]">
                <div className="flex flex-col gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between" dir="rtl">
                  <div><div className="flex items-center gap-2"><span className="text-sm font-black text-white">بازارهای منتخب</span><span className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Live Spot Markets</span></div></div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500"><span>{feed.stale ? 'اتصال ناپایدار' : 'داده زنده'}</span><button type="button" onClick={() => setPaused(v => !v)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-slate-400 hover:text-white" aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play className="h-3.5 w-3.5"/> : <Pause className="h-3.5 w-3.5"/>}</button></div>
                </div>
                <div className="hidden grid-cols-[28px_minmax(150px,1.35fr)_minmax(100px,1fr)_88px_92px] gap-3 border-b border-white/[0.06] px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-slate-600 md:grid" dir="ltr"><span>#</span><span>Asset</span><span className="text-right">Price</span><span className="text-right">24H</span><span className="text-right">Quote</span></div>
                <div className="p-1.5 sm:p-2">{items.map((item, index) => <MarketRow key={item.id} item={item} rank={index + 1}/>)}</div>
              </div>
            </div>

            <aside className="border-t border-white/[0.07] lg:border-l lg:border-t-0" dir="rtl">
              <div className="border-b border-white/[0.07] px-4 py-3"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#14F195]"/><span className="text-sm font-black text-white">حرکت بازار</span></div><span className="text-[9px] text-slate-600">Top Movers · 24H</span></div>
              <div className="p-3"><div className="mb-4 rounded-xl border border-[#14F195]/10 bg-[#14F195]/[0.035] p-2"><div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#14F195]">Top Gainers</div>{topGainers.map(item => <PulseRow key={`g-${item.id}`} item={item}/>)}</div><div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.025] p-2"><div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-rose-300">Top Losers</div>{topLosers.map(item => <PulseRow key={`l-${item.id}`} item={item}/>)}</div></div>
            </aside>
          </div>

          <div className="border-t border-white/[0.07] bg-[#090d16]" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <div className="flex items-center justify-between px-4 py-2 text-[9px] uppercase tracking-[0.15em] text-slate-600"><span>Market Tape</span><span>Public Market Data</span></div>
            <div className="relative overflow-hidden border-t border-white/[0.05] py-2.5"><div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#090d16] to-transparent"/><div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#090d16] to-transparent"/><div className="flex w-max items-center gap-2" style={{animation:`solmintTape ${tapeDuration}s linear infinite`,animationPlayState:pausedNow?'paused':'running'}}>{[...items,...items].map((item,index)=><span key={`${item.id}-${index}`} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-1.5" dir="ltr"><b className="text-[10px] text-white">{item.symbol}</b><span className="font-mono text-[10px] text-slate-400">{formatUsd(item.priceUsd)}</span><Change value={item.change24h}/></span>)}</div></div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-[9px] text-slate-600"><span className="inline-flex items-center gap-1.5"><Radio className="h-3 w-3"/> داده‌ها از منابع عمومی بازار دریافت می‌شوند.</span><span className="hidden sm:inline-flex items-center gap-1.5"><RefreshCw className="h-3 w-3"/> رفرش خودکار هر {feed.refreshSeconds || 20} ثانیه</span></footer>
        </div>
      </div>
      <style>{'@keyframes solmintTape{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}</style>
    </section>
  );
};