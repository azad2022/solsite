import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/api/pay/v1/merchants/index.ts', 'utf8');
const service = readFileSync('src/pay/services/merchantOnboardingService.ts', 'utf8');

test('Merchant GET exposes only the authoritative active verified receiving wallet', () => {
  assert.match(route, /pay_merchant_wallets\?select=id,address,network,wallet_role,is_active,verification_status,verified_at/);
  assert.match(route, /wallet_role=eq\.receiving/);
  assert.match(route, /is_active=eq\.true/);
  assert.match(route, /verification_status=eq\.verified/);
  assert.match(route, /receiving_wallet: receivingWallet/);
});

test('Merchant GET reads wallet data through the authenticated identity path', () => {
  assert.match(route, /supabaseRequestAsIdentity\(env, requestAsIdentity\.accessToken, path\)/);
  assert.match(route, /loadVerifiedReceivingWallet\(env, merchant\.id, \{ accessToken: identity\.accessToken \}\)/);
});

test('Merchant wallet parser fails closed on malformed or non-active snapshots', () => {
  assert.match(service, /Invalid merchant receiving wallet response/);
  assert.match(service, /row\.network !== 'solana'/);
  assert.match(service, /row\.is_active !== true/);
  assert.match(service, /\['unverified', 'verified', 'rejected'\]\.includes\(row\.verification_status\)/);
});
