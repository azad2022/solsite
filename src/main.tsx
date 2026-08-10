import React, { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Solmint follows the local device clock:
 * 06:00–17:59 => light theme
 * 18:00–05:59 => dark theme
 *
 * The attribute is applied before React mounts so users do not see a flash
 * of the wrong theme during navigation or a full page reload.
 */
function getScheduledTheme(): 'light' | 'dark' {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

function applyScheduledTheme() {
  const theme = getScheduledTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColor = theme === 'light' ? '#f8fafc' : '#05050a';
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = themeColor;
}

applyScheduledTheme();

let scheduledThemeTimer: number | undefined;
function scheduleThemeRefresh() {
  window.clearTimeout(scheduledThemeTimer);
  const now = new Date();
  const nextBoundary = new Date(now);
  nextBoundary.setMinutes(0, 0, 0);
  nextBoundary.setHours(now.getHours() + (now.getMinutes() >= 0 ? 1 : 0));

  // Re-evaluate at least once per minute and exactly at the next hour.
  const delay = Math.max(1000, nextBoundary.getTime() - now.getTime() + 50);
  scheduledThemeTimer = window.setTimeout(() => {
    applyScheduledTheme();
    scheduleThemeRefresh();
  }, delay);
}

scheduleThemeRefresh();

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private readonly childContent: ReactNode;
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.childContent = props.children;
  }

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
    if (!this.state.hasError) return this.childContent;

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

    const fallback = document.createElement('div');
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', 'تصویر مقاله در دسترس نیست');
    fallback.textContent = 'تصویر در دسترس نیست';
    fallback.style.cssText = 'padding:24px;text-align:center;color:#94a3b8;background:#111827;border-radius:12px;';
    image.replaceWith(fallback);
  };

  document.addEventListener('error', handleImageError, true);
}

installArticleImageGuard();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
