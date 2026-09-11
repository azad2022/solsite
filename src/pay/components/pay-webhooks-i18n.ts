import type { PayLocale } from '../types';

type WebhookCopy = {
  title: string; description: string; refresh: string; endpoint: string; status: string; secret: string; signature: string;
  deliveries: string; failures: string; active: string; inactive: string; configured: string; notConfigured: string;
  serverSigned: string; notConfiguredSignature: string; history: string; event: string; attempts: string; response: string;
  lastAttempt: string; delivered: string; nextRetry: string; error: string; noWebhooks: string; noDeliveries: string;
  loading: string; errorTitle: string; retry: string; select: string; readOnly: string;
};

const copy: Record<PayLocale, WebhookCopy> = {
  'fa-IR': {
    title: 'وبهوک‌ها', description: 'وضعیت endpointهای اعلان و سابقه تحویل رویدادها از سرویس واقعی Pay.', refresh: 'به‌روزرسانی', endpoint: 'Endpoint', status: 'وضعیت', secret: 'Secret', signature: 'امضای درخواست',
    deliveries: 'تحویل‌ها', failures: 'تحویل ناموفق', active: 'فعال', inactive: 'غیرفعال', configured: 'تنظیم‌شده', notConfigured: 'تنظیم نشده', serverSigned: 'امضای سمت سرور فعال', notConfiguredSignature: 'امضا پیکربندی نشده', history: 'سابقه تحویل', event: 'رویداد', attempts: 'تلاش', response: 'پاسخ', lastAttempt: 'آخرین تلاش', delivered: 'تحویل‌شده', nextRetry: 'تلاش بعدی', error: 'خطا', noWebhooks: 'وبهوکی برای این مرچنت ثبت نشده است.', noDeliveries: 'سابقه تحویلی برای این وبهوک وجود ندارد.', loading: 'در حال دریافت اطلاعات وبهوک…', errorTitle: 'دریافت اطلاعات وبهوک ناموفق بود.', retry: 'تلاش دوباره', select: 'برای مشاهده سابقه، یک وبهوک را انتخاب کنید.', readOnly: 'مدیریت ساخت/ویرایش هنوز از طریق قرارداد رسمی Backend ارائه نشده است؛ این صفحه فقط نمایش authoritative است.',
  },
  'en-US': {
    title: 'Webhooks', description: 'Real webhook endpoint status and delivery history from the Pay service.', refresh: 'Refresh', endpoint: 'Endpoint', status: 'Status', secret: 'Secret', signature: 'Request signature',
    deliveries: 'Deliveries', failures: 'Failed deliveries', active: 'Active', inactive: 'Inactive', configured: 'Configured', notConfigured: 'Not configured', serverSigned: 'Server signing enabled', notConfiguredSignature: 'Signing not configured', history: 'Delivery history', event: 'Event', attempts: 'Attempts', response: 'Response', lastAttempt: 'Last attempt', delivered: 'Delivered', nextRetry: 'Next retry', error: 'Error', noWebhooks: 'No webhooks are registered for this merchant.', noDeliveries: 'No delivery history is available for this webhook.', loading: 'Loading webhook data…', errorTitle: 'Webhook data could not be loaded.', retry: 'Try again', select: 'Select a webhook to inspect delivery history.', readOnly: 'Create/edit management is not exposed by the official Backend contract yet; this surface is authoritative read-only data.',
  },
  ar: {
    title: 'Webhooks', description: 'حالة نقاط Webhook وسجل التسليم من خدمة Pay الفعلية.', refresh: 'تحديث', endpoint: 'Endpoint', status: 'الحالة', secret: 'Secret', signature: 'توقيع الطلب',
    deliveries: 'عمليات التسليم', failures: 'عمليات التسليم الفاشلة', active: 'نشط', inactive: 'غير نشط', configured: 'مُهيأ', notConfigured: 'غير مُهيأ', serverSigned: 'توقيع الخادم مفعّل', notConfiguredSignature: 'التوقيع غير مُهيأ', history: 'سجل التسليم', event: 'الحدث', attempts: 'المحاولات', response: 'الاستجابة', lastAttempt: 'آخر محاولة', delivered: 'تم التسليم', nextRetry: 'المحاولة التالية', error: 'خطأ', noWebhooks: 'لا توجد Webhooks مسجلة لهذا التاجر.', noDeliveries: 'لا يوجد سجل تسليم لهذه الـWebhook.', loading: 'جارٍ تحميل بيانات Webhook…', errorTitle: 'تعذر تحميل بيانات Webhook.', retry: 'إعادة المحاولة', select: 'اختر Webhook لعرض سجل التسليم.', readOnly: 'إدارة الإنشاء والتعديل غير متاحة بعد في عقد Backend الرسمي؛ هذه الشاشة للعرض الموثوق فقط.',
  },
  ru: {
    title: 'Вебхуки', description: 'Статус webhook-эндпоинтов и история доставки из реального сервиса Pay.', refresh: 'Обновить', endpoint: 'Endpoint', status: 'Статус', secret: 'Секрет', signature: 'Подпись запроса',
    deliveries: 'Доставки', failures: 'Неудачные доставки', active: 'Активен', inactive: 'Неактивен', configured: 'Настроен', notConfigured: 'Не настроен', serverSigned: 'Подпись сервера включена', notConfiguredSignature: 'Подпись не настроена', history: 'История доставки', event: 'Событие', attempts: 'Попытки', response: 'Ответ', lastAttempt: 'Последняя попытка', delivered: 'Доставлено', nextRetry: 'Следующая попытка', error: 'Ошибка', noWebhooks: 'Для этого мерчанта вебхуки не зарегистрированы.', noDeliveries: 'История доставки для этого вебхука отсутствует.', loading: 'Загрузка данных вебхуков…', errorTitle: 'Не удалось загрузить данные вебхуков.', retry: 'Повторить', select: 'Выберите вебхук, чтобы открыть историю доставки.', readOnly: 'Управление созданием и изменением ещё не опубликовано в официальном Backend-контракте; этот экран только для достоверного чтения.',
  },
};

export function webhookCopy(locale: PayLocale): WebhookCopy { return copy[locale]; }
