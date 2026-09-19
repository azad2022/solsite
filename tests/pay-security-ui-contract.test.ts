import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx','utf8');
const ui = readFileSync('src/pay/components/PaySecurity.tsx','utf8');

test('PayApp wires Security only for an authenticated merchant', () => {
  assert.match(app,/import PaySecurity from '.\/components\/PaySecurity'/);
  assert.match(app,/showSecurity = currentSection === 'security' && sessionState === 'authenticated' && sessionUser !== null && merchant !== null/);
  assert.match(app,/<PaySecurity locale=\{locale\} merchant=\{merchant\}/);
});

test('Security UI uses released Pay services and does not calculate a security score', () => {
  assert.match(ui,/listMerchantApiKeys\(merchant\.id\)/);
  assert.match(ui,/payWebhookService\.list\(merchant\.id\)/);
  assert.match(ui,/merchant\.receivingWallet/);
  assert.doesNotMatch(ui,/securityScore|score.*100|calculate.*security/i);
  assert.doesNotMatch(ui,/fetch\(/);
});
