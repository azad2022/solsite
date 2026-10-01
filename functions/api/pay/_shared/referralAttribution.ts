const REFERRAL_COOKIE_NAME = 'solmint_referral_click';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const REFERRAL_CODE = /^sm_[0-9a-f]{12}$/i;
const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface ReferralCookie {
  clickId: string;
  referralCode: string;
}

export interface ReferralServiceEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

function getSupabaseSecret(env: ReferralServiceEnv): string {
  return env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
}

function getSupabaseBaseUrl(env: ReferralServiceEnv): string {
  const value = env.SUPABASE_URL?.trim() || 'https://nvopkbiedorfshwbmyhn.supabase.co';
  return value.replace(/\/$/, '');
}

async function rpc<T>(env: ReferralServiceEnv, functionName: string, body: Record<string, unknown>): Promise<T> {
  const secret = getSupabaseSecret(env);
  if (!secret) throw new Error('REFERRAL_SERVICE_MISCONFIGURED');

  const response = await fetch(
    `${getSupabaseBaseUrl(env)}/rest/v1/rpc/${functionName}`,
    {
      method: 'POST',
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    await response.text().catch(() => '');
    throw new Error('REFERRAL_SERVICE_UNAVAILABLE');
  }

  return await response.json() as T;
}

export function parseReferralCookieValue(value: string | null | undefined): ReferralCookie | null {
  if (!value) return null;

  let decoded = '';
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  const separator = decoded.indexOf('.');
  if (separator <= 0) return null;

  const clickId = decoded.slice(0, separator).trim();
  const referralCode = decoded.slice(separator + 1).trim().toLowerCase();
  if (!UUID.test(clickId) || !REFERRAL_CODE.test(referralCode)) return null;

  return { clickId, referralCode };
}

export function readReferralCookie(source: Request | Headers | null | undefined): ReferralCookie | null {
  const cookieHeader = source instanceof Headers
    ? source.get('Cookie') || ''
    : source?.headers.get('Cookie') || '';
  const prefix = REFERRAL_COOKIE_NAME + '=';
  const cookiePart = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix));

  if (!cookiePart) return null;

  const rawValue = cookiePart.slice(prefix.length).trim();
  const normalizedValue =
    rawValue.length >= 2 && rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue;

  return parseReferralCookieValue(normalizedValue);
}

export function referralCookieHeader(click: ReferralCookie, isSecure: boolean): string {
  const secure = isSecure ? '; Secure' : '';
  return `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(`${click.clickId}.${click.referralCode}`)}; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function expiredReferralCookieHeader(isSecure: boolean): string {
  const secure = isSecure ? '; Secure' : '';
  return `${REFERRAL_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export async function recordReferralClick(
  env: ReferralServiceEnv,
  referralCode: string,
): Promise<{ clickId: string; referralCode: string }> {
  const payload = await rpc<{ ok?: boolean; click_id?: string; referral_code?: string; reason?: string }>(
    env,
    'pay_record_referral_click',
    { p_referral_code: referralCode.trim().toLowerCase() },
  );

  if (payload.ok !== true || !payload.click_id || !payload.referral_code) {
    throw new Error(payload.reason || 'REFERRAL_NOT_FOUND');
  }

  return { clickId: payload.click_id, referralCode: payload.referral_code };
}

export interface ReferralAttributionResult {
  ok: boolean;
  attributed: boolean;
  reason?: string;
  attributionId?: string;
  affiliateId?: string;
  referrerApplicationUserId?: string;
  referredUserId?: string;
  referralCode?: string;
  deliveryId?: string;
}

export async function attributeReferralFromClick(
  env: ReferralServiceEnv,
  click: ReferralCookie,
  referredUserId: string,
): Promise<ReferralAttributionResult> {
  const payload = await rpc<{
    ok?: boolean;
    attributed?: boolean;
    reason?: string;
    attribution_id?: string;
    affiliate_id?: string;
    referrer_application_user_id?: string;
    referred_user_id?: string;
    referral_code?: string;
    delivery_id?: string;
  }>(
    env,
    'pay_attribute_referral_from_click',
    {
      p_click_id: click.clickId,
      p_referral_code: click.referralCode,
      p_referred_user_id: referredUserId,
    },
  );

  return {
    ok: payload.ok === true,
    attributed: payload.attributed === true,
    reason: payload.reason,
    attributionId: payload.attribution_id,
    affiliateId: payload.affiliate_id,
    referrerApplicationUserId: payload.referrer_application_user_id,
    referredUserId: payload.referred_user_id,
    referralCode: payload.referral_code,
    deliveryId: payload.delivery_id,
  };
}

export async function claimReferralSignupEmailDelivery(
  env: ReferralServiceEnv,
  deliveryId: string,
  workerId: string,
): Promise<{ ok: boolean; shouldSend: boolean; deliveryId?: string }> {
  const payload = await rpc<{ ok?: boolean; should_send?: boolean; delivery_id?: string }>(
    env,
    'pay_claim_referral_signup_email_delivery',
    { p_delivery_id: deliveryId, p_worker_id: workerId },
  );
  return {
    ok: payload.ok === true,
    shouldSend: payload.should_send === true,
    deliveryId: payload.delivery_id,
  };
}

export async function completeReferralSignupEmailDelivery(
  env: ReferralServiceEnv,
  deliveryId: string,
  workerId: string,
): Promise<boolean> {
  const payload = await rpc<{ ok?: boolean }>(
    env,
    'pay_complete_referral_signup_email_delivery',
    { p_delivery_id: deliveryId, p_worker_id: workerId },
  );
  return payload.ok === true;
}

export async function failReferralSignupEmailDelivery(
  env: ReferralServiceEnv,
  deliveryId: string,
  workerId: string,
  errorCode: string,
): Promise<boolean> {
  const payload = await rpc<{ ok?: boolean }>(
    env,
    'pay_fail_referral_signup_email_delivery',
    { p_delivery_id: deliveryId, p_worker_id: workerId, p_error_code: errorCode },
  );
  return payload.ok === true;
}

export { REFERRAL_COOKIE_NAME };
