import { defaultPayHttpClient, PayHttpClient } from '../http';
import type { PaymentAsset, TokenProgram } from '../types/domain';

export type BulkPayoutStatus = 'ready'|'submitted'|'verifying'|'completed'|'failed';
export interface BulkPayoutItem {
  id: string; batch_id: string; line_number: number; recipient: string; amount_atomic: string; status: 'ready'|'submitted'|'completed'|'failed';
  failure_code: string|null; failure_reason: string|null; created_at: string; updated_at: string;
}
export interface BulkPayoutBatch {
  id: string; merchant_id: string; created_by_user_id: string; asset: PaymentAsset; token_mint: string|null; token_program: TokenProgram|null; token_decimals: number|null;
  source_wallet_address: string; total_amount_atomic: string; item_count: number; status: BulkPayoutStatus; transaction_signature: string|null;
  transaction_slot: number|null; transaction_block_time: string|null; failure_code: string|null; failure_reason: string|null;
  verification_commitment: 'finalized'; verification_summary: Record<string, unknown>; created_at: string; updated_at: string;
}
export interface BulkPayoutAssetConfig { asset: PaymentAsset; decimals: number|null; }
export interface BulkPayoutInputItem { recipient: string; amountAtomic: string; }
export interface BulkPayoutTransactionRequest { batchId:string; account:string; blockhash:string; lastValidBlockHeight:number; transaction:string; transactionEncoding:'base64'; transactionType:'legacy'; }
export interface BulkPayoutDetail { batch: BulkPayoutBatch; items: BulkPayoutItem[]; }

interface Envelope<T> { success?: boolean; apiVersion?: string; data?: T; code?: string; message?: string; }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Bulk Pay response.');
  return value as Record<string, unknown>;
}
function batch(value: unknown): BulkPayoutBatch {
  const row=object(value);
  if(typeof row.id!=='string'||typeof row.merchant_id!=='string'||typeof row.created_by_user_id!=='string'||!['SOL','USDC','USDT'].includes(String(row.asset))
    ||typeof row.source_wallet_address!=='string'||typeof row.total_amount_atomic!=='string'||typeof row.item_count!=='number'
    ||!['ready','submitted','verifying','completed','failed'].includes(String(row.status))||typeof row.verification_commitment!=='string'
    ||typeof row.created_at!=='string'||typeof row.updated_at!=='string') throw new TypeError('Invalid Bulk Pay batch response.');
  return row as unknown as BulkPayoutBatch;
}
function items(value: unknown): BulkPayoutItem[] {
  if(!Array.isArray(value)) throw new TypeError('Invalid Bulk Pay items response.');
  return value.map(value=>{
    const row=object(value);
    if(typeof row.id!=='string'||typeof row.batch_id!=='string'||typeof row.line_number!=='number'||typeof row.recipient!=='string'||typeof row.amount_atomic!=='string'||!['ready','submitted','completed','failed'].includes(String(row.status))) throw new TypeError('Invalid Bulk Pay item response.');
    return row as unknown as BulkPayoutItem;
  });
}

export class BulkPayoutService {
  constructor(private readonly client: PayHttpClient=defaultPayHttpClient) {}

  async assets():Promise<BulkPayoutAssetConfig[]> {
    const result=await this.client.request<Envelope<{assets:BulkPayoutAssetConfig[]}>>('/api/pay/v1/payout-batches?assets=1');
    if(!Array.isArray(result.data?.assets)) throw new TypeError('Bulk Pay asset response is invalid.');
    return result.data.assets.map(value=>{
      if(!value||typeof value.asset!=='string'||!['SOL','USDC','USDT'].includes(value.asset)||!(value.decimals===null||typeof value.decimals==='number')) throw new TypeError('Invalid Bulk Pay asset configuration.');
      return value;
    });
  }

  async list(merchantId:string,limit=50):Promise<BulkPayoutBatch[]> {
    const result=await this.client.request<Envelope<{batches:unknown[]}>>('/api/pay/v1/payout-batches?merchantId='+encodeURIComponent(merchantId)+'&limit='+Math.min(100,Math.max(1,Math.trunc(limit))));
    if(!Array.isArray(result.data?.batches)) throw new TypeError('Bulk Pay batch list response is invalid.');
    return result.data.batches.map(batch);
  }

  async get(merchantId:string,batchId:string):Promise<BulkPayoutDetail> {
    const result=await this.client.request<Envelope<{batch:unknown;items:unknown[]}>>('/api/pay/v1/payout-batches/'+encodeURIComponent(batchId)+'?merchantId='+encodeURIComponent(merchantId));
    if(!result.data) throw new TypeError('Bulk Pay batch detail response is invalid.');
    return {batch:batch(result.data.batch),items:items(result.data.items)};
  }

  async create(merchantId:string,asset:PaymentAsset,inputItems:BulkPayoutInputItem[],idempotencyKey:string):Promise<BulkPayoutBatch> {
    const result=await this.client.request<Envelope<{id:string}>>('/api/pay/v1/payout-batches',{
      method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
      body:JSON.stringify({merchantId,asset,items:inputItems}),
    });
    const data=(result as Envelope<unknown>).data;
    return batch(data);
  }

  async transactionRequest(batchId:string,account:string):Promise<BulkPayoutTransactionRequest> {
    const result=await this.client.request<Envelope<BulkPayoutTransactionRequest>>('/api/pay/v1/payout-batches/'+encodeURIComponent(batchId)+'/transaction-request',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account}),
    });
    if(!result.data||typeof result.data.transaction!=='string'||typeof result.data.blockhash!=='string'||typeof result.data.lastValidBlockHeight!=='number') throw new TypeError('Bulk Pay transaction request response is invalid.');
    return result.data;
  }

  async submit(merchantId:string,batchId:string,signature:string,idempotencyKey:string):Promise<BulkPayoutBatch> {
    const result=await this.client.request<Envelope<unknown>>('/api/pay/v1/payout-batches/'+encodeURIComponent(batchId)+'/submit',{
      method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({merchantId,signature}),
    });
    return batch(result.data);
  }

  async verify(batchId:string):Promise<{batch:BulkPayoutBatch;outcome:'completed'|'failed'|'not_detected'|'retryable';verification?:Record<string,unknown>}> {
    const result=await this.client.request<Envelope<{batch:unknown;outcome:'completed'|'failed'|'not_detected'|'retryable';verification?:Record<string,unknown>}>>('/api/pay/v1/payout-batches/'+encodeURIComponent(batchId)+'/verify',{method:'POST'});
    if(!result.data) throw new TypeError('Bulk Pay verification response is invalid.');
    return {batch:batch(result.data.batch),outcome:result.data.outcome,verification:result.data.verification};
  }
}
export const bulkPayoutService=new BulkPayoutService();