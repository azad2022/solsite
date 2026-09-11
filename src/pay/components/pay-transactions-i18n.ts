import type { PayLocale } from '../types';

const messages = {
  'fa-IR': {
    title: 'تراکنش‌ها', search: 'جستجو در شناسه سفارش، مرجع یا کیف پول', all: 'همه وضعیت‌ها', refresh: 'به‌روزرسانی', details: 'جزئیات',
    noData: 'هنوز تراکنشی ثبت نشده است.', loadFailed: 'دریافت تراکنش‌ها ناموفق بود.', retry: 'تلاش مجدد', unauthorized: 'برای مشاهده تراکنش‌ها وارد شوید.',
    forbidden: 'به تراکنش‌های این پذیرنده دسترسی ندارید.', amount: 'مبلغ', status: 'وضعیت', created: 'ایجاد شده', updated: 'به‌روزرسانی', reference: 'Reference', signature: 'Signature',
    paymentId: 'Payment ID', orderId: 'Order ID', merchantSettlement: 'تسویه پذیرنده', fee: 'کارمزد', recipient: 'مقصد', customerWallet: 'کیف پول مشتری',
    blockchain: 'اطلاعات بلاکچین', verification: 'وضعیت Verification', events: 'رویدادها', transfers: 'انتقال‌ها', close: 'بستن', back: 'بازگشت',
    statuses: { created: 'ایجاد شده', pending: 'در انتظار', detected: 'تشخیص داده شد', verifying: 'در حال بررسی', confirmed: 'تأیید شده', completed: 'تکمیل شده', expired: 'منقضی', underpaid: 'کم‌پرداخت', overpaid: 'بیش‌پرداخت', wrong_token: 'توکن نادرست', wrong_recipient: 'مقصد نادرست', duplicate: 'تکراری', ambiguous: 'مبهم', failed: 'ناموفق', refunded: 'بازپرداخت شده', },
  },
  'en-US': {
    title: 'Transactions', search: 'Search order ID, reference or wallet', all: 'All statuses', refresh: 'Refresh', details: 'Details',
    noData: 'No transactions yet.', loadFailed: 'Transactions could not be loaded.', retry: 'Retry', unauthorized: 'Sign in to view transactions.',
    forbidden: 'You do not have access to these merchant transactions.', amount: 'Amount', status: 'Status', created: 'Created', updated: 'Updated', reference: 'Reference', signature: 'Signature',
    paymentId: 'Payment ID', orderId: 'Order ID', merchantSettlement: 'Merchant settlement', fee: 'Fee', recipient: 'Recipient', customerWallet: 'Customer wallet',
    blockchain: 'Blockchain', verification: 'Verification state', events: 'Events', transfers: 'Transfers', close: 'Close', back: 'Back',
    statuses: { created: 'Created', pending: 'Pending', detected: 'Detected', verifying: 'Verifying', confirmed: 'Confirmed', completed: 'Completed', expired: 'Expired', underpaid: 'Underpaid', overpaid: 'Overpaid', wrong_token: 'Wrong token', wrong_recipient: 'Wrong recipient', duplicate: 'Duplicate', ambiguous: 'Ambiguous', failed: 'Failed', refunded: 'Refunded', },
  },
  ar: {
    title: 'المعاملات', search: 'ابحث في رقم الطلب أو المرجع أو المحفظة', all: 'كل الحالات', refresh: 'تحديث', details: 'التفاصيل',
    noData: 'لا توجد معاملات بعد.', loadFailed: 'تعذر تحميل المعاملات.', retry: 'إعادة المحاولة', unauthorized: 'سجّل الدخول لعرض المعاملات.',
    forbidden: 'لا تملك صلاحية الوصول إلى معاملات هذا التاجر.', amount: 'المبلغ', status: 'الحالة', created: 'أُنشئت', updated: 'تم التحديث', reference: 'المرجع', signature: 'التوقيع',
    paymentId: 'معرّف الدفع', orderId: 'معرّف الطلب', merchantSettlement: 'تسوية التاجر', fee: 'الرسوم', recipient: 'المستلم', customerWallet: 'محفظة العميل',
    blockchain: 'البلوكتشين', verification: 'حالة التحقق', events: 'الأحداث', transfers: 'التحويلات', close: 'إغلاق', back: 'رجوع',
    statuses: { created: 'منشأة', pending: 'قيد الانتظار', detected: 'تم الاكتشاف', verifying: 'قيد التحقق', confirmed: 'مؤكدة', completed: 'مكتملة', expired: 'منتهية', underpaid: 'دفع ناقص', overpaid: 'دفع زائد', wrong_token: 'رمز غير صحيح', wrong_recipient: 'مستلم غير صحيح', duplicate: 'مكررة', ambiguous: 'غامضة', failed: 'فشلت', refunded: 'مستردة', },
  },
  ru: {
    title: 'Транзакции', search: 'Поиск по заказу, reference или кошельку', all: 'Все статусы', refresh: 'Обновить', details: 'Подробности',
    noData: 'Транзакций пока нет.', loadFailed: 'Не удалось загрузить транзакции.', retry: 'Повторить', unauthorized: 'Войдите, чтобы видеть транзакции.',
    forbidden: 'У вас нет доступа к транзакциям этого мерчанта.', amount: 'Сумма', status: 'Статус', created: 'Создано', updated: 'Обновлено', reference: 'Reference', signature: 'Signature',
    paymentId: 'ID платежа', orderId: 'ID заказа', merchantSettlement: 'Расчёт с мерчантом', fee: 'Комиссия', recipient: 'Получатель', customerWallet: 'Кошелёк клиента',
    blockchain: 'Блокчейн', verification: 'Статус проверки', events: 'События', transfers: 'Переводы', close: 'Закрыть', back: 'Назад',
    statuses: { created: 'Создано', pending: 'Ожидание', detected: 'Обнаружено', verifying: 'Проверка', confirmed: 'Подтверждено', completed: 'Завершено', expired: 'Истёк', underpaid: 'Недоплата', overpaid: 'Переплата', wrong_token: 'Неверный токен', wrong_recipient: 'Неверный получатель', duplicate: 'Дубликат', ambiguous: 'Неоднозначно', failed: 'Ошибка', refunded: 'Возвращено', },
  },
} as const;

export function translateTransactions(locale: PayLocale, key: keyof typeof messages['fa-IR']): string {
  const pack = messages[locale] || messages['en-US'];
  const value = pack[key];
  return typeof value === 'string' ? value : String(value);
}

export function translateTransactionStatus(locale: PayLocale, status: string): string {
  const pack = messages[locale] || messages['en-US'];
  return pack.statuses[status as keyof typeof pack.statuses] || status;
}
