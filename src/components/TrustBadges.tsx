import React from 'react';
import { Github } from 'lucide-react';

type TrustBadge = {
  id: string;
  href: string;
  label: string;
  content: React.ReactNode;
};

const BADGE_TILE_CLASS =
  'flex h-[72px] w-[170px] shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035] px-5 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.055] sm:h-[78px] sm:w-[190px]';

const BADGES: TrustBadge[] = [
  {
    id: 'product-hunt',
    href: 'https://www.producthunt.com/products/solmint-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-solmint-2',
    label: 'Solmint on Product Hunt',
    content: (
      <img
        alt="solmint - solana web3 wallet | Product Hunt"
        width="250"
        height="54"
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1218856&theme=light&t=1786302074692"
        className="block h-auto max-h-[44px] w-full object-contain"
      />
    ),
  },
  {
    id: 'github',
    href: 'https://github.com/azad2022/solsite',
    label: 'Solmint on GitHub',
    content: <Github className="h-10 w-10 text-slate-200" aria-hidden="true" />,
  },
  {
    id: 'checkweb',
    href: 'https://chkweb.com/report/solmint.ir',
    label: 'Solmint website security report by CheckWeb',
    content: (
      <img
        alt="Website security checked by CheckWeb"
        width="200"
        height="95"
        src="https://chkweb.com/badge/solmint.ir.svg"
        loading="lazy"
        decoding="async"
        className="block h-auto max-h-[54px] w-full object-contain"
      />
    ),
  },
  {
    id: 'green-web',
    href: 'https://www.thegreenwebfoundation.org/',
    label: 'Solmint green hosting verification by The Green Web Foundation',
    content: (
      <img
        alt="This website runs on green hosting - verified by thegreenwebfoundation.org"
        width="200"
        height="95"
        src="https://app.greenweb.org/api/v3/greencheckimage/solmint.ir?nocache=true"
        loading="lazy"
        decoding="async"
        className="block h-auto max-h-[54px] w-full object-contain"
      />
    ),
  },
];

const BadgeSet: React.FC<{ duplicate?: boolean }> = ({ duplicate = false }) => (
  <div
    className="flex shrink-0 items-center gap-3 pr-3 sm:gap-4 sm:pr-4"
    aria-hidden={duplicate ? true : undefined}
  >
    {BADGES.map(badge => (
      <a
        key={`${duplicate ? 'duplicate-' : ''}${badge.id}`}
        href={badge.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={badge.label}
        className={BADGE_TILE_CLASS}
      >
        {badge.content}
      </a>
    ))}
  </div>
);

export const TrustBadges: React.FC = () => (
  <section className="w-full" aria-labelledby="footer-trust-title" dir="ltr">
    <div className="rounded-[28px] border border-white/[0.08] bg-[#090910] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-4 px-1" dir="rtl">
        <div>
          <h2 id="footer-trust-title" className="text-sm font-black tracking-tight text-white sm:text-base">
            نشان‌های اعتماد و حضور رسمی
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs">
            منابع و سرویس‌های مستقلی که حضور و اعتبار Solmint را تأیید می‌کنند
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-slate-500">
          Trusted by design
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-black/20 py-2.5 sm:py-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#07070d] via-[#07070d]/80 to-transparent sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#07070d] via-[#07070d]/80 to-transparent sm:w-24" />

        <div className="solmint-trust-marquee-track flex w-max items-center hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:!transform-none motion-reduce:!animate-none">
          <BadgeSet />
          <BadgeSet duplicate />
        </div>
      </div>
    </div>

    <style>{`
      @keyframes solmintTrustMarquee {
        from { transform: translate3d(0, 0, 0); }
        to { transform: translate3d(-50%, 0, 0); }
      }

      .solmint-trust-marquee-track {
        animation: solmintTrustMarquee 48s linear infinite;
        will-change: transform;
      }

      @media (max-width: 640px) {
        .solmint-trust-marquee-track {
          animation-duration: 40s;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .solmint-trust-marquee-track {
          animation: none;
          transform: none;
        }
      }
    `}</style>
  </section>
);
