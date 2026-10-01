import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildWelcomeEmail,
  resolveAuthEmailLocale,
} from '../../functions/api/auth/_email';

const instance = readFileSync('functions/api/auth/_instance.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20261001103617_solmint_google_welcome_email_delivery.sql', 'utf8');

test('Google welcome email resolves the four supported locales from authentication headers', () => {
  const cases = [
    ['fa-IR,fa;q=0.9,en;q=0.5', 'fa-IR'],
    ['en-US,en;q=0.9', 'en-US'],
    ['ar-SA,ar;q=0.9,en;q=0.5', 'ar'],
    ['ru-RU,ru;q=0.9,en;q=0.5', 'ru'],
    ['de-DE,de;q=0.9', 'en-US'],
  ] as const;

  for (const [acceptLanguage, expected] of cases) {
    const locale = resolveAuthEmailLocale(new Headers({ 'accept-language': acceptLanguage }));
    assert.equal(locale, expected);
  }
});

test('Google welcome email is localized, branded, and safely escapes the user name in HTML', () => {
  const samples = [
    ['fa-IR', 'به SolMint خوش آمدید', 'سلام علی <امن>'],
    ['en-US', 'Welcome to SolMint', 'Hello <Admin>'],
    ['ar', 'مرحباً بك في SolMint', 'مرحباً علي <آمن>'],
    ['ru', 'Добро пожаловать в SolMint', 'Здравствуйте, Али <безопасно>'],
  ] as const;

  for (const [locale, subject, name] of samples) {
    const email = buildWelcomeEmail(name, locale);
    assert.equal(email.subject, subject);
    assert.match(email.html, new RegExp('lang="' + locale + '"'));
    assert.ok(email.html.includes('SolMint'));
    assert.ok(email.html.includes('&lt;'));
    assert.doesNotMatch(email.html, /<Admin>|<امن>|<آمن>|<безопасно>/);
    assert.ok(email.text.includes(name));
    assert.ok(email.text.includes('solmint.ir/'));
  }
});

test('Google welcome delivery is tied to newly created Google users, not returning sign-ins', () => {
  assert.match(instance, /if \(ctx\.path === ['"]\/callback\/google['"]\)/);
  assert.match(instance, /sendGoogleWelcomeNotification/);
  assert.match(instance, /claimAuthWelcomeEmailDelivery/);
  assert.match(instance, /completeAuthWelcomeEmailDelivery/);
  assert.match(instance, /failAuthWelcomeEmailDelivery/);
  assert.doesNotMatch(instance, /account:\s*\{\s*create:/);
});

test('Google welcome delivery is server-only and retry-safe', () => {
  assert.match(migration, /create table if not exists public\.auth_welcome_email_deliveries/);
  assert.match(migration, /user_id text not null references better_auth\."user"\(id\) on delete cascade/);
  assert.match(migration, /unique \(user_id, provider_id\)/);
  assert.match(migration, /check \(provider_id in \('google'\)\)/);
  assert.match(migration, /status in \('pending','sending','sent','failed'\)/);
  assert.match(migration, /alter table public\.auth_welcome_email_deliveries enable row level security/);
  assert.match(migration, /revoke all on table public\.auth_welcome_email_deliveries from public, anon, authenticated/);
  assert.match(migration, /grant select on table public\.auth_welcome_email_deliveries to service_role/);
  assert.match(migration, /revoke all on function public\.solmint_claim_auth_welcome_email_delivery\(text,text,text\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.solmint_claim_auth_welcome_email_delivery\(text,text,text\) to service_role/);
  assert.match(migration, /status = 'sent'/);
  assert.match(migration, /locked_at > now\(\) - interval '10 minutes'/);
});

test('Google OAuth preserves the server-trusted locale alongside referral context', () => {
  assert.match(instance, /const authEmailLocale = resolveAuthEmailLocale\(ctx\.headers\)/);
  assert.match(instance, /authEmailLocale,/);
  assert.match(instance, /referralClickId: click\.clickId/);
  assert.match(instance, /referralCode: click\.referralCode/);
});
