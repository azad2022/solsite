import { defaultPayHttpClient, type PayHttpClient } from '../http';

export type BulkPayoutAsset='SOL'|'USDC'|'USDT';
export type BulkPayoutBatchStatus='ready'|'submitted'|'verifying'|'completed'|'failed';
export type BulkPayoutItemStatus='ready'|'submitted'|'completed'|'failed';

export interface BulkPayoutItem {
  id:string;
  batchId:string;
  lineNumber:number;
  recipient:string;
  amountAtomic:string;
  status:BulkPayoutItemStatus;
  failureCode:string|null;
  failureReason:string|null;
  createdAt:string;
  updatedAt:string;
}

export interface BulkPayoutBatchSummary {
  id:string;
  merchantId:string;
  asset:BulkPayoutAsset;
  tokenMint:string|null;
  tokenProgram:'spl-token'|null;
  tokenDecimals:number|null;
  sourceWalletAddress:string;
  totalAmountAtomic:string;
  itemCount:number;
  status:BulkPayoutBatchStatus;
  transactionSignature:string|null;
  transactionSlot:number|null;
  transactionBlockTime:string|null;
  failureCode:string|null;
  failureReason:string|null;
  verificationCommitment:'finalized';
  createdAt:string;
  updatedAt:string;
}

export interface BulkPayoutBatch extends BulkPayoutBatchSummary {
  createdByUserId:string;
  verificationSummary:Record<string,unknown>;
  items:BulkPayoutItem[];
}

interface Envelope<T>{apiVersion?:string;data?:T;meta?:unknown;outcome?:string;success?:boolean}

function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid Bulk Pay response.');
  return value as Record<string,unknown>;
}
function string(value:unknown,name:string,nullable=false):string{
  if(nullable&&value===null)return '';
  if(typeof value!=='string'||!value.trim())throw new TypeError('Invalid Bulk Pay field: '+name);
  return value;
}
function nullableString(value:unknown,name:string):string|null{
  if(value===null)return null;
  return string(value,name);
}
function numberValue(value:unknown,name:string):number{
  if(typeof value!=='number'||!Number.isInteger(value))throw new TypeError('Invalid Bulk Pay field: '+name);
  return value;
}
function parseItem(value:unknown):BulkPayoutItem{
  const row=record(value);
  const status=string(row.status,'status');
  if(!['ready','submitted','completed','failed'].includes(status))throw new TypeError('Invalid Bulk Pay item status.');
  return {
    id:string(row.id,'id'),batchId:string(row.batchId,'batchId'),lineNumber:numberValue(row.lineNumber,'lineNumber'),
    recipient:string(row.recipient,'recipient'),amountAtomic:string(row.amountAtomic,'amountAtomic'),
    status:status as BulkPayoutItemStatus,failureCode:nullableString(row.failureCode,'failureCode'),failureReason:nullableString(row.failureReason,'failureReason'),
    createdAt:string(row.createdAt,'createdAt'),updatedAt:string(row.updatedAt,'updatedAt'),
  };
}
function parseSummary(value:unknown):BulkPayoutBatchSummary{
  const row=record(value);
  const asset=string(row.asset,'asset');
  if(!['SOL','USDC','USDT'].includes(asset))throw new TypeError('Invalid Bulk Pay asset.');
  const status=string(row.status,'status');
  if(!['ready','submitted','verifying','completed','failed'].includes(status))throw new TypeError('Invalid Bulk Pay batch status.');
  const program=row.tokenProgram===null?null:string(row.tokenProgram,'tokenProgram');
  if(program!==null&&program!=='spl-token')throw new TypeError('Invalid Bulk Pay token program.');
  return {
    id:string(row.id,'id'),merchantId:string(row.merchantId,'merchantId'),asset:asset as BulkPayoutAsset,
    tokenMint:nullableString(row.tokenMint,'tokenMint'),tokenProgram:program,
    tokenDecimals:row.tokenDecimals===null?null:numberValue(row.tokenDecimals,'tokenDecimals'),
    sourceWalletAddress:string(row.sourceWalletAddress,'sourceWalletAddress'),totalAmountAtomic:string(row.totalAmountAtomic,'totalAmountAtomic'),
    itemCount:numberValue(row.itemCount,'itemCount'),status:status as BulkPayoutBatchStatus,
    transactionSignature:nullableString(row.transactionSignature,'transactionSignature'),
    transactionSlot:row.transactionSlot===null?null:numberValue(row.transactionSlot,'transactionSlot'),
    transactionBlockTime:nullableString(row.transactionBlockTime,'transactionBlockTime'),
    failureCode:nullableString(row.failureCode,'failureCode'),failureReason:nullableString(row.failureReason,'failureReason'),
    verificationCommitment:'finalized',createdAt:string(row.createdAt,'createdAt'),updatedAt:string(row.updatedAt,'updatedAt'),
  };
}
function parseBatch(value:unknown):BulkPayoutBatch{
  const row=record(value);
  const summary=parseSummary(row);
  return {
    ...summary,
    createdByUserId:string(row.createdByUserId,'createdByUserId'),
    verificationSummary:row.verificationSummary&&typeof row.verificationSummary==='object'&&!Array.isArray(row.verificationSummary)?row.verificationSummary as Record<string,unknown>:{},
    items:Array.isArray(row.items)?row.items.map(parseItem):[],
  };
}
function parseSingle<T>(payload:unknown, parser:(value:unknown)=>T):T{
  const envelope=record(payload) as Envelope<unknown>;
  return parser(envelope.data);
}

