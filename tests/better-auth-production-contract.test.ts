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

test('identity bridge uses the application identity and defers the Better Auth FK', () => {
  const bridge = read('supabase/migrations/20260906_auth_identity_bridge.sql');
  const schema = read('supabase/migrations/20260906_better_auth_identity_schema.sql');
  assert.match(bridge, /better_auth_user_id text primary key/);
  assert.match(bridge, /application_user_id text not null unique/);
  assert.doesNotMatch(bridge, /references better_auth\.\"user\"/);
  assert.match(schema, /auth_identity_links_better_auth_user_id_fkey/);
  assert.match(schema, /foreign key \(better_auth_user_id\)/);
});

test('native and legacy Better Auth users are mapped to the application identity boundary', () => {
  const profile = read('functions/api/auth/_application-profile.ts');
  const runtime = read('functions/api/auth/_instance.ts');
  const migration = read('functions/api/auth/migrate-legacy.ts');
  const me = read('functions/api/auth/me.ts');

  assert.match(profile, /insert into public\.users/);
  assert.match(profile, /insert into public\.auth_identity_links/);
  assert.match(profile, /application_user_id/);
  assert.match(profile, /source = 'legacy-migration'/);
  assert.match(profile, /source = 'native'/);
  assert.match(profile, /better-auth-only\$/);
  assert.match(runtime, /databaseHooks:\s*\{/);
  assert.match(runtime, /provisionApplicationProfile/);
  assert.match(runtime, /x-solmint-legacy-migration/);
  assert.match(migration, /application_user_id = \$1/);
  assert.match(migration, /x-solmint-legacy-migration/);
  assert.doesNotMatch(migration, /insert into public\.auth_identity_links/);
  assert.match(me, /join public\.users u on u\.id = l\.application_user_id/);
});

test('native signup cannot reuse a legacy application username', () => {
  const source = read('functions/api/auth/_instance.ts');
  assert.match(source, /ctx\.path !== '\/sign-up\/email'/);
  assert.match(source, /lower\(username\) = lower\(\$1\)/);
  assert.match(source, /APIError\('CONFLICT'/);
});

test('Better Auth session without an application identity is not exposed as authenticated', () => {
  const source = read('functions/api/auth/me.ts');
  assert.match(source, /if \(!applicationUser/);
  assert.match(source, /applicationUser\.is_active === false/);
  assert.match(source, /applicationUser\.is_active == null/);
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
  assert.match(source, /verifyPassword\(password, applicationUser\.password_hash\)/);
});
