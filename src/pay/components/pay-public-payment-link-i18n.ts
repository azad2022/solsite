import type { PayLocale } from '../types';

const messages = {
  'fa-IR': {
    secure:'پرداخت امن SolMint Pay', paymentLink:'لینک پرداخت', amount:'مبلغ', feePayer:'پرداخت‌کننده کارمزد', firstName:'نام', lastName:'نام خانوادگی', paymentReason:'علت پرداخت', firstNamePlaceholder:'نام خود را وارد کنید', lastNamePlaceholder:'نام خانوادگی خود را وارد کنید', paymentReasonPlaceholder:'مثلاً پرداخت سفارش یا خدمات', customerInfoTitle:'اطلاعات پرداخت‌کننده', customerInfoHint:'برای ادامه پرداخت، اطلاعات زیر را وارد کنید. برای پرداخت در SolMint ثبت‌نام لازم نیست.', customerInfoPrivacy:'این اطلاعات فقط برای ثبت همین Payment Intent و اطلاع‌رسانی به پذیرنده ارسال می‌شود.', customerInfoValidation:'نام، نام خانوادگی و علت پرداخت را کامل کنید.',
    expires:'انقضا', noExpiry:'بدون انقضا', continue:'ادامه پرداخت', creating:'در حال آماده‌سازی پرداخت…',
    copy:'کپی لینک', copied:'کپی شد', description:'توضیحات', merchant:'پذیرنده', customer:'مشتری',
    loading:'در حال دریافت لینک پرداخت…', notFound:'این لینک پرداخت پیدا نشد یا دیگر فعال نیست.',
    expired:'این لینک پرداخت منقضی شده است.', unavailable:'این لینک فعلاً برای دریافت پرداخت آماده نیست.',
    failed:'آماده‌سازی پرداخت انجام نشد؛ دوباره تلاش کنید.', retry:'تلاش مجدد',
    invalid:'شناسه لینک پرداخت معتبر نیست.',
  },
  'en-US': {
    secure:'Secure SolMint Pay', paymentLink:'Payment link', amount:'Amount', feePayer:'Fee payer', firstName:'First name', lastName:'Last name', paymentReason:'Payment reason', firstNamePlaceholder:'Enter your first name', lastNamePlaceholder:'Enter your last name', paymentReasonPlaceholder:'e.g. Order or service payment', customerInfoTitle:'Payer information', customerInfoHint:'Enter the information below to continue. You do not need a SolMint account to pay.', customerInfoPrivacy:'This information is used only for this Payment Intent and merchant notification.', customerInfoValidation:'Complete your first name, last name, and payment reason.',
    expires:'Expires', noExpiry:'No expiration', continue:'Continue to payment', creating:'Preparing payment…',
    copy:'Copy link', copied:'Copied', description:'Description', merchant:'Merchant', customer:'Customer',
    loading:'Loading payment link…', notFound:'This payment link was not found or is no longer active.',
    expired:'This payment link has expired.', unavailable:'This payment link is not ready to accept payment.',
    failed:'Payment could not be prepared. Retry.', retry:'Retry', invalid:'Payment link slug is invalid.',
  },
  ar: {
    secure:'دفع آمن عبر SolMint Pay', paymentLink:'رابط الدفع', amount:'المبلغ', feePayer:'دافع الرسوم', firstName:'الاسم الأول', lastName:'اسم العائلة', paymentReason:'سبب الدفع', firstNamePlaceholder:'أدخل اسمك الأول', lastNamePlaceholder:'أدخل اسم العائلة', paymentReasonPlaceholder:'مثال: دفع طلب أو خدمة', customerInfoTitle:'بيانات الدافع', customerInfoHint:'أدخل البيانات التالية للمتابعة. لا تحتاج إلى التسجيل في SolMint لإتمام الدفع.', customerInfoPrivacy:'تُستخدم هذه المعلومات فقط لهذا Payment Intent ولإشعار التاجر.', customerInfoValidation:'أكمل الاسم الأول واسم العائلة وسبب الدفع.',
    expires:'ينتهي', noExpiry:'بدون انتهاء', continue:'متابعة الدفع', creating:'جارٍ تجهيز الدفع…',
    copy:'نسخ الرابط', copied:'تم النسخ', description:'الوصف', merchant:'التاجر', customer:'العميل',
    loading:'جارٍ تحميل رابط الدفع…', notFound:'تعذر العثور على رابط الدفع أو لم يعد نشطًا.',
    expired:'انتهت صلاحية رابط الدفع.', unavailable:'رابط الدفع غير جاهز لاستقبال الدفع حاليًا.',
    failed:'تعذر تجهيز الدفع. أعد المحاولة.', retry:'إعادة المحاولة', invalid:'معرّف رابط الدفع غير صالح.',
  },
  ru: {
    secure:'Безопасная оплата SolMint Pay', paymentLink:'Платёжная ссылка', amount:'Сумма', feePayer:'Плательщик комиссии', firstName:'Имя', lastName:'Фамилия', paymentReason:'Причина платежа', firstNamePlaceholder:'Введите имя', lastNamePlaceholder:'Введите фамилию', paymentReasonPlaceholder:'Например, оплата заказа или услуги', customerInfoTitle:'Данные плательщика', customerInfoHint:'Введите данные ниже, чтобы продолжить. Регистрация в SolMint для оплаты не требуется.', customerInfoPrivacy:'Эти данные используются только для этого Payment Intent и уведомления мерчанта.', customerInfoValidation:'Заполните имя, фамилию и причину платежа.',
    expires:'Истекает', noExpiry:'Без срока', continue:'Продолжить оплату', creating:'Подготовка платежа…',
    copy:'Копировать ссылку', copied:'Скопировано', description:'Описание', merchant:'Мерчант', customer:'Клиент',
    loading:'Загрузка платёжной ссылки…', notFound:'Платёжная ссылка не найдена или больше не активна.',
    expired:'Срок действия платёжной ссылки истёк.', unavailable:'Платёжная ссылка пока не готова принимать оплату.',
    failed:'Не удалось подготовить платёж. Повторите попытку.', retry:'Повторить', invalid:'Идентификатор платёжной ссылки недействителен.',
  },
} as const;

export type PublicPaymentLinkKey = keyof typeof messages['fa-IR'];
export function publicPaymentLinkT(locale: PayLocale,key:PublicPaymentLinkKey): string { return messages[locale][key]; }
