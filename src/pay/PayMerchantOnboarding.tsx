import React, { useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, LockKeyhole, WalletCards } from 'lucide-react';
import { PayHttpError } from './http';
import { createMyMerchant, issueWalletChallenge, verifyWalletChallenge, type PayMerchant } from './services/merchantOnboardingService';
import type { PayLocale } from './types';
import { directionFor, translate } from './i18n';

interface PayMerchantOnboardingProps {
  locale: PayLocale;
  onReady: (merchant: PayMerchant) => void;
}

type Step = 'merchant' | 'wallet' | 'ready';

type SolanaProvider = {
  publicKey?: { toString(): string } | null;
  connect?: () => Promise<{ publicKey?: { toString(): string } | null }>;
  signMessage?: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
  }
}

function errorText(error: unknown): string {
  if (error instanceof PayHttpError && error.status === 404) return 'سرویس Pay هنوز در محیط Production فعال نشده است.';
  if (error instanceof PayHttpError && error.status === 401) return 'ابتدا وارد حساب Solmint شوید.';
  if (error instanceof PayHttpError && error.status === 403) return 'این عملیات برای حساب فعلی مجاز نیست.';
  return error instanceof Error ? error.message : 'عملیات انجام نشد. دوباره تلاش کنید.';
}

function bytesToBase58(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  if (bytes.length === 0) return '';
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return `${'1'.repeat(leadingZeroes)}${digits.reverse().map((digit) => alphabet[digit]).join('')}`;
}

export function PayMerchantOnboarding({ locale, onReady }: PayMerchantOnboardingProps): React.ReactElement {
  const dir = directionFor(locale);
  const [step, setStep] = useState<Step>('merchant');
  const [businessName, setBusinessName] = useState('Solmint Pay');
  const [slug, setSlug] = useState('solmint-pay');
  const [walletAddress, setWalletAddress] = useState('');
  const [merchant, setMerchant] = useState<PayMerchant | null>(null);
  const [challengeId, setChallengeId] = useState('');
  const [challengeMessage, setChallengeMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const createMerchant = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const created = await createMyMerchant({ businessName: businessName.trim(), slug: slug.trim().toLowerCase() });
      setMerchant(created);
      setStep('wallet');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  const startWalletVerification = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (!merchant) throw new Error('Merchant آماده نیست.');
      const provider = window.solana;
      if (!provider) throw new Error('کیف پول سازگار با Solana در مرورگر پیدا نشد.');
      const connected = provider.publicKey ? provider : await provider.connect?.();
      const address = connected?.publicKey?.toString() || provider.publicKey?.toString() || '';
      if (!address) throw new Error('آدرس عمومی کیف پول دریافت نشد.');
      setWalletAddress(address);
      const challenge = await issueWalletChallenge(merchant.id, address);
      setChallengeId(challenge.id);
      setChallengeMessage(challenge.message);
      if (!provider.signMessage) throw new Error('این کیف پول قابلیت امضای پیام را در مرورگر ارائه نمی‌کند.');
      const signed = await provider.signMessage(new TextEncoder().encode(challenge.message), 'utf8');
      const signature = bytesToBase58(signed.signature);
      const verification = await verifyWalletChallenge(merchant.id, challenge.id, address, signature);
      if (verification.verified) {
        const readyMerchant: PayMerchant = { ...merchant, status: 'active' };
        setMerchant(readyMerchant);
        setStep('ready');
        onReady(readyMerchant);
      }
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pay-panel" dir={dir} aria-labelledby="pay-onboarding-title">
      <div className="pay-panel-heading">
        <div>
          <span className="pay-panel-kicker">SolMint Pay</span>
          <h2 id="pay-onboarding-title">فعال‌سازی پذیرنده</h2>
          <p>برای دریافت پرداخت، ابتدا Merchant را ثبت و مالکیت کیف پول دریافت‌کننده را اثبات کنید.</p>
        </div>
        <LockKeyhole size={18} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <article className={`rounded-2xl border p-4 ${step === 'merchant' ? 'border-pink-300 bg-pink-50' : 'border-slate-200 bg-white'}`}>
          <strong className="block text-sm text-slate-900">۱. Merchant</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-500">اطلاعات پذیرنده</span>
        </article>
        <article className={`rounded-2xl border p-4 ${step === 'wallet' ? 'border-pink-300 bg-pink-50' : 'border-slate-200 bg-white'}`}>
          <strong className="block text-sm text-slate-900">۲. Wallet</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-500">اثبات مالکیت کیف پول</span>
        </article>
        <article className={`rounded-2xl border p-4 ${step === 'ready' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <strong className="block text-sm text-slate-900">۳. Ready</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-500">Merchant آماده دریافت پرداخت</span>
        </article>
      </div>

      {step === 'merchant' ? (
        <form onSubmit={createMerchant} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold text-slate-700">نام کسب‌وکار</span><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} minLength={2} maxLength={120} required className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400" /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-slate-700">Slug</span><input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9][a-z0-9-]{2,59}" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400" /></label>
          <div className="flex items-end"><button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={17} /> : null}ثبت Merchant</button></div>
        </form>
      ) : null}

      {step === 'wallet' ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white"><WalletCards size={20} /></div><div><strong className="block text-base text-slate-900">اثبات مالکیت کیف پول دریافت‌کننده</strong><p className="mt-1 text-sm leading-6 text-slate-500">یک پیام یک‌بارمصرف از سرور دریافت می‌شود و در خود کیف پول امضا خواهد شد. کلید خصوصی از مرورگر خارج نمی‌شود.</p></div></div>
          {walletAddress ? <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 break-all">{walletAddress}</div> : null}
          {challengeId ? <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 break-all">Challenge: {challengeId}<br />{challengeMessage}</div> : null}
          <button type="button" onClick={() => void startWalletVerification()} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9945FF] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={17} /> : <WalletCards size={17} />} اتصال و تأیید کیف پول</button>
        </div>
      ) : null}

      {step === 'ready' ? <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={21} /><div><strong className="block text-emerald-900">Merchant آماده است</strong><p className="mt-1 text-sm leading-6 text-emerald-800">Wallet دریافت‌کننده با امضای واقعی تأیید شد. مرحله بعدی ایجاد Payment Intent و اجرای چرخه پرداخت است.</p></div></div></div> : null}

      {message ? <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><CircleAlert className="mt-0.5 shrink-0" size={17} /><span>{message}</span></div> : null}
    </section>
  );
}
