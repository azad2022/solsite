import type { PayLocale } from '../types';

const messages = {
  'fa-IR': {
    secure:'پرداخت امن SolMint Pay', paymentLink:'لینک پرداخت', amount:'مبلغ', feePayer:'پرداخت‌کنندهٔ کارمزد درگاه', firstName:'نام', lastName:'نام خانوادگی', paymentReason:'علت پرداخت', firstNamePlaceholder:'نام خود را وارد کنید', lastNamePlaceholder:'نام خانوادگی خود را وارد کنید', paymentReasonPlaceholder:'مثلاً پرداخت سفارش یا خدمات', customerInfoTitle:'اطلاعات پرداخت‌کننده', customerInfoHint:'برای ادامه پرداخت، اطلاعات زیر را وارد کنید. برای پرداخت در SolMint ثبت‌نام لازم نیست.', customerInfoPrivacy:'این اطلاعات فقط برای ثبت همین Payment Intent و اطلاع‌رسانی به پذیرنده ارسال می‌شود.', customerInfoValidation:'نام، نام خانوادگی و علت پرداخت را کامل کنید.',
    expires:'انقضا', noExpiry:'بدون انقضا', continue:'ادامه پرداخت', creating:'در حال آماده‌سازی پرداخت…',
    copy:'کپی لینک', copied:'کپی شد', description:'توضیحات', merchant:'پذیرنده', customer:'مشتری', customerTotal:'مبلغ نهایی پرداخت شما', gatewayFee:'کارمزد درگاه', merchantSettlement:'مبلغ دریافتی پذیرنده', merchantFeeExplanation:'کارمزد درگاه از مبلغ درج‌شده در لینک کسر می‌شود؛ مبلغ بالا همان مبلغی است که شما می‌پردازید.', customerFeeExplanation:'کارمزد درگاه به مبلغ درج‌شده در لینک اضافه می‌شود؛ مبلغ نهایی بالا شامل کارمزد است.',
    loading:'در حال دریافت لینک پرداخت…', notFound:'این لینک پرداخت پیدا نشد یا دیگر فعال نیست.',
    expired:'این لینک پرداخت منقضی شده است.', unavailable:'این لینک فعلاً برای دریافت پرداخت آماده نیست.',
    failed:'آماده‌سازی پرداخت انجام نشد؛ دوباره تلاش کنید.', retry:'تلاش مجدد',
    invalid:'شناسه لینک پرداخت معتبر نیست.', capacityReached:'ظرفیت این لینک پرداخت تکمیل شده است. برای دریافت ظرفیت آزادشده، دوباره بررسی کنید.', capacityRemaining:'ظرفیت باقی‌مانده: {count} از {limit} پرداخت',
  },
  'en-US': {
    secure:'Secure SolMint Pay', paymentLink:'Payment link', amount:'Amount', feePayer:'Who pays the gateway fee', firstName:'First name', lastName:'Last name', paymentReason:'Payment reason', firstNamePlaceholder:'Enter your first name', lastNamePlaceholder:'Enter your last name', paymentReasonPlaceholder:'e.g. Order or service payment', customerInfoTitle:'Payer information', customerInfoHint:'Enter the information below to continue. You do not need a SolMint account to pay.', customerInfoPrivacy:'This information is used only for this Payment Intent and merchant notification.', customerInfoValidation:'Complete your first name, last name, and payment reason.',
    expires:'Expires', noExpiry:'No expiration', continue:'Continue to payment', creating:'Preparing payment…',
    copy:'Copy link', copied:'Copied', description:'Description', merchant:'Merchant', customer:'Customer', customerTotal:'Total you pay', gatewayFee:'Gateway fee', merchantSettlement:'Merchant receives', merchantFeeExplanation:'The gateway fee is deducted from the listed amount. The total shown above is what you pay.', customerFeeExplanation:'The gateway fee is added to the listed amount. The total shown above includes the fee.',
    loading:'Loading payment link…', notFound:'This payment link was not found or is no longer active.',
    expired:'This payment link has expired.', unavailable:'This payment link is not ready to accept payment.',
    failed:'Payment could not be prepared. Retry.', retry:'Retry', invalid:'Payment link slug is invalid.', capacityReached:'This payment link has reached its payment limit. Refresh to check whether capacity has become available.', capacityRemaining:'Remaining capacity: {count} of {limit} payments',
  },
  ar: {
    secure:'دفع آمن عبر SolMint Pay', paymentLink:'رابط الدفع', amount:'المبلغ', feePayer:'من يتحمل رسوم بوابة الدفع', firstName:'الاسم الأول', lastName:'اسم العائلة', paymentReason:'سبب الدفع', firstNamePlaceholder:'أدخل اسمك الأول', lastNamePlaceholder:'أدخل اسم العائلة', paymentReasonPlaceholder:'مثال: دفع طلب أو خدمة', customerInfoTitle:'بيانات الدافع', customerInfoHint:'أدخل البيانات التالية للمتابعة. لا تحتاج إلى التسجيل في SolMint لإتمام الدفع.', customerInfoPrivacy:'تُستخدم هذه المعلومات فقط لهذا الدفع ولإشعار التاجر.', customerInfoValidation:'أكمل الاسم الأول واسم العائلة وسبب الدفع.',
    expires:'ينتهي', noExpiry:'بدون انتهاء', continue:'متابعة الدفع', creating:'جارٍ تجهيز الدفع…',
    copy:'نسخ الرابط', copied:'تم النسخ', description:'الوصف', merchant:'التاجر', customer:'العميل', customerTotal:'إجمالي المبلغ الذي تدفعه', gatewayFee:'رسوم بوابة الدفع', merchantSettlement:'المبلغ الذي يستلمه التاجر', merchantFeeExplanation:'تُخصم رسوم بوابة الدفع من المبلغ المدرج في الرابط؛ الإجمالي أعلاه هو ما ستدفعه.', customerFeeExplanation:'تُضاف رسوم بوابة الدفع إلى المبلغ المدرج في الرابط؛ الإجمالي أعلاه يشمل الرسوم.',
    loading:'جارٍ تحميل رابط الدفع…', notFound:'تعذر العثور على رابط الدفع أو لم يعد نشطًا.',
    expired:'انتهت صلاحية رابط الدفع.', unavailable:'رابط الدفع غير جاهز لاستقبال الدفع حاليًا.',
    failed:'تعذر تجهيز الدفع. أعد المحاولة.', retry:'إعادة المحاولة', invalid:'معرّف رابط الدفع غير صالح.', capacityReached:'وصل رابط الدفع إلى الحد الأقصى. حدّث الصفحة للتحقق من توفر سعة جديدة.', capacityRemaining:'السعة المتبقية: {count} من {limit} دفعة',
  },
  ru: {
    secure:'Безопасная оплата SolMint Pay', paymentLink:'Платёжная ссылка', amount:'Сумма', feePayer:'Кто оплачивает комиссию шлюза', firstName:'Имя', lastName:'Фамилия', paymentReason:'Причина платежа', firstNamePlaceholder:'Введите имя', lastNamePlaceholder:'Введите фамилию', paymentReasonPlaceholder:'Например, оплата заказа или услуги', customerInfoTitle:'Данные плательщика', customerInfoHint:'Введите данные ниже, чтобы продолжить. Регистрация в SolMint для оплаты не требуется.', customerInfoPrivacy:'Эти данные используются только для этого платежа и уведомления мерчанта.', customerInfoValidation:'Заполните имя, фамилию и причину платежа.',
    expires:'Истекает', noExpiry:'Без срока', continue:'Продолжить оплату', creating:'Подготовка платежа…',
    copy:'Копировать ссылку', copied:'Скопировано', description:'Описание', merchant:'Мерчант', customer:'Клиент', customerTotal:'Итого к оплате', gatewayFee:'Комиссия шлюза', merchantSettlement:'Получит мерчант', merchantFeeExplanation:'Комиссия шлюза вычитается из суммы по ссылке. Сумма выше — это сумма к оплате.', customerFeeExplanation:'Комиссия шлюза добавляется к сумме по ссылке. Сумма выше включает комиссию.',
    loading:'Загрузка платёжной ссылки…', notFound:'Платёжная ссылка не найдена или больше не активна.',
    expired:'Срок действия платёжной ссылки истёк.', unavailable:'Платёжная ссылка пока не готова принимать оплату.',
    failed:'Не удалось подготовить платёж. Повторите попытку.', retry:'Повторить', invalid:'Идентификатор платёжной ссылки недействителен.', capacityReached:'Для этой платёжной ссылки достигнут лимит. Обновите страницу, чтобы проверить доступность.', capacityRemaining:'Осталось мест: {count} из {limit} платежей',
  },
} as const;

export type PublicPaymentLinkKey = keyof typeof messages['fa-IR'];
export const publicPaymentLinkKeys = Object.keys(messages['fa-IR']) as PublicPaymentLinkKey[];
export function publicPaymentLinkT(locale: PayLocale, key: PublicPaymentLinkKey): string {
  return (messages[locale] as Record<PublicPaymentLinkKey, string>)[key] ?? '';
}
