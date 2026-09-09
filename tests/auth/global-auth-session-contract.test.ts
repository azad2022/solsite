import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientSource = readFileSync('src/utils/authClient.ts', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const logoutSource = readFileSync('functions/api/auth/logout.ts', 'utf8');


test('the browser auth client uses the Better Auth React boundary', () => {
  assert.match(clientSource, /from 'better-auth\/react'/);
  assert.match(clientSource, /authClient\.useSession\(\)/);
  assert.match(clientSource, /function useApplicationSession/);
});

test('the root App derives application identity from the reactive auth boundary', () => {
  assert.match(appSource, /useApplicationSession\(\)/);
  assert.match(appSource, /applicationSessionUser/);
  assert.doesNotMatch(appSource, /fetch\(['"]\/api\/users\/me['"]/);
});

test('logout revokes Better Auth and clears the legacy session boundary', () => {
  assert.match(appSource, /signOutAllAuthSessions\(\)/);
  assert.match(clientSource, /authClient\.signOut\(\{\}\)/);
  assert.match(clientSource, /fetch\(['"]\/api\/auth\/logout['"]/);
  assert.match(logoutSource, /runtime\.auth\.api\.signOut\(\{ headers: request\.headers \}\)/);
  assert.match(logoutSource, /destroySession\(env, request\)/);
});

test('auth state is not persisted as an auth token in localStorage', () => {
  assert.doesNotMatch(clientSource, /localStorage\.(setItem|getItem).*session/i);
  assert.doesNotMatch(appSource, /localStorage\.setItem\(['"][^'"]*(?:token|session)[^'"]*/i);
});
