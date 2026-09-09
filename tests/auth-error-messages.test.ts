import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authDiagnosticLabel, authErrorMessage } from '../src/utils/authErrorMessages';

test('auth client exposes a stable diagnostic code without raw server internals', () => {
  const error = { status: 503, code: 'AUTH_DATABASE_CONFIG', message: 'internal database details' };
  assert.equal(authDiagnosticLabel(error), 'AUTH_DATABASE_CONFIG');
  assert.equal(authErrorMessage(error, 'fallback'), 'اتصال امن سرویس احراز هویت به پایگاه‌داده آماده نیست.');
});

test('auth client maps standard Better Auth verification failures', () => {
  const error = { status: 403, code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email' };
  assert.equal(authDiagnosticLabel(error), 'EMAIL_NOT_VERIFIED');
  assert.match(authErrorMessage(error, 'fallback'), /تأیید نشده/);
});

test('auth client suppresses database internals from user-facing fallback text', () => {
  const error = { status: 500, message: 'Postgres connection failed: secret token xyz' };
  assert.equal(authErrorMessage(error, 'خطای احراز هویت'), 'خطای احراز هویت');
});

test('auth client maps rate limiting from HTTP status', () => {
  const error = { status: 429, message: 'Too many requests' };
  assert.equal(authDiagnosticLabel(error), 'RATE_LIMITED');
  assert.match(authErrorMessage(error, 'fallback'), /تلاش‌ها زیاد/);
});
