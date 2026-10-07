import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileCheck2, Loader2, Plus, RefreshCw, Send, ShieldAlert, Trash2, WalletCards, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import { directionFor, translate, type PayLocale } from '../i18n';
import type { PayMerchant } from '../services/merchantOnboardingService';
import { bulkPayoutService, type BulkPayoutAsset, type BulkPayoutBatch, type BulkPayoutBatchSummary } from '../services/bulkPayoutService';
import { detectSolanaWalletProviders, publicKeyString, type SolanaInjectedWalletId, type SolanaInjectedWalletProvider } from '../solana-wallet-provider';
import { encodeBase58 } from './base58';
import './pay-bulk-pay.css';

interface Props { locale: PayLocale; merchant: PayMerchant; onNavigate: (section: 'wallet') => void; }

type Stage='compose'|'review'|'processing'|'receipt';

interface DraftItem { id:string; recipient:string; amount:string; }

const ASSETS:BulkPayoutAsset[]=['SOL','USDC','USDT'];

function decodeBase64(value:string):Uint8Array{
  const binary=atob(value);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);
  return bytes;
}

function formatAtomic(value:string,decimals:number|null):string{
  if(!/^\d+$/.test(value))return '—';
  const places=decimals??0;
  if(places===0)return value;
  const padded=value.padStart(places+1,'0');
  const whole=padded.slice(0,-places)||'0';
  const fraction=padded.slice(-places).replace(/0+$/,'');
  return fraction?whole+'.'+fraction:whole;
}

function short(value:string|null|undefined):string{
  if(!value)return '—';
  return value.length>18?value.slice(0,9)+'…'+value.slice(-7):value;
}

