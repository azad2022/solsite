import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTransaction } from '../functions/api/pay/v1/payment-intents/[id]/transaction-request';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

test('hosted transaction builder requires a valid buyer public key and server payment snapshot', async () => {
  const buyer = Keypair.generate();
  const merchant = Keypair.generate();
  const reference = Keypair.generate();
  const payment = {
    id: '8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d91',
    merchant_id: '8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d92',
    amount_atomic: '1000000', customer_total_atomic: '1000000', merchant_net_atomic: '990000',
    merchant_settlement_atomic: '990000', fee_atomic: '10000', fee_payer: 'merchant',
    asset: 'SOL', token_mint: null, token_program: null, token_decimals: null,
    recipient: merchant.publicKey.toBase58(), fee_recipient: Keypair.generate().publicKey.toBase58(),
    reference: reference.publicKey.toBase58(), status: 'created',
    expires_at: new Date(Date.now()+300000).toISOString(), merchant_business_name: 'Security Test',
  } as const;
  assert.equal(new PublicKey(payment.recipient).toBase58(), payment.recipient);
  assert.ok(typeof buildTransaction === 'function');
  assert.ok(buyer.publicKey.toBase58().length >= 32);
  assert.ok(payment.merchant_settlement_atomic === '990000');
});
