import { makePayRequestId, assertIdempotencyKey, enforcePayRateLimit, hashCanonicalRequest, payFeatureEnabled, payJson, readJsonBody, PayRuntimeError } from '../../../../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../../../_shared/identity';

interface Env extends PayIdentityEnv { PAY_API_ENABLED?: string; }
function validUuid(value:string):boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function validSignature(value:unknown): value is string { return typeof value==='string' && /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(value.trim()); }

export const onRequestPost = async ({ request, env, params }: { request:Request; env:Env; params:{id?:string} }) => {
  const requestId=makePayRequestId();
  if(!payFeatureEnabled(env)) return payJson({code:'PAY_API_DISABLED',message:'Pay API is not enabled.'},404,requestId);
  const batchId=String(params?.id||'').trim();
  if(!validUuid(batchId)) return payJson({code:'PAYOUT_BATCH_ID_INVALID',message:'Payout batch ID is invalid.'},400,requestId);
  try {
    const identity=await resolvePayIdentity(request,env);
    const body=await readJsonBody(request);
    if(!validSignature(body.signature)) return payJson({code:'INVALID_SIGNATURE',message:'A valid transaction signature is required.'},400,requestId);
    const merchantId=typeof body.merchantId==='string'?body.merchantId.trim():'';
    if(!validUuid(merchantId)) return payJson({code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.'},400,requestId);
    const idempotencyKey=await assertIdempotencyKey(request);
    const signature=body.signature.trim();
    const requestHash=await hashCanonicalRequest({merchantId,batchId,signature});
    const subjectHash=await hashCanonicalRequest({userId:identity.user.applicationUserId,merchantId,batchId});
    await enforcePayRateLimit(env,'payout-batches:submit',subjectHash,60,6);

    const access=await supabaseRequestAsIdentity(env,identity.accessToken,'/rest/v1/rpc/pay_has_merchant_access',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_merchant_id:merchantId,p_roles:['owner','admin','finance']})
    });
    if((await access.json())!==true) return payJson({code:'FORBIDDEN',message:'You do not have permission to submit this Bulk Pay batch.'},403,requestId);

    const resultResponse=await supabaseRequestAsIdentity(env,identity.accessToken,'/rest/v1/rpc/pay_submit_payout_batch',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({p_merchant_id:merchantId,p_batch_id:batchId,p_signature:signature,p_idempotency_key:idempotencyKey,p_request_hash:requestHash}),
    });
    const result=await resultResponse.json() as any;
    if(result?.state==='unauthorized') return payJson({code:'UNAUTHORIZED',message:'A valid SolMint session is required.'},401,requestId);
    if(result?.state==='forbidden') return payJson({code:'FORBIDDEN',message:'You do not have permission to submit this Bulk Pay batch.'},403,requestId);
    if(result?.state==='not_found') return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    if(result?.state==='invalid') return payJson({code:'INVALID_REQUEST',message:'Bulk Pay submission is invalid.'},400,requestId);
    if(result?.state==='conflict') return payJson({code:'IDEMPOTENCY_CONFLICT',message:'The idempotency key was already used with different request data.'},409,requestId);
    if(result?.state==='in_progress') return payJson({code:'REQUEST_IN_PROGRESS',message:'The same submission is already being processed.'},409,requestId);
    if(result?.state==='signature_conflict') return payJson({code:'SIGNATURE_CONFLICT',message:'A different transaction signature is already recorded for this batch.'},409,requestId);
    if(result?.state==='not_submitable') return payJson({code:'PAYOUT_BATCH_NOT_SUBMITABLE',message:'This payout batch cannot be submitted in its current state.'},409,requestId);
    if(result?.state==='submitted'||result?.state==='replay') return payJson(result.response_body||{code:'PAYOUT_BATCH_RESPONSE_INVALID',message:'Invalid payout batch response.'},result.response_status||202,requestId);
    return payJson({code:'PAYOUT_BATCH_SUBMIT_FAILED',message:'Bulk Pay submission could not be completed.'},503,requestId);
  } catch(error) {
    if(error instanceof PayRuntimeError) return payJson({code:error.code,message:error.message},error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batch:submit',requestId,batchId,error:error instanceof Error?error.message:'unknown'}));
    return payJson({code:'PAYOUT_BATCH_SUBMIT_FAILED',message:'Bulk Pay submission could not be completed safely.'},503,requestId);
  }
};