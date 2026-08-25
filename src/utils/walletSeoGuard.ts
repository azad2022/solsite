const WALLET_SEO = {
  title: 'کیف پول غیرامانی سولانا برای اندروید | مدیریت SOL و SPL | سولمینت',
  description: 'معرفی کیف پول غیرامانی سولمینت برای اندروید؛ مدیریت SOL و توکن‌های SPL، امضای تراکنش، امنیت کلید خصوصی و دسترسی به ابزارهای Web3 سولانا.',
  canonical: 'https://solmint.ir/solana-wallet',
  ogImage: 'https://solmint.ir/images/solana-wallet-og.jpg'
};

function setMeta(name: string, content: string) {
  let node = document.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('name', name);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function setProperty(property: string, content: string) {
  let node = document.querySelector(`meta[property="${property}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('property', property);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

export function installWalletSeoGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const apply = () => {
    if (window.location.pathname.replace(/\/+$/, '') !== '/solana-wallet') return;

    document.title = WALLET_SEO.title;
    setMeta('description', WALLET_SEO.description);
    setMeta('robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', WALLET_SEO.canonical);

    setProperty('og:title', WALLET_SEO.title);
    setProperty('og:description', WALLET_SEO.description);
    setProperty('og:url', WALLET_SEO.canonical);
    setProperty('og:type', 'website');
    setProperty('og:site_name', 'سولمینت - SolMint');
    setProperty('og:locale', 'fa_IR');
    setProperty('og:image', WALLET_SEO.ogImage);
    setProperty('og:image:alt', WALLET_SEO.title);

    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', WALLET_SEO.title);
    setMeta('twitter:description', WALLET_SEO.description);
    setMeta('twitter:url', WALLET_SEO.canonical);
    setMeta('twitter:image', WALLET_SEO.ogImage);
  };

  apply();
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 250);
  window.setTimeout(apply, 1000);
  window.addEventListener('popstate', apply);
}
