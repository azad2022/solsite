import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const instanceSource = readFileSync('functions/api/auth/_instance.ts', 'utf8');
const databaseSource = readFileSync('functions/api/auth/_database.ts', 'utf8');
const sharedSource = readFileSync('functions/api/auth/_shared.ts', 'utf8');
const authUiSource = readFileSync('src/components/AdminAuthGate.tsx', 'utf8');

test('Better Auth profile provisioning failure removes the Better Auth user', () => {
  assert.match(instanceSource, /catch \(error\) \{\s*await database\.application\.deleteBetterAuthUser\(String\(user\.id\)\)\.catch\(\(\) => \{\}\);/s);
  assert.doesNotMatch(instanceSource, /catch \(error\) \{\s*await database\.application\.deleteApplicationUser\(String\(user\.id\)\)/s);
});

test('application auth database exposes a Better Auth user cleanup operation', () => {
  assert.match(databaseSource, /deleteBetterAuthUser\(betterAuthUserId: string\): Promise<void>/);
  assert.match(databaseSource, /async deleteBetterAuthUser\(betterAuthUserId\)/);
  assert.match(databaseSource, /callAdapter\('delete'/);
});

test('legacy authentication database access fails closed without an explicit Supabase URL', () => {
  assert.doesNotMatch(sharedSource, /DEFAULT_URL\s*=\s*['"]https:\/\/nvopkbiedorfshwbmyhn\.supabase\.co/);
  assert.match(sharedSource, /SUPABASE_URL is required for the production authentication function/);
});

test('auth UI presents the real verification retry action and uses Better Auth responses', () => {
  assert.match(authUiSource, /authClient\.sendVerificationEmail\(/);
  assert.match(authUiSource, /result\.error\.status === 403/);
  assert.match(authUiSource, /EMAIL_NOT_VERIFIED/);
});
