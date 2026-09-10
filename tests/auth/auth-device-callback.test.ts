import test from 'node:test';
import assert from 'node:assert/strict';

test('responsive auth callback contract keeps mobile and desktop on the same homepage origin', () => {
  const source = String.raw`${readFileSync('src/components/AdminAuthGate.tsx')}`;
  assert.match(source, /new URL\('\/', window\.location\.origin\)/);
  assert.match(source, /url\.searchParams\.set\('auth_device', isMobileBrowser\(\) \? 'mobile' : 'desktop'\)/);
});

function readFileSync(path: string): string {
  const fs = require('node:fs') as typeof import('node:fs');
  return fs.readFileSync(path, 'utf8');
}
