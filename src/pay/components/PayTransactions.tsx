import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payTransactionService, type PayTransaction, type PayTransactionDetail, type PayTransactionStatus } from '../services/transactionService';
import { translateTransactionStatus as ts, translateTransactions as t } from './pay-transactions-i18n';
import './pay-transactions.css';

interface Props { locale: PayLocale; merchantId: string | null; }
const statuses: PayTransactionStatus[] = ['created','pending','detected','verifying','confirmed','completed','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','ambiguous','failed','refunded','expired'];

function atomicToDisplay(value: string, decimals: number | null): string {
  if (!/^\d+$/.test(value)) return '—';
  const places = Math.max(0, Number.isInteger(decimals) ? (decimals as number) : 0);
  if (!places) return value;
  const padded = value.padStart(places + 1, '0');
  const whole = padded.slice(0, -places) || '0';
  const fraction = padded.slice(-places).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function short(value: string | null | undefined, head = 8, tail = 6): string {
  if (!value) return '—';
  return value.length <= head + tail + 3 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatDate(value: string, locale: PayLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function PayTransactions({ locale, merchantId }: Props): React.ReactElement {
  const [rows, setRows] = useState<PayTransaction[]>([]);
  const [selected, setSelected] = useState<PayTransactionDetail | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');

  const load = useCallback(async () => {
    if (!merchantId) { setRows([]); setLoading(false); return; }
    setLoading(true); setError('');
    try { setRows(await payTransactionService.list(merchantId, { status: status as PayTransactionStatus || undefined, search, limit: 100 })); }
    catch (cause) { setError(cause instanceof PayHttpError && cause.status === 403 ? t(locale, 'forbidden') : cause instanceof PayHttpError && cause.status === 401 ? t(locale, 'unauthorized') : t(locale, 'loadFailed')); }
    finally { setLoading(false); }
  }, [merchantId, locale, search, status]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true); setDetailError(''); setSelected(null);
    try { setSelected(await payTransactionService.get(id)); }
    catch (cause) { setDetailError(cause instanceof PayHttpError && cause.status === 403 ? t(locale, 'forbidden') : t(locale, 'loadFailed')); }
    finally { setDetailLoading(false); }
  };

  const empty = useMemo(() => !loading && !error && rows.length === 0, [loading, error, rows.length]);

  return <section className="pay-transactions" aria-label={t(locale, 'title')}>
    <div className="pay-transactions-toolbar">
      <label className="pay-transactions-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t(locale, 'search')} aria-label={t(locale, 'search')} maxLength={120} /></label>
      <select value={status} onChange={e => setStatus(e.target.value)} aria-label={t(locale, 'status')}><option value="">{t(locale, 'all')}</option>{statuses.map(item => <option key={item} value={item}>{ts(locale, item)}</option>)}</select>
      <button type="button" className="pay-secondary-action pay-transactions-refresh" onClick={() => void load()} disabled={loading || !merchantId}><RefreshCw size={16} /> {t(locale, 'refresh')}</button>
    </div>

    {loading && <div className="pay-transactions-state"><Loader2 className="animate-spin" size={22} /> <span>{t(locale, 'title')}</span></div>}
    {error && !loading && <div className="pay-transactions-state is-error" role="alert"><XCircle size={21} /><span>{error}</span><button type="button" className="pay-secondary-action" onClick={() => void load()}>{t(locale, 'retry')}</button></div>}
    {empty && <div className="pay-transactions-state"><Clock3 size={22} /><span>{t(locale, 'noData')}</span></div>}

    {!loading && !error && rows.length > 0 && <div className="pay-transactions-table-wrap"><table className="pay-transactions-table"><thead><tr><th>{t(locale, 'paymentId')}</th><th>{t(locale, 'amount')}</th><th>{t(locale, 'status')}</th><th>{t(locale, 'created')}</th><th /></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{short(row.id)}</strong><small>{short(row.external_order_id)}</small></td><td><strong>{atomicToDisplay(row.amount_atomic, row.token_decimals)} {row.asset}</strong><small>{t(locale, 'fee')}: {atomicToDisplay(row.fee_atomic, row.token_decimals)} {row.asset}</small></td><td><span className={`pay-transaction-status status-${row.status}`}><span aria-hidden="true" />{ts(locale, row.status)}</span></td><td><time dateTime={row.created_at}>{formatDate(row.created_at, locale)}</time></td><td><button type="button" className="pay-icon-button" onClick={() => void openDetail(row.id)} aria-label={t(locale, 'details')} title={t(locale, 'details')}>{locale === 'fa-IR' || locale === 'ar' ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</button></td></tr>)}</tbody></table></div>}

    {(detailLoading || detailError || selected) && <div className="pay-transaction-detail" role="dialog" aria-modal="true" aria-label={t(locale, 'details')}><div className="pay-transaction-detail-header"><div><h2>{t(locale, 'details')}</h2>{selected && <small>{short(selected.payment.id)}</small>}</div><button type="button" className="pay-icon-button" onClick={() => { setSelected(null); setDetailError(''); }} aria-label={t(locale, 'close')}>×</button></div>{detailLoading && <div className="pay-transactions-state"><Loader2 className="animate-spin" size={22} /></div>}{detailError && <div className="pay-transactions-state is-error"><XCircle size={21} /><span>{detailError}</span></div>}{selected && <div className="pay-transaction-detail-body"><div className="pay-detail-grid"><Detail label={t(locale, 'status')} value={ts(locale, selected.payment.status)} /><Detail label={t(locale, 'amount')} value={`${atomicToDisplay(selected.payment.amount_atomic, selected.payment.token_decimals)} ${selected.payment.asset}`} /><Detail label={t(locale, 'fee')} value={`${atomicToDisplay(selected.payment.fee_atomic, selected.payment.token_decimals)} ${selected.payment.asset}`} /><Detail label={t(locale, 'merchantSettlement')} value={selected.payment.merchant_settlement_atomic ? `${atomicToDisplay(selected.payment.merchant_settlement_atomic, selected.payment.token_decimals)} ${selected.payment.asset}` : '—'} /><Detail label={t(locale, 'orderId')} value={selected.payment.external_order_id || '—'} /><Detail label={t(locale, 'customerWallet')} value={short(selected.payment.customer_wallet_address, 10, 8)} /></div><div className="pay-detail-block"><strong>{t(locale, 'blockchain')}</strong>{selected.transactions.length === 0 ? <p>—</p> : selected.transactions.map((tx, index) => <div key={String(tx.id ?? index)} className="pay-detail-row"><span>{t(locale, 'signature')}</span><code>{short(typeof tx.signature === 'string' ? tx.signature : null, 10, 10)}</code>{typeof tx.signature === 'string' && <a href={`https://explorer.solana.com/tx/${encodeURIComponent(tx.signature)}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>}<span>{t(locale, 'verification')}</span><b>{typeof tx.verification_status === 'string' ? tx.verification_status : '—'}</b>{tx.verified_at && <time dateTime={String(tx.verified_at)}>{formatDate(String(tx.verified_at), locale)}</time>}</div>)}</div><div className="pay-detail-block"><strong>{t(locale, 'events')}</strong><div className="pay-event-list">{selected.events.length ? selected.events.map((event, index) => <div key={String(event.id ?? index)}><span>{String(event.event_type ?? '—')}</span><time>{typeof event.created_at === 'string' ? formatDate(event.created_at, locale) : '—'}</time></div>) : <p>—</p>}</div></div></div>}</div>}
  </section>;
}

function Detail({ label, value }: { label: string; value: string }): React.ReactElement { return <div className="pay-detail-cell"><span>{label}</span><strong>{value}</strong></div>; }
