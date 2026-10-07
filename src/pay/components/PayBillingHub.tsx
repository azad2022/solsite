import React from 'react';
import { BarChart3, Users, Activity } from 'lucide-react';
import type { PayLocale } from '../types';
import type { PaySection } from '../types';
import { translate } from '../i18n';
import PayInvoices from './PayInvoices';
import PayPaymentLinks from './PayPaymentLinks';
import PayTransactions from './PayTransactions';
import PayCustomers from './PayCustomers';
import PayReports from './PayReports';
import './pay-billing-hub.css';

export type BillingPrimaryView = 'invoices' | 'payment-links';
export type BillingRelatedView = 'transactions' | 'customers' | 'reports' | null;

interface Props {
  locale: PayLocale;
  merchantId: string;
  primaryView: BillingPrimaryView;
  relatedView: BillingRelatedView;
  onRelatedViewChange: (view: Exclude<BillingRelatedView, null>) => void;
}

const RELATED_VIEWS = [
  { key: 'transactions', icon: Activity },
  { key: 'customers', icon: Users },
  { key: 'reports', icon: BarChart3 },
] as const;

export function billingRelatedViewFromSection(section: PaySection): BillingRelatedView {
  return section === 'transactions' || section === 'customers' || section === 'reports' ? section : null;
}

export default function PayBillingHub({
  locale,
  merchantId,
  primaryView,
  relatedView,
  onRelatedViewChange,
}: Props): React.ReactElement {
  const isPaymentLinks = primaryView === 'payment-links';
  const title = translate(locale, isPaymentLinks ? 'paymentLinksTitle' : 'invoicesTitle');
  const description = translate(locale, isPaymentLinks ? 'paymentLinksDescription' : 'invoicesDescription');

  return (
    <section className="pay-billing" aria-labelledby="pay-billing-title">
      <header className="pay-billing-heading">
        <div>
          <span className="pay-panel-kicker">{translate(locale, isPaymentLinks ? 'paymentLinksNavLabel' : 'invoicesNavLabel')}</span>
          <h1 id="pay-billing-title">{title}</h1>
          <p>{description}</p>
        </div>
      </header>

      <div className="pay-billing-primary-content">
        {primaryView === 'invoices'
          ? <PayInvoices locale={locale} merchantId={merchantId} />
          : <PayPaymentLinks locale={locale} merchantId={merchantId} />}
      </div>

      <div className="pay-billing-related-divider">
        <span>{translate(locale, 'operational')}</span>
      </div>

      <nav className="pay-billing-related-nav" role="tablist" aria-label={translate(locale, 'operational')}>
        {RELATED_VIEWS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={relatedView === key}
            className={relatedView === key ? 'is-active' : ''}
            onClick={() => onRelatedViewChange(key)}
          >
            <Icon size={16} aria-hidden="true" />
            {translate(locale, key)}
          </button>
        ))}
      </nav>

      {relatedView === 'transactions' ? <section className="pay-billing-related-content" aria-label={translate(locale, 'transactions')}><PayTransactions locale={locale} merchantId={merchantId} /></section> : null}
      {relatedView === 'customers' ? <section className="pay-billing-related-content" aria-label={translate(locale, 'customers')}><PayCustomers locale={locale} merchantId={merchantId} /></section> : null}
      {relatedView === 'reports' ? <section className="pay-billing-related-content" aria-label={translate(locale, 'reports')}><PayReports locale={locale} merchantId={merchantId} /></section> : null}
    </section>
  );
}
