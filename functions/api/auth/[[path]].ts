import type { PagesFunction } from '@cloudflare/workers-types';
import { createBetterAuthRuntime, type SolmintBetterAuthRuntimeEnv } from './_instance';

export const onRequest: PagesFunction<SolmintBetterAuthRuntimeEnv> = async (context) => {
  let runtime: ReturnType<typeof createBetterAuthRuntime> | null = null;

  try {
    runtime = createBetterAuthRuntime(context.env);
    return await runtime.auth.handler(context.request);
  } catch (error) {
    console.error('Better Auth request failed:', error instanceof Error ? error.message : 'unknown error');
    return new Response(JSON.stringify({
      success: false,
      error: 'AUTH_SERVICE_UNAVAILABLE',
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } finally {
    if (runtime && context.env.NODE_ENV !== 'development' && context.env.NODE_ENV !== 'test') {
      await runtime.database.end().catch((error) => {
        console.warn('Better Auth PostgreSQL pool shutdown failed:', error instanceof Error ? error.message : 'unknown error');
      });
    }
  }
};
