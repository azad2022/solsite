const HOME_SEO = {
  title: 'سولمینت | کیف پول غیرامانی سولانا، ساخت توکن و ابزارهای Web3',
  description: 'سولمینت یک کیف پول غیرامانی سولانا برای اندروید و پلتفرم Web3 است؛ مدیریت SOL و توکن‌ها، ساخت توکن SPL و میم‌کوین، NFT، Swap و ابزارهای تخصصی Solana.',
  canonical: 'https://solmint.ir/',
  image: 'https://solmint.ir/og-solmint.png'
};

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setProperty(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function applyHomepageSeo() {
  if (window.location.pathname !== '/') return;
  if (document.title !== HOME_SEO.title) document.title = HOME_SEO.title;

  setMeta('description', HOME_SEO.description);
  setMeta('twitter:title', HOME_SEO.title);
  setMeta('twitter:description', HOME_SEO.description);
  setMeta('twitter:url', HOME_SEO.canonical);
  setMeta('twitter:image', HOME_SEO.image);

  setProperty('og:title', HOME_SEO.title);
  setProperty('og:description', HOME_SEO.description);
  setProperty('og:url', HOME_SEO.canonical);
  setProperty('og:image', HOME_SEO.image);
  setProperty('og:type', 'website');
}

export function installHomepageSeoGuard() {
  applyHomepageSeo();

  const handleRouteChange = () => window.requestAnimationFrame(applyHomepageSeo);
  window.addEventListener('popstate', handleRouteChange);

  const observer = new MutationObserver(() => {
    if (window.location.pathname !== '/') return;
    const titleIsCorrect = document.title === HOME_SEO.title;
    const descriptionIsCorrect = document.querySelector('meta[name="description"]')?.getAttribute('content') === HOME_SEO.description;
    if (!titleIsCorrect || !descriptionIsCorrect) applyHomepageSeo();
  });
  observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['content'] });
}
