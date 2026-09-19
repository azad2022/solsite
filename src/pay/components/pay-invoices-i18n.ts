import type { PayLocale } from '../types';
import type { PayInvoiceFeePayer, PayInvoiceStatus } from '../services/invoiceService';

const messages = {
  'fa-IR': {
    title: 'فاکتورها', subtitle: 'فاکتورهای واقعی ثبت‌شده برای این پذیرنده.',
    search: 'جستجو در شماره فاکتور، عنوان یا مشتری', all: 'همه وضعیت‌ها', refresh: 'به‌روزرسانی',
    details: 'جزئیات', noData: 'هنوز فاکتوری برای نمایش وجود ندارد.', loadFailed: 'دریافت فاکتورها ناموفق بود.',
    retry: 'تلاش مجدد', unauthorized: 'برای مشاهده فاکتورها وارد شوید.', forbidden: 'به فاکتورهای این پذیرنده دسترسی ندارید.',
    invoiceNumber: 'شماره فاکتور', customer: 'مشتری', titleField: 'عنوان', amount: 'مبلغ اتمیک', asset: 'دارایی',
    status: 'وضعیت', dueAt: 'سررسید', createdAt: 'ایجاد شده', feePayer: 'پرداخت‌کننده کارمزد',
    description: 'توضیحات', readonly: 'این نما فقط داده authoritative موجود را نمایش می‌دهد؛ ایجاد یا تغییر فاکتور تا ارائه contract رسمی Backend فعال نشده است.',
    close: 'بستن',
    payer: { merchant: 'پذیرنده', customer: 'مشتری' },
    statuses: { draft:'پیش‌نویس', open:'باز', paid:'پرداخت‌شده', partially_paid:'نیمه‌پرداخت', overdue:'سررسیدگذشته', void:'باطل', refunded:'بازپرداخت‌شده' },
  },
  'en-US': {
    title: 'Invoices', subtitle: 'Real invoices recorded for this merchant.',
    search: 'Search invoice number, title or customer', all: 'All statuses', refresh: 'Refresh',
    details: 'Details', noData: 'No invoices to display.', loadFailed: 'Invoices could not be loaded.',
    retry: 'Retry', unauthorized: 'Sign in to view invoices.', forbidden: 'You do not have access to these merchant invoices.',
    invoiceNumber: 'Invoice number', customer: 'Customer', titleField: 'Title', amount: 'Atomic amount', asset: 'Asset',
    status: 'Status', dueAt: 'Due', createdAt: 'Created', feePayer: 'Fee payer',
    description: 'Description', readonly: 'This view displays the authoritative data that currently exists. Invoice creation or mutation remains disabled until an official Backend contract is released.',
    close: 'Close',
    payer: { merchant: 'Merchant', customer: 'Customer' },
    statuses: { draft:'Draft', open:'Open', paid:'Paid', partially_paid:'Partially paid', overdue:'Overdue', void:'Void', refunded:'Refunded' },
  },
  ar: {
    title: 'الفواتير', subtitle: 'الفواتير الحقيقية المسجلة لهذا التاجر.',
    search: 'ابحث برقم الفاتورة أو العنوان أو العميل', all: 'كل الحالات', refresh: 'تحديث',
    details: 'التفاصيل', noData: 'لا توجد فواتير للعرض.', loadFailed: 'تعذر تحميل الفواتير.',
    retry: 'إعادة المحاولة', unauthorized: 'سجّل الدخول لعرض الفواتير.', forbidden: 'لا تملك صلاحية الوصول إلى فواتير هذا التاجر.',
    invoiceNumber: 'رقم الفاتورة', customer: 'العميل', titleField: 'العنوان', amount: 'المبلغ الذري', asset: 'الأصل',
    status: 'الحالة', dueAt: 'الاستحقاق', createdAt: 'أُنشئت', feePayer: 'دافع الرسوم',
    description: 'الوصف', readonly: 'يعرض هذا القسم البيانات الموثوقة الموجودة فقط. لن يتم تفعيل إنشاء أو تعديل الفاتورة قبل إصدار عقد رسمي من Backend.',
    close: 'إغلاق',
    payer: { merchant: 'التاجر', customer: 'العميل' },
    statuses: { draft:'مسودة', open:'مفتوحة', paid:'مدفوعة', partially_paid:'مدفوعة جزئياً', overdue:'متأخرة', void:'ملغاة', refunded:'مستردة' },
  },
  ru: {
    title: 'Счета', subtitle: 'Реальные счета, зарегистрированные для этого мерчанта.',
    search: 'Поиск по номеру счёта, названию или клиенту', all: 'Все статусы', refresh: 'Обновить',
    details: 'Подробности', noData: 'Нет счетов для отображения.', loadFailed: 'Не удалось загрузить счета.',
    retry: 'Повторить', unauthorized: 'Войдите, чтобы видеть счета.', forbidden: 'У вас нет доступа к счетам этого мерчанта.',
    invoiceNumber: 'Номер счёта', customer: 'Клиент', titleField: 'Название', amount: 'Сумма в atomic units', asset: 'Актив',
    status: 'Статус', dueAt: 'Срок', createdAt: 'Создано', feePayer: 'Плательщик комиссии',
    description: 'Описание', readonly: 'Этот раздел отображает только достоверные существующие данные. Создание и изменение счетов остаются отключёнными до выпуска официального Backend-контракта.',
    close: 'Закрыть',
    payer: { merchant: 'Мерчант', customer: 'Клиент' },
    statuses: { draft:'Черновик', open:'Открыт', paid:'Оплачен', partially_paid:'Частично оплачен', overdue:'Просрочен', void:'Аннулирован', refunded:'Возвращён' },
  },
} as const;

export type InvoiceTranslationKey = Exclude<keyof typeof messages['fa-IR'], 'payer' | 'statuses'>;

export function invoiceT(locale: PayLocale, key: InvoiceTranslationKey): string {
  return messages[locale][key];
}
export function invoiceStatusT(locale: PayLocale, status: PayInvoiceStatus): string {
  return messages[locale].statuses[status];
}
export function invoicePayerT(locale: PayLocale, payer: PayInvoiceFeePayer): string {
  return messages[locale].payer[payer];
}
