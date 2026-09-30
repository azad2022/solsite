import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, Store, Wallet, XCircle } from 'lucide-react';
import { createMyMerchant, getMyMerchant, issueWalletChallenge, verifyWalletChallenge, type PayMerchant } from '../services/merchantOnboardingService';
import { PayHttpError } from '../http';
import { encodeBase58 } from '../services/base58';
import { translateMerchantOnboarding as t, translateMerchantStatus } from './pay-merchant-onboarding-i18n';
import type { PayLocale } from '../types';
import { slugifyMerchantName } from '../services/merchantSlug';
import { generateLocalSolanaMerchantWallet, type LocalSolanaMerchantWallet, type MerchantWalletWordCount } from '../services/merchantWalletGenerator';
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

interface Props {
  locale?: PayLocale;
  onClose?: () => void;
  onMerchantReady?: (merchant: PayMerchant) => void;
  initialMerchant?: PayMerchant | null;
}
type Stage = 'idle' | 'loading' | 'creating' | 'generating-wallet' | 'recovery' | 'challenge' | 'signing' | 'verifying' | 'done' | 'error';

class WalletUiError extends Error {}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function PayMerchantOnboarding({ locale = 'fa-IR', onClose, onMerchantReady, initialMerchant = null }: Props): React.ReactElement {
  const [merchant, setMerchant] = useState<PayMerchant | null>(initialMerchant);
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; message: string; walletAddress: string; expiresAt: string } | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [merchantRefreshStale, setMerchantRefreshStale] = useState(false);
  const [wordCount, setWordCount] = useState<MerchantWalletWordCount>(24);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const generatedWalletRef = useRef<LocalSolanaMerchantWallet | null>(null);
  const [refreshingMerchant, setRefreshingMerchant] = useState(false);

  useEffect(() => () => {
    generatedWalletRef.current?.dispose();
    generatedWalletRef.current = null;
  }, []);

  const applyMerchantWalletSnapshot = (value: PayMerchant | null) => {
    setWalletAddress(value?.receivingWallet?.verificationStatus === 'verified' && value.receivingWallet.isActive ? value.receivingWallet.address : '');
    setVerifiedAt(value?.receivingWallet?.verificationStatus === 'verified' && value.receivingWallet.isActive ? value.receivingWallet.verifiedAt : null);
  };

  useEffect(() => {
    if (initialMerchant) {
      setMerchant(initialMerchant);
      applyMerchantWalletSnapshot(initialMerchant);
      setMerchantRefreshStale(false);
      setStage(current => current === 'error' ? 'idle' : current);
    }
  }, [initialMerchant]);

  const resetError = () => { setError(''); if (stage === 'error') setStage('idle'); };

  const discardGeneratedWallet = () => {
    generatedWalletRef.current?.dispose();
    generatedWalletRef.current = null;
    setRecoveryPhrase('');
    setRecoveryVisible(false);
    setRecoverySaved(false);
    setRecoveryCopied(false);
  };
  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    if (!slugTouched) setSlug(slugifyMerchantName(value));
  };

  const refreshMerchant = async () => {
    if (refreshingMerchant) return;
    setRefreshingMerchant(true);
    try {
      const refreshed = await getMyMerchant();
      if (!refreshed) throw new Error('Merchant refresh returned no merchant.');
      setMerchant(refreshed);
      setMerchantRefreshStale(false);
      applyMerchantWalletSnapshot(refreshed);
      onMerchantReady?.(refreshed);
    } catch {
      setMerchantRefreshStale(true);
    } finally {
      setRefreshingMerchant(false);
    }
  };

  const loadExisting = async () => {
    resetError();
    setStage('loading');
    try {
      const existing = await getMyMerchant();
      setMerchant(existing);
      setMerchantRefreshStale(false);
      applyMerchantWalletSnapshot(existing);
      if (existing) {
        onMerchantReady?.(existing);
        setStage('idle');
      } else {
        setStage('idle');
      }
    } catch (e) {
      setStage('error');
      setError(e instanceof PayHttpError ? e.message : t(locale, 'loadMerchantFailed'));
    }
  };

  const ensureMerchant = async () => {
    resetError();
    if (!businessName.trim()) { setStage('error'); setError(t(locale, 'businessNameRequired')); return null; }
    const finalSlug = (slug || slugifyMerchantName(businessName)).trim();
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(finalSlug)) { setStage('error'); setError(t(locale, 'slugInvalid')); return null; }
    setStage('creating');
    setMerchantRefreshStale(false);
    try {
      const created = await createMyMerchant({ businessName: businessName.trim(), slug: finalSlug });
      setMerchant(created);
      onMerchantReady?.(created);
      return created;
    } catch (e) {
      setStage('error'); setError(e instanceof PayHttpError ? e.message : t(locale, 'merchantCreationFailed')); return null;
    }
  };

  const createDedicatedWallet = async (requestedWordCount: MerchantWalletWordCount = wordCount) => {
    resetError();
    let activeMerchant = merchant;
    if (!activeMerchant) activeMerchant = await ensureMerchant();
    if (!activeMerchant) return;

    discardGeneratedWallet();
    setStage('generating-wallet');
    try {
      const generated = await generateLocalSolanaMerchantWallet(requestedWordCount);
      generatedWalletRef.current = generated;
      setRecoveryPhrase(generated.mnemonic);
      setRecoveryVisible(false);
      setRecoverySaved(false);
      setRecoveryCopied(false);
      setStage('recovery');
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : t(locale, 'walletGenerationFailed'));
      discardGeneratedWallet();
    }
  };

  const copyRecoveryPhrase = async () => {
    if (!recoveryPhrase || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
      setRecoveryCopied(true);
      window.setTimeout(() => setRecoveryCopied(false), 1200);
    } catch {
      setRecoveryCopied(false);
    }
  };

  const confirmDedicatedWallet = async () => {
    const generated = generatedWalletRef.current;
    if (!generated || !recoverySaved || !merchant) return;

    resetError();
    setStage('challenge');
    try {
      const issued = await issueWalletChallenge(merchant.id, generated.address);
      setChallenge(issued);
      setStage('signing');
      const signature = await generated.signMessage(issued.message);
      setStage('verifying');
      const verified = await verifyWalletChallenge(merchant.id, issued.id, generated.address, encodeBase58(signature));
      if (verified.verified !== true) throw new WalletUiError(t(locale, 'walletVerificationRejected'));

      setWalletAddress(verified.walletAddress || generated.address);
      setVerifiedAt(verified.verifiedAt || null);
      setStage('done');
      setChallenge(null);
      discardGeneratedWallet();

      try {
        const refreshed = await getMyMerchant();
        if (refreshed) {
          setMerchant(refreshed);
          setMerchantRefreshStale(false);
          applyMerchantWalletSnapshot(refreshed);
          onMerchantReady?.(refreshed);
        } else {
          setMerchantRefreshStale(true);
        }
      } catch {
        setMerchantRefreshStale(true);
      }
    } catch (e) {
      setStage('error');
      setError(e instanceof PayHttpError || e instanceof WalletUiError ? e.message : t(locale, 'walletVerificationFailed'));
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
      const connectionAddress = connection && typeof connection === 'object' ? connection.publicKey?.toBase58?.() : '';
      const providerAddress = provider.publicKey?.toBase58?.() || '';
      const connectedAddress = connectionAddress || providerAddress || '';
      if (!connectedAddress) throw new WalletUiError(t(locale, 'walletAddressMissing'));
      setWalletAddress(connectedAddress);
      const issued = await issueWalletChallenge(activeMerchant.id, connectedAddress);
      setChallenge(issued);

      setStage('signing');
      const signed = await provider.signMessage(new TextEncoder().encode(issued.message), 'utf8');
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      if (!(signature instanceof Uint8Array) || signature.length === 0) throw new WalletUiError(t(locale, 'walletSignatureMissing'));

      setStage('verifying');
      const verified = await verifyWalletChallenge(activeMerchant.id, issued.id, connectedAddress, encodeBase58(signature));
      if (verified.verified !== true) throw new WalletUiError(t(locale, 'walletVerificationRejected'));
      setWalletAddress(verified.walletAddress || connectedAddress);
      setVerifiedAt(verified.verifiedAt || null);
      setMerchantRefreshStale(false);
      setStage('done');
      setChallenge(null);

      // The backend may promote the merchant to active during the same atomic
      // wallet-consume operation. Refresh through the official Merchant API so
      // the rest of Pay never relies on a client-side status assumption.
      try {
        const refreshed = await getMyMerchant();
        if (refreshed) {
          setMerchant(refreshed);
          setMerchantRefreshStale(false);
          applyMerchantWalletSnapshot(refreshed);
          onMerchantReady?.(refreshed);
        } else {
          setMerchantRefreshStale(true);
        }
      } catch {
        setMerchantRefreshStale(true);
        // Keep the authoritative verification result visible. A failed refresh
        // is a stale-data condition, not a verification failure.
      }
    } catch (e) {
      setStage('error');
      setError(e instanceof PayHttpError || e instanceof WalletUiError ? e.message : t(locale, 'walletVerificationFailed'));
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

  const busy = ['loading', 'creating', 'generating-wallet', 'challenge', 'signing', 'verifying'].includes(stage);
  const walletVerifiedAuthoritative = merchant?.receivingWallet?.verificationStatus === 'verified' && merchant.receivingWallet.isActive;
  const verified = walletVerifiedAuthoritative || (stage === 'done' && !!walletAddress);
  const stageLabel = stage === 'generating-wallet' ? t(locale, 'walletGenerating') : stage === 'recovery' ? t(locale, 'walletRecoveryReady') : stage === 'challenge' ? t(locale, 'walletVerificationStarting') : stage === 'signing' ? t(locale, 'walletAwaitingSignature') : stage === 'verifying' ? t(locale, 'walletVerifying') : stage === 'loading' ? t(locale, 'loadingMerchant') : stage === 'creating' ? t(locale, 'creatingMerchant') : stage === 'done' && verified ? t(locale, 'verified') : '';

  return (
    <section className="pay-onboarding-panel" aria-labelledby="pay-onboarding-title">
      <div className="pay-panel-heading">
        <div><span className="pay-panel-kicker">{t(locale, 'merchant')}</span><h2 id="pay-onboarding-title">{t(locale, 'onboardingTitle')}</h2></div>
        {onClose && <button type="button" className="pay-icon-button" onClick={onClose} aria-label={t(locale, 'close')}><XCircle size={18} /></button>}
      </div>

      {stageLabel && <div className={`pay-onboarding-progress is-${stage}`} role="status" aria-live="polite"><span className="pay-onboarding-progress-dot" aria-hidden="true" />{stageLabel}</div>}

      {!merchant ? <div className="pay-onboarding-form">
        <label><span>{t(locale, 'businessName')}</span><input value={businessName} onChange={e => handleBusinessNameChange(e.target.value)} placeholder={t(locale, 'businessNamePlaceholder')} autoComplete="organization" disabled={busy} /></label>
        <label><span>{t(locale, 'businessSlug')}</span><input value={slug} onChange={e => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); }} placeholder={t(locale, 'businessSlugPlaceholder')} spellCheck={false} disabled={busy} aria-describedby="pay-merchant-slug-hint" /><small id="pay-merchant-slug-hint" className="pay-onboarding-field-hint">{t(locale, 'slugHint')}</small></label>
        <button type="button" className="pay-primary-action" onClick={() => void ensureMerchant()} disabled={busy}>{stage === 'creating' ? <Loader2 className="animate-spin" size={17} /> : <Store size={17} />} {t(locale, 'createMerchant')}</button>
        <button type="button" className="pay-secondary-action" onClick={() => void loadExisting()} disabled={busy}>{stage === 'loading' ? <Loader2 className="animate-spin" size={17} /> : null} {t(locale, 'checkExistingMerchant')}</button>
      </div> : <div className="pay-onboarding-state">
        <div className="pay-onboarding-success"><CheckCircle2 size={22} /><div><strong>{merchant.businessName}</strong><span>{t(locale, 'merchantId')}: {merchant.id}</span><small>{t(locale, 'status')}: {translateMerchantStatus(locale, merchant.status)}</small></div></div>
        <div className="pay-onboarding-wallet"><div className="pay-onboarding-wallet-icon"><Wallet size={20} /></div><div><strong>{t(locale, 'receiveWallet')}</strong><span title={walletAddress || undefined}>{walletAddress || t(locale, 'walletNotVerified')}</span>{verifiedAt ? <small>{t(locale, 'walletVerifiedAt')}: {new Date(verifiedAt).toLocaleString(locale)}</small> : null}</div><div className="pay-onboarding-wallet-actions">{verified ? <button type="button" className="pay-primary-action" disabled><ShieldCheck size={17} />{t(locale, 'verified')}</button> : <><button type="button" className="pay-primary-action" onClick={() => void createDedicatedWallet()} disabled={busy || merchant.status === 'closed' || merchant.status === 'suspended'}>{busy ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />} {t(locale, 'createDedicatedWallet')}</button><button type="button" className="pay-secondary-action" onClick={() => void startWalletVerification()} disabled={busy || merchant.status === 'closed' || merchant.status === 'suspended'}>{t(locale, 'useExistingWallet')}</button></>}</div></div>
        {verified && <div className="pay-onboarding-verified"><CheckCircle2 size={18} /><span>{t(locale, 'walletOwnershipVerified')}</span></div>}
        {merchantRefreshStale && <div className="pay-onboarding-stale" role="status" aria-live="polite"><span>{t(locale, 'merchantRefreshStale')}</span><button type="button" className="pay-secondary-action" onClick={() => void refreshMerchant()} disabled={refreshingMerchant}>{refreshingMerchant ? <Loader2 className="animate-spin" size={15} /> : null}{t(locale, 'retryMerchantRefresh')}</button></div>}
      </div>}

      {recoveryPhrase && (stage === 'recovery' || stage === 'generating-wallet' || (stage === 'error' && generatedWalletRef.current !== null)) && <div className="pay-onboarding-recovery" role="dialog" aria-modal="true" aria-labelledby="pay-recovery-title"><div className="pay-onboarding-recovery-head"><div><span className="pay-panel-kicker">{t(locale, 'dedicatedWallet')}</span><h3 id="pay-recovery-title">{t(locale, 'recoveryPhraseTitle')}</h3></div><button type="button" className="pay-icon-button" onClick={discardGeneratedWallet} disabled={busy} aria-label={t(locale, 'close')}><XCircle size={18} /></button></div><div className="pay-onboarding-recovery-warning"><ShieldCheck size={18} /><span>{t(locale, 'recoveryPhraseWarning')}</span></div><div className="pay-onboarding-generated-address"><span>{t(locale, 'generatedWalletAddress')}</span><code>{generatedWalletRef.current?.address || ''}</code></div><div className="pay-onboarding-word-count"><strong>{t(locale, 'recoveryPhraseLength')}</strong><label><input type="radio" name="pay-recovery-length" checked={wordCount === 12} onChange={() => { discardGeneratedWallet(); setWordCount(12); void createDedicatedWallet(12); }} disabled={busy || stage !== 'recovery'} />12 {t(locale, 'words')}</label><label><input type="radio" name="pay-recovery-length" checked={wordCount === 24} onChange={() => { discardGeneratedWallet(); setWordCount(24); void createDedicatedWallet(24); }} disabled={busy || stage !== 'recovery'} />24 {t(locale, 'words')}</label></div><button type="button" className="pay-secondary-action" onClick={() => setRecoveryVisible(value => !value)} disabled={busy}>{recoveryVisible ? t(locale, 'hideRecoveryPhrase') : t(locale, 'showRecoveryPhrase')}</button>{recoveryVisible && <div className="pay-recovery-words" dir="ltr" aria-label={t(locale, 'recoveryPhraseTitle')}>{recoveryPhrase.split(' ').map((word, index) => <span key={word + index}><b>{index + 1}</b>{word}</span>)}</div>}<div className="pay-onboarding-recovery-actions"><button type="button" className="pay-secondary-action" onClick={() => void copyRecoveryPhrase()} disabled={busy || !recoveryVisible}>{recoveryCopied ? t(locale, 'copied') : t(locale, 'copyRecoveryPhrase')}</button><label className="pay-recovery-confirm"><input type="checkbox" checked={recoverySaved} onChange={e => setRecoverySaved(e.target.checked)} disabled={busy || !recoveryVisible} /><span>{t(locale, 'recoveryPhraseSaved')}</span></label><button type="button" className="pay-primary-action" onClick={() => void confirmDedicatedWallet()} disabled={busy || !recoveryVisible || !recoverySaved}>{t(locale, 'continueAndVerifyWallet')}</button></div><small className="pay-onboarding-recovery-footnote">{t(locale, 'recoveryPhraseNeverStored')}</small></div>}
      {challenge && stage === 'signing' && !recoveryPhrase && <div className="pay-onboarding-challenge"><div className="pay-onboarding-challenge-head"><KeyRound size={17} /><strong>{t(locale, 'walletSignatureRequest')}</strong><button type="button" onClick={() => void copyMessage()} aria-label={t(locale, 'copy')} title={t(locale, 'copy')}><Copy size={15} /></button></div><pre>{challenge.message}</pre><small>{t(locale, 'signatureNotTransaction')}</small>{copied && <em>{t(locale, 'copied')}</em>}</div>}
      {error && <div className="pay-onboarding-error" role="alert"><XCircle size={18} /><span>{error}</span></div>}
    </section>
  );
}
