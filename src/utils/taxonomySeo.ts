import { buildTaxonomyUrl } from './articleTaxonomy';

const SITE_DOMAIN = 'https://solmint.ir';

type TaxonomySeoInput = {
  type: 'category' | 'tag';
  slug: string;
  name: string;
  count: number;
};

function setMeta(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function setProperty(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function setCanonical(canonical: string) {
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonical);
}

function setJsonLd(id: string, value: unknown) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.text = JSON.stringify(value);
  document.head.appendChild(script);
}

const CATEGORY_SEO: Record<string, { title: string; description: string }> = {
  'solana-projects': {
    title: 'پروژه های سولانا | معرفی و بررسی بهترین پروژه‌های اکوسیستم سولانا',
    description: 'معرفی و بررسی پروژه های سولانا در DeFi، DEX، کیف پول، زیرساخت، DePIN، NFT، پرداخت و سایر بخش‌های اکوسیستم؛ با تمرکز بر کاربرد، داده، وضعیت پروژه و ریسک.'
  }
};

export function updateTaxonomySeo({ type, slug, name, count }: TaxonomySeoInput) {
  if (typeof document === 'undefined') return;

  const url = buildTaxonomyUrl({ type, slug, name });
  const canonical = `${SITE_DOMAIN}${url}`;
  const label = type === 'category' ? 'دسته‌بندی' : 'برچسب';
  const indexable = count >= 2;
  const specialized = type === 'category' ? CATEGORY_SEO[slug] : undefined;
  const title = specialized?.title || `${name} | ${label} مقالات سولمینت`;
  const description = specialized?.description || `مقالات مرتبط با ${label} «${name}» در آکادمی سولمینت؛ آموزش‌ها، تحلیل‌ها و مطالب تخصصی مرتبط با سولانا و وب۳.`;

  document.title = title;
  setMeta('description', description);
  setMeta('robots', indexable ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,follow');
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:url', canonical);
  setMeta('twitter:image', `${SITE_DOMAIN}/images/blog-og.jpg`);
  setProperty('og:title', title);
  setProperty('og:description', description);
  setProperty('og:type', 'website');
  setProperty('og:url', canonical);
  setProperty('og:site_name', 'سولمینت - SolMint');
  setProperty('og:locale', 'fa_IR');
  setProperty('og:image', `${SITE_DOMAIN}/images/blog-og.jpg`);
  setProperty('og:image:alt', title);
  setCanonical(canonical);

  if (!indexable) {
    const existingSchema = document.getElementById('solmint-taxonomy-jsonld');
    if (existingSchema) existingSchema.remove();
    return;
  }

  setJsonLd('solmint-taxonomy-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonical}#collection`,
    url: canonical,
    name: title,
    description,
    inLanguage: 'fa-IR',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_DOMAIN}#website`, url: SITE_DOMAIN, name: 'سولمینت' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'خانه', item: SITE_DOMAIN },
        { '@type': 'ListItem', position: 2, name: 'وبلاگ', item: `${SITE_DOMAIN}/blog` },
        { '@type': 'ListItem', position: 3, name, item: canonical }
      ]
    },
    mainEntity: { '@type': 'ItemList', numberOfItems: count }
  });
}
