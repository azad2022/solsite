import React from 'react';
import { ArrowLeft, ArrowRight, Clock3, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { directionFor, translate } from './i18n';
import type { PayLocale } from './types';
import './pay-checkout.css';

interface PayCheckoutProps {
  locale: PayLocale;
  intentId?: string;
  onBack: () => void;
}

export function PayCheckout({ locale, intentId, onBack }: PayCheckoutProps): React.ReactElement {
  const direction = directionFor(locale);
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <div className="solmint-pay pay-checkout" dir={direction} lang={locale}>
      <header className="pay-checkout-header">
        <div className="pay-checkout-brand">
          <div className="pay-brand-mark" aria-hidden="true">
            <img src="/assets/solmint-mascot-solana-coin.webp" alt="" />
          </div>
          <div className="pay-brand-copy">
            <strong>{translate(locale, 'brand')}</strong>
            <span>{translate(locale, 'eyebrow')}</span>
          </div>
        </div>
        <div className="pay-checkout-trust"><LockKeyhole size={16} /> {translate(locale, 'checkoutSecure')}</div>
      </header>

      <main className="pay-checkout-main">
        <button type="button" className="pay-checkout-back" onClick={onBack}>
          <BackIcon size={17} />
          {translate(locale, 'backToPay')}
        </button>

        <section className="pay-checkout-card" aria-labelledby="pay-checkout-title">
          <div className="pay-checkout-card-header">
            <div className="pay-checkout-icon" aria-hidden="true"><ReceiptText size={22} /></div>
            <div>
              <span className="pay-panel-kicker">{translate(locale, 'checkout')}</span>
              <h1 id="pay-checkout-title">{translate(locale, 'checkoutWaitingTitle')}</h1>
              <p>{translate(locale, 'checkoutWaitingDescription')}</p>
            </div>
          </div>

          <div className="pay-checkout-status-grid">
            <div className="pay-checkout-status-card">
              <WalletCards size={18} />
              <div>
                <span>{translate(locale, 'paymentState')}</span>
                <strong>{translate(locale, 'awaitingIntent')}</strong>
              </div>
            </div>
            <div className="pay-checkout-status-card">
              <ShieldCheck size={18} />
              <div>
                <span>{translate(locale, 'verification')}</span>
                <strong>{translate(locale, 'verificationPending')}</strong>
              </div>
            </div>
            <div className="pay-checkout-status-card">
              <Clock3 size={18} />
              <div>
                <span>{translate(locale, 'expiration')}</span>
                <strong>{translate(locale, 'awaitingSnapshot')}</strong>
              </div>
            </div>
          </div>

          <div className="pay-checkout-notice">
            <strong>{translate(locale, 'checkoutSnapshot')}</strong>
            <p>{translate(locale, 'checkoutSnapshotDescription')}</p>
            {intentId ? <code>{intentId}</code> : <span>{translate(locale, 'checkoutIntentMissing')}</span>}
          </div>
        </section>
      </main>
    </div>
  );
}

export default PayCheckout;
