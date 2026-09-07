import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizePayMerchant } from '../functions/api/pay/_merchant-authz';

type StubUser = {
  id: string;
  applicationUserId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: unknown[];
  isActive: true;
  createdAt: string;
};

const USER: StubUser = {
  id: 'better-auth-user-1',
  applicationUserId: 'app-user-1',
  username: 'merchant-user',
  fullName: 'Merchant User',
  role: 'user',
  permissions: [],
  isActive: true,
  createdAt: '2026-09-07T00:00:00.000Z',
};

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_MERCHANT_ID = '22222222-2222-4222-8222-222222222222';
const request = new Request('https://solmint.ir/pay');
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
};

const applicationUser = async () => USER;

function membershipFetch(rows: unknown[], status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(rows), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Pay merchant authorization fails closed when no Better Auth application session exists', async () => {
  const result = await authorizePayMerchant(request, env, MERCHANT_ID, {
    getApplicationUser: async () => null,
    fetchImpl: membershipFetch([{ merchant_id: MERCHANT_ID, user_id: 'app-user-1', role: 'owner', status: 'active' }]),
  });

  assert.deepEqual(result, { ok: false, status: 401, code: 'PAY_AUTH_REQUIRED' });
});

test('Pay merchant authorization rejects a valid user without active merchant membership', async () => {
  const result = await authorizePayMerchant(request, env, MERCHANT_ID, {
    getApplicationUser: applicationUser,
    fetchImpl: membershipFetch([]),
  });

  assert.deepEqual(result, { ok: false, status: 403, code: 'PAY_MERCHANT_FORBIDDEN' });
});

test('Pay merchant authorization accepts only an active membership for the requested merchant', async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    requested.push(String(input));
    return new Response(JSON.stringify([{ merchant_id: MERCHANT_ID, user_id: USER.applicationUserId, role: 'finance', status: 'active' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await authorizePayMerchant(request, env, MERCHANT_ID, {
    getApplicationUser: applicationUser,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.user.applicationUserId, USER.applicationUserId);
    assert.deepEqual(result.value.membership, {
      merchantId: MERCHANT_ID,
      applicationUserId: USER.applicationUserId,
      role: 'finance',
    });
  }
  assert.match(requested[0], /pay_merchant_members\?/);
  assert.match(requested[0], /merchant_id=eq\.11111111-1111-4111-8111-111111111111/);
  assert.match(requested[0], /user_id=eq\.app-user-1/);
  assert.match(requested[0], /status=eq\.active/);
  assert.match(requested[0], /select=merchant_id%2Cuser_id%2Crole%2Cstatus/);
});

test('Pay merchant authorization never grants access to a different merchant', async () => {
  const result = await authorizePayMerchant(request, env, OTHER_MERCHANT_ID, {
    getApplicationUser: applicationUser,
    fetchImpl: membershipFetch([{ merchant_id: MERCHANT_ID, user_id: USER.applicationUserId, role: 'owner', status: 'active' }]),
  });

  assert.deepEqual(result, { ok: false, status: 403, code: 'PAY_MERCHANT_FORBIDDEN' });
});

test('Pay merchant authorization fails closed when the server Supabase boundary is misconfigured', async () => {
  const result = await authorizePayMerchant(request, {}, MERCHANT_ID, {
    getApplicationUser: applicationUser,
    fetchImpl: membershipFetch([]),
  });

  assert.deepEqual(result, { ok: false, status: 503, code: 'PAY_AUTH_MISCONFIGURED' });
});

test('Pay merchant authorization maps membership lookup failures to a non-sensitive 503', async () => {
  const result = await authorizePayMerchant(request, env, MERCHANT_ID, {
    getApplicationUser: applicationUser,
    fetchImpl: async () => new Response('upstream failure', { status: 500 }),
  });

  assert.deepEqual(result, { ok: false, status: 503, code: 'PAY_AUTH_MISCONFIGURED' });
});
