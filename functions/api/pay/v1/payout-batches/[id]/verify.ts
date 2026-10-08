import { createSolanaRpcProvider } from '../../../../../../src/pay/services/solanaRpcProvider';
import { verifyBulkPayoutTransaction, type BulkPayoutVerificationBatch } from '../../../../../../src/pay/services/bulkPayoutPolicy';
import { makePayRequestId, enforcePayRateLimit, hashCanonicalRequest, payFeatureEnabled, payJson, PayRuntimeError } from '../../../../_shared/runtime';
import { mintPayInternalVerifierJwt, type PayInternalJwtEnv } from '../../../../_shared/internal-jwt';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../../../_shared/identity';
import type { PaymentAsset, TokenProgram } from '../../../../../../src/pay/types/domain';

interface Env extends PayIdentityEnv, PayInternalJwtEnv {
  PAY_API_ENABLED?: string;
  SOLANA_RPC_URL?: string;
  PAY_USDC_MINT?: string;
  PAY_USDT_MINT?: string;
}

function validUuid(value:string):boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

const batchSelect='id,merchant_id,created_by_user_id,asset,token_mint,token_program,token_decimals,source_wallet_address,total_amount_atomic,item_count,status,transaction_signature,transaction_slot,transaction_block_time,failure_code,failure_reason,verification_commitment,verification_summary,created_at,updated_at';

async function loadBatch(env:Env,token:string,batchId:string):Promise<Record<string,unknown>|null> {
  const response=await supabaseRequestAsIdentity(env,token,'/rest/v1/pay_payout_batches?select='+batchSelect+'&id=eq.'+encodeURIComponent(batchId)+'&limit=1');
  const rows=await response.json() as Record<string,unknown>[];
  return rows[0]||null;
}
async function loadItems(env:Env,token:string,batchId:string) {
  const response=await supabaseRequestAsIdentity(env,token,'/rest/v1/pay_payout_items?select=recipient,amount_atomic,status&batch_id=eq.'+encodeURIComponent(batchId)+'&order=line_number.asc&limit=50');
  return await response.json() as Array<Record<string,unknown>>;
}
function failReason(reason:string):string {
  return reason.length>500?reason.slice(0,500):reason;
}

export const onRequestPost=async({request,env,params}:{request:Request;env:Env;params:{id?:string}})=>{
  const requestId=makePayRequestId();
  if(!payFeatureEnabled(env)) return payJson({code:'PAY_API_DISABLED',message:'Pay API is not enabled.'},404,requestId);
  const batchId=String(params?.id||'').trim();
  if(!validUuid(batchId)) return payJson({code:'PAYOUT_BATCH_ID_INVALID',message:'Payout batch ID is invalid.'},400,requestId);

  try {
    const identity=await resolvePayIdentity(request,env);
    const batch=await loadBatch(env,identity.accessToken,batchId);
    if(!batch) return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    const merchantId=typeof batch.merchant_id==='string'?batch.merchant_id:'';
    const access=await supabaseRequestAsIdentity(env,identity.accessToken,'/rest/v1/rpc/pay_has_merchant_access',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_merchant_id:merchantId,p_roles:['owner','admin','finance']})
    });
    if((await access.json())!==true) return payJson({code:'FORBIDDEN',message:'You do not have permission to verify this Bulk Pay batch.'},403,requestId);
    if(!env.SOLANA_RPC_URL || !/^https:\/\//i.test(env.SOLANA_RPC_URL)) return payJson({code:'SOLANA_RPC_MISCONFIGURED',message:'Solana RPC is not configured.'},503,requestId);
    if(!batch.transaction_signature) return payJson({apiVersion:'v1',data:{batch,outcome:'not_detected'}},200,requestId);

    const subjectHash=await hashCanonicalRequest({userId:identity.user.applicationUserId,merchantId,batchId});
    await enforcePayRateLimit(env,'payout-batches:verify',subjectHash,60,12);

    const provider=createSolanaRpcProvider(env,{USDC:env.PAY_USDC_MINT,USDT:env.PAY_USDT_MINT});
    let observed;
    try {
      observed=await provider.getTransaction(String(batch.transaction_signature),'finalized');
    } catch {
      return payJson({apiVersion:'v1',data:{batch,outcome:'retryable'}},503,requestId);
    }
    if(!observed) return payJson({apiVersion:'v1',data:{batch,outcome:'not_detected'}},200,requestId);

    const items=await loadItems(env,identity.accessToken,batchId);
    const expected:BulkPayoutVerificationBatch={
      sourceWalletAddress:String(batch.source_wallet_address),
      asset:String(batch.asset) as PaymentAsset,
      tokenMint:batch.token_mint===null?null:String(batch.token_mint),
      tokenProgram:batch.token_program===null?null:String(batch.token_program) as TokenProgram,
      tokenDecimals:batch.token_decimals===null?null:Number(batch.token_decimals),
      totalAmountAtomic:String(batch.total_amount_atomic),
      itemCount:Number(batch.item_count),
      verificationCommitment:'finalized',
      items:items.map(item=>({recipient:String(item.recipient),amountAtomic:String(item.amount_atomic)})),
    };
    const decision=verifyBulkPayoutTransaction(expected,observed);
    const summary={
      reason:decision.reason,
      valid:decision.valid,
      matchedItemCount:decision.matchedItemCount,
      observedSupportedTransferCount:decision.observedSupportedTransferCount,
      observedTotalAtomic:decision.observedTotalAtomic,
      commitment:observed.commitment,
      slot:observed.slot??null,
      blockTime:observed.blockTime??null,
    };

    const verifierToken=await mintPayInternalVerifierJwt(env,identity.user.applicationUserId);
    const apply=await supabaseRequestAsIdentity(env,verifierToken,'/rest/v1/rpc/pay_apply_payout_verification',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        p_merchant_id:merchantId,
        p_batch_id:batchId,
        p_signature:String(batch.transaction_signature),
        p_status:decision.valid?'completed':'failed',
        p_failure_code:decision.valid?null:'BULK_PAYOUT_VERIFICATION_FAILED',
        p_failure_reason:decision.valid?null:failReason(decision.reason),
        p_slot:observed.slot??null,
        p_block_time:observed.blockTime??null,
        p_verification_summary:summary,
        p_request_id:requestId,
      }),
    });
    const applied=await apply.json() as Record<string,unknown>;
    if(applied.state==='unauthorized') return payJson({code:'VERIFIER_UNAUTHORIZED',message:'Bulk Pay verification is not authorized.'},503,requestId);
    if(applied.state==='not_found') return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    if(applied.state==='signature_mismatch') return payJson({code:'SIGNATURE_CONFLICT',message:'The stored payout signature does not match verification.'},409,requestId);
    if(applied.state==='forbidden') return payJson({code:'FORBIDDEN',message:'Bulk Pay verification is not authorized for this merchant.'},403,requestId);

    const finalBatch=await loadBatch(env,identity.accessToken,batchId);
    return payJson({apiVersion:'v1',data:{batch:finalBatch||batch,outcome:decision.valid?'completed':'failed',verification:summary}},decision.valid?200:422,requestId);
  } catch(error) {
    if(error instanceof PayRuntimeError) return payJson({code:error.code,message:error.message},error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batch:verify',requestId,batchId,error:error instanceof Error?error.message:'unknown'}));
    return payJson({code:'PAYOUT_BATCH_VERIFY_FAILED',message:'Bulk Pay verification could not be completed safely.'},503,requestId);
  }
};