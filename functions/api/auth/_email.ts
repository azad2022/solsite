interface AuthEmailEnv {
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
}

export type AuthEmailLocale = 'fa-IR' | 'en-US' | 'ar' | 'ru';

type AuthEmailCopy = {
  verification: {
    subject: string;
    eyebrow: string;
    title: string;
    greeting: (name: string) => string;
    body: string;
    button: string;
    expiry: string;
    footer: string;
  };
  reset: {
    subject: string;
    eyebrow: string;
    title: string;
    greeting: (name: string) => string;
    body: string;
    button: string;
    safety: string;
    footer: string;
  };
  direction: 'rtl' | 'ltr';
};

const LOGO_URL = 'https://solmint.ir/assets/solmint-mascot-solana-coin.webp';

const COPY: Record<AuthEmailLocale, AuthEmailCopy> = {
  'fa-IR': {
    direction: 'rtl',
    verification: {
      subject: 'تأیید ایمیل حساب SolMint',
      eyebrow: 'SolMint Account',
      title: 'ایمیل خود را تأیید کنید',
      greeting: (name) => `سلام ${name}`,
      body: 'برای تکمیل ساخت حساب SolMint و فعال‌سازی دسترسی شما، روی دکمه زیر بزنید.',
      button: 'تأیید ایمیل',
      expiry: 'این لینک محدودیت زمانی دارد و پس از انقضا دیگر معتبر نیست.',
      footer: 'این پیام برای امنیت حساب شما ارسال شده است.',
    },
    reset: {
      subject: 'بازیابی رمز عبور SolMint',
      eyebrow: 'SolMint Security',
      title: 'رمز عبور خود را تغییر دهید',
      greeting: (name) => `سلام ${name}`,
      body: 'برای انتخاب یک رمز عبور جدید و بازگرداندن دسترسی به حساب SolMint، روی دکمه زیر بزنید.',
      button: 'تغییر رمز عبور',
      safety: 'اگر این درخواست متعلق به شما نیست، این پیام را نادیده بگیرید.',
      footer: 'این پیام برای امنیت حساب شما ارسال شده است.',
    },
  },
  'en-US': {
    direction: 'ltr',
    verification: {
      subject: 'Verify your SolMint email',
      eyebrow: 'SolMint Account',
      title: 'Verify your email address',
      greeting: (name) => `Hello ${name}`,
      body: 'Complete your SolMint account setup and activate your access by clicking the button below.',
      button: 'Verify email',
      expiry: 'This link is time-limited and will expire.',
      footer: 'This message was sent to help keep your account secure.',
    },
    reset: {
      subject: 'Reset your SolMint password',
      eyebrow: 'SolMint Security',
      title: 'Choose a new password',
      greeting: (name) => `Hello ${name}`,
      body: 'Set a new password and restore access to your SolMint account by clicking the button below.',
      button: 'Reset password',
      safety: 'If you did not request this, you can safely ignore this message.',
      footer: 'This message was sent to help keep your account secure.',
    },
  },
  ar: {
    direction: 'rtl',
    verification: {
      subject: 'تأكيد بريدك الإلكتروني في SolMint',
      eyebrow: 'SolMint Account',
      title: 'أكد عنوان بريدك الإلكتروني',
      greeting: (name) => `مرحباً ${name}`,
      body: 'أكمل إنشاء حسابك في SolMint وفعّل وصولك من خلال الضغط على الزر أدناه.',
      button: 'تأكيد البريد الإلكتروني',
      expiry: 'هذا الرابط مؤقت وسينتهي بعد مدة محددة.',
      footer: 'أُرسلت هذه الرسالة للمساعدة في الحفاظ على أمان حسابك.',
    },
    reset: {
      subject: 'إعادة تعيين كلمة مرور SolMint',
      eyebrow: 'SolMint Security',
      title: 'اختر كلمة مرور جديدة',
      greeting: (name) => `مرحباً ${name}`,
      body: 'اختر كلمة مرور جديدة واستعد الوصول إلى حساب SolMint من خلال الضغط على الزر أدناه.',
      button: 'إعادة تعيين كلمة المرور',
      safety: 'إذا لم تطلب هذا الإجراء، يمكنك تجاهل هذه الرسالة بأمان.',
      footer: 'أُرسلت هذه الرسالة للمساعدة في الحفاظ على أمان حسابك.',
    },
  },
  ru: {
    direction: 'ltr',
    verification: {
      subject: 'Подтвердите электронную почту SolMint',
      eyebrow: 'SolMint Account',
      title: 'Подтвердите ваш адрес электронной почты',
      greeting: (name) => `Здравствуйте, ${name}`,
      body: 'Завершите создание аккаунта SolMint и активируйте доступ, нажав кнопку ниже.',
      button: 'Подтвердить почту',
      expiry: 'Ссылка ограничена по времени и перестанет действовать после истечения срока.',
      footer: 'Это сообщение отправлено для защиты вашего аккаунта.',
    },
    reset: {
      subject: 'Сброс пароля SolMint',
      eyebrow: 'SolMint Security',
      title: 'Выберите новый пароль',
      greeting: (name) => `Здравствуйте, ${name}`,
      body: 'Установите новый пароль и восстановите доступ к аккаунту SolMint, нажав кнопку ниже.',
      button: 'Сбросить пароль',
      safety: 'Если вы не запрашивали это действие, просто проигнорируйте сообщение.',
      footer: 'Это сообщение отправлено для защиты вашего аккаунта.',
    },
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeLocale(value: string | undefined): AuthEmailLocale {
  const locale = value?.trim().toLowerCase() || '';
  if (locale.startsWith('fa')) return 'fa-IR';
  if (locale.startsWith('ar')) return 'ar';
  if (locale.startsWith('ru')) return 'ru';
  return 'en-US';
}

export function resolveAuthEmailLocale(request?: Request): AuthEmailLocale {
  const language = request?.headers.get('accept-language')?.split(',')[0]?.split(';')[0];
  return normalizeLocale(language);
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
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text, html: input.html }),
  });

  if (!response.ok) {
    await response.text().catch(() => '');
    throw new Error('Authentication email delivery failed.');
  }
}

