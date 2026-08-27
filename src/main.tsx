import React, { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) {
    console.error('React render error:', error);
  }
  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen flex items-center justify-center bg-[#08080f] text-slate-200 p-6"><div className="max-w-md text-center"><h1 className="text-xl font-black mb-2">خطا در بارگذاری صفحه</h1><p className="text-sm text-slate-400">اجرای رابط کاربری با خطا متوقف شد. این خطا ثبت شده و صفحه می‌تواند دوباره بارگذاری شود.</p><button type="button" onClick={() => window.location.reload()} className="mt-5 px-4 py-2 rounded-xl bg-[#14F195] text-black font-bold text-sm">بارگذاری مجدد</button></div></div>;
    }
    return this.props.children;
  }
}

/**
 * Start loading the component that owns the current public route before
 * createRoot begins evaluating the React tree. The SSR layer intentionally
 * puts indexable HTML inside #root; createRoot will replace it, so getting the
 * route-critical chunk onto the network queue early shortens that visual handoff.
 *
 * This preserves code-splitting: only the module required by the current direct
 * entry is warmed. Internal SPA navigation continues to use the existing lazy
 * components and therefore keeps the normal bundle boundaries.
 */
function preloadInitialRoute() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path.startsWith('/article/')) {
    void import('./components/BlogHub');
    return;
  }

  if (path === '/blog' || /^\/blog\/(category|tag)\//.test(path)) {
    void import('./components/BlogHub');
    if (path !== '/blog') void import('./components/ArticleTaxonomyPage');
    return;
  }

  if (path === '/solana-price') {
    void import('./components/SolanaPricePage');
    void import('./components/SolanaPriceSeoEnhancer');
    void import('./components/SolanaMarketInsights');
    return;
  }

  if (path === '/solana-wallet' || path === '/solana-token' || path === '/solana-meme-coin' || path === '/solana-nft' || path === '/security' || path === '/download' || path === '/faq') {
    void import('./components/landing/LandingPages');
    return;
  }

  if (path === '/app-guide') {
    void import('./components/AppUserGuidePage');
    return;
  }

  if (path === '/wallet-analyzer') {
    void import('./components/wallet/WalletAnalyzerPage');
    return;
  }

  if (path === '/tools/solana-token-tools') {
    void import('./components/tools/SolanaTokenToolsHub');
    return;
  }

  if (path === '/tools/solana-token-scanner') {
    void import('./components/tools/SolanaTokenScannerPage');
    return;
  }

  if (path === '/tools/token-2022-inspector') {
    void import('./components/tools/Token2022InspectorPage');
  }
}

preloadInitialRoute();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
