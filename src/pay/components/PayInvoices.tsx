import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, FilePlus2, Loader2, RefreshCw, Search, X, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payInvoiceService, type PayInvoice, type PayInvoiceFeePayer, type PayInvoiceLocale, type PayInvoiceStatus } from '../services/invoiceService';
import { invoicePayerT, invoiceStatusT, invoiceT } from './pay-invoices-i18n';
import './pay-invoices.css';

interface Props { locale: PayLocale; merchantId: string | null; }
const STATUSES: PayInvoiceStatus[] = ['draft','open','paid','partially_paid','overdue','void','refunded'];
const ASSETS: PayInvoice['asset'][] = ['SOL','USDC','USDT'];
const PAYERS: PayInvoiceFeePayer[] = ['merchant','customer'];
const LOCALES: PayInvoiceLocale[] = ['auto','fa-IR','en-US','ar','ru'];
interface Draft {
  invoiceNumber: string; customerLabel: string; title: string; description: string;
  amountAtomic: string; asset: PayInvoice['asset'] | ''; feePayer: PayInvoiceFeePayer;
  checkoutLocale: PayInvoiceLocale; dueAt: string;
}
const EMPTY_DRAFT: Draft = { invoiceNumber:'', customerLabel:'', title:'', description:'', amountAtomic:'', asset:'', feePayer:'merchant', checkoutLocale:'auto', dueAt:'' };

function formatDate(value: string | null, locale: PayLocale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale, { dateStyle:'medium', timeStyle:'short' }).format(date);
}
function short(value: string): string { return value.length > 18 ? value.slice(0,9) + '…' + value.slice(-7) : value; }

