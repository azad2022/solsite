import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authSource = readFileSync('functions/api/auth/_instance.ts', 'utf8');
const clientSource = readFileSync('src/components/AdminAuthGate.tsx', 'utf8');
const routesSource = readFileSync('public/_routes.json', 'utf8');

test('Google OAuth uses the canonical production callback and account selection', () => {
  assert.match(authSource, /redirectURI:\s*'https:\/\/solmint\.ir\/api\/auth\/callback\/google'/);
  assert.match(authSource, /prompt:\s*'select_account'/);
  assert.match(authSource, /sameSite:\s*'lax'/);
});

test('Google sign-in preserves the originating device intent in a same-origin callback', () => {
  assert.match(clientSource, /authClient\.signIn\.social\(\{\s*provider:\s*'google',\s*callbackURL:\s*buildGoogleCallbackURL\(\)\s*\}\)/s);
  assert.match(clientSource, /function buildGoogleCallbackURL\(\)/);
  assert.match(clientSource, /url\.searchParams\.set\('auth_device',\s*isMobileBrowser\(\)\s*\?\s*'mobile'\s*:\s*'desktop'\)/);
  assert.doesNotMatch(clientSource, /callbackURL:\s*window\.location\.href/);
});

test('Cloudflare Pages routes the Better Auth function surface', () => {
  assert.match(routesSource, /\/api\/auth\/\*/);
});
