import { SITE_DOMAIN } from './seoManager';

export function applyToolSeo({ title, description, path }: { title: string; description: string; path: string }) {
  document.title = title;
  const upsert = (selector: string, attrs: Record<string, string>, content: string) => {
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    if (!el) { el = document.createElement('meta'); document.head.appendChild(el); }
    Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
    el.setAttribute('content', content);
  };
  upsert('meta[name="description"]', { name: 'description' }, description);
  upsert('meta[property="og:title"]', { property: 'og:title' }, title);
  upsert('meta[property="og:description"]', { property: 'og:description' }, description);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = `${SITE_DOMAIN}${path}`;
}
