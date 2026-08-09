import { useEffect, type ReactNode } from 'react';

const SITE_URL = 'https://solmint.ir';
const PAGE_URL = `${SITE_URL}/solana-price`;

const FAQ = [
  {
    question: 'قیمت لحظه‌ای سولانا از کجا می‌آید؟',
    answer: 'کارت قیمت و نمودار این صفحه به زیرساخت داده بازار سولمینت متصل‌اند و برای SOL/USD از داده بازار Kraken استفاده می‌کنند.'
  },
  {
    question: 'آیا نمودار قیمت سولانا واقعی است؟',
    answer: 'بله. کندل‌ها و حجم از داده OHLC بازار ساخته می‌شوند و نمودار از داده از پیش‌ساخته یا مقادیر نمایشی استفاده نمی‌کند.'
  },
  {
    question: 'آیا قیمت سولانا ثابت می‌ماند؟',
    answer: 'خیر. قیمت بازار تغییر می‌کند و ابزار زنده با دریافت داده جدید، اطلاعات خود را به‌روزرسانی می‌کند.'
  },
  {
    question: 'آیا این صفحه توصیه خرید یا فروش است؟',
    answer: 'خیر. این صفحه برای نمایش و بررسی داده‌های بازار طراحی شده و توصیه سرمایه‌گذاری ارائه نمی‌کند.'
  }
];

function upsertMeta(name: string, content: string) {
  let node = document.head.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('name', name);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function upsertProperty(property: string, content: string) {
  let node = document.head.querySelector(`meta[property="${property}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('property', property);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
}

export const SolanaPriceSeoEnhancer: React.FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    if (window.location.pathname.replace(/\/+$/, '') !== '/solana-price') return;

    const title = 'قیمت سولانا امروز | قیمت لحظه‌ای SOL و نمودار زنده | سولمینت';
    const description = 'قیمت لحظه‌ای سولانا (SOL) به دلار، نمودار کندلی زنده، حجم معاملات، EMA و تایم‌فریم‌های مختلف را با داده به‌روز بازار در سولمینت بررسی کنید.';

    document.title = title;
    upsertMeta('description', description);
    upsertMeta('robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    upsertMeta('author', 'سولمینت');
    upsertProperty('og:title', title);
    upsertProperty('og:description', description);
    upsertProperty('og:url', PAGE_URL);
    upsertProperty('og:type', 'website');
    upsertProperty('og:site_name', 'سولمینت');
    upsertProperty('og:locale', 'fa_IR');
    upsertProperty('og:image', `${SITE_URL}/images/solmint-banner.jpg`);
    upsertProperty('og:image:alt', 'قیمت لحظه‌ای سولانا و نمودار زنده SOL/USD');
    upsertMeta('twitter:card', 'summary_large_image');
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);
    upsertMeta('twitter:image', `${SITE_URL}/images/solmint-banner.jpg`);
    upsertCanonical(PAGE_URL);

    const existing = document.getElementById('solmint-solana-price-jsonld');
    existing?.remove();

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${PAGE_URL}#webpage`,
          url: PAGE_URL,
          name: title,
          description,
          inLanguage: 'fa-IR',
          isPartOf: { '@id': `${SITE_URL}#website` },
          about: {
            '@type': 'Thing',
            name: 'Solana (SOL)',
            sameAs: 'https://solana.com/'
          },
          breadcrumb: { '@id': `${PAGE_URL}#breadcrumb` },
          mainEntity: { '@id': `${PAGE_URL}#market-data` }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${PAGE_URL}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'خانه', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'قیمت لحظه‌ای سولانا', item: PAGE_URL }
          ]
        },
        {
          '@type': 'Dataset',
          '@id': `${PAGE_URL}#market-data`,
          name: 'داده زنده قیمت و بازار سولانا (SOL/USD)',
          description: 'داده‌های OHLC و حجم معاملات SOL/USD که برای نمایش نمودار زنده قیمت سولانا استفاده می‌شوند.',
          url: PAGE_URL,
          inLanguage: 'fa-IR',
          temporalCoverage: 'ongoing',
          isAccessibleForFree: true,
          creator: { '@type': 'Organization', name: 'سولمینت', url: SITE_URL },
          distribution: {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: 'https://api.kraken.com/0/public/OHLC?pair=SOLUSD'
          }
        },
        {
          '@type': 'FAQPage',
          '@id': `${PAGE_URL}#faq`,
          mainEntity: FAQ.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer }
          }))
        }
      ]
    };

    const script = document.createElement('script');
    script.id = 'solmint-solana-price-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      document.getElementById('solmint-solana-price-jsonld')?.remove();
    };
  }, []);

  return <>{children}</>;
};