import type { PayLocale } from '../types';

const messages = {
  'fa-IR': {
    title:'لینک‌های پرداخت', subtitle:'لینک‌های پرداخت واقعی ثبت‌شده برای این پذیرنده.', refresh:'به‌روزرسانی',
    noData:'هنوز لینک پرداختی ثبت نشده است.', loadFailed:'دریافت لینک‌های پرداخت ناموفق بود.', retry:'تلاش مجدد',
    unauthorized:'برای مشاهده لینک‌های پرداخت وارد شوید.', forbidden:'به لینک‌های پرداخت این پذیرنده دسترسی ندارید.',
    slug:'شناسه لینک', linkTitle:'عنوان', amount:'مبلغ اتمیک', asset:'دارایی', feePayer:'پرداخت‌کننده کارمزد',
    locale:'زبان Checkout', active:'فعال', inactive:'غیرفعال', expires:'انقضا', created:'ایجاد شده',
    readOnly:'این نما فقط داده واقعی موجود را نمایش می‌دهد؛ ایجاد یا تغییر لینک پرداخت تا ارائه contract رسمی Backend فعال نشده است.',
    details:'جزئیات', copy:'کپی لینک', copied:'کپی شد', close:'بستن',
  },
  'en-US': {
    title:'Payment Links', subtitle:'Real payment links recorded for this merchant.', refresh:'Refresh',
    noData:'No payment links yet.', loadFailed:'Payment links could not be loaded.', retry:'Retry',
    unauthorized:'Sign in to view payment links.', forbidden:'You do not have access to these merchant payment links.',
    slug:'Link slug', linkTitle:'Title', amount:'Atomic amount', asset:'Asset', feePayer:'Fee payer',
    locale:'Checkout locale', active:'Active', inactive:'Inactive', expires:'Expires', created:'Created',
    readOnly:'This view displays existing authoritative data only. Link creation or mutation remains disabled until an official Backend contract is released.',
    details:'Details', copy:'Copy link', copied:'Copied', close:'Close',
  },
  ar: {
    title:'روابط الدفع', subtitle:'روابط دفع حقيقية مسجلة لهذا التاجر.', refresh:'تحديث',
    noData:'لا توجد روابط دفع بعد.', loadFailed:'تعذر تحميل روابط الدفع.', retry:'إعادة المحاولة',
    unauthorized:'سجّل الدخول لعرض روابط الدفع.', forbidden:'لا تملك صلاحية الوصول إلى روابط دفع هذا التاجر.',
    slug:'معرّف الرابط', linkTitle:'العنوان', amount:'المبلغ الذري', asset:'الأصل', feePayer:'دافع الرسوم',
    locale:'لغة الدفع', active:'نشط', inactive:'غير نشط', expires:'ينتهي', created:'تم الإنشاء',
    readOnly:'يعرض هذا القسم البيانات الموثوقة الموجودة فقط. لن يتم تفعيل إنشاء أو تعديل الروابط قبل إصدار عقد رسمي من Backend.',
    details:'التفاصيل', copy:'نسخ الرابط', copied:'تم النسخ', close:'إغلاق',
  },
  ru: {
    title:'Платёжные ссылки', subtitle:'Реальные платёжные ссылки этого мерчанта.', refresh:'Обновить',
    noData:'Платёжных ссылок пока нет.', loadFailed:'Не удалось загрузить платёжные ссылки.', retry:'Повторить',
    unauthorized:'Войдите, чтобы видеть платёжные ссылки.', forbidden:'У вас нет доступа к платёжным ссылкам этого мерчанта.',
    slug:'Идентификатор ссылки', linkTitle:'Название', amount:'Сумма в atomic units', asset:'Актив', feePayer:'Плательщик комиссии',
    locale:'Язык Checkout', active:'Активна', inactive:'Неактивна', expires:'Истекает', created:'Создана',
    readOnly:'Этот раздел показывает только существующие достоверные данные. Создание и изменение ссылок остаются отключёнными до выпуска официального Backend-контракта.',
    details:'Подробности', copy:'Копировать ссылку', copied:'Скопировано', close:'Закрыть',
  },
} as const;

export type PaymentLinkTranslationKey = keyof typeof messages['fa-IR'];
export function paymentLinkT(locale: PayLocale,key:PaymentLinkTranslationKey): string { return messages[locale][key]; }
