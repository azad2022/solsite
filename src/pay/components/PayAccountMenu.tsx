import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, LogOut, RefreshCw, Users, WalletCards, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import type { PaySessionUser } from '../services/sessionService';
import type { PayMerchant } from '../services/merchantOnboardingService';
import { getMerchantWalletBalance, type PayWalletBalanceAsset } from '../services/walletBalanceService';
import { signOutAllAuthSessions } from '../../utils/authClient';
import { payReferralService, type PayReferralStats } from '../services/referralService';
import { directionFor } from '../i18n';
import { accountMenuT } from './pay-account-menu-i18n';
import './pay-account-menu.css';

interface Props {
  locale: PayLocale;
  user: PaySessionUser;
  merchant: PayMerchant | null;
  title: string;
  subtitle: string;
}

function intlLocale(locale: PayLocale): string {
  return locale === 'fa-IR' ? 'fa-IR' : locale === 'ar' ? 'ar' : locale === 'ru' ? 'ru-RU' : 'en-US';
}

function formatAtomic(value: string, decimals: number, locale: PayLocale): string {
  try {
    const atomic = BigInt(value);
    const base = 10n ** BigInt(decimals);
    const whole = atomic / base;
    const remainder = atomic % base;
    const digits = decimals > 0 ? remainder.toString().padStart(decimals, '0').replace(/0+$/, '') : '';
    const raw = digits ? `${whole.toString()}.${digits}` : whole.toString();
    const [wholeText, fractionText] = raw.split('.');
    const grouped = new Intl.NumberFormat(intlLocale(locale), { useGrouping: true, maximumFractionDigits: 0 }).format(BigInt(wholeText));
    return fractionText ? `${grouped}.${fractionText}` : grouped;
  } catch {
    return value;
  }
}

function assetLabel(asset: PayWalletBalanceAsset): string {
  if (asset.asset === 'USDT') return 'USDT';
  if (asset.asset === 'USDC') return 'USDC';
  return 'SOL';
}

