import {
  assertIdempotencyKey,
  enforcePayRateLimit,
  hashCanonicalRequest,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  readJsonBody,
  PayRuntimeError,
} from '../../../../../../_shared/runtime';
import { assertTrustedOrigin, isSignature, isUuid, loadPayoutDetail, serializePayoutDetail, type BulkPayEnv } from '../../../../../../_shared/bulkPayout';
import { resolvePayIdentity, supabaseRequestAsIdentity } from '../../../../../../_shared/identity';

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
    const body=await readJsonBody(request);
    const signature=typeof body.signature==='string'?body.signature.trim():'';
    if(!isSignature(signature))return payJson({code:'INVALID_SIGNATURE',message:'A valid Solana transaction signature is required.'},400,requestId);

    const detail=await loadPayoutDetail(env,identity.accessToken,merchantId,batchId);
    if(!detail)return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);

    const idempotencyKey=await assertIdempotencyKey(request);
    const requestHash=await hashCanonicalRequest({merchantId,batchId,signature});
    const subjectHash=await hashCanonicalRequest({userId:identity.user.applicationUserId,batchId});
    await enforcePayRateLimit(env,'payout-batches:submit:user',subjectHash,60,10);

    const response=await supabaseRequestAsIdentity(
      env,identity.accessToken,'/rest/v1/rpc/pay_submit_payout_batch',
      {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({
        p_merchant_id:merchantId,p_batch_id:batchId,p_signature:signature,p_idempotency_key:idempotencyKey,p_request_hash:requestHash,
      })},
    );
    const result=await response.json() as Record<string,unknown>;
    const state=String(result.state||'error');
    if(state==='submitted'||state==='replay')return payJson(result.response_body||{},Number(result.response_status)||202,requestId);
    if(state==='in_progress')return payJson({code:'REQUEST_IN_PROGRESS',message:'An identical payout submission is already being processed.'},409,requestId);
    if(state==='conflict'||state==='signature_conflict')return payJson({code:state==='signature_conflict'?'SIGNATURE_CONFLICT':'IDEMPOTENCY_CONFLICT',message:'The payout submission conflicts with an existing operation.'},409,requestId);
    if(state==='not_found')return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    if(state==='forbidden')return payJson({code:'FORBIDDEN',message:'You are not allowed to submit this payout batch.'},403,requestId);
    if(state==='not_submitable')return payJson({code:'PAYOUT_BATCH_NOT_SUBMITTABLE',message:'This payout batch cannot accept another transaction.'},409,requestId);
    if(state==='invalid')return payJson({code:'INVALID_PAYOUT_SUBMISSION',message:'Payout submission data is invalid.'},400,requestId);
    throw new PayRuntimeError('PAYOUT_SUBMISSION_FAILED',503,'Payout submission failed safely.');
  }catch(error){
    if(error instanceof PayRuntimeError)return payJson({code:error.code,message:error.status>=500?'Pay service is temporarily unavailable.':error.message},error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batch-submit',requestId,error:error instanceof Error?error.message.slice(0,300):'unknown'}));
    return payJson({code:'PAYOUT_SUBMISSION_FAILED',message:'Payout transaction could not be submitted.'},503,requestId);
  }
};
