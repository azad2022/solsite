import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const authClientSource = readFileSync(resolve(process.cwd(), 'src/utils/authClient.ts'), 'utf8');
const headerSource = readFileSync(resolve(process.cwd(), 'src/components/Header.tsx'), 'utf8');

test('Better Auth session is an authenticated UI signal independent of application profile resolution', () => {
  assert.match(authClientSource, /authClient\.useSession\(\)/);
  assert.match(authClientSource, /isAuthenticated:\s*boolean/);
  assert.match(authClientSource, /return \{\s*user,/s);
  assert.match(authClientSource, /maxAttempts = 5/);
});

test('Header does not show login/register while a Better Auth session exists', () => {
  assert.match(headerSource, /authClient\.useSession\(\)/);
  assert.match(headerSource, /const isAuthenticated = Boolean\(authSession\.data\?\.user\)/);
  assert.match(headerSource, /: isAuthenticated \?/);
  assert.doesNotMatch(headerSource, /\{currentUser \?[^]*: <button[^>]+ورود \/ ثبت‌نام/s);
});
