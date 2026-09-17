import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPayment, type SolanaPaymentProvider } from '../src/pay/services/paymentVerifier';
import { verifyPaymentTransaction, type ExpectedPayment, type ObservedPaymentTransaction, type ObservedTransfer } from '../src/pay/services/verificationPolicy';

const MERCHANT = 'M'.repeat(44);
const FEE = 'F'.repeat(44);
const PAYER = 'P'.repeat(44);
const OTHER = 'O'.repeat(44);
const REFERENCE = 'R'.repeat(44);
const SIGNATURE = '5'.repeat(88);
const OTHER_SIGNATURE = '6'.repeat(88);
const USDC_MINT = 'U'.repeat(44);
const WRONG_MINT = 'W'.repeat(44);
const TOKEN_ACCOUNT = 'T'.repeat(44);

const SOL_EXPECTED: ExpectedPayment = {
  amountAtomic: '1000000000',
  asset: 'SOL',
  tokenMint: null,
  tokenProgram: null,
  tokenDecimals: null,
  merchantDestination: MERCHANT,
  feeDestination: FEE,
  merchantSettlementAtomic: '990000000',
  gatewayFeeAtomic: '10000000',
  reference: REFERENCE,
  requiredCommitment: 'finalized',
};

function transfer(overrides: Partial<ObservedTransfer> = {}): ObservedTransfer {
  return {
    role: 'other',
    source: PAYER,
    sourceAuthority: PAYER,
    destination: MERCHANT,
    destinationAuthority: MERCHANT,
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    amountAtomic: '990000000',
    instructionIndex: 1,
    ...overrides,
  };
}

function validObservation(overrides: Partial<ObservedPaymentTransaction> = {}): ObservedPaymentTransaction {
  return {
    signature: SIGNATURE,
    slot: 1,
    blockTime: '2026-09-17T09:00:00.000Z',
    networkFeeLamports: '5000',
    success: true,
    commitment: 'finalized',
    feePayer: PAYER,
    referenceMatched: true,
    transfers: [
      transfer({ destination: MERCHANT, amountAtomic: '990000000', instructionIndex: 1 }),
      transfer({ destination: FEE, amountAtomic: '10000000', instructionIndex: 2 }),
    ],
    ...overrides,
  };
}

test('payment policy accepts only the exact expected SOL settlement and fee legs', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation());
  assert.deepEqual(result, { valid: true, status: 'confirmed', reason: 'OK' });
});

test('payment policy rejects an underpaid merchant leg', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation({ transfers: [
    transfer({ destination: MERCHANT, amountAtomic: '989999999' }),
    transfer({ destination: FEE, amountAtomic: '10000000', instructionIndex: 2 }),
  ] }));
  assert.deepEqual(result, { valid: false, status: 'underpaid', reason: 'UNDERPAID' });
});

test('payment policy rejects an overpaid merchant leg', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation({ transfers: [
    transfer({ destination: MERCHANT, amountAtomic: '990000001' }),
    transfer({ destination: FEE, amountAtomic: '10000000', instructionIndex: 2 }),
  ] }));
  assert.deepEqual(result, { valid: false, status: 'overpaid', reason: 'OVERPAID' });
});

test('payment policy rejects an underpaid fee leg', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation({ transfers: [
    transfer({ destination: MERCHANT, amountAtomic: '990000000' }),
    transfer({ destination: FEE, amountAtomic: '9999999', instructionIndex: 2 }),
  ] }));
  assert.deepEqual(result, { valid: false, status: 'underpaid', reason: 'UNDERPAID' });
});

test('payment policy rejects an overpaid fee leg', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation({ transfers: [
    transfer({ destination: MERCHANT, amountAtomic: '990000000' }),
    transfer({ destination: FEE, amountAtomic: '10000001', instructionIndex: 2 }),
  ] }));
  assert.deepEqual(result, { valid: false, status: 'overpaid', reason: 'OVERPAID' });
});

test('payment policy rejects a wrong recipient', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation({ transfers: [
    transfer({ destination: OTHER }),
    transfer({ destination: FEE, amountAtomic: '10000000', instructionIndex: 2 }),
  ] }));
  assert.deepEqual(result, { valid: false, status: 'wrong_recipient', reason: 'MERCHANT_TRANSFER_MISMATCH' });
});