function renderEmailHtml(
  locale: AuthEmailLocale,
  title: string,
  greeting: string,
  body: string,
  button: string,
  url: string,
  secondary: string,
  footer: string,
): string {
  const copy = COPY[locale];
  const direction = copy.direction;
  const safeTitle = escapeHtml(title);
  const safeGreeting = escapeHtml(greeting);
  const safeBody = escapeHtml(body);
  const safeButton = escapeHtml(button);
  const safeUrl = escapeHtml(url);
  const safeSecondary = escapeHtml(secondary);
  const safeFooter = escapeHtml(footer);

  return `<!doctype html>
<html lang="${locale}" dir="${direction}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f7fb;margin:0;padding:28px 12px;width:100%;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #ececf3;border-radius:24px;overflow:hidden;box-shadow:0 16px 50px rgba(30,35,60,.08);">
          <tr><td style="height:5px;background:#ec4899;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:34px 36px 18px;text-align:center;">
            <img src="${LOGO_URL}" width="92" height="92" alt="SolMint" style="display:block;margin:0 auto 16px;width:92px;height:92px;border-radius:20px;object-fit:cover;">
            <div style="font-size:11px;line-height:18px;font-weight:800;letter-spacing:2px;color:#db2777;text-transform:uppercase;">SolMint</div>
          </td></tr>
          <tr><td style="padding:8px 36px 36px;text-align:${direction === 'rtl' ? 'right' : 'left'};" dir="${direction}">
            <div style="font-size:27px;line-height:38px;font-weight:800;color:#111827;margin-bottom:16px;">${safeTitle}</div>
            <div style="font-size:16px;line-height:28px;font-weight:700;color:#1f2937;margin-bottom:12px;">${safeGreeting}</div>
            <div style="font-size:15px;line-height:27px;color:#5b6475;margin-bottom:28px;">${safeBody}</div>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:${direction === 'rtl' ? '0 0 28px auto' : '0 auto 28px 0'};">
              <tr><td style="border-radius:14px;background:#ec4899;text-align:center;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;">${safeButton}</a>
              </td></tr>
            </table>
            <div style="padding:14px 16px;background:#fafafc;border:1px solid #eeeeF4;border-radius:14px;font-size:12px;line-height:22px;color:#737b8c;">${safeSecondary}</div>
          </td></tr>
          <tr><td style="padding:20px 36px 26px;border-top:1px solid #f0f0f4;text-align:center;">
            <div style="font-size:12px;line-height:21px;color:#8a91a1;">${safeFooter}</div>
            <div style="margin-top:8px;font-size:11px;line-height:18px;color:#a3a8b4;">SolMint · solmint.ir</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function buildVerificationEmail(userName: string, url: string, locale: AuthEmailLocale = 'en-US') {
  const copy = COPY[locale].verification;
  const safeName = escapeHtml(userName);
  return {
    subject: copy.subject,
    text: `${copy.greeting(userName)}\n\n${copy.body}\n\n${copy.button}: ${url}\n\n${copy.expiry}\n\n${copy.footer}`,
    html: renderEmailHtml(locale, copy.title, copy.greeting(userName), copy.body, copy.button, url, copy.expiry, copy.footer),
  };
}

export function buildPasswordResetEmail(userName: string, url: string, locale: AuthEmailLocale = 'en-US') {
  const copy = COPY[locale].reset;
  return {
    subject: copy.subject,
    text: `${copy.greeting(userName)}\n\n${copy.body}\n\n${copy.button}: ${url}\n\n${copy.safety}\n\n${copy.footer}`,
    html: renderEmailHtml(locale, copy.title, copy.greeting(userName), copy.body, copy.button, url, copy.safety, copy.footer),
  };
}
