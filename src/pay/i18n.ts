import { PAY_LOCALES, type PayDirection, type PayLocale, type PaySection } from './types';

export const DEFAULT_PAY_LOCALE: PayLocale = 'fa-IR';
export const PAY_LOCALE_STORAGE_KEY = 'solmint-pay.locale.v1';
export const PAY_LOCALE_FLAGS: Record<PayLocale, string> = {
  'fa-IR': '🇮🇷',
  'en-US': '🇺🇸',
  ar: '🇸🇦',
  ru: '🇷🇺',
};
export const PAY_LOCALE_SHORT_CODES: Record<PayLocale, string> = {
  'fa-IR': 'FA',
  'en-US': 'EN',
  ar: 'AR',
  ru: 'RU',
};

const messages = {
  'fa-IR': {
    brand: 'SolMint Pay', eyebrow: 'درگاه پرداخت Solana', dashboard: 'داشبورد', menu: 'منوی اصلی', language: 'زبان', openMenu: 'باز کردن منو', closeMenu: 'بستن منو', collapseMenu: 'جمع کردن منو', expandMenu: 'باز کردن منو', payWorkspace: 'فضای پرداخت', navWorkspace: 'مرکز', navPayments: 'پرداخت‌ها', navBusiness: 'کسب‌وکار', navBilling: 'صورتحساب', navGrowth: 'همکاری', navDeveloper: 'توسعه‌دهندگان', navSecurity: 'امنیت', navSupport: 'پشتیبانی', billingNavLabel: 'صورتحساب و لینک‌ها', paymentLinks: 'لینک‌های پرداخت',
    overview: 'نمای کلی', transactions: 'تراکنش‌ها', merchants: 'مرچنت‌ها', customers: 'مشتریان', invoices: 'صورتحساب‌ها', referrals: 'معرفی و همکاری', reports: 'گزارش‌ها', tickets: 'پشتیبانی', developer: 'توسعه‌دهنده', security: 'امنیت', webhooks: 'وبهوک‌ها',
    overviewTitle: 'نمای کلی پرداخت', overviewDescription: 'وضعیت پرداخت‌ها و فعالیت پذیرنده را در یک نگاه ببینید.', dashboardDescription: 'فعالیت اخیر و وضعیت پذیرنده را در یک نگاه بررسی کنید.', transactionsDescription: 'پرداخت‌ها را جست‌وجو کنید و وضعیت آن‌ها را ببینید.', merchantsDescription: 'اطلاعات پذیرنده و کیف پول دریافت را مدیریت کنید.', billingTitle: 'صورتحساب و لینک‌های پرداخت', billingDescription: 'صورتحساب‌ها و لینک‌های پرداخت را مدیریت کنید.', emptyTitle: 'داده عملیاتی هنوز در دسترس نیست', emptyDescription: 'داده‌ها پس از اتصال سرویس پرداخت نمایش داده می‌شوند.',
    serverTruth: 'مرجع حقیقت', serverTruthValue: 'سرور پرداخت', tenantIsolation: 'تفکیک مرچنت', tenantIsolationValue: 'اعمال‌شده در لایه امنیتی سرور', financialState: 'وضعیت مالی', financialStateValue: 'فقط از سرویس رسمی', readOnlyFoundation: 'پس از اتصال سرویس پرداخت، اطلاعات ثبت‌شده در این بخش نمایش داده می‌شود.', noData: 'اطلاعاتی برای نمایش وجود ندارد', sectionDescription: 'این بخش آماده نمایش اطلاعات سرویس پرداخت است.', operational: 'عملیاتی', secureBoundary: 'مرز امن Pay', secureBoundaryText: 'اطلاعات حساس و عملیات مالی در لایه امن سرویس مدیریت می‌شوند.', apiPending: 'اتصال سرویس پرداخت در این لایه هنوز ارائه نشده است.', timeRange: 'بازه زمانی', today: 'امروز', sevenDays: '۷ روز', thirtyDays: '۳۰ روز', profile: 'حساب کاربری', account: 'حساب', notConnected: 'اتصال حساب در این لایه هنوز فعال نیست', footer: 'SolMint Pay — رابط مستقل پرداخت', loadingWorkspace: 'در حال آماده‌سازی فضای پرداخت…', sessionUnavailable: 'نشست حساب کاربری برای Pay دریافت نشد.', reload: 'بارگذاری مجدد', merchantLoadingTitle: 'در حال دریافت وضعیت مرچنت', merchantLoadingDescription: 'وضعیت مرچنت از سرویس رسمی در حال دریافت است.', merchantRequiredTitle: 'ابتدا یک مرچنت بسازید', merchantRequiredDescription: 'برای نمایش داشبورد، تراکنش‌ها، مشتریان، فاکتورها، گزارش‌ها، امنیت و وبهوک‌ها ابتدا یک مرچنت ایجاد کنید.', merchantRequiredAction: 'رفتن به مدیریت مرچنت', merchantLookupErrorTitle: 'دریافت وضعیت مرچنت ناموفق بود', merchantLookupErrorDescription: 'داده مرچنت از سرویس Pay دریافت نشد. دوباره تلاش کنید یا وارد مدیریت مرچنت شوید.', merchantLookupRetry: 'تلاش دوباره',
    checkout: 'پرداخت', checkoutSecure: 'اتصال امن', backToPay: 'بازگشت به Pay', checkoutWaitingTitle: 'در انتظار Payment Intent معتبر', checkoutWaitingDescription: 'جزئیات پرداخت فقط از snapshot معتبر سرویس پرداخت نمایش داده می‌شود؛ این صفحه هیچ مبلغ، مقصد یا کارمزد را خودش محاسبه نمی‌کند.', paymentState: 'وضعیت پرداخت', awaitingIntent: 'در انتظار Intent', verification: 'تأیید', verificationPending: 'در انتظار سرویس تأیید', expiration: 'انقضا', awaitingSnapshot: 'هنوز دریافت نشده', checkoutSnapshot: 'مرجع پرداخت', checkoutSnapshotDescription: 'برای شروع پرداخت، یک Payment Intent معتبر باید از Backend دریافت شود. ارسال تراکنش به‌تنهایی موفقیت پرداخت محسوب نمی‌شود.', checkoutIntentMissing: 'شناسه Intent در مسیر وجود ندارد.', paymentConfirmed: 'پرداخت تأیید شد', paymentCompleted: 'پرداخت با وضعیت نهایی تکمیل شد',
  },
  'en-US': {
    brand: 'SolMint Pay', eyebrow: 'Solana Payment Gateway', dashboard: 'Dashboard', menu: 'Main menu', language: 'Language', openMenu: 'Open menu', closeMenu: 'Close menu', collapseMenu: 'Collapse menu', expandMenu: 'Expand menu', payWorkspace: 'Pay workspace', navWorkspace: 'Workspace', navPayments: 'Payments', navBusiness: 'Business', navBilling: 'Billing', navGrowth: 'Partners', navDeveloper: 'Developers', navSecurity: 'Security', navSupport: 'Support', billingNavLabel: 'Invoices & payment links', paymentLinks: 'Payment links',
    overview: 'Overview', transactions: 'Transactions', merchants: 'Merchants', customers: 'Customers', invoices: 'Invoices', referrals: 'Referrals', reports: 'Reports', tickets: 'Support', developer: 'Developer', security: 'Security', webhooks: 'Webhooks',
    overviewTitle: 'Payment overview', overviewDescription: 'Review payment activity and merchant status at a glance.', dashboardDescription: 'Review recent activity and merchant status at a glance.', transactionsDescription: 'Search payments and review their current status.', merchantsDescription: 'Manage merchant information and the receiving wallet.', billingTitle: 'Invoices & payment links', billingDescription: 'Manage invoices and payment links.', emptyTitle: 'Operational data is not available yet', emptyDescription: 'Data will appear after the payment service is connected.',
    serverTruth: 'Source of truth', serverTruthValue: 'Payment server', tenantIsolation: 'Merchant isolation', tenantIsolationValue: 'Enforced by server security', financialState: 'Financial state', financialStateValue: 'Official service only', readOnlyFoundation: 'Recorded payment information will appear here after the payment service is connected.', noData: 'No information to display', sectionDescription: 'This section is ready to display payment service information.', operational: 'Operational', secureBoundary: 'Secure Pay boundary', secureBoundaryText: 'Sensitive information and financial operations are handled by the secure service layer.', apiPending: 'The payment service endpoint is not exposed to this frontend layer yet.', timeRange: 'Time range', today: 'Today', sevenDays: '7 days', thirtyDays: '30 days', profile: 'Account', account: 'Account', notConnected: 'Account connection is not enabled in this layer yet', footer: 'SolMint Pay — independent payment interface', loadingWorkspace: 'Preparing the payment workspace…', sessionUnavailable: 'The Pay account session could not be loaded.', reload: 'Reload', merchantLoadingTitle: 'Loading Merchant state', merchantLoadingDescription: 'Merchant state is being loaded from the official service.', merchantRequiredTitle: 'Merchant setup required', merchantRequiredDescription: 'Create a Merchant first to access the dashboard, transactions, customers, invoices, reports, security, and webhooks.', merchantRequiredAction: 'Open Merchant setup', merchantLookupErrorTitle: 'Merchant state could not be loaded', merchantLookupErrorDescription: 'The Pay service did not return your Merchant state. Retry or open Merchant setup.', merchantLookupRetry: 'Retry',
    checkout: 'Checkout', checkoutSecure: 'Secure connection', backToPay: 'Back to Pay', checkoutWaitingTitle: 'Waiting for a valid Payment Intent', checkoutWaitingDescription: 'Payment details are rendered only from an authoritative service snapshot. This page never calculates the amount, destination, or fee itself.', paymentState: 'Payment state', awaitingIntent: 'Awaiting Intent', verification: 'Verification', verificationPending: 'Verification service pending', expiration: 'Expiration', awaitingSnapshot: 'Not received yet', checkoutSnapshot: 'Payment reference', checkoutSnapshotDescription: 'A valid Payment Intent must be provided by the Backend before payment can begin. A submitted transaction alone is not payment success.', checkoutIntentMissing: 'No Intent identifier is present in the path.', paymentConfirmed: 'Payment confirmed', paymentCompleted: 'Payment reached the final completed state',
  },
  ar: {
    brand: 'SolMint Pay', eyebrow: 'بوابة دفع Solana', dashboard: 'لوحة التحكم', menu: 'القائمة الرئيسية', language: 'اللغة', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', collapseMenu: 'طي القائمة', expandMenu: 'فتح القائمة', payWorkspace: 'مساحة Pay', navWorkspace: 'المركز', navPayments: 'المدفوعات', navBusiness: 'الأعمال', navBilling: 'الفوترة', navGrowth: 'الشراكات', navDeveloper: 'المطورون', navSecurity: 'الأمان', navSupport: 'الدعم', billingNavLabel: 'الفواتير وروابط الدفع', paymentLinks: 'روابط الدفع',
    overview: 'نظرة عامة', transactions: 'المعاملات', merchants: 'التجار', customers: 'العملاء', invoices: 'الفواتير', referrals: 'الإحالات', reports: 'التقارير', tickets: 'الدعم', developer: 'المطور', security: 'الأمان', webhooks: 'Webhooks',
    overviewTitle: 'نظرة عامة على الدفع', overviewDescription: 'راجع نشاط الدفع وحالة التاجر في لمحة.', dashboardDescription: 'راجع النشاط الأخير وحالة التاجر في لمحة.', transactionsDescription: 'ابحث في المدفوعات وراجع حالتها الحالية.', merchantsDescription: 'أدر معلومات التاجر ومحفظة الاستلام.', billingTitle: 'الفواتير وروابط الدفع', billingDescription: 'أدر الفواتير وروابط الدفع.', emptyTitle: 'البيانات التشغيلية غير متاحة بعد', emptyDescription: 'ستظهر البيانات بعد ربط خدمة الدفع.',
    serverTruth: 'مصدر الحقيقة', serverTruthValue: 'خادم الدفع', tenantIsolation: 'عزل التاجر', tenantIsolationValue: 'مفروض عبر أمان الخادم', financialState: 'الحالة المالية', financialStateValue: 'الخدمة الرسمية فقط', readOnlyFoundation: 'الأساس البصري جاهز؛ لا يتم عرض أرقام مالية محلية أو بيانات وهمية.', noData: 'لا توجد معلومات للعرض', sectionDescription: 'هذا القسم جاهز لعرض معلومات خدمة الدفع.', operational: 'تشغيلي', secureBoundary: 'حد Pay الآمن', secureBoundaryText: 'تتم إدارة المعلومات الحساسة والعمليات المالية ضمن طبقة الخدمة الآمنة.', apiPending: 'لم يتم توفير نقطة خدمة الدفع لهذا المستوى من الواجهة بعد.', timeRange: 'النطاق الزمني', today: 'اليوم', sevenDays: '7 أيام', thirtyDays: '30 يومًا', profile: 'الحساب', account: 'الحساب', notConnected: 'ربط الحساب غير مفعل في هذه الطبقة بعد', footer: 'SolMint Pay — واجهة دفع مستقلة', loadingWorkspace: 'جارٍ تجهيز مساحة الدفع…', sessionUnavailable: 'تعذر تحميل جلسة حساب Pay.', reload: 'إعادة التحميل', merchantLoadingTitle: 'جارٍ تحميل حالة التاجر', merchantLoadingDescription: 'جارٍ تحميل حالة التاجر من الخدمة الرسمية.', merchantRequiredTitle: 'يلزم إعداد تاجر أولًا', merchantRequiredDescription: 'أنشئ تاجرًا أولًا للوصول إلى لوحة العمليات والمعاملات والعملاء والفواتير والتقارير والأمان والـ Webhooks.', merchantRequiredAction: 'فتح إعداد التاجر', merchantLookupErrorTitle: 'تعذر تحميل حالة التاجر', merchantLookupErrorDescription: 'لم تُرجع خدمة Pay حالة التاجر. أعد المحاولة أو افتح إعداد التاجر.', merchantLookupRetry: 'إعادة المحاولة',
    checkout: 'الدفع', checkoutSecure: 'اتصال آمن', backToPay: 'العودة إلى Pay', checkoutWaitingTitle: 'بانتظار Payment Intent صالح', checkoutWaitingDescription: 'تُعرض تفاصيل الدفع فقط من لقطة موثوقة للخدمة. لا تقوم هذه الصفحة بحساب المبلغ أو الوجهة أو الرسوم بنفسها.', paymentState: 'حالة الدفع', awaitingIntent: 'بانتظار Intent', verification: 'التحقق', verificationPending: 'بانتظار خدمة التحقق', expiration: 'الانتهاء', awaitingSnapshot: 'لم يتم الاستلام بعد', checkoutSnapshot: 'مرجع الدفع', checkoutSnapshotDescription: 'يجب أن يوفّر الخادم Payment Intent صالحًا قبل بدء الدفع. إرسال المعاملة وحده لا يعني نجاح الدفع.', checkoutIntentMissing: 'لا يوجد معرّف Intent في المسار.', paymentConfirmed: 'تم تأكيد الدفع', paymentCompleted: 'اكتملت عملية الدفع بحالة نهائية'
  },
  ru: {
    brand: 'SolMint Pay', eyebrow: 'Платёжный шлюз Solana', dashboard: 'Дашборд', menu: 'Главное меню', language: 'Язык', openMenu: 'Открыть меню', closeMenu: 'Закрыть меню', collapseMenu: 'Свернуть меню', expandMenu: 'Открыть меню', payWorkspace: 'Рабочая область Pay', navWorkspace: 'Центр', navPayments: 'Платежи', navBusiness: 'Бизнес', navBilling: 'Счета', navGrowth: 'Партнёры', navDeveloper: 'Разработчики', navSecurity: 'Безопасность', navSupport: 'Поддержка', billingNavLabel: 'Счета и платёжные ссылки', paymentLinks: 'Платёжные ссылки',
    overview: 'Обзор', transactions: 'Транзакции', merchants: 'Мерчанты', customers: 'Клиенты', invoices: 'Счета', referrals: 'Рефералы', reports: 'Отчёты', tickets: 'Поддержка', developer: 'Разработчик', security: 'Безопасность', webhooks: 'Вебхуки',
    overviewTitle: 'Обзор платежей', overviewDescription: 'Смотрите активность платежей и статус мерчанта в одном месте.', dashboardDescription: 'Смотрите последнюю активность и статус мерчанта.', transactionsDescription: 'Ищите платежи и просматривайте их текущий статус.', merchantsDescription: 'Управляйте данными мерчанта и кошельком приёма.', billingTitle: 'Счета и платёжные ссылки', billingDescription: 'Управляйте счетами и платёжными ссылками.', emptyTitle: 'Операционные данные пока недоступны', emptyDescription: 'Данные появятся после подключения платёжного сервиса.',
    serverTruth: 'Источник истины', serverTruthValue: 'Платёжный сервер', tenantIsolation: 'Изоляция мерчантов', tenantIsolationValue: 'Принудительно на уровне сервера', financialState: 'Финансовое состояние', financialStateValue: 'Только официальный сервис', readOnlyFoundation: 'Основа интерфейса готова; локальные финансовые цифры и фиктивные данные не отображаются.', noData: 'Нет данных для отображения', sectionDescription: 'Этот раздел готов для отображения данных платёжного сервиса.', operational: 'Операционный', secureBoundary: 'Безопасная граница Pay', secureBoundaryText: 'Чувствительные данные и финансовые операции обрабатываются защищённым сервисным слоем.', apiPending: 'Платёжная конечная точка пока не предоставлена этому уровню интерфейса.', timeRange: 'Период', today: 'Сегодня', sevenDays: '7 дней', thirtyDays: '30 дней', profile: 'Аккаунт', account: 'Аккаунт', notConnected: 'Подключение аккаунта на этом уровне пока не включено', footer: 'SolMint Pay — независимый платёжный интерфейс', loadingWorkspace: 'Подготовка платёжного рабочего пространства…', sessionUnavailable: 'Не удалось загрузить сессию аккаунта Pay.', reload: 'Перезагрузить', merchantLoadingTitle: 'Загрузка состояния мерчанта', merchantLoadingDescription: 'Состояние мерчанта загружается из официального сервиса.', merchantRequiredTitle: 'Сначала настройте мерчанта', merchantRequiredDescription: 'Сначала создайте мерчанта, чтобы открыть обзор, транзакции, клиентов, счета, отчёты, безопасность и вебхуки.', merchantRequiredAction: 'Открыть настройку мерчанта', merchantLookupErrorTitle: 'Не удалось загрузить состояние мерчанта', merchantLookupErrorDescription: 'Сервис Pay не вернул состояние вашего мерчанта. Повторите попытку или откройте настройку мерчанта.', merchantLookupRetry: 'Повторить',
    checkout: 'Оплата', checkoutSecure: 'Защищённое соединение', backToPay: 'Назад в Pay', checkoutWaitingTitle: 'Ожидание корректного Payment Intent', checkoutWaitingDescription: 'Детали платежа отображаются только из достоверного снимка сервиса. Эта страница не рассчитывает сумму, адрес или комиссию самостоятельно.', paymentState: 'Состояние платежа', awaitingIntent: 'Ожидание Intent', verification: 'Проверка', verificationPending: 'Ожидание сервиса проверки', expiration: 'Срок действия', awaitingSnapshot: 'Ещё не получен', checkoutSnapshot: 'Платёжная ссылка', checkoutSnapshotDescription: 'До начала оплаты Backend должен предоставить корректный Payment Intent. Отправка транзакции сама по себе не означает успешную оплату.', checkoutIntentMissing: 'В пути отсутствует идентификатор Intent.', paymentConfirmed: 'Платёж подтверждён', paymentCompleted: 'Платёж достиг окончательного статуса завершён'
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

export function readStoredPayLocale(storage: Pick<Storage, 'getItem'> | null | undefined): PayLocale | null {
  if (!storage) return null;
  try {
    const stored = storage.getItem(PAY_LOCALE_STORAGE_KEY)?.trim();
    return stored && PAY_LOCALES.includes(stored as PayLocale) ? (stored as PayLocale) : null;
  } catch {
    return null;
  }
}

export function persistPayLocale(storage: Pick<Storage, 'setItem'> | null | undefined, locale: PayLocale): void {
  if (!storage) return;
  try {
    storage.setItem(PAY_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage may be unavailable or blocked; locale state still remains in memory.
  }
}

const PAY_LOCALE_NAMES: Record<PayLocale, string> = {
  'fa-IR': 'فارسی',
  'en-US': 'English',
  ar: 'العربية',
  ru: 'Русский',
};

export function languageName(locale: PayLocale): string {
  return PAY_LOCALE_NAMES[locale];
}

export function sectionLabel(locale: PayLocale, section: PaySection): string {
  const mapping: Record<PaySection, MessageKey> = {
    overview: 'overview', checkout: 'checkout', dashboard: 'dashboard', transactions: 'transactions', merchants: 'merchants', customers: 'customers', invoices: 'invoices', referrals: 'referrals', reports: 'reports', tickets: 'tickets', developer: 'developer', security: 'security', webhooks: 'webhooks',
  };
  return translate(locale, mapping[section]);
}
