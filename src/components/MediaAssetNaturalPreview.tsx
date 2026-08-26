import React, { useState } from 'react';

type Props = { src: string; alt: string; className?: string };

export const MediaAssetNaturalPreview: React.FC<Props> = ({ src, alt, className = '' }) => {
  const [ratio, setRatio] = useState<string | null>(null);
  return <div className={`w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/30 border border-slate-800 ${className}`} style={ratio ? { aspectRatio: ratio } : undefined}>
    <img src={src} alt={alt} onLoad={event => { const image = event.currentTarget; if (image.naturalWidth > 0 && image.naturalHeight > 0) setRatio(`${image.naturalWidth}/${image.naturalHeight}`); }} className="block max-w-full max-h-[24rem] w-auto h-auto object-contain" decoding="async" />
  </div>;
};
