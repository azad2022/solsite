import { PublicKey } from '@solana/web3.js';
import { supabaseRequestAsIdentity } from './identity';
import type { PayIdentityEnv } from './identity';

export interface BulkPayEnv extends PayIdentityEnv {
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
  PAY_USDC_MINT?: string;
  PAY_USDC_DECIMALS?: string;
  PAY_USDT_MINT?: string;
  PAY_USDT_DECIMALS?: string;
  SOLANA_RPC_URL?: string;
}

export interface PayoutBatchRow {
  id:string;
  merchant_id:string;
  created_by_user_id:string;
  asset:'SOL'|'USDC'|'USDT';
  token_mint:string|null;
  token_program:'spl-token'|null;
  token_decimals:number|null;
  source_wallet_address:string;
  total_amount_atomic:string|number;
  item_count:number;
  status:'ready'|'submitted'|'verifying'|'completed'|'failed';
  transaction_signature:string|null;
  transaction_slot:number|null;
  transaction_block_time:string|null;
  failure_code:string|null;
  failure_reason:string|null;
  verification_commitment:'finalized';
  verification_summary:Record<string,unknown>;
  created_at:string;
  updated_at:string;
}

export interface PayoutItemRow {
  id:string;
  batch_id:string;
  line_number:number;
  recipient:string;
  amount_atomic:string|number;
  status:'ready'|'submitted'|'completed'|'failed';
  failure_code:string|null;
  failure_reason:string|null;
  created_at:string;
  updated_at:string;
}

export function isUuid(value:string):boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isSignature(value:string):boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(value);
}

export function assertTrustedOrigin(request:Request, env:BulkPayEnv):void {
  if (!env.PAY_APP_ORIGIN?.trim() || request.headers.get('Origin') !== env.PAY_APP_ORIGIN.trim()) {
    throw new Error('ORIGIN_FORBIDDEN');
  }
}

export async function loadPayoutBatch(
  env:BulkPayEnv,
  accessToken:string,
  merchantId:string,
  batchId:string,
):Promise<PayoutBatchRow|null> {
  const response=await supabaseRequestAsIdentity(
    env,
    accessToken,
    '/rest/v1/pay_payout_batches?select=id,merchant_id,created_by_user_id,asset,token_mint,token_program,token_decimals,source_wallet_address,total_amount_atomic::text,item_count,status,transaction_signature,transaction_slot,transaction_block_time,failure_code,failure_reason,verification_commitment,verification_summary,created_at,updated_at'
      +'&id=eq.'+encodeURIComponent(batchId)
      +'&merchant_id=eq.'+encodeURIComponent(merchantId)
      +'&limit=1',
  );
  const rows=await response.json() as PayoutBatchRow[];
  return rows[0]??null;
}

export async function loadPayoutItems(
  env:BulkPayEnv,
  accessToken:string,
  batchId:string,
):Promise<PayoutItemRow[]> {
  const response=await supabaseRequestAsIdentity(
    env,
    accessToken,
    '/rest/v1/pay_payout_items?select=id,batch_id,line_number,recipient,amount_atomic::text,status,failure_code,failure_reason,created_at,updated_at'
      +'&batch_id=eq.'+encodeURIComponent(batchId)
      +'&order=line_number.asc&limit=50',
  );
  return await response.json() as PayoutItemRow[];
}

export async function loadPayoutDetail(
  env:BulkPayEnv,
  accessToken:string,
  merchantId:string,
  batchId:string,
):Promise<{batch:PayoutBatchRow;items:PayoutItemRow[]}|null> {
  const batch=await loadPayoutBatch(env,accessToken,merchantId,batchId);
  if(!batch)return null;
  return {batch,items:await loadPayoutItems(env,accessToken,batch.id)};
}

export async function loadCurrentReceivingWallet(
  env:BulkPayEnv,
  accessToken:string,
  merchantId:string,
):Promise<string|null> {
  const response=await supabaseRequestAsIdentity(
    env,
    accessToken,
    '/rest/v1/pay_merchant_wallets?select=address'
      +'&merchant_id=eq.'+encodeURIComponent(merchantId)
      +'&wallet_role=eq.receiving&is_active=is.true&verification_status=eq.verified&limit=2',
  );
  const rows=await response.json() as Array<{address?:unknown}>;
  if(rows.length!==1 || typeof rows[0]?.address!=='string')return null;
  try{return new PublicKey(rows[0].address).toBase58();}catch{return null;}
}

export function serializePayoutDetail(detail:{batch:PayoutBatchRow;items:PayoutItemRow[]}):Record<string,unknown>{
  const batch=detail.batch;
  return {
    id:batch.id,
    merchantId:batch.merchant_id,
    createdByUserId:batch.created_by_user_id,
    asset:batch.asset,
    tokenMint:batch.token_mint,
    tokenProgram:batch.token_program,
    tokenDecimals:batch.token_decimals,
    sourceWalletAddress:batch.source_wallet_address,
    totalAmountAtomic:String(batch.total_amount_atomic),
    itemCount:batch.item_count,
    status:batch.status,
    transactionSignature:batch.transaction_signature,
    transactionSlot:batch.transaction_slot,
    transactionBlockTime:batch.transaction_block_time,
    failureCode:batch.failure_code,
    failureReason:batch.failure_reason,
    verificationCommitment:batch.verification_commitment,
    verificationSummary:batch.verification_summary,
    createdAt:batch.created_at,
    updatedAt:batch.updated_at,
    items:detail.items.map(item=>({
      id:item.id,
      batchId:item.batch_id,
      lineNumber:item.line_number,
      recipient:item.recipient,
      amountAtomic:String(item.amount_atomic),
      status:item.status,
      failureCode:item.failure_code,
      failureReason:item.failure_reason,
      createdAt:item.created_at,
      updatedAt:item.updated_at,
    })),
  };
}
