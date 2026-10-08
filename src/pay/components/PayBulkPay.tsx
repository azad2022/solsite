import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, Clock3, Plus, RefreshCw, Send, Trash2, WalletCards } from 'lucide-react';
import { Transaction } from '@solana/web3.js';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import { isValidWalletAddress } from '../wallet-payment-transport';
import { detectSolanaWalletProviders, getSolanaWalletProvider, publicKeyString, type SolanaInjectedWalletId } from '../solana-wallet-provider';
import { bulkPayoutService, type BulkPayoutAssetConfig, type BulkPayoutBatch, type BulkPayoutDetail, type BulkPayoutInputItem } from '../services/bulkPayoutService';
import { bulkT } from './pay-bulk-i18n';
import './pay-bulk.css';

interface Props { locale: PayLocale; merchantId: string; }
type DraftItem = { id:string; recipient:string; amount:string };
const TERMINAL = new Set(['completed','failed']);
const INITIAL_ROWS = 3;

function nextDraft(id:number): DraftItem { return { id:'row-'+id+'-'+Math.random().toString(36).slice(2,8), recipient:'', amount:'' }; }
function decimalsFor(asset:string, configs:readonly BulkPayoutAssetConfig[]):number|null {
  if(asset==='SOL') return 9;
  return configs.find(item=>item.asset===asset)?.decimals ?? null;
}
function decimalToAtomic(value:string, decimals:number|null):string|null {
  const normalized=value.trim();
  if(decimals===null || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole,fraction='']=normalized.split('.');
  if(fraction.length>decimals) return null;
  const scale=10n**BigInt(decimals);
  const atomic=BigInt(whole)*scale+BigInt((fraction+'0'.repeat(decimals)).slice(0,decimals)||'0');
  return atomic>0n && atomic.toString().length<=78 ? atomic.toString() : null;
}
function formatAtomic(value:string,decimals:number|null):string {
  if(!/^\d+$/.test(value)) return value;
  const d=decimals??0;
  if(d===0)return value;
  const p=value.padStart(d+1,'0');
  const whole=p.slice(0,-d)||'0';
  const frac=p.slice(-d).replace(/0+$/,'');
  return frac?whole+'.'+frac:whole;
}
function toBytes(base64:string):Uint8Array {
  const binary=atob(base64); const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i+=1) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function signatureFrom(value:unknown):string {
  if(typeof value==='string') return value.trim();
  if(value instanceof Uint8Array) {
    const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n=0n; for(const byte of value)n=(n<<8n)+BigInt(byte);
    let out=''; while(n>0n){const r=Number(n%58n);out=alphabet[r]+out;n/=58n;}
    for(const byte of value){if(byte!==0)break;out='1'+out;}
    return out;
  }
  if(value&&typeof value==='object'){
    const signature=(value as {signature?:unknown}).signature;
    return signatureFrom(signature);
  }
  return '';
}
function accessKind(error:unknown):'unauthorized'|'forbidden'|'retryable'|'error' {
  if(error instanceof PayHttpError){
    if(error.status===401)return 'unauthorized';
    if(error.status===403)return 'forbidden';
    if(error.status===408||error.status===429||error.status>=500)return 'retryable';
  }
  return 'error';
}
function date(value:string,locale:PayLocale):string {
  const d=new Date(value); if(Number.isNaN(d.getTime()))return '—';
  return new Intl.DateTimeFormat(locale==='ru'?'ru-RU':locale,{dateStyle:'medium',timeStyle:'short'}).format(d);
}
function errorMessage(error:unknown,locale:PayLocale):string {
  if(error instanceof PayHttpError){
    if(error.code==='BATCH_TRANSACTION_TOO_LARGE')return bulkT(locale,'sizeFailed');
    if(error.code==='SOURCE_TOKEN_ACCOUNT_NOT_FOUND')return bulkT(locale,'sourceTokenMissing');
    if(error.status===401)return bulkT(locale,'unauthorized');
    if(error.status===403)return bulkT(locale,'forbidden');
    if(error.status>=500||error.status===429)return bulkT(locale,'retryable');
  }
  return bulkT(locale,'txFailed');
}

