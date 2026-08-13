import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch = fs.readFileSync('scripts/comments-security-hardening.mjs', 'utf8');
const build = fs.readFileSync('package.json', 'utf8');
const preparation = fs.readFileSync('scripts/prepare-production-source.mjs', 'utf8');

test('comment security hardening removes PostgREST filter interpolation', () => {
  assert.match(patch, /Never interpolate articleId/);
  assert.match(patch, /\.eq\('id', articleId\)/);
  assert.match(patch, /\.eq\('slug', articleId\)/);
  assert.doesNotMatch(patch, /from\('articles'\).*\.or\(/s);
});

test('production comments use a server-only service-role client', () => {
  assert.match(patch, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(patch, /commentSupabaseAdmin/);
  assert.match(preparation, /comments-security-hardening\.mjs/);
  assert.doesNotMatch(build, /comments-security-hardening\.mjs/);
});

test('production comment session fails closed without a production secret', () => {
  assert.match(patch, /COMMENT_SESSION_SECRET is required in production/);
});
