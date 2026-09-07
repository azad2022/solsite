import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost } from '../../functions/api/users/login';

test('legacy login endpoint is retired and cannot mint a legacy session', async () => {
  const response = await onRequestPost();

  assert.equal(response.status, 410);
  assert.equal(response.headers.get('set-cookie'), null);
  const body = (await response.json()) as { code?: string };
  assert.equal(body.code, 'LEGACY_LOGIN_DISABLED');
});
