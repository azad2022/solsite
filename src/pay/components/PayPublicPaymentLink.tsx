import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Clock3, Loader2, LockKeyhole, RefreshCw, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { directionFor, normalizePayLocale } from '../i18n';
import { payPaymentLinkService, type PublicPayPaymentLink } from '../services/paymentLinkService';
import { publicPaymentLinkT } from './pay-public-payment-link-i18n';
import './pay-public-payment-link.css';

interface Props { slug: string; initialLocale: PayLocale; }

function formatAtomic(value: string, decimals: number): string {
  try {
    const amount = BigInt(value);
    const whole = amount / (10n ** BigInt(decimals));
    const fraction = (amount % (10n ** BigInt(decimals))).toString().padStart(decimals, '0').replace(/0+$/, '');
    return fraction ? whole.toString() + '.' + fraction : whole.toString();
  } catch { return value; }
}

function publicLocale(linkLocale: PublicPayPaymentLink['checkoutLocale'], fallback: PayLocale): PayLocale {
  return linkLocale === 'auto' ? fallback : normalizePayLocale(linkLocale);
}

function normalizeCustomerText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function PayPublicPaymentLink({ slug, initialLocale }: Props): React.ReactElement {
  const [link, setLink] = useState<PublicPayPaymentLink | null>(null);
  const [locale, setLocale] = useState<PayLocale>(initialLocale);
  const [state, setState] = useState<'loading'|'ready'|'not-found'|'expired'|'unavailable'|'error'>('loading');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [paymentReason, setPaymentReason] = useState('');
  const [customerValidationError, setCustomerValidationError] = useState(false);

  const direction = directionFor(locale);
  const linkUrl = useMemo(() => window.location.origin + '/pay/link/' + encodeURIComponent(slug), [slug]);

  const load = async () => {
    setState('loading');
    try {
      const result = await payPaymentLinkService.getPublic(slug);
      setLink(result);
      setLocale(publicLocale(result.checkoutLocale, initialLocale));
      setState('ready');
    } catch (cause) {
      if (cause instanceof PayHttpError && cause.status === 410) setState('expired');
      else if (cause instanceof PayHttpError && cause.status === 409) setState('unavailable');
      else if (cause instanceof PayHttpError && cause.status === 404) setState('not-found');
      else setState('error');
    }
  };

  useEffect(() => { void load(); }, [slug]);
  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.getAttribute('lang');
    const prevDir = root.getAttribute('dir');
    root.lang = locale;
    root.dir = direction;
    return () => {
      if (prevLang === null) root.removeAttribute('lang'); else root.setAttribute('lang', prevLang);
      if (prevDir === null) root.removeAttribute('dir'); else root.setAttribute('dir', prevDir);
    };
  }, [locale, direction]);

  const copyLink = async () => {
    if (!navigator.clipboard) return;
    try { await navigator.clipboard.writeText(linkUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { setCopied(false); }
  };

  const startPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!link || creating) return;

    setCustomerValidationError(false);
    const customer = {
      firstName: normalizeCustomerText(firstName),
      lastName: normalizeCustomerText(lastName),
      paymentReason: normalizeCustomerText(paymentReason),
    };
    if (customer.firstName.length < 1 || customer.firstName.length > 120 || customer.lastName.length < 1 || customer.lastName.length > 120 || customer.paymentReason.length < 1 || customer.paymentReason.length > 1000) {
      setCustomerValidationError(true);
      return;
    }

    setFirstName(customer.firstName);
    setLastName(customer.lastName);
    setPaymentReason(customer.paymentReason);
    setCreating(true);
    try {
      const result = await payPaymentLinkService.createFromPublic(slug, customer, crypto.randomUUID());
      const target = '/pay/checkout/' + encodeURIComponent(result.id);
      window.history.pushState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (cause) {
      if (cause instanceof PayHttpError && cause.status === 410) setState('expired');
      else if (cause instanceof PayHttpError && cause.status === 409) setState('unavailable');
      else setState('error');
    } finally { setCreating(false); }
  };

  return <main className="pay-public-link" dir={direction} lang={locale} data-pay-runtime="transport-v2">
    <section className="pay-public-link-card" aria-labelledby="pay-public-link-title">
      <header className="pay-public-link-brand"><div className="pay-public-link-brand-mark"><img src="/assets/solmint-mascot-solana-coin.webp" alt="" /></div><div className="pay-public-link-brand-copy"><strong>SolMint Pay</strong><span><LockKeyhole size={12} /> {publicPaymentLinkT(locale,'secure')}</span></div></header>
      {state === 'loading' ? <div className="pay-public-link-loading"><Loader2 className="animate-spin" size={22}/>{publicPaymentLinkT(locale,'loading')}</div> : state !== 'ready' || !link ? <div className="pay-public-link-error" role="alert">
        <XCircle size={24} /><p>{state==='expired'?publicPaymentLinkT(locale,'expired'):state==='unavailable'?publicPaymentLinkT(locale,'unavailable'):state==='not-found'?publicPaymentLinkT(locale,'notFound'):state==='error'?publicPaymentLinkT(locale,'failed'):publicPaymentLinkT(locale,'invalid')}</p>
        <button type="button" className="pay-secondary-action" onClick={() => void load()}><RefreshCw size={15}/>{publicPaymentLinkT(locale,'retry')}</button>
      </div> : <form className="pay-public-link-form" onSubmit={(event) => void startPayment(event)}>
        <span className="pay-public-link-kicker">{publicPaymentLinkT(locale,'paymentLink')}</span>
        <h1 id="pay-public-link-title">{link.title}</h1>
        <div className="pay-public-link-merchant"><span>{publicPaymentLinkT(locale,'merchant')}</span><strong>{link.merchant.businessName}</strong></div>
        <div className="pay-public-link-amount"><span>{publicPaymentLinkT(locale,'amount')}</span><strong>{formatAtomic(link.amountAtomic, link.amountDecimals)} {link.asset}</strong></div>
        <div className="pay-public-link-meta"><div><span>{publicPaymentLinkT(locale,'feePayer')}</span><strong>{link.feePayer==='merchant'?publicPaymentLinkT(locale,'merchant'):publicPaymentLinkT(locale,'customer')}</strong></div><div><span>{publicPaymentLinkT(locale,'expires')}</span><strong>{link.expiresAt ? new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(link.expiresAt)) : publicPaymentLinkT(locale,'noExpiry')}</strong></div></div>
        {link.description ? <div className="pay-public-link-description"><strong>{publicPaymentLinkT(locale,'description')}</strong><div>{link.description}</div></div> : null}
        <div className="pay-public-link-customer">
          <div className="pay-public-link-customer-heading"><div className="pay-public-link-customer-icon" aria-hidden="true"><UserRound size={17}/></div><div><strong>{publicPaymentLinkT(locale,'customerInfoTitle')}</strong><span>{publicPaymentLinkT(locale,'customerInfoHint')}</span></div></div>
          <div className="pay-public-link-fields">
            <label><span>{publicPaymentLinkT(locale,'firstName')}</span><input value={firstName} onChange={event => setFirstName(event.target.value)} placeholder={publicPaymentLinkT(locale,'firstNamePlaceholder')} autoComplete="given-name" maxLength={120} disabled={creating} required /></label>
            <label><span>{publicPaymentLinkT(locale,'lastName')}</span><input value={lastName} onChange={event => setLastName(event.target.value)} placeholder={publicPaymentLinkT(locale,'lastNamePlaceholder')} autoComplete="family-name" maxLength={120} disabled={creating} required /></label>
            <label className="pay-public-link-field-wide"><span>{publicPaymentLinkT(locale,'paymentReason')}</span><textarea value={paymentReason} onChange={event => setPaymentReason(event.target.value)} placeholder={publicPaymentLinkT(locale,'paymentReasonPlaceholder')} maxLength={1000} rows={3} disabled={creating} required /></label>
          </div>
          <small>{publicPaymentLinkT(locale,'customerInfoPrivacy')}</small>
        </div>
        <div className="pay-public-link-actions"><button type="submit" className="pay-primary-action" disabled={creating}><ShieldCheck size={17}/>{creating?publicPaymentLinkT(locale,'creating'):publicPaymentLinkT(locale,'continue')}</button><button type="button" className="pay-secondary-action" onClick={() => void copyLink()}><Clipboard size={15}/>{copied?publicPaymentLinkT(locale,'copied'):publicPaymentLinkT(locale,'copy')}</button></div>
        {customerValidationError ? <div className="pay-public-link-error pay-public-link-inline-validation" role="alert"><span>{publicPaymentLinkT(locale,'customerInfoValidation')}</span></div> : null}
        <div className="pay-public-link-meta"><div><span>{publicPaymentLinkT(locale,'paymentLink')}</span><strong>{link.slug}</strong></div><div><span>{publicPaymentLinkT(locale,'secure')}</span><strong><Check size={13}/> SolMint Pay</strong></div></div>
      </form>}
    </section>
  </main>;
}