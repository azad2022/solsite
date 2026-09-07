import type { PayDirection, PayLocale, PaySection } from './types';

export const DEFAULT_PAY_LOCALE: PayLocale = 'fa-IR';

const messages = {
  'fa-IR': {
    brand: 'SolMint Pay', eyebrow: 'درگاه پرداخت Solana', dashboard: 'مرکز عملیات پرداخت', menu: 'منوی اصلی', language: 'زبان', openMenu: 'باز کردن منو', closeMenu: 'بستن منو',
    overview: 'نمای کلی', transactions: 'تراکنش‌ها', merchants: 'مرچنت‌ها', customers: 'مشتریان', invoices: 'فاکتورها', referrals: 'معرفی و همکاری', reports: 'گزارش‌ها', tickets: 'پشتیبانی', developer: 'توسعه‌دهنده', security: 'امنیت',
    overviewTitle: 'نمای کلی پرداخت', overviewDescription: 'مرکز عملیاتی برای مشاهده وضعیت واقعی پرداخت‌ها، تسویه و فعالیت مرچنت.', emptyTitle: 'داده عملیاتی هنوز در دسترس نیست', emptyDescription: 'رابط Pay آماده است و داده‌های واقعی فقط پس از اتصال سرویس رسمی پرداخت نمایش داده می‌شوند.',
    serverTruth: 'مرجع حقیقت', serverTruthValue: 'سرور پرداخت', tenantIsolation: 'تفکیک مرچنت', tenantIsolationValue: 'اعمال‌شده در لایه امنیتی سرور', financialState: 'وضعیت مالی', financialStateValue: 'فقط از سرویس رسمی', readOnlyFoundation: 'زیرساخت رابط آماده است؛ هیچ عدد مالی محلی یا داده ساختگی نمایش داده نمی‌شود.', noData: 'اطلاعاتی برای نمایش وجود ندارد', sectionDescription: 'این بخش برای داده‌های واقعی و authoritative سرویس پرداخت آماده شده است.', operational: 'عملیاتی', secureBoundary: 'مرز امن Pay', secureBoundaryText: 'محاسبات مالی، احراز تراکنش، تسویه و تفکیک مرچنت خارج از UI نگهداری می‌شوند.', apiPending: 'اتصال سرویس پرداخت در این لایه هنوز ارائه نشده است.', timeRange: 'بازه زمانی', today: 'امروز', sevenDays: '۷ روز', thirtyDays: '۳۰ روز', profile: 'حساب کاربری', account: 'حساب', notConnected: 'اتصال حساب در این لایه هنوز فعال نیست', footer: 'SolMint Pay — رابط مستقل پرداخت',
    checkout: 'پرداخت', checkoutSecure: 'اتصال امن', backToPay: 'بازگشت به Pay', checkoutWaitingTitle: 'در انتظار Payment Intent معتبر', checkoutWaitingDescription: 'جزئیات پرداخت فقط از snapshot معتبر سرویس پرداخت نمایش داده می‌شود؛ این صفحه هیچ مبلغ، مقصد یا کارمزد را خودش محاسبه نمی‌کند.', paymentState: 'وضعیت پرداخت', awaitingIntent: 'در انتظار Intent', verification: 'تأیید', verificationPending: 'در انتظار سرویس تأیید', expiration: 'انقضا', awaitingSnapshot: 'هنوز دریافت نشده', checkoutSnapshot: 'مرجع پرداخت', checkoutSnapshotDescription: 'برای شروع پرداخت، یک Payment Intent معتبر باید از Backend دریافت شود. ارسال تراکنش به‌تنهایی موفقیت پرداخت محسوب نمی‌شود.', checkoutIntentMissing: 'شناسه Intent در مسیر وجود ندارد.', paymentConfirmed: 'پرداخت تأیید شد',
  },
  'en-US': {
    brand: 'SolMint Pay', eyebrow: 'Solana Payment Gateway', dashboard: 'Payment operations', menu: 'Main menu', language: 'Language', openMenu: 'Open menu', closeMenu: 'Close menu',
    overview: 'Overview', transactions: 'Transactions', merchants: 'Merchants', customers: 'Customers', invoices: 'Invoices', referrals: 'Referrals', reports: 'Reports', tickets: 'Support', developer: 'Developer', security: 'Security',
    overviewTitle: 'Payment overview', overviewDescription: 'Operational workspace for real payment state, settlement, and merchant activity.', emptyTitle: 'Operational data is not available yet', emptyDescription: 'The Pay interface is ready. Real data will appear only after the official payment service is connected.',
    serverTruth: 'Source of truth', serverTruthValue: 'Payment server', tenantIsolation: 'Merchant isolation', tenantIsolationValue: 'Enforced by server security', financialState: 'Financial state', financialStateValue: 'Official service only', readOnlyFoundation: 'The UI foundation is ready; no local financial figures or fabricated data are rendered.', noData: 'No information to display', sectionDescription: 'This section is prepared for authoritative data from the payment service.', operational: 'Operational', secureBoundary: 'Secure Pay boundary', secureBoundaryText: 'Financial calculations, transaction verification, settlement, and merchant isolation remain outside the UI.', apiPending: 'The payment service endpoint is not exposed to this frontend layer yet.', timeRange: 'Time range', today: 'Today', sevenDays: '7 days', thirtyDays: '30 days', profile: 'Account', account: 'Account', notConnected: 'Account connection is not enabled in this layer yet', footer: 'SolMint Pay — independent payment interface',
    checkout: 'Checkout', checkoutSecure: 'Secure connection', backToPay: 'Back to Pay', checkoutWaitingTitle: 'Waiting for a valid Payment Intent', checkoutWaitingDescription: 'Payment details are rendered only from an authoritative service snapshot. This page never calculates the amount, destination, or fee itself.', paymentState: 'Payment state', awaitingIntent: 'Awaiting Intent', verification: 'Verification', verificationPending: 'Verification service pending', expiration: 'Expiration', awaitingSnapshot: 'Not received yet', checkoutSnapshot: 'Payment reference', checkoutSnapshotDescription: 'A valid Payment Intent must be provided by the Backend before payment can begin. A submitted transaction alone is not payment success.', checkoutIntentMissing: 'No Intent identifier is present in the path.', paymentConfirmed: 'Payment confirmed',
  },
  ar: {
    brand: 'SolMint Pay', eyebrow: 'بوابة دفع Solana', dashboard: 'مركز عمليات الدفع', menu: 'القائمة الرئيسية', language: 'اللغة', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة',
    overview: 'نظرة عامة', transactions: 'المعاملات', merchants: 'التجار', customers: 'العملاء', invoices: 'الفواتير', referrals: 'الإحالات', reports: 'التقارير', tickets: 'الدعم', developer: 'المطور', security: 'الأمان',
    overviewTitle: 'نظرة عامة على الدفع', overviewDescription: 'مساحة تشغيلية لمتابعة حالات الدفع الحقيقية والتسوية ونشاط التجار.', emptyTitle: 'البيانات التشغيلية غير متاحة بعد', emptyDescription: 'واجهة Pay جاهزة. ستظهر البيانات الحقيقية بعد ربط خدمة الدفع الرسمية فقط.',
    serverTruth: 'مصدر الحقيقة', serverTruthValue: 'خادم الدفع', tenantIsolation: 'عزل التاجر', tenantIsolationValue: 'مفروض عبر أمان الخادم', financialState: 'الحالة المالية', financialStateValue: 'الخدمة الرسمية فقط', readOnlyFoundation: 'الأساس البصري جاهز؛ لا يتم عرض أرقام مالية محلية أو بيانات وهمية.', noData: 'لا توجد معلومات للعرض', sectionDescription: 'هذا القسم جاهز للبيانات الموثوقة من خدمة الدفع.', operational: 'تشغيلي', secureBoundary: 'حد Pay الآمن', secureBoundaryText: 'تبقى الحسابات المالية والتحقق والتسوية وعزل التجار خارج واجهة المستخدم.', apiPending: 'لم يتم توفير نقطة خدمة الدفع لهذا المستوى من الواجهة بعد.', timeRange: 'النطاق الزمني', today: 'اليوم', sevenDays: '7 أيام', thirtyDays: '30 يومًا', profile: 'الحساب', account: 'الحساب', notConnected: 'ربط الحساب غير مفعل في هذه الطبقة بعد', footer: 'SolMint Pay — واجهة دفع مستقلة',
    checkout: 'الدفع', checkoutSecure: 'اتصال آمن', backToPay: 'العودة إلى Pay', checkoutWaitingTitle: 'بانتظار Payment Intent صالح', checkoutWaitingDescription: 'تُعرض تفاصيل الدفع فقط من لقطة موثوقة للخدمة. لا تقوم هذه الصفحة بحساب المبلغ أو الوجهة أو الرسوم بنفسها.', paymentState: 'حالة الدفع', awaitingIntent: 'بانتظار Intent', verification: 'التحقق', verificationPending: 'بانتظار خدمة التحقق', expiration: 'الانتهاء', awaitingSnapshot: 'لم يتم الاستلام بعد', checkoutSnapshot: 'مرجع الدفع', checkoutSnapshotDescription: 'يجب أن يوفّر الخادم Payment Intent صالحًا قبل بدء الدفع. إرسال المعاملة وحده لا يعني نجاح الدفع.', checkoutIntentMissing: 'لا يوجد معرّف Intent في المسار.', paymentConfirmed: 'تم تأكيد الدفع',
  },
  ru: {
    brand: 'SolMint Pay', eyebrow: 'Платёжный шлюз Solana', dashboard: 'Операции платежей', menu: 'Главное меню', language: 'Язык', openMenu: 'Открыть меню', closeMenu: 'Закрыть меню',
    overview: 'Обзор', transactions: 'Транзакции', merchants: 'Мерчанты', customers: 'Клиенты', invoices: 'Счета', referrals: 'Рефералы', reports: 'Отчёты', tickets: 'Поддержка', developer: 'Разработчик', security: 'Безопасность',
    overviewTitle: 'Обзор платежей', overviewDescription: 'Операционное пространство для реальных статусов платежей, расчётов и активности мерчантов.', emptyTitle: 'Операционные данные пока недоступны', emptyDescription: 'Интерфейс Pay готов. Реальные данные появятся только после подключения официального платёжного сервиса.',
    serverTruth: 'Источник истины', serverTruthValue: 'Платёжный сервер', tenantIsolation: 'Изоляция мерчантов', tenantIsolationValue: 'Принудительно на уровне сервера', financialState: 'Финансовое состояние', financialStateValue: 'Только официальный сервис', readOnlyFoundation: 'Основа интерфейса готова; локальные финансовые цифры и фиктивные данные не отображаются.', noData: 'Нет данных для отображения', sectionDescription: 'Раздел подготовлен для достоверных данных платёжного сервиса.', operational: 'Операционный', secureBoundary: 'Безопасная граница Pay', secureBoundaryText: 'Финансовые расчёты, проверка транзакций, расчёты и изоляция мерчантов остаются вне UI.', apiPending: 'Платёжная конечная точка пока не предоставлена этому уровню интерфейса.', timeRange: 'Период', today: 'Сегодня', sevenDays: '7 дней', thirtyDays: '30 дней', profile: 'Аккаунт', account: 'Аккаунт', notConnected: 'Подключение аккаунта на этом уровне пока не включено', footer: 'SolMint Pay — независимый платёжный интерфейс',
    checkout: 'Оплата', checkoutSecure: 'Защищённое соединение', backToPay: 'Назад в Pay', checkoutWaitingTitle: 'Ожидание корректного Payment Intent', checkoutWaitingDescription: 'Детали платежа отображаются только из достоверного снимка сервиса. Эта страница не рассчитывает сумму, адрес или комиссию самостоятельно.', paymentState: 'Состояние платежа', awaitingIntent: 'Ожидание Intent', verification: 'Проверка', verificationPending: 'Ожидание сервиса проверки', expiration: 'Срок действия', awaitingSnapshot: 'Ещё не получен', checkoutSnapshot: 'Платёжная ссылка', checkoutSnapshotDescription: 'До начала оплаты Backend должен предоставить корректный Payment Intent. Отправка транзакции сама по себе не означает успешную оплату.', checkoutIntentMissing: 'В пути отсутствует идентификатор Intent.', paymentConfirmed: 'Платёж подтверждён',
  },
} as const;

