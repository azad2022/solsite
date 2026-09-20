import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, Loader2, RefreshCw, Search, Users, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payCustomerService, type PayCustomer } from '../services/customerService';
import { customerT } from './pay-customers-i18n';
import './pay-customers.css';

interface Props {
  locale: PayLocale;
  merchantId: string | null;
}

function formatDate(value: string, locale: PayLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function shortWallet(value: string): string {
  return value.length > 20 ? value.slice(0, 10) + '…' + value.slice(-8) : value;
}

function accessError(error: unknown): 'unauthorized' | 'forbidden' | 'error' {
  if (error instanceof PayHttpError && error.status === 401) return 'unauthorized';
  if (error instanceof PayHttpError && error.status === 403) return 'forbidden';
  return 'error';
}

export default function PayCustomers({ locale, merchantId }: Props): React.ReactElement {
  const [rows, setRows] = useState<PayCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<'unauthorized' | 'forbidden' | 'error' | null>(null);

  const load = useCallback(async () => {
    if (!merchantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await payCustomerService.list(merchantId, { search, limit: 100 }));
      setStale(false);
    } catch (cause) {
      setError(accessError(cause));
      setStale(rows.length > 0);
    } finally {
      setLoading(false);
    }
  }, [merchantId, search, rows.length]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="pay-customers" aria-label={customerT(locale, 'title')}>
      <div className="pay-customers-heading">
        <div>
          <span className="pay-panel-kicker">{customerT(locale, 'title')}</span>
          <h2>{customerT(locale, 'title')}</h2>
          <p>{customerT(locale, 'subtitle')}</p>
        </div>
        <button type="button" className="pay-secondary-action" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />{customerT(locale, 'refresh')}
        </button>
      </div>

      {stale && !loading ? <div className="pay-customers-stale" role="status">{customerT(locale, 'stale')}</div> : null}

      <div className="pay-customers-search">
        <Search size={17} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value.slice(0, 120))}
          maxLength={120}
          placeholder={customerT(locale, 'search')}
          aria-label={customerT(locale, 'search')}
        />
      </div>

      {loading ? (
        <div className="pay-customers-state"><Loader2 className="animate-spin" size={22} />{customerT(locale, 'loading')}</div>
      ) : null}

      {error && !loading ? (
        <div className="pay-customers-state is-error" role="alert">
          <XCircle size={21} />
          <span>{error === 'unauthorized' ? customerT(locale, 'unauthorized') : error === 'forbidden' ? customerT(locale, 'forbidden') : customerT(locale, 'loadFailed')}</span>
          <button type="button" className="pay-secondary-action" onClick={() => void load()}>{customerT(locale, 'retry')}</button>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="pay-customers-state"><Clock3 size={22} />{customerT(locale, 'noData')}</div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="pay-customers-grid">
          {rows.map(row => (
            <article className="pay-customer-card" key={row.customer_wallet_address}>
              <div className="pay-customer-card-head">
                <div className="pay-customer-icon" aria-hidden="true"><Users size={18} /></div>
                <div className="pay-customer-identity">
                  <span>{customerT(locale, 'wallet')}</span>
                  <code title={row.customer_wallet_address}>{shortWallet(row.customer_wallet_address)}</code>
                </div>
              </div>
              <div className="pay-customer-stats">
                <div><span>{customerT(locale, 'intentCount')}</span><strong>{row.payment_intent_count.toLocaleString(locale === 'fa-IR' ? 'fa-IR' : locale)}</strong></div>
                <div><span>{customerT(locale, 'completedCount')}</span><strong>{row.completed_payment_count.toLocaleString(locale === 'fa-IR' ? 'fa-IR' : locale)}</strong></div>
              </div>
              <div className="pay-customer-dates">
                <div><span>{customerT(locale, 'firstSeen')}</span><strong>{formatDate(row.first_seen_at, locale)}</strong></div>
                <div><span>{customerT(locale, 'lastSeen')}</span><strong>{formatDate(row.last_seen_at, locale)}</strong></div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
