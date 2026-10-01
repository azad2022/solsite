import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const hub = readFileSync('src/pay/components/PayBillingHub.tsx', 'utf8');

test('Pay sidebar keeps Billing as a primary entry and leaves operations inside the Billing hub', () => {
  const navStart = app.indexOf('const PAY_NAV_SECTIONS');
  const navEnd = app.indexOf('];', navStart);
  assert.ok(navStart >= 0 && navEnd > navStart);
  const nav = app.slice(navStart, navEnd);
  assert.match(nav, /'invoices'/);
  assert.doesNotMatch(nav, /'transactions'/);
  assert.doesNotMatch(nav, /'customers'/);
  assert.doesNotMatch(nav, /'reports'/);
  assert.doesNotMatch(nav, /'webhooks'/);
  assert.match(app, /showBillingHub = isBillingSection/);
  assert.doesNotMatch(app, /pay-nav-group-label/);
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

test('Developer remains a single primary sidebar entry for the Developer and Webhook surfaces', () => {
  const navStart = app.indexOf('const PAY_NAV_SECTIONS');
  const navEnd = app.indexOf('];', navStart);
  const nav = app.slice(navStart, navEnd);
  assert.match(nav, /'developer'/);
  assert.doesNotMatch(nav, /'webhooks'/);
  assert.match(app, /showDeveloperHub \? <\>/);
  assert.match(app, /<PayDeveloper locale=\{locale\} \/>/);
  assert.match(app, /<PayWebhooks locale=\{locale\} merchantId=\{merchant\.id\} \/>/);
});


test('Pay sidebar is fixed-width and the mascot lives in the Pay header as the website link', () => {
  assert.doesNotMatch(app, /sidebarCollapsed/);
  assert.doesNotMatch(app, /pay-collapse-button/);
  assert.doesNotMatch(app, /PanelLeft(Open|Close)/);
  assert.doesNotMatch(app, /pay-sidebar-brand[\s\S]*?pay-brand-mark/);
  assert.match(app, /className="pay-topbar-brand-link"/);
  assert.match(app, /href="https:\/\/solmint\.ir\//);
  assert.doesNotMatch(app, /data-tooltip=/);
});
