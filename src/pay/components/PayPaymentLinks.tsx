import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, Link2, Loader2, RefreshCw, X, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payPaymentLinkService, type PayPaymentLink } from '../services/paymentLinkService';
import { paymentLinkT } from './pay-payment-links-i18n';
import './pay-payment-links.css';

interface Props { locale: PayLocale; merchantId: string | null; }

function formatDate(value: string | null, locale: PayLocale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function accessError(error: unknown): 'unauthorized'|'forbidden'|'error' {
  if (error instanceof PayHttpError && error.status === 401) return 'unauthorized';
  if (error instanceof PayHttpError && error.status === 403) return 'forbidden';
  return 'error';
}

export default function PayPaymentLinks({ locale, merchantId }: Props): React.ReactElement {
  const [rows,setRows]=useState<PayPaymentLink[]>([]);
  const [selected,setSelected]=useState<PayPaymentLink|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<'unauthorized'|'forbidden'|'error'|null>(null);

  const load=useCallback(async()=>{
    if(!merchantId){setRows([]);setLoading(false);return;}
    setLoading(true);setError(null);
    try{setRows(await payPaymentLinkService.list(merchantId,100));}
    catch(cause){setError(accessError(cause));}
    finally{setLoading(false);}
  },[merchantId]);

  useEffect(()=>{void load();},[load]);

  return <section className="pay-payment-links" aria-label={paymentLinkT(locale,'title')}>
    <div className="pay-payment-links-heading">
      <div><span className="pay-panel-kicker">{paymentLinkT(locale,'title')}</span><h2>{paymentLinkT(locale,'title')}</h2><p>{paymentLinkT(locale,'subtitle')}</p></div>
      <button type="button" className="pay-secondary-action" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{paymentLinkT(locale,'refresh')}</button>
    </div>

    {loading && <div className="pay-payment-links-state"><Loader2 className="animate-spin" size={22}/>{paymentLinkT(locale,'title')}</div>}
    {error && !loading && <div className="pay-payment-links-state is-error" role="alert"><XCircle size={21}/><span>{error==='unauthorized'?paymentLinkT(locale,'unauthorized'):error==='forbidden'?paymentLinkT(locale,'forbidden'):paymentLinkT(locale,'loadFailed')}</span><button type="button" className="pay-secondary-action" onClick={()=>void load()}>{paymentLinkT(locale,'retry')}</button></div>}
    {!loading && !error && rows.length===0 && <div className="pay-payment-links-state"><Clock3 size={22}/><span>{paymentLinkT(locale,'noData')}</span></div>}

    {!loading && !error && rows.length>0 && <div className="pay-payment-links-table-wrap"><table className="pay-payment-links-table"><thead><tr>
      <th>{paymentLinkT(locale,'slug')}</th><th>{paymentLinkT(locale,'linkTitle')}</th><th>{paymentLinkT(locale,'amount')}</th><th>{paymentLinkT(locale,'active')}</th><th>{paymentLinkT(locale,'expires')}</th><th/>
    </tr></thead><tbody>{rows.map(row=><tr key={row.id}>
      <td><code>{row.slug}</code></td>
      <td><strong>{row.title}</strong></td>
      <td>{row.fixed_amount_atomic === null ? '—' : row.fixed_amount_atomic} {row.asset || ''}</td>
      <td><span className={'pay-payment-link-status '+(row.is_active?'active':'inactive')}>{row.is_active?<Check size={13}/>:<X size={13}/>} {row.is_active?paymentLinkT(locale,'active'):paymentLinkT(locale,'inactive')}</span></td>
      <td>{formatDate(row.expires_at,locale)}</td>
      <td className="pay-payment-links-actions"><button type="button" className="pay-icon-button" onClick={()=>setSelected(row)} aria-label={paymentLinkT(locale,'details')} title={paymentLinkT(locale,'details')}><Link2 size={16}/></button></td>
    </tr>)}</tbody></table></div>}

    {selected && <div className="pay-payment-link-detail" role="dialog" aria-modal="true" aria-label={paymentLinkT(locale,'details')}>
      <div className="pay-payment-link-detail-header"><div><span className="pay-panel-kicker">{paymentLinkT(locale,'details')}</span><h3>{selected.title}</h3></div><button type="button" className="pay-icon-button" onClick={()=>setSelected(null)} aria-label={paymentLinkT(locale,'close')}><X size={17}/></button></div>
      <div className="pay-payment-link-detail-grid">
        <Detail label={paymentLinkT(locale,'slug')} value={selected.slug}/>
        <Detail label={paymentLinkT(locale,'linkTitle')} value={selected.title}/>
        <Detail label={paymentLinkT(locale,'amount')} value={(selected.fixed_amount_atomic===null?'—':selected.fixed_amount_atomic)+(selected.asset?' '+selected.asset:'')}/>
        <Detail label={paymentLinkT(locale,'feePayer')} value={selected.fee_payer || '—'}/>
        <Detail label={paymentLinkT(locale,'locale')} value={selected.checkout_locale}/>
        <Detail label={paymentLinkT(locale,'active')} value={selected.is_active?paymentLinkT(locale,'active'):paymentLinkT(locale,'inactive')}/>
        <Detail label={paymentLinkT(locale,'expires')} value={formatDate(selected.expires_at,locale)}/>
        <Detail label={paymentLinkT(locale,'created')} value={formatDate(selected.created_at,locale)}/>
      </div>
      <div className="pay-payment-links-readonly">{paymentLinkT(locale,'readOnly')}</div>
    </div>}
  </section>;
}
function Detail({label,value}:{label:string;value:string}):React.ReactElement{return <div className="pay-payment-link-detail-cell"><span>{label}</span><strong>{value}</strong></div>;}
