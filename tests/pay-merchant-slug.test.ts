import assert from 'node:assert/strict';
import test from 'node:test';
import { slugifyMerchantName } from '../src/pay/services/merchantSlug';

test('Merchant slug helper transliterates Persian, Arabic, and Kurdish business names', () => {
  for (const name of ['فروشگاه سولمینت', 'متجر سولمينت', 'فرۆشگای سولمینت']) {
    const slug = slugifyMerchantName(name);
    assert.match(slug, /^[a-z0-9][a-z0-9-]{2,59}$/);
    assert.ok(slug.length >= 3);
  }
});

test('Merchant slug helper preserves Latin identifiers and strips unsafe separators', () => {
  assert.equal(slugifyMerchantName('SolMint Store'), 'solmint-store');
  assert.equal(slugifyMerchantName('SolMint   Store!!!'), 'solmint-store');
});

test('Merchant slug helper never emits an invalid leading or trailing separator', () => {
  assert.equal(slugifyMerchantName('--- SolMint ---'), 'solmint');
});
