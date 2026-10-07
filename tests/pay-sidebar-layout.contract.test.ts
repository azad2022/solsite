import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const css = readFileSync('src/pay/pay.css', 'utf8');
const e2e = readFileSync('e2e/pay-production-ui.e2e.mjs', 'utf8');

test('Pay desktop sidebar remains anchored and vertically scrollable', () => {
  const sidebarBlock = css.slice(css.indexOf('.pay-sidebar {'), css.indexOf('.pay-sidebar::-webkit-scrollbar'));
  assert.match(sidebarBlock, /position:\s*sticky/);
  assert.match(sidebarBlock, /top:\s*0/);
  assert.match(sidebarBlock, /height:\s*100dvh/);
  assert.match(sidebarBlock, /overflow-y:\s*auto/);
  assert.match(sidebarBlock, /overflow-x:\s*hidden/);
  assert.match(sidebarBlock, /overscroll-behavior:\s*contain/);
});

test('Pay primary navigation contains the requested ten dedicated sections', () => {
  const start = app.indexOf('const PAY_NAV_SECTIONS');
  const end = app.indexOf('const PAGE_HEADER_OWNERS');
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  const sections = [...block.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(sections, [
    'overview',
    'merchants',
    'wallet',
    'bulk-pay',
    'payment-links',
    'invoices',
    'referrals',
    'api-keys',
    'developer',
    'security',
    'tickets',
  ]);
});

test('Pay shell keeps logical left/right placement under both writing directions', () => {
  assert.ok(css.includes(".solmint-pay[dir='ltr'] .pay-app-shell,\n.solmint-pay[dir='rtl'] .pay-app-shell { flex-direction: row; }"));
  assert.doesNotMatch(css, /\.solmint-pay\[dir='rtl'\] \.pay-app-shell \{ flex-direction: row-reverse; \}/);
  assert.match(css, /\.pay-nav-group-label[\s\S]*text-align:\s*start/);
  assert.match(css, /\.pay-nav-item[\s\S]*text-align: start/);
  assert.match(app, /<aside dir=\{direction\}/);
});

test('Production browser E2E covers desktop sidebar direction and scroll reachability', () => {
  assert.match(e2e, /setViewportSize\(\{ width: 1440, height: 520 \}\)/);
  assert.match(e2e, /overflowY/);
  assert.match(e2e, /scrollTop = element\.scrollHeight/);
  assert.match(e2e, /expectedDirection === 'rtl'/);
  assert.match(e2e, /Last navigation item must be reachable/);
});
