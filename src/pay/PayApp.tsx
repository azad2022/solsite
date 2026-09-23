import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight, BarChart3, Bell, BookOpen, ChevronLeft, ChevronRight, CircleDollarSign, Code2, FileText, LayoutDashboard, Loader2, LockKeyhole, Menu, Network, PanelLeftClose, PanelLeftOpen, ReceiptText, RefreshCw, ShieldCheck, Store,
  TicketCheck, Users, Webhook, X,
} from 'lucide-react';
import { DEFAULT_PAY_LOCALE, directionFor, normalizePayLocale, sectionLabel, translate } from './i18n';
import { PAY_SECTIONS, PAY_LOCALES, type PayLocale, type PaySection } from './types';
import { normalizePayPath, pathForPaySection } from './routing';
import { matchPayRoute } from './route-match';
import PayCheckout from './PayCheckout';
import PayMerchantOnboarding from './components/PayMerchantOnboarding';
import PayGettingStartedGuide from './components/PayGettingStartedGuide';
import PayApiKeyManagement from './components/PayApiKeyManagement';
import PayTicketCenter from './components/PayTicketCenter';
import PayTransactions from './components/PayTransactions';
import PayInvoices from './components/PayInvoices';
import PayPaymentLinks from './components/PayPaymentLinks';
import PayReferrals from './components/PayReferrals';
import PayCustomers from './components/PayCustomers';
import PayReports from './components/PayReports';
import PaySecurity from './components/PaySecurity';
import PayDeveloper from './components/PayDeveloper';
import PayUnavailableFeature from './components/PayUnavailableFeature';
import PayDashboard from './components/PayDashboard';
import PayWebhooks from './components/PayWebhooks';
import { webhookCopy } from './components/pay-webhooks-i18n';
import { getMyMerchant, type PayMerchant } from './services/merchantOnboardingService';
import { getPaySessionUser, type PaySessionUser } from './services/sessionService';
import './pay.css';

const SECTION_ICONS: Record<PaySection, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  overview: LayoutDashboard, checkout: CircleDollarSign, dashboard: BarChart3, transactions: ReceiptText, merchants: Store, customers: Users, invoices: FileText,
  referrals: Network, reports: BarChart3, tickets: TicketCheck, developer: Code2, security: ShieldCheck, webhooks: Webhook,
};

type SessionState = 'loading' | 'authenticated' | 'anonymous' | 'error';
type MerchantLoadState = 'loading' | 'ready' | 'error';

function localeFromNavigator(): PayLocale {
  if (typeof navigator === 'undefined') return DEFAULT_PAY_LOCALE;
  return normalizePayLocale(navigator.language);
}

function paySectionLabel(locale: PayLocale, section: PaySection): string {
  return section === 'webhooks' ? webhookCopy(locale).title : sectionLabel(locale, section);
}

