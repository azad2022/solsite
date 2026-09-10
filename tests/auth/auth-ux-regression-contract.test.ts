import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const authGateSource = readFileSync(resolve(process.cwd(), 'src/components/AdminAuthGate.tsx'), 'utf8');
const authInstanceSource = readFileSync(resolve(process.cwd(), 'functions/api/auth/_instance.ts'), 'utf8');
const authRouteSource = readFileSync(resolve(process.cwd(), 'functions/api/auth/[[path]].ts'), 'utf8');
const resetPageSource = readFileSync(resolve(process.cwd(), 'src/components/AuthResetPasswordPage.tsx'), 'utf8');

test('Google OAuth preserves the originating device intent at the same responsive homepage', () => {
  assert.match(authGateSource, /function isMobileBrowser\(\)/);
  assert.match(authGateSource, /auth_device/);
  assert.match(authGateSource, /provider: 'google'/);
  assert.match(authGateSource, /callbackURL: buildGoogleCallbackURL\(\)/);
  assert.match(authGateSource, /window\.location\.origin/);
});

test('Login and registration UI uses neutral headings without implementation-detail footer text', () => {
  assert.match(authGateSource, /mode === 'login' \? 'ورود به حساب' : 'ایجاد حساب'/);
  assert.doesNotMatch(authGateSource, /خوش آمدید/);
  assert.doesNotMatch(authGateSource, /حساب SolMint/);
  assert.doesNotMatch(authGateSource, /نشست احراز هویت در سمت سرور و با کوکی HttpOnly مدیریت می‌شود/);
});

test('Google sign-in control uses a multicolor Google mark instead of the monochrome Chrome glyph', () => {
  assert.match(authGateSource, /function GoogleIcon\(\)/);
  assert.match(authGateSource, /viewBox="0 0 24 24"/);
  assert.doesNotMatch(authGateSource, /<Chrome\b/);
});

test('Password reset emails point to the application reset UI and never expose Better Auth internal reset URLs', () => {
  assert.match(authInstanceSource, /sendResetPassword: async \(\{ user, token \}/);
  assert.match(authInstanceSource, /buildPasswordResetAppUrl\(foundation\.baseURL, token\)/);
  assert.match(authInstanceSource, /new URL\('\/auth\/reset-password', baseURL\)/);
  assert.doesNotMatch(authInstanceSource, /buildPasswordResetEmail\(user\.name, url,/);
});

test('Legacy Better Auth reset links are redirected to the application reset UI without consuming the token', () => {
  assert.match(authRouteSource, /function isPasswordResetPath\(pathname: string\)/);
  assert.match(authRouteSource, /request\.method !== 'GET'/);
  assert.match(authRouteSource, /new URL\('\/auth\/reset-password', url\.origin\)/);
  assert.match(authRouteSource, /destination\.searchParams\.set\('token', token\)/);
});

test('Password reset UI consumes the token with Better Auth resetPassword', () => {
  assert.match(resetPageSource, /requestPasswordReset\(\{/);
  assert.match(resetPageSource, /redirectTo: `\$\{window\.location\.origin\}\/auth\/reset-password`/);
  assert.match(resetPageSource, /resetPassword\(\{ newPassword: password, token \}/);
});
