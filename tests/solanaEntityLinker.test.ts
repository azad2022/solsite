import test from 'node:test';
import assert from 'node:assert/strict';
import { linkSolanaEntities } from '../src/utils/solanaEntityLinker.ts';

test('adds contextual entity links with a hard article cap', () => {
  const input = 'Jupiter و Raydium و Kamino و Jito در دیفای سولانا مهم هستند.';
  const output = linkSolanaEntities(input, { currentSlug: 'unrelated-article', maxLinks: 5 });
  assert.ok(output.includes('[Jupiter](/article/solana-jupiter-guide-2026)'));
  assert.ok(output.includes('[Raydium](/article/raydium-solana-guide-2026)'));
  assert.ok(output.includes('[Kamino](/article/kamino-solana-guide-2026)'));
  assert.ok(output.includes('[Jito](/article/jito-solana-guide-2026)'));
});

test('never self-links and never rewrites existing markdown links or code', () => {
  const input = 'Jupiter [Jupiter](/article/solana-jupiter-guide-2026) `Jupiter`';
  const output = linkSolanaEntities(input, { currentSlug: 'solana-jupiter-guide-2026', maxLinks: 5 });
  assert.equal(output, input);
});

test('respects one-link-per-entity and protects URLs', () => {
  const input = 'Jupiter Jupiter https://jup.ag Jupiter';
  const output = linkSolanaEntities(input, { currentSlug: 'other', maxLinks: 5, maxPerEntity: 1 });
  const matches = output.match(/\/article\/solana-jupiter-guide-2026/g) || [];
  assert.equal(matches.length, 1);
  assert.match(output, /https:\/\/jup\.ag/);
});

test('supports Persian aliases', () => {
  const output = linkSolanaEntities('کامینو در دیفای سولانا و جیتو مهم هستند.', { currentSlug: 'other', maxLinks: 5 });
  assert.ok(output.includes('[کامینو](/article/kamino-solana-guide-2026)'));
  assert.ok(output.includes('[جیتو](/article/jito-solana-guide-2026)'));
});
