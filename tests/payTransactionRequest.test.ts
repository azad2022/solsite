import assert from 'node:assert/strict';
import { Connection, Keypair, PublicKey, SystemInstruction, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import test from 'node:test';
import { buildTransaction, validatePayment, type PaymentRow } from '../functions/api/pay/v1/payment-intents/[id]/transaction-request';

const BUYER = Keypair.generate().publicKey;
const MERCHANT = Keypair.generate().publicKey;
const FEE = Keypair.generate().publicKey;
const REFERENCE = Keypair.generate().publicKey;

function row(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
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
    recipient: MERCHANT.toBase58(),
    fee_recipient: FEE.toBase58(),
    reference: REFERENCE.toBase58(),
    status: 'created',
    expires_at: new Date(Date.now() + 300000).toISOString(),
    merchant_business_name: 'Contract Test Merchant',
    ...overrides,
  };
}

test('transaction request preserves authoritative financial invariants and embeds the Pay reference', async () => {
  const payment = row();
  validatePayment(payment);

  const connection = {
    async getLatestBlockhash() {
      return { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1 };
    },
  } as unknown as Connection;

  const encoded = await buildTransaction(payment, BUYER, connection);
  const transaction = Transaction.from(Buffer.from(encoded, 'base64'));
  const compiled = transaction.compileMessage();

  assert.equal(transaction.feePayer?.toBase58(), BUYER.toBase58());
  assert.ok(compiled.accountKeys.some((key) => key.equals(REFERENCE)));
  assert.equal(transaction.instructions.length, 2);
  assert.equal(transaction.instructions[0].programId.toBase58(), SystemProgram.programId.toBase58());
  assert.equal(transaction.instructions[1].programId.toBase58(), SystemProgram.programId.toBase58());
  assert.equal(transaction.instructions[0].keys[2]?.pubkey.toBase58(), REFERENCE.toBase58());
  assert.equal(transaction.instructions[0].keys[2]?.isSigner, false);
  assert.equal(transaction.instructions[0].keys[2]?.isWritable, false);
  assert.equal(transaction.instructions[1].keys[2]?.pubkey.toBase58(), REFERENCE.toBase58());
  assert.equal(transaction.instructions[1].keys[2]?.isSigner, false);
  assert.equal(transaction.instructions[1].keys[2]?.isWritable, false);
  assert.ok(transaction.instructions[0] instanceof TransactionInstruction);

  const merchantTransfer = SystemInstruction.decodeTransfer(transaction.instructions[0]);
  const feeTransfer = SystemInstruction.decodeTransfer(transaction.instructions[1]);
  assert.equal(merchantTransfer.lamports, 990000n);
  assert.equal(feeTransfer.lamports, 10000n);
  assert.equal(merchantTransfer.fromPubkey.toBase58(), BUYER.toBase58());
  assert.equal(merchantTransfer.toPubkey.toBase58(), MERCHANT.toBase58());
  assert.equal(feeTransfer.fromPubkey.toBase58(), BUYER.toBase58());
  assert.equal(feeTransfer.toPubkey.toBase58(), FEE.toBase58());

  assert.throws(
    () => validatePayment(row({ customer_total_atomic: '1000001' })),
    /PAYMENT_TOTAL_MISMATCH/,
  );
  assert.throws(
    () => validatePayment(row({ reference: 'invalid-reference' })),
    /PAYMENT_REFERENCE_INVALID/,
  );
});

test('transaction request enforces customer-paid gateway fee snapshot semantics', () => {
  validatePayment(row({
    amount_atomic: '1000000',
    customer_total_atomic: '1010000',
    merchant_net_atomic: '1000000',
    merchant_settlement_atomic: '1000000',
    fee_atomic: '10000',
    fee_payer: 'customer',
  }));

  assert.throws(
    () => validatePayment(row({ fee_payer: 'customer', amount_atomic: '1010000' })),
    /PAYMENT_TOTAL_MISMATCH/,
  );
});