function shortenAddress(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 7)}…${value.slice(-6)}`;
}

export default function PayAccountMenu({ locale, user, merchant, title, subtitle }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getMerchantWalletBalance>> | null>(null);
  const [state, setState] = useState<'idle'|'loading'|'ready'|'unavailable'|'not-ready'>('idle');
  const [referralStats, setReferralStats] = useState<PayReferralStats | null>(null);
  const [referralState, setReferralState] = useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  const [copied, setCopied] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const direction = directionFor(locale);

  const loadReferralStats = async () => {
    setReferralState('loading');
    try {
      const result = await payReferralService.load(1);
      setReferralStats(result.stats);
      setReferralState('ready');
    } catch (error) {
      if (error instanceof PayHttpError && error.status === 404 && error.code === 'REFERRAL_NOT_CONFIGURED') {
        setReferralStats({
          clicks: '0',
          directSignups: '0',
          referredMerchants: '0',
          activeReferredMerchants: '0',
        });
        setReferralState('ready');
        return;
      }
      setReferralStats(null);
      setReferralState('unavailable');
    }
  };

  const loadBalance = async () => {
    if (!merchant?.id || loading) return;
    setLoading(true);
    setState('loading');
    try {
      const result = await getMerchantWalletBalance(merchant.id);
      setSnapshot(result);
      setState('ready');
    } catch (error) {
      setState(error instanceof PayHttpError && error.status === 409 ? 'not-ready' : 'unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadBalance();
    void loadReferralStats();
  }, [open, merchant?.id]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const copyAddress = async () => {
    if (!snapshot?.walletAddress || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(snapshot.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await signOutAllAuthSessions();
    } finally {
      window.location.assign('/');
    }
  };

  const balancesByAsset = new Map(snapshot?.assets.map(item => [item.asset, item]) || []);

  return (
    <div ref={rootRef} className="pay-account-control">
      <button
        type="button"
        className="pay-account-chip pay-account-trigger"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={accountMenuT(locale, 'accountMenu')}
      >
        <span className="pay-account-avatar pay-account-wallet-avatar" aria-hidden="true"><WalletCards size={18} strokeWidth={2.2} /></span>
        <span className="pay-account-copy"><strong>{title}</strong><small>{subtitle}</small></span>
      </button>

      {open ? (
        <div className="pay-account-menu" role="dialog" aria-label={accountMenuT(locale, 'accountMenu')} dir={direction}>
          <div className="pay-account-menu-head">
            <div className="pay-account-menu-user">
              <div className="pay-account-menu-avatar" aria-hidden="true"><WalletCards size={20} /></div>
              <div>
                <strong>{title}</strong>
                <span>{user.email || user.username || subtitle}</span>
              </div>
            </div>
            <button type="button" className="pay-account-menu-close" onClick={() => setOpen(false)} aria-label={accountMenuT(locale, 'close')}>
              <XCircle size={17} />
            </button>
          </div>

          <div className="pay-account-referral-summary" aria-label={accountMenuT(locale, 'directReferrals')}>
            <div className="pay-account-referral-icon" aria-hidden="true"><Users size={16} /></div>
            <div className="pay-account-referral-copy">
              <span>{accountMenuT(locale, 'directReferrals')}</span>
              <small>{accountMenuT(locale, referralState === 'loading' ? 'loadingReferralStats' : referralState === 'unavailable' ? 'referralStatsUnavailable' : 'directReferralsDescription')}</small>
            </div>
            <strong>{referralState === 'ready' && referralStats ? referralStats.directSignups : referralState === 'loading' ? '…' : '—'}</strong>
          </div>

          <div className="pay-account-menu-wallet">
            <div className="pay-account-menu-section-head">
              <div><span>{accountMenuT(locale, 'walletBalance')}</span><small>{accountMenuT(locale, 'walletBalanceSource')}</small></div>
              <button type="button" className="pay-account-refresh" onClick={() => void loadBalance()} disabled={loading || !merchant?.id} aria-label={accountMenuT(locale, 'refreshBalance')}>
                <RefreshCw size={15} className={loading ? 'pay-spin' : undefined} />
              </button>
            </div>

            {state === 'ready' && snapshot ? (
              <>
                <div className="pay-account-balance-grid">
                  {(['SOL', 'USDT', 'USDC'] as const).map(asset => {
                    const item = balancesByAsset.get(asset);
                    if (!item) return null;
                    return (
                      <div key={asset} className="pay-account-balance-card">
                        <div className="pay-account-balance-symbol">{assetLabel(item)}</div>
                        <strong>{formatAtomic(item.balanceAtomic, item.decimals, locale)}</strong>
                        <span>{asset === 'SOL' ? accountMenuT(locale, 'solana') : accountMenuT(locale, 'stablecoin')}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="pay-account-wallet-row">
                  <div>
                    <span>{accountMenuT(locale, 'walletAddress')}</span>
                    <code dir="ltr">{shortenAddress(snapshot.walletAddress)}</code>
                  </div>
                  <button type="button" className="pay-account-copy" onClick={() => void copyAddress()} aria-label={accountMenuT(locale, 'copyAddress')}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copied ? accountMenuT(locale, 'copied') : accountMenuT(locale, 'copyAddress')}</span>
                  </button>
                </div>
                <div className="pay-account-observed">{accountMenuT(locale, 'observedAt')}: {new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.observedAt))}</div>
              </>
            ) : loading ? (
              <div className="pay-account-state"><RefreshCw size={18} className="pay-spin" /><span>{accountMenuT(locale, 'loadingBalance')}</span></div>
            ) : state === 'not-ready' || !merchant?.receivingWallet ? (
              <div className="pay-account-state"><WalletCards size={18} /><span>{accountMenuT(locale, 'walletNotConfigured')}</span></div>
            ) : (
              <div className="pay-account-state is-error"><XCircle size={18} /><span>{accountMenuT(locale, 'balanceUnavailable')}</span></div>
            )}
          </div>

          <div className="pay-account-menu-footer">
            <button type="button" className="pay-account-logout" onClick={() => void handleLogout()} disabled={logoutBusy}>
              {logoutBusy ? <RefreshCw size={16} className="pay-spin" /> : <LogOut size={16} />}
              <span>{logoutBusy ? accountMenuT(locale, 'loggingOut') : accountMenuT(locale, 'logout')}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
