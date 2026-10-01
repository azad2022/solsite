import { APIError, addOAuthServerContext, createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { buildPasswordResetEmail, buildReferralSignupEmail, buildVerificationEmail, buildWelcomeEmail, resolveAuthEmailLocale, sendAuthEmail, type AuthEmailLocale } from './_email';
import { provisionApplicationProfile } from './_application-profile';
import { getBetterAuthFoundationConfig, type BetterAuthEnv } from './_foundation';
import { createBetterAuthDatabase, type ApplicationAuthDatabase, type BetterAuthDatabaseEnv } from './_database';
import {
  attributeReferralFromClick,
  claimReferralSignupEmailDelivery,
  completeReferralSignupEmailDelivery,
  failReferralSignupEmailDelivery,
  readReferralCookie,
  type ReferralCookie,
  type ReferralServiceEnv,
} from '../pay/_shared/referralAttribution';

interface BetterAuthRuntimeEnv extends BetterAuthEnv, BetterAuthDatabaseEnv {
  NODE_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
  LEGACY_MIGRATION_ENABLED?: string;
  LEGACY_MIGRATION_SECRET?: string;
}

function getGoogleProvider(env: BetterAuthRuntimeEnv) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId && !clientSecret) return undefined;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }

  return {
    google: {
      clientId,
      clientSecret,
      redirectURI: 'https://solmint.ir/api/auth/callback/google',
      prompt: 'select_account' as const,
      requireEmailVerification: true,
    },
  };
}

function isLegacyMigrationEnabled(env: BetterAuthRuntimeEnv): boolean {
  return env.LEGACY_MIGRATION_ENABLED?.trim().toLowerCase() === 'true';
}

function isAuthorizedLegacyMigrationHeader(headers: Headers, secret: string): boolean {
  const supplied = headers.get('x-solmint-legacy-migration');
  return Boolean(supplied) && supplied === secret;
}

