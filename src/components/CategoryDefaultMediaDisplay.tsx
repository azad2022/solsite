import React, { useEffect, useMemo, useState } from 'react';

type Media = { id: string; public_url: string; filename?: string; width?: number; height?: number; alt_text?: string; title?: string };
type Props = { categoryId?: string | null; categoryName?: string | null; fallbackUrl?: string | null; fallbackAlt?: string; className?: string };

const pickRandomIndex = (length: number, current: number) => {
  if (length < 2) return 0;
  let next = current;
  while (next === current) next = Math.floor(Math.random() * length);
  return next;
};

export const CategoryDefaultMediaDisplay: React.FC<Props> = ({ categoryId, categoryName, fallbackUrl, fallbackAlt = '', className = '' }) => {
  const [assets, setAssets] = useState<Media[]>([]);
  const [mode, setMode] = useState<'single' | 'random' | 'slideshow'>('single');
  const [intervalMs, setIntervalMs] = useState(4500);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const lookup = categoryId ? `categoryId=${encodeURIComponent(categoryId)}` : categoryName ? `categoryName=${encodeURIComponent(categoryName)}` : '';
    if (!lookup) return;
    const controller = new AbortController();
    fetch(`/api/article-category-media?${lookup}`, { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (!payload?.success || !Array.isArray(payload.assets) || !payload.assets.length) return;
        setAssets(payload.assets);
        setMode(payload.category?.mode === 'random' || payload.category?.mode === 'slideshow' ? payload.category.mode : 'single');
        setIntervalMs(Number(payload.category?.intervalMs) >= 1500 ? Number(payload.category.intervalMs) : 4500);
        setIndex(0);
        setLoaded(true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [categoryId, categoryName]);

  useEffect(() => {
    if (!loaded || assets.length < 2 || mode !== 'random') return;
    const timer = window.setTimeout(() => setIndex(current => pickRandomIndex(assets.length, current)), 50);
    return () => window.clearTimeout(timer);
  }, [assets, loaded, mode]);

  useEffect(() => {
    if (!loaded || assets.length < 2 || mode !== 'slideshow') return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % assets.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [assets, intervalMs, loaded, mode]);

  const active = assets[index] || assets[0];
  const aspectRatio = useMemo(() => {
    const width = Number(active?.width);
    const height = Number(active?.height);
    return width > 0 && height > 0 ? `${width}/${height}` : '16/9';
  }, [active]);
  const sources = assets.length ? assets : fallbackUrl ? [{ id: 'fallback', public_url: fallbackUrl, width: 16, height: 9, alt_text: fallbackAlt }] : [];
  const safeIndex = sources.length ? Math.min(index, sources.length - 1) : 0;
  if (!sources[safeIndex]?.public_url) return null;

  return <figure className={`relative w-full overflow-hidden rounded-2xl bg-slate-950 ${className}`} style={{ aspectRatio: assets.length ? aspectRatio : '16/9' }}>
    {sources.map((source, sourceIndex) => <img key={source.id} src={source.public_url} alt={source.alt_text || source.title || fallbackAlt} loading={sourceIndex === safeIndex ? 'eager' : 'lazy'} decoding="async" className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${sourceIndex === safeIndex ? 'opacity-100' : 'opacity-0'}`} />)}
    {sources.length > 1 && mode === 'slideshow' && <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 z-10" aria-label="موقعیت تصویر">{sources.map((source, dotIndex) => <button key={source.id} type="button" aria-label={`نمایش تصویر ${dotIndex + 1}`} aria-current={dotIndex === safeIndex} onClick={() => setIndex(dotIndex)} className={`h-1.5 rounded-full transition-all ${dotIndex === safeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />)}</div>}
  </figure>;
};
