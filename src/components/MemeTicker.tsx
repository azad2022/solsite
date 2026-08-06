import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const FALLBACK: MemeTickerFeed = { enabled: false, items: [] };

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
  if (value >= 0.01) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 10 })}`;
}

const CoinLogo: React.FC<{ item: MemeTickerItem }> = ({ item }) => (
  item.logoUrl ? (
    <img src={item.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover bg-white/10" loading="lazy" decoding="async" />
  ) : (
    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-slate-950 flex items-center justify-center text-[10px] font-black">{item.symbol.slice(0, 3)}</span>
  )
);

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const load = async () => {
    try {
      const next = await fetchMemeTickerFeed();
      if (next?.enabled && next.items?.length) setFeed(next);
      else setFeed(next || FALLBACK);
    } catch {
      setFeed(current => current.items.length ? { ...current, stale: true } : FALLBACK);
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

  const items = useMemo(() => (feed.items || []).filter(i => i.enabled).sort((a, b) => a.order - b.order), [feed.items]);
  if (!feed.enabled || items.length === 0) return null;

  // Duplicate the track to make the loop seamless. The animation moves visually left-to-right.
  const track = [...items, ...items];
  const isPaused = paused || hovered || reducedMotion;
  const duration = Math.max(8, feed.speedSeconds || 28);

  return (
    <section className="relative overflow-hidden border-y border-white/8 bg-slate-950/70 backdrop-blur-xl" aria-label="Live Solana token prices">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3" dir="ltr">
        <div className="shrink-0 hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400 font-black border-r border-white/10 pr-4">
          <span className="w-2 h-2 rounded-full bg-[#14F195] shadow-[0_0_12px_rgba(20,241,149,.8)]" aria-hidden="true" />
          Live Market
        </div>
        <div className="relative flex-1 overflow-hidden min-w-0">
          <div
            className="flex w-max items-center gap-3 hover:[animation-play-state:paused]"
            style={{
              animation: `solmintTickerLTR ${duration}s linear infinite`,
              animationPlayState: isPaused ? 'paused' : 'running'
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {track.map((item, index) => {
              const change = item.change24h;
              const positive = typeof change === 'number' && change >= 0;
              return (
                <button
                  type="button"
                  key={`${item.id}-${index}`}
                  onClick={() => setPaused(value => !value)}
                  className="shrink-0 min-w-[210px] px-3.5 py-2.5 rounded-2xl border border-white/8 bg-white/[0.035] hover:bg-white/[0.07] transition-colors text-left"
                  aria-label={`${item.symbol} ${formatUsd(item.priceUsd)}. ${change === null ? 'Change unavailable' : `${change.toFixed(2)} percent in 24 hours`}. Click to ${paused ? 'resume' : 'pause'} ticker.`}
                >
                  <span className="flex items-center gap-2.5">
                    <CoinLogo item={item} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{item.symbol}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[90px]">{item.name}</span>
                      </span>
                      <span className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-black text-slate-100 font-mono">{formatUsd(item.priceUsd)}</span>
                        {change !== null && Number.isFinite(change) && (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-black ${positive ? 'text-[#14F195]' : 'text-rose-400'}`}>
                            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {positive ? '+' : ''}{change.toFixed(2)}%
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" onClick={() => setPaused(value => !value)} className="shrink-0 w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white flex items-center justify-center" aria-label={paused ? 'Resume market ticker' : 'Pause market ticker'}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>
      <style>{`@keyframes solmintTickerLTR { from { transform: translateX(-50%); } to { transform: translateX(0); } }`}</style>
    </section>
  );
};
