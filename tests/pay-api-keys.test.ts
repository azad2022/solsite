import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantApiKey, listMerchantApiKeys, revokeMerchantApiKey, rotateMerchantApiKey } from '../src/pay/services/apiKeyService';
import type { PayHttpClient } from '../src/pay/http';

const validKey = {
  id: '11111111-1111-4111-8111-111111111111',
  merchantId: '22222222-2222-4222-8222-222222222222',
  name: 'production',
  keyPrefix: 'sk_pay_abc12345',
  scopes: ['payment.create'],
  status: 'active' as const,
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
  createdAt: '2026-09-11T00:00:00.000Z',
};

function fakeClient(response: unknown, seen: RequestInit[] = []): PayHttpClient {
  return { request: async (_path: string, init: RequestInit = {}) => { seen.push(init); return response; } } as unknown as PayHttpClient;
}

test('API key service consumes the released list contract', async () => {
  const seen: RequestInit[] = [];
  const result = await listMerchantApiKeys(validKey.merchantId, fakeClient({ apiKeys: [validKey] }, seen));
  assert.deepEqual(result, [validKey]);
  assert.equal(seen.length, 1);
});

test('API key create pins the only released scope and sends idempotency', async () => {
  const seen: RequestInit[] = [];
  await createMerchantApiKey(validKey.merchantId, { name: 'production', expiresAt: null }, fakeClient({ apiKey: validKey, secret: 'sk_pay_secret' }, seen));
  const headers = new Headers(seen[0]?.headers);
  assert.equal(headers.get('Idempotency-Key')?.length, 36);
  const body = JSON.parse(String(seen[0]?.body));
  assert.deepEqual(body.scopes, ['payment.create']);
});

test('API key rotate sends the real key endpoint and idempotency', async () => {
  const seen: RequestInit[] = [];
  await rotateMerchantApiKey(validKey.merchantId, validKey.id, { name: validKey.name, expiresAt: null }, fakeClient({ apiKey: { ...validKey, id: '33333333-3333-4333-8333-333333333333' }, secret: 'sk_pay_secret' }, seen));
  const headers = new Headers(seen[0]?.headers);
  assert.equal(headers.get('Idempotency-Key')?.length, 36);
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(String(seen[0]?.body)).scopes, ['payment.create']);
});

test('API key revoke returns server status metadata', async () => {
  const revoked = { ...validKey, status: 'revoked' as const, revokedAt: '2026-09-11T01:00:00.000Z' };
  const result = await revokeMerchantApiKey(validKey.merchantId, validKey.id, fakeClient({ apiKey: revoked }));
  assert.equal(result.status, 'revoked');
  assert.equal(result.revokedAt, revoked.revokedAt);
});
