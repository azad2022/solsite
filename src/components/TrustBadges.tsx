import React, { useState } from 'react';
import { Github } from 'lucide-react';

type TrustBadge = {
  id: string;
  href: string;
  label: string;
  content: React.ReactNode;
};

const BADGE_TILE_CLASS =
  'flex h-[68px] w-[164px] shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 sm:h-[72px] sm:w-[178px]';

const BadgeImage: React.FC<{ src: string; alt: string; fallback: string; width: number; height: number }> = ({ src, alt, fallback, width, height }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="px-2 text-center text-[10px] font-black leading-4 text-slate-300">{fallback}</span>;
  return <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" onError={() => setFailed(true)} className="block h-auto max-h-[48px] w-full object-contain" />;
};

const BADGES: TrustBadge[] = [
  {
    id: 'product-hunt',
    href: 'https://www.producthunt.com/products/solmint-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-solmint-2',
    label: 'Solmint on Product Hunt',
    content: <BadgeImage src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1218856&theme=light&t=1786302074692" alt="solmint - solana web3 wallet | Product Hunt" fallback="Product Hunt · Solmint" width={250} height={54} />,
  },
  {
    id: 'github',
    href: 'https://github.com/azad2022/solsite',
    label: 'Solmint on GitHub',
    content: <Github className="h-9 w-9 text-slate-200" aria-hidden="true" />,
  },
  {
    id: 'checkweb',
    href: 'https://chkweb.com/report/solmint.ir',
    label: 'Solmint website security report by CheckWeb',
    content: <BadgeImage src="https://chkweb.com/badge/solmint.ir.svg" alt="Website security checked by CheckWeb" fallback="CheckWeb · Security" width={200} height={95} />,
  },
  {
    id: 'green-web',
    href: 'https://www.thegreenwebfoundation.org/green-web-check/?url=solmint.ir',
    label: 'Solmint green hosting verification by The Green Web Foundation',
    content: <BadgeImage src="https://app.greenweb.org/api/v3/greencheckimage/solmint.ir" alt="This website runs on green hosting - verified by thegreenwebfoundation.org" fallback="Green Web Foundation" width={200} height={95} />,
  },
];

const BadgeSet: React.FC<{ duplicate?: boolean }> = ({ duplicate = false }) => (
  <div className="flex shrink-0 items-center gap-3 pr-3 sm:gap-4 sm:pr-4" aria-hidden={duplicate ? true : undefined}>
    {BADGES.map(badge => {
      const tile = <div className={BADGE_TILE_CLASS}>{badge.content}</div>;
      return duplicate ? (
        <div key={`duplicate-${badge.id}`}>{tile}</div>
      ) : (
        <a key={badge.id} href={badge.href} target="_blank" rel="noopener noreferrer" aria-label={badge.label} className={BADGE_TILE_CLASS}>
          {badge.content}
        </a>
      );
    })}
  </div>
);

export const TrustBadges: React.FC = () => (
  <section className="w-full" aria-label="نشان‌های اعتماد Solmint" dir="ltr">
    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#090910] py-2.5 sm:py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#090910] via-[#090910]/80 to-transparent sm:w-16" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#090910] via-[#090910]/80 to-transparent sm:w-16" aria-hidden="true" />
      <div className="solmint-trust-marquee-track flex w-max items-center hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:!transform-none motion-reduce:!animate-none">
        <BadgeSet />
        <BadgeSet duplicate />
      </div>
    </div>

    <style>{`
      @keyframes solmintTrustMarquee {
        from { transform: translate3d(0, 0, 0); }
        to { transform: translate3d(-50%, 0, 0); }
      }
      .solmint-trust-marquee-track { animation: solmintTrustMarquee 64s linear infinite; }
      @media (max-width: 640px) { .solmint-trust-marquee-track { animation-duration: 54s; } }
      @media (prefers-reduced-motion: reduce) { .solmint-trust-marquee-track { animation: none; transform: none; } }
    `}</style>
  </section>
);
