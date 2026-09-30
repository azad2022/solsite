import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const account = readFileSync('src/pay/components/PayAccountMenu.tsx', 'utf8');
const accountService = readFileSync('src/pay/services/walletBalanceService.ts', 'utf8');
const endpoint = readFileSync('functions/api/pay/v1/merchants/[merchantId]/wallet-balance.ts', 'utf8');
const training = readFileSync('src/pay/components/PayTrainingCenter.tsx', 'utf8');
const trainingCss = readFileSync('src/pay/components/pay-training.css', 'utf8');

test('Pay header account control replaces the old money icon and opens wallet-aware account UI', () => {
  assert.match(app, /PayAccountMenu/);
  assert.match(account, /WalletCards/);
  assert.doesNotMatch(app, /CircleDollarSign size=\{17\}/);
  assert.match(account, /aria-haspopup="dialog"/);
  assert.match(account, /getMerchantWalletBalance/);
});

test('account menu has no plaintext credential or wallet-secret rendering path', () => {
  assert.doesNotMatch(account, /recoveryPhrase|mnemonic|privateKey|seedPhrase/i);
  assert.doesNotMatch(account, /localStorage|sessionStorage/);
});

test('wallet balance service is same-origin and preserves atomic integer strings', () => {
  assert.match(accountService, /\/api\/pay\/v1\/merchants\/${encodeURIComponent\(normalized\)}\/wallet-balance/);
  assert.match(accountService, /balanceAtomic: atomicString/);
  assert.match(accountService, /SOL|USDT|USDC/);
});

test('wallet balance endpoint is authenticated, rate-limited, server-mediated, and no-store', () => {
  assert.match(endpoint, /resolvePayIdentity/);
  assert.match(endpoint, /enforcePayRateLimit/);
  assert.match(endpoint, /SOLANA_RPC_URL/);
  assert.match(endpoint, /supabaseRequestAsIdentity/);
  assert.match(endpoint, /wallet_role=eq\.receiving/);
  assert.match(endpoint, /verification_status=eq\.verified/);
  assert.match(endpoint, /payJson\(/);
  assert.match(endpoint, /getTokenAccountsByOwner/);
  assert.doesNotMatch(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('training center is an independent accessible accordion above ticket actions', () => {
  assert.match(training, /<details/);
  assert.match(training, /<summary/);
  assert.match(training, /aria-labelledby="pay-training-title"/);
  assert.match(trainingCss, /prefers-reduced-motion:reduce/);
});
