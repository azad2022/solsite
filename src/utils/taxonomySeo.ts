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
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export function updateTaxonomySeo({ type, slug, name, count }: TaxonomySeoInput) {
  if (typeof document === 'undefined') return;

  const url = buildTaxonomyUrl({ type, slug, name });
  const canonical = `${SITE_DOMAIN}${url}`;
  const label = type === 'category' ? 'دسته‌بندی' : 'برچسب';
  const description = `مقالات مرتبط با ${label} «${name}» در آکادمی سولمینت؛ آموزش‌ها، تحلیل‌ها و مطالب تخصصی مرتبط با سولانا و وب۳.`;
  const indexable = count >= 2;

  document.title = `${name} | ${label} مقالات سولمینت`;
  setMeta('description', description);
  setMeta('robots', indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow');
  setProperty('og:title', document.title);
  setProperty('og:description', description);
  setProperty('og:type', 'website');
  setProperty('og:url', canonical);
  setProperty('og:image', `${SITE_DOMAIN}/images/blog-og.jpg`);

  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonical);
}
