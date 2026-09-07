interface AuthEmailEnv {
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function requireEmailConfig(env: AuthEmailEnv): { apiKey: string; from: string } {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error('Transactional authentication email is not configured.');
  }
  return { apiKey, from };
}

export async function sendAuthEmail(
  env: AuthEmailEnv,
  input: { to: string; subject: string; text: string; html: string },
): Promise<void> {
  if (env.NODE_ENV === 'test' && !env.RESEND_API_KEY && !env.AUTH_EMAIL_FROM) return;
  const { apiKey, from } = requireEmailConfig(env);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    await response.text().catch(() => '');
    throw new Error('Authentication email delivery failed.');
  }
}

export function buildVerificationEmail(userName: string, url: string) {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(url);
  return {
    subject: 'تأیید ایمیل حساب سولمینت',
    text: `سلام ${userName}\n\nبرای تأیید ایمیل حساب سولمینت، این لینک را باز کنید:\n${url}\n\nاین لینک محدودیت زمانی دارد.`,
    html: `<p>سلام ${safeName}</p><p>برای تأیید ایمیل حساب سولمینت، لینک زیر را باز کنید:</p><p><a href="${safeUrl}">تأیید ایمیل</a></p><p>این لینک محدودیت زمانی دارد.</p>`,
  };
}

export function buildPasswordResetEmail(userName: string, url: string) {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(url);
  return {
    subject: 'بازیابی رمز عبور سولمینت',
    text: `سلام ${userName}\n\nبرای تغییر رمز عبور سولمینت، این لینک را باز کنید:\n${url}\n\nاگر این درخواست متعلق به شما نیست، آن را نادیده بگیرید.`,
    html: `<p>سلام ${safeName}</p><p>برای تغییر رمز عبور سولمینت، لینک زیر را باز کنید:</p><p><a href="${safeUrl}">تغییر رمز عبور</a></p><p>اگر این درخواست متعلق به شما نیست، آن را نادیده بگیرید.</p>`,
  };
}
