import type { PayLocale } from './types';

const labels = {
  'fa-IR': {
    merchant: 'مرچنت', amount: 'مبلغ', customerTotal: 'مبلغ نهایی مشتری', fee: 'کارمزد درگاه', feePayer: 'پرداخت‌کننده کارمزد', asset: 'دارایی', network: 'شبکه', destination: 'مقصد', reference: 'Reference', intentStatus: 'وضعیت Intent', commitment: 'تعهد تأیید',
    loadFailed: 'دریافت Payment Intent از سرویس پرداخت ناموفق بود.', expired: 'این Payment Intent منقضی شده است.',
    payInstructions: 'پرداخت را با کیف پول خود انجام دهید، سپس Signature تراکنش را وارد کنید تا سرویس پرداخت آن را روی شبکه بررسی کند.',
    walletConnect: 'اتصال کیف پول', walletConnected: 'کیف پول متصل است', walletRequired: 'برای پرداخت، ابتدا کیف پول را متصل کنید.',
    copy: 'کپی', copied: 'کپی شد', connect: 'اتصال', disconnect: 'قطع اتصال',
    signatureLabel: 'Transaction Signature', signaturePlaceholder: 'Signature تراکنش را وارد کنید', verifyPayment: 'بررسی پرداخت', verifying: 'در حال بررسی پرداخت...',
    verificationSubmitted: 'درخواست بررسی ثبت شد. تا اعلام وضعیت معتبر سرور، پرداخت موفق محسوب نمی‌شود.',
    notDetected: 'این Signature هنوز در بازه و Reference این Payment Intent پیدا نشده است.',
    paymentConfirmed: 'پرداخت توسط سرویس پرداخت تأیید شد.', paymentCompleted: 'پرداخت با وضعیت نهایی تکمیل شد.', paymentUnderpaid: 'پرداخت کمتر از مبلغ موردنیاز شناسایی شد.', paymentOverpaid: 'پرداخت بیشتر از مبلغ موردنیاز شناسایی شد.', paymentAmbiguous: 'چند مشاهده سازگار شناسایی شد و بررسی نیاز به اقدام بعدی دارد.',
    verificationFailed: 'بررسی تراکنش کامل نشد. دوباره تلاش کنید.', intentLookupTitle: 'بررسی Payment Intent', intentLookupDescription: 'شناسه Payment Intent را وارد کنید تا snapshot رسمی پرداخت دریافت و بررسی شود.', intentLookupLabel: 'شناسه Payment Intent', intentLookupPlaceholder: 'UUID مربوط به Payment Intent را وارد کنید', checkIntent: 'بررسی Intent', invalidIntentId: 'شناسه Payment Intent نامعتبر است.'
  },
  'en-US': {
    merchant: 'Merchant', amount: 'Amount', customerTotal: 'Customer total', fee: 'Gateway fee', feePayer: 'Fee payer', asset: 'Asset', network: 'Network', destination: 'Destination', reference: 'Reference', intentStatus: 'Intent status', commitment: 'Verification commitment',
    loadFailed: 'The Payment Intent could not be retrieved from the payment service.', expired: 'This Payment Intent has expired.',
    payInstructions: 'Pay from your wallet, then enter the transaction signature so the payment service can verify it on-chain.',
    walletConnect: 'Wallet connection', walletConnected: 'Wallet connected', walletRequired: 'Connect a wallet before paying.',
    copy: 'Copy', copied: 'Copied', connect: 'Connect', disconnect: 'Disconnect', technicalDetails: 'Payment details',
    signatureLabel: 'Transaction Signature', signaturePlaceholder: 'Enter the transaction signature', verifyPayment: 'Verify payment', verifying: 'Verifying payment...',
    verificationSubmitted: 'Verification was requested. The payment is not considered successful until the server reports an authoritative state.',
    notDetected: 'This signature was not found for this Payment Intent reference and verification window.',
    paymentConfirmed: 'The payment was confirmed by the payment service.', paymentCompleted: 'The payment reached the final completed state.', paymentUnderpaid: 'A payment below the required amount was detected.', paymentOverpaid: 'A payment above the required amount was detected.', paymentAmbiguous: 'Multiple compatible observations were found and the payment requires further resolution.',
    verificationFailed: 'The transaction could not be verified. Try again.', intentLookupTitle: 'Check Payment Intent', intentLookupDescription: 'Enter a Payment Intent ID to load and inspect the authoritative payment snapshot.', intentLookupLabel: 'Payment Intent ID', intentLookupPlaceholder: 'Enter the Payment Intent UUID', checkIntent: 'Check Intent', invalidIntentId: 'The Payment Intent ID is invalid.'
  },
  ar: {
    merchant: 'التاجر', amount: 'المبلغ', customerTotal: 'إجمالي العميل', fee: 'رسوم البوابة', feePayer: 'دافع الرسوم', asset: 'الأصل', network: 'الشبكة', destination: 'الوجهة', reference: 'المرجع', intentStatus: 'حالة Intent', commitment: 'التزام التحقق',
    loadFailed: 'تعذر جلب Payment Intent من خدمة الدفع.', expired: 'انتهت صلاحية Payment Intent هذا.',
    payInstructions: 'أرسل الدفع من محفظتك، ثم أدخل توقيع المعاملة لكي تتحقق خدمة الدفع منه على الشبكة.',
    walletConnect: 'اتصال المحفظة', walletConnected: 'المحفظة متصلة', walletRequired: 'يجب توصيل محفظة قبل الدفع.',
    copy: 'نسخ', copied: 'تم النسخ', connect: 'اتصال', disconnect: 'قطع الاتصال', technicalDetails: 'تفاصيل الدفع',
    signatureLabel: 'Transaction Signature', signaturePlaceholder: 'أدخل توقيع المعاملة', verifyPayment: 'تحقق من الدفع', verifying: 'جارٍ التحقق من الدفع...',
    verificationSubmitted: 'تم طلب التحقق. لن يعتبر الدفع ناجحاً حتى يعلن الخادم حالة موثوقة.',
    notDetected: 'لم يتم العثور على هذا التوقيع ضمن مرجع Payment Intent ونافذة التحقق.',
    paymentConfirmed: 'تم تأكيد الدفع بواسطة خدمة الدفع.', paymentCompleted: 'اكتملت عملية الدفع بحالة نهائية.', paymentUnderpaid: 'تم اكتشاف دفع أقل من المبلغ المطلوب.', paymentOverpaid: 'تم اكتشاف دفع أكبر من المبلغ المطلوب.', paymentAmbiguous: 'تم العثور على ملاحظات متوافقة متعددة ويحتاج الدفع إلى معالجة إضافية.',
    verificationFailed: 'تعذر التحقق من المعاملة. حاول مرة أخرى.', intentLookupTitle: 'التحقق من Payment Intent', intentLookupDescription: 'أدخل معرّف Payment Intent لتحميل لقطة الدفع الموثوقة وفحصها.', intentLookupLabel: 'معرّف Payment Intent', intentLookupPlaceholder: 'أدخل UUID الخاص بـ Payment Intent', checkIntent: 'تحقق من Intent', invalidIntentId: 'معرّف Payment Intent غير صالح.'
  },
  ru: {
    merchant: 'Мерчант', amount: 'Сумма', customerTotal: 'Итого клиента', fee: 'Комиссия шлюза', feePayer: 'Плательщик комиссии', asset: 'Актив', network: 'Сеть', destination: 'Получатель', reference: 'Reference', intentStatus: 'Статус Intent', commitment: 'Требование проверки',
    loadFailed: 'Не удалось получить Payment Intent из платёжного сервиса.', expired: 'Срок действия этого Payment Intent истёк.',
    payInstructions: 'Выполните оплату из своего кошелька, затем введите подпись транзакции для проверки в сети.',
    walletConnect: 'Подключение кошелька', walletConnected: 'Кошелёк подключён', walletRequired: 'Перед оплатой подключите кошелёк.',
    copy: 'Копировать', copied: 'Скопировано', connect: 'Подключить', disconnect: 'Отключить', technicalDetails: 'Детали платежа',
    signatureLabel: 'Transaction Signature', signaturePlaceholder: 'Введите подпись транзакции', verifyPayment: 'Проверить оплату', verifying: 'Проверка оплаты...',
    verificationSubmitted: 'Проверка запрошена. Оплата не считается успешной, пока сервер не сообщит авторитетный статус.',
    notDetected: 'Эта подпись не найдена для Reference данного Payment Intent в окне проверки.',
    paymentConfirmed: 'Платёж подтверждён платёжным сервисом.', paymentCompleted: 'Платёж достиг окончательного статуса завершён.', paymentUnderpaid: 'Обнаружен платёж меньше требуемой суммы.', paymentOverpaid: 'Обнаружен платёж больше требуемой суммы.', paymentAmbiguous: 'Найдено несколько совместимых наблюдений; требуется дополнительное разрешение.',
    verificationFailed: 'Не удалось проверить транзакцию. Повторите попытку.', intentLookupTitle: 'Проверка Payment Intent', intentLookupDescription: 'Введите идентификатор Payment Intent, чтобы загрузить и проверить достоверный снимок платежа.', intentLookupLabel: 'ID Payment Intent', intentLookupPlaceholder: 'Введите UUID Payment Intent', checkIntent: 'Проверить Intent', invalidIntentId: 'Недопустимый ID Payment Intent.'
  },
} as const;

type CheckoutLabelKey = keyof typeof labels['fa-IR'];

export function checkoutLabel(locale: PayLocale, key: CheckoutLabelKey): string {
  return labels[locale][key] ?? labels['fa-IR'][key];
}
