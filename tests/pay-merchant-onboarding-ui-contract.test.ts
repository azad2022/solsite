import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentPath = resolve(process.cwd(), 'src/pay/components/PayMerchantOnboarding.tsx');
const i18nPath = resolve(process.cwd(), 'src/pay/components/pay-merchant-onboarding-i18n.ts');
const component = readFileSync(componentPath, 'utf8');
const i18n = readFileSync(i18nPath, 'utf8');

test('merchant onboarding refreshes the authoritative Merchant after wallet verification', () => {
  assert.match(component, /const verified = await verifyWalletChallenge\(/);
  assert.match(component, /const refreshed = await getMyMerchant\(\)/);
  assert.match(component, /onMerchantReady\?\.\(refreshed\)/);
  assert.match(component, /This failed refresh is a stale-data condition|A failed refresh/);
});

test('merchant onboarding does not surface raw unexpected wallet-provider errors', () => {
  assert.match(component, /e instanceof PayHttpError \|\| e instanceof WalletUiError/);
  assert.match(component, /t\(locale, 'walletVerificationFailed'\)/);
  assert.doesNotMatch(component, /e instanceof Error \? e\.message/);
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
