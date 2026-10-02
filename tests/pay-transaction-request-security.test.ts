import assert from 'node:assert/strict';
import test from 'node:test';
import { Connection, Keypair, PublicKey, SystemInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import { buildTransaction } from '../functions/api/pay/v1/payment-intents/[id]/transaction-request';

test('hosted transaction is always payer-signed and spends only from the supplied buyer account', async () => {
  const buyer = Keypair.generate();
  const merchant = Keypair.generate();
  const feeRecipient = Keypair.generate();
  const reference = Keypair.generate();
  const blockhash = Keypair.generate().publicKey.toBase58();

  const payment = {
    id: '8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d91',
    merchant_id: '8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d92',
    amount_atomic: '1000000',
    customer_total_atomic: '1000000',
    merchant_net_atomic: '990000',
    merchant_settlement_atomic: '990000',
    fee_atomic: '10000',
    fee_payer: 'merchant',
    asset: 'SOL',
    token_mint: null,
    token_program: null,
    token_decimals: null,
    recipient: merchant.publicKey.toBase58(),
    fee_recipient: feeRecipient.publicKey.toBase58(),
    reference: reference.publicKey.toBase58(),
    status: 'created',
    expires_at: new Date(Date.now() + 300000).toISOString(),
    merchant_business_name: 'Security Test',
  } as const;

  const connection = {
    getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 100 }),
  } as unknown as Connection;

  const encoded = await buildTransaction(payment, buyer.publicKey, connection);
  const tx = Transaction.from(Buffer.from(encoded, 'base64'));

  assert.equal(tx.feePayer?.toBase58(), buyer.publicKey.toBase58());
  assert.equal(tx.instructions.length, 2);

  const transfers = tx.instructions.map((instruction) => {
    assert.equal(instruction.programId.toBase58(), SystemProgram.programId.toBase58());
    return SystemInstruction.decodeTransfer(instruction);
  });

  const destinations = transfers.map((transfer) => transfer.toPubkey.toBase58()).sort();
  assert.deepEqual(destinations, [feeRecipient.publicKey.toBase58(), merchant.publicKey.toBase58()].sort());

  const amounts = transfers.map((transfer) => transfer.lamports).sort((a, b) => a - b);
  assert.deepEqual(amounts, [10000, 990000]);
});
