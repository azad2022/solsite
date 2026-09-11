import type { PayLocale } from '../types';

type ApiKeyMessage = {
  title: string;
  description: string;
  create: string;
  keyName: string;
  keyNamePlaceholder: string;
  expiration: string;
  never: string;
  createKey: string;
  active: string;
  expired: string;
  revoked: string;
  scope: string;
  lastUsed: string;
  neverUsed: string;
  created: string;
  revoke: string;
  rotate: string;
  confirmRevoke: string;
  confirmRotate: string;
  secretTitle: string;
  secretDescription: string;
  secretWarning: string;
  copySecret: string;
  copied: string;
  closeSecret: string;
  emptyTitle: string;
  emptyDescription: string;
  loading: string;
  retry: string;
  unauthorized: string;
  forbidden: string;
  validation: string;
  operationFailed: string;
  merchantRequired: string;
  serviceUnavailable: string;
  replaySecretUnavailable: string;
  manageHint: string;
};

const messages: Record<PayLocale, ApiKeyMessage> = {
  'fa-IR': {
    title: 'کلیدهای API', description: 'اعتبارنامه‌های دسترسی به API مرچنت را مدیریت کنید.', create: 'ساخت کلید جدید', keyName: 'نام کلید', keyNamePlaceholder: 'مثلاً production', expiration: 'تاریخ انقضا', never: 'بدون انقضا', createKey: 'ایجاد کلید', active: 'فعال', expired: 'منقضی', revoked: 'لغوشده', scope: 'دسترسی', lastUsed: 'آخرین استفاده', neverUsed: 'هنوز استفاده نشده', created: 'ایجاد شده', revoke: 'لغو کلید', rotate: 'چرخش کلید', confirmRevoke: 'این کلید لغو شود؟ پس از لغو دیگر قابل استفاده نیست.', confirmRotate: 'این کلید چرخانده شود؟ کلید فعلی فوراً لغو و یک کلید جدید ساخته می‌شود.', secretTitle: 'کلید جدید فقط همین حالا قابل مشاهده است', secretDescription: 'این مقدار را در یک محل امن ذخیره کنید. بعداً قابل بازیابی نیست.', secretWarning: 'کلید کامل در لاگ، URL، تحلیل‌گر یا مرورگر ذخیره نمی‌شود.', copySecret: 'کپی کلید', copied: 'کپی شد', closeSecret: 'بستن', emptyTitle: 'هنوز کلیدی وجود ندارد', emptyDescription: 'یک کلید API بسازید تا سرویس شما بتواند Payment Intent ایجاد کند.', loading: 'در حال دریافت کلیدها…', retry: 'تلاش دوباره', unauthorized: 'نشست شما معتبر نیست. دوباره وارد حساب شوید.', forbidden: 'فقط مالک فعال مرچنت می‌تواند کلیدهای API را مدیریت کند.', validation: 'نام کلید را وارد کنید.', operationFailed: 'عملیات انجام نشد.', merchantRequired: 'ابتدا یک مرچنت فعال ایجاد و کیف پول دریافت را تأیید کنید.', serviceUnavailable: 'سرویس Pay موقتاً در دسترس نیست.', replaySecretUnavailable: 'این درخواست قبلاً انجام شده است و کلید کامل دوباره نمایش داده نمی‌شود. برای دریافت یک secret جدید، یک چرخش جدید انجام دهید.', manageHint: 'تنها دسترسی منتشرشده فعلی: payment.create',
  },
  'en-US': {
    title: 'API keys', description: 'Manage the merchant credentials used to access the Pay API.', create: 'Create new key', keyName: 'Key name', keyNamePlaceholder: 'e.g. production', expiration: 'Expiration', never: 'Never expires', createKey: 'Create key', active: 'Active', expired: 'Expired', revoked: 'Revoked', scope: 'Scope', lastUsed: 'Last used', neverUsed: 'Never used', created: 'Created', revoke: 'Revoke key', rotate: 'Rotate key', confirmRevoke: 'Revoke this key? It cannot be used after revocation.', confirmRotate: 'Rotate this key? The current key will be revoked immediately and a new key will be created.', secretTitle: 'The new secret is shown only once', secretDescription: 'Store it in a secure location. It cannot be recovered later.', secretWarning: 'The full key is not stored in logs, URLs, analytics, or browser storage.', copySecret: 'Copy key', copied: 'Copied', closeSecret: 'Close', emptyTitle: 'No API keys yet', emptyDescription: 'Create an API key so your integration can create Payment Intents.', loading: 'Loading API keys…', retry: 'Retry', unauthorized: 'Your session is not valid. Sign in again.', forbidden: 'Only the active merchant owner can manage API keys.', validation: 'Enter a key name.', operationFailed: 'The operation failed.', merchantRequired: 'Create an active merchant and verify its receiving wallet first.', serviceUnavailable: 'The Pay service is temporarily unavailable.', replaySecretUnavailable: 'This request was already completed and the full secret cannot be shown again. Rotate the key with a new request to obtain a new secret.', manageHint: 'Currently released scope: payment.create',
  },
  ar: {
    title: 'مفاتيح API', description: 'إدارة بيانات اعتماد التاجر للوصول إلى واجهة Pay.', create: 'إنشاء مفتاح جديد', keyName: 'اسم المفتاح', keyNamePlaceholder: 'مثال: production', expiration: 'تاريخ الانتهاء', never: 'بدون انتهاء', createKey: 'إنشاء المفتاح', active: 'نشط', expired: 'منتهي', revoked: 'ملغى', scope: 'النطاق', lastUsed: 'آخر استخدام', neverUsed: 'لم يُستخدم بعد', created: 'أُنشئ', revoke: 'إلغاء المفتاح', rotate: 'تدوير المفتاح', confirmRevoke: 'إلغاء هذا المفتاح؟ لن يمكن استخدامه بعد الإلغاء.', confirmRotate: 'تدوير هذا المفتاح؟ سيُلغى المفتاح الحالي فوراً ويُنشأ مفتاح جديد.', secretTitle: 'يظهر السر الجديد مرة واحدة فقط', secretDescription: 'احفظه في مكان آمن. لا يمكن استعادته لاحقاً.', secretWarning: 'لا يتم حفظ المفتاح الكامل في السجلات أو عناوين URL أو التحليلات أو تخزين المتصفح.', copySecret: 'نسخ المفتاح', copied: 'تم النسخ', closeSecret: 'إغلاق', emptyTitle: 'لا توجد مفاتيح API بعد', emptyDescription: 'أنشئ مفتاح API ليتمكن التكامل من إنشاء Payment Intent.', loading: 'جارٍ تحميل المفاتيح…', retry: 'إعادة المحاولة', unauthorized: 'جلستك غير صالحة. سجّل الدخول مرة أخرى.', forbidden: 'يمكن لمالك التاجر النشط فقط إدارة مفاتيح API.', validation: 'أدخل اسم المفتاح.', operationFailed: 'تعذر تنفيذ العملية.', merchantRequired: 'أنشئ تاجراً نشطاً وتحقق من محفظة الاستلام أولاً.', serviceUnavailable: 'خدمة Pay غير متاحة مؤقتاً.', replaySecretUnavailable: 'تم تنفيذ هذا الطلب مسبقاً ولا يمكن عرض السر الكامل مرة أخرى. قم بالتدوير بطلب جديد للحصول على سر جديد.', manageHint: 'النطاق المنشور حالياً: payment.create',
  },
  ru: {
    title: 'API-ключи', description: 'Управляйте учётными данными мерчанта для доступа к Pay API.', create: 'Создать ключ', keyName: 'Название ключа', keyNamePlaceholder: 'например, production', expiration: 'Срок действия', never: 'Без срока', createKey: 'Создать ключ', active: 'Активен', expired: 'Истёк', revoked: 'Отозван', scope: 'Права', lastUsed: 'Последнее использование', neverUsed: 'Ещё не использовался', created: 'Создан', revoke: 'Отозвать ключ', rotate: 'Ротация ключа', confirmRevoke: 'Отозвать этот ключ? После отзыва он больше не будет работать.', confirmRotate: 'Выполнить ротацию? Текущий ключ будет немедленно отозван, а новый создан.', secretTitle: 'Новый секрет показывается только один раз', secretDescription: 'Сохраните его в безопасном месте. Восстановить его позже нельзя.', secretWarning: 'Полный ключ не сохраняется в логах, URL, аналитике или хранилище браузера.', copySecret: 'Копировать ключ', copied: 'Скопировано', closeSecret: 'Закрыть', emptyTitle: 'API-ключей пока нет', emptyDescription: 'Создайте API-ключ, чтобы интеграция могла создавать Payment Intent.', loading: 'Загрузка API-ключей…', retry: 'Повторить', unauthorized: 'Ваша сессия недействительна. Войдите снова.', forbidden: 'Только активный владелец мерчанта может управлять API-ключами.', validation: 'Введите название ключа.', operationFailed: 'Операция не выполнена.', merchantRequired: 'Сначала создайте активного мерчанта и подтвердите его кошелёк для приёма.', serviceUnavailable: 'Сервис Pay временно недоступен.', replaySecretUnavailable: 'Этот запрос уже выполнен, и полный секрет повторно не показывается. Выполните новую ротацию, чтобы получить новый секрет.', manageHint: 'Текущая опубликованная область: payment.create',
  },
};

export function apiKeyT(locale: PayLocale, key: keyof ApiKeyMessage): string {
  return messages[locale][key] ?? messages['fa-IR'][key];
}
