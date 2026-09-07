import { jsonResponse } from '../auth/_shared';

/**
 * Legacy username/password login is intentionally disabled after Better Auth
 * became the canonical authentication boundary. Existing legacy sessions may
 * remain valid only for the controlled migration window; this endpoint must not
 * mint any new legacy session.
 */
export const onRequestPost = async () => jsonResponse({
  success: false,
  code: 'LEGACY_LOGIN_DISABLED',
  message: 'ورود قدیمی غیرفعال شده است. لطفاً از مسیر رسمی Better Auth استفاده کنید.'
}, 410);
