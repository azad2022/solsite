import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('Better Auth runtime enforces verified email and password recovery', () => {
  const source = read('functions/api/auth/_instance.ts');
  assert.match(source, /requireEmailVerification:\s*true/);
  assert.match(source, /revokeSessionsOnPasswordReset:\s*true/);
  assert.match(source, /sendResetPassword:/);
  assert.match(source, /sendVerificationEmail:/);
  assert.match(source, /sendOnSignUp:\s*true/);
  assert.match(source, /sendOnSignIn:\s*true/);
});

test('Better Auth database boundary is isolated and production fail-closed', () => {
  const source = read('functions/api/auth/_database.ts');
  assert.match(source, /HYPERDRIVE/);
  assert.match(source, /development\/test/);
  assert.match(source, /search_path=better_auth,public/);
});

test('Better Auth account schema matches the pinned 1.7.2 identity model', () => {
  const runtime = read('functions/api/auth/_instance.ts');
  const schema = read('supabase/migrations/20260906_better_auth_identity_schema.sql');
  assert.match(schema, /issuer text not null/);
  assert.match(schema, /unique \(issuer, account_id\)/);
  assert.match(runtime, /identityStrategy:\s*'provider-id'/);
  assert.match(runtime, /issuer:\s*'issuer'/);
  assert.match(runtime, /encryptOAuthTokens:\s*true/);
});

test('OAuth account linking is explicit rather than implicit', () => {
  const source = read('functions/api/auth/_instance.ts');
  assert.match(source, /accountLinking:\s*\{/);
  assert.match(source, /enabled:\s*true/);
  assert.match(source, /disableImplicitLinking:\s*true/);
  assert.match(source, /allowDifferentEmails:\s*false/);
});

test('Better Auth session cookie is secure and isolated from the legacy cookie', () => {
  const source = read('functions/api/auth/_instance.ts');
  assert.match(source, /__Host-solmint_auth_session/);
  assert.match(source, /sameSite:\s*'strict'/);
  assert.match(source, /httpOnly:\s*true/);
  assert.match(source, /secure:\s*secureCookies/);
  assert.doesNotMatch(source, /__Host-solmint_session/);
});

test('Better Auth identity schema is not browser-writable', () => {
  const source = read('supabase/migrations/20260906_better_auth_identity_schema.sql');
  assert.match(source, /create schema if not exists better_auth/);
  assert.match(source, /revoke all on schema better_auth from public/);
  assert.match(source, /revoke all on all tables in schema better_auth from public/);
});

test('legacy identity bridge is server-only and supports controlled migration', () => {
  const bridge = read('supabase/migrations/20260906_auth_identity_bridge.sql');
  const migration = read('functions/api/auth/migrate-legacy.ts');
  assert.match(bridge, /auth_identity_links/);
  assert.match(bridge, /alter table public\.auth_identity_links enable row level security/);
  assert.match(bridge, /revoke all on table public\.auth_identity_links/);
  assert.match(migration, /status: 202/);
  assert.match(migration, /source.*legacy-migration/);
});

test('Google OAuth credentials remain server-only', () => {
  const runtime = read('functions/api/auth/_instance.ts');
  const env = read('.env.example');
  assert.doesNotMatch(read('src/components/AuthModal.tsx'), /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(read('src/components/AuthModal.tsx'), /VITE_GOOGLE_CLIENT_SECRET/);
  assert.match(runtime, /GOOGLE_CLIENT_SECRET/);
  assert.match(env, /GOOGLE_CLIENT_SECRET=/);
});

test('auth UI never persists bearer/session material in localStorage', () => {
  assert.doesNotMatch(read('src/components/AuthModal.tsx'), /localStorage/);
  assert.doesNotMatch(read('src/components/AuthModal.tsx'), /sessionStorage/);
});

test('legacy password migration preserves generic response for enumeration resistance', () => {
  const source = read('functions/api/auth/migrate-legacy.ts');
  assert.match(source, /genericResponse\(\)/);
  assert.match(source, /اگر اطلاعات حساب درست باشد/);
  assert.match(source, /findUser\(env, username\)/);
  assert.match(source, /verifyPassword\(password, legacyUser\.password_hash\)/);
});
