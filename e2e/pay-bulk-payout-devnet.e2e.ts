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
async function confirm(connection:Connection,signature:string,blockhash:string,lastValidBlockHeight:number){
  const result=await connection.confirmTransaction({signature,blockhash,lastValidBlockHeight},'finalized');
  assert.equal(result.value.err,null);
}
function decode64(value:string):Uint8Array { const b=atob(value); return Uint8Array.from(b,char=>char.charCodeAt(0)); }

function observation(transfers:ObservedPaymentTransaction['transfers'],signature:string):ObservedPaymentTransaction {
  return {signature,slot:1,blockTime:null,networkFeeLamports:'5000',success:true,commitment:'finalized',feePayer:null,referenceMatched:false,transfers};
}

test('real Devnet Bulk Pay SOL batch is discoverable and verified', {skip:!DEVNET_RPC_URL||!DEVNET_FUNDER_SECRET,timeout:300_000}, async()=>{
  if(!DEVNET_RPC_URL||!DEVNET_FUNDER_SECRET) return;
  const connection=new Connection(DEVNET_RPC_URL,'confirmed');
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
  await confirm(connection,fundingSig,funding.blockhash,funding.lastValidBlockHeight);

  const batch={sourceWalletAddress:source.publicKey.toBase58(),asset:'SOL' as const,tokenMint:null,tokenProgram:null,tokenDecimals:null,totalAmountAtomic:total.toString(),itemCount:2};
  const items=[{recipient:recipientA.toBase58(),amountAtomic:'1000000'},{recipient:recipientB.toBase58(),amountAtomic:'1000000'}];
  const built=await buildBulkPayoutTransaction(batch,items,connection);
  const tx=Transaction.from(decode64(built.transaction));
  assert.equal(tx.feePayer?.toBase58(),source.publicKey.toBase58());
  tx.sign(source);
  const signature=await connection.sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:2});
  await confirm(connection,signature,built.blockhash,built.lastValidBlockHeight);

  const provider=createSolanaRpcProvider({SOLANA_RPC_URL:DEVNET_RPC_URL});
  const observed=await provider.getTransaction(signature,'finalized');
  assert.ok(observed,'finalized Bulk Pay transaction must be observable');
  const decision=verifyBulkPayoutTransaction({...batch,verificationCommitment:'finalized',items},observed);
  assert.equal(decision.valid,true);
  assert.equal(decision.reason,'OK');
  assert.equal(decision.observedTotalAtomic,total.toString());
});
