import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const hub = readFileSync('src/pay/components/PayBillingHub.tsx', 'utf8');

test('Pay sidebar exposes a single Billing entry for billing and operational data', () => {
  const navStart = app.indexOf('const PAY_NAV_GROUPS');
  const navEnd = app.indexOf('type PayMessageKey', navStart);
  assert.ok(navStart >= 0 && navEnd > navStart);
  const nav = app.slice(navStart, navEnd);
  assert.match(nav, /sections: \['invoices'\]/);
  assert.doesNotMatch(nav, /sections: \['transactions'/);
  assert.doesNotMatch(nav, /sections: \['customers'/);
  assert.doesNotMatch(nav, /sections: \['reports'/);
  assert.doesNotMatch(nav, /sections: \['webhooks'/);
  assert.match(app, /showBillingHub = isBillingSection/);
});

test('Billing hub keeps invoices and payment links primary and exposes operations below them', () => {
  assert.match(hub, /PayInvoices/);
  assert.match(hub, /PayPaymentLinks/);
  assert.match(hub, /PayTransactions/);
  assert.match(hub, /PayCustomers/);
  assert.match(hub, /PayReports/);
  assert.match(hub, /pay-billing-primary-content/);
  assert.match(hub, /pay-billing-related-nav/);
});

test('Legacy billing deep-links still resolve inside the Billing hub', () => {
  assert.match(app, /billingRelatedViewFromSection\(currentSection\)/);
  assert.match(app, /setBillingRelatedView\(related\)/);
  assert.match(app, /onRelatedViewChange=\{\(view\) => \{ setBillingRelatedView\(view\); navigate\(view\); \}\}/);
});

test('Developer is the only sidebar entry for the Developer and Webhook surfaces', () => {
  const navStart = app.indexOf('const PAY_NAV_GROUPS');
  const navEnd = app.indexOf('type PayMessageKey', navStart);
  const nav = app.slice(navStart, navEnd);
  assert.match(nav, /sections: \['developer'\]/);
  assert.doesNotMatch(nav, /sections: \['developer', 'webhooks'\]/);
  assert.match(app, /showDeveloperHub \? <\>/);
  assert.match(app, /<PayDeveloper locale=\{locale\} \/>/);
  assert.match(app, /<PayWebhooks locale=\{locale\} merchantId=\{merchant\.id\} \/>/);
});
