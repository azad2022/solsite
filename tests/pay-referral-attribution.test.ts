import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/r/[code].ts','utf8');
const service = readFileSync('functions/api/pay/_shared/referralAttribution.ts','utf8');
const migration = readFileSync('supabase/migrations/20260930210000_solmint_pay_referral_program.sql','utf8');

test('public referral click route is GET-only and stores an opaque click token', () => {
  assert.match(route,/export const onRequestGet/);
  assert.match(service,/clickId: string/);
  assert.match(service,/HttpOnly; SameSite=Lax/);
  assert.match(service,/REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 30/);
  assert.match(service,/Max-Age=\$\{REFERRAL_COOKIE_MAX_AGE_SECONDS\}/);
  assert.match(service,/UUID/);
  assert.match(service,/sm_\[0-9a-f\]\{12\}/i);
  assert.match(route,/status: 302/);
  assert.ok(route.includes("new URL('/', requestUrl.origin)"));
  assert.match(route,/notFoundResponse/);
});

test('referral click is server-recorded and not client-RPC writable', () => {
  assert.match(service,/pay_record_referral_click/);
  assert.match(migration,/grant execute on function public\.pay_record_referral_click\(text\) to service_role/);
  assert.match(migration,/revoke all on function public\.pay_record_referral_click\(text\) from public, anon, authenticated/);
});

test('signup attribution is immutable to one direct affiliate per user', () => {
  assert.match(migration,/referred_user_id text not null unique/);
  assert.match(migration,/click_event_id uuid not null unique/);
  assert.match(migration,/pay_attribute_referral_from_click/);
  assert.match(migration,/USER_PREEXISTED_CLICK/);
});
