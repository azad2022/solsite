import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Copy, LockKeyhole, ReceiptText, RefreshCcw, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import { checkoutLabel } from './checkout-i18n';
import { directionFor, translate } from './i18n';
import { translateTransactionStatus } from './components/pay-transactions-i18n';
import { PayHttpError } from './http';
import { payPaymentIntentService, type PayPaymentIntent, type PayPaymentStatus } from './payment-intent-service';
import { payPaymentVerificationService } from './payment-verification-service';
import { payTransactionRequestService } from './payment-transaction-request-service';
import { payPaymentReceiptService, type PayPaymentReceipt } from './payment-receipt-service';
import PayPaymentReceiptView from './components/PayPaymentReceipt';
import PayDataStateView from './DataStateView';
import type { PayLocale } from './types';
import './pay-checkout.css';
import { encodeBase58 } from './services/base58';
import {
  detectSolanaWalletProviders,
  getSolanaWalletProvider,
  publicKeyString,
  type SolanaInjectedWalletId,
  type SolanaInjectedWalletProvider,
} from './solana-wallet-provider';

interface PayCheckoutProps {
  locale: PayLocale;
  localeHint?: PayLocale | null;
  intentId?: string;
  onBack: () => void;
}

function extractWalletSignature(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const signature = (value as { signature?: unknown }).signature;
  if (typeof signature === 'string') return signature;
  if (signature instanceof Uint8Array) return encodeBase58(signature);
  if (signature && typeof signature === 'object' && typeof (signature as { toString?: unknown }).toString === 'function') {
    const serialized = (signature as { toString(): string }).toString();
    return serialized === '[object Object]' ? '' : serialized;
  }
  return '';
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

const PAYMENT_INTENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NON_TERMINAL_STATUSES: ReadonlySet<PayPaymentStatus> = new Set([
  'created', 'pending', 'detected', 'verifying', 'confirmed', 'underpaid', 'overpaid', 'ambiguous',
]);

export function PayCheckout({ locale, localeHint, intentId, onBack }: PayCheckoutProps): React.ReactElement {
  const direction = uiDirection;
  const BackIcon = uiBackIcon;
  const [intent, setIntent] = useState<PayPaymentIntent | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unauthorized' | 'forbidden' | 'retryable'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<SolanaInjectedWalletId | null>(null);
  const [availableWallets, setAvailableWallets] = useState<readonly SolanaInjectedWalletProvider[]>([]);
  const [walletChooserOpen, setWalletChooserOpen] = useState(false);
  const [signature, setSignature] = useState('');
  const [verificationState, setVerificationState] = useState<'idle' | 'submitting' | 'not_detected' | 'underpaid' | 'overpaid' | 'ambiguous' | 'failed'>('idle');
  const [walletPaymentState, setWalletPaymentState] = useState<'idle' | 'preparing' | 'opening'>('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [copiedField, setCopiedField] = useState<'amount' | 'destination' | 'reference' | null>(null);
  const mountedRef = useRef(true);
  const currentIntentId = intent?.id;
  const currentStatus = intent?.status;
  const [intentLookupId, setIntentLookupId] = useState('');
  const [receipt, setReceipt] = useState<PayPaymentReceipt | null>(null);
  const [receiptState, setReceiptState] = useState<'idle' | 'loading' | 'ready' | 'retryable'>('idle');
  const walletPaymentInFlightRef = useRef(false);

  const uiLocale: PayLocale =
    intent?.checkoutLocale && intent.checkoutLocale !== 'auto'
      ? intent.checkoutLocale
      : localeHint ?? locale;

  const uiDirection = directionFor(uiLocale);
  const uiBackIcon = uiDirection === 'rtl' ? ArrowRight : ArrowLeft;

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
        setErrorMessage(checkoutLabel(localeHint ?? locale, 'loadFailed'));
      }
    }
  }, [intentId, localeHint, locale]);

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

  const loadReceipt = useCallback(async (paymentId: string) => {
    setReceiptState('loading');
    try {
      const value = await payPaymentReceiptService.get(paymentId);
      if (!mountedRef.current) return;
      setReceipt(value);
      setReceiptState('ready');
    } catch {
      if (!mountedRef.current) return;
      setReceiptState('retryable');
    }
  }, []);

  useEffect(() => {
    if (!currentIntentId || currentStatus !== 'completed') {
      setReceipt(null);
      setReceiptState('idle');
      return;
    }
    if (receipt) return;

    void loadReceipt(currentIntentId);
    const timer = window.setInterval(() => void loadReceipt(currentIntentId), 4000);
    return () => window.clearInterval(timer);
  }, [currentIntentId, currentStatus, receipt, loadReceipt]);

  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.getAttribute('lang');
    const previousDir = root.getAttribute('dir');
    root.lang = uiLocale;
    root.dir = uiDirection;
    return () => {
      if (previousLang === null) root.removeAttribute('lang'); else root.setAttribute('lang', previousLang);
      if (previousDir === null) root.removeAttribute('dir'); else root.setAttribute('dir', previousDir);
    };
  }, [uiLocale, uiDirection]);

  const connectWallet = async (walletId?: SolanaInjectedWalletId): Promise<SolanaInjectedWalletProvider | null> => {
    setVerificationState('idle');
    setVerificationMessage('');

    const providers = detectSolanaWalletProviders();
    setAvailableWallets(providers);

    let selectedProvider = walletId ? providers.find((item) => item.id === walletId) : null;
    if (!selectedProvider && providers.length === 1) selectedProvider = providers[0];

    if (!selectedProvider) {
      if (providers.length > 1) {
        setWalletChooserOpen(true);
        return null;
      }
      setVerificationState('failed');
      setVerificationMessage(checkoutLabel(uiLocale, 'walletRequired'));
      return null;
    }

    try {
      if (typeof selectedProvider.provider.connect !== 'function') throw new Error('WALLET_CONNECT_UNAVAILABLE');
      const connection = await selectedProvider.provider.connect();
      const fromConnect = connection && typeof connection === 'object' ? publicKeyString(connection.publicKey) : '';
      const fromProvider = publicKeyString(selectedProvider.provider.publicKey);
      const address = fromConnect || fromProvider;
      if (!address) throw new Error('WALLET_NOT_CONNECTED');

      setSelectedWalletId(selectedProvider.id);
      setWalletAddress(address);
      setWalletChooserOpen(false);
      return { ...selectedProvider, publicKey: selectedProvider.provider.publicKey };
    } catch {
      setWalletChooserOpen(false);
      setVerificationState('failed');
      setVerificationMessage(checkoutLabel(uiLocale, 'walletConnectionFailed'));
      return null;
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

  const verifySignature = async (txSignature: string) => {
    if (!intent) return;
    const normalizedSignature = txSignature.trim();
    if (!normalizedSignature) {
      setVerificationState('failed');
      setVerificationMessage(checkoutLabel(uiLocale, 'signaturePlaceholder'));
      return;
    }
    setVerificationState('submitting');
    setVerificationMessage(checkoutLabel(uiLocale, 'verificationSubmitted'));
    try {
      const result = await payPaymentVerificationService.verify(intent.id, normalizedSignature);
      if (!mountedRef.current) return;
      setSignature(normalizedSignature);
      setIntent(current => current ? { ...current, status: result.status } : current);
      if (result.outcome === 'confirmed') {
        setVerificationState('idle');
        setVerificationMessage(checkoutLabel(uiLocale, 'paymentConfirmed'));
        await loadIntent(false);
      } else if (result.outcome === 'underpaid') {
        setVerificationState('underpaid');
        setVerificationMessage(checkoutLabel(uiLocale, 'paymentUnderpaid'));
      } else if (result.outcome === 'overpaid') {
        setVerificationState('overpaid');
        setVerificationMessage(checkoutLabel(uiLocale, 'paymentOverpaid'));
      } else if (result.outcome === 'ambiguous') {
        setVerificationState('ambiguous');
        setVerificationMessage(checkoutLabel(uiLocale, 'paymentAmbiguous'));
      } else if (result.outcome === 'not_detected') {
        setVerificationState('not_detected');
        setVerificationMessage(checkoutLabel(uiLocale, 'notDetected'));
      } else {
        setVerificationState('failed');
        setVerificationMessage(checkoutLabel(uiLocale, 'verificationFailed'));
      }
    } catch {
      if (!mountedRef.current) return;
      setVerificationState('failed');
      setVerificationMessage(checkoutLabel(uiLocale, 'verificationFailed'));
    } finally {
      if (mountedRef.current) setWalletPaymentState('idle');
    }
  };

  const verify = async () => verifySignature(signature);

  const payWithConnectedWallet = async () => {
    if (!intent || walletPayDisabled || walletPaymentInFlightRef.current) return;
    walletPaymentInFlightRef.current = true;
    setWalletPaymentState('preparing');
    setVerificationState('idle');
    setVerificationMessage('');

    try {
      let activeProvider = selectedWalletId ? getSolanaWalletProvider(selectedWalletId) : undefined;
      if (!activeProvider?.publicKey) {
        activeProvider = await connectWallet(selectedWalletId ?? undefined);
      }
      if (!activeProvider) {
        setWalletPaymentState('idle');
        return;
      }

      const account = publicKeyString(activeProvider.provider.publicKey) || walletAddress;
      if (!account) throw new Error('WALLET_NOT_CONNECTED');

      if (typeof activeProvider.provider.signAndSendTransaction === 'function') {
        const payload = await payTransactionRequestService.build(intent.id, account);
        const transaction = Transaction.from(payload.transaction);
        const result = await activeProvider.provider.signAndSendTransaction(transaction);
        const txSignature = extractWalletSignature(result);
        if (!txSignature) throw new Error('WALLET_SIGNATURE_MISSING');
        await verifySignature(txSignature);
        return;
      }

      const requestUrl = window.location.origin + '/api/pay/v1/payment-intents/' + encodeURIComponent(intent.id) + '/transaction-request';
      setWalletPaymentState('opening');
      window.location.assign('solana:' + requestUrl);
    } catch (cause) {
      if (!mountedRef.current) return;
      setWalletPaymentState('idle');
      const code = cause instanceof Error ? cause.message : 'WALLET_PAYMENT_FAILED';
      setVerificationState('failed');
      setVerificationMessage(code === 'CUSTOMER_TOKEN_ACCOUNT_NOT_FOUND'
        ? checkoutLabel(uiLocale, 'walletTokenAccountMissing')
        : code === 'WALLET_SIGNATURE_MISSING'
          ? checkoutLabel(uiLocale, 'walletSignatureMissing')
          : checkoutLabel(uiLocale, 'walletPaymentFailed'));
    } finally {
      walletPaymentInFlightRef.current = false;
    }
  };

  const decimals = intent ? presentationDecimals(intent.asset, intent.tokenDecimals) : 0;
  const walletPayDisabled = !intent || !['created', 'pending'].includes(intent.status) || verificationState === 'submitting' || walletPaymentState !== 'idle';
  const verificationDisabled = !intent || ['expired', 'completed', 'refunded', 'confirmed'].includes(intent.status) || verificationState === 'submitting';
  const selectedWalletName = selectedWalletId
    ? (availableWallets.find((item) => item.id === selectedWalletId)?.name ?? 'Solana Wallet')
    : '';

  return (
    <div className="solmint-pay pay-checkout" dir={uiDirection} lang={locale}>
      <header className="pay-checkout-header">
        <div className="pay-checkout-brand"><div className="pay-brand-mark" aria-hidden="true"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></div><div className="pay-brand-copy"><strong>{translate(uiLocale, 'brand')}</strong><span>{translate(uiLocale, 'eyebrow')}</span></div></div>
        <div className="pay-checkout-trust"><LockKeyhole size={16} /> {translate(uiLocale, 'checkoutSecure')}</div>
      </header>
      <main className="pay-checkout-main">
        <button type="button" className="pay-checkout-back" onClick={onBack}><BackIcon size={17} />{translate(uiLocale, 'backToPay')}</button>
        <section className="pay-checkout-card" aria-labelledby="pay-checkout-title">
          <div className="pay-checkout-card-header"><div className="pay-checkout-icon" aria-hidden="true"><ReceiptText size={22} /></div><div><span className="pay-panel-kicker">{translate(uiLocale, 'checkout')}</span><h1 id="pay-checkout-title">{intent ? intent.merchant.businessName : translate(uiLocale, 'checkoutWaitingTitle')}</h1><p>{translate(uiLocale, 'checkoutWaitingDescription')}</p></div></div>
          {!intentId ? (
            <form
              className="pay-checkout-intent-lookup"
              onSubmit={(event) => {
                event.preventDefault();
                const value = intentLookupId.trim();
                if (!PAYMENT_INTENT_ID.test(value)) return;
                const target = `/pay/checkout/${encodeURIComponent(value)}`;
                window.history.pushState({}, '', target);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              <div className="pay-checkout-lookup-icon"><ReceiptText size={19} /></div>
              <div className="pay-checkout-lookup-copy">
                <strong>{checkoutLabel(uiLocale, 'intentLookupTitle')}</strong>
                <p>{checkoutLabel(uiLocale, 'intentLookupDescription')}</p>
              </div>
              <label className="pay-checkout-intent-input">
                <span>{checkoutLabel(uiLocale, 'intentLookupLabel')}</span>
                <input
                  value={intentLookupId}
                  onChange={(event) => setIntentLookupId(event.target.value)}
                  placeholder={checkoutLabel(uiLocale, 'intentLookupPlaceholder')}
                  spellCheck={false}
                  autoComplete="off"
                  inputMode="text"
                  aria-label={checkoutLabel(uiLocale, 'intentLookupLabel')}
                />
              </label>
              <button
                type="submit"
                className="pay-primary-action"
                disabled={!PAYMENT_INTENT_ID.test(intentLookupId.trim())}
              >
                <ShieldCheck size={17} /> {checkoutLabel(uiLocale, 'checkIntent')}
              </button>
              {intentLookupId.trim() && !PAYMENT_INTENT_ID.test(intentLookupId.trim()) ? (
                <div className="pay-checkout-verification-message is-failed" role="alert">
                  <XCircle size={18} />
                  <span>{checkoutLabel(uiLocale, 'invalidIntentId')}</span>
                </div>
              ) : null}
            </form>
          ) : state !== 'ready' ? (
            <PayDataStateView locale={uiLocale} state={state} message={errorMessage} onRetry={state === 'retryable' ? () => void loadIntent(true) : undefined} />
          ) : intent ? (
            <>
              <div className="pay-checkout-status-grid">
                <div className="pay-checkout-status-card"><WalletCards size={18} /><div><span>{checkoutLabel(uiLocale, 'merchant')}</span><strong>{intent.merchant.businessName}</strong></div></div>
                <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(uiLocale, 'amount')}</span><strong>{formatAtomic(intent.amountAtomic, decimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(uiLocale, 'customerTotal')}</span><strong>{formatAtomic(intent.customerTotalAtomic, decimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(uiLocale, 'merchantSettlement')}</span><strong>{formatAtomic(intent.merchantSettlementAtomic, decimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><span aria-hidden="true" className="pay-checkout-icon-glyph">¤</span><div><span>{checkoutLabel(uiLocale, 'fee')}</span><strong>{formatAtomic(intent.feeAtomic, decimals)} {intent.asset}</strong></div></div>
                <div className="pay-checkout-status-card"><ShieldCheck size={18} /><div><span>{checkoutLabel(uiLocale, 'intentStatus')}</span><strong>{translateTransactionStatus(uiLocale, intent.status)}</strong></div></div>
                <div className="pay-checkout-status-card"><Clock3 size={18} /><div><span>{translate(uiLocale, 'expiration')}</span><strong>{intent.expiresAt}</strong></div></div>
              </div>

              <div className="pay-checkout-notice">
                <strong>{translateTransactionStatus(uiLocale, intent.status)}</strong>
                <p>{checkoutLabel(uiLocale, 'payInstructions')}</p>
                <div className="pay-checkout-payment-actions">
                  <div className="pay-checkout-action-row"><div><span>{checkoutLabel(uiLocale, 'customerTotal')}</span><strong>{formatAtomic(intent.customerTotalAtomic, decimals)} {intent.asset}</strong></div><button type="button" onClick={() => void copyValue('amount')} aria-label={checkoutLabel(uiLocale, 'copy')} title={checkoutLabel(uiLocale, copiedField === 'amount' ? 'copied' : 'copy')}><Copy size={15} /></button></div>
                  <div className="pay-checkout-action-row"><div><span>{checkoutLabel(uiLocale, 'destination')}</span><SnapshotValue value={truncateAddress(intent.recipient)} /></div><button type="button" onClick={() => void copyValue('destination')} aria-label={checkoutLabel(uiLocale, 'copy')} title={checkoutLabel(uiLocale, copiedField === 'destination' ? 'copied' : 'copy')}><Copy size={15} /></button></div>
                  <div className="pay-checkout-action-row"><div><span>{checkoutLabel(uiLocale, 'reference')}</span><SnapshotValue value={intent.reference} /></div><button type="button" onClick={() => void copyValue('reference')} aria-label={checkoutLabel(uiLocale, 'copy')} title={checkoutLabel(uiLocale, copiedField === 'reference' ? 'copied' : 'copy')}><Copy size={15} /></button></div>
                </div>

                <div className="pay-checkout-wallet-row">
                  <div>
                    <span>{checkoutLabel(uiLocale, 'walletConnect')}</span>
                    <strong>{walletAddress
                      ? (selectedWalletName ? selectedWalletName + ': ' : '') + checkoutLabel(uiLocale, 'walletConnected') + ': ' + truncateAddress(walletAddress)
                      : checkoutLabel(uiLocale, 'walletRequired')}</strong>
                  </div>
                  <button type="button" className="pay-secondary-action" onClick={() => void connectWallet()} disabled={verificationState === 'submitting'}>
                    <WalletCards size={16} /> {walletAddress ? checkoutLabel(uiLocale, 'changeWallet') : checkoutLabel(uiLocale, 'connect')}
                  </button>
                </div>

                {walletChooserOpen ? (
                  <div className="pay-checkout-wallet-chooser" role="group" aria-label={checkoutLabel(uiLocale, 'chooseWallet')}>
                    <div className="pay-checkout-wallet-chooser-heading">
                      <strong>{checkoutLabel(uiLocale, 'chooseWallet')}</strong>
                      <span>{checkoutLabel(uiLocale, 'walletOptionsHint')}</span>
                    </div>
                    <div className="pay-checkout-wallet-options">
                      {availableWallets.map((wallet) => (
                        <button
                          key={wallet.id}
                          type="button"
                          className={wallet.id === selectedWalletId ? 'pay-wallet-option is-selected' : 'pay-wallet-option'}
                          onClick={() => void connectWallet(wallet.id)}
                          disabled={verificationState === 'submitting' || walletPaymentState !== 'idle'}
                        >
                          <span className="pay-wallet-option-badge" aria-hidden="true">{wallet.name.slice(0, 1)}</span>
                          <span>{wallet.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button type="button" className="pay-primary-action pay-checkout-wallet-pay" onClick={() => void payWithConnectedWallet()} disabled={walletPayDisabled}>
                  <WalletCards size={17} /> {walletPaymentState === 'preparing' ? checkoutLabel(uiLocale, 'preparingPayment') : walletPaymentState === 'opening' ? checkoutLabel(uiLocale, 'openingWallet') : checkoutLabel(uiLocale, 'payWithWallet')}
                </button>

                <details className="pay-checkout-manual-details">
                  <summary>
                    <span>{checkoutLabel(uiLocale, 'manualVerification')}</span>
                    <span aria-hidden="true">+</span>
                  </summary>
                  <div className="pay-checkout-manual-details-body">
                    <p>{checkoutLabel(uiLocale, 'manualVerificationHint')}</p>
                    <label className="pay-checkout-signature-field">
                      <span>{checkoutLabel(uiLocale, 'signatureLabel')}</span>
                      <input value={signature} onChange={(event) => { setSignature(event.target.value); setVerificationState('idle'); setVerificationMessage(''); }} placeholder={checkoutLabel(uiLocale, 'signaturePlaceholder')} spellCheck={false} autoComplete="off" inputMode="text" disabled={verificationDisabled} />
                    </label>
                    <button type="button" className="pay-primary-action" onClick={() => void verify()} disabled={verificationDisabled}>{verificationState === 'submitting' ? <RefreshCcw size={17} className="animate-spin" /> : <ShieldCheck size={17} />} {verificationState === 'submitting' ? checkoutLabel(uiLocale, 'verifying') : checkoutLabel(uiLocale, 'verifyPayment')}</button>
                  </div>
                </details>

                {verificationMessage ? <div className={`pay-checkout-verification-message is-${verificationState}`} role="status" aria-live="polite">
                  {verificationState === 'idle' ? <CheckCircle2 size={18} /> : verificationState === 'not_detected' ? <Clock3 size={18} /> : verificationState === 'underpaid' || verificationState === 'overpaid' || verificationState === 'ambiguous' || verificationState === 'failed' ? <XCircle size={18} /> : <RefreshCcw size={18} />}
                  <span>{verificationMessage}</span>
                </div> : null}
              </div>

              <details className="pay-checkout-details">
                <summary><span>{checkoutLabel(uiLocale, 'technicalDetails')}</span><span aria-hidden="true">+</span></summary>
                <div className="pay-checkout-details-body">
                  <p>{checkoutLabel(uiLocale, 'checkoutSnapshotDescription')}</p>
                  <div className="pay-checkout-status-grid">
                    <div className="pay-checkout-status-card"><WalletCards size={18} /><div><span>{checkoutLabel(uiLocale, 'asset')}</span><SnapshotValue value={intent.asset} /></div></div>
                    <div className="pay-checkout-status-card"><ShieldCheck size={18} /><div><span>{checkoutLabel(uiLocale, 'feePayer')}</span><SnapshotValue value={intent.feePayer} /></div></div>
                    <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(uiLocale, 'network')}</span><SnapshotValue value={intent.network} /></div></div>
                    <div className="pay-checkout-status-card"><WalletCards size={18} /><div><span>{checkoutLabel(uiLocale, 'destination')}</span><SnapshotValue value={intent.recipient} /></div></div>
                    <div className="pay-checkout-status-card"><ReceiptText size={18} /><div><span>{checkoutLabel(uiLocale, 'reference')}</span><SnapshotValue value={intent.reference} /></div></div>
                    <div className="pay-checkout-status-card"><ShieldCheck size={18} /><div><span>{checkoutLabel(uiLocale, 'commitment')}</span><SnapshotValue value={intent.verificationCommitment} /></div></div>
                  </div>
                </div>
              </details>
              {receiptState === 'ready' && receipt ? <PayPaymentReceiptView locale={uiLocale} receipt={receipt} /> : null}
              {receiptState === 'retryable' && intent.status === 'completed' ? (
                <div className="pay-checkout-verification-message is-submitting" role="status" aria-live="polite">
                  <RefreshCcw size={18} />
                  <span>{checkoutLabel(uiLocale, 'receiptUnavailable')}</span>
                </div>
              ) : null}
              {isRefreshing ? <div className="pay-checkout-refresh" role="status" aria-live="polite"><RefreshCcw size={15} /> {translate(uiLocale, 'verification')}</div> : null}
            </>
          ) : null}
          {intentId ? <code className="pay-checkout-intent-id">{intentId}</code> : <span>{translate(uiLocale, 'checkoutIntentMissing')}</span>}
        </section>
      </main>
    </div>
  );
}

export default PayCheckout;
