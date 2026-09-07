import { createBetterAuthRuntime } from './_instance';
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  findUser,
  recordFailedLogin,
  upgradePasswordHash,
  verifyPassword,
  type Env,
} from './_shared';

interface MigrationEnv extends Env {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
  LEGACY_MIGRATION_ENABLED?: string;
  LEGACY_MIGRATION_SECRET?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_RESPONSE = { ok: true, migrated: true, message: 'اگر اطلاعات حساب درست باشد، مراحل تکمیل انتقال به ایمیل ارسال می‌شود.' };

function genericResponse(): Response {
  return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

export const onRequestPost = async ({ request, env }: { request: Request; env: MigrationEnv }) => {
  if (request.method !== 'POST') return Response.json({ ok: false }, { status: 405 });

  const migrationEnabled = env.LEGACY_MIGRATION_ENABLED?.trim().toLowerCase() === 'true';
  const migrationSecret = env.LEGACY_MIGRATION_SECRET?.trim() || '';
  if (!migrationEnabled || !migrationSecret) return genericResponse();

  let body: { username?: string; password?: string; email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return genericResponse();
  }

  const username = body.username?.trim() || '';
  const password = body.password || '';
  const email = body.email?.trim().toLowerCase() || '';
  if (!username || !password || !EMAIL_RE.test(email) || email.length > 320) return genericResponse();

  const allowed = await checkLoginRateLimit(env, request, username).catch(() => false);
  if (!allowed) return genericResponse();

  const applicationUser = await findUser(env, username).catch(() => null);
  if (!applicationUser || applicationUser.is_active === false) {
    await recordFailedLogin(env, request, username).catch(() => {});
    return genericResponse();
  }

  let passwordResult: Awaited<ReturnType<typeof verifyPassword>>;
  try {
    passwordResult = await verifyPassword(password, applicationUser.password_hash);
  } catch {
    passwordResult = { valid: false };
  }
  if (!passwordResult.valid) {
    await recordFailedLogin(env, request, username).catch(() => {});
    return genericResponse();
  }
  await clearLoginRateLimit(env, request, username).catch(() => {});
  if (passwordResult.upgradedHash) await upgradePasswordHash(env, applicationUser.id, passwordResult.upgradedHash).catch(() => {});

  const runtime = createBetterAuthRuntime(env);
  try {
    const existingLink = await runtime.application.findIdentityByApplicationUserId(applicationUser.id);
    if (existingLink) return genericResponse();

    const existingEmail = await runtime.application.findBetterAuthIdentityByEmail(email);
    if (existingEmail) return genericResponse();

    const result = await runtime.auth.api.signUpEmail({
      body: {
        email,
        name: applicationUser.full_name,
        password,
        username: applicationUser.username,
      },
      headers: new Headers({ 'x-solmint-legacy-migration': migrationSecret }),
    }) as unknown as { user?: { id?: string } | null };

    if (!result.user?.id) return genericResponse();
    return genericResponse();
  } catch {
    return genericResponse();
  } finally {
    await runtime.close().catch(() => {});
  }
};
