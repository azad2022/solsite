import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, LockKeyhole, ReceiptText, RefreshCcw, ShieldCheck, WalletCards } from 'lucide-react';
import { checkoutLabel } from './checkout-i18n';
import { directionFor, translate } from './i18n';
import { PayHttpError } from './http';
import { payPaymentIntentService, type PayPaymentIntent } from './payment-intent-service';
import PayDataStateView from './DataStateView';
import type { PayLocale } from './types';
import './pay-checkout.css';

interface PayCheckoutProps {
  locale: PayLocale;
  intentId?: string;
  onBack: () => void;
}

function dataStateForError(error: unknown): 'error' | 'empty' | 'unauthorized' | 'forbidden' | 'retryable' {
  if (error instanceof PayHttpError) {
    if (error.status === 401) return 'unauthorized';
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'empty';
    if (error.status === 408 || error.status === 429 || error.status >= 500) return 'retryable';
  }
  return 'error';
}

function formatAtomic(value: string, decimals: number | null): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return normalized;
  const scale = decimals ?? 0;
  if (scale === 0) return normalized;
  const padded = normalized.padStart(scale + 1, '0');
  const whole = padded.slice(0, -scale) || '0';
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function SnapshotValue({ value }: { value: string }): React.ReactElement {
  return <code className="pay-checkout-snapshot-value">{value}</code>;
}

export function PayCheckout({ locale, intentId, onBack }: PayCheckoutProps): React.ReactElement {
  const direction = directionFor(locale);
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;
  const [intent, setIntent] = useState<PayPaymentIntent | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unauthorized' | 'forbidden' | 'retryable'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const loadIntent = useCallback(async () => {
    if (!intentId) {
      setIntent(null);
      setState('empty');
      setErrorMessage(undefined);
      return;
    }

    setState('loading');
    setErrorMessage(undefined);
    try {
      const value = await payPaymentIntentService.get(intentId);
      setIntent(value);
      setState('ready');
    } catch (cause) {
      setIntent(null);
      setState(dataStateForError(cause));
      setErrorMessage(cause instanceof Error && !(cause instanceof PayHttpError) ? cause.message : checkoutLabel(locale, 'loadFailed'));
    }
  }, [intentId, locale]);

  useEffect(() => {
    void loadIntent();
  }, [loadIntent]);

  return (
    <div className="solmint-pay pay-checkout" dir={direction} lang={locale}>
      <header className="pay-checkout-header">
        <div className="pay-checkout-brand">
          <div className="pay-brand-mark" aria-hidden="true"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></div>
          <div className="pay-brand-copy"><strong>{translate(locale, 'brand')}</strong><span>{translate(locale, 'eyebrow')}</span></div>
        </div>
        <div className="pay-checkout-trust"><LockKeyhole size={16} /> {translate(locale, 'checkoutSecure')}</div>
      </header>

      <main className="pay-checkout-main">
        <button type="button" className="pay-checkout-back" onClick={onBack}><BackIcon size={17} />{translate(locale, 'backToPay')}</button>

        <section className="pay-checkout-card" aria-labelledby="pay-checkout-title">
          <div className="pay-checkout-card-header">
            <div className="pay-checkout-icon" aria-hidden="true"><ReceiptText size={22} /></div>
            <div>
              <span className="pay-panel-kicker">{translate(locale, 'checkout')}</span>
              <h1 id="pay-checkout-title">{intent ? intent.merchant.businessName : translate(locale, 'checkoutWaitingTitle')}</h1>
              <p>{translate(locale, 'checkoutWaitingDescription')}</p>
            </div>
          </div>

          {state !== 'ready' ? (
            <PayDataStateView locale={locale} state={state} message={state === 'error' ? errorMessage : undefined} onRetry={state === 'retryable' ? () => void loadIntent() : undefined} />
          ) : intent ? (
            <>
              <div className="pay-checkout-status-grid">
                <div className="pay-checkout-status-card"><WalletCards size={18} /><div><span>{checkoutLabel(locale, 'merchant')}</span><strong>{intent.merchant.businessName}</strong></div></div>
                <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(locale, 'amount')}</span><strong>{formatAtomic(intent.amountAtomic, intent.tokenDecimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(locale, 'customerTotal')}</span><strong>{formatAtomic(intent.customerTotalAtomic, intent.tokenDecimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><CircleDollarSignFallback /><div><span>{checkoutLabel(locale, 'fee')}</span><strong>{formatAtomic(intent.feeAtomic, intent.tokenDecimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><ShieldCheck size={18} /><div><span>{checkoutLabel(locale, 'intentStatus')}</span><SnapshotValue value={intent.status} /></div></div>
                <div className="pay-checkout-status-card"><Clock3 size={18} /><div><span>{translate(locale, 'expiration')}</span><strong>{intent.expiresAt}</strong></div></div>
              </div>

              <div className="pay-checkout-notice">
                <strong>{translate(locale, 'checkoutSnapshot')}</strong>
                <p>{translate(locale, 'checkoutSnapshotDescription')}</p>
                <div className="pay-checkout-status-grid">
                  <div className="pay-checkout-status-card"><WalletCards size={18} /><div><span>{checkoutLabel(locale, 'asset')}</span><SnapshotValue value={intent.asset} /></div></div>
                  <div className="pay-checkout-status-card"><ShieldCheck size={18} /><div><span>{checkoutLabel(locale, 'feePayer')}</span><SnapshotValue value={intent.feePayer} /></div></div>
                  <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(locale, 'network')}</span><SnapshotValue value={intent.network} /></div></div>
                  <div className="pay-checkout-status-card"><WalletCards size={18} /><div><span>{checkoutLabel(locale, 'destination')}</span><SnapshotValue value={intent.recipient} /></div></div>
                  <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(locale, 'reference')}</span><SnapshotValue value={intent.reference} /></div></div>
                  <div className="pay-checkout-status-card"><ShieldCheck size={18} /><div><span>{checkoutLabel(locale, 'commitment')}</span><SnapshotValue value={intent.verificationCommitment} /></div></div>
                </div>
              </div>
            </>
          ) : null}

          {intentId ? <code className="pay-checkout-intent-id">{intentId}</code> : <span>{translate(locale, 'checkoutIntentMissing')}</span>}
        </section>
      </main>
    </div>
  );
}

function CircleDollarSignFallback(): React.ReactElement {
  return <span aria-hidden="true" className="pay-checkout-icon-glyph">¤</span>;
}

export default PayCheckout;
