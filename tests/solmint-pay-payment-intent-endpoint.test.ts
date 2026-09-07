import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/pay/v1/payment-intents/[id]';

const INTENT_ID = '11111111-1111-4111-8111-111111111111';
const MERCHANT_ID = '22222222-2222-4222-8222-222222222222';

const payment = {
  id: INTENT_ID,
  merchant_id: MERCHANT_ID,
  amount_atomic: '1000000000',
  asset: 'SOL',
  token_mint: null,
  token_program: null,
  token_decimals: null,
  recipient: '11111111111111111111111111111111',
  reference: 'REF12345678901234567890123456789012',
  fee_bps: 100,
  fee_payer: 'customer',
  fee_atomic: '10000000',
  gas_sponsored: false,
  status: 'pending',
  expires_at: '2026-09-06T14:00:00.000Z',
  customer_total_atomic: '1010000000',
  network: 'solana',
  verification_commitment: 'finalized',
};

const merchant = { id: MERCHANT_ID, business_name: 'SolMint Merchant', status: 'active' };

function context(request: Request) {
  return {
    request,
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' },
    params: { id: INTENT_ID },
  };
}

test('Pay Payment Intent endpoint validates UUID before database access', async () => {
  const request = new Request('https://solmint.ir/api/pay/v1/payment-intents/not-a-uuid');
  const response = await onRequestGet({
    request,
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' },
    params: { id: 'not-a-uuid' },
  });
  assert.equal(response.status, 400);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, 'PAYMENT_INTENT_ID_INVALID');
});

test('Pay Payment Intent endpoint returns only checkout-safe authoritative fields', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    if (requested.length === 1) return new Response(JSON.stringify([payment]), { status: 200 });
    return new Response(JSON.stringify([merchant]), { status: 200 });
  };

  try {
    const response = await onRequestGet(context(new Request(`https://solmint.ir/api/pay/v1/payment-intents/${INTENT_ID}`)));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };
    assert.equal(body.success, true);
    assert.equal(body.data.amountAtomic, '1000000000');
    assert.equal(body.data.customerTotalAtomic, '1010000000');
    assert.equal(body.data.status, 'pending');
    assert.equal(body.data.verificationCommitment, 'finalized');
    assert.equal('merchantNetAtomic' in body.data, false);
    assert.equal('feeRecipient' in body.data, false);
    assert.equal('merchantSettlementAtomic' in body.data, false);
    assert.match(requested[0], /pay_payment_intents\?select=/);
    assert.match(requested[1], /pay_merchants\?select=id,business_name,status/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Pay Payment Intent endpoint maps missing intent to 404 without exposing database details', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('[]', { status: 200 });

  try {
    const response = await onRequestGet(context(new Request(`https://solmint.ir/api/pay/v1/payment-intents/${INTENT_ID}`)));
    assert.equal(response.status, 404);
    const body = await response.json() as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'PAYMENT_INTENT_NOT_FOUND');
    assert.equal(body.error.message, 'Payment Intent was not found.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