export default function PayInvoices({ locale, merchantId }: Props): React.ReactElement {
  const [rows,setRows]=useState<PayInvoice[]>([]);
  const [selected,setSelected]=useState<PayInvoice|null>(null);
  const [search,setSearch]=useState(''); const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<'unauthorized'|'forbidden'|'error'|null>(null);
  const [draft,setDraft]=useState<Draft>(EMPTY_DRAFT);
  const [creating,setCreating]=useState(false);
  const [formError,setFormError]=useState<'invalid'|'forbidden'|'conflict'|'error'|null>(null);
  const [created,setCreated]=useState(false);
  const [retryKey,setRetryKey]=useState('');

  const load=useCallback(async()=>{
    if(!merchantId){setRows([]);setLoading(false);return;}
    setLoading(true);setError(null);
    try{setRows(await payInvoiceService.list(merchantId,{search,status:status as PayInvoiceStatus||undefined,limit:100}));}
    catch(cause){if(cause instanceof PayHttpError&&cause.status===401)setError('unauthorized');else if(cause instanceof PayHttpError&&cause.status===403)setError('forbidden');else setError('error');}
    finally{setLoading(false);}
  },[merchantId,search,status]);
  useEffect(()=>{void load();},[load]);

  const update=<K extends keyof Draft>(key:K,value:Draft[K])=>{
    setDraft(current=>({...current,[key]:value})); setRetryKey(''); setCreated(false); setFormError(null);
  };
  const createInvoice=async(event:React.FormEvent)=>{
    event.preventDefault();setCreated(false);setFormError(null);
    const amount=draft.amountAtomic.trim();
    if(!merchantId||!draft.invoiceNumber.trim()||!draft.title.trim()||!/^\d{1,78}$/.test(amount)||BigInt(amount||'0')<=0n||!draft.asset){setFormError('invalid');return;}
    setCreating(true);
    const key=retryKey||crypto.randomUUID(); setRetryKey(key);
    try{
      await payInvoiceService.create({
        merchantId, invoiceNumber:draft.invoiceNumber, customerLabel:draft.customerLabel||null, title:draft.title,
        description:draft.description||null, amountAtomic:amount, asset:draft.asset, feePayer:draft.feePayer,
        checkoutLocale:draft.checkoutLocale, dueAt:draft.dueAt?new Date(draft.dueAt).toISOString():null
      },key);
      setDraft(EMPTY_DRAFT);setRetryKey('');setCreated(true);await load();
    }catch(cause){
      if(cause instanceof PayHttpError&&cause.status===403)setFormError('forbidden');
      else if(cause instanceof PayHttpError&&cause.status===409)setFormError('conflict');
      else if(cause instanceof PayHttpError&&cause.status===400)setFormError('invalid');
      else setFormError('error');
    }finally{setCreating(false);}
  };

  return <section className="pay-invoices" aria-label={invoiceT(locale,'title')}>
    <div className="pay-invoices-heading"><div><span className="pay-panel-kicker">{invoiceT(locale,'title')}</span><h2>{invoiceT(locale,'title')}</h2><p>{invoiceT(locale,'subtitle')}</p></div><button type="button" className="pay-secondary-action" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{invoiceT(locale,'refresh')}</button></div>

    <form className="pay-invoice-create" onSubmit={event=>void createInvoice(event)}>
      <div className="pay-invoice-create-head"><div><span className="pay-panel-kicker">{invoiceT(locale,'createTitle')}</span><h3>{invoiceT(locale,'createTitle')}</h3><p>{invoiceT(locale,'createDescription')}</p></div><FilePlus2 size={20} aria-hidden="true"/></div>
      <div className="pay-invoice-create-grid">
        <label><span>{invoiceT(locale,'invoiceNumber')}</span><input value={draft.invoiceNumber} onChange={e=>update('invoiceNumber',e.target.value)} maxLength={120} required/></label>
        <label><span>{invoiceT(locale,'titleField')}</span><input value={draft.title} onChange={e=>update('title',e.target.value)} maxLength={200} required/></label>
        <label><span>{invoiceT(locale,'customer')}</span><input value={draft.customerLabel} onChange={e=>update('customerLabel',e.target.value)} maxLength={160}/></label>
        <label><span>{invoiceT(locale,'amount')}</span><input value={draft.amountAtomic} onChange={e=>update('amountAtomic',e.target.value.replace(/\D/g,''))} inputMode="numeric" maxLength={78} required/></label>
        <label><span>{invoiceT(locale,'asset')}</span><select value={draft.asset} onChange={e=>update('asset',e.target.value as Draft['asset'])} required><option value="">{invoiceT(locale,'selectAsset')}</option>{ASSETS.map(asset=><option key={asset} value={asset}>{asset}</option>)}</select></label>
        <label><span>{invoiceT(locale,'feePayer')}</span><select value={draft.feePayer} onChange={e=>update('feePayer',e.target.value as PayInvoiceFeePayer)}>{PAYERS.map(p=><option key={p} value={p}>{invoicePayerT(locale,p)}</option>)}</select></label>
        <label><span>{invoiceT(locale,'checkoutLocale')}</span><select value={draft.checkoutLocale} onChange={e=>update('checkoutLocale',e.target.value as PayInvoiceLocale)}>{LOCALES.map(item=><option key={item} value={item}>{item==='auto'?invoiceT(locale,'autoLocale'):item}</option>)}</select></label>
        <label><span>{invoiceT(locale,'dueAt')}</span><input type="datetime-local" value={draft.dueAt} onChange={e=>update('dueAt',e.target.value)}/></label>
        <label className="pay-invoice-create-wide"><span>{invoiceT(locale,'description')}</span><textarea value={draft.description} onChange={e=>update('description',e.target.value)} maxLength={5000} rows={3}/></label>
      </div>
      {formError?<div className="pay-invoice-form-message is-error" role="alert"><XCircle size={17}/><span>{formError==='invalid'?invoiceT(locale,'createInvalid'):formError==='forbidden'?invoiceT(locale,'createForbidden'):formError==='conflict'?invoiceT(locale,'createConflict'):invoiceT(locale,'createFailed')}</span></div>:null}
      {created?<div className="pay-invoice-form-message is-success" role="status"><CheckCircle2 size={17}/><span>{invoiceT(locale,'created')}</span></div>:null}
      <div className="pay-invoice-create-actions"><button type="submit" className="pay-primary-action" disabled={creating||!merchantId}>{creating?<Loader2 className="animate-spin" size={17}/>:<FilePlus2 size={17}/>} {creating?invoiceT(locale,'creating'):invoiceT(locale,'createAction')}</button><span>{invoiceT(locale,'atomicHint')}</span></div>
    </form>

    <div className="pay-invoices-toolbar"><label className="pay-invoices-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} maxLength={120} placeholder={invoiceT(locale,'search')} aria-label={invoiceT(locale,'search')}/></label><select value={status} onChange={e=>setStatus(e.target.value)} aria-label={invoiceT(locale,'status')}><option value="">{invoiceT(locale,'all')}</option>{STATUSES.map(item=><option key={item} value={item}>{invoiceStatusT(locale,item)}</option>)}</select></div>
    {loading&&<div className="pay-invoices-state"><Loader2 className="animate-spin" size={22}/>{invoiceT(locale,'title')}</div>}
    {error&&!loading&&<div className="pay-invoices-state is-error" role="alert"><XCircle size={21}/><span>{error==='unauthorized'?invoiceT(locale,'unauthorized'):error==='forbidden'?invoiceT(locale,'forbidden'):invoiceT(locale,'loadFailed')}</span><button type="button" className="pay-secondary-action" onClick={()=>void load()}>{invoiceT(locale,'retry')}</button></div>}
    {!loading&&!error&&rows.length===0&&<div className="pay-invoices-state"><Clock3 size={22}/><span>{invoiceT(locale,'noData')}</span></div>}
    {!loading&&!error&&rows.length>0&&<div className="pay-invoices-table-wrap"><table className="pay-invoices-table"><thead><tr><th>{invoiceT(locale,'invoiceNumber')}</th><th>{invoiceT(locale,'customer')}</th><th>{invoiceT(locale,'amount')}</th><th>{invoiceT(locale,'status')}</th><th>{invoiceT(locale,'dueAt')}</th><th/></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.invoice_number}</strong><small>{short(row.id)}</small></td><td>{row.customer_label||'—'}<small>{row.title}</small></td><td><strong>{row.amount_atomic} {row.asset}</strong><small>{invoiceT(locale,'feePayer')}: {invoicePayerT(locale,row.fee_payer)}</small></td><td><span className={'pay-invoice-status status-'+row.status}><span aria-hidden="true"/>{invoiceStatusT(locale,row.status)}</span></td><td>{formatDate(row.due_at,locale)}</td><td><button type="button" className="pay-icon-button" onClick={()=>setSelected(row)} aria-label={invoiceT(locale,'details')} title={invoiceT(locale,'details')}><Search size={16}/></button></td></tr>)}</tbody></table></div>}
    {selected&&<div className="pay-invoice-detail" role="dialog" aria-modal="true" aria-label={invoiceT(locale,'details')}><div className="pay-invoice-detail-header"><div><span className="pay-panel-kicker">{invoiceT(locale,'details')}</span><h3>{selected.invoice_number}</h3></div><button type="button" className="pay-icon-button" onClick={()=>setSelected(null)} aria-label={invoiceT(locale,'close')}><X size={17}/></button></div><div className="pay-invoice-detail-grid"><Detail label={invoiceT(locale,'titleField')} value={selected.title}/><Detail label={invoiceT(locale,'customer')} value={selected.customer_label||'—'}/><Detail label={invoiceT(locale,'amount')} value={selected.amount_atomic+' '+selected.asset}/><Detail label={invoiceT(locale,'status')} value={invoiceStatusT(locale,selected.status)}/><Detail label={invoiceT(locale,'dueAt')} value={formatDate(selected.due_at,locale)}/><Detail label={invoiceT(locale,'createdAt')} value={formatDate(selected.created_at,locale)}/><Detail label={invoiceT(locale,'feePayer')} value={invoicePayerT(locale,selected.fee_payer)}/><Detail label={invoiceT(locale,'description')} value={selected.description||'—'}/></div></div>}
  </section>;
}
function Detail({label,value}:{label:string;value:string}):React.ReactElement{return <div className="pay-invoice-detail-cell"><span>{label}</span><strong>{value}</strong></div>;}
