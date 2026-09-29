import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const header = readFileSync(resolve(process.cwd(), 'src/components/Header.tsx'), 'utf8');

test('primary header navigation stays compact and keeps critical destinations', () => {
  const expected = ['کیف پول سولانا', 'قیمت لحظه‌ای سولانا', 'ساخت توکن', 'میم کوین', 'درگاه پرداخت', 'وبلاگ'];
  for (const label of expected) assert.ok(header.includes(label), 'Missing primary header destination: ' + label);
  assert.equal((header.match(/data-header-primary-nav/g) || []).length, 1);
  assert.equal((header.match(/data-nav-key="pay"/g) || []).length, 2, 'Pay entry must exist in desktop and mobile navigation.');
});

test('secondary destinations are not duplicated in the primary header', () => {
  for (const label of ['صفحه اصلی', 'تحلیل کیف پول', 'ابزارها', 'سوالات متداول']) {
    assert.equal(header.includes(label), false, 'Secondary header label must be removed: ' + label);
  }
  assert.doesNotMatch(header, /Wrench|ChevronDown|walletAnalyzerActive|toolsOpen|toolsActive/);
});

test('guest authentication control remains available beside the compact desktop navigation', () => {
  const guestBranches = [...header.matchAll(/title="ورود \/ ثبت‌نام"/g)].length;
  assert.equal(guestBranches, 2, 'desktop and mobile guest branches must remain explicit fallback branches');
});
