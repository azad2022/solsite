import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { buildBulkPayoutTransaction } from '../src/pay/services/bulkPayoutTransactionBuilder';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import { verifyBulkPayoutTransaction } from '../src/pay/services/bulkPayoutPolicy';
import type { ObservedPaymentTransaction } from '../src/pay/services/verificationPolicy';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim();
const DEVNET_FUNDER_SECRET = process.env.DEVNET_E2E_FUNDER_SECRET_KEY_B64?.trim();
const EXPECTED_FUNDER = 'EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV';

const DEVNET_RPC_REQUEST_TIMEOUT_MS = 12_000;
const FINALIZED_CONFIRMATION_TIMEOUT_MS = 120_000;
const FINALIZED_CONFIRMATION_POLL_DELAY_MS = 2_000;

// Bound HTTP calls explicitly: web3.js block-height confirmation retries RPC
// errors and can otherwise wait indefinitely for a WebSocket notification.
const devnetTimedFetch: typeof fetch = async (input, init: RequestInit = {}) => {
  const controller = new AbortController();
  const parentSignal = init.signal;
  const forwardAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) forwardAbort();
  else parentSignal?.addEventListener('abort', forwardAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error(`Devnet RPC request exceeded ${DEVNET_RPC_REQUEST_TIMEOUT_MS}ms.`)),
    DEVNET_RPC_REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', forwardAbort);
  }
};

async function confirmFinalized(connection: Connection, signature: string, lastValidBlockHeight?: number): Promise<void> {
  const deadline = Date.now() + FINALIZED_CONFIRMATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const status = response.value[0];
    if (status?.err != null) throw new Error(`Devnet transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === 'finalized') return;

    if (lastValidBlockHeight !== undefined) {
      const blockHeight = await connection.getBlockHeight('confirmed');
      if (blockHeight > lastValidBlockHeight) {
        throw new Error(`Devnet transaction expired before finalization: ${signature}`);
      }
    }

    const remaining = deadline - Date.now();
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(FINALIZED_CONFIRMATION_POLL_DELAY_MS, remaining)));
    }
  }
  throw new Error(`DEVNET_FINALIZED_CONFIRMATION_TIMEOUT after ${FINALIZED_CONFIRMATION_TIMEOUT_MS}ms for signature ${signature}`);
}



function decodeBase58(value:string):Buffer {
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const map=new Map([...alphabet].map((c,i)=>[c,i])); let n=0n;
  for(const c of value){const v=map.get(c);if(v===undefined)throw new Error('Invalid secret encoding.');n=n*58n+BigInt(v);}
  let hex=n.toString(16); if(hex.length%2)hex='0'+hex;
  const raw=hex?Buffer.from(hex,'hex'):Buffer.alloc(0); let zeros=0;
  for(const c of value){if(c!=='1')break;zeros+=1;}
  return Buffer.concat([Buffer.alloc(zeros),raw]);
}
function loadFunder(value:string):Keypair {
  const candidates:Buffer[]=[Buffer.from(value,'base64')];
  try{candidates.push(decodeBase58(value));}catch{}
  for(const bytes of candidates){if(bytes.length!==64)continue;try{const keypair=Keypair.fromSecretKey(bytes);if(keypair.publicKey.toBase58()===EXPECTED_FUNDER)return keypair;}catch{}}
  throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 must contain the existing Devnet funding wallet keypair.');
}

function decode64(value:string):Uint8Array { const b=atob(value); return Uint8Array.from(b,char=>char.charCodeAt(0)); }

function observation(transfers:ObservedPaymentTransaction['transfers'],signature:string):ObservedPaymentTransaction {
  return {signature,slot:1,blockTime:null,networkFeeLamports:'5000',success:true,commitment:'finalized',feePayer:null,referenceMatched:false,transfers};
}

test('real Devnet Bulk Pay SOL batch is discoverable and verified', {skip:!DEVNET_RPC_URL||!DEVNET_FUNDER_SECRET,timeout:300_000}, async()=>{
  if(!DEVNET_RPC_URL||!DEVNET_FUNDER_SECRET) return;
  const connection=new Connection(DEVNET_RPC_URL,{commitment:'confirmed',fetch:devnetTimedFetch,disableRetryOnRateLimit:true});
  const funder=loadFunder(DEVNET_FUNDER_SECRET);
  const source=Keypair.generate();
  const recipientA=Keypair.generate().publicKey;
  const recipientB=Keypair.generate().publicKey;
  const total=2_000_000n;
  const funding=await connection.getLatestBlockhash('finalized');
  const fundingTx=new Transaction({feePayer:funder.publicKey,recentBlockhash:funding.blockhash}).add(
    SystemProgram.transfer({fromPubkey:funder.publicKey,toPubkey:source.publicKey,lamports:Number(total+1_000_000n)}),
  );
  fundingTx.sign(funder);
  const fundingSig=await connection.sendRawTransaction(fundingTx.serialize(),{skipPreflight:false,maxRetries:2});
  await confirmFinalized(connection,fundingSig,funding.lastValidBlockHeight);

  const batch={sourceWalletAddress:source.publicKey.toBase58(),asset:'SOL' as const,tokenMint:null,tokenProgram:null,tokenDecimals:null,totalAmountAtomic:total.toString(),itemCount:2};
  const items=[{recipient:recipientA.toBase58(),amountAtomic:'1000000'},{recipient:recipientB.toBase58(),amountAtomic:'1000000'}];
  const built=await buildBulkPayoutTransaction(batch,items,connection);
  const tx=Transaction.from(decode64(built.transaction));
  assert.equal(tx.feePayer?.toBase58(),source.publicKey.toBase58());
  tx.sign(source);
  const signature=await connection.sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:2});
  await confirmFinalized(connection,signature,built.lastValidBlockHeight);

  const provider=createSolanaRpcProvider({SOLANA_RPC_URL:DEVNET_RPC_URL});
  const observed=await provider.getTransaction(signature,'finalized');
  assert.ok(observed,'finalized Bulk Pay transaction must be observable');
  const decision=verifyBulkPayoutTransaction({...batch,verificationCommitment:'finalized',items},observed);
  assert.equal(decision.valid,true);
  assert.equal(decision.reason,'OK');
  assert.equal(decision.observedTotalAtomic,total.toString());
});
