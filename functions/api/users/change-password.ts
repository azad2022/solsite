import { getBetterAuthApplicationUser } from '../auth/_application-session';
import { createBetterAuthRuntime } from '../auth/_instance';
import { jsonResponse, type Env } from '../auth/_shared';

type BetterAuthEnv = Env & {
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
};

export const onRequestPost = async ({ request, env }: { request: Request; env: BetterAuthEnv }) => {
  let runtime: ReturnType<typeof createBetterAuthRuntime> | null = null;
  try {
    const applicationUser = await getBetterAuthApplicationUser(request, env);
    if (!applicationUser) return jsonResponse({ success: false, message: 'نشست معتبر نیست.' }, 401);

    const body = await request.json().catch(() => ({})) as { currentPassword?: unknown; newPassword?: unknown };
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || newPassword.length < 8 || newPassword.length > 1024) {
      return jsonResponse({ success: false, message: 'رمز عبور فعلی و رمز جدید معتبر الزامی است.' }, 400);
    }
    if (currentPassword === newPassword) {
      return jsonResponse({ success: false, message: 'رمز عبور جدید باید با رمز فعلی متفاوت باشد.' }, 400);
    }

    runtime = createBetterAuthRuntime(env);
    const result = await runtime.auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: request.headers,
    });

    return Response.json({ success: true, message: 'رمز عبور با موفقیت تغییر کرد.' }, { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Password change error:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, message: 'تغییر رمز عبور انجام نشد.' }, 503);
  } finally {
    if (runtime) await runtime.close();
  }
};
