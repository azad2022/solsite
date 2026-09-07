import { jsonResponse } from '../auth/_shared';

/**
 * Legacy registration is intentionally disabled after Better Auth became the
 * canonical registration boundary. Keeping this route writable would allow an
 * unauthenticated caller to create a legacy session that bypasses the new email
 * verification and identity-linking flow.
 */
export const onRequestPost = async () => jsonResponse({
  success: false,
  code: 'LEGACY_REGISTRATION_DISABLED',
  message: 'ثبت‌نام قدیمی غیرفعال شده است. لطفاً از مسیر رسمی /api/auth/sign-up/email استفاده کنید.'
}, 410);
