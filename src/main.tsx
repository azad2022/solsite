import React, { Component, ReactNode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { EnglishSite } from './components/english/EnglishSite';
import { getLocaleFromPath, normalizeLocalePath, setDocumentLocale, upsertAlternateLink, removeAlternateLinks } from './utils/i18n';
import { updateEnglishArticleNotFoundSeo, updateEnglishArticleSeo, updateEnglishSeo } from './utils/localizedSeo';
import './index.css';

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; errorMessage: string; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private readonly childContent: ReactNode;
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };
  constructor(props: ErrorBoundaryProps) { super(props); this.childContent = props.children; }
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState { return { hasError: true, errorMessage: error instanceof Error ? error.message : 'خطای ناشناخته در اجرای صفحه' }; }
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

async function resolveArticleAlternates(path: string, locale: 'fa' | 'en') {
  const basePath = locale === 'en' ? path.slice('/en'.length) : path;
  const prefix = locale === 'en' ? '/articles/' : '/article/';
  if (!basePath.startsWith(prefix)) return;
  const slug = decodeURIComponent(basePath.slice(prefix.length));
  if (!slug) return;

  removeAlternateLinks();
  try {
    const currentResponse = await fetch(`/api/articles/localized?language=${locale}&slug=${encodeURIComponent(slug)}`, { credentials: 'same-origin', cache: 'no-store' });
    const currentData = currentResponse.ok ? await currentResponse.json() : null;
    const currentArticle = Array.isArray(currentData?.articles) ? currentData.articles[0] : null;
    if (!currentArticle) {
      if (locale === 'en') updateEnglishArticleNotFoundSeo(path);
      return;
    }

    const groupId = currentArticle.translationGroupId || currentArticle.translation_group_id || currentArticle.id;
    const currentUrl = `${window.location.origin}${path}`;
    upsertAlternateLink(locale === 'en' ? 'en' : 'fa-IR', currentUrl);

    if (locale === 'en') updateEnglishArticleSeo(currentArticle);

    if (!groupId) return;
    const otherLocale: 'fa' | 'en' = locale === 'en' ? 'fa' : 'en';
    const otherResponse = await fetch(`/api/articles/translation?groupId=${encodeURIComponent(groupId)}&language=${otherLocale}`, { credentials: 'same-origin', cache: 'no-store' });
    const otherData = otherResponse.ok ? await otherResponse.json() : null;
    const otherArticle = otherData?.article;
    if (!otherArticle?.slug) return;

    const otherPath = otherLocale === 'en' ? `/en/articles/${encodeURIComponent(otherArticle.slug)}` : `/article/${encodeURIComponent(otherArticle.slug)}`;
    upsertAlternateLink(otherLocale === 'en' ? 'en' : 'fa-IR', `${window.location.origin}${otherPath}`);
    upsertAlternateLink('x-default', `${window.location.origin}${otherLocale === 'fa' ? otherPath : path}`);
  } catch {
    if (locale === 'en') updateEnglishArticleNotFoundSeo(path);
  }
}

function LocaleDocumentController() {
  const [path, setPath] = useState(() => normalizeLocalePath(window.location.pathname || '/'));

  useEffect(() => {
    const handlePopState = () => setPath(normalizeLocalePath(window.location.pathname || '/'));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const locale = getLocaleFromPath(path);
    setDocumentLocale(locale);
    removeAlternateLinks();

    const basePath = locale === 'en' ? path.slice('/en'.length) || '/' : path;
    const isArticlePath = basePath.startsWith('/article/') || basePath.startsWith('/articles/');

    if (locale === 'en') updateEnglishSeo(path);

    if (!isArticlePath) {
      upsertAlternateLink('fa-IR', `${window.location.origin}${locale === 'en' ? (basePath || '/') : path}`);
      upsertAlternateLink('en', `${window.location.origin}${locale === 'en' ? path : `/en${path === '/' ? '' : path}`}`);
      upsertAlternateLink('x-default', `${window.location.origin}/`);
      return;
    }

    void resolveArticleAlternates(path, locale);
  }, [path]);

  return null;
}

function BilingualEntry() {
  const [path, setPath] = useState(() => normalizeLocalePath(window.location.pathname || '/'));

  useEffect(() => {
    const handlePopState = () => setPath(normalizeLocalePath(window.location.pathname || '/'));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextPath: string) => {
    const normalized = normalizeLocalePath(nextPath);
    if (normalized !== normalizeLocalePath(window.location.pathname)) window.history.pushState({}, '', normalized);
    setPath(normalized);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  const isEnglish = getLocaleFromPath(path) === 'en';
  return (
    <>
      <LocaleDocumentController />
      {isEnglish ? <EnglishSite path={path} onNavigate={navigate} /> : <App />}
    </>
  );
}

installArticleImageGuard();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><BilingualEntry /></ErrorBoundary>
  </React.StrictMode>
);
