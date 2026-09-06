import type { PayLocale } from './types';

const labels = {
  'fa-IR': {
    merchant: 'مرچنت', amount: 'مبلغ', customerTotal: 'مبلغ نهایی مشتری', fee: 'کارمزد درگاه', feePayer: 'پرداخت‌کننده کارمزد', asset: 'دارایی', network: 'شبکه', destination: 'مقصد', reference: 'Reference', intentStatus: 'وضعیت Intent', commitment: 'تعهد تأیید',
    loadFailed: 'دریافت Payment Intent از سرویس پرداخت ناموفق بود.', expired: 'این Payment Intent منقضی شده است.',
  },
  'en-US': {
    merchant: 'Merchant', amount: 'Amount', customerTotal: 'Customer total', fee: 'Gateway fee', feePayer: 'Fee payer', asset: 'Asset', network: 'Network', destination: 'Destination', reference: 'Reference', intentStatus: 'Intent status', commitment: 'Verification commitment',
    loadFailed: 'The Payment Intent could not be retrieved from the payment service.', expired: 'This Payment Intent has expired.',
  },
  ar: {
    merchant: 'التاجر', amount: 'المبلغ', customerTotal: 'إجمالي العميل', fee: 'رسوم البوابة', feePayer: 'دافع الرسوم', asset: 'الأصل', network: 'الشبكة', destination: 'الوجهة', reference: 'المرجع', intentStatus: 'حالة Intent', commitment: 'التزام التحقق',
    loadFailed: 'تعذر جلب Payment Intent من خدمة الدفع.', expired: 'انتهت صلاحية Payment Intent هذا.',
  },
  ru: {
    merchant: 'Мерчант', amount: 'Сумма', customerTotal: 'Итого клиента', fee: 'Комиссия шлюза', feePayer: 'Плательщик комиссии', asset: 'Актив', network: 'Сеть', destination: 'Получатель', reference: 'Reference', intentStatus: 'Статус Intent', commitment: 'Требование проверки',
    loadFailed: 'Не удалось получить Payment Intent из платёжного сервиса.', expired: 'Срок действия этого Payment Intent истёк.',
  },
} as const;

type CheckoutLabelKey = keyof typeof labels['fa-IR'];

export function checkoutLabel(locale: PayLocale, key: CheckoutLabelKey): string {
  return labels[locale][key] ?? labels['fa-IR'][key];
}
