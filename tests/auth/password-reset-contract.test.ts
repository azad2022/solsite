import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authUi = readFileSync('src/components/AdminAuthGate.tsx', 'utf8');
const resetPage = readFileSync('src/components/AuthResetPasswordPage.tsx', 'utf8');
const mainSource = readFileSync('src/main.tsx', 'utf8');
const authSource = readFileSync('functions/api/auth/_instance.ts', 'utf8');

test('login UI exposes password recovery without storing auth state client-side', () => {
  assert.match(authUi, /رمز عبور را فراموش کرده‌اید/);
  assert.match(authUi, /\/auth\/reset-password/);
  assert.doesNotMatch(authUi, /localStorage\.(setItem|getItem)\([^\n]*(?:token|session)/i);
});

test('password recovery uses Better Auth request and reset contracts', () => {
  assert.match(resetPage, /authClient\.requestPasswordReset\(\{/);
  assert.match(resetPage, /redirectTo:\s*`\$\{window\.location\.origin\}\/auth\/reset-password`/);
  assert.match(resetPage, /authClient\.resetPassword\(\{\s*newPassword:\s*password,\s*token\s*\}\)/);
  assert.match(resetPage, /new URLSearchParams\(window\.location\.search\)\.get\(['"]token['"]\)/);
});

test('password reset route is mounted as a dedicated application entry', () => {
  assert.match(mainSource, /window\.location\.pathname === '\/auth\/reset-password'/);
  assert.match(mainSource, /<AuthResetPasswordPage \/>/);
});

test('server revokes sessions after password reset', () => {
  assert.match(authSource, /revokeSessionsOnPasswordReset:\s*true/);
});
