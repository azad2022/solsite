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
