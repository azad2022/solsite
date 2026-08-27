import { buildTaxonomyUrl } from './articleTaxonomy';
import { CATEGORY_SEO } from '../config/articleTaxonomy';
import { TAG_SEO } from '../config/tagSeo';

const SITE_DOMAIN = 'https://solmint.ir';

type TaxonomySeoInput = { type: 'category' | 'tag'; slug: string; name: string; count: number };
type TaxonomySpecializedSeo = { title: string; description: string; h1: string; intro?: string };

function setMeta(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', name); document.head.appendChild(meta); }
  meta.setAttribute('content', content);
}

function setProperty(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', property); meta.setAttribute('content', content); document.head.appendChild(meta); }
  meta.setAttribute('content', content);
}

function setCanonical(canonical: string) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
  link.setAttribute('href', canonical);
}

function setJsonLd(id: string, value: unknown) {
  document.getElementById(id)?.remove();
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.text = JSON.stringify(value);
  document.head.appendChild(script);
}

export function updateTaxonomySeo({ type, slug, name, count }: TaxonomySeoInput) {
  if (typeof document === 'undefined') return;
  const url = buildTaxonomyUrl({ type, slug, name });
  const canonical = `${SITE_DOMAIN}${url}`;
  const specialized: TaxonomySpecializedSeo | undefined = type === 'category' ? CATEGORY_SEO[slug] : TAG_SEO[slug];
  const isIndexable = type === 'category'
    ? Boolean(CATEGORY_SEO[slug]) && count >= 2
    : count >= 1;
  const title = specialized?.title || `${name} | ${type === 'category' ? 'دسته‌بندی' : 'مقالات مرتبط'} در سولمینت`;
  const description = specialized?.description || `مقالات مرتبط با ${type === 'category' ? 'دسته‌بندی' : 'برچسب'} «${name}» در آکادمی سولمینت؛ آموزش‌ها، تحلیل‌ها و مطالب تخصصی مرتبط با سولانا و وب۳.`;
  document.title = title;
  setMeta('description', description);
  setMeta('robots', isIndexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');
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
  if (!isIndexable) { document.getElementById('solmint-taxonomy-jsonld')?.remove(); return; }
  setJsonLd('solmint-taxonomy-jsonld', {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${canonical}#collection`, url: canonical,
    name: title, headline: specialized?.h1 || name, description, inLanguage: 'fa-IR',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_DOMAIN}#website`, url: SITE_DOMAIN, name: 'سولمینت' },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: SITE_DOMAIN },
      { '@type': 'ListItem', position: 2, name: 'وبلاگ', item: `${SITE_DOMAIN}/blog` },
      { '@type': 'ListItem', position: 3, name: specialized?.h1 || name, item: canonical }
    ] },
    mainEntity: { '@type': 'ItemList', numberOfItems: count, itemListOrder: 'https://schema.org/ItemListOrderDescending', name: specialized?.h1 || name }
  });
}
