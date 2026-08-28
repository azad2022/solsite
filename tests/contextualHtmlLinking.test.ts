import test from 'node:test';
import assert from 'node:assert/strict';
import { linkContextualHtml } from '../src/utils/contextualHtmlLinking';

test('links article titles inside existing HTML without flattening strong text', () => {
  const html = '<p>کاربر می‌تواند این مورد را به <strong>کیف پول سولانا</strong> منتقل کند.</p>';
  const result = linkContextualHtml(html, [
    { slug: 'wallet-guide', title: 'کیف پول سولانا', href: '/article/wallet-guide' }
  ]);
  assert.equal(result, '<p>کاربر می‌تواند این مورد را به <strong><a href="/article/wallet-guide" class="contextual-internal-link">کیف پول سولانا</a></strong> منتقل کند.</p>');
});

test('does not link inside an existing link or heading', () => {
  const html = '<h2>کیف پول سولانا</h2><p><a href="/article/existing">کیف پول سولانا</a></p><p>در کیف پول سولانا باید authority را بررسی کنید.</p>';
  const result = linkContextualHtml(html, [
    { slug: 'wallet-guide', title: 'کیف پول سولانا', href: '/article/wallet-guide' }
  ], { maxLinks: 1 });
  assert.equal(result, '<h2>کیف پول سولانا</h2><p><a href="/article/existing">کیف پول سولانا</a></p><p>در <a href="/article/wallet-guide" class="contextual-internal-link">کیف پول سولانا</a> باید authority را بررسی کنید.</p>');
});

test('does not self-link the current article', () => {
  const html = '<p>عنوان همین مقاله</p>';
  const result = linkContextualHtml(html, [
    { slug: 'current-article', title: 'عنوان همین مقاله', href: '/article/current-article' }
  ], { currentSlug: 'current-article' });
  assert.equal(result, html);
});
