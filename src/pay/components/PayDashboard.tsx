import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, Store, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payDashboardService, type PayDashboardActivity } from '../services/dashboardService';
import type { PayMerchant } from '../services/merchantOnboardingService';
import type { PayTransaction, PayTransactionStatus } from '../services/transactionService';
import { translateTransactionStatus as ts } from './pay-transactions-i18n';
import { d } from './pay-dashboard-i18n';
import './pay-dashboard.css';

interface Props { locale: PayLocale; merchant: PayMerchant; onViewTransactions: () => void; }

const statusIcon = (status: PayTransactionStatus): React.ReactElement => {
  if (status === 'completed' || status === 'confirmed') return <CheckCircle2 size={15} />;
  if (status === 'failed' || status === 'expired' || status === 'wrong_token' || status === 'wrong_recipient') return <XCircle size={15} />;
  if (status === 'underpaid' || status === 'overpaid' || status === 'ambiguous' || status === 'duplicate') return <AlertTriangle size={15} />;
  return <Clock3 size={15} />;
};

function atomicToDisplay(value: string, decimals: number | null): string {
  if (!/^\d+$/.test(value)) return '—';
  const places = Number.isInteger(decimals) && (decimals as number) >= 0 ? decimals as number : 0;
  if (!places) return value;
  const padded = value.padStart(places + 1, '0');
  const whole = padded.slice(0, -places) || '0';
  const fraction = padded.slice(-places).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function short(value: string | null, head = 7, tail = 5): string {
  if (!value) return '—';
  return value.length <= head + tail + 3 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatDate(value: string, locale: PayLocale): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function merchantStatusLabel(locale: PayLocale, status: PayMerchant['status']): string {
  return d(locale, status);
}

export default function PayDashboard({ locale, merchant, onViewTransactions }: Props): React.ReactElement {
  const [activity, setActivity] = useState<PayDashboardActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setActivity(await payDashboardService.loadActivity(merchant.id));
    } catch (cause) {
      setError(cause instanceof PayHttpError && cause.status === 403 ? d(locale, 'forbidden') : cause instanceof PayHttpError && cause.status === 401 ? d(locale, 'unauthorized') : d(locale, 'loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [merchant.id, locale]);

  useEffect(() => { void load(); }, [load]);

  const transactions = activity?.transactions ?? [];

  return <section className="pay-dashboard" aria-label={d(locale, 'title')}>
    <div className="pay-dashboard-grid">
      <article className="pay-dashboard-card pay-dashboard-merchant">
        <div className="pay-dashboard-icon"><Store size={20} /></div>
        <div>
          <span>{d(locale, 'merchant')}</span>
          <h2>{merchant.businessName}</h2>
          <small>{merchant.slug}</small>
        </div>
        <div className={`pay-dashboard-status status-${merchant.status}`}><span aria-hidden="true" />{d(locale, 'merchantStatus')}: {merchantStatusLabel(locale, merchant.status)}</div>
      </article>

      <article className="pay-dashboard-card pay-dashboard-activity-summary">
        <div className="pay-dashboard-card-heading"><div><span>{d(locale, 'activity')}</span><strong>{d(locale, 'activityDesc')}</strong></div><Activity size={20} /></div>
        {activity && <small className="pay-dashboard-updated">{d(locale, 'updated')}: {formatDate(activity.loadedAt, locale)}</small>}
      </article>
    </div>

    <article className="pay-dashboard-panel">
      <div className="pay-dashboard-panel-heading">
        <div><span className="pay-panel-kicker">{d(locale, 'activity')}</span><h2>{d(locale, 'activity')}</h2></div>
        <button type="button" className="pay-secondary-action" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> {d(locale, 'refresh')}</button>
      </div>

      {loading && <div className="pay-dashboard-state"><Loader2 className="animate-spin" size={22} /><span>{d(locale, 'activity')}</span></div>}
      {error && !loading && <div className="pay-dashboard-state is-error" role="alert"><XCircle size={21} /><span>{error}</span><button type="button" className="pay-secondary-action" onClick={() => void load()}>{d(locale, 'retry')}</button></div>}
      {!loading && !error && transactions.length === 0 && <div className="pay-dashboard-state"><Clock3 size={22} /><span>{d(locale, 'noActivity')}</span></div>}
      {!loading && !error && transactions.length > 0 && <div className="pay-dashboard-activity-list">{transactions.map((transaction: PayTransaction) => <article key={transaction.id} className="pay-dashboard-activity-row">
        <div className={`pay-dashboard-activity-icon status-${transaction.status}`} aria-hidden="true">{statusIcon(transaction.status)}</div>
        <div className="pay-dashboard-activity-main"><strong>{short(transaction.id)}</strong><span>{transaction.external_order_id || d(locale, 'payment')} · {formatDate(transaction.created_at, locale)}</span></div>
        <div className="pay-dashboard-activity-amount"><strong>{atomicToDisplay(transaction.amount_atomic, transaction.token_decimals)} {transaction.asset}</strong><span>{ts(locale, transaction.status)}</span></div>
      </article>)}</div>}

      <div className="pay-dashboard-actions"><button type="button" className="pay-primary-action" onClick={onViewTransactions}>{d(locale, 'viewAll')}</button></div>
    </article>
  </section>;
}