type MessageKey = keyof typeof messages['fa-IR'];

export function translate(locale: PayLocale, key: MessageKey): string {
  return messages[locale][key] ?? messages[DEFAULT_PAY_LOCALE][key];
}

export function directionFor(locale: PayLocale): PayDirection {
  return locale === 'fa-IR' || locale === 'ar' ? 'rtl' : 'ltr';
}

export function normalizePayLocale(input?: string | null): PayLocale {
  const value = (input ?? '').trim().toLowerCase();
  if (value === 'fa' || value === 'fa-ir') return 'fa-IR';
  if (value === 'en' || value === 'en-us' || value === 'en-gb') return 'en-US';
  if (value === 'ar' || value.startsWith('ar-')) return 'ar';
  if (value === 'ru' || value.startsWith('ru-')) return 'ru';
  return DEFAULT_PAY_LOCALE;
}

export function sectionLabel(locale: PayLocale, section: PaySection): string {
  const mapping: Record<PaySection, MessageKey> = {
    overview: 'overview', checkout: 'checkout', dashboard: 'dashboard', transactions: 'transactions', merchants: 'merchants', customers: 'customers', invoices: 'invoices', referrals: 'referrals', reports: 'reports', tickets: 'tickets', developer: 'developer', security: 'security',
  };
  return translate(locale, mapping[section]);
}

export function createPayTranslator(localeInput?: string | null): (key: MessageKey) => string {
  const locale = normalizePayLocale(localeInput);
  return (key) => translate(locale, key);
}

export function getPayDirection(localeInput?: string | null): PayDirection {
  return directionFor(normalizePayLocale(localeInput));
}

export function resolvePayLocale(input?: string | null): PayLocale {
  return normalizePayLocale(input);
}
