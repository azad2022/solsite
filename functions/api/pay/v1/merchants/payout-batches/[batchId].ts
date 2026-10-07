import { makePayRequestId, payFeatureEnabled, payJson, PayRuntimeError } from '../../../_shared/runtime';
import { loadPayoutDetail, serializePayoutDetail, type BulkPayEnv, isUuid } from '../../../_shared/bulkPayout';
import { resolvePayIdentity } from '../../../_shared/identity';

export const onRequestGet=async({request,env}:{request:Request;env:BulkPayEnv})=>{
  const requestId=makePayRequestId();
  if(!payFeatureEnabled(env))return payJson({code:'PAY_API_DISABLED',message:'Pay API is not enabled.'},404,requestId);
  try{
    const identity=await resolvePayIdentity(request,env);
    const url=new URL(request.url);
    const merchantId=(url.searchParams.get('merchantId')||'').trim();
    const batchId=String(url.pathname.split('/').filter(Boolean).pop()||'').trim();
    if(!isUuid(merchantId))return payJson({code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.'},400,requestId);
    if(!isUuid(batchId))return payJson({code:'PAYOUT_BATCH_ID_INVALID',message:'Payout batch ID is invalid.'},400,requestId);
    const detail=await loadPayoutDetail(env,identity.accessToken,merchantId,batchId);
    if(!detail)return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    return payJson({apiVersion:'v1',data:serializePayoutDetail(detail)},200,requestId);
  }catch(error){
    if(error instanceof PayRuntimeError)return payJson({code:error.code,message:error.status>=500?'Pay service is temporarily unavailable.':error.message},error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batch-detail',requestId,error:error instanceof Error?error.message.slice(0,300):'unknown'}));
    return payJson({code:'PAYOUT_BATCH_READ_FAILED',message:'Payout batch data could not be loaded.'},503,requestId);
  }
};
