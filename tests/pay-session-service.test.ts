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


function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('retries a transient session failure before succeeding', async () => {
  let calls = 0;
  const user = await getPaySessionUser(async () => {
    calls += 1;
    return calls === 1
      ? jsonResponse(503, { success: false })
      : jsonResponse(200, {
          success: true,
          user: { id: 'user-2', email: 'user2@example.com', isActive: true },
        });
  }, 2);

  assert.equal(calls, 2);
  assert.equal(user?.id, 'user-2');
});

test('does not retry a real unauthorized session', async () => {
  let calls = 0;
  const user = await getPaySessionUser(async () => {
    calls += 1;
    return jsonResponse(401, { success: false, code: 'UNAUTHORIZED' });
  }, 3);

  assert.equal(calls, 1);
  assert.equal(user, null);
});

test('does not retry ordinary client errors', async () => {
  let calls = 0;
  await assert.rejects(
    () => getPaySessionUser(async () => {
      calls += 1;
      return jsonResponse(403, { success: false, code: 'FORBIDDEN' });
    }, 3),
    (error: unknown) => error instanceof Error && 'status' in error && (error as { status?: number }).status === 403,
  );
  assert.equal(calls, 1);
});
