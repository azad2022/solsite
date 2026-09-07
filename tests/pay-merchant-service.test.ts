import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayMerchantService } from '../src/pay/services/merchantService';
import { PayHttpClient } from '../src/pay/http';

function clientFor(payload: unknown, status = 200) {
  return new PayHttpClient({
    fetchImpl: (async () => new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'x-request-id': 'test-request' },
    })) as typeof fetch,
  });
}

test('parses the current authenticated merchant response', async () => {
  const service = createPayMerchantService(clientFor({
    merchant: {
      id: 'merchant-1',
      owner_user_id: 'user-1',
      business_name: 'SolMint Store',
      slug: 'solmint-store',
      status: 'active',
      created_at: '2026-09-07T00:00:00Z',
      updated_at: '2026-09-07T01:00:00Z',
    },
  }));

  assert.deepEqual(await service.getCurrent(), {
    id: 'merchant-1',
    ownerUserId: 'user-1',
    businessName: 'SolMint Store',
    slug: 'solmint-store',
    status: 'active',
    createdAt: '2026-09-07T00:00:00Z',
    updatedAt: '2026-09-07T01:00:00Z',
  });
});

test('accepts an explicit empty merchant result', async () => {
  const service = createPayMerchantService(clientFor({ merchant: null }));
  assert.equal(await service.getCurrent(), null);
});

test('rejects malformed merchant payloads', async () => {
  const service = createPayMerchantService(clientFor({ merchant: { id: 'merchant-1' } }));
  await assert.rejects(() => service.getCurrent(), /Invalid Pay merchant field/);
});
