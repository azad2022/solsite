import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBase58 } from '../src/pay/services/base58';
import { verifySolanaWalletSignature } from '../src/pay/services/walletSignature';
import { generateLocalSolanaMerchantWallet, SOLANA_MERCHANT_DERIVATION_PATH } from '../src/pay/services/merchantWalletGenerator';

test('dedicated merchant wallet generation creates valid 12 and 24 word Solana wallets', async () => {
  for (const wordCount of [12, 24] as const) {
    const wallet = await generateLocalSolanaMerchantWallet(wordCount);
    try {
      assert.equal(wallet.mnemonic.trim().split(/\s+/).length, wordCount);
      assert.equal(decodeBase58(wallet.address).length, 32);
      assert.match(wallet.address, /^[1-9A-HJ-NP-Za-km-z]+$/);
      assert.equal(SOLANA_MERCHANT_DERIVATION_PATH, "m/44'/501'/0'/0'");

      const message = 'SolMint Pay wallet generation test';
      const signature = await wallet.signMessage(message);
      assert.equal(signature.length, 64);
      assert.equal(await verifySolanaWalletSignature({
        walletAddress: wallet.address,
        message,
        signatureBase58: (await import('../src/pay/services/base58')).encodeBase58(signature),
      }), true);
    } finally {
      wallet.dispose();
    }
    await assert.rejects(() => wallet.signMessage('must fail after dispose'));
  }
});

test('dedicated wallet material has no persistence implementation', async () => {
  const wallet = await generateLocalSolanaMerchantWallet(12);
  try {
    assert.doesNotMatch(wallet.mnemonic, /[<>]/);
    assert.equal(typeof wallet.dispose, 'function');
  } finally {
    wallet.dispose();
  }
});
