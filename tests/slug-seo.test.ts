import { strict as assert } from 'node:assert';
import test from 'node:test';
import { generateSlugFromTitle } from '../src/utils/slugUtils';

test('generates an ASCII slug for Persian article titles', () => {
  const slug = generateSlugFromTitle('چرا کیف پول‌های غیرامانی سولانا با الگوریتم Ed25519 امن‌ترین گزینه هستند؟');
  assert.match(slug, /^[a-z0-9-]+$/);
  assert.ok(slug.includes('svlana'));
  assert.ok(slug.includes('ed25519'));
  assert.ok(!slug.includes('؟'));
});

test('preserves meaningful semantic terms such as هوش مصنوعی', () => {
  const slug = generateSlugFromTitle('هوش مصنوعی در تحلیل امنیت کیف پول سولانا');
  assert.match(slug, /^[a-z0-9-]+$/);
  assert.ok(slug.includes('msnvay'));
  assert.ok(slug.includes('amnyt'));
});

test('keeps English acronyms and numbers crawl-friendly', () => {
  const slug = generateSlugFromTitle('آموزش ساخت SPL Token 2026 برای سولانا');
  assert.match(slug, /^[a-z0-9-]+$/);
  assert.ok(slug.includes('spl'));
  assert.ok(slug.includes('token'));
  assert.ok(slug.includes('2026'));
});

test('keeps generated URLs compact without breaking tokens', () => {
  const slug = generateSlugFromTitle('راهنمای جامع و بسیار کامل امنیت کیف پول سولانا برای کاربران ایرانی و توسعه‌دهندگان وب۳ و بررسی روش‌های نگهداری امن دارایی‌های دیجیتال');
  assert.ok(slug.length <= 72);
  assert.match(slug, /^[a-z0-9-]+$/);
  assert.ok(!slug.endsWith('-'));
});
