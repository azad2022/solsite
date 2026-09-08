import React, { useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, Wallet, XCircle } from 'lucide-react';
import { createMyMerchant, getMyMerchant, issueWalletChallenge, verifyWalletChallenge, type PayMerchant } from '../services/merchantOnboardingService';
import { encodeBase58 } from '../services/base58';

interface SolanaProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey?: { toBase58?: () => string } } | void>;
  signMessage: (message: Uint8Array, display?: 'utf8') => Promise<{ signature: Uint8Array } | Uint8Array>;
}

declare global {
  interface Window { solana?: SolanaProvider; }
}

interface Props { onClose?: () => void; onMerchantReady?: (merchant: PayMerchant) => void; }

type Stage = 'idle' | 'creating' | 'challenge' | 'signing' | 'verifying' | 'done' | 'error';

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function PayMerchantOnboarding({ onClose, onMerchantReady }: Props): React.ReactElement {
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
    setStage('challenge');
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
      setError(e instanceof Error ? e.message : 'بارگذاری Merchant انجام نشد.');
    }
  };

  const ensureMerchant = async () => {
    resetError();
    if (!businessName.trim()) { setStage('error'); setError('نام کسب‌وکار را وارد کنید.'); return null; }
    const finalSlug = (slug || slugify(businessName)).trim();
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(finalSlug)) { setStage('error'); setError('شناسه کسب‌وکار باید انگلیسی و بین ۳ تا ۶۰ کاراکتر باشد.'); return null; }
    setStage('creating');
    try {
      const created = await createMyMerchant({ businessName: businessName.trim(), slug: finalSlug });
      setMerchant(created);
      onMerchantReady?.(created);
      return created;
    } catch (e) {
      setStage('error'); setError(e instanceof Error ? e.message : 'ساخت Merchant انجام نشد.'); return null;
    }
  };

  const startWalletVerification = async () => {
    resetError();
    let activeMerchant = merchant;
    if (!activeMerchant) activeMerchant = await ensureMerchant();
    if (!activeMerchant) return;
    const provider = window.solana;
    if (!provider) { setStage('error'); setError('کیف پول Solana سازگار با مرورگر پیدا نشد.'); return; }

    setStage('challenge');
    try {
      const connection = await provider.connect();
      const connectedAddress = connection?.publicKey?.toBase58?.() || '';
      if (!connectedAddress) throw new Error('آدرس کیف پول دریافت نشد.');
      setWalletAddress(connectedAddress);
      const issued = await issueWalletChallenge(activeMerchant.id, connectedAddress);
      setChallenge(issued);

      setStage('signing');
      const signed = await provider.signMessage(new TextEncoder().encode(issued.message), 'utf8');
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      if (!(signature instanceof Uint8Array) || signature.length === 0) throw new Error('امضای کیف پول دریافت نشد.');

      setStage('verifying');
      const verified = await verifyWalletChallenge(activeMerchant.id, issued.id, connectedAddress, encodeBase58(signature));
      if (verified.verified !== true) throw new Error('مالکیت کیف پول تأیید نشد.');
      setStage('done');
      setChallenge(null);
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : 'تأیید کیف پول انجام نشد.');
    }
  };

  const copyMessage = async () => {
    if (!challenge?.message) return;
    await navigator.clipboard?.writeText(challenge.message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const busy = ['creating', 'challenge', 'signing', 'verifying'].includes(stage);
  const verified = stage === 'done' && !!merchant;

  return (
    <section className="pay-onboarding-panel" aria-labelledby="pay-onboarding-title">
      <div className="pay-panel-heading">
        <div><span className="pay-panel-kicker">Merchant</span><h2 id="pay-onboarding-title">راه‌اندازی دریافت پرداخت</h2></div>
        {onClose && <button type="button" className="pay-icon-button" onClick={onClose} aria-label="بستن"><XCircle size={18} /></button>}
      </div>

      {!merchant ? <div className="pay-onboarding-form">
        <label><span>نام کسب‌وکار</span><input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="مثلاً SolMint Store" autoComplete="organization" disabled={busy} /></label>
        <label><span>شناسه کسب‌وکار</span><input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} placeholder="solmint-store" spellCheck={false} disabled={busy} /></label>
        <button type="button" className="pay-primary-action" onClick={() => void ensureMerchant()} disabled={busy}>{stage === 'creating' ? <Loader2 className="animate-spin" size={17} /> : <StoreIcon />} ساخت Merchant</button>
        <button type="button" className="pay-secondary-action" onClick={() => void loadExisting()} disabled={busy}>بررسی Merchant موجود</button>
      </div> : <div className="pay-onboarding-state">
        <div className="pay-onboarding-success"><CheckCircle2 size={22} /><div><strong>{merchant.businessName}</strong><span>Merchant: {merchant.id}</span><small>وضعیت: {merchant.status}</small></div></div>
        <div className="pay-onboarding-wallet"><div className="pay-onboarding-wallet-icon"><Wallet size={20} /></div><div><strong>کیف پول دریافت</strong><span>{walletAddress || 'هنوز تأیید نشده است'}</span></div><button type="button" className="pay-primary-action" onClick={() => void startWalletVerification()} disabled={busy || merchant.status === 'closed' || merchant.status === 'suspended'}>{busy ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />} {stage === 'done' ? 'تأیید شد' : 'اتصال و تأیید کیف پول'}</button></div>
        {verified && <div className="pay-onboarding-verified"><CheckCircle2 size={18} /><span>مالکیت کیف پول با امضای یک‌بارمصرف تأیید شد.</span></div>}
      </div>}

      {challenge && stage === 'signing' && <div className="pay-onboarding-challenge"><div className="pay-onboarding-challenge-head"><KeyRound size={17} /><strong>درخواست امضای کیف پول</strong><button type="button" onClick={() => void copyMessage()} aria-label="کپی پیام"><Copy size={15} /></button></div><pre>{challenge.message}</pre><small>این پیام تراکنش مالی نیست و فقط برای اثبات مالکیت همین کیف پول صادر شده است.</small>{copied && <em>کپی شد</em>}</div>}
      {error && <div className="pay-onboarding-error"><XCircle size={18} /><span>{error}</span></div>}
    </section>
  );
}

function StoreIcon(): React.ReactElement { return <span aria-hidden="true" style={{ fontSize: 17 }}>◈</span>; }
