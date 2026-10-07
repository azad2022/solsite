import React, { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Clipboard, Clock3, ExternalLink, FilePlus2, Link2, Loader2, RefreshCw, X, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { payPaymentLinkService, type PayPaymentLink, type CreatePayPaymentLinkInput, type UpdatePayPaymentLinkInput } from '../services/paymentLinkService';
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
const EMPTY_ASSET_DECIMALS = { SOL: null, USDC: null, USDT: null };
type EditDraft = Omit<UpdatePayPaymentLinkInput, 'merchantId' | 'linkId'>;
function editDraftFromRow(row: PayPaymentLink): EditDraft {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    fixedAmountAtomic: row.fixed_amount_atomic || '',
    asset: row.asset || 'USDC',
    feePayer: row.fee_payer || 'merchant',
    checkoutLocale: row.checkout_locale,
    isActive: row.is_active,
    expiresAt: row.expires_at,
  };
}

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

function formatAtomic(value: string, decimals: number | null): string {
  const normalized = value.trim();
  if (decimals === null || !/^\d+$/.test(normalized)) return value;
  if (decimals === 0) return normalized;
  const padded = normalized.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? whole + '.' + fraction : whole;
}

function decimalToAtomic(value: string, decimals: number | null): string | null {
  const normalized = value.trim();
  if (decimals === null || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [wholeText, fractionText = ''] = normalized.split('.');
  if (fractionText.length > decimals) return null;
  const scale = 10n ** BigInt(decimals);
  const paddedFraction = (fractionText + '0'.repeat(decimals)).slice(0, decimals);
  const atomic = BigInt(wholeText) * scale + BigInt(paddedFraction || '0');
  const result = atomic.toString();
  if (result.length > 78 || atomic <= 0n) return null;
  return result;
}

function formatLinkAmount(row: PayPaymentLink): string {
  const amount = row.fixed_amount_atomic || '—';
  return row.asset ? formatAtomic(amount, row.amount_decimals) + ' ' + row.asset : amount;
}

export default function PayPaymentLinks({ locale, merchantId }: Props): React.ReactElement {
  const [rows, setRows] = useState<PayPaymentLink[]>([]);
  const [selected, setSelected] = useState<PayPaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'unauthorized'|'forbidden'|'error'|null>(null);
  const [draft, setDraft] = useState<CreatePayPaymentLinkInput>({ ...EMPTY_DRAFT, merchantId: merchantId || '' });
  const [amountInput, setAmountInput] = useState('');
  const [assetDecimals, setAssetDecimals] = useState<{ SOL: number | null; USDC: number | null; USDT: number | null }>({ ...EMPTY_ASSET_DECIMALS });
  const [expiresInput, setExpiresInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<'invalid'|'forbidden'|'conflict'|'error'|null>(null);
  const [created, setCreated] = useState<PayPaymentLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editAmountInput, setEditAmountInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<'invalid'|'forbidden'|'conflict'|'error'|null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<'hasPayments'|'forbidden'|'error'|null>(null);

  const load = useCallback(async () => {
    if (!merchantId) {
      setRows([]);
      setAssetDecimals({ ...EMPTY_ASSET_DECIMALS });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setAssetDecimals({ ...EMPTY_ASSET_DECIMALS });
    try {
      const result = await payPaymentLinkService.listWithMeta(merchantId, 100);
      setRows(result.rows);
      setAssetDecimals(result.assetDecimals);
    }
    catch (cause) {
      setAssetDecimals({ ...EMPTY_ASSET_DECIMALS });
      setError(accessError(cause));
    }
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
    const decimals = assetDecimals[draft.asset];
    const amount = decimalToAtomic(amountInput, decimals);
    const slug = draft.slug.trim().toLowerCase();
    if (!merchantId || decimals === null || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 120
      || !draft.title.trim() || draft.title.trim().length > 200
      || (draft.description?.length || 0) > 5000
      || !amount) {
      setFormError('invalid'); return;
    }
    setCreating(true);
    try {
      const result = await payPaymentLinkService.create({ ...draft, merchantId, slug, fixedAmountAtomic: amount, expiresAt: expiresInput ? new Date(expiresInput).toISOString() : null }, crypto.randomUUID());
      setCreated(result);
      setDraft({ ...EMPTY_DRAFT, merchantId });
      setAmountInput('');
      setExpiresInput('');
      await load();
    } catch (cause) {
      if (cause instanceof PayHttpError && cause.status === 403) setFormError('forbidden');
      else if (cause instanceof PayHttpError && cause.status === 409) setFormError('conflict');
      else if (cause instanceof PayHttpError && cause.status === 400) setFormError('invalid');
      else setFormError('error');
    } finally { setCreating(false); }
  };

  const beginEdit = (row: PayPaymentLink) => {
    setSelected(row);
    setEditDraft(editDraftFromRow(row));
    setEditAmountInput(formatAtomic(row.fixed_amount_atomic || '', row.amount_decimals));
    setEditMode(true);
    setUpdateError(null);
    setDeleteConfirm(false);
    setDeleteError(null);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditDraft(null);
    setEditAmountInput('');
    setUpdateError(null);
  };

  const updateEdit = <K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setEditDraft(current => current ? { ...current, [key]: value } : current);
    setUpdateError(null);
    setDeleteError(null);
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!merchantId || !selected || !editDraft) return;
    const slug = editDraft.slug.trim().toLowerCase();
    const amount = decimalToAtomic(editAmountInput, assetDecimals[editDraft.asset]);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 120
      || !editDraft.title.trim() || editDraft.title.trim().length > 200
      || (editDraft.description?.length || 0) > 5000
      || !amount
      || !editDraft.asset || !editDraft.feePayer || !editDraft.checkoutLocale
      || (editDraft.isActive && editDraft.expiresAt && Date.parse(editDraft.expiresAt) <= Date.now())) {
      setUpdateError('invalid'); return;
    }
    setUpdating(true);
    try {
      const result = await payPaymentLinkService.update({
        merchantId, linkId: selected.id, slug, title: editDraft.title, description: editDraft.description || null,
        fixedAmountAtomic: amount, asset: editDraft.asset, feePayer: editDraft.feePayer,
        checkoutLocale: editDraft.checkoutLocale, isActive: editDraft.isActive, expiresAt: editDraft.expiresAt || null,
      }, crypto.randomUUID());
      setRows(current => current.map(row => row.id === result.id ? result : row));
      setSelected(result);
      setEditDraft(editDraftFromRow(result));
      setEditMode(false);
      setUpdateError(null);
    } catch (cause) {
      if (cause instanceof PayHttpError && cause.status === 403) setUpdateError('forbidden');
      else if (cause instanceof PayHttpError && cause.status === 409) setUpdateError('conflict');
      else if (cause instanceof PayHttpError && cause.status === 400) setUpdateError('invalid');
      else setUpdateError('error');
    } finally { setUpdating(false); }
  };

  const deleteLink = async () => {
    if (!merchantId || !selected || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await payPaymentLinkService.remove(merchantId, selected.id, crypto.randomUUID());
      setRows(current => current.filter(row => row.id !== selected.id));
      setSelected(null);
      setDeleteConfirm(false);
      setEditMode(false);
    } catch (cause) {
      if (cause instanceof PayHttpError && cause.status === 409) setDeleteError('hasPayments');
      else if (cause instanceof PayHttpError && cause.status === 403) setDeleteError('forbidden');
      else setDeleteError('error');
    } finally { setDeleting(false); }
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
      <div><h2>{paymentLinkT(locale, 'title')}</h2><p>{paymentLinkT(locale, 'subtitle')}</p></div>
      <button type="button" className="pay-secondary-action" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/>{paymentLinkT(locale,'refresh')}</button>
    </div>

    <form className="pay-payment-link-create" onSubmit={event => void createLink(event)}>
      <div className="pay-payment-link-create-head"><div><span className="pay-panel-kicker">{paymentLinkT(locale,'createTitle')}</span><h3>{paymentLinkT(locale,'createTitle')}</h3><p>{paymentLinkT(locale,'createDescription')}</p></div><FilePlus2 size={20} aria-hidden="true"/></div>
      <div className="pay-payment-link-create-grid">
        <label><span>{paymentLinkT(locale,'slug')}</span><input value={draft.slug} onChange={e=>update('slug',e.target.value.toLowerCase())} maxLength={120} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="solmint-store" required/></label>
        <label><span>{paymentLinkT(locale,'linkTitle')}</span><input value={draft.title} onChange={e=>update('title',e.target.value)} maxLength={200} required/></label>
        <label><span>{paymentLinkT(locale,'amount')}</span><input value={amountInput} onChange={e=>{setAmountInput(e.target.value);setFormError(null);setCreated(null)}} inputMode="decimal" placeholder={paymentLinkT(locale,'amountExample')} required/><small>{paymentLinkT(locale,'amountInputHint')}</small></label>
        <label><span>{paymentLinkT(locale,'asset')}</span><select value={draft.asset} onChange={e=>update('asset',e.target.value as CreatePayPaymentLinkInput['asset'])}>{ASSETS.map(asset=><option key={asset} value={asset}>{asset}</option>)}</select></label>
        <label><span>{paymentLinkT(locale,'feePayer')}</span><select value={draft.feePayer} onChange={e=>update('feePayer',e.target.value as CreatePayPaymentLinkInput['feePayer'])}>{PAYERS.map(item=><option key={item} value={item}>{paymentLinkT(locale,item==='merchant'?'merchantPayer':'customerPayer')}</option>)}</select></label>
        <label><span>{paymentLinkT(locale,'locale')}</span><select value={draft.checkoutLocale} onChange={e=>update('checkoutLocale',e.target.value as CreatePayPaymentLinkInput['checkoutLocale'])}>{LOCALES.map(item=><option key={item} value={item}>{item === 'auto' ? paymentLinkT(locale,'autoLocale') : item}</option>)}</select></label>
        <label><span>{paymentLinkT(locale,'expires')}</span><input type="datetime-local" value={expiresInput} onChange={e=>{setExpiresInput(e.target.value);setCreated(null);setFormError(null);}}/></label>
        <label className="pay-payment-link-create-wide"><span>{paymentLinkT(locale,'description')}</span><textarea value={draft.description || ''} onChange={e=>update('description',e.target.value)} maxLength={5000} rows={3}/></label>
      </div>
      {formError ? <div className="pay-payment-link-form-message is-error" role="alert"><XCircle size={17}/><span>{formError==='invalid'?paymentLinkT(locale,'createInvalid'):formError==='forbidden'?paymentLinkT(locale,'createForbidden'):formError==='conflict'?paymentLinkT(locale,'createConflict'):paymentLinkT(locale,'createFailed')}</span></div> : null}
      {created ? <div className="pay-payment-link-created" role="status"><CheckCircle2 size={17}/><div><strong>{paymentLinkT(locale,'created')}</strong><code>{publicUrl(created.slug)}</code></div><button type="button" className="pay-secondary-action" onClick={() => void copyCreated()}><Clipboard size={15}/>{copied?paymentLinkT(locale,'copied'):paymentLinkT(locale,'copy')}</button><a className="pay-secondary-action" href={publicUrl(created.slug)} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{paymentLinkT(locale,'open')}</a></div> : null}
      <div className="pay-payment-link-create-actions"><button type="submit" className="pay-primary-action" disabled={creating || !merchantId || loading || assetDecimals[draft.asset] === null}>{creating?<Loader2 className="animate-spin" size={17}/>:<FilePlus2 size={17}/>} {creating?paymentLinkT(locale,'creating'):paymentLinkT(locale,'createAction')}</button><span>{paymentLinkT(locale,'fixedHint')}</span></div>
    </form>

    {loading && <div className="pay-payment-links-state"><Loader2 className="animate-spin" size={22}/>{paymentLinkT(locale,'title')}</div>}
    {error && !loading && <div className="pay-payment-links-state is-error" role="alert"><XCircle size={21}/><span>{error==='unauthorized'?paymentLinkT(locale,'unauthorized'):error==='forbidden'?paymentLinkT(locale,'forbidden'):paymentLinkT(locale,'loadFailed')}</span><button type="button" className="pay-secondary-action" onClick={() => void load()}>{paymentLinkT(locale,'retry')}</button></div>}
    {!loading && !error && rows.length===0 && <div className="pay-payment-links-state"><Clock3 size={22}/><span>{paymentLinkT(locale,'noData')}</span></div>}
    {!loading && !error && rows.length>0 && <div className="pay-payment-links-table-wrap"><table className="pay-payment-links-table"><thead><tr><th>{paymentLinkT(locale,'slug')}</th><th>{paymentLinkT(locale,'linkTitle')}</th><th>{paymentLinkT(locale,'amount')}</th><th>{paymentLinkT(locale,'active')}</th><th>{paymentLinkT(locale,'expires')}</th><th/></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td data-label={paymentLinkT(locale,'slug')}><code>{row.slug}</code></td><td data-label={paymentLinkT(locale,'linkTitle')}><strong>{row.title}</strong>{row.description?<small>{row.description}</small>:null}</td><td data-label={paymentLinkT(locale,'amount')}><strong>{formatLinkAmount(row)}</strong>{row.amount_decimals === null ? <small>{paymentLinkT(locale,'atomicAmount')}</small> : null}</td><td data-label={paymentLinkT(locale,'active')}><span className={'pay-payment-link-status '+(row.is_active?'active':'inactive')}>{row.is_active?<Check size={13}/>:<X size={13}/>} {row.is_active?paymentLinkT(locale,'active'):paymentLinkT(locale,'inactive')}</span></td><td data-label={paymentLinkT(locale,'expires')}>{formatDate(row.expires_at,locale)}</td><td className="pay-payment-links-actions"><a className="pay-icon-button" href={publicUrl(row.slug)} target="_blank" rel="noreferrer" aria-label={paymentLinkT(locale,'open')} title={paymentLinkT(locale,'open')}><ExternalLink size={16}/></a><button type="button" className="pay-icon-button" onClick={()=>setSelected(row)} aria-label={paymentLinkT(locale,'details')} title={paymentLinkT(locale,'details')}><Link2 size={16}/></button></td></tr>)}</tbody></table></div>}

    {selected && <section className="pay-payment-link-detail" aria-label={editMode ? paymentLinkT(locale,'edit') : paymentLinkT(locale,'details')}>
      <div className="pay-payment-link-detail-header"><div><span className="pay-panel-kicker">{editMode ? paymentLinkT(locale,'edit') : paymentLinkT(locale,'details')}</span><h3>{selected.title}</h3></div><button type="button" className="pay-icon-button" onClick={()=>{setSelected(null);setEditMode(false);setDeleteConfirm(false);}} aria-label={paymentLinkT(locale,'close')} title={paymentLinkT(locale,'close')}><X size={17}/></button></div>

      {editMode && editDraft ? <form className="pay-payment-link-edit" onSubmit={event=>void saveEdit(event)}>
        <div className="pay-payment-link-edit-grid">
          <label><span>{paymentLinkT(locale,'slug')}</span><input value={editDraft.slug} onChange={e=>updateEdit('slug',e.target.value.toLowerCase())} maxLength={120} required/></label>
          <label><span>{paymentLinkT(locale,'linkTitle')}</span><input value={editDraft.title} onChange={e=>updateEdit('title',e.target.value)} maxLength={200} required/></label>
          <label><span>{paymentLinkT(locale,'amount')}</span><input value={editAmountInput} onChange={e=>{setEditAmountInput(e.target.value);setUpdateError(null)}} inputMode="decimal" placeholder={paymentLinkT(locale,'amountExample')} required/></label>
          <label><span>{paymentLinkT(locale,'asset')}</span><select value={editDraft.asset} onChange={e=>updateEdit('asset',e.target.value as EditDraft['asset'])}>{ASSETS.map(asset=><option key={asset} value={asset}>{asset}</option>)}</select></label>
          <label><span>{paymentLinkT(locale,'feePayer')}</span><select value={editDraft.feePayer} onChange={e=>updateEdit('feePayer',e.target.value as EditDraft['feePayer'])}>{PAYERS.map(item=><option key={item} value={item}>{paymentLinkT(locale,item==='merchant'?'merchantPayer':'customerPayer')}</option>)}</select></label>
          <label><span>{paymentLinkT(locale,'locale')}</span><select value={editDraft.checkoutLocale} onChange={e=>updateEdit('checkoutLocale',e.target.value as EditDraft['checkoutLocale'])}>{LOCALES.map(item=><option key={item} value={item}>{item === 'auto' ? paymentLinkT(locale,'autoLocale') : item}</option>)}</select></label>
          <label><span>{paymentLinkT(locale,'expires')}</span><input type="datetime-local" value={editDraft.expiresAt ? new Date(editDraft.expiresAt).toISOString().slice(0,16) : ''} onChange={e=>updateEdit('expiresAt',e.target.value ? new Date(e.target.value).toISOString() : null)}/></label>
          <label><span>{paymentLinkT(locale,'active')}</span><select value={editDraft.isActive ? 'active' : 'inactive'} onChange={e=>updateEdit('isActive',e.target.value === 'active')}><option value="active">{paymentLinkT(locale,'active')}</option><option value="inactive">{paymentLinkT(locale,'inactive')}</option></select></label>
          <label className="pay-payment-link-create-wide"><span>{paymentLinkT(locale,'description')}</span><textarea value={editDraft.description || ''} onChange={e=>updateEdit('description',e.target.value)} maxLength={5000} rows={3}/></label>
        </div>
        {updateError ? <div className="pay-payment-link-form-message is-error" role="alert"><XCircle size={17}/><span>{updateError==='invalid'?paymentLinkT(locale,'updateInvalid'):updateError==='forbidden'?paymentLinkT(locale,'updateForbidden'):updateError==='conflict'?paymentLinkT(locale,'updateConflict'):paymentLinkT(locale,'updateFailed')}</span></div> : null}
        {deleteError ? <div className="pay-payment-link-form-message is-error" role="alert"><XCircle size={17}/><span>{deleteError==='hasPayments'?paymentLinkT(locale,'hasPayments'):deleteError==='forbidden'?paymentLinkT(locale,'deleteForbidden'):paymentLinkT(locale,'deleteFailed')}</span></div> : null}
        <div className="pay-payment-link-edit-actions"><button type="submit" className="pay-primary-action" disabled={updating}>{updating?<Loader2 className="animate-spin" size={17}/>:<CheckCircle2 size={17}/>} {updating?paymentLinkT(locale,'saving'):paymentLinkT(locale,'save')}</button><button type="button" className="pay-secondary-action" onClick={cancelEdit}>{paymentLinkT(locale,'cancel')}</button></div>
      </form> : <>
        <div className="pay-payment-link-detail-grid">
          <Detail label={paymentLinkT(locale,'slug')} value={selected.slug}/>
          <Detail label={paymentLinkT(locale,'linkTitle')} value={selected.title}/>
          <Detail label={paymentLinkT(locale,'description')} value={selected.description || '—'}/>
          <Detail label={paymentLinkT(locale,'amount')} value={formatLinkAmount(selected)}/>
          <Detail label={paymentLinkT(locale,'feePayer')} value={selected.fee_payer ? paymentLinkT(locale,selected.fee_payer==='merchant'?'merchantPayer':'customerPayer') : '—'}/>
          <Detail label={paymentLinkT(locale,'locale')} value={selected.checkout_locale}/>
          <Detail label={paymentLinkT(locale,'active')} value={selected.is_active?paymentLinkT(locale,'active'):paymentLinkT(locale,'inactive')}/>
          <Detail label={paymentLinkT(locale,'expires')} value={formatDate(selected.expires_at,locale)}/>
          <Detail label={paymentLinkT(locale,'created')} value={formatDate(selected.created_at,locale)}/>
        </div>
        <div className="pay-payment-links-public-url"><span>{paymentLinkT(locale,'publicUrl')}</span><code>{publicUrl(selected.slug)}</code></div>
        {deleteError ? <div className="pay-payment-link-form-message is-error" role="alert"><XCircle size={17}/><span>{deleteError==='hasPayments'?paymentLinkT(locale,'hasPayments'):deleteError==='forbidden'?paymentLinkT(locale,'deleteForbidden'):paymentLinkT(locale,'deleteFailed')}</span></div> : null}
        {!deleteConfirm ? <div className="pay-payment-link-edit-actions">
          <button type="button" className="pay-primary-action" onClick={()=>beginEdit(selected)}><CheckCircle2 size={17}/>{paymentLinkT(locale,'edit')}</button>
          <button type="button" className="pay-secondary-action" onClick={()=>{setDeleteError(null);setDeleteConfirm(true)}}>{paymentLinkT(locale,'delete')}</button>
        </div> : <div className="pay-payment-link-edit-actions" role="group" aria-label={paymentLinkT(locale,'deleteConfirm')}>
          <span>{paymentLinkT(locale,'deleteConfirm')}</span>
          <button type="button" className="pay-primary-action" onClick={()=>void deleteLink()} disabled={deleting}>{deleting?<Loader2 className="animate-spin" size={16}/>:null}{deleting?paymentLinkT(locale,'deleting'):paymentLinkT(locale,'confirmDelete')}</button>
          <button type="button" className="pay-secondary-action" onClick={()=>setDeleteConfirm(false)} disabled={deleting}>{paymentLinkT(locale,'cancel')}</button>
        </div>}
        {deleteError === 'hasPayments' ? <button type="button" className="pay-secondary-action" onClick={()=>beginEdit({...selected,is_active:false})}>{paymentLinkT(locale,'deactivate')}</button> : null}
      </>}
    </section>}
  </section>;
}
function Detail({label,value}:{label:string;value:string}):React.ReactElement{return <div className="pay-payment-link-detail-cell"><span>{label}</span><strong>{value}</strong></div>;}
