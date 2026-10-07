import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const hub = readFileSync('src/pay/components/PayBillingHub.tsx', 'utf8');

test('Pay sidebar exposes the requested eight primary entries in the requested order', () => {
  const navStart = app.indexOf('const PAY_NAV_SECTIONS');
  const navEnd = app.indexOf('];', navStart);
  assert.ok(navStart >= 0 && navEnd > navStart);
  const nav = app.slice(navStart, navEnd);
  assert.match(nav, /'payment-links'/);
  assert.match(nav, /'invoices'/);
  assert.doesNotMatch(nav, /'transactions'/);
  assert.doesNotMatch(nav, /'customers'/);
  assert.doesNotMatch(nav, /'reports'/);
  assert.doesNotMatch(nav, /'webhooks'/);
  assert.match(nav, /'overview',[\s\S]*'merchants',[\s\S]*'payment-links',[\s\S]*'invoices',[\s\S]*'referrals',[\s\S]*'developer',[\s\S]*'security',[\s\S]*'tickets'/);
  assert.match(app, /showBillingHub = isBillingSection/);
  assert.doesNotMatch(app, /pay-nav-group-label/);
});

test('Billing hub renders only the selected primary surface while keeping legacy operation routes below it', () => {
  assert.match(hub, /PayInvoices/);
  assert.match(hub, /PayPaymentLinks/);
  assert.match(hub, /PayTransactions/);
  assert.match(hub, /PayCustomers/);
  assert.match(hub, /PayReports/);
  assert.match(hub, /pay-billing-primary-content/);
  assert.match(hub, /primaryView === 'invoices'/);
  assert.match(hub, /primaryView === 'payment-links'/);
  assert.doesNotMatch(hub, /pay-billing-tabs/);
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

test('Pay sidebar labels use dedicated navigation copy for invoices, payment links, earning, and developers', () => {
  assert.match(app, /sectionNavLabel\(locale, section\)/);
  assert.match(app, /'payment-links'/);
  const i18n = readFileSync('src/pay/i18n.ts', 'utf8');
  assert.match(i18n, /invoicesNavLabel: 'فاکتور'/);
  assert.match(i18n, /paymentLinksNavLabel: 'لینک پرداخت'/);
  assert.match(i18n, /referralsNavLabel: 'کسب درآمد'/);
  assert.match(i18n, /developerNavLabel: 'برنامه‌نویسان'/);
});
