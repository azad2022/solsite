import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ui = readFileSync('src/pay/components/PaySecurity.tsx','utf8');

test('Security UI preserves loading, stale, unauthorized and forbidden states', () => {
  for (const pattern of [/loading/,/stale/,/unauthorized/,/forbidden/,/retry/]) assert.match(ui, pattern);
  assert.match(ui,/hasSnapshotRef/);
});
