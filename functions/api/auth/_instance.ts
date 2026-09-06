import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { getBetterAuthFoundationConfig, type BetterAuthEnv } from './_foundation';
import { createBetterAuthDatabase, type BetterAuthDatabaseEnv } from './_database';

interface BetterAuthRuntimeEnv extends BetterAuthEnv, BetterAuthDatabaseEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
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

  const auth = betterAuth({
    secret: foundation.secret,
    baseURL: foundation.baseURL,
    basePath: '/api/auth',
    trustedOrigins: foundation.trustedOrigins,
    database,
    account: {
      identityStrategy: 'provider-id',
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      username({
        displayUsername: false,
        immutableUsername: true,
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
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'rateLimit',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': {
          window: 60,
          max: 5,
        },
        '/sign-up/email': {
          window: 60,
          max: 3,
        },
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
