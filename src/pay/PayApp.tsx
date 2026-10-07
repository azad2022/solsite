import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight, BarChart3, BookOpen, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Code2, FileText, LayoutDashboard, Link2, Loader2, LockKeyhole, Menu, Network, ReceiptText, RefreshCw, ShieldCheck, Store, WalletCards, KeyRound,
  TicketCheck, Users, Webhook, X,
} from 'lucide-react';
import { DEFAULT_PAY_LOCALE, PAY_LOCALE_FLAGS, PAY_LOCALE_SHORT_CODES, directionFor, languageName, normalizePayLocale, persistPayLocale, readStoredPayLocale, sectionLabel, sectionNavLabel, translate } from './i18n';
import { PAY_SECTIONS, PAY_LOCALES, type PayLocale, type PaySection } from './types';
import { normalizePayPath, pathForPaySection } from './routing';
import { matchPayRoute } from './route-match';
import PayCheckout from './PayCheckout';
import PayPublicPaymentLink from './components/PayPublicPaymentLink';
import PayMerchantOnboarding from './components/PayMerchantOnboarding';
import PayGettingStartedGuide from './components/PayGettingStartedGuide';
import PayApiKeyManagement from './components/PayApiKeyManagement';
import PayTicketCenter from './components/PayTicketCenter';
import PayReferrals from './components/PayReferrals';
import PaySecurity from './components/PaySecurity';
import PayDeveloper from './components/PayDeveloper';
import PayBillingHub, { billingRelatedViewFromSection, type BillingPrimaryView, type BillingRelatedView } from './components/PayBillingHub';
import PayUnavailableFeature from './components/PayUnavailableFeature';
import PayDashboard from './components/PayDashboard';
import PayWebhooks from './components/PayWebhooks';
import PayAccountMenu from './components/PayAccountMenu';
import { webhookCopy } from './components/pay-webhooks-i18n';
import { getMyMerchant, type PayMerchant } from './services/merchantOnboardingService';
import { getPaySessionUser, type PaySessionUser } from './services/sessionService';
import './pay.css';

const SECTION_ICONS: Record<PaySection, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  overview: LayoutDashboard, checkout: CircleDollarSign, dashboard: BarChart3, transactions: ReceiptText, merchants: Store, wallet: WalletCards, customers: Users, invoices: FileText, 'payment-links': Link2,
  referrals: Network, reports: BarChart3, tickets: TicketCheck, 'api-keys': KeyRound, developer: Code2, security: ShieldCheck, webhooks: Webhook,
};

const PAY_NAV_SECTIONS: readonly PaySection[] = [
  'overview',
  'merchants',
  'wallet',
  'payment-links',
  'invoices',
  'referrals',
  'api-keys',
  'developer',
  'security',
  'tickets',
];

const PAGE_HEADER_OWNERS: ReadonlySet<PaySection> = new Set([
  'referrals', 'customers', 'tickets', 'wallet', 'api-keys', 'developer', 'security', 'webhooks',
]);

type SessionState = 'loading' | 'authenticated' | 'anonymous' | 'error';
type MerchantLoadState = 'loading' | 'ready' | 'error';

function localeFromNavigator(): PayLocale {
  if (typeof navigator === 'undefined') return DEFAULT_PAY_LOCALE;
  return normalizePayLocale(navigator.language);
}

function initialPayLocale(): PayLocale {
  if (typeof window !== 'undefined') {
    try {
      const stored = readStoredPayLocale(window.localStorage);
      if (stored) return stored;
    } catch {
      // Storage can be unavailable in restrictive browser modes; use navigator locale.
    }
  }
  return localeFromNavigator();
}

function paySectionLabel(locale: PayLocale, section: PaySection): string {
  return section === 'webhooks' ? webhookCopy(locale).title : sectionLabel(locale, section);
}

