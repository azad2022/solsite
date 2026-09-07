import { APIError, createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { buildPasswordResetEmail, buildVerificationEmail, sendAuthEmail } from './_email';
import { provisionApplicationProfile } from './_application-profile';
import { getBetterAuthFoundationConfig, type BetterAuthEnv } from './_foundation';
import { createBetterAuthDatabase, type BetterAuthDatabaseEnv } from './_database';

interface BetterAuthRuntimeEnv extends BetterAuthEnv, BetterAuthDatabaseEnv {
  NODE_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
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
      requireEmailVerification: true,
    },
  };
}

export function createBetterAuthRuntime(env: BetterAuthRuntimeEnv) {
  const foundation = getBetterAuthFoundationConfig(env);
  const socialProviders = getGoogleProvider(env);
  const database = createBetterAuthDatabase(env);
  const secureCookies = foundation.baseURL.startsWith('https://');

  const auth = betterAuth({
    secret: foundation.secret,
    baseURL: foundation.baseURL,
    basePath: '/api/auth',
    trustedOrigins: foundation.trustedOrigins,
    database,
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
        disableImplicitLinking: true,
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
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const email = buildPasswordResetEmail(user.name, url);
        await sendAuthEmail(env, { to: user.email, ...email });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const email = buildVerificationEmail(user.name, url);
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
        joins: true,
      },
      useSecureCookies: secureCookies,
      cookies: {
        session_token: {
          name: secureCookies ? '__Host-solmint_auth_session' : 'solmint_auth_session',
          attributes: {
            httpOnly: true,
            secure: secureCookies,
            sameSite: 'strict',
            path: '/',
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') return;

        const isLegacyMigration = ctx.headers.get('x-solmint-legacy-migration') === '1';
        if (isLegacyMigration) return;

        const requestedUsername = typeof ctx.body?.username === 'string' ? ctx.body.username.trim().toLowerCase() : '';
        if (!requestedUsername) return;

        const existing = await database.query<{ id: string }>(
          `select id from public.users where lower(username) = lower($1) limit 1`,
          [requestedUsername],
        );

        if (existing.rows.length > 0) {
          throw new APIError('CONFLICT', { message: 'This username is already in use.' });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              await provisionApplicationProfile(database, {
                id: String(user.id),
                email: String(user.email),
                name: String(user.name),
                username: 'username' in user && typeof user.username === 'string' ? user.username : null,
                createdAt: user.createdAt,
              });
            } catch (error) {
              // Compensate for a successfully-created Better Auth user when the
              // application identity cannot be provisioned. This prevents an
              // authenticated identity from existing without an application user.
              await database.query('delete from better_auth."user" where id = $1', [String(user.id)]).catch(() => {});
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

  return { auth, database };
}

export function createBetterAuth(env: BetterAuthRuntimeEnv) {
  return createBetterAuthRuntime(env).auth;
}

export type SolmintBetterAuth = ReturnType<typeof createBetterAuth>;
export type SolmintBetterAuthRuntimeEnv = BetterAuthRuntimeEnv;
