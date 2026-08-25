import React, { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installHomepageSeoGuard } from './utils/homeSeoGuard';

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; errorMessage: string; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private readonly childContent: ReactNode;
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };
  constructor(props: ErrorBoundaryProps) { super(props); this.childContent = props.children; }
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, errorMessage: error instanceof Error ? error.message : 'خطای ناشناخته در اجرای صفحه' };
  }
  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) { console.error('Solmint React render error:', error, errorInfo); }
  handleReload = () => window.location.reload();
  render() {
    if (!this.state.hasError) return this.childContent;
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: '#08080f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Vazirmatn, sans-serif', textAlign: 'center' }}>
        <section style={{ width: '100%', maxWidth: 560, padding: 32, borderRadius: 24, background: '#11111f', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
          <h1 style={{ color: '#14F195', fontSize: 22, margin: '0 0 12px', fontWeight: 800 }}>خطا در بارگذاری صفحه</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.9, margin: '0 0 20px' }}>اجرای رابط کاربری با خطا متوقف شد. این خطا ثبت شده و صفحه می‌تواند دوباره بارگذاری شود.</p>
          <button type="button" onClick={this.handleReload} style={{ border: 0, borderRadius: 12, padding: '11px 22px', background: '#9945FF', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>بارگذاری مجدد</button>
          {import.meta.env.DEV && this.state.errorMessage && <pre style={{ marginTop: 20, color: '#fca5a5', whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>{this.state.errorMessage}</pre>}
        </section>
      </div>
    );
  }
}

function installArticleImageGuard() {
  const handleImageError = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    const image = target;
    image.dataset.solmintImageError = 'true';
    image.style.visibility = 'hidden';
  };
  document.addEventListener('error', handleImageError, true);
}

installArticleImageGuard();
installHomepageSeoGuard();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);
