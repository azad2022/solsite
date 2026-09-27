import type { PayLocale } from '../types';

const messages = {
  'fa-IR': {
    secure:'پرداخت امن SolMint Pay', paymentLink:'لینک پرداخت', amount:'مبلغ', feePayer:'پرداخت‌کننده کارمزد',
    expires:'انقضا', noExpiry:'بدون انقضا', continue:'ادامه پرداخت', creating:'در حال آماده‌سازی پرداخت…',
    copy:'کپی لینک', copied:'کپی شد', description:'توضیحات', merchant:'پذیرنده', customer:'مشتری',
    loading:'در حال دریافت لینک پرداخت…', notFound:'این لینک پرداخت پیدا نشد یا دیگر فعال نیست.',
    expired:'این لینک پرداخت منقضی شده است.', unavailable:'این لینک فعلاً برای دریافت پرداخت آماده نیست.',
    failed:'آماده‌سازی پرداخت انجام نشد؛ دوباره تلاش کنید.', retry:'تلاش مجدد',
    invalid:'شناسه لینک پرداخت معتبر نیست.',
  },
  'en-US': {
    secure:'Secure SolMint Pay', paymentLink:'Payment link', amount:'Amount', feePayer:'Fee payer',
    expires:'Expires', noExpiry:'No expiration', continue:'Continue to payment', creating:'Preparing payment…',
    copy:'Copy link', copied:'Copied', description:'Description', merchant:'Merchant', customer:'Customer',
    loading:'Loading payment link…', notFound:'This payment link was not found or is no longer active.',
    expired:'This payment link has expired.', unavailable:'This payment link is not ready to accept payment.',
    failed:'Payment could not be prepared. Retry.', retry:'Retry', invalid:'Payment link slug is invalid.',
  },
  ar: {
    secure:'دفع آمن عبر SolMint Pay', paymentLink:'رابط الدفع', amount:'المبلغ', feePayer:'دافع الرسوم',
    expires:'ينتهي', noExpiry:'بدون انتهاء', continue:'متابعة الدفع', creating:'جارٍ تجهيز الدفع…',
    copy:'نسخ الرابط', copied:'تم النسخ', description:'الوصف', merchant:'التاجر', customer:'العميل',
    loading:'جارٍ تحميل رابط الدفع…', notFound:'تعذر العثور على رابط الدفع أو لم يعد نشطًا.',
    expired:'انتهت صلاحية رابط الدفع.', unavailable:'رابط الدفع غير جاهز لاستقبال الدفع حاليًا.',
    failed:'تعذر تجهيز الدفع. أعد المحاولة.', retry:'إعادة المحاولة', invalid:'معرّف رابط الدفع غير صالح.',
  },
  ru: {
    secure:'Безопасная оплата SolMint Pay', paymentLink:'Платёжная ссылка', amount:'Сумма', feePayer:'Плательщик комиссии',
    expires:'Истекает', noExpiry:'Без срока', continue:'Продолжить оплату', creating:'Подготовка платежа…',
    copy:'Копировать ссылку', copied:'Скопировано', description:'Описание', merchant:'Мерчант', customer:'Клиент',
    loading:'Загрузка платёжной ссылки…', notFound:'Платёжная ссылка не найдена или больше не активна.',
    expired:'Срок действия платёжной ссылки истёк.', unavailable:'Платёжная ссылка пока не готова принимать оплату.',
    failed:'Не удалось подготовить платёж. Повторите попытку.', retry:'Повторить', invalid:'Идентификатор платёжной ссылки недействителен.',
  },
} as const;

export type PublicPaymentLinkKey = keyof typeof messages['fa-IR'];
export function publicPaymentLinkT(locale: PayLocale,key:PublicPaymentLinkKey): string { return messages[locale][key]; }
