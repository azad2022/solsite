import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const authModal = readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');
const header = readFileSync(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
const resetPage = readFileSync(new URL('../functions/reset-password.ts', import.meta.url), 'utf8');

test('global auth UI uses server endpoints and never stores auth state in localStorage', () => {
  assert.match(authModal, /\/api\/auth\/sign-in\/email/);
  assert.match(authModal, /\/api\/auth\/sign-in\/username/);
  assert.match(authModal, /\/api\/auth\/sign-up\/email/);
  assert.match(authModal, /\/api\/auth\/sign-in\/social/);
  assert.match(authModal, /credentials:\s*['"]include['"]/g);
  assert.doesNotMatch(authModal, /localStorage\.(setItem|getItem|removeItem)\([^)]*(session|token|auth)/i);
});

test('Google OAuth is started server-side and requires a returned authorize URL', () => {
  assert.match(authModal, /provider:\s*['"]google['"]/);
  assert.match(authModal, /window\.location\.assign\(target\.href\)/);
  assert.doesNotMatch(authModal, /GOOGLE_(CLIENT|SECRET)/);
});

test('reset page submits the Better Auth reset-password contract without persistent token storage', () => {
  assert.match(resetPage, /\/api\/auth\/reset-password\?token=/);
  assert.match(resetPage, /newPassword/);
  assert.doesNotMatch(resetPage, /localStorage\.(setItem|getItem)/);
});

test('global header keeps privileged CMS entry separate from the Better Auth login dialog', () => {
  assert.match(header, /AuthModal/);
  assert.match(header, /openAdminModal/);
  assert.match(header, /currentUser/);
});
