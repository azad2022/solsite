import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayCustomerService } from '../src/pay/services/customerService';

const merchantId = '22222222-2222-4222-8222-222222222222';
const customer = {
  merchant_id: merchantId,
  customer_wallet_address: 'HfJ9W4hM3kV7sL2pQ8xN6aB5cD4eF3gH2iJ1kL9mN8p',
  first_seen_at: '2026-09-20T08:00:00.000Z',
  last_seen_at: '2026-09-20T10:00:00.000Z',
  payment_intent_count: '4',
  completed_payment_count: '2',
};

test('customer service consumes the v1 customer projection contract', async () => {
  const calls: string[] = [];
  const service = createPayCustomerService({
    async request(path) {
      calls.push(path);
      return { success: true, apiVersion: 'v1', data: [customer] };
    },
  });

  const result = await service.list(merchantId, { search: customer.customer_wallet_address, limit: 100 });

  assert.equal(calls.length, 1);
  assert.match(calls[0], /^\/api\/pay\/v1\/customers\?/);
  assert.match(calls[0], /merchantId=22222222-2222-4222-8222-222222222222/);
  assert.match(calls[0], /limit=100/);
  assert.match(calls[0], /search=/);
  assert.equal(result[0].payment_intent_count, 4);
  assert.equal(result[0].completed_payment_count, 2);
});

test('customer service rejects a non-UUID merchant id', async () => {
  const service = createPayCustomerService({ async request() { throw new Error('should not call'); } });
  await assert.rejects(() => service.list('invalid'), /Merchant ID is invalid/);
});
