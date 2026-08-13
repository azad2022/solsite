import test from 'node:test';
import assert from 'node:assert/strict';
import { linkSolanaEntities } from '../src/utils/solanaEntityLinkerV2';

test('maps specific subtopics to canonical supporting pages', () => {
  const output = linkSolanaEntities('Jupiter Lend و Raydium CLMM و Kamino Lend در سولانا مهم هستند.', { currentSlug: 'other', maxLinks: 5 });
  assert.ok(output.includes('[Jupiter Lend](/article/jupiter-lend-solana-guide-2026)'));
  assert.ok(output.includes('[Raydium CLMM](/article/raydium-clmm-solana-guide-2026)'));
  assert.ok(output.includes('[Kamino Lend](/article/kamino-lend-solana-guide-2026)'));
});

test('does not self-link the current entity page', () => {
  const input = 'Jupiter و ژوپیتر سولانا';
  const output = linkSolanaEntities(input, { currentSlug: 'solana-jupiter-guide-2026', maxLinks: 5 });
  assert.equal(output, input);
});

test('ignores existing links, code spans and URLs', () => {
  const input = '[Jupiter](/article/solana-jupiter-guide-2026) `Jupiter` https://jup.ag Jupiter';
  const output = linkSolanaEntities(input, { currentSlug: 'other', maxLinks: 5 });
  assert.equal((output.match(/\/article\/solana-jupiter-guide-2026/g) || []).length, 1);
  assert.ok(output.includes('`Jupiter`'));
  assert.ok(output.includes('https://jup.ag'));
  assert.equal((output.match(/\[Jupiter\]\(\/article\/solana-jupiter-guide-2026\)/g) || []).length, 2);
});
