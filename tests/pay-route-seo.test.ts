import assert from 'node:assert/strict';
import test from 'node:test';
import { getRouteSeoInfo } from '../src/utils/seoManager';

test('Pay routes are real application routes, not SSR 404s', () => {
  for (const path of [
    '/pay',
    '/pay/merchants',
    '/pay/dashboard',
    '/pay/transactions',
    '/pay/customers',
    '/pay/invoices',
    '/pay/referrals',
    '/pay/reports',
    '/pay/tickets',
    '/pay/developer',
    '/pay/security',
    '/pay/webhooks',
  ]) {
    const info = getRouteSeoInfo(path);
    assert.equal(info.is404, undefined, path);
    assert.equal(info.noindex, true, path);
    assert.match(info.title, /SolMint Pay/);
    assert.equal(info.canonical, 'https://solmint.ir' + path);
  }
});
