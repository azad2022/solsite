import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authSource = readFileSync('functions/api/auth/_shared.ts', 'utf8');
const paySource = readFileSync('functions/api/pay/_shared/runtime.ts', 'utf8');
const payIdentitySource = readFileSync('functions/api/pay/_shared/identity.ts', 'utf8');

test('authentication layer never embeds a production Supabase URL fallback', () => {
  assert.doesNotMatch(authSource, /DEFAULT_URL\s*=\s*['"]https:\/\/nvopkbiedorfshwbmyhn\.supabase\.co/);
});

test('Pay runtime never embeds a production Supabase URL fallback', () => {
  assert.doesNotMatch(paySource, /DEFAULT_SUPABASE_URL\s*=\s*['"]https:\/\/nvopkbiedorfshwbmyhn\.supabase\.co/);
});

test('Pay identity boundary never embeds a production Supabase URL fallback', () => {
  assert.doesNotMatch(payIdentitySource, /https:\/\/nvopkbiedorfshwbmyhn\.supabase\.co/);
});