export default function PayBulkPay({locale,merchantId}:Props):React.ReactElement {
  const [configs,setConfigs]=useState<BulkPayoutAssetConfig[]>([]);
  const [asset,setAsset]=useState<'SOL'|'USDC'|'USDT'>('USDC');
  const [draft,setDraft]=useState<DraftItem[]>(()=>Array.from({length:INITIAL_ROWS},(_,i)=>nextDraft(i+1)));
  const [batches,setBatches]=useState<BulkPayoutBatch[]>([]);
  const [selected,setSelected]=useState<BulkPayoutDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadingHistory,setLoadingHistory]=useState(false);
  const [loadState,setLoadState]=useState<'ready'|'empty'|'unauthorized'|'forbidden'|'retryable'|'error'|'stale'>('ready');
  const [formError,setFormError]=useState('');
  const [createState,setCreateState]=useState<'idle'|'creating'>('idle');
  const [flowState,setFlowState]=useState<'idle'|'wallet'|'signing'|'submitted'|'verifying'|'done'|'failed'>('idle');
  const [wallets,setWallets]=useState(detectSolanaWalletProviders());
  const [walletId,setWalletId]=useState<SolanaInjectedWalletId|null>(null);
  const [flowError,setFlowError]=useState('');
  const pollingRef=useRef(false);

  const decimals=decimalsFor(asset,configs);
  const canCreate=Boolean(configs.find(item=>item.asset===asset));
  const draftAtomic=useMemo(() => draft.map(row=>({
    recipient:row.recipient.trim(),
    amountAtomic:decimalToAtomic(row.amount,decimals),
  })),[draft,decimals]);

  const loadHistory=useCallback(async(showSpinner=true)=>{
    if(showSpinner)setLoadingHistory(true);
    try{
      const rows=await bulkPayoutService.list(merchantId,50);
      setBatches(rows);
      setLoadState(rows.length===0?'empty':'ready');
    }catch(error){
      setLoadState(current=>batches.length?'stale':accessKind(error));
    }finally{if(showSpinner)setLoadingHistory(false);}
  },[merchantId,batches.length]);

  const load=useCallback(async()=>{
    setLoading(true); setLoadState('ready');
    try{
      const [assetRows]=await Promise.all([bulkPayoutService.assets(),loadHistory(false)]);
      setConfigs(assetRows);
      const first=assetRows.find(item=>item.asset==='USDC')||assetRows[0];
      if(first)setAsset(first.asset);
      else setLoadState('empty');
    }catch(error){
      setLoadState(accessKind(error));
    }finally{setLoading(false);}
  },[loadHistory]);

  useEffect(()=>{void load();},[load]);

  const selectBatch=useCallback(async(batch:BulkPayoutBatch)=>{
    setFlowError(''); setFormError('');
    try{
      const detail=await bulkPayoutService.get(merchantId,batch.id);
      setSelected(detail);
      setFlowState(TERMINAL.has(detail.batch.status)?(detail.batch.status==='completed'?'done':'failed'):'idle');
    }catch(error){setFlowError(errorMessage(error,locale));}
  },[merchantId,locale]);

  useEffect(()=>{setWallets(detectSolanaWalletProviders());},[]);

  const updateDraft=(id:string,key:'recipient'|'amount',value:string)=>{
    setDraft(current=>current.map(row=>row.id===id?{...row,[key]:value}:row));
    setFormError('');
  };

  const addRow=()=>{ if(draft.length<50)setDraft(current=>[...current,nextDraft(current.length+1)]); };
  const removeRow=(id:string)=>{ if(draft.length>1)setDraft(current=>current.filter(row=>row.id!==id)); };

  const createBatch=async(event:React.FormEvent)=>{
    event.preventDefault(); setFormError('');
    if(!canCreate){setFormError(bulkT(locale,'noAsset'));return;}
    if(draft.length<1){setFormError(bulkT(locale,'minItems'));return;}
    if(draft.length>50){setFormError(bulkT(locale,'maxItems'));return;}
    const items:BulkPayoutInputItem[]=[];
    for(let i=0;i<draft.length;i+=1){
      const row=draft[i]; const recipient=row.recipient.trim(); const amount=draftAtomic[i]?.amountAtomic;
      if(!isValidWalletAddress(recipient)){setFormError(bulkT(locale,'invalidRecipient'));return;}
      if(!amount){setFormError(bulkT(locale,'invalidAmount'));return;}
      items.push({recipient,amountAtomic:amount});
    }
    setCreateState('creating');
    try{
      const created=await bulkPayoutService.create(merchantId,asset,items,crypto.randomUUID());
      const detail=await bulkPayoutService.get(merchantId,created.id);
      setSelected(detail);
      setBatches(current=>[detail.batch,...current.filter(row=>row.id!==detail.batch.id)].slice(0,50));
      setDraft(Array.from({length:INITIAL_ROWS},(_,i)=>nextDraft(i+1)));
      setFlowState('idle');
    }catch(error){setFormError(errorMessage(error,locale));}
    finally{setCreateState('idle');}
  };

  const signBatch=async()=>{
    if(!selected||flowState==='signing'||flowState==='verifying')return;
    setFlowError('');
    const providers=detectSolanaWalletProviders();
    setWallets(providers);
    const entry=getSolanaWalletProvider(walletId??undefined);
    if(!entry){setFlowState('wallet');setFlowError(bulkT(locale,'noWallet'));return;}
    if(typeof entry.provider.signAndSendTransaction!=='function'){setFlowState('wallet');setFlowError(bulkT(locale,'noWallet'));return;}
    setFlowState('signing');
    try{
      const connectionResult=await entry.provider.connect?.();
      const connected=publicKeyString(connectionResult&&typeof connectionResult==='object'?'publicKey':undefined) || publicKeyString(entry.provider.publicKey);
      if(!connected || connected!==selected.batch.source_wallet_address){setFlowState('wallet');setFlowError(bulkT(locale,'walletMismatch'));return;}
      const request=await bulkPayoutService.transactionRequest(selected.batch.id,connected);
      const tx=Transaction.from(toBytes(request.transaction));
      const sent=await entry.provider.signAndSendTransaction(tx);
      const signature=signatureFrom(sent);
      if(!signature){setFlowState('failed');setFlowError(bulkT(locale,'txFailed'));return;}
      const submitted=await bulkPayoutService.submit(merchantId,selected.batch.id,signature,crypto.randomUUID());
      const submittedDetail=await bulkPayoutService.get(merchantId,submitted.id);
      setSelected(submittedDetail);
      setBatches(current=>current.map(row=>row.id===submitted.id?submittedDetail.batch:row));
      setFlowState('submitted');
      pollingRef.current=false;
      void verifyLoop(submittedDetail.batch.id);
    }catch(error){
      setFlowState('failed');
      setFlowError(errorMessage(error,locale));
    }
  };

  const verifyLoop=useCallback(async(batchId:string)=>{
    if(pollingRef.current)return;
    pollingRef.current=true; setFlowState('verifying');
    try{
      for(let attempt=0;attempt<14;attempt+=1){
        try{
          const result=await bulkPayoutService.verify(batchId);
          setSelected(current=>current?{...current,batch:result.batch}:current);
          setBatches(current=>current.map(row=>row.id===result.batch.id?result.batch:row));
          if(result.outcome==='completed'){setFlowState('done');return;}
          if(result.outcome==='failed'){setFlowState('failed');return;}
        }catch(error){
          setFlowError(accessKind(error)==='retryable'?bulkT(locale,'retryable'):errorMessage(error,locale));
        }
        await new Promise(resolve=>window.setTimeout(resolve,6500));
      }
      setFlowError(bulkT(locale,'stale'));
    }finally{pollingRef.current=false;}
  },[locale]);

  const retryVerification=()=>{if(selected&&selected.batch.transaction_signature)void verifyLoop(selected.batch.id);};
  const statusLabel=(value:BulkPayoutBatch['status'])=>bulkT(locale,value);
  const selectedDecimals=decimalsFor(selected?.batch.asset||asset,configs);

  if(loading){
    return <section className="pay-bulk" aria-live="polite"><div className="pay-bulk-state"><RefreshCw className="pay-spin" size={20}/><div><strong>{bulkT(locale,'assetLoading')}</strong></div></div></section>;
  }
  if(loadState==='unauthorized'){
    return <section className="pay-bulk"><div className="pay-bulk-state"><CircleAlert size={20}/><div><strong>{bulkT(locale,'unauthorized')}</strong><p>{bulkT(locale,'loadFailed')}</p><button type="button" className="pay-primary-action" onClick={()=>void load()}>{bulkT(locale,'retry')}</button></div></div></section>;
  }
  if(loadState==='forbidden'){
    return <section className="pay-bulk"><div className="pay-bulk-state"><CircleAlert size={20}/><div><strong>{bulkT(locale,'forbidden')}</strong></div></div></section>;
  }
  if(loadState==='retryable'||loadState==='error'){
    return <section className="pay-bulk"><div className="pay-bulk-state"><CircleAlert size={20}/><div><strong>{bulkT(locale,'loadFailed')}</strong><p>{bulkT(locale,'retryable')}</p><button type="button" className="pay-primary-action" onClick={()=>void load()}>{bulkT(locale,'retry')}</button></div></div></section>;
  }

  return <section className="pay-bulk" aria-labelledby="pay-bulk-title">
    <header className="pay-bulk-heading">
      <div><span className="pay-panel-kicker">{bulkT(locale,'title')}</span><h1 id="pay-bulk-title">{bulkT(locale,'create')}</h1><p>{bulkT(locale,'subtitle')}</p></div>
      <button type="button" className="pay-secondary-action" onClick={()=>void loadHistory()} disabled={loadingHistory}><RefreshCw size={15} className={loadingHistory?'pay-spin':undefined}/>{bulkT(locale,'refresh')}</button>
    </header>

    {loadState==='stale'?<div className="pay-bulk-stale"><Clock3 size={15}/>{bulkT(locale,'stale')}</div>:null}

    <div className="pay-bulk-grid">
      <form className="pay-bulk-panel" onSubmit={event=>void createBatch(event)}>
        <div className="pay-bulk-panel-heading"><div><span className="pay-panel-kicker">{bulkT(locale,'create')}</span><h2>{bulkT(locale,'create')}</h2></div><Send size={19}/></div>
        <label className="pay-bulk-field"><span>{bulkT(locale,'asset')}</span><select value={asset} onChange={event=>setAsset(event.target.value as typeof asset)} disabled={createState==='creating'}>{configs.map(item=><option key={item.asset} value={item.asset}>{item.asset}</option>)}</select></label>
        <div className="pay-bulk-recipients">
          <div className="pay-bulk-table-head"><span>{bulkT(locale,'recipients')}</span><span>{bulkT(locale,'amount')}</span><span aria-hidden="true"/></div>
          {draft.map((row,index)=><div className="pay-bulk-row" key={row.id}>
            <label><span className="sr-only">{bulkT(locale,'recipient')} {index+1}</span><input value={row.recipient} onChange={event=>updateDraft(row.id,'recipient',event.target.value)} placeholder="9x…abc" inputMode="text" autoComplete="off"/></label>
            <label><span className="sr-only">{bulkT(locale,'amount')} {index+1}</span><input value={row.amount} onChange={event=>updateDraft(row.id,'amount',event.target.value)} placeholder={asset==='SOL'?'0.10':'10.00'} inputMode="decimal" autoComplete="off"/></label>
            <button type="button" className="pay-bulk-icon-button" onClick={()=>removeRow(row.id)} disabled={draft.length<=1} aria-label={bulkT(locale,'remove')} title={bulkT(locale,'remove')}><Trash2 size={15}/></button>
          </div>)}
        </div>
        <div className="pay-bulk-actions"><button type="button" className="pay-secondary-action" onClick={addRow} disabled={draft.length>=50}><Plus size={15}/>{bulkT(locale,'addRecipient')}</button><button type="submit" className="pay-primary-action" disabled={createState==='creating'||!canCreate}>{createState==='creating'?<RefreshCw size={15} className="pay-spin"/>:<CheckCircle2 size={15}/>} {bulkT(locale,'createBatch')}</button></div>
        {formError?<div className="pay-bulk-error" role="alert"><CircleAlert size={15}/>{formError}</div>:null}
      </form>

      <div className="pay-bulk-panel">
        <div className="pay-bulk-panel-heading"><div><span className="pay-panel-kicker">{bulkT(locale,'review')}</span><h2>{selected?statusLabel(selected.batch.status):bulkT(locale,'review')}</h2></div><WalletCards size={19}/></div>
        {selected?<div className="pay-bulk-review">
          <div className="pay-bulk-summary-grid">
            <div><span>{bulkT(locale,'sourceWallet')}</span><strong>{selected.batch.source_wallet_address.slice(0,8)}…{selected.batch.source_wallet_address.slice(-8)}</strong></div>
            <div><span>{bulkT(locale,'itemCount')}</span><strong>{selected.batch.item_count}</strong></div>
            <div><span>{bulkT(locale,'total')}</span><strong>{formatAtomic(selected.batch.total_amount_atomic,selectedDecimals)} {selected.batch.asset}</strong></div>
          </div>
          <div className="pay-bulk-review-items">{selected.items.map(item=><div key={item.id}><span>{item.recipient.slice(0,7)}…{item.recipient.slice(-7)}</span><strong>{formatAtomic(item.amount_atomic,selectedDecimals)} {selected.batch.asset}</strong></div>)}</div>
          {selected.batch.status==='ready'?<div className="pay-bulk-sign">
            <label className="pay-bulk-field"><span>{bulkT(locale,'selectWallet')}</span><select value={walletId??''} onChange={event=>setWalletId((event.target.value||null) as SolanaInjectedWalletId|null)}><option value="">{bulkT(locale,'selectWallet')}</option>{wallets.map(wallet=><option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label>
            {wallets.length===0?<div className="pay-bulk-note">{bulkT(locale,'noWallet')}</div>:null}
            <button type="button" className="pay-primary-action pay-bulk-sign-button" onClick={()=>void signBatch()} disabled={flowState==='signing'||flowState==='verifying'}>{flowState==='signing'?<RefreshCw size={16} className="pay-spin"/>:<WalletCards size={16}/>} {flowState==='signing'?bulkT(locale,'signing'):bulkT(locale,'sign')}</button>
          </div>:null}
          {selected.batch.status==='submitted'||selected.batch.status==='verifying'?<div className="pay-bulk-progress" aria-live="polite"><RefreshCw size={18} className="pay-spin"/><div><strong>{bulkT(locale,'waitingVerification')}</strong><p>{bulkT(locale,'submittedDescription')}</p></div></div>:null}
          {selected.batch.status==='completed'?<div className="pay-bulk-success" role="status"><CheckCircle2 size={19}/><div><strong>{bulkT(locale,'completedTitle')}</strong><p>{bulkT(locale,'completedDescription')}</p><dl><dt>{bulkT(locale,'batchId')}</dt><dd>{selected.batch.id}</dd>{selected.batch.transaction_signature?<><dt>{bulkT(locale,'signature')}</dt><dd>{selected.batch.transaction_signature}</dd></>:null}</dl></div></div>:null}
          {selected.batch.status==='failed'?<div className="pay-bulk-error" role="alert"><CircleAlert size={16}/><span>{selected.batch.failure_reason||bulkT(locale,'verifyFailed')}</span></div>:null}
          {flowError?<div className="pay-bulk-error" role="alert"><CircleAlert size={15}/>{flowError}{selected.batch.transaction_signature&&selected.batch.status==='submitted'?<button type="button" className="pay-link-button" onClick={retryVerification}>{bulkT(locale,'retry')}</button>:null}</div>:null}
        </div>:<div className="pay-bulk-empty"><WalletCards size={28}/><strong>{bulkT(locale,'review')}</strong><p>{bulkT(locale,'splitHint')}</p></div>}
      </div>
    </div>

    <div className="pay-bulk-panel pay-bulk-history">
      <div className="pay-bulk-panel-heading"><div><span className="pay-panel-kicker">{bulkT(locale,'history')}</span><h2>{bulkT(locale,'history')}</h2></div></div>
      {batches.length===0?<div className="pay-bulk-empty"><Clock3 size={24}/><div><strong>{bulkT(locale,'noHistory')}</strong></div></div>:<div className="pay-bulk-history-list">{batches.map(batch=><button type="button" key={batch.id} className={'pay-bulk-history-row'+(selected?.batch.id===batch.id?' is-active':'')} onClick={()=>void selectBatch(batch)}><span className="pay-bulk-history-main"><strong>{formatAtomic(batch.total_amount_atomic,decimalsFor(batch.asset,configs))} {batch.asset}</strong><small>{batch.item_count} · {date(batch.created_at,locale)}</small></span><span className={'pay-bulk-status is-'+batch.status}>{statusLabel(batch.status)}</span><ChevronDown size={15}/></button>)}</div>}
    </div>
  </section>;
}
