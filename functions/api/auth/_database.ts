import { Pool } from 'pg';

export interface BetterAuthDatabaseEnv {
  NODE_ENV?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString: string;
  };
}

let localPool: Pool | null = null;

function isLocalRuntime(env: BetterAuthDatabaseEnv): boolean {
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}

function getConnectionString(env: BetterAuthDatabaseEnv): string {
  const hyperdriveUrl = env.HYPERDRIVE?.connectionString?.trim();
  if (hyperdriveUrl) return hyperdriveUrl;

  const developmentUrl = env.BETTER_AUTH_DATABASE_URL?.trim();
  if (developmentUrl && isLocalRuntime(env)) return developmentUrl;

  throw new Error(
    'Better Auth PostgreSQL transport is not configured. Production Pages Functions require the HYPERDRIVE binding; direct database URLs are development/test-only.'
  );
}

/**
 * Creates a PostgreSQL pool backed by Cloudflare Hyperdrive.
 * The pool object is request-scoped because the Workers runtime owns the
 * underlying remote connection pool through Hyperdrive.
 */
export function createBetterAuthDatabase(env: BetterAuthDatabaseEnv): Pool {
  const connectionString = getConnectionString(env);

  if (isLocalRuntime(env) && env.HYPERDRIVE == null) {
    localPool ??= new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      options: '-c search_path=better_auth,public',
    });
    return localPool;
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    options: '-c search_path=better_auth,public',
  });
}

export async function assertBetterAuthDatabaseConnectivity(env: BetterAuthDatabaseEnv): Promise<void> {
  const pool = createBetterAuthDatabase(env);
  const client = await pool.connect();
  try {
    await client.query('select 1');
  } finally {
    client.release();
    if (!isLocalRuntime(env) || env.HYPERDRIVE) {
      await pool.end();
    }
  }
}
