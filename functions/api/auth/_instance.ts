import { APIError, createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { buildPasswordResetEmail, buildVerificationEmail, resolveAuthEmailLocale, sendAuthEmail } from './_email';
import { provisionApplicationProfile } from './_application-profile';
import { getBetterAuthFoundationConfig, type BetterAuthEnv } from './_foundation';
import { createBetterAuthDatabase, type BetterAuthDatabaseEnv } from './_database';

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
      sendResetPassword: async ({ user, url }, request) => {
        const locale = resolveAuthEmailLocale(request);
        const email = buildPasswordResetEmail(user.name, url, locale);
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
        if (ctx.path !== '/sign-up/email') return;

        const isLegacyMigration =
          isLegacyMigrationEnabled(env) &&
          legacyMigrationSecret.length > 0 &&
          isAuthorizedLegacyMigrationHeader(ctx.headers, legacyMigrationSecret);

        const body = ctx.body as { username?: unknown } | undefined;
        const requestedUsername = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
        if (!requestedUsername) return;

        const existing = await database.application.findApplicationUserByUsername(requestedUsername);
        if (existing && !isLegacyMigration) {
          throw new APIError('CONFLICT', { message: 'This username is already in use.' });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const record = user as typeof user & { username?: string | null };
              await provisionApplicationProfile(database.application, {
                id: String(record.id),
                email: String(record.email),
                name: String(record.name),
                username: typeof record.username === 'string' ? record.username : null,
                createdAt: record.createdAt,
              });
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
