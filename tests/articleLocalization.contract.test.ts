import test from 'node:test';
import assert from 'node:assert/strict';
import type { ArticleLanguage } from '../src/types.ts';

test('article localization contract supports only fa/en', () => {
  const languages: ArticleLanguage[] = ['fa', 'en'];
  assert.deepEqual(languages, ['fa', 'en']);
});

test('translation group is independent from slug', () => {
  const fa = { language: 'fa' as ArticleLanguage, translationGroupId: 'group-1', slug: 'analysis-solana' };
  const en = { language: 'en' as ArticleLanguage, translationGroupId: 'group-1', slug: 'solana-analysis' };

  assert.equal(fa.translationGroupId, en.translationGroupId);
  assert.notEqual(fa.slug, en.slug);
});
