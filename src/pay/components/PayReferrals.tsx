import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, Copy, Loader2, RefreshCw, Users, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payReferralService, type PayReferralSnapshot } from '../services/referralService';
import { referralActiveT, referralT } from './pay-referrals-i18n';
import './pay-referrals.css';

interface Props { locale: PayLocale; }

function formatDate(value: string, locale: PayLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function short(value: string): string {
  return value.length > 18 ? value.slice(0, 9) + '…' + value.slice(-7) : value;
}

function accessError(error: unknown): 'unauthorized' | 'forbidden' | 'error' {
  if (error instanceof PayHttpError && error.status === 401) return 'unauthorized';
  if (error instanceof PayHttpError && error.status === 403) return 'forbidden';
  return 'error';
}

export default function PayReferrals({ locale }: Props): React.ReactElement {
  const [snapshot, setSnapshot] = useState<PayReferralSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<'unauthorized' | 'forbidden' | 'error' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await payReferralService.load());
      setStale(false);
    } catch (cause) {
      setError(accessError(cause));
      setStale(snapshot !== null);
    } finally {
      setLoading(false);
    }
  }, [snapshot]);

  useEffect(() => { void load(); }, []);

  const data = snapshot ?? { affiliates: [], referrals: [], commissions: [] };

  return (
    <section className="pay-referrals" aria-label={referralT(locale, 'title')}>
      <div className="pay-referrals-heading">
        <div>
          <span className="pay-panel-kicker">{referralT(locale, 'title')}</span>
          <h2>{referralT(locale, 'title')}</h2>
          <p>{referralT(locale, 'subtitle')}</p>
        </div>
        <button type="button" className="pay-secondary-action" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />{referralT(locale, 'refresh')}
        </button>
      </div>

      {stale && !loading ? <div className="pay-referrals-stale" role="status">{referralT(locale, 'stale')}</div> : null}

      {loading && <div className="pay-referrals-state"><Loader2 className="animate-spin" size={22} />{referralT(locale, 'title')}</div>}
      {error && !loading && !snapshot && (
        <div className="pay-referrals-state is-error" role="alert">
          <XCircle size={21} />
          <span>{error === 'unauthorized' ? referralT(locale, 'unauthorized') : error === 'forbidden' ? referralT(locale, 'forbidden') : referralT(locale, 'loadFailed')}</span>
          <button type="button" className="pay-secondary-action" onClick={() => void load()}>{referralT(locale, 'retry')}</button>
        </div>
      )}

      {!loading && !error && data.affiliates.length === 0 && data.referrals.length === 0 && data.commissions.length === 0 && (
        <div className="pay-referrals-state"><Clock3 size={22} /><span>{referralT(locale, 'noData')}</span></div>
      )}

      {!loading && (data.affiliates.length > 0 || data.referrals.length > 0 || data.commissions.length > 0) && (
        <>
          <div className="pay-referrals-grid">
            <section className="pay-referrals-panel">
              <div className="pay-referrals-panel-heading"><div><span className="pay-panel-kicker">{referralT(locale, 'affiliates')}</span><h3>{referralT(locale, 'affiliates')}</h3></div><Users size={19} /></div>
              {data.affiliates.length === 0 ? <div className="pay-referrals-mini-empty">{referralT(locale,'noData')}</div> : data.affiliates.map(item => (
                <article className="pay-referral-affiliate" key={item.id}>
                  <div><strong>{item.display_name}</strong><small>{referralT(locale,'referralCode')}: <code>{item.referral_code}</code></small></div>
                  <div><span>{referralT(locale,'rate')}</span><b>{item.commission_rate_bps} bps</b><small>{item.status}</small></div>
                </article>
              ))}
            </section>

            <section className="pay-referrals-panel">
              <div className="pay-referrals-panel-heading"><div><span className="pay-panel-kicker">{referralT(locale, 'referrals')}</span><h3>{referralT(locale, 'referrals')}</h3></div><Users size={19} /></div>
              {data.referrals.length === 0 ? <div className="pay-referrals-mini-empty">{referralT(locale,'noData')}</div> : (
                <div className="pay-referrals-table-wrap"><table className="pay-referrals-table"><thead><tr><th>{referralT(locale,'merchant')}</th><th>{referralT(locale,'referralCode')}</th><th>{referralT(locale,'status')}</th><th>{referralT(locale,'attributedAt')}</th></tr></thead><tbody>
                  {data.referrals.map(item => <tr key={item.id}><td><code>{short(item.merchant_id)}</code></td><td><code>{item.referral_code}</code></td><td>{referralActiveT(locale,item.active)}</td><td>{formatDate(item.attributed_at,locale)}</td></tr>)}
                </tbody></table></div>
              )}
            </section>
          </div>

          <section className="pay-referrals-panel">
            <div className="pay-referrals-panel-heading"><div><span className="pay-panel-kicker">{referralT(locale, 'commissions')}</span><h3>{referralT(locale, 'commissions')}</h3></div><span className="pay-referrals-count">{data.commissions.length}</span></div>
            {data.commissions.length === 0 ? <div className="pay-referrals-mini-empty">{referralT(locale,'noData')}</div> : (
              <div className="pay-referrals-table-wrap"><table className="pay-referrals-table"><thead><tr><th>{referralT(locale,'payment')}</th><th>{referralT(locale,'commissionAmount')}</th><th>{referralT(locale,'gatewayFee')}</th><th>{referralT(locale,'commissionStatus')}</th><th>{referralT(locale,'createdAt')}</th></tr></thead><tbody>
                {data.commissions.map(item => <tr key={item.id}><td><code>{short(item.payment_id)}</code></td><td><strong>{item.commission_atomic}</strong></td><td>{item.gross_gateway_fee_atomic}</td><td>{item.status}</td><td>{formatDate(item.created_at,locale)}</td></tr>)}
              </tbody></table></div>
            )}
          </section>

          <div className="pay-referrals-readonly">{referralT(locale, 'readonly')}</div>
        </>
      )}
    </section>
  );
}