function setEmailVerificationCallback(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('callbackURL', '/auth/verified');
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildPasswordResetAppUrl(baseURL: string, token: string): string {
  const parsed = new URL('/auth/reset-password', baseURL);
  parsed.searchParams.set('token', token);
  return parsed.toString();
}

async function sendReferralSignupNotification(
  env: BetterAuthRuntimeEnv,
  application: ApplicationAuthDatabase,
  attribution: Awaited<ReturnType<typeof attributeReferralFromClick>>,
  referredUserName: string,
): Promise<void> {
  if (!attribution.attributed || !attribution.deliveryId || !attribution.referrerApplicationUserId) return;

  try {
    const identity = await application.findIdentityByApplicationUserId(attribution.referrerApplicationUserId);
    if (!identity) return;

    const referrer = await application.findBetterAuthUserById(identity.better_auth_user_id);
    if (!referrer?.email) return;

    const workerId = `pay-referral-signup-${crypto.randomUUID()}`;
    const claim = await claimReferralSignupEmailDelivery(
      env as ReferralServiceEnv,
      attribution.deliveryId,
      workerId,
    );
    if (!claim.ok || !claim.shouldSend || !claim.deliveryId) return;

    try {
      const email = buildReferralSignupEmail(
        referrer.name || 'SolMint User',
        referredUserName || 'کاربر جدید',
        'fa-IR',
      );
      await sendAuthEmail(env, { to: referrer.email, ...email });
      await completeReferralSignupEmailDelivery(env as ReferralServiceEnv, claim.deliveryId, workerId);
    } catch (error) {
      await failReferralSignupEmailDelivery(
        env as ReferralServiceEnv,
        claim.deliveryId,
        workerId,
        'REFERRAL_SIGNUP_EMAIL_SEND_FAILED',
      ).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.warn(JSON.stringify({
      scope: 'auth:referral-signup-email',
      error: error instanceof Error ? error.message.slice(0, 240) : 'unknown',
    }));
  }
}

async function processReferralSignup(
  env: BetterAuthRuntimeEnv,
  application: ApplicationAuthDatabase,
  click: ReferralCookie | null,
  betterAuthUserId: string,
  referredUserName: string,
): Promise<void> {
  if (!click) return;

  const applicationUser = await application.findIdentityByBetterAuthUserId(betterAuthUserId);
  if (!applicationUser) return;

  try {
    const attribution = await attributeReferralFromClick(
      env as ReferralServiceEnv,
      click,
      applicationUser.id,
    );
    await sendReferralSignupNotification(env, application, attribution, referredUserName);
  } catch (error) {
    console.warn(JSON.stringify({
      scope: 'auth:referral-attribution',
      error: error instanceof Error ? error.message.slice(0, 240) : 'unknown',
    }));
  }
}

function isAuthEmailLocale(value: unknown): value is AuthEmailLocale {
  return value === 'fa-IR' || value === 'en-US' || value === 'ar' || value === 'ru';
}

async function sendGoogleWelcomeNotification(
  env: BetterAuthRuntimeEnv,
  application: ApplicationAuthDatabase,
  betterAuthUserId: string,
  locale: AuthEmailLocale,
): Promise<void> {
  try {
    const user = await application.findBetterAuthUserById(betterAuthUserId);
    if (!user?.email) return;

    const workerId = `auth-google-welcome-${crypto.randomUUID()}`;
    const claim = await application.claimAuthWelcomeEmailDelivery(
      betterAuthUserId,
      'google',
      workerId,
    );
    if (!claim.ok || !claim.should_send || !claim.delivery_id) return;

    try {
      const email = buildWelcomeEmail(user.name || 'SolMint User', locale);
      await sendAuthEmail(env, { to: user.email, ...email });
      await application.completeAuthWelcomeEmailDelivery(claim.delivery_id, workerId);
    } catch (error) {
      await application.failAuthWelcomeEmailDelivery(
        claim.delivery_id,
        workerId,
        'GOOGLE_WELCOME_EMAIL_SEND_FAILED',
      ).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.warn(JSON.stringify({
      scope: 'auth:google-welcome-email',
      error: error instanceof Error ? error.message.slice(0, 240) : 'unknown',
    }));
  }
}


export function createBetterAuthRuntime(env: BetterAuthRuntimeEnv) {
  const foundation = getBetterAuthFoundationConfig(env);
  const socialProviders = getGoogleProvider(env);
  const database = createBetterAuthDatabase(env);
  const secureCookies = foundation.baseURL.startsWith('https://');
  const legacyMigrationSecret = env.LEGACY_MIGRATION_SECRET?.trim() || '';

  const auth = betterAuth({
    secret: foundation.secret,
    baseURL: foundation.baseURL,
    basePath: '/api/auth',
    trustedOrigins: foundation.trustedOrigins,
    disabledPaths: ['/is-username-available'],
    onAPIError: {
      errorURL: '/auth/error',
    },
    database: database.adapter,
    user: {
      modelName: 'user',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      modelName: 'session',
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    account: {
      identityStrategy: 'provider-id',
      modelName: 'account',
      storeStateStrategy: 'cookie',
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        disableImplicitLinking: false,
        allowDifferentEmails: false,
      },
      encryptOAuthTokens: true,
      fields: {
        userId: 'user_id',
        accountId: 'account_id',
        providerId: 'provider_id',
        issuer: 'issuer',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        idToken: 'id_token',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    verification: {
      modelName: 'verification',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }, request) => {
        const locale = resolveAuthEmailLocale(request);
        // Send users to the application reset UI rather than Better Auth's internal
        // /api/auth/reset-password/:token endpoint. The token itself is still
        // consumed and validated server-side by Better Auth on POST resetPassword.
        const resetUrl = buildPasswordResetAppUrl(foundation.baseURL, token);
        const email = buildPasswordResetEmail(user.name, resetUrl, locale);
        await sendAuthEmail(env, { to: user.email, ...email });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }, request) => {
        const locale = resolveAuthEmailLocale(request);
        const verificationUrl = setEmailVerificationCallback(url);
        const email = buildVerificationEmail(user.name, verificationUrl, locale);
        await sendAuthEmail(env, { to: user.email, ...email });
      },
    },
    plugins: [
      username({
        displayUsername: false,
        immutableUsername: true,
        schema: {
          user: {
            fields: {
              username: 'username',
            },
          },
        },
      }),
    ],
    ...(socialProviders ? { socialProviders } : {}),
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },
      database: {
        joins: false,
      },
      useSecureCookies: secureCookies,
      cookies: {
        session_token: {
          name: secureCookies ? '__Host-solmint_auth_session' : 'solmint_auth_session',
          attributes: {
            httpOnly: true,
            secure: secureCookies,
            sameSite: 'lax',
            path: '/',
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          const isLegacyMigration =
            isLegacyMigrationEnabled(env) &&
            legacyMigrationSecret.length > 0 &&
            isAuthorizedLegacyMigrationHeader(ctx.headers, legacyMigrationSecret);

          const body = ctx.body as { username?: unknown } | undefined;
          const requestedUsername = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
          if (requestedUsername) {
            const existing = await database.application.findApplicationUserByUsername(requestedUsername);
            if (existing && !isLegacyMigration) {
              throw new APIError('CONFLICT', { message: 'This username is already in use.' });
            }
          }
        }

        if (ctx.path === '/sign-in/social') {
          const click = ctx.request ? readReferralCookie(ctx.headers ?? ctx.request) : null;
          const authEmailLocale = resolveAuthEmailLocale(ctx.headers);
          await addOAuthServerContext({
            authEmailLocale,
            ...(click ? {
              referralClickId: click.clickId,
              referralCode: click.referralCode,
            } : {}),
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          const body = ctx.body as { email?: unknown } | undefined;
          const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
          const click = ctx.request ? readReferralCookie(ctx.headers ?? ctx.request) : null;
          if (email && click) {
            const identity = await database.application.findBetterAuthIdentityByEmail(email);
            if (identity) {
              const user = await database.application.findBetterAuthUserById(identity.id);
              const applicationUser = await database.application.findIdentityByBetterAuthUserId(identity.id);
              if (user && applicationUser) {
                const attribution = await attributeReferralFromClick(
                  env as ReferralServiceEnv,
                  click,
                  applicationUser.id,
                );
                await sendReferralSignupNotification(env, database.application, attribution, user.name || 'کاربر جدید');
              }
            }
          }
        }

        if (ctx.path.startsWith('/callback/')) {
          const newSession = ctx.context.newSession;
          const state = await getOAuthState().catch(() => null);
          const serverContext = state?.serverContext as { referralClickId?: unknown; referralCode?: unknown } | undefined;
          const click: ReferralCookie | null =
            typeof serverContext?.referralClickId === 'string' &&
            typeof serverContext.referralCode === 'string'
              ? { clickId: serverContext.referralClickId, referralCode: serverContext.referralCode }
              : null;

          if (newSession?.user?.id && click) {
            await processReferralSignup(
              env,
              database.application,
              click,
              String(newSession.user.id),
              String(newSession.user.name || 'کاربر جدید'),
            );
          }
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            try {
              const record = user as typeof user & { username?: string | null };
              await provisionApplicationProfile(database.application, {
                id: String(record.id),
                email: String(record.email),
                name: String(record.name),
                username: typeof record.username === 'string' ? record.username : null,
                createdAt: record.createdAt,
              });

              if (ctx.path === '/sign-up/email' || ctx.path.startsWith('/callback/')) {
                const requestClick = ctx.request ? readReferralCookie(ctx.headers ?? ctx.request) : null;
                const state = ctx.path.startsWith('/callback/')
                  ? await getOAuthState().catch(() => null)
                  : null;
                const serverContext = state?.serverContext as {
                  referralClickId?: unknown;
                  referralCode?: unknown;
                } | undefined;
                const stateClick: ReferralCookie | null =
                  typeof serverContext?.referralClickId === 'string' &&
                  typeof serverContext.referralCode === 'string'
                    ? {
                        clickId: serverContext.referralClickId,
                        referralCode: serverContext.referralCode,
                      }
                    : null;
                const click = requestClick ?? stateClick;
                await processReferralSignup(
                  env,
                  database.application,
                  click,
                  String(record.id),
                  String(record.name || 'کاربر جدید'),
                );
              }

              if (ctx.path === '/callback/google') {
                const state = await getOAuthState().catch(() => null);
                const serverContext = state?.serverContext as { authEmailLocale?: unknown } | undefined;
                const locale = isAuthEmailLocale(serverContext?.authEmailLocale)
                  ? serverContext.authEmailLocale
                  : 'en-US';
                await sendGoogleWelcomeNotification(
                  env,
                  database.application,
                  String(record.id),
                  locale,
                );
              }
            } catch (error) {
              await database.application.deleteBetterAuthUser(String(user.id)).catch(() => {});
              throw error;
            }
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'rate_limit',
      fields: {
        lastRequest: 'last_request',
      },
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-in/username': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
  });

  return { auth, database: database.adapter, application: database.application, close: database.close };
}

export function createBetterAuth(env: BetterAuthRuntimeEnv) {
  return createBetterAuthRuntime(env).auth;
}

export type SolmintBetterAuth = ReturnType<typeof createBetterAuth>;
export type SolmintBetterAuthRuntimeEnv = BetterAuthRuntimeEnv;
