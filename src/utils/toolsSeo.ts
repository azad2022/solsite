import { SITE_DOMAIN } from './seoManager';

type ToolSeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

const TOOL_SCHEMA_ID = 'solmint-tools-jsonld';

function upsertMeta(selector: string, attrs: Record<string, string>, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(payload: unknown) {
  let script = document.head.querySelector<HTMLScriptElement>(`script#${TOOL_SCHEMA_ID}`);
  if (!script) {
    script = document.createElement('script');
    script.id = TOOL_SCHEMA_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

export function applyToolSeo({ title, description, path, image = `${SITE_DOMAIN}/og-solmint.png` }: ToolSeoInput) {
  const canonicalUrl = `${SITE_DOMAIN}${path}`;
  const hasQuery = window.location.search.length > 0;

  document.title = title;

  upsertMeta('meta[name="title"]', { name: 'title' }, title);
  upsertMeta('meta[name="description"]', { name: 'description' }, description);
  upsertMeta(
    'meta[name="robots"]',
    { name: 'robots' },
    hasQuery
      ? 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
      : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  );

  upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'website');
  upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl);
  upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title);
  upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
  upsertMeta('meta[property="og:image"]', { property: 'og:image' }, image);
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'Solmint');
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale' }, 'fa_IR');

  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, image);

  upsertLink('canonical', canonicalUrl);

  upsertJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: 'fa-IR',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_DOMAIN}#website`,
      url: SITE_DOMAIN,
      name: 'Solmint',
    },
  });
}
