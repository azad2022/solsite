import assert from 'node:assert/strict';
import test from 'node:test';
import { PayHttpClient } from '../src/pay/http';
import { createPayPaymentVerificationService } from '../src/pay/payment-verification-service';
import { verifyPayment } from '../src/pay/services/paymentVerifier';
import type { SolanaPaymentProvider } from '../src/pay/services/blockchainProvider';
import type { ExpectedPayment, ObservedPaymentTransaction } from '../src/pay/services/verificationPolicy';

const SIGNATURE = '5'.repeat(88);
const REFERENCE = 'R'.repeat(44);
const MERCHANT = 'M'.repeat(44);
const FEE = 'F'.repeat(44);

function validObservation(): ObservedPaymentTransaction {
  return {
    signature: SIGNATURE,
    slot: 123,
    blockTime: '2026-09-08T19:00:00.000Z',
    networkFeeLamports: '5000',
    success: true,
    commitment: 'finalized',
    feePayer: 'P'.repeat(44),
    referenceMatched: true,
    transfers: [
      {
        role: 'other', source: 'P'.repeat(44), sourceAuthority: 'P'.repeat(44), destination: MERCHANT, destinationAuthority: MERCHANT,
        asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic: '990000000', instructionIndex: 1,
      },
      {
        role: 'other', source: 'P'.repeat(44), sourceAuthority: 'P'.repeat(44), destination: FEE, destinationAuthority: FEE,
        asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic: '10000000', instructionIndex: 2,
      },
    ],
  };
}

const expected: ExpectedPayment = {
  amountAtomic: '1000000000', asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null,
  merchantDestination: MERCHANT, feeDestination: FEE, merchantSettlementAtomic: '990000000', gatewayFeeAtomic: '10000000',
  reference: REFERENCE, requiredCommitment: 'finalized',
};

test('payment verifier uses reference discovery even when the customer supplies a signature', async () => {
  const calls: string[] = [];
  const provider: SolanaPaymentProvider = {
    async getTransaction() { calls.push('getTransaction'); return null; },
    async findTransactionsByReference(reference, commitment) {
      calls.push(`find:${reference}:${commitment}`);
      return reference === REFERENCE ? [validObservation()] : [];
    },
    async getHealth() { return { ok: true, slot: 1, provider: 'test' }; },
  };

  const result = await verifyPayment(provider, expected, SIGNATURE);
  assert.equal(result.result.valid, true);
  assert.equal(result.candidate?.signature, SIGNATURE);
  assert.deepEqual(calls, [`find:${REFERENCE}:finalized`]);
});

test('payment verification service sends the signature through the same-origin Pay API boundary', async () => {
  const calls: Array<{ url: string; method?: string; body?: string; credentials?: RequestCredentials }> = [];
  const client = new PayHttpClient({
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body as string | undefined, credentials: init?.credentials });
      return new Response(JSON.stringify({ success: true, data: {
        paymentId: '11111111-1111-4111-8111-111111111111',
        status: 'confirmed',
        outcome: 'confirmed',
        signature: SIGNATURE,
        checkedSignatures: [SIGNATURE],
      }}), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const service = createPayPaymentVerificationService(client);
  const result = await service.verify('11111111-1111-4111-8111-111111111111', SIGNATURE);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.outcome, 'confirmed');
  assert.equal(calls[0]?.url, '/api/pay/v1/payment-intents/11111111-1111-4111-8111-111111111111/verify');
  assert.equal(calls[0]?.method, 'POST');
  assert.equal(calls[0]?.credentials, 'include');
  assert.equal(calls[0]?.body, JSON.stringify({ signature: SIGNATURE }));
});
