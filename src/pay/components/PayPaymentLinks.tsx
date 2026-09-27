import React, { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Clipboard, Clock3, ExternalLink, FilePlus2, Link2, Loader2, RefreshCw, X, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payPaymentLinkService, type PayPaymentLink, type CreatePayPaymentLinkInput } from '../services/paymentLinkService';
import { paymentLinkT } from './pay-payment-links-i18n';
import './pay-payment-links.css';

interface Props { locale: PayLocale; merchantId: string | null; }

const ASSETS: CreatePayPaymentLinkInput['asset'][] = ['SOL', 'USDC', 'USDT'];
const PAYERS: CreatePayPaymentLinkInput['feePayer'][] = ['merchant', 'customer'];
const LOCALES: CreatePayPaymentLinkInput['checkoutLocale'][] = ['auto', 'fa-IR', 'en-US', 'ar', 'ru'];
const EMPTY_DRAFT: CreatePayPaymentLinkInput = {
  merchantId: '', slug: '', title: '', description: '', fixedAmountAtomic: '',
  asset: 'USDC', feePayer: 'merchant', checkoutLocale: 'auto', expiresAt: null,
};

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
function publicUrl(slug: string): string {
  return window.location.origin + '/pay/link/' + encodeURIComponent(slug);
}

export default function PayPaymentLinks({ locale, merchantId }: Props): React.ReactElement {
  const [rows, setRows] = useState<PayPaymentLink[]>([]);
  const [selected, setSelected] = useState<PayPaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'unauthorized'|'forbidden'|'error'|null>(null);
  const [draft, setDraft] = useState<CreatePayPaymentLinkInput>({ ...EMPTY_DRAFT, merchantId: merchantId || '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<'invalid'|'forbidden'|'conflict'|'error'|null>(null);
  const [created, setCreated] = useState<PayPaymentLink | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!merchantId) { setRows([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setRows(await payPaymentLinkService.list(merchantId, 100)); }
    catch (cause) { setError(accessError(cause)); }
    finally { setLoading(false); }
  }, [merchantId]);

  useEffect(() => {
    setDraft(current => ({ ...current, merchantId: merchantId || '' }));
  }, [merchantId]);
  useEffect(() => { void load(); }, [load]);

  const update = <K extends keyof CreatePayPaymentLinkInput>(key: K, value: CreatePayPaymentLinkInput[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setFormError(null); setCreated(null); setCopied(false);
  };

  const createLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null); setCreated(null); setCopied(false);
    const amount = draft.fixedAmountAtomic.trim();
    const slug = draft.slug.trim().toLowerCase();
    if (!merchantId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 120
      || !draft.title.trim() || draft.title.trim().length > 200
      || (draft.description?.length || 0) > 5000
      || !/^\d{1,78}$/.test(amount) || BigInt(amount || '0') <= 0n) {
      setFormError('invalid'); return;
    }
    setCreating(true);
    try {
      const result = await payPaymentLinkService.create({ ...draft, merchantId, slug, fixedAmountAtomic: amount }, crypto.randomUUID());
      setCreated(result);
      setDraft({ ...EMPTY_DRAFT, merchantId });
      await load();
    } catch (cause) {
      if (cause instanceof PayHttpError && cause.status === 403) setFormError('forbidden');
      else if (cause instanceof PayHttpError && cause.status === 409) setFormError('conflict');
      else if (cause instanceof PayHttpError && cause.status === 400) setFormError('invalid');
      else setFormError('error');
    } finally { setCreating(false); }
  };

  const copyCreated = async () => {
    if (!created || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(publicUrl(created.slug));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setCopied(false); }
  };

  return <section className="pay-payment-links" aria-label={paymentLinkT(locale, 'title')}>
    <div className="pay-payment-links-heading">
      <div><span className="pay-panel-kicker">{paymentLinkT(locale, 'title')}</span><h2>{paymentLinkT(locale, 'title')}</h2><p>{paymentLinkT(locale, 'subtitle')}</p></div>
      <button type="button" className="pay-secondary-action" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/>{paymentLinkT(locale,'refresh')}</button>
    </div>

    <form className="pay-payment-link-create" onSubmit={event => void createLink(event)}>
      <div className="pay-payment-link-create-head"><div><span className="pay-panel-kicker">{paymentLinkT(locale,'createTitle')}</span><h3>{paymentLinkT(locale,'createTitle')}</h3><p>{paymentLinkT(locale,'createDescription')}</p></div><FilePlus2 size={20} aria-hidden="true"/></div>
      <div className="pay-payment-link-create-grid">
        <label><span>{paymentLinkT(locale,'slug')}</span><input value={draft.slug} onChange={e=>update('slug',e.target.value.toLowerCase())} maxLength={120} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="solmint-store" required/></label>
        <label><span>{paymentLinkT(locale,'linkTitle')}</span><input value={draft.title} onChange={e=>update('title',e.target.value)} maxLength={200} required/></label>
        <label><span>{paymentLinkT(locale,'amount')}</span><input value={draft.fixedAmountAtomic} onChange={e=>update('fixedAmountAtomic',e.target.value.replace(/\D/g,''))} inputMode="numeric" maxLength={78} required/></label>
        <label><span>{paymentLinkT(locale,'asset')}</span><select value={draft.asset} onChange={e=>update('asset',e.target.value as CreatePayPaymentLinkInput['asset'])}>{ASSETS.map(asset=><option key={asset} value={asset}>{asset}</option>)}</select></label>
        <label><span>{paymentLinkT(locale,'feePayer')}</span><select value={draft.feePayer} onChange={e=>update('feePayer',e.target.value as CreatePayPaymentLinkInput['feePayer'])}>{PAYERS.map(item=><option key={item} value={item}>{paymentLinkT(locale,item==='merchant'?'merchantPayer':'customerPayer')}</option>)}</select></label>
        <label><span>{paymentLinkT(locale,'locale')}</span><select value={draft.checkoutLocale} onChange={e=>update('checkoutLocale',e.target.value as CreatePayPaymentLinkInput['checkoutLocale'])}>{LOCALES.map(item=><option key={item} value={item}>{item === 'auto' ? paymentLinkT(locale,'autoLocale') : item}</option>)}</select></label>
        <label><span>{paymentLinkT(locale,'expires')}</span><input type="datetime-local" value={draft.expiresAt ? draft.expiresAt.slice(0,16) : ''} onChange={e=>update('expiresAt',e.target.value ? new Date(e.target.value).toISOString() : null)}/></label>
        <label className="pay-payment-link-create-wide"><span>{paymentLinkT(locale,'description')}</span><textarea value={draft.description || ''} onChange={e=>update('description',e.target.value)} maxLength={5000} rows={3}/></label>
      </div>
      {formError ? <div className="pay-payment-link-form-message is-error" role="alert"><XCircle size={17}/><span>{formError==='invalid'?paymentLinkT(locale,'createInvalid'):formError==='forbidden'?paymentLinkT(locale,'createForbidden'):formError==='conflict'?paymentLinkT(locale,'createConflict'):paymentLinkT(locale,'createFailed')}</span></div> : null}
      {created ? <div className="pay-payment-link-created" role="status"><CheckCircle2 size={17}/><div><strong>{paymentLinkT(locale,'created')}</strong><code>{publicUrl(created.slug)}</code></div><button type="button" className="pay-secondary-action" onClick={() => void copyCreated()}><Clipboard size={15}/>{copied?paymentLinkT(locale,'copied'):paymentLinkT(locale,'copy')}</button><a className="pay-secondary-action" href={publicUrl(created.slug)} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{paymentLinkT(locale,'open')}</a></div> : null}
      <div className="pay-payment-link-create-actions"><button type="submit" className="pay-primary-action" disabled={creating || !merchantId}>{creating?<Loader2 className="animate-spin" size={17}/>:<FilePlus2 size={17}/>} {creating?paymentLinkT(locale,'creating'):paymentLinkT(locale,'createAction')}</button><span>{paymentLinkT(locale,'fixedHint')}</span></div>
    </form>

    {loading && <div className="pay-payment-links-state"><Loader2 className="animate-spin" size={22}/>{paymentLinkT(locale,'title')}</div>}
    {error && !loading && <div className="pay-payment-links-state is-error" role="alert"><XCircle size={21}/><span>{error==='unauthorized'?paymentLinkT(locale,'unauthorized'):error==='forbidden'?paymentLinkT(locale,'forbidden'):paymentLinkT(locale,'loadFailed')}</span><button type="button" className="pay-secondary-action" onClick={() => void load()}>{paymentLinkT(locale,'retry')}</button></div>}
    {!loading && !error && rows.length===0 && <div className="pay-payment-links-state"><Clock3 size={22}/><span>{paymentLinkT(locale,'noData')}</span></div>}
    {!loading && !error && rows.length>0 && <div className="pay-payment-links-table-wrap"><table className="pay-payment-links-table"><thead><tr><th>{paymentLinkT(locale,'slug')}</th><th>{paymentLinkT(locale,'linkTitle')}</th><th>{paymentLinkT(locale,'amount')}</th><th>{paymentLinkT(locale,'active')}</th><th>{paymentLinkT(locale,'expires')}</th><th/></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><code>{row.slug}</code></td><td><strong>{row.title}</strong>{row.description?<small>{row.description}</small>:null}</td><td>{row.fixed_amount_atomic || '—'} {row.asset || ''}</td><td><span className={'pay-payment-link-status '+(row.is_active?'active':'inactive')}>{row.is_active?<Check size={13}/>:<X size={13}/>} {row.is_active?paymentLinkT(locale,'active'):paymentLinkT(locale,'inactive')}</span></td><td>{formatDate(row.expires_at,locale)}</td><td className="pay-payment-links-actions"><a className="pay-icon-button" href={publicUrl(row.slug)} target="_blank" rel="noreferrer" aria-label={paymentLinkT(locale,'open')} title={paymentLinkT(locale,'open')}><ExternalLink size={16}/></a><button type="button" className="pay-icon-button" onClick={()=>setSelected(row)} aria-label={paymentLinkT(locale,'details')} title={paymentLinkT(locale,'details')}><Link2 size={16}/></button></td></tr>)}</tbody></table></div>}

    {selected && <div className="pay-payment-link-detail" role="dialog" aria-modal="true" aria-label={paymentLinkT(locale,'details')}>
      <div className="pay-payment-link-detail-header"><div><span className="pay-panel-kicker">{paymentLinkT(locale,'details')}</span><h3>{selected.title}</h3></div><button type="button" className="pay-icon-button" onClick={()=>setSelected(null)} aria-label={paymentLinkT(locale,'close')}><X size={17}/></button></div>
      <div className="pay-payment-link-detail-grid">
        <Detail label={paymentLinkT(locale,'slug')} value={selected.slug}/>
        <Detail label={paymentLinkT(locale,'linkTitle')} value={selected.title}/>
        <Detail label={paymentLinkT(locale,'description')} value={selected.description || '—'}/>
        <Detail label={paymentLinkT(locale,'amount')} value={(selected.fixed_amount_atomic || '—')+(selected.asset?' '+selected.asset:'')}/>
        <Detail label={paymentLinkT(locale,'feePayer')} value={selected.fee_payer ? paymentLinkT(locale,selected.fee_payer==='merchant'?'merchantPayer':'customerPayer') : '—'}/>
        <Detail label={paymentLinkT(locale,'locale')} value={selected.checkout_locale}/>
        <Detail label={paymentLinkT(locale,'active')} value={selected.is_active?paymentLinkT(locale,'active'):paymentLinkT(locale,'inactive')}/>
        <Detail label={paymentLinkT(locale,'expires')} value={formatDate(selected.expires_at,locale)}/>
        <Detail label={paymentLinkT(locale,'created')} value={formatDate(selected.created_at,locale)}/>
      </div>
      <div className="pay-payment-links-public-url"><span>{paymentLinkT(locale,'publicUrl')}</span><code>{publicUrl(selected.slug)}</code></div>
    </div>}
  </section>;
}
function Detail({label,value}:{label:string;value:string}):React.ReactElement{return <div className="pay-payment-link-detail-cell"><span>{label}</span><strong>{value}</strong></div;}