export function createBulkPayoutService(httpClient:PayHttpClient=defaultPayHttpClient){
  const base=(merchantId:string)=>'/api/pay/v1/merchants/payout-batches?merchantId='+encodeURIComponent(merchantId);
  return {
    async list(merchantId:string,limit=50):Promise<BulkPayoutBatchSummary[]>{
      const payload=await httpClient.request<Envelope<unknown[]>>(base(merchantId)+'&limit='+String(limit));
      const envelope=record(payload);
      if(!Array.isArray(envelope.data))throw new TypeError('Invalid Bulk Pay list response.');
      return envelope.data.map(parseSummary);
    },
    async get(merchantId:string,batchId:string):Promise<BulkPayoutBatch>{
      const payload=await httpClient.request<Envelope<unknown>>(base(merchantId)+'&batchId='+encodeURIComponent(batchId));
      return parseSingle(payload,parseBatch);
    },
    async create(merchantId:string,input:{asset:BulkPayoutAsset;items:Array<{recipient:string;amount:string}>}):Promise<BulkPayoutBatch>{
      const payload=await httpClient.request<Envelope<unknown>>(base(merchantId),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(input),
      });
      return parseSingle(payload,parseBatch);
    },
    async transactionRequest(merchantId:string,batchId:string,account:string):Promise<{transaction:string;sizeBytes:number;message:string}>{
      const payload=await httpClient.request<{success?:boolean;transaction?:unknown;sizeBytes?:unknown;message?:unknown}>(
        '/api/pay/v1/merchants/payout-batches/'+encodeURIComponent(batchId)+'/transaction-request?merchantId='+encodeURIComponent(merchantId),
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account})},
      );
      if(payload.success!==true||typeof payload.transaction!=='string'||!payload.transaction.trim()||typeof payload.sizeBytes!=='number'||!Number.isInteger(payload.sizeBytes)||typeof payload.message!=='string'){
        throw new TypeError('Invalid Bulk Pay transaction request response.');
      }
      return {transaction:payload.transaction,sizeBytes:payload.sizeBytes,message:payload.message};
    },
    async submit(merchantId:string,batchId:string,signature:string):Promise<BulkPayoutBatch>{
      const payload=await httpClient.request<Envelope<unknown>>(
        '/api/pay/v1/merchants/payout-batches/'+encodeURIComponent(batchId)+'/submit?merchantId='+encodeURIComponent(merchantId),
        {method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({signature})},
      );
      return parseSingle(payload,parseBatch);
    },
    async verify(merchantId:string,batchId:string):Promise<{batch:BulkPayoutBatch;outcome:string}>{
      const payload=await httpClient.request<Envelope<unknown>>(
        '/api/pay/v1/merchants/payout-batches/'+encodeURIComponent(batchId)+'/verify?merchantId='+encodeURIComponent(merchantId),
        {method:'POST',headers:{'Content-Type':'application/json'}},
      );
      const envelope=record(payload);
      return {batch:parseBatch(envelope.data),outcome:typeof envelope.outcome==='string'?envelope.outcome:'unknown'};
    },
  };
}

export const bulkPayoutService=createBulkPayoutService();