export function PayApp(): React.ReactElement {
  const [locale, setLocale] = useState<PayLocale>(localeFromNavigator);
  const [currentPath, setCurrentPath] = useState<string>(() => normalizePayPath(window.location.pathname || '/pay'));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [sessionUser, setSessionUser] = useState<PaySessionUser | null>(null);
  const [merchant, setMerchant] = useState<PayMerchant | null>(null);
  const [merchantLoadState, setMerchantLoadState] = useState<MerchantLoadState>('loading');
  const direction = directionFor(locale);
  const route = matchPayRoute(currentPath);
  const isCheckout = route.kind === 'checkout';
  const currentSection: PaySection = route.kind === 'dashboard' ? route.section : 'overview';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    return () => { document.documentElement.lang = 'fa-IR'; document.documentElement.dir = 'rtl'; };
  }, [locale, direction]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const onPopState = () => setCurrentPath(normalizePayPath(window.location.pathname || '/pay'));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSessionState('loading');
    setSessionUser(null);
    setMerchant(null);
    setMerchantLoadState('loading');

    void getPaySessionUser().then(async user => {
      if (cancelled) return;
      setSessionUser(user);
      setSessionState(user ? 'authenticated' : 'anonymous');
      if (!user) { setMerchantLoadState('ready'); return; }
      try {
        const existingMerchant = await getMyMerchant();
        if (!cancelled) { setMerchant(existingMerchant); setMerchantLoadState('ready'); }
      } catch {
        if (!cancelled) setMerchantLoadState('error');
      }
    }).catch(() => {
      if (cancelled) return;
      setSessionState('error');
    });

    return () => { cancelled = true; };
  }, []);

  const retryMerchantLookup = () => {
    if (sessionState !== 'authenticated') return;
    setMerchantLoadState('loading');
    void getMyMerchant().then(existingMerchant => {
      setMerchant(existingMerchant);
      setMerchantLoadState('ready');
    }).catch(() => {
      setMerchantLoadState('error');
    });
  };

  const navigate = (section: PaySection) => {
    const target = pathForPaySection(section);
    if (normalizePayPath(window.location.pathname) !== target) window.history.pushState({}, '', target);
    setCurrentPath(target);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  if (route.kind === 'not-found') {
    return (
      <div className="solmint-pay" dir={direction} lang={locale} data-pay-runtime="transport-v2">
        <main className="pay-not-found" aria-labelledby="pay-not-found-title">
          <div className="pay-not-found-card">
            <div className="pay-empty-icon"><LayoutDashboard size={21} /></div>
            <span className="pay-panel-kicker">{translate(locale, 'dashboard')}</span>
            <h1 id="pay-not-found-title">{translate(locale, 'noData')}</h1>
            <p>{translate(locale, 'sectionDescription')}</p>
            <button type="button" className="pay-primary-action" onClick={() => navigate('overview')}>{translate(locale, 'backToPay')}</button>
          </div>
        </main>
      </div>
    );
  }

  if (isCheckout) {
    return <PayCheckout locale={locale} intentId={route.kind === 'checkout' ? route.intentId : undefined} onBack={() => navigate('overview')} />;
  }

  const title = currentSection === 'overview' ? translate(locale, 'overviewTitle') : paySectionLabel(locale, currentSection);
  const description = currentSection === 'overview' ? translate(locale, 'overviewDescription') : translate(locale, 'sectionDescription');
  const accountTitle = sessionState === 'authenticated'
    ? (sessionUser?.fullName || sessionUser?.username || sessionUser?.email || translate(locale, 'account'))
    : translate(locale, 'account');
  const accountSubtitle = sessionState === 'authenticated' ? translate(locale, 'dashboard') : translate(locale, 'notConnected');
  const showGettingStartedGuide = sessionState === 'authenticated' && (currentSection === 'overview' || currentSection === 'merchants');
  const canRenderMerchantSetup = sessionState === 'authenticated' && (merchantLoadState === 'ready' || merchantLoadState === 'error');
  const showMerchantOnboarding = canRenderMerchantSetup && ((currentSection === 'overview' && merchant === null && merchantLoadState === 'ready') || currentSection === 'merchants' && merchant === null);
  const showTickets = currentSection === 'tickets' && sessionState === 'authenticated' && sessionUser !== null;
  const showTransactions = currentSection === 'transactions' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showInvoices = currentSection === 'invoices' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showReferrals = currentSection === 'referrals' && sessionState === 'authenticated' && sessionUser !== null;
  const showCustomers = currentSection === 'customers' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showReports = currentSection === 'reports' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showDashboard = currentSection === 'dashboard' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showSecurity = currentSection === 'security' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showDeveloper = currentSection === 'developer';
  const merchantBoundSection = ['dashboard', 'transactions', 'customers', 'invoices', 'reports', 'security', 'webhooks'].includes(currentSection);
  const showWebhooks = currentSection === 'webhooks' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showMerchantStatePanel = sessionState === 'authenticated' && merchantBoundSection && (merchantLoadState !== 'ready' || merchant === null);
  const showSessionErrorPanel = sessionState === 'error';

  return (
    <div className="solmint-pay" dir={direction} lang={locale} data-pay-runtime="transport-v2">
      <a className="pay-skip-link" href="#pay-main">{translate(locale, 'dashboard')}</a>
      <div className="pay-app-shell">
        <aside className={`pay-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileNavOpen ? 'is-mobile-open' : ''}`} aria-label={translate(locale, 'menu')}>
          <div className="pay-sidebar-brand">
            <div className="pay-brand-mark" aria-hidden="true"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></div>
            <div className="pay-brand-copy"><strong>{translate(locale, 'brand')}</strong><span>{translate(locale, 'eyebrow')}</span></div>
            <button type="button" className="pay-icon-button pay-mobile-close" onClick={() => setMobileNavOpen(false)} aria-label={translate(locale, 'closeMenu')}><X size={18} /></button>
          </div>

          <div className="pay-sidebar-section-label">{translate(locale, 'menu')}</div>
          <nav className="pay-nav" aria-label={translate(locale, 'menu')}>
            {PAY_SECTIONS.map(section => {
              const Icon = SECTION_ICONS[section];
              const active = section === currentSection;
              return <button key={section} type="button" className={`pay-nav-item ${active ? 'is-active' : ''}`} onClick={() => navigate(section)} aria-current={active ? 'page' : undefined}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
                <span>{paySectionLabel(locale, section)}</span>
                {active && <span className="pay-nav-active-dot" aria-hidden="true" />}
              </button>;
            })}
          </nav>

          <div className="pay-sidebar-bottom">
            <div className="pay-sidebar-security">
              <div className="pay-sidebar-security-icon" aria-hidden="true"><LockKeyhole size={16} /></div>
              <div><strong>{translate(locale, 'secureBoundary')}</strong><span>{translate(locale, 'secureBoundaryText')}</span></div>
            </div>
            <button type="button" className="pay-collapse-button" onClick={() => setSidebarCollapsed(value => !value)}>
              {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              <span>{sidebarCollapsed ? translate(locale, 'menu') : translate(locale, 'operational')}</span>
            </button>
          </div>
        </aside>

        <div className="pay-mobile-backdrop" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
        <section className="pay-main-column">
          <header className="pay-topbar">
            <div className="pay-topbar-leading">
              <button type="button" className="pay-icon-button pay-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label={translate(locale, 'openMenu')}><Menu size={20} /></button>
              <div className="pay-topbar-breadcrumb"><span>{translate(locale, 'brand')}</span><span className="pay-breadcrumb-separator" aria-hidden="true">{direction === 'rtl' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</span><strong>{paySectionLabel(locale, currentSection)}</strong></div>
            </div>

            <div className="pay-topbar-actions">
              <div className="pay-language-control" aria-label={translate(locale, 'language')}>
                {PAY_LOCALES.map(item => <button key={item} type="button" className={item === locale ? 'is-active' : ''} onClick={() => setLocale(item)} aria-pressed={item === locale}>{item === 'fa-IR' ? 'FA' : item === 'en-US' ? 'EN' : item.toUpperCase()}</button>)}
              </div>
              <button type="button" className="pay-icon-button" aria-label={translate(locale, 'profile')} title={translate(locale, 'profile')}><Bell size={18} /></button>
              <div className="pay-account-chip" title={sessionState === 'authenticated' ? translate(locale, 'dashboard') : translate(locale, 'notConnected')}>
                <span className="pay-account-avatar" aria-hidden="true"><CircleDollarSign size={17} /></span>
                <span className="pay-account-copy"><strong>{accountTitle}</strong><small>{accountSubtitle}</small></span>
              </div>
            </div>
          </header>

          <main id="pay-main" className="pay-content">
            <div className="pay-page-heading">
              <div><div className="pay-eyebrow-row"><span className="pay-status-dot" aria-hidden="true" />{translate(locale, 'operational')}</div><h1>{title}</h1><p>{description}</p></div>
              <div className="pay-heading-meta" aria-label={translate(locale, 'timeRange')}><span>{translate(locale, 'timeRange')}</span><div className="pay-range-control" role="group" aria-label={translate(locale, 'timeRange')}><button type="button" className="is-active" aria-pressed="true">{translate(locale, 'today')}</button><button type="button" disabled aria-disabled="true">{translate(locale, 'sevenDays')}</button><button type="button" disabled aria-disabled="true">{translate(locale, 'thirtyDays')}</button></div></div>
            </div>

            {showGettingStartedGuide ? <PayGettingStartedGuide locale={locale} merchant={merchant} merchantLoadState={merchantLoadState} onNavigate={navigate} onRetryMerchant={retryMerchantLookup} /> : null}

            {showMerchantOnboarding ? <PayMerchantOnboarding locale={locale} initialMerchant={currentSection === 'merchants' ? merchant : null} onMerchantReady={(ready) => { setMerchant(ready); setMerchantLoadState('ready'); }} /> : null}

            {showSessionErrorPanel ? <PayRuntimeStatePanel locale={locale} kind="session-error" onPrimary={() => window.location.reload()} /> : null}

            {showMerchantStatePanel ? <PayRuntimeStatePanel locale={locale} kind={merchantLoadState === 'loading' ? 'merchant-loading' : merchant === null && merchantLoadState === 'ready' ? 'merchant-required' : 'merchant-error'} onPrimary={merchantLoadState === 'error' ? retryMerchantLookup : () => navigate('merchants')} onSecondary={merchantLoadState === 'error' ? () => navigate('merchants') : undefined} /> : null}

            {currentSection === 'merchants' && sessionState === 'authenticated' && merchant ? <PayApiKeyManagement locale={locale} merchantId={merchant.id} merchantStatus={merchant.status} /> : null}

            {showDashboard ? <PayDashboard locale={locale} merchant={merchant} onViewTransactions={() => navigate('transactions')} /> : null}

            {showTransactions ? <PayTransactions locale={locale} merchantId={merchant.id} /> : null}

            {showInvoices ? <><PayInvoices locale={locale} merchantId={merchant.id} /><PayPaymentLinks locale={locale} merchantId={merchant.id} /></> : null}

            {showReferrals ? <PayReferrals locale={locale} /> : null}

            {showCustomers ? <PayCustomers locale={locale} merchantId={merchant.id} /> : null}

            {showReports ? <PayReports locale={locale} merchantId={merchant.id} /> : null}

            {showSecurity ? <PaySecurity locale={locale} merchant={merchant} /> : null}

            {showDeveloper ? <PayDeveloper locale={locale} /> : null}

            {showWebhooks ? <PayWebhooks locale={locale} merchantId={merchant.id} /> : null}

            {showTickets ? <PayTicketCenter locale={locale} sessionUser={sessionUser!} merchantId={merchant?.id || null} /> : null}

            {!showMerchantOnboarding && !showMerchantStatePanel && !showSessionErrorPanel && !showTransactions && !showInvoices && !showReferrals && !showCustomers && !showReports && !showDashboard && !showSecurity && !showDeveloper && !showWebhooks && currentSection !== 'merchants' && !showTickets && <section className="pay-hero-card" aria-labelledby="pay-empty-title">
              <div className="pay-hero-grid" />
              <div className="pay-hero-content">
                <div className="pay-hero-icon" aria-hidden="true"><BookOpen size={24} /></div>
                <div><span className="pay-card-kicker">{translate(locale, 'dashboard')}</span><h2 id="pay-empty-title">{translate(locale, currentSection === 'overview' ? 'emptyTitle' : 'noData')}</h2><p>{currentSection === 'overview' ? translate(locale, 'emptyDescription') : translate(locale, 'sectionDescription')}</p></div>
                <div className="pay-hero-mark" aria-hidden="true"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></div>
              </div>
            </section>}

            {!showMerchantOnboarding && !showMerchantStatePanel && !showSessionErrorPanel && !showTransactions && !showInvoices && !showReferrals && !showCustomers && !showReports && !showDashboard && !showSecurity && !showDeveloper && !showWebhooks && currentSection !== 'merchants' && !showTickets && <>{currentSection === 'overview' ? <>
              <section className="pay-truth-grid" aria-label={translate(locale, 'serverTruth')}>
                <TruthCard icon={<ShieldCheck size={18} />} title={translate(locale, 'serverTruth')} value={translate(locale, 'serverTruthValue')} />
                <TruthCard icon={<Store size={18} />} title={translate(locale, 'tenantIsolation')} value={translate(locale, 'tenantIsolationValue')} />
                <TruthCard icon={<CircleDollarSign size={18} />} title={translate(locale, 'financialState')} value={translate(locale, 'financialStateValue')} />
              </section>
              <section className="pay-operational-grid">
                <div className="pay-panel pay-panel-lg"><div className="pay-panel-heading"><div><span className="pay-panel-kicker">{translate(locale, 'dashboard')}</span><h2>{translate(locale, 'overviewTitle')}</h2></div><span className="pay-panel-chip"><ShieldCheck size={15} /> {translate(locale, 'serverTruthValue')}</span></div><div className="pay-empty-surface"><div className="pay-empty-icon"><LayoutDashboard size={21} /></div><div><strong>{translate(locale, 'noData')}</strong><p>{translate(locale, 'readOnlyFoundation')}</p></div></div></div>
                <div className="pay-panel"><div className="pay-panel-heading"><div><span className="pay-panel-kicker">{translate(locale, 'secureBoundary')}</span><h2>{translate(locale, 'financialState')}</h2></div><ArrowUpRight size={17} /></div><div className="pay-security-note"><div className="pay-security-note-icon"><LockKeyhole size={18} /></div><p>{translate(locale, 'apiPending')}</p></div></div>
              </section>
            </> : <PayUnavailableFeature locale={locale} section={currentSection} />}
            </>}
          </main>
          <footer className="pay-footer"><span>{translate(locale, 'footer')}</span><span>{translate(locale, 'secureBoundary')}</span></footer>
        </section>
      </div>
    </div>
  );
}


function PayRuntimeStatePanel({ locale, kind, onPrimary, onSecondary }: { locale: PayLocale; kind: 'session-error' | 'merchant-loading' | 'merchant-required' | 'merchant-error'; onPrimary: () => void; onSecondary?: () => void }): React.ReactElement {
  const config: { icon: React.ReactNode; title: string; description: string; primary?: string; secondary?: string } = kind === 'session-error'
    ? { icon: <ShieldCheck size={21} />, title: translate(locale, 'sessionUnavailable'), description: translate(locale, 'sessionUnavailable'), primary: translate(locale, 'reload') }
    : kind === 'merchant-loading'
      ? { icon: <Loader2 size={21} className="pay-spin" />, title: translate(locale, 'merchantLoadingTitle'), description: translate(locale, 'merchantLoadingDescription'), primary: undefined }
      : kind === 'merchant-required'
        ? { icon: <Store size={21} />, title: translate(locale, 'merchantRequiredTitle'), description: translate(locale, 'merchantRequiredDescription'), primary: translate(locale, 'merchantRequiredAction') }
        : { icon: <RefreshCw size={21} />, title: translate(locale, 'merchantLookupErrorTitle'), description: translate(locale, 'merchantLookupErrorDescription'), primary: translate(locale, 'merchantLookupRetry'), secondary: translate(locale, 'merchantRequiredAction') };

  return (
    <section className="pay-runtime-state" aria-live="polite">
      <div className="pay-runtime-state-icon" aria-hidden="true">{config.icon}</div>
      <div className="pay-runtime-state-copy">
        <strong>{config.title}</strong>
        <p>{config.description}</p>
      </div>
      {config.primary ? <button type="button" className="pay-primary-action" onClick={onPrimary}>{config.primary}</button> : null}
      {onSecondary && config.secondary ? <button type="button" className="pay-secondary-action" onClick={onSecondary}>{config.secondary}</button> : null}
    </section>
  );
}


function TruthCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }): React.ReactElement {
  return <article className="pay-truth-card"><div className="pay-truth-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div></article>;
}

export default PayApp;
