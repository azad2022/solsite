import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Copy, LockKeyhole, ReceiptText, RefreshCcw, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import { checkoutLabel } from './checkout-i18n';
import { directionFor, translate } from './i18n';
import { PayHttpError } from './http';
import { payPaymentIntentService, type PayPaymentIntent, type PayPaymentStatus } from './payment-intent-service';
import { payPaymentVerificationService } from './payment-verification-service';
import PayDataStateView from './DataStateView';
import type { PayLocale } from './types';
import './pay-checkout.css';

interface PayCheckoutProps { locale: PayLocale; intentId?: string; onBack: () => void; }

interface WalletPublicKeyLike { toBase58?: () => string; }
interface WalletProvider {
  publicKey?: WalletPublicKeyLike | null;
  connect: () => Promise<{ publicKey?: WalletPublicKeyLike } | void>;
  disconnect?: () => Promise<void>;
}

declare global {
  interface Window { solana?: WalletProvider; }
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
  return tokenDecimals ?? (asset === 'SOL' ? 9 : 0);
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

function truncateAddress(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

function SnapshotValue({ value }: { value: string }): React.ReactElement { return <code className="pay-checkout-snapshot-value">{value}</code>; }

const NON_TERMINAL_STATUSES: ReadonlySet<PayPaymentStatus> = new Set([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'underpaid', 'overpaid', 'ambiguous',
]);

export function PayCheckout({ locale, intentId, onBack }: PayCheckoutProps): React.ReactElement {
  const direction = directionFor(locale);
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;
  const [intent, setIntent] = useState<PayPaymentIntent | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unauthorized' | 'forbidden' | 'retryable'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [signature, setSignature] = useState('');
  const [verificationState, setVerificationState] = useState<'idle' | 'submitting' | 'not_detected' | 'underpaid' | 'overpaid' | 'ambiguous' | 'failed'>('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [copiedField, setCopiedField] = useState<'amount' | 'destination' | 'reference' | null>(null);
  const mountedRef = useRef(true);
  const currentIntentId = intent?.id;
  const currentStatus = intent?.status;

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
      if (showLoading) {
        setIntent(null);
        setState(dataStateForError(cause));
        setErrorMessage(checkoutLabel(locale, 'loadFailed'));
      }
    }
  }, [intentId, locale]);

  useEffect(() => {
    mountedRef.current = true;
    void loadIntent(true);
    return () => { mountedRef.current = false; };
  }, [loadIntent]);

  useEffect(() => {
    if (!currentIntentId || !currentStatus || !NON_TERMINAL_STATUSES.has(currentStatus)) return;

    const timer = window.setInterval(() => {
      setIsRefreshing(true);
      void payPaymentIntentService.get(currentIntentId)
        .then(value => {
          if (!mountedRef.current) return;
          setIntent(value);
          setState('ready');
        })
        .catch(() => {
          // Retain the last authoritative snapshot on transient refresh errors.
        })
        .finally(() => {
          if (mountedRef.current) setIsRefreshing(false);
        });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [currentIntentId, currentStatus]);

  const connectWallet = async () => {
    setVerificationState('idle');
    setVerificationMessage('');
    const provider = window.solana;
    if (!provider) {
      setVerificationState('failed');
      setVerificationMessage(checkoutLabel(locale, 'walletRequired'));
      return;
    }
    try {
      const connection = await provider.connect();
      const fromConnect = connection && typeof connection === 'object' ? connection.publicKey?.toBase58?.() : '';
      const fromProvider = provider.publicKey?.toBase58?.() || '';
      const address = fromConnect || fromProvider;
      if (!address) throw new Error(checkoutLabel(locale, 'walletRequired'));
      setWalletAddress(address);
    } catch {
      setVerificationState('failed');
      setVerificationMessage(checkoutLabel(locale, 'walletRequired'));
    }
  };

  const copyValue = async (field: 'amount' | 'destination' | 'reference') => {
    if (!intent || !navigator.clipboard) return;
    const decimals = presentationDecimals(intent.asset, intent.tokenDecimals);
    const value = field === 'amount'
      ? formatAtomic(intent.customerTotalAtomic, decimals)
      : field === 'destination' ? intent.recipient : intent.reference;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1200);
    } catch {
      setCopiedField(null);
    }
  };

  const verify = async () => {
    if (!intent) return;
    const txSignature = signature.trim();
    if (!txSignature) {
      setVerificationState('failed');
      setVerificationMessage(checkoutLabel(locale, 'signaturePlaceholder'));
      return;
    }
    setVerificationState('submitting');
    setVerificationMessage(checkoutLabel(locale, 'verificationSubmitted'));
    try {
      const result = await payPaymentVerificationService.verify(intent.id, txSignature);
      if (!mountedRef.current) return;
      setIntent(current => current ? { ...current, status: result.status } : current);
      if (result.outcome === 'confirmed') {
        setVerificationState('idle');
        setVerificationMessage(checkoutLabel(locale, 'paymentConfirmed'));
        await loadIntent(false);
      } else if (result.outcome === 'underpaid') {
        setVerificationState('underpaid');
        setVerificationMessage(checkoutLabel(locale, 'paymentUnderpaid'));
      } else if (result.outcome === 'overpaid') {
        setVerificationState('overpaid');
        setVerificationMessage(checkoutLabel(locale, 'paymentOverpaid'));
      } else if (result.outcome === 'ambiguous') {
        setVerificationState('ambiguous');
        setVerificationMessage(checkoutLabel(locale, 'paymentAmbiguous'));
      } else if (result.outcome === 'not_detected') {
        setVerificationState('not_detected');
        setVerificationMessage(checkoutLabel(locale, 'notDetected'));
      } else {
        setVerificationState('failed');
        setVerificationMessage(checkoutLabel(locale, 'verificationFailed'));
      }
    } catch (cause) {
      if (!mountedRef.current) return;
      setVerificationState('failed');
      setVerificationMessage(cause instanceof PayHttpError && cause.status === 429 ? checkoutLabel(locale, 'verificationFailed') : checkoutLabel(locale, 'verificationFailed'));
    }
  };

  const decimals = intent ? presentationDecimals(intent.asset, intent.tokenDecimals) : 0;
  const isCompleted = intent?.status === 'completed' || intent?.status === 'confirmed';
  const actionDisabled = !intent || ['expired', 'completed', 'refunded'].includes(intent.status) || verificationState === 'submitting';

  return (
    <div className="solmint-pay pay-checkout" dir={direction} lang={locale}>
      <header className="pay-checkout-header">
        <div className="pay-checkout-brand"><div className="pay-brand-mark" aria-hidden="true"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></div><div className="pay-brand-copy"><strong>{translate(locale, 'brand')}</strong><span>{translate(locale, 'eyebrow')}</span></div></div>
        <div className="pay-checkout-trust"><LockKeyhole size={16} /> {translate(locale, 'checkoutSecure')}</div>
      </header>
      <main className="pay-checkout-main">
        <button type="button" className="pay-checkout-back" onClick={onBack}><BackIcon size={17} />{translate(locale, 'backToPay')}</button>
        <section className="pay-checkout-card" aria-labelledby="pay-checkout-title">
          <div className="pay-checkout-card-header"><div className="pay-checkout-icon" aria-hidden="true"><ReceiptText size={22} /></div><div><span className="pay-panel-kicker">{translate(locale, 'checkout')}</span><h1 id="pay-checkout-title">{intent ? intent.merchant.businessName : translate(locale, 'checkoutWaitingTitle')}</h1><p>{translate(locale, 'checkoutWaitingDescription')}</p></div></div>
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
                <strong>{translate(locale, isCompleted ? 'paymentConfirmed' : 'checkoutSnapshot')}</strong>
                <p>{checkoutLabel(locale, 'payInstructions')}</p>
                <div className="pay-checkout-payment-actions">
                  <div className="pay-checkout-action-row"><div><span>{checkoutLabel(locale, 'customerTotal')}</span><strong>{formatAtomic(intent.customerTotalAtomic, decimals)} {intent.asset}</strong></div><button type="button" onClick={() => void copyValue('amount')} aria-label={checkoutLabel(locale, 'copy')} title={checkoutLabel(locale, copiedField === 'amount' ? 'copied' : 'copy')}><Copy size={15} /></button></div>
                  <div className="pay-checkout-action-row"><div><span>{checkoutLabel(locale, 'destination')}</span><SnapshotValue value={truncateAddress(intent.recipient)} /></div><button type="button" onClick={() => void copyValue('destination')} aria-label={checkoutLabel(locale, 'copy')} title={checkoutLabel(locale, copiedField === 'destination' ? 'copied' : 'copy')}><Copy size={15} /></button></div>
                  <div className="pay-checkout-action-row"><div><span>{checkoutLabel(locale, 'reference')}</span><SnapshotValue value={intent.reference} /></div><button type="button" onClick={() => void copyValue('reference')} aria-label={checkoutLabel(locale, 'copy')} title={checkoutLabel(locale, copiedField === 'reference' ? 'copied' : 'copy')}><Copy size={15} /></button></div>
                </div>

                <div className="pay-checkout-wallet-row">
                  <div><span>{checkoutLabel(locale, 'walletConnect')}</span><strong>{walletAddress ? `${checkoutLabel(locale, 'walletConnected')}: ${truncateAddress(walletAddress)}` : checkoutLabel(locale, 'walletRequired')}</strong></div>
                  <button type="button" className="pay-secondary-action" onClick={() => void connectWallet()} disabled={verificationState === 'submitting'}><WalletCards size={16} /> {walletAddress ? checkoutLabel(locale, 'walletConnected') : checkoutLabel(locale, 'connect')}</button>
                </div>

                <label className="pay-checkout-signature-field">
                  <span>{checkoutLabel(locale, 'signatureLabel')}</span>
                  <input value={signature} onChange={(event) => { setSignature(event.target.value); setVerificationState('idle'); setVerificationMessage(''); }} placeholder={checkoutLabel(locale, 'signaturePlaceholder')} spellCheck={false} autoComplete="off" inputMode="text" disabled={actionDisabled} />
                </label>
                <button type="button" className="pay-primary-action" onClick={() => void verify()} disabled={actionDisabled}>{verificationState === 'submitting' ? <RefreshCcw size={17} className="animate-spin" /> : <ShieldCheck size={17} />} {verificationState === 'submitting' ? checkoutLabel(locale, 'verifying') : checkoutLabel(locale, 'verifyPayment')}</button>

                {verificationMessage ? <div className={`pay-checkout-verification-message is-${verificationState}`} role="status" aria-live="polite">
                  {verificationState === 'idle' ? <CheckCircle2 size={18} /> : verificationState === 'not_detected' ? <Clock3 size={18} /> : verificationState === 'underpaid' || verificationState === 'overpaid' || verificationState === 'ambiguous' || verificationState === 'failed' ? <XCircle size={18} /> : <RefreshCcw size={18} />}
                  <span>{verificationMessage}</span>
                </div> : null}
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
