import React, { Component, StrictMode, ReactNode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'خطای ناشناخته در اجرای صفحه'
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('Solmint React render error:', error, errorInfo);
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          background: '#08080f',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Vazirmatn, sans-serif',
          textAlign: 'center'
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: 560,
            padding: 32,
            borderRadius: 24,
            background: '#11111f',
            border: '1px solid rgba(255,255,255,.1)',
            boxShadow: '0 24px 60px rgba(0,0,0,.45)'
          }}
        >
          <h1 style={{ color: '#14F195', fontSize: 22, margin: '0 0 12px', fontWeight: 800 }}>
            خطا در بارگذاری صفحه
          </h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.9, margin: '0 0 20px' }}>
            اجرای رابط کاربری با خطا متوقف شد. این خطا ثبت شده و صفحه می‌تواند دوباره بارگذاری شود.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              border: 0,
              borderRadius: 12,
              padding: '11px 22px',
              background: '#9945FF',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            بارگذاری مجدد
          </button>
          {import.meta.env.DEV && this.state.errorMessage && (
            <pre style={{ marginTop: 20, color: '#fca5a5', whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>
              {this.state.errorMessage}
            </pre>
          )}
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
    const wrapper = image.closest('figure') || image.parentElement;
    if (!wrapper) {
      image.style.display = 'none';
      return;
    }

    const isArticleMedia = Boolean(
      image.closest('article') ||
      image.closest('[class*="article"]') ||
      wrapper.classList.contains('relative')
    );

    if (!isArticleMedia) return;

    wrapper.setAttribute('data-image-failed', 'true');
    wrapper.style.display = 'none';

    const parentGrid = wrapper.parentElement;
    if (parentGrid instanceof HTMLElement && parentGrid.classList.contains('grid')) {
      const textColumn = Array.from(parentGrid.children).find(child => child !== wrapper) as HTMLElement | undefined;
      if (textColumn) textColumn.style.gridColumn = '1 / -1';
    }
  };

  window.addEventListener('error', handleImageError, true);
  return () => window.removeEventListener('error', handleImageError, true);
}

function Root() {
  useEffect(() => installArticleImageGuard(), []);
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>
);
