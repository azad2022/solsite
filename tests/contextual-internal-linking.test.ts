import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkContextualInternalReferences } from '../src/utils/contextualInternalLinking';

test('links a relevant phrase to the highest-priority target', () => {
  const input = 'برای شروع، بهتر است راهنمای کیف پول سولانا و نکات امنیتی آن را بخوانید.';
  const output = linkContextualInternalReferences(input, [
    { slug: 'wallet-guide', title: 'کیف پول سولانا', aliases: ['کیف پول سولانا'], priority: 50, language: 'fa' },
    { slug: 'other', title: 'امنیت', aliases: ['امنیت'], priority: 5, language: 'fa' },
  ], { currentSlug: 'source', language: 'fa', maxLinks: 2 });

  assert.match(output, /\[کیف پول سولانا\]\(\/article\/wallet-guide\)/);
});

test('never self-links and never touches an existing markdown link or code span', () => {
  const input = '[کیف پول سولانا](/article/wallet-guide) و `کیف پول سولانا` و کیف پول سولانا.';
  const output = linkContextualInternalReferences(input, [
    { slug: 'wallet-guide', title: 'کیف پول سولانا', aliases: ['کیف پول سولانا'], priority: 50, language: 'fa' },
  ], { currentSlug: 'wallet-guide', language: 'fa', maxLinks: 3 });

  assert.equal(output, input);
});

test('respects language and link limits', () => {
  const input = 'Jupiter و Solana در این مقاله بررسی می‌شوند و همچنین کیف پول سولانا توضیح داده می‌شود.';
  const output = linkContextualInternalReferences(input, [
    { slug: 'jupiter', title: 'Jupiter', aliases: ['Jupiter'], priority: 100, language: 'en' },
    { slug: 'wallet', title: 'کیف پول سولانا', aliases: ['کیف پول سولانا'], priority: 90, language: 'fa' },
  ], { currentSlug: 'source', language: 'en', maxLinks: 1 });

  assert.match(output, /\[Jupiter\]\(\/article\/jupiter\)/);
  assert.doesNotMatch(output, /کیف پول سولانا.*\/article\/wallet/);
});

test('does not invent anchors that are absent from the source text', () => {
  const input = 'این متن فقط درباره سولاناست.';
  const output = linkContextualInternalReferences(input, [
    { slug: 'wallet', title: 'کیف پول سولانا', aliases: ['کیف پول سولانا'], priority: 100 },
  ], { currentSlug: 'source', maxLinks: 5 });

  assert.equal(output, input);
});
