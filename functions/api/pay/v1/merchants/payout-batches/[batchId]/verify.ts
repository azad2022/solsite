import { makePayRequestId, enforcePayRateLimit, hashCanonicalRequest, payFeatureEnabled, payJson, PayRuntimeError } from '../../../../_shared/runtime';
import { assertTrustedOrigin, isSignature, isUuid, loadPayoutDetail, serializePayoutDetail, type BulkPayEnv } from '../../../../_shared/bulkPayout';
import { resolvePayIdentity, supabaseRequestAsIdentity } from '../../../../_shared/identity';
import { mintPayVerifierJwt } from '../../../../_shared/internal-jwt';
import { createSolanaRpcProvider } from '../../../../../../../src/pay/services/solanaRpcProvider';
import { verifyPayoutObservation } from '../../../../../../../src/pay/services/payoutPolicy';

export const onRequestPost=async({request,env}:{request:Request;env:BulkPayEnv})=>{
  const requestId=makePayRequestId();
  if(!payFeatureEnabled(env))return payJson({code:'PAY_API_DISABLED',message:'Pay API is not enabled.'},404,requestId);
  try{
    assertTrustedOrigin(request,env);
    const identity=await resolvePayIdentity(request,env);
    const url=new URL(request.url);
    const merchantId=(url.searchParams.get('merchantId')||'').trim();
    const batchId=String(url.pathname.split('/').filter(Boolean).pop()||'').trim();
    if(!isUuid(merchantId))return payJson({code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.'},400,requestId);
    if(!isUuid(batchId))return payJson({code:'PAYOUT_BATCH_ID_INVALID',message:'Payout batch ID is invalid.'},400,requestId);

    const detail=await loadPayoutDetail(env,identity.accessToken,merchantId,batchId);
    if(!detail)return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    if(detail.batch.status==='completed'||detail.batch.status==='failed'){
      return payJson({apiVersion:'v1',data:serializePayoutDetail(detail),outcome:detail.batch.status},200,requestId);
    }
    const signature=detail.batch.transaction_signature||'';
    if(!isSignature(signature))return payJson({code:'PAYOUT_NOT_SUBMITTED',message:'The payout transaction has not been submitted yet.'},409,requestId);
    const subjectHash=await hashCanonicalRequest({userId:identity.user.applicationUserId,batchId,signature});
    await enforcePayRateLimit(env,'payout-batches:verify:user',subjectHash,60,20);

    const rpcUrl=env.SOLANA_RPC_URL?.trim();
    if(!rpcUrl||!/^https:\/\//i.test(rpcUrl))throw new PayRuntimeError('SERVER_MISCONFIGURED',503,'Solana RPC is not configured.');
    const provider=createSolanaRpcProvider({SOLANA_RPC_URL:rpcUrl},{
      USDC:env.PAY_USDC_MINT?.trim(),
      USDT:env.PAY_USDT_MINT?.trim(),
    });
    const observation=await provider.getTransaction(signature,'finalized');
    if(!observation){
      return payJson({apiVersion:'v1',data:serializePayoutDetail(detail),outcome:'confirmation_pending'},200,requestId);
    }

    const snapshot={
      id:detail.batch.id,merchantId:detail.batch.merchant_id,asset:detail.batch.asset,
      tokenMint:detail.batch.token_mint,tokenProgram:detail.batch.token_program,tokenDecimals:detail.batch.token_decimals,
      sourceWalletAddress:detail.batch.source_wallet_address,totalAmountAtomic:String(detail.batch.total_amount_atomic),itemCount:detail.batch.item_count,
      items:detail.items.map(item=>({recipient:item.recipient,amountAtomic:String(item.amount_atomic)})),
      verificationCommitment:'finalized' as const,
    };
    const verification=verifyPayoutObservation(snapshot,observation);
    const verifierToken=await mintPayVerifierJwt(env,identity.user.applicationUserId);
    const apply=await supabaseRequestAsIdentity(
      env,verifierToken,'/rest/v1/rpc/pay_apply_payout_verification',
      {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({
        p_merchant_id:merchantId,p_batch_id:batchId,p_signature:signature,p_status:verification.status,
        p_failure_code:verification.status==='failed'?verification.reason:null,
        p_failure_reason:verification.status==='failed'?verification.reason:null,
        p_slot:observation.slot??null,p_block_time:observation.blockTime??null,
        p_verification_summary:{
          commitment:observation.commitment,success:observation.success,feePayer:observation.feePayer,
          observedTransferCount:observation.transfers.length,checkedAt:new Date().toISOString(),verificationReason:verification.reason,
        },
        p_request_id:requestId,
      })},
    );
    const applied=await apply.json() as Record<string,unknown>;
    const finalDetail=await loadPayoutDetail(env,identity.accessToken,merchantId,batchId);
    if(!finalDetail)return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    if(applied.state==='forbidden')return payJson({code:'FORBIDDEN',message:'You are not allowed to verify this payout batch.'},403,requestId);
    if(applied.state==='signature_mismatch')return payJson({code:'SIGNATURE_MISMATCH',message:'The verified transaction does not match this payout batch.'},409,requestId);
    if(applied.state==='not_found')return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    if(applied.state==='already_final'||applied.state==='updated'){
      return payJson({apiVersion:'v1',data:serializePayoutDetail(finalDetail),outcome:verification.status},200,requestId);
    }
    throw new PayRuntimeError('PAYOUT_VERIFICATION_FAILED',503,'Payout verification could not be recorded safely.');
  }catch(error){
    if(error instanceof PayRuntimeError)return payJson({code:error.code,message:error.status>=500?'Pay service is temporarily unavailable.':error.message},error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batch-verify',requestId,error:error instanceof Error?error.message.slice(0,300):'unknown'}));
    return payJson({code:'PAYOUT_VERIFICATION_FAILED',message:'Payout verification is temporarily unavailable.'},503,requestId);
  }
};
