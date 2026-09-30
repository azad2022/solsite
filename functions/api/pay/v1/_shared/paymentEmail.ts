import { sendAuthEmail, type AuthEmailLocale } from '../../../auth/_email';

export type PayMerchantEmailOutcome = 'success' | 'failure';

interface PaymentNotificationInput {
  outcome: PayMerchantEmailOutcome;
  locale: AuthEmailLocale;
  merchantName: string;
  paymentId: string;
  paymentStatus: string;
  amountAtomic: string;
  asset: string;
  tokenDecimals: number | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPurpose: string | null;
}

const COPY: Record<AuthEmailLocale, {
  successSubject: string;
  failureSubject: string;
  successTitle: string;
  failureTitle: string;
  successBody: string;
  failureBody: string;
  customer: string;
  paymentReason: string;
  status: string;
  amount: string;
  merchant: string;
  footer: string;
}> = {
  'fa-IR': {
    successSubject: 'رسید پرداخت موفق SolMint Pay',
    failureSubject: 'گزارش وضعیت ناموفق پرداخت SolMint Pay',
    successTitle: 'پرداخت با موفقیت تأیید شد',
    failureTitle: 'وضعیت پرداخت نیازمند توجه است',
    successBody: 'یک Payment Intent متعلق به مرچنت شما توسط Backend به وضعیت موفق و قابل اتکا رسیده است.',
    failureBody: 'یک Payment Intent متعلق به مرچنت شما به یک وضعیت منفی یا نیازمند بررسی رسیده است. وضعیت زیر همان وضعیت authoritative سرور است.',
    customer: 'پرداخت‌کننده',
    paymentReason: 'علت پرداخت',
    status: 'وضعیت',
    amount: 'مبلغ',
    merchant: 'مرچنت',
    footer: 'این پیام توسط SolMint Pay و بر اساس وضعیت authoritative سرویس پرداخت ارسال شده است.',
  },
  'en-US': {
    successSubject: 'SolMint Pay payment confirmed',
    failureSubject: 'SolMint Pay payment outcome',
    successTitle: 'Payment confirmed',
    failureTitle: 'Payment outcome requires attention',
    successBody: 'A Payment Intent belonging to your merchant reached an authoritative successful state on the payment backend.',
    failureBody: 'A Payment Intent belonging to your merchant reached a negative or review-required authoritative state. The status below comes from the payment backend.',
    customer: 'Payer',
    paymentReason: 'Payment reason',
    status: 'Status',
    amount: 'Amount',
    merchant: 'Merchant',
    footer: 'This message was sent by SolMint Pay from the authoritative payment service state.',
  },
  ar: {
    successSubject: 'تأكيد دفع SolMint Pay',
    failureSubject: 'نتيجة دفع SolMint Pay',
    successTitle: 'تم تأكيد الدفع',
    failureTitle: 'حالة الدفع تتطلب الانتباه',
    successBody: 'وصل Payment Intent الخاص بالتاجر إلى حالة نجاح مؤكدة من خادم الدفع.',
    failureBody: 'وصل Payment Intent الخاص بالتاجر إلى حالة سلبية أو تحتاج إلى مراجعة. الحالة أدناه هي الحالة المعتمدة من خادم الدفع.',
    customer: 'الدافع',
    paymentReason: 'سبب الدفع',
    status: 'الحالة',
    amount: 'المبلغ',
    merchant: 'التاجر',
    footer: 'أُرسلت هذه الرسالة بواسطة SolMint Pay استنادًا إلى الحالة المعتمدة لخدمة الدفع.',
  },
  ru: {
    successSubject: 'Платёж SolMint Pay подтверждён',
    failureSubject: 'Результат платежа SolMint Pay',
    successTitle: 'Платёж подтверждён',
    failureTitle: 'Статус платежа требует внимания',
    successBody: 'Payment Intent вашего мерчанта достиг подтверждённого сервером успешного состояния.',
    failureBody: 'Payment Intent вашего мерчанта перешёл в отрицательное состояние или состояние, требующее проверки. Ниже указан статус от платёжного сервера.',
    customer: 'Плательщик',
    paymentReason: 'Причина платежа',
    status: 'Статус',
    amount: 'Сумма',
    merchant: 'Мерчант',
    footer: 'Это сообщение отправлено SolMint Pay на основании авторитетного состояния платёжного сервиса.',
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

function formatAtomic(value: string, decimals: number): string {
  try {
    const atomic = BigInt(value);
    const base = 10n ** BigInt(decimals);
    const whole = atomic / base;
    const fraction = (atomic % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return value;
  }
}

function effectiveDecimals(asset: string, tokenDecimals: number | null): number {
  if (asset === 'SOL') return 9;
  return Number.isInteger(tokenDecimals) && (tokenDecimals as number) >= 0 && (tokenDecimals as number) <= 255
    ? tokenDecimals as number
    : 6;
}

function renderHtml(input: PaymentNotificationInput, copy: typeof COPY[AuthEmailLocale], amount: string): string {
  const direction = input.locale === 'fa-IR' || input.locale === 'ar' ? 'rtl' : 'ltr';
  const title = input.outcome === 'success' ? copy.successTitle : copy.failureTitle;
  const body = input.outcome === 'success' ? copy.successBody : copy.failureBody;
  const customerName = [input.customerFirstName, input.customerLastName].filter(Boolean).join(' ') || '—';
  const rows = [
    [copy.merchant, input.merchantName],
    [copy.customer, customerName],
    [copy.paymentReason, input.customerPurpose || '—'],
    [copy.amount, `${amount} ${input.asset}`],
    [copy.status, input.paymentStatus],
    ['Payment Intent', input.paymentId],
  ];

  return `<!doctype html>
<html lang="${input.locale}" dir="${direction}">
  <body style="margin:0;padding:28px 12px;background:#f7f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;border:1px solid #ececf3;border-radius:24px;overflow:hidden;">
        <tr><td style="height:5px;background:#ec4899;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:30px 34px 10px;text-align:center">
          <img src="https://solmint.ir/assets/solmint-mascot-solana-coin.webp" width="72" height="72" alt="SolMint" style="display:block;margin:0 auto 12px;border-radius:18px;object-fit:cover">
          <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#db2777;text-transform:uppercase">SolMint Pay</div>
        </td></tr>
        <tr><td dir="${direction}" style="padding:20px 34px 30px;text-align:${direction === 'rtl' ? 'right' : 'left'}">
          <h1 style="margin:0 0 12px;font-size:25px;line-height:1.35;color:#111827">${escapeHtml(title)}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.9;color:#5b6475">${escapeHtml(body)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0 8px">
            ${rows.map(([label, value]) => `<tr><td style="padding:11px 12px;background:#fafafc;border:1px solid #eeeeF4;font-size:11px;color:#737b8c;width:34%">${escapeHtml(label)}</td><td style="padding:11px 12px;background:#fafafc;border:1px solid #eeeeF4;border-inline-start:0;font-size:12px;font-weight:700;color:#172033;word-break:break-word">${escapeHtml(value)}</td></tr>`).join('')}
          </table>
          <p style="margin:20px 0 0;font-size:11px;line-height:1.8;color:#8a91a1">${escapeHtml(copy.footer)}</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`;
}

export function buildMerchantPaymentNotificationEmail(input: PaymentNotificationInput) {
  const copy = COPY[input.locale];
  const amount = formatAtomic(input.amountAtomic, effectiveDecimals(input.asset, input.tokenDecimals));
  const subjectBase = input.outcome === 'success' ? copy.successSubject : copy.failureSubject;
  const subject = `${subjectBase} — ${input.paymentId}`;
  const title = input.outcome === 'success' ? copy.successTitle : copy.failureTitle;
  const body = input.outcome === 'success' ? copy.successBody : copy.failureBody;
  const customerName = [input.customerFirstName, input.customerLastName].filter(Boolean).join(' ') || '—';
  const text = [
    title,
    '',
    body,
    '',
    `${copy.merchant}: ${input.merchantName}`,
    `${copy.customer}: ${customerName}`,
    `${copy.paymentReason}: ${input.customerPurpose || '—'}`,
    `${copy.amount}: ${amount} ${input.asset}`,
    `${copy.status}: ${input.paymentStatus}`,
    `Payment Intent: ${input.paymentId}`,
    '',
    copy.footer,
  ].join('\n');

  return { subject, text, html: renderHtml(input, copy, amount) };
}

export async function sendMerchantPaymentNotificationEmail(
  env: { NODE_ENV?: string; RESEND_API_KEY?: string; AUTH_EMAIL_FROM?: string },
  to: string,
  input: PaymentNotificationInput,
): Promise<void> {
  const email = buildMerchantPaymentNotificationEmail(input);
  await sendAuthEmail(env, { to, ...email });
}
