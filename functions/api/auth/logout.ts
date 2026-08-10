import { clearSessionCookie, destroySession, jsonResponse, type Env } from './_shared';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    await destroySession(env, request);
  } catch (error) {
    console.error('Auth logout error:', error);
  }
  return jsonResponse({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() });
};
