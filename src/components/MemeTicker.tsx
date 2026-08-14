import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Pause, Play } from 'lucide-react';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const FALLBACK: MemeTickerFeed = { enabled: false, items: [] };

function formatUsd(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
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
  <img src={item.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10" loading="lazy" decoding="async" />
) : (
  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-[9px] font-black text-slate-950">{item.symbol.slice(0, 4)}</span>
);

const MarketItem: React.FC<{ item: MemeTickerItem }> = ({ item }) => {
  const change = item.change24h;
  const up = typeof change === 'number' && change >= 0;
  return (
    <div className="flex min-w-[205px] items-center gap-3 border-l border-white/[0.08] px-4 py-2.5 first:border-l-0 xl:min-w-0 xl:flex-1" dir="ltr">
      <CoinLogo item={item} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-black tracking-wide text-white">{item.symbol}</span>
          <span className="max-w-[72px] truncate text-[8px] uppercase tracking-[0.12em] text-slate-600">{item.source === 'jupiter' ? 'DEX' : item.pair || 'SPOT'}</span>
        </div>
        <div className="mt-0.5 font-mono text-[11px] font-semibold text-slate-300">{formatUsd(item.priceUsd)}</div>
      </div>
      <span className={`ml-auto whitespace-nowrap font-mono text-[11px] font-bold ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
        {change != null && Number.isFinite(change) ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>
    </div>
  );
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setFeed(await fetchMemeTickerFeed()); }
    catch { setFeed(current => current.items.length ? { ...current, stale: true } : FALLBACK); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (paused) return undefined;
    const id = window.setInterval(load, Math.max(10000, (feed.refreshSeconds || 20) * 1000));
    return () => window.clearInterval(id);
  }, [paused, feed.refreshSeconds]);

  const items = useMemo(() => (feed.items || []).filter(item => item.enabled && item.priceUsd !== null).sort((a, b) => a.order - b.order), [feed.items]);
  if (loading || !feed.enabled || items.length === 0) return null;

  return (
    <section className="border-y border-white/[0.07] bg-[#070a12]/95" aria-label="بازار لحظه‌ای ارزهای دیجیتال">
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6" dir="rtl">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025]"><Activity className="h-4 w-4 text-[#14F195]" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white sm:text-base">بازار لحظه‌ای</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14F195]/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-[#14F195]"><span className="h-1.5 w-1.5 rounded-full bg-[#14F195]" />Live</span>
              </div>
              <div className="mt-0.5 text-[9px] text-slate-600">{items.length} بازار منتخب · بدون معامله در وب‌سایت</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-slate-500">
            <span className="hidden sm:inline">آخرین بروزرسانی {formatTime(feed.fetchedAt)}</span>
            {feed.stale && <span className="text-amber-300">داده قدیمی</span>}
            <button type="button" onClick={() => setPaused(value => !value)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white" aria-label={paused ? 'Resume live updates' : 'Pause live updates'} title={paused ? 'ادامه بروزرسانی قیمت‌ها' : 'توقف موقت بروزرسانی قیمت‌ها'}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="mt-1 overflow-x-auto overscroll-x-contain scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" dir="ltr">
          <div className="flex min-w-max xl:grid xl:grid-cols-5 xl:min-w-0">
            {items.map(item => <MarketItem key={item.id} item={item} />)}
          </div>
        </div>
      </div>
    </section>
  );
};