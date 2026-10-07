import { Connection, PublicKey } from '@solana/web3.js';
import { makePayRequestId, payFeatureEnabled, payJson, readJsonBody, PayRuntimeError } from '../../../../_shared/runtime';
import { assertTrustedOrigin, isUuid, loadCurrentReceivingWallet, loadPayoutDetail, type BulkPayEnv } from '../../../../_shared/bulkPayout';
import { resolvePayIdentity } from '../../../../_shared/identity';
import { buildPayoutTransaction } from '../../../../../../../src/pay/services/payoutPolicy';

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
    const account=typeof body.account==='string'?body.account.trim():'';
    let source:PublicKey;
    try{source=new PublicKey(account)}catch{return payJson({code:'WALLET_ADDRESS_INVALID',message:'A valid Solana wallet address is required.'},400,requestId);}

    const detail=await loadPayoutDetail(env,identity.accessToken,merchantId,batchId);
    if(!detail)return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
    if(detail.batch.status!=='ready')return payJson({code:'PAYOUT_BATCH_NOT_READY',message:'This payout batch is no longer ready to build a transaction.'},409,requestId);

    const currentWallet=await loadCurrentReceivingWallet(env,identity.accessToken,merchantId);
    if(!currentWallet)return payJson({code:'WALLET_NOT_READY',message:'A single active verified receiving wallet is required.'},409,requestId);
    if(currentWallet!==detail.batch.source_wallet_address)return payJson({code:'SOURCE_WALLET_CHANGED',message:'The merchant receiving wallet changed after this batch was created. Create a new payout batch.'},409,requestId);
    if(source.toBase58()!==detail.batch.source_wallet_address)return payJson({code:'SOURCE_WALLET_MISMATCH',message:'The connected wallet does not match the batch source wallet.'},403,requestId);

    const rpcUrl=env.SOLANA_RPC_URL?.trim();
    if(!rpcUrl||!/^https:\/\//i.test(rpcUrl))throw new PayRuntimeError('SERVER_MISCONFIGURED',503,'Solana RPC is not configured.');
    const connection=new Connection(rpcUrl,'confirmed');
    const snapshot={
      id:detail.batch.id,
      merchantId:detail.batch.merchant_id,
      asset:detail.batch.asset,
      tokenMint:detail.batch.token_mint,
      tokenProgram:detail.batch.token_program,
      tokenDecimals:detail.batch.token_decimals,
      sourceWalletAddress:detail.batch.source_wallet_address,
      totalAmountAtomic:String(detail.batch.total_amount_atomic),
      itemCount:detail.batch.item_count,
      items:detail.items.map(item=>({recipient:item.recipient,amountAtomic:String(item.amount_atomic)})),
      verificationCommitment:'finalized' as const,
    };
    const built=await buildPayoutTransaction(snapshot,source,connection);
    return payJson({
      apiVersion:'v1',
      success:true,
      transaction:built.transaction,
      sizeBytes:built.sizeBytes,
      message:'Bulk payout transaction is ready for the merchant wallet to sign.',
    },200,requestId);
  }catch(error){
    if(error instanceof PayRuntimeError)return payJson({code:error.code,message:error.status>=500?'Pay service is temporarily unavailable.':error.message},error.status,requestId);
    if(error instanceof Error){
      const mapped:Record<string,[string,string,number]>={
        PAYOUT_TRANSACTION_TOO_LARGE:['PAYOUT_TRANSACTION_TOO_LARGE','This payout batch exceeds the single-transaction size limit. Create a smaller batch.',422],
        SOURCE_TOKEN_ACCOUNT_NOT_FOUND:['SOURCE_TOKEN_ACCOUNT_NOT_FOUND','The merchant wallet does not have the required token account for this asset.',409],
        SOURCE_WALLET_MISMATCH:['SOURCE_WALLET_MISMATCH','The connected wallet does not match the batch source wallet.',403],
        TOKEN_POLICY_UNSUPPORTED:['ASSET_NOT_SUPPORTED','The selected token policy is not supported.',422],
        INVALID_ACCOUNT_DATA:['PAYOUT_TRANSACTION_BUILD_FAILED','The payout transaction could not be built safely.',422],
      };
      const item=mapped[error.message];
      if(item)return payJson({code:item[0],message:item[1]},item[2],requestId);
    }
    console.error(JSON.stringify({scope:'pay:payout-transaction-request',requestId,error:error instanceof Error?error.message.slice(0,300):'unknown'}));
    return payJson({code:'PAYOUT_TRANSACTION_BUILD_FAILED',message:'The payout transaction could not be built safely.'},503,requestId);
  }
};
