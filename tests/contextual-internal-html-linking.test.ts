import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkContextualInternalHtmlReferences } from '../src/utils/contextualInternalHtmlLinking.ts';

test('links an article title inside a strong text node as a real HTML anchor', () => {
  const input = '<p>برای درک معماری این فرآیند، مقاله <strong>کیف پول چگونه با برنامه‌های شبکه سولانا تعامل می‌کند؟ راهنمای تخصصی Wallet، dApp و Transaction</strong> دید فنی عمیق‌تری ارائه می‌دهد.</p>';
  const output = linkContextualInternalHtmlReferences(input, [
    {
      slug: 'solana-wallet-dapp-interaction',
      title: 'کیف پول چگونه با برنامه‌های شبکه سولانا تعامل می‌کند؟ راهنمای تخصصی Wallet، dApp و Transaction',
      priority: 25,
    },
  ], { currentSlug: 'solana-token-technical-audit-before-buying-2026', maxLinks: 5 });

  assert.match(output, /<strong><a href="\/article\/solana-wallet-dapp-interaction">کیف پول چگونه با برنامه‌های شبکه سولانا تعامل می‌کند؟ راهنمای تخصصی Wallet، dApp و Transaction<\/a><\/strong>/);
});

test('does not rewrite existing anchors, code, preformatted content or headings', () => {
  const input = '<h2>کیف پول</h2><p><a href="/article/existing">کیف پول سولانا</a> و <code>کیف پول سولانا</code> و <pre>کیف پول سولانا</pre></p>';
  const output = linkContextualInternalHtmlReferences(input, [
    { slug: 'wallet', title: 'کیف پول سولانا', priority: 50 },
  ], { currentSlug: 'source', maxLinks: 5 });

  assert.equal(output, input);
});

test('caps links and skips self-linking', () => {
  const input = '<p>کیف پول سولانا و ساخت توکن سولانا و قیمت سولانا.</p>';
  const output = linkContextualInternalHtmlReferences(input, [
    { slug: 'source', title: 'کیف پول سولانا', priority: 100 },
    { slug: 'token', title: 'ساخت توکن سولانا', priority: 90 },
    { slug: 'price', title: 'قیمت سولانا', priority: 80 },
  ], { currentSlug: 'source', maxLinks: 1, maxPerTarget: 1 });

  assert.doesNotMatch(output, /href="\/article\/source"/);
  assert.equal((output.match(/<a href=/g) || []).length, 1);
});
