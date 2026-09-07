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
  HYPERDRIVE?: { connectionString: string };
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_RESPONSE = { ok: true, migrated: true, message: 'اگر اطلاعات حساب درست باشد، مراحل تکمیل انتقال به ایمیل ارسال می‌شود.' };

function genericResponse(): Response {
  return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

export const onRequestPost = async ({ request, env }: { request: Request; env: MigrationEnv }) => {
  if (request.method !== 'POST') return Response.json({ ok: false }, { status: 405 });

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

  const legacyUser = await findUser(env, username).catch(() => null);
  if (!legacyUser || legacyUser.is_active === false) {
    await recordFailedLogin(env, request, username).catch(() => {});
    return genericResponse();
  }

  let passwordResult: Awaited<ReturnType<typeof verifyPassword>>;
  try {
    passwordResult = await verifyPassword(password, legacyUser.password_hash);
  } catch {
    passwordResult = { valid: false };
  }
  if (!passwordResult.valid) {
    await recordFailedLogin(env, request, username).catch(() => {});
    return genericResponse();
  }
  await clearLoginRateLimit(env, request, username).catch(() => {});
  if (passwordResult.upgradedHash) await upgradePasswordHash(env, legacyUser.id, passwordResult.upgradedHash).catch(() => {});

  const runtime = createBetterAuthRuntime(env);
  try {
    const existingLink = await runtime.database.query(
      'select better_auth_user_id from public.auth_identity_links where legacy_user_id = $1 limit 1',
      [legacyUser.id],
    );
    if (existingLink.rows.length > 0) return genericResponse();

    const existingEmail = await runtime.database.query(
      'select id from better_auth."user" where email = $1 limit 1',
      [email],
    );
    if (existingEmail.rows.length > 0) return genericResponse();

    const result = await runtime.auth.api.signUpEmail({
      body: {
        email,
        name: legacyUser.full_name,
        password,
        username: legacyUser.username,
      },
      headers: new Headers({ 'x-solmint-legacy-migration': '1' }),
    }) as unknown as { user?: { id?: string } | null };

    if (!result.user?.id) return genericResponse();
    // The Better Auth user-create hook owns the identity bridge creation. The
    // endpoint intentionally does not write the bridge a second time.
    return genericResponse();
  } catch {
    return genericResponse();
  } finally {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      await runtime.database.end().catch(() => {});
    }
  }
};
