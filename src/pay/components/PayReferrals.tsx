import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  CopyCheck,
  Link2,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Store,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import type { PayCommission, PayReferralDashboard, PayReferralEarning } from '../services/referralService';
import { payReferralService } from '../services/referralService';
import {
  referralActiveT,
  referralAffiliateStatusT,
  referralCommissionStatusT,
  referralT,
} from './pay-referrals-i18n';
import './pay-referrals.css';

interface Props { locale: PayLocale; }

type LoadError = 'unauthorized' | 'forbidden' | 'error';
type CopyState = 'idle' | 'copied' | 'failed';

function formatDate(value: string, locale: PayLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function short(value: string): string {
  return value.length > 18 ? value.slice(0, 9) + '…' + value.slice(-7) : value;
}

function formatCount(value: string, locale: PayLocale): string {
  try {
    return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale).format(BigInt(value));
  } catch {
    return value;
  }
}

function formatAtomicAmount(value: string, decimals: number, locale: PayLocale): string {
  if (!/^\d+$/.test(value) || decimals < 0 || decimals > 18) return value;
  try {
    const atomic = BigInt(value);
    const divisor = 10n ** BigInt(decimals);
    const whole = atomic / divisor;
    const fraction = atomic % divisor;
    const wholeText = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale, { useGrouping: true }).format(whole);

    if (decimals === 0 || fraction === 0n) return wholeText;

    const fractionText = fraction.toString().padStart(decimals, '0');
    const localizedFraction = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale, {
      useGrouping: false,
      minimumIntegerDigits: decimals,
    }).format(BigInt(fractionText));
    const decimalSeparator = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale)
      .formatToParts(1.1)
      .find((part) => part.type === 'decimal')?.value || '.';

    return wholeText + decimalSeparator + localizedFraction;
  } catch {
    return value;
  }
}

function bpsPercent(value: number): string {
  if (!Number.isInteger(value) || value < 0) return '—';
  const whole = Math.floor(value / 100);
  const fraction = value % 100;
  return fraction === 0 ? whole + '%' : whole + '.' + String(fraction).padStart(2, '0') + '%';
}

function accessError(error: unknown): LoadError {
  if (error instanceof PayHttpError && error.status === 401) return 'unauthorized';
  if (error instanceof PayHttpError && error.status === 403) return 'forbidden';
  return 'error';
}

function referralUrl(code: string): string {
  return window.location.origin + '/r/' + encodeURIComponent(code);
}

