import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchMemeTickerFeed, MemeTickerFeed, MemeTickerItem } from '../utils/memeTickerService';

const FALLBACK: MemeTickerFeed = { enabled: false, items: [] };
const LOCAL_LOGOS: Record<string, string> = {
  SOL: '/assets/crypto/sol.svg', BTC: '/assets/crypto/btc.svg', ETH: '/assets/crypto/eth.svg', USDT: '/assets/crypto/usdt.svg',
  XRP: '/assets/crypto/xrp.svg', DOGE: '/assets/crypto/doge.svg', ADA: '/assets/crypto/ada.svg', LINK: '/assets/crypto/link.svg',
  DOT: '/assets/crypto/polkadot.svg', LTC: '/assets/crypto/litecoin.svg'
};

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
  const remoteLogo = typeof item.logoUrl === 'string' ? item.logoUrl.trim() : '';
  const localLogo = LOCAL_LOGOS[symbol] || '';
  const [logoSrc, setLogoSrc] = useState(remoteLogo || localLogo);

  useEffect(() => {
    setLogoSrc(remoteLogo || localLogo);
  }, [remoteLogo, localLogo]);

  if (!logoSrc) return null;

  const content = (
    <>
      <img
        src={logoSrc}
        alt=""
        aria-hidden="true"
        className="h-6 w-6 shrink-0 rounded-full object-contain bg-white/95"
        loading="eager"
        decoding="async"
        onError={() => {
          if (localLogo && logoSrc !== localLogo) setLogoSrc(localLogo);
          else setLogoSrc('');
        }}
      />
      <span className="text-[11px] font-black tracking-wide text-white">{symbol}</span>
      <span className="font-mono text-[10px] font-semibold text-slate-300">{formatUsd(item.priceUsd)}</span>
      <span className={`font-mono text-[10px] font-bold ${up ? 'text-[#14F195]' : 'text-rose-400'}`}>
        {change != null && Number.isFinite(change) ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>
    </>
  );

  if (symbol === 'SOL') {
    return <a href="/solana-price" aria-label="قیمت لحظه‌ای سولانا SOL" className="flex h-10 shrink-0 items-center gap-2.5 border-l border-white/[0.07] px-4 first:border-l-0 no-underline" dir="ltr">{content}</a>;
  }

  return <div className="flex h-10 shrink-0 items-center gap-2.5 border-l border-white/[0.07] px-4 first:border-l-0" dir="ltr">{content}</div>;
};

const TickerRow: React.FC<{ items: MemeTickerItem[]; reverse?: boolean; duration: number }> = ({ items, reverse = false, duration }) => {
  const visible = items.filter(item => {
    const symbol = item.symbol.toUpperCase();
    return Boolean((typeof item.logoUrl === 'string' && item.logoUrl.trim()) || LOCAL_LOGOS[symbol]);
  });
  if (!visible.length) return null;
  const track = [...visible, ...visible];
  return <div className="relative h-10 min-w-0 overflow-hidden" role="presentation"><div className="flex h-full w-max items-center will-change-transform" style={{ animation: `solmintMarketRail ${duration}s linear infinite`, animationDirection: reverse ? 'reverse' : 'normal' }}>{track.map((item, index) => <MarketItem key={`${item.id}-${index}`} item={item} />)}</div><div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#05050a] to-transparent" aria-hidden="true"/><div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#05050a] to-transparent" aria-hidden="true"/></div>;
};

export const MemeTicker: React.FC = () => {
  const [feed, setFeed] = useState<MemeTickerFeed>(FALLBACK); const [loading, setLoading] = useState(true); const [header, setHeader] = useState<HTMLElement | null>(null);
  const load = async () => { try { setFeed(await fetchMemeTickerFeed()); } catch { setFeed(current => current.items.length ? { ...current, stale: true } : FALLBACK); } finally { setLoading(false); } };
  useEffect(() => { load(); const id = window.setInterval(load, Math.max(15000, (feed.refreshSeconds || 20) * 1000)); return () => window.clearInterval(id); }, [feed.refreshSeconds]);
  useEffect(() => { setHeader(document.querySelector('header')); }, []);
  const items = useMemo(() => (feed.items || []).filter(item => item.enabled && item.priceUsd !== null && ((typeof item.logoUrl === 'string' && item.logoUrl.trim()) || LOCAL_LOGOS[item.symbol.toUpperCase()])).sort((a, b) => a.order - b.order), [feed.items]);
  if (loading || !feed.enabled || !items.length || !header) return null;
  const midpoint = Math.ceil(items.length / 2); const firstRow = items.slice(0, midpoint); const secondRow = items.slice(midpoint); const baseDuration = Math.max(110, feed.speedSeconds || 120);
  return createPortal(<section className="relative block w-full overflow-hidden border-t border-white/[0.06] bg-[#05050a]/95" aria-label="قیمت لحظه‌ای ارزهای دیجیتال"><h2 className="sr-only">قیمت لحظه‌ای ارزهای دیجیتال</h2><div className="mx-auto max-w-7xl" dir="ltr"><TickerRow items={firstRow} duration={baseDuration}/><div className="h-px bg-white/[0.045]" aria-hidden="true"/><TickerRow items={secondRow} duration={baseDuration + 15} reverse/></div><style>{`@keyframes solmintMarketRail{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style></section>, header);
};
