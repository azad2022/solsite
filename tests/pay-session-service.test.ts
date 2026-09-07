import assert from 'node:assert/strict';
import test from 'node:test';
import { getPaySessionUser } from '../src/pay/services/sessionService';

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('returns anonymous state for a missing session', async () => {
  const user = await getPaySessionUser(async () => response({ success: false }, 401));
  assert.equal(user, null);
});

test('parses the server-owned application user response', async () => {
  const user = await getPaySessionUser(async () => response({
    success: true,
    user: {
      id: 'user-1',
      username: 'merchant-owner',
      fullName: 'Merchant Owner',
      email: 'owner@example.com',
      role: 'user',
      permissions: ['pay.read'],
      isActive: true,
    },
  }));

  assert.deepEqual(user, {
    id: 'user-1',
    username: 'merchant-owner',
    fullName: 'Merchant Owner',
    email: 'owner@example.com',
    role: 'user',
    permissions: ['pay.read'],
    isActive: true,
  });
});

test('fails closed on malformed session data', async () => {
  await assert.rejects(
    () => getPaySessionUser(async () => response({ success: true, user: { id: 'user-1', isActive: 'yes' } })),
    /Invalid auth session field: isActive/,
  );
});
