import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const frontend = fs.readFileSync('src/components/wallet/WalletAnalyzerPage.tsx', 'utf8');
const backend = fs.readFileSync('functions/api/wallet/analyze.ts', 'utf8');
const routes = JSON.parse(fs.readFileSync('public/_routes.json', 'utf8')) as { include?: string[] };

test('wallet analyzer frontend is wired to the production API', () => {
  assert.match(frontend, /\/api\/wallet\/analyze\?address=/);
  assert.equal(routes.include?.includes('/api/wallet/*'), true);
});

test('wallet analyzer backend contains the core on-chain reads', () => {
  assert.match(backend, /getBalance/);
  assert.match(backend, /getTokenAccountsByOwner/);
  assert.match(backend, /getSignaturesForAddress/);
  assert.match(backend, /getSolanaFmSnapshot/);
});
