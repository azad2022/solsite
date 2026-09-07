import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost } from '../../functions/api/users/register';

test('legacy registration endpoint is retired', async () => {
  const response = await onRequestPost();

  assert.equal(response.status, 410);
  const body = (await response.json()) as { code?: string };
  assert.equal(body.code, 'LEGACY_REGISTRATION_DISABLED');
});
