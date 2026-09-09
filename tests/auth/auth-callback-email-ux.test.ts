import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const instance = readFileSync('functions/api/auth/_instance.ts', 'utf8');
const email = readFileSync('functions/api/auth/_email.ts', 'utf8');
const verified = readFileSync('public/auth/verified.html', 'utf8');
const errorPage = readFileSync('public/auth/error.html', 'utf8');


test('Google OAuth links a trusted Google identity without weakening email restrictions', () => {
  assert.match(instance, /trustedProviders:\s*\['google'\]/);
  assert.match(instance, /disableImplicitLinking:\s*false/);
  assert.match(instance, /allowDifferentEmails:\s*false/);
});

test('authentication failures use the SolMint error destination', () => {
  assert.match(instance, /onAPIError:\s*\{\s*errorURL:\s*'\/auth\/error'\s*\}/s);
  assert.match(errorPage, /internal_server_error/);
});

test('authentication emails support the four initial locales and the official mascot asset', () => {
  assert.match(email, /'fa-IR'/);
  assert.match(email, /'en-US'/);
  assert.match(email, /\bar:\s*\{/);
  assert.match(email, /\bru:\s*\{/);
  assert.match(email, /solmint-mascot-solana-coin\.webp/);
  assert.match(email, /resolveAuthEmailLocale/);
});

test('email verification has a dedicated branded completion page', () => {
  assert.match(verified, /ایمیل شما با موفقیت تأیید شد/);
  assert.match(verified, /solmint-mascot-solana-coin\.webp/);
});
