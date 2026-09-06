import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Code2,
  FileText,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShieldCheck,
  Store,
  TicketCheck,
  Users,
  X,
} from 'lucide-react';
import { DEFAULT_PAY_LOCALE, directionFor, normalizePayLocale, sectionLabel, translate } from './i18n';
import { PAY_LOCALES, type PayLocale, type PaySection } from './types';
import './pay.css';

const SECTION_ICONS: Record<PaySection, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  overview: LayoutDashboard,
  transactions: ReceiptText,
  merchants: Store,
  customers: Users,
  invoices: FileText,
  referrals: Network,
  reports: BarChart3,
  tickets: TicketCheck,
  developer: Code2,
  security: ShieldCheck,
};

const SECTION_KEYS: PaySection[] = [
  'overview',
  'transactions',
  'merchants',
  'customers',
  'invoices',
  'referrals',
  'reports',
  'tickets',
  'developer',
  'security',
];

const PAY_PREFIX = '/pay';

function normalizePath(pathname: string): string {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean || '/';
}

function sectionFromPath(pathname: string): PaySection {
  const suffix = normalizePath(pathname).slice(PAY_PREFIX.length).replace(/^\//, '');
  return SECTION_KEYS.includes(suffix as PaySection) ? suffix as PaySection : 'overview';
}

function pathForSection(section: PaySection): string {
  return section === 'overview' ? PAY_PREFIX : `${PAY_PREFIX}/${section}`;
}

function localeFromNavigator(): PayLocale {
  if (typeof navigator === 'undefined') return DEFAULT_PAY_LOCALE;
  return normalizePayLocale(navigator.language);
}

export function PayApp(): React.ReactElement {
  const [locale, setLocale] = useState<PayLocale>(localeFromNavigator);
  const [currentPath, setCurrentPath] = useState<string>(() => normalizePath(window.location.pathname || PAY_PREFIX));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const direction = directionFor(locale);
  const currentSection = sectionFromPath(currentPath);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    return () => {
      document.documentElement.lang = 'fa-IR';
      document.documentElement.dir = 'rtl';
    };
  }, [locale, direction]);

  useEffect(() => {
    const onPopState = () => setCurrentPath(normalizePath(window.location.pathname || PAY_PREFIX));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (section: PaySection) => {
    const target = pathForSection(section);
    if (normalizePath(window.location.pathname) !== target) window.history.pushState({}, '', target);
    setCurrentPath(target);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  const title = useMemo(() => translate(locale, currentSection === 'overview' ? 'overviewTitle' : sectionKeyToTitle(currentSection)), [currentSection, locale]);
  const description = useMemo(() => translate(locale, currentSection === 'overview' ? 'overviewDescription' : 'sectionDescription'), [currentSection, locale]);

  return (
    <div className="solmint-pay" dir={direction} lang={locale}>
      <a className="pay-skip-link" href="#pay-main">{translate(locale, 'dashboard')}</a>
      <div className="pay-app-shell">
        <aside className={`pay-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileNavOpen ? 'is-mobile-open' : ''}`} aria-label={translate(locale, 'menu')}>
          <div className="pay-sidebar-brand">
            <div className="pay-brand-mark" aria-hidden="true">
              <img src="/assets/solmint-mascot-solana-coin.webp" alt="" />
            </div>
            <div className="pay-brand-copy">
              <strong>{translate(locale, 'brand')}</strong>
              <span>{translate(locale, 'eyebrow')}</span>
            </div>
            <button type="button" className="pay-icon-button pay-mobile-close" onClick={() => setMobileNavOpen(false)} aria-label={translate(locale, 'closeMenu')}>
              <X size={18} />
            </button>
          </div>

          <div className="pay-sidebar-section-label">{translate(locale, 'menu')}</div>
          <nav className="pay-nav" aria-label={translate(locale, 'menu')}>
            {SECTION_KEYS.map(section => {
              const Icon = SECTION_ICONS[section];
              const active = section === currentSection;
              return (
                <button
                  key={section}
                  type="button"
                  className={`pay-nav-item ${active ? 'is-active' : ''}`}
                  onClick={() => navigate(section)}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
                  <span>{sectionLabel(locale, section)}</span>
                  {active && <span className="pay-nav-active-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>

          <div className="pay-sidebar-bottom">
            <div className="pay-sidebar-security">
              <div className="pay-sidebar-security-icon" aria-hidden="true"><LockKeyhole size={16} /></div>
              <div>
                <strong>{translate(locale, 'secureBoundary')}</strong>
                <span>{translate(locale, 'secureBoundaryText')}</span>
              </div>
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
              <button type="button" className="pay-icon-button pay-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label={translate(locale, 'openMenu')}>
                <Menu size={20} />
              </button>
              <div className="pay-topbar-breadcrumb">
                <span>{translate(locale, 'brand')}</span>
                <span className="pay-breadcrumb-separator" aria-hidden="true">{direction === 'rtl' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</span>
                <strong>{sectionLabel(locale, currentSection)}</strong>
              </div>
            </div>

            <div className="pay-topbar-actions">
              <div className="pay-language-control" aria-label={translate(locale, 'language')}>
                {PAY_LOCALES.map(item => (
                  <button
                    key={item}
                    type="button"
                    className={item === locale ? 'is-active' : ''}
                    onClick={() => setLocale(item)}
                    aria-pressed={item === locale}
                  >
                    {localeLabel(item)}
                  </button>
                ))}
              </div>
              <button type="button" className="pay-icon-button" aria-label={translate(locale, 'profile')} title={translate(locale, 'profile')}>
                <Bell size={18} />
              </button>
              <div className="pay-account-chip" title={translate(locale, 'notConnected')}>
                <span className="pay-account-avatar" aria-hidden="true"><CircleDollarSign size={17} /></span>
                <span className="pay-account-copy">
                  <strong>{translate(locale, 'account')}</strong>
                  <small>{translate(locale, 'notConnected')}</small>
                </span>
              </div>
            </div>
          </header>

          <main id="pay-main" className="pay-content">
            <div className="pay-page-heading">
              <div>
                <div className="pay-eyebrow-row"><span className="pay-status-dot" aria-hidden="true" />{translate(locale, 'operational')}</div>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
              <div className="pay-heading-meta" aria-label={translate(locale, 'timeRange')}>
                <span>{translate(locale, 'timeRange')}</span>
                <div className="pay-range-control" role="group" aria-label={translate(locale, 'timeRange')}>
                  <button type="button" className="is-active">{translate(locale, 'today')}</button>
                  <button type="button" disabled>{translate(locale, 'sevenDays')}</button>
                  <button type="button" disabled>{translate(locale, 'thirtyDays')}</button>
                </div>
              </div>
            </div>

            <section className="pay-hero-card" aria-labelledby="pay-empty-title">
              <div className="pay-hero-grid" />
              <div className="pay-hero-content">
                <div className="pay-hero-icon" aria-hidden="true"><BookOpen size={24} /></div>
                <div>
                  <span className="pay-card-kicker">{translate(locale, 'dashboard')}</span>
                  <h2 id="pay-empty-title">{translate(locale, currentSection === 'overview' ? 'emptyTitle' : 'noData')}</h2>
                  <p>{currentSection === 'overview' ? translate(locale, 'emptyDescription') : translate(locale, 'sectionDescription')}</p>
                </div>
                <div className="pay-hero-mark" aria-hidden="true">
                  <img src="/assets/solmint-mascot-solana-coin.webp" alt="" />
                </div>
              </div>
            </section>

            {currentSection === 'overview' ? (
              <>
                <section className="pay-truth-grid" aria-label={translate(locale, 'serverTruth')}>
                  <TruthCard icon={<ShieldCheck size={18} />} title={translate(locale, 'serverTruth')} value={translate(locale, 'serverTruthValue')} />
                  <TruthCard icon={<Store size={18} />} title={translate(locale, 'tenantIsolation')} value={translate(locale, 'tenantIsolationValue')} />
                  <TruthCard icon={<CircleDollarSign size={18} />} title={translate(locale, 'financialState')} value={translate(locale, 'financialStateValue')} />
                </section>
                <section className="pay-operational-grid">
                  <div className="pay-panel pay-panel-lg">
                    <div className="pay-panel-heading">
                      <div>
                        <span className="pay-panel-kicker">{translate(locale, 'dashboard')}</span>
                        <h2>{translate(locale, 'overviewTitle')}</h2>
                      </div>
                      <span className="pay-panel-chip"><ShieldCheck size={15} /> {translate(locale, 'serverTruthValue')}</span>
                    </div>
                    <div className="pay-empty-surface">
                      <div className="pay-empty-icon"><LayoutDashboard size={21} /></div>
                      <div>
                        <strong>{translate(locale, 'noData')}</strong>
                        <p>{translate(locale, 'readOnlyFoundation')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="pay-panel">
                    <div className="pay-panel-heading">
                      <div>
                        <span className="pay-panel-kicker">{translate(locale, 'secureBoundary')}</span>
                        <h2>{translate(locale, 'financialState')}</h2>
                      </div>
                      <ArrowUpRight size={17} />
                    </div>
                    <div className="pay-security-note">
                      <div className="pay-security-note-icon"><LockKeyhole size={18} /></div>
                      <p>{translate(locale, 'apiPending')}</p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <section className="pay-panel pay-section-empty">
                <div className="pay-section-empty-icon">{React.createElement(SECTION_ICONS[currentSection], { size: 22 })}</div>
                <div>
                  <h2>{sectionLabel(locale, currentSection)}</h2>
                  <p>{translate(locale, 'sectionDescription')}</p>
                  <span>{translate(locale, 'readOnlyFoundation')}</span>
                </div>
              </section>
            )}
          </main>

          <footer className="pay-footer">
            <span>{translate(locale, 'footer')}</span>
            <span>{translate(locale, 'secureBoundary')}</span>
          </footer>
        </section>
      </div>
    </div>
  );
}

function TruthCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }): React.ReactElement {
  return (
    <article className="pay-truth-card">
      <div className="pay-truth-icon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function sectionKeyToTitle(section: PaySection): 'overviewTitle' | 'sectionDescription' {
  return section === 'overview' ? 'overviewTitle' : 'sectionDescription';
}

function localeLabel(locale: PayLocale): string {
  return locale === 'fa-IR' ? 'FA' : locale === 'en-US' ? 'EN' : locale.toUpperCase();
}

export default PayApp;
