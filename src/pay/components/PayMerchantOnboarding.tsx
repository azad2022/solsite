import React, { useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, Store, Wallet, XCircle } from 'lucide-react';
import { createMyMerchant, getMyMerchant, issueWalletChallenge, verifyWalletChallenge, type PayMerchant } from '../services/merchantOnboardingService';
import { encodeBase58 } from '../services/base58';
import { translateMerchantOnboarding as t } from './pay-merchant-onboarding-i18n';
import type { PayLocale } from '../types';
import './pay-merchant-onboarding.css';

interface SolanaPublicKeyLike { toBase58?: () => string; }
interface SolanaProvider {
  isPhantom?: boolean;
  publicKey?: SolanaPublicKeyLike | null;
  connect: () => Promise<{ publicKey?: SolanaPublicKeyLike } | void>;
  signMessage: (message: Uint8Array, display?: 'utf8') => Promise<{ signature: Uint8Array } | Uint8Array>;
}

declare global {
  interface Window { solana?: SolanaProvider; }
}

interface Props { locale?: PayLocale; onClose?: () => void; onMerchantReady?: (merchant: PayMerchant) => void; }
type Stage = 'idle' | 'loading' | 'creating' | 'challenge' | 'signing' | 'verifying' | 'done' | 'error';

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function PayMerchantOnboarding({ locale = 'fa-IR', onClose, onMerchantReady }: Props): React.ReactElement {
  const [merchant, setMerchant] = useState<PayMerchant | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; message: string; walletAddress: string; expiresAt: string } | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const resetError = () => { setError(''); if (stage === 'error') setStage('idle'); };

  const loadExisting = async () => {
    resetError();
    setStage('loading');
    try {
      const existing = await getMyMerchant();
      setMerchant(existing);
      if (existing) {
        onMerchantReady?.(existing);
        setStage('done');
      } else {
        setStage('idle');
      }
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : t(locale, 'loadMerchantFailed'));
    }
  };

  const ensureMerchant = async () => {
    resetError();
    if (!businessName.trim()) { setStage('error'); setError(t(locale, 'businessNameRequired')); return null; }
    const finalSlug = (slug || slugify(businessName)).trim();
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(finalSlug)) { setStage('error'); setError(t(locale, 'slugInvalid')); return null; }
    setStage('creating');
    try {
      const created = await createMyMerchant({ businessName: businessName.trim(), slug: finalSlug });
      setMerchant(created);
      onMerchantReady?.(created);
      return created;
    } catch (e) {
      setStage('error'); setError(e instanceof Error ? e.message : t(locale, 'merchantCreationFailed')); return null;
    }
  };

  const startWalletVerification = async () => {
    resetError();
    let activeMerchant = merchant;
    if (!activeMerchant) activeMerchant = await ensureMerchant();
    if (!activeMerchant) return;
    const provider = window.solana;
    if (!provider) { setStage('error'); setError(t(locale, 'compatibleWalletRequired')); return; }

    setStage('challenge');
    try {
      const connection = await provider.connect();
      const connectedAddress = connection?.publicKey?.toBase58?.() || provider.publicKey?.toBase58?.() || '';
      if (!connectedAddress) throw new Error(t(locale, 'walletAddressMissing'));
      setWalletAddress(connectedAddress);
      const issued = await issueWalletChallenge(activeMerchant.id, connectedAddress);
      setChallenge(issued);

      setStage('signing');
      const signed = await provider.signMessage(new TextEncoder().encode(issued.message), 'utf8');
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      if (!(signature instanceof Uint8Array) || signature.length === 0) throw new Error(t(locale, 'walletSignatureMissing'));

      setStage('verifying');
      const verified = await verifyWalletChallenge(activeMerchant.id, issued.id, connectedAddress, encodeBase58(signature));
      if (verified.verified !== true) throw new Error(t(locale, 'walletVerificationRejected'));
      setStage('done');
      setChallenge(null);
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : t(locale, 'walletVerificationFailed'));
    }
  };

  const copyMessage = async () => {
    if (!challenge?.message || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(challenge.message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const busy = ['loading', 'creating', 'challenge', 'signing', 'verifying'].includes(stage);
  const verified = stage === 'done' && !!merchant && !!walletAddress;

  return (
    <section className="pay-onboarding-panel" aria-labelledby="pay-onboarding-title">
      <div className="pay-panel-heading">
        <div><span className="pay-panel-kicker">{t(locale, 'merchant')}</span><h2 id="pay-onboarding-title">{t(locale, 'onboardingTitle')}</h2></div>
        {onClose && <button type="button" className="pay-icon-button" onClick={onClose} aria-label={t(locale, 'close')}><XCircle size={18} /></button>}
      </div>

      {!merchant ? <div className="pay-onboarding-form">
        <label><span>{t(locale, 'businessName')}</span><input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder={t(locale, 'businessNamePlaceholder')} autoComplete="organization" disabled={busy} /></label>
        <label><span>{t(locale, 'businessSlug')}</span><input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} placeholder={t(locale, 'businessSlugPlaceholder')} spellCheck={false} disabled={busy} /></label>
        <button type="button" className="pay-primary-action" onClick={() => void ensureMerchant()} disabled={busy}>{stage === 'creating' ? <Loader2 className="animate-spin" size={17} /> : <Store size={17} />} {t(locale, 'createMerchant')}</button>
        <button type="button" className="pay-secondary-action" onClick={() => void loadExisting()} disabled={busy}>{stage === 'loading' ? <Loader2 className="animate-spin" size={17} /> : null} {t(locale, 'checkExistingMerchant')}</button>
      </div> : <div className="pay-onboarding-state">
        <div className="pay-onboarding-success"><CheckCircle2 size={22} /><div><strong>{merchant.businessName}</strong><span>{t(locale, 'merchantId')}: {merchant.id}</span><small>{t(locale, 'status')}: {merchant.status}</small></div></div>
        <div className="pay-onboarding-wallet"><div className="pay-onboarding-wallet-icon"><Wallet size={20} /></div><div><strong>{t(locale, 'receiveWallet')}</strong><span>{walletAddress || t(locale, 'walletNotVerified')}</span></div><button type="button" className="pay-primary-action" onClick={() => void startWalletVerification()} disabled={busy || merchant.status === 'closed' || merchant.status === 'suspended'}>{busy ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />} {stage === 'done' ? t(locale, 'verified') : t(locale, 'connectAndVerifyWallet')}</button></div>
        {verified && <div className="pay-onboarding-verified"><CheckCircle2 size={18} /><span>{t(locale, 'walletOwnershipVerified')}</span></div>}
      </div>}

      {challenge && stage === 'signing' && <div className="pay-onboarding-challenge"><div className="pay-onboarding-challenge-head"><KeyRound size={17} /><strong>{t(locale, 'walletSignatureRequest')}</strong><button type="button" onClick={() => void copyMessage()} aria-label={t(locale, 'copy')} title={t(locale, 'copy')}><Copy size={15} /></button></div><pre>{challenge.message}</pre><small>{t(locale, 'signatureNotTransaction')}</small>{copied && <em>{t(locale, 'copied')}</em>}</div>}
      {error && <div className="pay-onboarding-error" role="alert"><XCircle size={18} /><span>{error}</span></div>}
    </section>
  );
}
