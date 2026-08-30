import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const heroSource = fs.readFileSync(new URL('../src/components/HeroSection.tsx', import.meta.url), 'utf8');

test('homepage exposes exactly one crawlable H1 in initial HTML', () => {
  const rootMatch = indexHtml.match(/<div id="root">([\s\S]*?)<\/div>/i);
  assert.ok(rootMatch, 'root container is missing');
  const rootHtml = rootMatch[1];
  const h1Matches = rootHtml.match(/<h1\b/gi) ?? [];
  assert.equal(h1Matches.length, 1);
  assert.match(rootHtml, /<h1[^>]*>کیف پول غیرامانی سولانا و ابزارهای Web3<\/h1>/);
});

test('homepage initial SEO metadata is internally consistent', () => {
  const title = indexHtml.match(/<title>([^<]+)<\/title>/i)?.[1];
  const ogTitle = indexHtml.match(/<meta property="og:title" content="([^"]+)"\s*\/>/i)?.[1];
  const canonical = indexHtml.match(/<link rel="canonical" href="([^"]+)"\s*\/>/i)?.[1];

  assert.equal(title, 'سولمینت | کیف پول غیرامانی سولانا و ابزارهای Web3');
  assert.equal(ogTitle, title);
  assert.equal(canonical, 'https://solmint.ir/');
  assert.doesNotMatch(indexHtml, /solmint-hydrating/);
});

test('rendered Hero keeps a single matching H1', () => {
  const h1Matches = heroSource.match(/<h1\b/gi) ?? [];
  assert.equal(h1Matches.length, 1);
  assert.match(heroSource, /<h1[^>]*>\s*کیف پول غیرامانی سولانا و ابزارهای Web3\s*<\/h1>/);
});
