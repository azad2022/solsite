import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routePath = resolve(process.cwd(), 'functions/api/pay/v1/merchants/[merchantId]/wallet-challenges/[challengeId].ts');
const routeSource = readFileSync(routePath, 'utf8');

test('wallet verification reconstructs and compares the canonical challenge message', () => {
  assert.match(routeSource, /buildWalletOwnershipMessage\(/);
  assert.match(routeSource, /const expectedMessage = buildWalletOwnershipMessage\(/);
  assert.match(routeSource, /walletAddress: challenge\.wallet_address/);
  assert.match(routeSource, /issuedAt: challenge\.issued_at/);
  assert.match(routeSource, /expiresAt: challenge\.expires_at/);
  assert.match(routeSource, /expectedMessage !== challenge\.message/);
  assert.match(routeSource, /code: 'CHALLENGE_TAMPERED'/);
});

test('wallet verification keeps server-only cryptographic and persistence boundaries', () => {
  assert.match(routeSource, /verifySolanaWalletSignature\(/);
  assert.match(routeSource, /\/rest\/v1\/rpc\/pay_consume_wallet_challenge/);
  assert.doesNotMatch(routeSource, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(routeSource, /service_role.*Authorization.*Bearer/);
});
