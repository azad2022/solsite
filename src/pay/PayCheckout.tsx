import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, LockKeyhole, ReceiptText, RefreshCcw, ShieldCheck, WalletCards } from 'lucide-react';
import { checkoutLabel } from './checkout-i18n';
import { directionFor, translate } from './i18n';
import { PayHttpError } from './http';
import { payPaymentIntentService, type PayPaymentIntent, type PayPaymentStatus } from './payment-intent-service';
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

function presentationDecimals(asset: string, tokenDecimals: number | null): number {
  if (tokenDecimals !== null) return tokenDecimals;
  return asset === 'SOL' ? 9 : 0;
}

function formatAtomic(value: string, decimals: number): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return normalized;
  if (decimals === 0) return normalized;
  const padded = normalized.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function SnapshotValue({ value }: { value: string }): React.ReactElement {
  return <code className="pay-checkout-snapshot-value">{value}</code>;
}

const NON_TERMINAL_STATUSES: ReadonlySet<PayPaymentStatus> = new Set([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'underpaid', 'overpaid', 'ambiguous',
]);

function statusDescriptionKey(status: PayPaymentStatus): 'paymentState' | 'paymentConfirmed' {
  return status === 'completed' ? 'paymentConfirmed' : 'paymentState';
}

export function PayCheckout({ locale, intentId, onBack }: PayCheckoutProps): React.ReactElement {
  const direction = directionFor(locale);
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;
  const [intent, setIntent] = useState<PayPaymentIntent | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unauthorized' | 'forbidden' | 'retryable'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const loadIntent = useCallback(async (showLoading = true) => {
    if (!intentId) {
      setIntent(null);
      setState('empty');
      setErrorMessage(undefined);
      return;
    }

    if (showLoading) setState('loading');
    setErrorMessage(undefined);
    try {
      const value = await payPaymentIntentService.get(intentId);
      if (!mountedRef.current) return;
      setIntent(value);
      setState('ready');
    } catch (cause) {
      if (!mountedRef.current) return;
      if (showLoading || !intent) {
        setIntent(null);
        setState(dataStateForError(cause));
        setErrorMessage(checkoutLabel(locale, 'loadFailed'));
      }
    }
  }, [intent, intentId, locale]);

  useEffect(() => {
    mountedRef.current = true;
    void loadIntent(true);
    return () => { mountedRef.current = false; };
  }, [loadIntent]);

  useEffect(() => {
    if (!intent || !NON_TERMINAL_STATUSES.has(intent.status)) return;

    const timer = window.setInterval(() => {
      setIsRefreshing(true);
      void payPaymentIntentService.get(intent.id)
        .then(value => {
          if (!mountedRef.current) return;
          setIntent(value);
          setState('ready');
        })
        .catch(() => {
          // Keep the last authoritative snapshot when a refresh temporarily fails.
          // A stale snapshot is preferable to manufacturing a payment result locally.
        })
        .finally(() => {
          if (mountedRef.current) setIsRefreshing(false);
        });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [intent]);

  const decimals = intent ? presentationDecimals(intent.asset, intent.tokenDecimals) : 0;
  const isCompleted = intent?.status === 'completed';

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
            <PayDataStateView locale={locale} state={state} message={errorMessage} onRetry={state === 'retryable' ? () => void loadIntent(true) : undefined} />
          ) : intent ? (
            <>
              <div className="pay-checkout-status-grid">
                <div className="pay-checkout-status-card"><WalletCards size={18} /><div><span>{checkoutLabel(locale, 'merchant')}</span><strong>{intent.merchant.businessName}</strong></div></div>
                <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(locale, 'amount')}</span><strong>{formatAtomic(intent.amountAtomic, decimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(locale, 'customerTotal')}</span><strong>{formatAtomic(intent.customerTotalAtomic, decimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><span aria-hidden="true" className="pay-checkout-icon-glyph">¤</span><div><span>{checkoutLabel(locale, 'fee')}</span><strong>{formatAtomic(intent.feeAtomic, decimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><ShieldCheck size={18} /><div><span>{checkoutLabel(locale, 'intentStatus')}</span><SnapshotValue value={intent.status} /></div></div>
                <div className="pay-checkout-status-card"><Clock3 size={18} /><div><span>{translate(locale, 'expiration')}</span><strong>{intent.expiresAt}</strong></div></div>
              </div>

              <div className="pay-checkout-notice">
                <strong>{translate(locale, isCompleted ? statusDescriptionKey(intent.status) : 'checkoutSnapshot')}</strong>
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
              {isRefreshing ? <div className="pay-checkout-refresh" role="status" aria-live="polite"><RefreshCcw size={15} /> {translate(locale, 'verification')}</div> : null}
            </>
          ) : null}

          {intentId ? <code className="pay-checkout-intent-id">{intentId}</code> : <span>{translate(locale, 'checkoutIntentMissing')}</span>}
        </section>
      </main>
    </div>
  );
}

export default PayCheckout;
