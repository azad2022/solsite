import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkout = readFileSync('src/pay/PayCheckout.tsx', 'utf8');

test('hosted checkout is wallet-first and does not expose manual signature verification', () => {
  assert.doesNotMatch(checkout, /pay-checkout-manual-details/);
  assert.doesNotMatch(checkout, /signatureLabel|signaturePlaceholder|verifyPayment/);
  assert.match(checkout, /payWithConnectedWallet/);
  assert.match(checkout, /payPaymentVerificationService\.reconcile/);
  assert.match(checkout, /buildSolanaTransactionRequestUri/);
  assert.match(checkout, /walletAddressInput/);
});


test('exceptional payment outcomes are not auto-polled or auto-reconciled', () => {
  const match = checkout.match(/const NON_TERMINAL_STATUSES:[\\s\\S]*?new Set\\(\\[(.*?)\\]\\)/);
  assert.ok(match, 'Hosted Checkout must declare its automatic polling status allowlist.');
  const statuses = match[1];
  assert.match(statuses, /'created'/);
  assert.match(statuses, /'pending'/);
  assert.match(statuses, /'detected'/);
  assert.match(statuses, /'verifying'/);
  assert.match(statuses, /'confirmed'/);
  assert.doesNotMatch(statuses, /'underpaid'|'overpaid'|'ambiguous'/);
});