function randomId():string{
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function normalizeAddress(value:string):string{
  return value.trim();
}

function errorMessage(error:unknown,locale:PayLocale):string{
  if(error instanceof PayHttpError){
    if(error.status===401)return translate(locale,'bulkPayUnauthorized');
    if(error.status===403)return translate(locale,'bulkPayForbidden');
    if(error.status===409)return error.code==='WALLET_NOT_READY'||error.code==='SOURCE_WALLET_CHANGED'
      ? translate(locale,'bulkPayWalletNotReady')
      : translate(locale,'bulkPayConflict');
    if(error.status===422)return error.code==='PAYOUT_TRANSACTION_TOO_LARGE'
      ? translate(locale,'bulkPayTooLarge')
      : translate(locale,'bulkPayInvalid');
    if(error.status>=500)return translate(locale,'bulkPayRetryable');
    return error.message;
  }
  return error instanceof Error?error.message:translate(locale,'bulkPayRetryable');
}

function statusLabel(locale:PayLocale,status:BulkPayoutBatchSummary['status']):string{
  const map:Record<BulkPayoutBatchSummary['status'],string>={
    ready:translate(locale,'bulkPayStatusReady'),
    submitted:translate(locale,'bulkPayStatusSubmitted'),
    verifying:translate(locale,'bulkPayStatusVerifying'),
    completed:translate(locale,'bulkPayStatusCompleted'),
    failed:translate(locale,'bulkPayStatusFailed'),
  };
  return map[status];
}

export default function PayBulkPay({ locale, merchant, onNavigate }: Props):React.ReactElement{
  const [stage,setStage]=useState<Stage>('compose');
  const [asset,setAsset]=useState<BulkPayoutAsset>('USDC');
  const [draftItems,setDraftItems]=useState<DraftItem[]>([{id:randomId(),recipient:'',amount:''}]);
  const [batch,setBatch]=useState<BulkPayoutBatch|null>(null);
  const [rows,setRows]=useState<BulkPayoutBatchSummary[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [availableWallets,setAvailableWallets]=useState<readonly SolanaInjectedWalletProvider[]>([]);
  const [selectedWalletId,setSelectedWalletId]=useState<SolanaInjectedWalletId|null>(null);
  const [error,setError]=useState('');
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [actionBusy,setActionBusy]=useState(false);
  const [transactionSize,setTransactionSize]=useState<number|null>(null);
  const [copied,setCopied]=useState(false);
  const mounted=useRef(true);
  const direction=directionFor(locale);
  const wallet=merchant.receivingWallet;
  const walletReady=Boolean(wallet?.isActive&&wallet.verificationStatus==='verified');
  const selectedProvider=selectedWalletId?availableWallets.find(item=>item.id===selectedWalletId):undefined;
  const decimals=batch?.tokenDecimals??(asset==='SOL'?9:0);

  const loadRows=useCallback(async()=>{
    setState('loading');setError('');
    try{
      const list=await bulkPayoutService.list(merchant.id);
      if(!mounted.current)return;
      setRows(list);setState('ready');
    }catch(cause){
      if(!mounted.current)return;
      setState('error');setError(errorMessage(cause,locale));
    }
  },[merchant.id,locale]);

  useEffect(()=>{
    mounted.current=true;
    setAvailableWallets(detectSolanaWalletProviders());
    void loadRows();
    return()=>{mounted.current=false;};
  },[loadRows]);

  useEffect(()=>{
    if(stage!=='processing'||!batch)return;
    let cancelled=false;
    const poll=async()=>{
      for(let attempt=0;attempt<20&&!cancelled;attempt+=1){
        try{
          const result=await bulkPayoutService.verify(merchant.id,batch.id);
          if(cancelled)return;
          setBatch(result.batch);
          if(result.batch.status==='completed'||result.batch.status==='failed'){
            setStage('receipt');
            setActionBusy(false);
            void loadRows();
            return;
          }
        }catch(cause){
          if(cause instanceof PayHttpError&&cause.status===403){
            setError(errorMessage(cause,locale));
            setActionBusy(false);
            return;
          }
        }
        await new Promise<void>(resolve=>window.setTimeout(resolve,2000));
      }
      if(!cancelled)setActionBusy(false);
    };
    void poll();
    return()=>{cancelled=true;};
  },[stage,batch,merchant.id,locale,loadRows]);

  const updateDraft=(id:string,key:'recipient'|'amount',value:string)=>{
    setDraftItems(items=>items.map(item=>item.id===id?{...item,[key]:value}:item));
  };
  const addDraft=()=>{
    if(draftItems.length>=50)return;
    setDraftItems(items=>[...items,{id:randomId(),recipient:'',amount:''}]);
  };
  const removeDraft=(id:string)=>{
    setDraftItems(items=>{
      const next=items.filter(item=>item.id!==id);
      return next.length?next:[{id:randomId(),recipient:'',amount:''}];
    });
  };

  const createBatch=async()=>{
    setActionBusy(true);setError('');
    try{
      const created=await bulkPayoutService.create(merchant.id,{
        asset,
        items:draftItems.map(item=>({recipient:normalizeAddress(item.recipient),amount:item.amount.trim()})),
      });
      if(!mounted.current)return;
      setBatch(created);setSelectedId(created.id);setStage('review');await loadRows();
    }catch(cause){
      if(!mounted.current)return;
      setError(errorMessage(cause,locale));
    }finally{
      if(mounted.current)setActionBusy(false);
    }
  };

  const chooseWallet=async()=>{
    const providers=detectSolanaWalletProviders();
    setAvailableWallets(providers);
    if(!providers.length){
      setError(translate(locale,'bulkPayWalletBrowser'));
      return;
    }
    const provider=providers.find(item=>item.publicKey)||providers[0];
    try{
      if(typeof provider.provider.connect!=='function')throw new Error('WALLET_CONNECT_UNAVAILABLE');
      const result=await provider.provider.connect();
      const address=publicKeyString(result&&typeof result==='object'?result.publicKey:undefined)||publicKeyString(provider.provider.publicKey)||publicKeyString(provider.publicKey);
      if(!address)throw new Error('WALLET_NOT_CONNECTED');
      setSelectedWalletId(provider.id);
      setError('');
    }catch{
      setError(translate(locale,'bulkPayWalletConnectionFailed'));
    }
  };

  const signBatch=async()=>{
    if(!batch||actionBusy)return;
    setError('');
    setActionBusy(true);
    try{
      let provider=selectedProvider;
      if(!provider){
        const providers=detectSolanaWalletProviders();
        setAvailableWallets(providers);
        provider=providers.find(item=>item.publicKey)||providers[0];
      }
      if(!provider||typeof provider.provider.signAndSendTransaction!=='function'){
        setError(translate(locale,'bulkPayWalletBrowser'));
        return;
      }
      if(typeof provider.provider.connect==='function'&&!provider.publicKey){
        await provider.provider.connect();
      }
      const account=publicKeyString(provider.provider.publicKey)||publicKeyString(provider.publicKey);
      if(!account||account!==batch.sourceWalletAddress)throw new Error('WALLET_ACCOUNT_MISMATCH');

      const request=await bulkPayoutService.transactionRequest(merchant.id,batch.id,account);
      setTransactionSize(request.sizeBytes);
      const transaction=Transaction.from(decodeBase64(request.transaction));
      const result=await provider.provider.signAndSendTransaction(transaction);
      const signature=typeof result==='string'?result:result&&typeof result==='object'&&typeof (result as {signature?:unknown}).signature==='string'
        ?(result as {signature:string}).signature
        :result instanceof Uint8Array?encodeBase58(result):'';
      if(!signature)throw new Error('WALLET_SIGNATURE_MISSING');
      const submitted=await bulkPayoutService.submit(merchant.id,batch.id,signature);
      setBatch(submitted);
      setStage('processing');
    }catch(cause){
      if(!mounted.current)return;
      const code=cause instanceof Error?cause.message:'';
      setError(code==='WALLET_ACCOUNT_MISMATCH'?translate(locale,'bulkPayWalletMismatch'):code==='WALLET_SIGNATURE_MISSING'?translate(locale,'bulkPayWalletSignatureMissing'):errorMessage(cause,locale));
    }finally{
      if(mounted.current)setActionBusy(false);
    }
  };

  const refreshSelected=async()=>{
    if(!selectedId)return;
    setActionBusy(true);setError('');
    try{
      const detail=await bulkPayoutService.get(merchant.id,selectedId);
      setBatch(detail);
      setStage(detail.status==='completed'||detail.status==='failed'?'receipt':detail.status==='ready'?'review':'processing');
    }catch(cause){
      setError(errorMessage(cause,locale));
    }finally{
      setActionBusy(false);
    }
  };

  const startNew=()=>{
    setStage('compose');setBatch(null);setSelectedId(null);setTransactionSize(null);setError('');
    setDraftItems([{id:randomId(),recipient:'',amount:''}]);
  };

  const copySignature=async()=>{
    if(!batch?.transactionSignature||!navigator.clipboard)return;
    try{await navigator.clipboard.writeText(batch.transactionSignature);setCopied(true);window.setTimeout(()=>setCopied(false),1200);}catch{}
  };

  const empty=state==='ready'&&rows.length===0;
  const canCreate=draftItems.length>0&&!actionBusy&&draftItems.every(item=>item.recipient.trim()&&item.amount.trim());
  const shownRows=useMemo(()=>rows.slice(0,12),[rows]);

  if(!walletReady){
    return <section className="pay-bulk-pay" aria-labelledby="bulk-pay-title">
      <header className="pay-bulk-pay-header">
        <div><span className="pay-panel-kicker">{translate(locale,'bulkPayNavLabel')}</span><h1 id="bulk-pay-title">{translate(locale,'bulkPayTitle')}</h1><p>{translate(locale,'bulkPayDescription')}</p></div>
        <div className="pay-bulk-pay-icon" aria-hidden="true"><Send size={24}/></div>
      </header>
      <section className="pay-bulk-state is-warning">
        <div className="pay-bulk-state-icon"><ShieldAlert size={22}/></div>
        <div><strong>{translate(locale,'bulkPayWalletNotReady')}</strong><p>{translate(locale,'bulkPayWalletRequired')}</p></div>
        <button type="button" className="pay-primary-action" onClick={()=>onNavigate('wallet')}><WalletCards size={17}/>{translate(locale,'wallet')}</button>
      </section>
    </section>;
  }

  return <section className="pay-bulk-pay" aria-labelledby="bulk-pay-title">
    <header className="pay-bulk-pay-header">
      <div><span className="pay-panel-kicker">{translate(locale,'bulkPayNavLabel')}</span><h1 id="bulk-pay-title">{translate(locale,'bulkPayTitle')}</h1><p>{translate(locale,'bulkPayDescription')}</p></div>
      <div className="pay-bulk-pay-header-actions">
        <button type="button" className="pay-secondary-action" onClick={()=>void loadRows()} disabled={state==='loading'||actionBusy}><RefreshCw size={16}/>{translate(locale,'reload')}</button>
        <button type="button" className="pay-primary-action" onClick={startNew} disabled={stage==='compose'&&draftItems.length===1&&draftItems[0].recipient===''&&draftItems[0].amount===''}><Plus size={17}/>{translate(locale,'bulkPayNewBatch')}</button>
      </div>
    </header>

    {error&&<div className="pay-bulk-error" role="alert"><XCircle size={18}/><span>{error}</span><button type="button" className="pay-icon-button" onClick={()=>setError('')} aria-label={translate(locale,'close')}>×</button></div>}

    <div className="pay-bulk-grid">
      <section className="pay-panel pay-bulk-main-panel">
        {stage==='compose'&&<div className="pay-bulk-compose">
          <div className="pay-bulk-section-head"><div><span className="pay-panel-kicker">{translate(locale,'bulkPayCompose')}</span><h2>{translate(locale,'bulkPayRecipients')}</h2></div><span className="pay-panel-chip"><ShieldAlert size={14}/>{translate(locale,'bulkPayAtomic')}</span></div>
          <label className="pay-bulk-asset"><span>{translate(locale,'bulkPayAsset')}</span><select value={asset} onChange={e=>setAsset(e.target.value as BulkPayoutAsset)} disabled={actionBusy}>{ASSETS.map(item=><option key={item}>{item}</option>)}</select></label>
          <div className="pay-bulk-table-wrap">
            <table className="pay-bulk-table"><thead><tr><th>#</th><th>{translate(locale,'bulkPayRecipient')}</th><th>{translate(locale,'bulkPayAmount')}</th><th /></tr></thead><tbody>
              {draftItems.map((item,index)=><tr key={item.id}>
                <td>{index+1}</td>
                <td><input value={item.recipient} onChange={e=>updateDraft(item.id,'recipient',e.target.value)} placeholder={translate(locale,'bulkPayRecipientPlaceholder')} spellCheck={false} autoComplete="off" /></td>
                <td><input value={item.amount} onChange={e=>updateDraft(item.id,'amount',e.target.value)} placeholder={asset==='SOL'?'0.00':'0.00'} inputMode="decimal" /></td>
                <td><button type="button" className="pay-icon-button" onClick={()=>removeDraft(item.id)} disabled={draftItems.length===1||actionBusy} aria-label={translate(locale,'bulkPayRemove')}><Trash2 size={16}/></button></td>
              </tr>)}
            </tbody></table>
          </div>
          <div className="pay-bulk-compose-footer">
            <button type="button" className="pay-secondary-action" onClick={addDraft} disabled={draftItems.length>=50||actionBusy}><Plus size={16}/>{translate(locale,'bulkPayAddRecipient')}</button>
            <button type="button" className="pay-primary-action" onClick={()=>void createBatch()} disabled={!canCreate}><FileCheck2 size={17}/>{actionBusy?translate(locale,'loadingWorkspace'):translate(locale,'bulkPayReview')}</button>
          </div>
        </div>}

        {stage==='review'&&batch&&<div className="pay-bulk-review">
          <div className="pay-bulk-section-head"><div><span className="pay-panel-kicker">{translate(locale,'bulkPayReview')}</span><h2>{translate(locale,'bulkPayReviewTitle')}</h2></div><span className="pay-bulk-status">{statusLabel(locale,batch.status)}</span></div>
          <div className="pay-bulk-summary-grid">
            <div><span>{translate(locale,'bulkPayAsset')}</span><strong>{batch.asset}</strong></div>
            <div><span>{translate(locale,'bulkPayRecipients')}</span><strong>{batch.itemCount}</strong></div>
            <div><span>{translate(locale,'bulkPayTotal')}</span><strong>{formatAtomic(batch.totalAmountAtomic,batch.tokenDecimals)} {batch.asset}</strong></div>
            <div><span>{translate(locale,'bulkPaySource')}</span><strong title={batch.sourceWalletAddress}>{short(batch.sourceWalletAddress)}</strong></div>
          </div>
          <div className="pay-bulk-notice"><ShieldAlert size={18}/><p>{translate(locale,'bulkPayAtomicDescription')}</p></div>
          <div className="pay-bulk-items-readonly">
            {batch.items.map(item=><div key={item.id} className="pay-bulk-item-line"><span>{item.lineNumber}</span><code>{short(item.recipient)}</code><strong>{formatAtomic(item.amountAtomic,batch.tokenDecimals)} {batch.asset}</strong></div>)}
          </div>
          <div className="pay-bulk-review-actions">
            <button type="button" className="pay-secondary-action" onClick={startNew} disabled={actionBusy}>{translate(locale,'bulkPayDiscard')}</button>
            <button type="button" className="pay-primary-action" onClick={()=>void signBatch()} disabled={actionBusy}><WalletCards size={17}/>{actionBusy?translate(locale,'loadingWorkspace'):translate(locale,'bulkPaySign')}</button>
          </div>
          {availableWallets.length>1&&<div className="pay-bulk-wallet-picker" role="listbox" aria-label={translate(locale,'bulkPayWalletSelect')}>
            {availableWallets.map(item=><button key={item.id} type="button" className={selectedWalletId===item.id?'is-active':''} onClick={()=>{setSelectedWalletId(item.id);setError('')}}><WalletCards size={16}/><span>{item.name}</span>{publicKeyString(item.provider.publicKey)?<small>{short(publicKeyString(item.provider.publicKey))}</small>:null}</button>)}
          </div>}
          {transactionSize!==null&&<div className="pay-bulk-size-note">{translate(locale,'bulkPayTransactionSize')}: {transactionSize} bytes</div>}
        </div>}

        {stage==='processing'&&batch&&<div className="pay-bulk-processing" aria-live="polite">
          <div className="pay-bulk-processing-icon"><Loader2 className="pay-spin" size={25}/></div>
          <h2>{translate(locale,'bulkPayVerifyingTitle')}</h2>
          <p>{translate(locale,'bulkPayVerifyingDescription')}</p>
          <span className="pay-bulk-status">{statusLabel(locale,batch.status)}</span>
        </div>}

        {stage==='receipt'&&batch&&<div className={batch.status==='completed'?'pay-bulk-receipt is-success':'pay-bulk-receipt is-failed'}>
          <div className="pay-bulk-receipt-icon">{batch.status==='completed'?<CheckCircle2 size={28}/>:<XCircle size={28}/>}</div>
          <span className="pay-panel-kicker">{translate(locale,'bulkPayReceipt')}</span>
          <h2>{batch.status==='completed'?translate(locale,'bulkPayCompleted'):translate(locale,'bulkPayFailed')}</h2>
          <div className="pay-bulk-receipt-grid">
            <div><span>{translate(locale,'bulkPayBatchId')}</span><code>{short(batch.id)}</code></div>
            <div><span>{translate(locale,'bulkPayTotal')}</span><strong>{formatAtomic(batch.totalAmountAtomic,batch.tokenDecimals)} {batch.asset}</strong></div>
            <div><span>{translate(locale,'bulkPayRecipients')}</span><strong>{batch.itemCount}</strong></div>
            <div><span>{translate(locale,'bulkPaySource')}</span><strong>{short(batch.sourceWalletAddress)}</strong></div>
            <div><span>{translate(locale,'bulkPayStatusLabel')}</span><strong>{statusLabel(locale,batch.status)}</strong></div>
            {batch.failureReason?<div><span>{translate(locale,'bulkPayFailure')}</span><strong>{batch.failureReason}</strong></div>:null}
          </div>
          {batch.transactionSignature&&<div className="pay-bulk-signature"><span>{translate(locale,'bulkPaySignature')}</span><code>{short(batch.transactionSignature)}</code><button type="button" className="pay-secondary-action" onClick={()=>void copySignature()}><Copy size={15}/>{copied?translate(locale,'bulkPayCopied'):translate(locale,'bulkPayCopy')}</button></div>}
          <div className="pay-bulk-receipt-actions">
            <button type="button" className="pay-secondary-action" onClick={()=>void refreshSelected()} disabled={actionBusy}><RefreshCw size={16}/>{translate(locale,'reload')}</button>
            <button type="button" className="pay-primary-action" onClick={startNew}><Plus size={16}/>{translate(locale,'bulkPayNewBatch')}</button>
          </div>
        </div>}
      </section>

      <aside className="pay-panel pay-bulk-history-panel">
        <div className="pay-bulk-section-head"><div><span className="pay-panel-kicker">{translate(locale,'bulkPayHistory')}</span><h2>{translate(locale,'bulkPayRecent')}</h2></div></div>
        {state==='loading'&&<div className="pay-bulk-history-state"><Loader2 className="pay-spin" size={20}/>{translate(locale,'loadingWorkspace')}</div>}
        {state==='error'&&<div className="pay-bulk-history-state is-error"><XCircle size={18}/><span>{error}</span><button type="button" className="pay-secondary-action" onClick={()=>void loadRows()}>{translate(locale,'retry')}</button></div>}
        {empty&&<div className="pay-bulk-history-state"><FileCheck2 size={20}/><span>{translate(locale,'bulkPayNoHistory')}</span></div>}
        {state==='ready'&&shownRows.length>0&&<div className="pay-bulk-history-list">
          {shownRows.map(row=><button key={row.id} type="button" className={selectedId===row.id?'is-active':''} onClick={()=>{setSelectedId(row.id);void refreshSelected()}}>
            <span className="pay-bulk-history-main"><strong>{formatAtomic(row.totalAmountAtomic,row.tokenDecimals)} {row.asset}</strong><small>{row.itemCount} · {short(row.id)}</small></span>
            <span className="pay-bulk-status">{statusLabel(locale,row.status)}</span>
            {direction==='rtl'?<ChevronLeft size={16}/>:<ChevronRight size={16}/>}
          </button>)}
        </div>}
      </aside>
    </div>
  </section>;
}
