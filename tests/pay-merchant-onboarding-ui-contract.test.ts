import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentPath = resolve(process.cwd(), 'src/pay/components/PayMerchantOnboarding.tsx');
const cssPath = resolve(process.cwd(), 'src/pay/components/pay-merchant-onboarding.css');
const i18nPath = resolve(process.cwd(), 'src/pay/components/pay-merchant-onboarding-i18n.ts');
const component = readFileSync(componentPath, 'utf8');
const i18n = readFileSync(i18nPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');

test('merchant onboarding refreshes the authoritative Merchant after wallet verification', () => {
  assert.match(component, /const verified = await verifyWalletChallenge\(/);
  assert.match(component, /const refreshed = await getMyMerchant\(\)/);
  assert.match(component, /onMerchantReady\?\.\(refreshed\)/);
  assert.match(component, /merchantRefreshStale/);
  assert.match(component, /retryMerchantRefresh/);
  assert.match(component, /failed refresh/);
});

test('merchant onboarding does not surface raw unexpected wallet-provider errors', () => {
  const verifyStart = component.indexOf('const startWalletVerification = async () =>');
  const verifyEnd = component.indexOf('\n  const copyMessage =', verifyStart);
  assert.ok(verifyStart >= 0 && verifyEnd > verifyStart);
  const verifyBlock = component.slice(verifyStart, verifyEnd);

  assert.match(verifyBlock, /e instanceof PayHttpError \|\| e instanceof WalletUiError/);
  assert.match(verifyBlock, /walletVerificationFailed/);
  assert.doesNotMatch(verifyBlock, /e instanceof Error \? e\.message/);
});

test('merchant onboarding keeps user-facing status/progress copy localized', () => {
  for (const key of [
    'loadingMerchant',
    'creatingMerchant',
    'walletVerificationStarting',
    'walletAwaitingSignature',
    'walletVerifying',
    'walletVerifiedAt',
    'merchantStatus_pending',
    'merchantStatus_active',
    'merchantStatus_suspended',
    'merchantStatus_closed',
  ]) {
      assert.match(i18n, new RegExp('\\b' + key + '\\b'));
  }
});


test('merchant onboarding generates an editable technical identifier for localized business names', () => {
  assert.match(component, /slugifyMerchantName/);
  assert.match(component, /slugTouched/);
  assert.match(component, /handleBusinessNameChange/);
  assert.match(component, /pay-merchant-slug-hint/);
  assert.match(i18n, /slugHint/);
  assert.match(css, /direction:ltr/);
});


test('Merchant route keeps the receiving-wallet verification surface visible after Merchant creation', () => {
  const app = readFileSync(resolve(process.cwd(), 'src/pay/PayApp.tsx'), 'utf8');
  assert.match(app, /const showMerchantOnboarding = sessionState === 'authenticated' && currentSection === 'merchants' && merchantLoadState === 'ready';/);
  assert.match(app, /<PayMerchantOnboarding locale=\{locale\} initialMerchant=\{currentSection === 'merchants' \? merchant : null\}/);
  assert.match(component, /receiveWallet/);
  assert.match(component, /useExistingWallet/);
  assert.match(component, /walletNotVerified/);
});

test('dedicated wallet recovery flow keeps secrets local and uses only the existing wallet challenge contract', () => {
  const generator = readFileSync(resolve(process.cwd(), 'src/pay/services/merchantWalletGenerator.ts'), 'utf8');
  assert.match(component, /createDedicatedWallet/);
  assert.match(component, /recoveryPhrase/);
  assert.match(component, /copyRecoveryPhrase/);
  assert.match(component, /continueAndVerifyWallet/);
  assert.match(component, /discardGeneratedWallet/);
  assert.match(component, /issueWalletChallenge\(merchant\.id, generated\.address\)/);
  assert.match(component, /verifyWalletChallenge\(merchant\.id, issued\.id, generated\.address, encodeBase58\(signature\)\)/);
  assert.doesNotMatch(component, /localStorage\.[sS]etItem\([^)]*recovery/i);
  assert.doesNotMatch(component, /sessionStorage\.[sS]etItem\([^)]*recovery/i);
  assert.doesNotMatch(generator, /fetch\(|localStorage|sessionStorage|indexedDB|console\.(log|error|warn)/);
  assert.match(generator, /mnemonicToSeedWebcrypto/);
  assert.match(generator, /SOLANA_MERCHANT_DERIVATION_PATH/);
});


test('dedicated wallet recovery phrase is never rendered in plaintext and is copied only on demand', () => {
  assert.doesNotMatch(component, /recoveryVisible|showRecoveryPhrase|hideRecoveryPhrase/);
  assert.doesNotMatch(component, /recoveryPhrase\.split\(/);
  assert.match(component, /pay-recovery-masked/);
  assert.match(component, /Array\.from\(\{ length: wordCount \},/);
  assert.match(component, /<span key=\{index\}>\*\*\*\*<\/span>/);
  assert.match(component, /copyRecoveryPhrase/);
  assert.match(component, /navigator\.clipboard\.writeText\(recoveryPhrase\)/);
  assert.match(i18n, /recoveryPhraseMaskedLabel/);
  assert.match(i18n, /recoveryPhraseCopyNote/);
});
