import { createBetterAuth } from './_instance';
import { createBetterAuthDatabase } from './_database';
import { findUser, upgradePasswordHash, verifyPassword, type Env } from './_shared';

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

export const onRequestPost = async ({ request, env }: { request: Request; env: MigrationEnv }) => {
  if (request.method !== 'POST') return Response.json({ ok: false }, { status: 405 });

  let body: { username?: string; password?: string; email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }

  const username = body.username?.trim() || '';
  const password = body.password || '';
  const email = body.email?.trim().toLowerCase() || '';
  if (!username || !password || !EMAIL_RE.test(email) || email.length > 320) {
    return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }

  const legacyUser = await findUser(env, username).catch(() => null);
  if (!legacyUser || legacyUser.is_active === false) return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });

  const passwordResult = await verifyPassword(password, legacyUser.password_hash).catch(() => ({ valid: false }));
  if (!passwordResult.valid) return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  if (passwordResult.upgradedHash) await upgradePasswordHash(env, legacyUser.id, passwordResult.upgradedHash).catch(() => {});

  const runtime = createBetterAuth(env);
  const database = createBetterAuthDatabase(env);
  try {
    const existingLink = await database.query('select better_auth_user_id from public.auth_identity_links where legacy_user_id = $1 limit 1', [legacyUser.id]);
    if (existingLink.rows.length > 0) return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });

    const existingEmail = await database.query('select id from better_auth."user" where email = $1 limit 1', [email]);
    if (existingEmail.rows.length > 0) return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });

    const result = await runtime.api.signUpEmail({
      body: {
        email,
        name: legacyUser.full_name,
        password,
        username: legacyUser.username,
      },
    }) as unknown as { user?: { id?: string } | null };

    const betterAuthUserId = result.user?.id ? String(result.user.id) : '';
    if (!betterAuthUserId) return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });

    await database.query(
      `insert into public.auth_identity_links (better_auth_user_id, legacy_user_id, source)
       values ($1, $2, 'legacy-migration')`,
      [betterAuthUserId, legacyUser.id],
    );

    return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(GENERIC_RESPONSE, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } finally {
    await database.end().catch(() => {});
  }
};
