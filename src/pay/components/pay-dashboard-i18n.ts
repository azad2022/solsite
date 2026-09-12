import type { PayLocale } from '../types';

const COPY = {
  'fa-IR': {
    title: 'داشبورد عملیاتی', activity: 'آخرین فعالیت‌ها', activityDesc: 'آخرین پرداخت‌های ثبت‌شده برای این پذیرنده از سرویس واقعی Pay.',
    merchant: 'پذیرنده', merchantStatus: 'وضعیت پذیرنده', active: 'فعال', pending: 'در انتظار', suspended: 'معلق', closed: 'بسته',
    noMerchant: 'هنوز پذیرنده‌ای برای این حساب ثبت نشده است.', noActivity: 'هنوز تراکنشی برای نمایش وجود ندارد.',
    loadFailed: 'دریافت فعالیت‌های پرداخت ناموفق بود.', unauthorized: 'برای مشاهده این بخش باید وارد حساب شوید.', forbidden: 'دسترسی به این پذیرنده مجاز نیست.',
    retry: 'تلاش دوباره', refresh: 'تازه‌سازی', viewAll: 'مشاهده همه تراکنش‌ها', updated: 'آخرین بروزرسانی',
    payment: 'پرداخت', amount: 'مبلغ', status: 'وضعیت', time: 'زمان',
  },
  'en-US': {
    title: 'Operational dashboard', activity: 'Recent activity', activityDesc: 'Latest payments recorded for this merchant by the live Pay service.',
    merchant: 'Merchant', merchantStatus: 'Merchant status', active: 'Active', pending: 'Pending', suspended: 'Suspended', closed: 'Closed',
    noMerchant: 'No merchant is registered for this account yet.', noActivity: 'No transactions are available yet.',
    loadFailed: 'Payment activity could not be loaded.', unauthorized: 'Sign in is required to view this section.', forbidden: 'You are not allowed to access this merchant.',
    retry: 'Retry', refresh: 'Refresh', viewAll: 'View all transactions', updated: 'Last updated',
    payment: 'Payment', amount: 'Amount', status: 'Status', time: 'Time',
  },
  ar: {
    title: 'لوحة التشغيل', activity: 'النشاط الأخير', activityDesc: 'أحدث المدفوعات المسجلة لهذا التاجر من خدمة Pay الحقيقية.',
    merchant: 'التاجر', merchantStatus: 'حالة التاجر', active: 'نشط', pending: 'قيد الانتظار', suspended: 'معلق', closed: 'مغلق',
    noMerchant: 'لا يوجد تاجر مسجل لهذا الحساب حتى الآن.', noActivity: 'لا توجد معاملات متاحة بعد.',
    loadFailed: 'تعذر تحميل نشاط الدفع.', unauthorized: 'يلزم تسجيل الدخول لعرض هذا القسم.', forbidden: 'لا يسمح لك بالوصول إلى هذا التاجر.',
    retry: 'إعادة المحاولة', refresh: 'تحديث', viewAll: 'عرض كل المعاملات', updated: 'آخر تحديث',
    payment: 'الدفع', amount: 'المبلغ', status: 'الحالة', time: 'الوقت',
  },
  ru: {
    title: 'Операционная панель', activity: 'Последняя активность', activityDesc: 'Последние платежи этого продавца из реального сервиса Pay.',
    merchant: 'Продавец', merchantStatus: 'Статус продавца', active: 'Активен', pending: 'Ожидает', suspended: 'Приостановлен', closed: 'Закрыт',
    noMerchant: 'Для этого аккаунта пока нет зарегистрированного продавца.', noActivity: 'Пока нет доступных транзакций.',
    loadFailed: 'Не удалось загрузить активность платежей.', unauthorized: 'Для просмотра раздела требуется вход.', forbidden: 'У вас нет доступа к этому продавцу.',
    retry: 'Повторить', refresh: 'Обновить', viewAll: 'Все транзакции', updated: 'Последнее обновление',
    payment: 'Платёж', amount: 'Сумма', status: 'Статус', time: 'Время',
  },
} as const;

export type DashboardCopyKey = keyof typeof COPY['en-US'];
export const dashboardCopy = (locale: PayLocale) => COPY[locale];
export const d = (locale: PayLocale, key: DashboardCopyKey) => COPY[locale][key];
