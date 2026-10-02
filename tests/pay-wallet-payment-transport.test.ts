import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSolanaTransactionRequestUri, buildTransactionRequestUrl, buildWalletBrowseUrl, isMobileWalletContext, isValidWalletAddress } from '../src/pay/wallet-payment-transport';

const INTENT_ID = '8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d91';
const VALID = '11111111111111111111111111111111';

test('validates Solana public wallet addresses', () => {
  assert.equal(isValidWalletAddress(VALID), true);
  assert.equal(isValidWalletAddress('not-a-wallet'), false);
});

test('builds a transaction request URL on the SolMint origin', () => {
  const url = buildTransactionRequestUrl('https://solmint.ir', INTENT_ID);
  assert.equal(url, `https://solmint.ir/api/pay/v1/payment-intents/${INTENT_ID}/transaction-request`);
});

test('builds a Solana transaction request URI safely', () => {
  const uri = buildSolanaTransactionRequestUri('https://solmint.ir', INTENT_ID);
  assert.match(uri, /^solana:https%3A%2F%2Fsolmint\.ir%2Fapi%2Fpay%2Fv1%2Fpayment-intents%2F/);
  assert.equal(decodeURIComponent(uri.slice('solana:'.length)), buildTransactionRequestUrl('https://solmint.ir', INTENT_ID));
});

test('builds supported mobile wallet browse links', () => {
  const page = `https://solmint.ir/pay/checkout/${INTENT_ID}`;
  assert.match(buildWalletBrowseUrl('phantom', page), /^https://phantom\.app\/ul\/browse\//);
  assert.match(buildWalletBrowseUrl('solflare', page), /^https://solflare\.com\/ul\/v1\/browse\//);
  assert.match(buildWalletBrowseUrl('backpack', page), /^https://backpack\.app\/ul\/browse\//);
});

test('detects mobile wallet contexts deterministically', () => {
  assert.equal(isMobileWalletContext('Mozilla/5.0 (Android 14; Mobile)'), true);
  assert.equal(isMobileWalletContext('Mozilla/5.0 (X11; Linux x86_64)'), false);
});