export function PayApp(): React.ReactElement {
  const [locale, setLocale] = useState<PayLocale>(initialPayLocale);
  const [currentPath, setCurrentPath] = useState<string>(() => normalizePayPath(window.location.pathname || '/pay'));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingRelatedView, setBillingRelatedView] = useState<BillingRelatedView>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageControlRef = useRef<HTMLDivElement>(null);
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [sessionUser, setSessionUser] = useState<PaySessionUser | null>(null);
  const [merchant, setMerchant] = useState<PayMerchant | null>(null);
  const [merchantLoadState, setMerchantLoadState] = useState<MerchantLoadState>('loading');
  const direction = directionFor(locale);
  const route = matchPayRoute(currentPath);
  const isCheckout = route.kind === 'checkout';
  const currentSection: PaySection = route.kind === 'dashboard' && route.section !== 'dashboard' ? route.section : 'overview';
  const isBillingSection = currentSection === 'invoices' || currentSection === 'payment-links' || currentSection === 'transactions' || currentSection === 'customers' || currentSection === 'reports';
  const isDeveloperSection = currentSection === 'developer' || currentSection === 'webhooks';

  useEffect(() => {
    try {
      persistPayLocale(window.localStorage, locale);
    } catch {
      // Locale remains in memory when browser storage is unavailable.
    }
  }, [locale]);

  useEffect(() => {
    const documentElement = document.documentElement;
    const previousLang = documentElement.getAttribute('lang');
    const previousDir = documentElement.getAttribute('dir');

    documentElement.lang = locale;
    documentElement.dir = direction;

    return () => {
      if (previousLang === null) documentElement.removeAttribute('lang');
      else documentElement.setAttribute('lang', previousLang);
      if (previousDir === null) documentElement.removeAttribute('dir');
      else documentElement.setAttribute('dir', previousDir);
    };
  }, [locale, direction]);

  useEffect(() => {
    const related = billingRelatedViewFromSection(currentSection);
    if (related !== null) setBillingRelatedView(related);
    else if (currentSection === 'invoices') setBillingRelatedView(null);
  }, [currentSection]);

  useEffect(() => {
    if (!languageMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!languageControlRef.current?.contains(event.target as Node)) setLanguageMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguageMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [languageMenuOpen]);

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

  if (route.kind === 'payment-link') {
    return <PayPublicPaymentLink slug={route.slug} initialLocale={locale} />;
  }

  if (isCheckout) {
    const hintedLocaleValue = new URLSearchParams(window.location.search).get('locale');
    const checkoutLocaleHint: PayLocale | null =
      hintedLocaleValue === 'fa-IR' || hintedLocaleValue === 'en-US' || hintedLocaleValue === 'ar' || hintedLocaleValue === 'ru'
        ? hintedLocaleValue
        : null;
    return <PayCheckout
      locale={locale}
      localeHint={checkoutLocaleHint}
      intentId={route.kind === 'checkout' ? route.intentId : undefined}
      onBack={() => navigate('overview')}
    />;
  }

  const title = currentSection === 'overview' ? translate(locale, 'overviewTitle') : isBillingSection ? translate(locale, currentSection === 'payment-links' ? 'paymentLinksTitle' : 'billingTitle') : isDeveloperSection ? translate(locale, 'developer') : paySectionLabel(locale, currentSection);
  const navigationLabel = sectionNavLabel(locale, currentSection);
  const accountTitle = sessionState === 'authenticated'
    ? (sessionUser?.fullName || sessionUser?.username || sessionUser?.email || translate(locale, 'account'))
    : translate(locale, 'account');
  const accountSubtitle = sessionState === 'authenticated' ? translate(locale, 'dashboard') : translate(locale, 'notConnected');
  const walletVerified = merchant?.receivingWallet?.verificationStatus === 'verified' && merchant.receivingWallet.isActive;
  const onboardingIncomplete = merchantLoadState !== 'ready' || merchant === null || !walletVerified || merchant.status !== 'active';
  const showGettingStartedGuide = sessionState === 'authenticated' && (currentSection === 'overview' || currentSection === 'merchants') && onboardingIncomplete;
  const canRenderMerchantSetup = sessionState === 'authenticated' && (merchantLoadState === 'ready' || merchantLoadState === 'error');
  const showMerchantOnboarding = sessionState === 'authenticated' && currentSection === 'merchants' && merchantLoadState === 'ready';
  const showWalletManagement = sessionState === 'authenticated' && currentSection === 'wallet' && merchantLoadState === 'ready' && merchant !== null;
  const showApiKeyManagement = sessionState === 'authenticated' && currentSection === 'api-keys' && merchantLoadState === 'ready' && merchant !== null;
  const isSiteAdminSession = sessionUser?.role === 'admin';
  const showTicketMerchantStatePanel = currentSection === 'tickets'
    && sessionState === 'authenticated'
    && sessionUser !== null
    && !isSiteAdminSession
    && (merchantLoadState !== 'ready' || merchant === null);
  const showTickets = currentSection === 'tickets'
    && sessionState === 'authenticated'
    && sessionUser !== null
    && !showTicketMerchantStatePanel;
  const showReferrals = currentSection === 'referrals' && sessionState === 'authenticated' && sessionUser !== null;
  const showDashboard = currentSection === 'overview' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showSecurity = currentSection === 'security' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showDeveloperHub = isDeveloperSection;
  const billingPrimaryView: BillingPrimaryView = currentSection === 'payment-links' ? 'payment-links' : 'invoices';
  const showBillingHub = isBillingSection && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showPageHeader = !PAGE_HEADER_OWNERS.has(currentSection) && !isBillingSection;
  const pageDescription = currentSection === 'overview'
    ? translate(locale, 'overviewDescription')
    : currentSection === 'merchants'
      ? translate(locale, 'merchantsDescription')
      : '';
  const pageTitle = title;
  const merchantBoundSection = ['transactions', 'customers', 'invoices', 'payment-links', 'reports', 'wallet', 'api-keys', 'security', 'webhooks'].includes(currentSection);
  const showDeveloperWebhooks = showDeveloperHub && sessionState === 'authenticated' && sessionUser !== null && merchant !== null;
  const showMerchantStatePanel = sessionState === 'authenticated' && merchantBoundSection && (merchantLoadState !== 'ready' || merchant === null);
  const showSessionErrorPanel = sessionState === 'error';

  return (
    <div className="solmint-pay" dir={direction} lang={locale} data-pay-runtime="transport-v2">
      <a className="pay-skip-link" href="#pay-main">{translate(locale, 'skipToContent')}</a>
      <div className="pay-app-shell">
        <aside dir={direction} className={`pay-sidebar ${mobileNavOpen ? 'is-mobile-open' : ''}`} aria-label={translate(locale, 'menu')}>
          <div className="pay-sidebar-brand">
            <div className="pay-brand-copy"><strong>{translate(locale, 'brand')}</strong><span>{translate(locale, 'eyebrow')}</span></div>
            <button type="button" className="pay-icon-button pay-mobile-close" onClick={() => setMobileNavOpen(false)} aria-label={translate(locale, 'closeMenu')}><X size={18} /></button>
          </div>

          <nav className="pay-nav" aria-label={translate(locale, 'menu')}>
            {PAY_NAV_SECTIONS.map(section => {
              const Icon = SECTION_ICONS[section];
              const active = section === currentSection
                || (section === 'developer' && isDeveloperSection);
              return <button
                key={section}
                type="button"
                className={`pay-nav-item ${active ? 'is-active' : ''}`}
                onClick={() => navigate(section)}
                aria-current={active ? 'page' : undefined}
                aria-label={sectionNavLabel(locale, section)}
                data-section={section}
              >
                <span className="pay-nav-icon" aria-hidden="true"><Icon size={18} strokeWidth={active ? 2.25 : 2} /></span>
                <span className="pay-nav-label">{sectionNavLabel(locale, section)}</span>
                {active && <span className="pay-nav-active-dot" aria-hidden="true" />}
              </button>;
            })}
          </nav>

        </aside>

        <div className="pay-mobile-backdrop" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
        <section className="pay-main-column">
          <header className="pay-topbar">
            <div className="pay-topbar-leading">
              <button type="button" className="pay-icon-button pay-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label={translate(locale, 'openMenu')}><Menu size={20} /></button>
              <a className="pay-topbar-brand-link" href="https://solmint.ir/" aria-label={translate(locale, 'goToWebsite')} title={translate(locale, 'goToWebsite')}>
                <span className="pay-topbar-brand-mark" aria-hidden="true"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></span>
              </a>
              <div className="pay-topbar-breadcrumb"><span>{translate(locale, 'brand')}</span><span className="pay-breadcrumb-separator" aria-hidden="true">{direction === 'rtl' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</span><strong>{navigationLabel}</strong></div>
            </div>

            <div className="pay-topbar-actions">
              <div ref={languageControlRef} className="pay-language-control">
                <button
                  type="button"
                  className="pay-language-trigger"
                  onClick={() => setLanguageMenuOpen(value => !value)}
                  aria-label={translate(locale, 'language')}
                  aria-haspopup="menu"
                  aria-expanded={languageMenuOpen}
                  title={languageName(locale)}
                >
                  <span className="pay-language-flag" aria-hidden="true">{PAY_LOCALE_FLAGS[locale]}</span>
                  <span className="pay-language-code">{PAY_LOCALE_SHORT_CODES[locale]}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {languageMenuOpen ? (
                  <div className="pay-language-menu" role="menu" aria-label={translate(locale, 'language')}>
                    {PAY_LOCALES.map(item => (
                      <button
                        key={item}
                        type="button"
                        className={'pay-language-option' + (item === locale ? ' is-active' : '')}
                        onClick={() => { setLocale(item); setLanguageMenuOpen(false); }}
                        role="menuitemradio"
                        aria-checked={item === locale}
                      >
                        <span className="pay-language-flag" aria-hidden="true">{PAY_LOCALE_FLAGS[item]}</span>
                        <span className="pay-language-option-copy"><strong>{languageName(item)}</strong><small>{PAY_LOCALE_SHORT_CODES[item]}</small></span>
                        {item === locale ? <span className="pay-language-option-check" aria-hidden="true">✓</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {sessionUser ? (
                <PayAccountMenu locale={locale} user={sessionUser} merchant={merchant} title={accountTitle} subtitle={accountSubtitle} />
              ) : (
                <div className="pay-account-chip" title={translate(locale, 'notConnected')}>
                  <span className="pay-account-avatar" aria-hidden="true"><WalletCards size={17} /></span>
                  <span className="pay-account-copy"><strong>{accountTitle}</strong><small>{accountSubtitle}</small></span>
                </div>
              )}
            </div>
          </header>

          <main id="pay-main" className="pay-content">
            {showPageHeader ? (
              <div className="pay-page-heading">
                <div>
                  <h1>{pageTitle}</h1>
                  {pageDescription ? <p>{pageDescription}</p> : null}
                </div>
              </div>
            ) : null}

            {showGettingStartedGuide ? <PayGettingStartedGuide locale={locale} merchant={merchant} merchantLoadState={merchantLoadState} onNavigate={navigate} onRetryMerchant={retryMerchantLookup} /> : null}

            {showMerchantOnboarding ? <PayMerchantOnboarding locale={locale} initialMerchant={currentSection === 'merchants' ? merchant : null} onMerchantReady={(ready) => { setMerchant(ready); setMerchantLoadState('ready'); }} /> : null}

            {showWalletManagement ? <PayMerchantOnboarding locale={locale} view="wallet" initialMerchant={merchant} onMerchantReady={(ready) => { setMerchant(ready); setMerchantLoadState('ready'); }} /> : null}

            {showSessionErrorPanel ? <PayRuntimeStatePanel locale={locale} kind="session-error" onPrimary={() => window.location.reload()} /> : null}

            {showMerchantStatePanel || showTicketMerchantStatePanel ? <PayRuntimeStatePanel locale={locale} kind={merchantLoadState === 'loading' ? 'merchant-loading' : merchant === null && merchantLoadState === 'ready' ? 'merchant-required' : 'merchant-error'} onPrimary={merchantLoadState === 'error' ? retryMerchantLookup : () => navigate('merchants')} onSecondary={merchantLoadState === 'error' ? () => navigate('merchants') : undefined} /> : null}

            {showApiKeyManagement ? <PayApiKeyManagement locale={locale} merchantId={merchant.id} merchantStatus={merchant.status} /> : null}

            {showDashboard ? <PayDashboard locale={locale} merchant={merchant} onViewTransactions={() => navigate('transactions')} /> : null}

            {showBillingHub ? (
              <PayBillingHub
                locale={locale}
                merchantId={merchant.id}
                primaryView={billingPrimaryView}
                relatedView={billingRelatedView}
                onRelatedViewChange={(view) => { setBillingRelatedView(view); navigate(view); }}
              />
            ) : null}

            {showReferrals ? <PayReferrals locale={locale} /> : null}

            {showSecurity ? <PaySecurity locale={locale} merchant={merchant} /> : null}

            {showDeveloperHub ? <>
              <PayDeveloper locale={locale} />
              {showDeveloperWebhooks ? <div className="pay-developer-webhooks-section"><PayWebhooks locale={locale} merchantId={merchant.id} /></div> : null}
            </> : null}

            {showTickets ? <PayTicketCenter locale={locale} sessionUser={sessionUser!} merchantId={merchant?.id || null} /> : null}

            {!showMerchantOnboarding && !showMerchantStatePanel && !showSessionErrorPanel && !showBillingHub && !showReferrals && !showDashboard && !showSecurity && !showDeveloperHub && currentSection !== 'merchants' && !showTickets && !showWalletManagement && !showApiKeyManagement && <section className="pay-hero-card" aria-labelledby="pay-empty-title">
              <div className="pay-hero-grid" />
              <div className="pay-hero-content">
                <div className="pay-hero-icon" aria-hidden="true"><BookOpen size={24} /></div>
                <div><span className="pay-card-kicker">{translate(locale, 'dashboard')}</span><h2 id="pay-empty-title">{translate(locale, currentSection === 'overview' ? 'emptyTitle' : 'noData')}</h2><p>{currentSection === 'overview' ? translate(locale, 'emptyDescription') : translate(locale, 'sectionDescription')}</p></div>
                <div className="pay-hero-mark" aria-hidden="true"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></div>
              </div>
            </section>}

            {!showMerchantOnboarding && !showMerchantStatePanel && !showSessionErrorPanel && !showBillingHub && !showReferrals && !showDashboard && !showSecurity && !showDeveloperHub && currentSection !== 'merchants' && !showTickets && !showWalletManagement && !showApiKeyManagement && <>{currentSection === 'overview' ? <>
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
          <footer className="pay-footer"><span>{translate(locale, 'footer')}</span></footer>
        </section>
      </div>
    </div>
  );
}

function PayRuntimeStatePanel({ locale, kind, onPrimary, onSecondary }: { locale: PayLocale; kind: 'session-error' | 'merchant-loading' | 'merchant-required' | 'merchant-error'; onPrimary: () => void; onSecondary?: () => void }): React.ReactElement {
  const config: { icon: React.ReactNode; title: string; description: string; primary?: string; secondary?: string } = kind === 'session-error'
    ? { icon: <ShieldCheck size={21} />, title: translate(locale, 'sessionUnavailable'), description: translate(locale, 'sessionUnavailable'), primary: translate(locale, 'reload') }
    : kind === 'merchant-loading'
      ? { icon: <Loader2 size={21} className="pay-spin" />, title: translate(locale, 'merchantLoadingTitle'), description: translate(locale, 'merchantLoadingDescription') }
      : kind === 'merchant-required'
        ? { icon: <Store size={21} />, title: translate(locale, 'merchantRequiredTitle'), description: translate(locale, 'merchantRequiredDescription'), primary: translate(locale, 'merchantRequiredAction') }
        : { icon: <RefreshCw size={21} />, title: translate(locale, 'merchantLookupErrorTitle'), description: translate(locale, 'merchantLookupErrorDescription'), primary: translate(locale, 'merchantLookupRetry'), secondary: translate(locale, 'merchantRequiredAction') };

  return (
    <section className="pay-runtime-state" aria-live="polite">
      <div className="pay-runtime-state-icon" aria-hidden="true">{config.icon}</div>
      <div className="pay-runtime-state-copy"><strong>{config.title}</strong><p>{config.description}</p></div>
      {config.primary ? <button type="button" className="pay-primary-action" onClick={onPrimary}>{config.primary}</button> : null}
      {onSecondary && config.secondary ? <button type="button" className="pay-secondary-action" onClick={onSecondary}>{config.secondary}</button> : null}
    </section>
  );
}

function TruthCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }): React.ReactElement {
  return <article className="pay-truth-card"><div className="pay-truth-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div></article>;
}

export default PayApp;
