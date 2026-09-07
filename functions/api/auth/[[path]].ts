import { createBetterAuthRuntime, type SolmintBetterAuthRuntimeEnv } from './_instance';

type PagesAuthContext = {
  request: Request;
  env: SolmintBetterAuthRuntimeEnv;
};

export const onRequest = async ({ request, env }: PagesAuthContext): Promise<Response> => {
  let runtime: ReturnType<typeof createBetterAuthRuntime> | null = null;

  try {
    runtime = createBetterAuthRuntime(env);
    return await runtime.auth.handler(request);
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
    if (runtime) {
      await runtime.close().catch((error) => {
        console.warn('Better Auth runtime cleanup failed:', error instanceof Error ? error.message : 'unknown error');
      });
    }
  }
};
