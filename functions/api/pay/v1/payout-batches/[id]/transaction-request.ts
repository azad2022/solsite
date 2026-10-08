import { Connection, PublicKey } from '@solana/web3.js';
import { makePayRequestId, enforcePayRateLimit, payFeatureEnabled, payJson, readJsonBody, PayRuntimeError } from '../../../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../../_shared/identity';
import { buildBulkPayoutTransaction, type BulkPayoutTransactionBatch, type BulkPayoutTransactionItem } from '../../../../../../src/pay/services/bulkPayoutTransactionBuilder';
import type { PaymentAsset, TokenProgram } from '../../../../../../src/pay/types/domain';

interface Env extends PayIdentityEnv { PAY_API_ENABLED?: string; SOLANA_RPC_URL?: string; }
function validUuid(value:string):boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function isAddress(value:unknown): value is string { if(typeof value!=='string') return false; try { new PublicKey(value); return true; } catch { return false; } }

export const onRequestPost = async ({ request, env, params }: { request:Request; env:Env; params:{id?:string} }) => {
  const requestId=makePayRequestId();
  if(!payFeatureEnabled(env)) return payJson({code:'PAY_API_DISABLED',message:'Pay API is not enabled.'},404,requestId);
  const batchId=String(params?.id||'').trim();
  if(!validUuid(batchId)) return payJson({code:'PAYOUT_BATCH_ID_INVALID',message:'Payout batch ID is invalid.'},400,requestId);
  try {
    const identity=await resolvePayIdentity(request,env);
    const body=await readJsonBody(request);
    if(!isAddress(body.account)) return payJson({code:'INVALID_ACCOUNT',message:'A valid wallet account is required.'},400,requestId);
    const account=new PublicKey(body.account);
    const source=request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')||'anonymous';
    await enforcePayRateLimit(env,'payout-batches:transaction-request',batchId + ':' + source,60,6);

    const batchResponse=await supabaseRequestAsIdentity(env,identity.accessToken,
      '/rest/v1/pay_payout_batches?select=id,merchant_id,asset,token_mint,token_program,token_decimals,source_wallet_address,total_amount_atomic,item_count,status,verification_commitment&id=eq.'+encodeURIComponent(batchId)+'&limit=1');
    const batches=await batchResponse.json() as Array<Record<string,unknown>>;
    const row=batches[0];
    if(!row) return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    const merchantId=typeof row.merchant_id==='string'?row.merchant_id:'';
    const access=await supabaseRequestAsIdentity(env,identity.accessToken,'/rest/v1/rpc/pay_has_merchant_access',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_merchant_id:merchantId,p_roles:['owner','admin','finance']})
    });
    if((await access.json())!==true) return payJson({code:'FORBIDDEN',message:'You do not have permission to sign Bulk Pay batches.'},403,requestId);
    if(!['ready','submitted','verifying'].includes(String(row.status))) return payJson({code:'PAYOUT_BATCH_NOT_SIGNABLE',message:'This payout batch is no longer ready for signing.'},409,requestId);
    if(String(row.source_wallet_address)!==account.toBase58()) return payJson({code:'WALLET_MISMATCH',message:'The connected wallet does not match the merchant source wallet.'},409,requestId);

    const itemsResponse=await supabaseRequestAsIdentity(env,identity.accessToken,'/rest/v1/pay_payout_items?select=line_number,recipient,amount_atomic&batch_id=eq.'+encodeURIComponent(batchId)+'&order=line_number.asc&limit=50');
    const items=await itemsResponse.json() as Array<Record<string,unknown>>;
    if(items.length!==Number(row.item_count)) return payJson({code:'PAYOUT_BATCH_INCONSISTENT',message:'The payout batch item count is inconsistent.'},409,requestId);

    const batch:BulkPayoutTransactionBatch={
      sourceWalletAddress:String(row.source_wallet_address),asset:String(row.asset) as PaymentAsset,
      tokenMint:row.token_mint===null?null:String(row.token_mint),
      tokenProgram:row.token_program===null?null:String(row.token_program) as TokenProgram,
      tokenDecimals:row.token_decimals===null?null:Number(row.token_decimals),
      totalAmountAtomic:String(row.total_amount_atomic),itemCount:Number(row.item_count),
    };
    const payoutItems:BulkPayoutTransactionItem[]=items.map(item=>({recipient:String(item.recipient),amountAtomic:String(item.amount_atomic)}));
    if(batch.sourceWalletAddress!==account.toBase58()) return payJson({code:'WALLET_MISMATCH',message:'The connected wallet does not match the merchant source wallet.'},409,requestId);
    if(!env.SOLANA_RPC_URL || !/^https:\/\//i.test(env.SOLANA_RPC_URL)) return payJson({code:'SOLANA_RPC_MISCONFIGURED',message:'Solana RPC is not configured.'},503,requestId);

    const connection=new Connection(env.SOLANA_RPC_URL,'confirmed');
    const built=await buildBulkPayoutTransaction(batch,payoutItems,connection);
    return payJson({apiVersion:'v1',data:{batchId,account:account.toBase58(),blockhash:built.blockhash,lastValidBlockHeight:built.lastValidBlockHeight,transaction:built.transaction,transactionEncoding:'base64',transactionType:'legacy'}},200,requestId);
  } catch(error) {
    if(error instanceof PayRuntimeError) return payJson({code:error.code,message:error.message},error.status,requestId);
    const code=error instanceof Error?error.message:'TRANSACTION_BUILD_FAILED';
    const map:Record<string,[number,string]>={
      SOURCE_TOKEN_ACCOUNT_NOT_FOUND:[409,'The merchant source wallet does not have the required token account.'],
      BATCH_TRANSACTION_TOO_LARGE:[422,'This batch is too large for a single Solana transaction. Create a smaller batch.'],
      TOTAL_AMOUNT_MISMATCH:[409,'The payout batch total is inconsistent.'],
      ITEM_COUNT_MISMATCH:[409,'The payout batch item count is inconsistent.'],
    };
    const [status,message]=map[code]||[422,'Bulk Pay transaction could not be prepared.'];
    console.error(JSON.stringify({scope:'pay:payout-batch:transaction-request',requestId,batchId,code}));
    return payJson({code,message},status,requestId);
  }
};