function statLabel(icon: React.ReactNode, label: string, value: string): React.ReactElement {
  return (
    <article className="pay-referrals-stat">
      <span className="pay-referrals-stat-icon" aria-hidden="true">{icon}</span>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

function earningAmount(earning: PayReferralEarning, field: keyof PayReferralEarning, locale: PayLocale): string {
  return formatAtomicAmount(String(earning[field]), earning.token_decimals, locale);
}

function EarningCard({ earning, locale }: { earning: PayReferralEarning; locale: PayLocale }): React.ReactElement {
  return (
    <article className="pay-referrals-earning">
      <div className="pay-referrals-earning-head">
        <div>
          <span className="pay-panel-kicker">{referralT(locale, 'earnings')}</span>
          <h3>{earning.asset}</h3>
        </div>
        <span className="pay-referrals-asset-badge">{earning.asset}</span>
      </div>
      <div className="pay-referrals-earning-main">
        <span>{referralT(locale, 'commission')}</span>
        <strong dir="ltr">{earningAmount(earning, 'commission_atomic', locale)}</strong>
      </div>
      <div className="pay-referrals-earning-grid">
        <div><span>{referralT(locale, 'gatewayRevenue')}</span><b dir="ltr">{earningAmount(earning, 'gross_gateway_fee_atomic', locale)}</b></div>
        <div><span>{referralT(locale, 'pending')}</span><b dir="ltr">{earningAmount(earning, 'pending_commission_atomic', locale)}</b></div>
        <div><span>{referralT(locale, 'approved')}</span><b dir="ltr">{earningAmount(earning, 'approved_commission_atomic', locale)}</b></div>
        <div><span>{referralT(locale, 'paid')}</span><b dir="ltr">{earningAmount(earning, 'paid_commission_atomic', locale)}</b></div>
        <div><span>{referralT(locale, 'reversed')}</span><b dir="ltr">{earningAmount(earning, 'reversed_commission_atomic', locale)}</b></div>
      </div>
    </article>
  );
}

function CommissionStatus({ commission, locale }: { commission: PayCommission; locale: PayLocale }): React.ReactElement {
  const statusClass = commission.status === 'paid'
    ? 'is-paid'
    : commission.status === 'approved'
      ? 'is-approved'
      : commission.status === 'void'
        ? 'is-void'
        : 'is-pending';

  return <span className={'pay-referrals-status ' + statusClass}>{referralCommissionStatusT(locale, commission)}</span>;
}

export default function PayReferrals({ locale }: Props): React.ReactElement {
  const [dashboard, setDashboard] = useState<PayReferralDashboard | null>(null);
  const dashboardRef = useRef<PayReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<LoadError | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await payReferralService.load();
      dashboardRef.current = next;
      setDashboard(next);
      setStale(false);
    } catch (cause) {
      setError(accessError(cause));
      setStale(dashboardRef.current !== null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const link = useMemo(
    () => dashboard ? referralUrl(dashboard.affiliate.referral_code) : '',
    [dashboard],
  );

  const copyReferralLink = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2500);
  }, [link]);

  const data = dashboard;
  const hasData = Boolean(data && (
    data.stats.clicks !== '0' ||
    data.stats.directSignups !== '0' ||
    data.stats.referredMerchants !== '0' ||
    data.earnings_by_asset.length > 0 ||
    data.referrals.length > 0 ||
    data.commissions.length > 0
  ));

  return (
    <section className="pay-referrals" aria-label={referralT(locale, 'title')}>
      <div className="pay-referrals-heading">
        <div>
          <span className="pay-panel-kicker">{referralT(locale, 'title')}</span>
          <h2>{referralT(locale, 'title')}</h2>
          <p>{referralT(locale, 'subtitle')}</p>
        </div>
        <button type="button" className="pay-secondary-action" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />{referralT(locale, 'refresh')}
        </button>
      </div>

      {stale && !loading ? <div className="pay-referrals-stale" role="status">{referralT(locale, 'stale')}</div> : null}

      {loading && !data ? (
        <div className="pay-referrals-state"><Loader2 className="animate-spin" size={22} aria-hidden="true" /><span>{referralT(locale, 'title')}</span></div>
      ) : null}

      {error && !loading && !data ? (
        <div className="pay-referrals-state is-error" role="alert">
          <XCircle size={21} aria-hidden="true" />
          <span>{error === 'unauthorized' ? referralT(locale, 'unauthorized') : error === 'forbidden' ? referralT(locale, 'forbidden') : referralT(locale, 'loadFailed')}</span>
          <button type="button" className="pay-secondary-action" onClick={() => void load()}>{referralT(locale, 'retry')}</button>
        </div>
      ) : null}

      {data && (
        <>
          <section className="pay-referrals-promo" aria-labelledby="pay-referrals-promo-title">
            <div className="pay-referrals-promo-copy">
              <span className="pay-panel-kicker">{referralT(locale, 'promoKicker')}</span>
              <h3 id="pay-referrals-promo-title">{referralT(locale, 'promoTitle')}</h3>
              <p>{referralT(locale, 'promoDescription')}</p>
            </div>
            <div className="pay-referrals-video-shell">
              <video
                className="pay-referrals-video"
                controls
                playsInline
                preload="metadata"
                src="/assets/pay-referral-promo.mp4"
                aria-label={referralT(locale, 'promoTitle')}
              />
            </div>
          </section>

          <section className="pay-referrals-link-card">
            <div className="pay-referrals-link-icon" aria-hidden="true"><Link2 size={22} /></div>
            <div className="pay-referrals-link-copy">
              <span className="pay-panel-kicker">{referralT(locale, 'referralLink')}</span>
              <strong dir="ltr">{link}</strong>
              <small>{bpsPercent(data.affiliate.commission_rate_bps)} · {referralAffiliateStatusT(locale, data.affiliate.status)}</small>
            </div>
            <button type="button" className="pay-primary-action" onClick={() => void copyReferralLink()} aria-label={referralT(locale, 'copyLink')}>
              {copyState === 'copied' ? <CopyCheck size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
              {copyState === 'copied' ? referralT(locale, 'copied') : referralT(locale, 'copyLink')}
            </button>
          </section>

          {copyState === 'failed' ? <div className="pay-referrals-copy-error" role="status">{referralT(locale, 'copyFailed')}</div> : null}

          <div className="pay-referrals-stats">
            {statLabel(<MousePointerClick size={19} />, referralT(locale, 'clicks'), formatCount(data.stats.clicks, locale))}
            {statLabel(<UserPlus size={19} />, referralT(locale, 'directSignups'), formatCount(data.stats.directSignups, locale))}
            {statLabel(<Store size={19} />, referralT(locale, 'referredMerchants'), formatCount(data.stats.referredMerchants, locale))}
            {statLabel(<Users size={19} />, referralT(locale, 'activeMerchants'), formatCount(data.stats.activeReferredMerchants, locale))}
          </div>

          <section className="pay-referrals-panel">
            <div className="pay-referrals-panel-heading">
              <div><span className="pay-panel-kicker">{referralT(locale, 'earnings')}</span><h3>{referralT(locale, 'earnings')}</h3></div>
              <CircleDollarSign size={19} aria-hidden="true" />
            </div>
            {data.earnings_by_asset.length === 0
              ? <div className="pay-referrals-mini-empty">{referralT(locale, 'noEarnings')}</div>
              : <div className="pay-referrals-earnings-grid">{data.earnings_by_asset.map(item => <EarningCard key={item.asset} earning={item} locale={locale} />)}</div>}
          </section>

          <div className="pay-referrals-grid">
            <section className="pay-referrals-panel">
              <div className="pay-referrals-panel-heading">
                <div><span className="pay-panel-kicker">{referralT(locale, 'referredAccounts')}</span><h3>{referralT(locale, 'referredAccounts')}</h3></div>
                <Users size={19} aria-hidden="true" />
              </div>
              {data.stats.directSignups === '0'
                ? <div className="pay-referrals-mini-empty">{referralT(locale, 'noReferrals')}</div>
                : <div className="pay-referrals-direct-summary"><strong>{formatCount(data.stats.directSignups, locale)}</strong><span>{referralT(locale, 'referredAccounts')}</span></div>}
              <div className="pay-referrals-meta-note">{referralT(locale, 'readonly')}</div>
            </section>

            <section className="pay-referrals-panel">
              <div className="pay-referrals-panel-heading">
                <div><span className="pay-panel-kicker">{referralT(locale, 'merchants')}</span><h3>{referralT(locale, 'merchants')}</h3></div>
                <Store size={19} aria-hidden="true" />
              </div>
              {data.referrals.length === 0
                ? <div className="pay-referrals-mini-empty">{referralT(locale, 'noReferrals')}</div>
                : (
                  <div className="pay-referrals-table-wrap">
                    <table className="pay-referrals-table">
                      <thead><tr>
                        <th>{referralT(locale, 'merchant')}</th>
                        <th>{referralT(locale, 'referralCode')}</th>
                        <th>{referralT(locale, 'status')}</th>
                        <th>{referralT(locale, 'attributedAt')}</th>
                      </tr></thead>
                      <tbody>{data.referrals.map(item => (
                        <tr key={item.id}>
                          <td data-label={referralT(locale, 'merchant')}><code>{short(item.merchant_id)}</code></td>
                          <td data-label={referralT(locale, 'referralCode')}><code>{item.referral_code}</code></td>
                          <td data-label={referralT(locale, 'status')}>{referralActiveT(locale, item.active)}</td>
                          <td data-label={referralT(locale, 'attributedAt')}>{formatDate(item.attributed_at, locale)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
            </section>
          </div>

          <section className="pay-referrals-panel">
            <div className="pay-referrals-panel-heading">
              <div><span className="pay-panel-kicker">{referralT(locale, 'paymentHistory')}</span><h3>{referralT(locale, 'paymentHistory')}</h3></div>
              <span className="pay-referrals-count">{formatCount(String(data.commissions.length), locale)}</span>
            </div>
            {data.commissions.length === 0
              ? <div className="pay-referrals-mini-empty">{referralT(locale, 'noCommissions')}</div>
              : (
                <div className="pay-referrals-table-wrap">
                  <table className="pay-referrals-table">
                    <thead><tr>
                      <th>{referralT(locale, 'payment')}</th>
                      <th>{referralT(locale, 'commissionAmount')}</th>
                      <th>{referralT(locale, 'gatewayRevenue')}</th>
                      <th>{referralT(locale, 'status')}</th>
                      <th>{referralT(locale, 'createdAt')}</th>
                    </tr></thead>
                    <tbody>{data.commissions.map(item => (
                      <tr key={item.id}>
                        <td data-label={referralT(locale, 'payment')}><code>{short(item.payment_id)}</code></td>
                        <td data-label={referralT(locale, 'commissionAmount')}><strong dir="ltr">{formatAtomicAmount(item.commission_atomic, item.token_decimals, locale)} {item.asset}</strong></td>
                        <td data-label={referralT(locale, 'gatewayRevenue')}><span dir="ltr">{formatAtomicAmount(item.gross_gateway_fee_atomic, item.token_decimals, locale)} {item.asset}</span></td>
                        <td data-label={referralT(locale, 'status')}><CommissionStatus commission={item} locale={locale} /></td>
                        <td data-label={referralT(locale, 'createdAt')}>{formatDate(item.created_at, locale)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
          </section>

          {!hasData ? (
            <div className="pay-referrals-state is-compact">
              <Clock3 size={20} aria-hidden="true" />
              <span>{referralT(locale, 'noData')}</span>
            </div>
          ) : null}

          <div className="pay-referrals-readonly">
            <CheckCircle2 size={16} aria-hidden="true" />{referralT(locale, 'readonly')}
          </div>
        </>
      )}
    </section>
  );
}
