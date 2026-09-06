import test from 'node:test';
import assert from 'node:assert/strict';

const PAY_PREFIX = '/pay';
const sections = new Set([
  'overview',
  'transactions',
  'merchants',
  'customers',
  'invoices',
  'referrals',
  'reports',
  'tickets',
  'developer',
  'security',
]);

function normalizePath(pathname: string): string {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean || '/';
}

function sectionFromPath(pathname: string): string {
  const normalized = normalizePath(pathname);
  if (normalized === PAY_PREFIX) return 'overview';
  if (!normalized.startsWith(`${PAY_PREFIX}/`)) return 'overview';
  const suffix = normalized.slice(`${PAY_PREFIX}/`.length);
  return sections.has(suffix) ? suffix : 'overview';
}

function pathForSection(section: string): string {
  return section === 'overview' ? PAY_PREFIX : `${PAY_PREFIX}/${section}`;
}

test('Pay routing keeps /pay and valid Pay sections inside the Pay boundary', () => {
  assert.equal(sectionFromPath('/pay'), 'overview');
  assert.equal(sectionFromPath('/pay/'), 'overview');
  assert.equal(sectionFromPath('/pay/transactions'), 'transactions');
  assert.equal(sectionFromPath('/pay/security/'), 'security');
});

test('Pay routing never treats arbitrary nested paths as valid sections', () => {
  assert.equal(sectionFromPath('/pay/not-a-section'), 'overview');
  assert.equal(sectionFromPath('/pay/transactions/detail'), 'overview');
  assert.equal(sectionFromPath('/dashboard'), 'overview');
});

test('Pay navigation produces canonical section paths', () => {
  assert.equal(pathForSection('overview'), '/pay');
  assert.equal(pathForSection('transactions'), '/pay/transactions');
  assert.equal(pathForSection('security'), '/pay/security');
});
