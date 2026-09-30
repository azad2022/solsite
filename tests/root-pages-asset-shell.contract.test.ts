import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const middleware = readFileSync('functions/_middleware.ts', 'utf8');

test('root HTML is served from the deployed Pages asset shell', () => {
  assert.match(middleware, /async function serveSpaShell\(context: PagesContext\)/);
  assert.match(middleware, /if \(pathname === '\/'\) return serveSpaShell\(context\);/);
  assert.match(middleware, /return context\.env\.ASSETS\.fetch\(new Request\(url/);
});

test('Pay routes keep their no-store wrapper and markdown remains on the normal pipeline', () => {
  assert.match(middleware, /return servePaySpaShell\(context\);/);
  assert.match(middleware, /return await withPayHtmlNoStore\(context\.request, await context\.next\(\)\);/);
  assert.match(middleware, /acceptsMarkdown\(context\.request\)/);
});
