import test from 'node:test';
import assert from 'node:assert/strict';
import { redirectLegacyPasswordReset } from '../../functions/api/auth/[[path]]';

test('legacy password reset endpoint redirects to the app reset page', () => {
  const request = new Request('https://solmint.ir/api/auth/reset-password/TestToken123?callbackURL=https%3A%2F%2Fsolmint.ir%2Fauth%2Freset-password');
  const response = redirectLegacyPasswordReset(request);
  assert.ok(response);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://solmint.ir/auth/reset-password?token=TestToken123');
});

test('non-GET reset requests remain owned by Better Auth', () => {
  const request = new Request('https://solmint.ir/api/auth/reset-password/TestToken123', { method: 'POST' });
  assert.equal(redirectLegacyPasswordReset(request), null);
});