test('payment policy rejects a wrong token and token-account destination', () => {
  const expected: ExpectedPayment = {
    ...SOL_EXPECTED,
    amountAtomic: '100000000',
    asset: 'USDC',
    tokenMint: USDC_MINT,
    tokenProgram: 'spl-token',
    tokenDecimals: 6,
    merchantSettlementAtomic: '99000000',
    gatewayFeeAtomic: '1000000',
  };
  const result = verifyPaymentTransaction(expected, {
    ...validObservation(),
    transfers: [
      transfer({ destinationAuthority: TOKEN_ACCOUNT, destination: MERCHANT, asset: 'USDC', tokenMint: WRONG_MINT, tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '99000000' }),
      transfer({ destinationAuthority: TOKEN_ACCOUNT, destination: FEE, asset: 'USDC', tokenMint: USDC_MINT, tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '1000000', instructionIndex: 2 }),
    ],
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'MERCHANT_TRANSFER_MISMATCH');
});

test('payment policy rejects the same merchant and fee destination', () => {
  const result = verifyPaymentTransaction({ ...SOL_EXPECTED, feeDestination: MERCHANT }, validObservation());
  assert.deepEqual(result, { valid: false, status: 'failed', reason: 'DESTINATION_COLLISION' });
});

test('payment policy rejects a sender mismatch between merchant and fee legs', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation({ transfers: [
    transfer({ destination: MERCHANT, sourceAuthority: PAYER }),
    transfer({ destination: FEE, amountAtomic: '10000000', sourceAuthority: OTHER, instructionIndex: 2 }),
  ] }));
  assert.deepEqual(result, { valid: false, status: 'failed', reason: 'SENDER_MISMATCH' });
});

test('payment policy rejects an unexpected sponsor', () => {
  const result = verifyPaymentTransaction({ ...SOL_EXPECTED, expectedSponsorAddress: OTHER }, validObservation());
  assert.deepEqual(result, { valid: false, status: 'failed', reason: 'SPONSOR_MISMATCH' });
});

test('payment policy rejects failed transactions and insufficient commitment', () => {
  assert.deepEqual(verifyPaymentTransaction(SOL_EXPECTED, validObservation({ success: false })), { valid: false, status: 'failed', reason: 'TRANSACTION_FAILED' });
  assert.deepEqual(verifyPaymentTransaction(SOL_EXPECTED, validObservation({ commitment: 'confirmed' })), { valid: false, status: 'verifying', reason: 'COMMITMENT_TOO_LOW' });
});

test('payment policy rejects a missing or mismatched reference', () => {
  assert.deepEqual(verifyPaymentTransaction(SOL_EXPECTED, validObservation({ signature: '' })), { valid: false, status: 'failed', reason: 'MISSING_SIGNATURE' });
  assert.deepEqual(verifyPaymentTransaction(SOL_EXPECTED, validObservation({ referenceMatched: false })), { valid: false, status: 'wrong_recipient', reason: 'REFERENCE_MISMATCH' });
});

test('payment policy rejects ambiguous transfer legs', () => {
  const result = verifyPaymentTransaction(SOL_EXPECTED, validObservation({ transfers: [
    transfer({ destination: MERCHANT, instructionIndex: 1 }),
    transfer({ destination: MERCHANT, instructionIndex: 2 }),
    transfer({ destination: FEE, amountAtomic: '10000000', instructionIndex: 3 }),
  ] }));
  assert.deepEqual(result, { valid: false, status: 'failed', reason: 'AMBIGUOUS_TRANSFER' });
});

test('payment policy rejects duplicate signatures', () => {
  assert.deepEqual(verifyPaymentTransaction(SOL_EXPECTED, validObservation(), true), { valid: false, status: 'duplicate', reason: 'DUPLICATE_SIGNATURE' });
});

test('payment discovery rejects ambiguous valid candidates instead of accepting the first one', async () => {
  const provider: SolanaPaymentProvider = {
    async getTransaction() { return null; },
    async findTransactionsByReference() {
      return [validObservation(), validObservation({ signature: OTHER_SIGNATURE })];
    },
    async getHealth() { return { ok: true, slot: 1, provider: 'test' }; },
  };

  const result = await verifyPayment(provider, SOL_EXPECTED);
  assert.equal(result.result.valid, false);
  assert.equal(result.result.status, 'ambiguous');
  assert.equal(result.result.reason, 'AMBIGUOUS_CANDIDATE');
  assert.equal(result.candidate, null);
  assert.deepEqual(result.checkedSignatures, [SIGNATURE, OTHER_SIGNATURE]);
});
