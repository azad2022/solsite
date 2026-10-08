import type { PayLocale } from '../types';

export interface PaySectionGuideTopic {
  title: string;
  summary: string;
  steps: readonly string[];
  note: string;
}

type DedicatedTopicKey = 'invoices' | 'payment-links' | 'bulk-pay' | 'api-keys';
type Chrome = { kicker:string; expand:string; collapse:string; purpose:string; steps:string; note:string };

const chrome: Record<PayLocale, Chrome> = {
  'fa-IR': { kicker:'راهنمای این بخش', expand:'نمایش راهنما', collapse:'بستن راهنما', purpose:'این بخش برای چیست؟', steps:'نحوه استفاده', note:'نکته مهم' },
  'en-US': { kicker:'Section guide', expand:'Show guide', collapse:'Hide guide', purpose:'What is this section for?', steps:'How to use it', note:'Important note' },
  ar: { kicker:'دليل هذا القسم', expand:'عرض الدليل', collapse:'إخفاء الدليل', purpose:'ما فائدة هذا القسم؟', steps:'طريقة الاستخدام', note:'ملاحظة مهمة' },
  ru: { kicker:'Руководство раздела', expand:'Показать руководство', collapse:'Скрыть руководство', purpose:'Для чего нужен этот раздел?', steps:'Как пользоваться', note:'Важное замечание' },
};

const dedicated: Record<PayLocale, Record<DedicatedTopicKey, PaySectionGuideTopic>> = {
  'fa-IR': {
    invoices:{ title:'راهنمای فاکتورها', summary:'برای ایجاد و مدیریت فاکتورهای پذیرنده و پیگیری وضعیت پرداخت مشتری.', steps:['شماره فاکتور، عنوان و در صورت نیاز مشتری را وارد کنید.','مبلغ اتمیک، دارایی، پرداخت‌کننده کارمزد، زبان Checkout، سررسید و توضیحات را تنظیم کنید.','فاکتور را ایجاد و وضعیت آن را از فهرست پیگیری کنید.'], note:'مبلغ این فرم اتمیک است و وضعیت پرداخت از Backend/Database می‌آید؛ Frontend آن را حدس نمی‌زند.' },
    'payment-links':{ title:'راهنمای لینک‌های پرداخت', summary:'برای ساخت لینک عمومی با مبلغ و دارایی ثابت و هدایت مشتری به Checkout رسمی.', steps:['شناسه لینک، عنوان، مبلغ ثابت، دارایی، پرداخت‌کننده کارمزد و زبان Checkout را تنظیم کنید.','در صورت نیاز انقضا و توضیحات را اضافه کنید و URL عمومی را منتشر کنید.','لینک را مشاهده، ویرایش یا غیرفعال کنید؛ لینک دارای سابقه پرداخت حذف نمی‌شود.'], note:'مشتری برای پرداخت از لینک عمومی نیاز به حساب SolMint ندارد و اطلاعات واقعی پرداخت از سرویس Pay خوانده می‌شود.' },
    'bulk-pay':{ title:'راهنمای پرداخت گروهی', summary:'برای ارسال چند پرداخت از کیف پول مبدأ تأییدشده Merchant در قالب یک Batch.', steps:['برای هر دریافت‌کننده دارایی، آدرس Solana و مبلغ را وارد کنید؛ هر Batch حداکثر ۵۰ پرداخت دارد.','Batch را بسازید و کیف پول مبدأ، تعداد پرداخت‌ها و مجموع را قبل از امضا بازبینی کنید.','کیف پول مبدأ تأییدشده را متصل کنید، تراکنش آماده‌شده سرویس را امضا و ارسال کنید و تا Verification نهایی منتظر بمانید.'], note:'«ارسال‌شده» به معنی «تکمیل‌شده» نیست؛ نتیجه نهایی فقط از Verification و وضعیت authoritative سرویس می‌آید.' },
    'api-keys':{ title:'راهنمای کلیدهای API', summary:'برای مدیریت اعتبارنامه‌ای که سرویس شما با آن به قابلیت‌های منتشرشده Pay دسترسی می‌گیرد.', steps:['کلید جدید را با نام و در صورت نیاز تاریخ انقضا بسازید.','Scope فعلی منتشرشده را بررسی کنید؛ نسخه فعلی payment.create را نشان می‌دهد.','Secret را فقط یک‌بار در محل امن ذخیره کنید و در صورت نیاز کلید را لغو یا rotate کنید.'], note:'کلید کامل نباید در URL، لاگ، تحلیل‌گر یا Storage مرورگر قرار گیرد و Secret قبلی قابل بازیابی نیست.' },
  },
  'en-US': {
    invoices:{ title:'Invoice guide', summary:'Create and manage merchant invoices and track customer payment state.', steps:['Enter the invoice number, title, and optional customer label.','Set the atomic amount, asset, fee payer, Checkout locale, due date, and description.','Create the invoice and track its status from the list.'], note:'This form uses atomic amounts. Payment state comes from Backend/Database and is not inferred by the Frontend.' },
    'payment-links':{ title:'Payment Link guide', summary:'Create a public fixed-amount link that sends customers to the official Checkout.', steps:['Set the slug, title, fixed amount, asset, fee payer, and Checkout locale.','Optionally add expiration and description, then share the public URL.','Review, edit, or deactivate the link; a link with payment history cannot be deleted.'], note:'Customers can pay from the public link without a SolMint account; real payment data comes from Pay.' },
    'bulk-pay':{ title:'Bulk Pay guide', summary:'Send multiple payouts from the verified Merchant source wallet as one Batch.', steps:['Enter an asset, Solana recipient, and amount for each row; one Batch supports up to 50 payouts.','Create the Batch and review source wallet, item count, and total before signing.','Connect the verified source wallet, sign and send the service-prepared transaction, then wait for final verification.'], note:'Submitted is not completed. Final state comes only from authoritative verification.' },
    'api-keys':{ title:'API key guide', summary:'Manage the credentials used by your integration to access released Pay capabilities.', steps:['Create a key with a name and optional expiration.','Review the released scope; the current UI exposes payment.create.','Store the one-time secret securely and revoke or rotate keys when needed.'], note:'Never put the full key in URLs, logs, analytics, or browser storage; a hidden previous secret cannot be recovered.' },
  },
  ar: {
    invoices:{ title:'دليل الفواتير', summary:'إنشاء فواتير التاجر وإدارتها ومتابعة حالة الدفع.', steps:['أدخل رقم الفاتورة والعنوان والعميل عند الحاجة.','اضبط المبلغ الذري والأصل ودافع الرسوم ولغة Checkout والاستحقاق والوصف.','أنشئ الفاتورة وتابع حالتها من القائمة.'], note:'يُدخل المبلغ بالوحدات الذرية، وتأتي حالة الدفع من الخادم ولا تستنتجها الواجهة.' },
    'payment-links':{ title:'دليل روابط الدفع', summary:'إنشاء رابط عام بمبلغ ثابت يقود العميل إلى Checkout الرسمي.', steps:['اضبط المعرّف والعنوان والمبلغ الثابت والأصل ودافع الرسوم ولغة Checkout.','أضف الانتهاء والوصف عند الحاجة ثم شارك الرابط العام.','اعرض الرابط أو عدّله أو عطّله؛ الرابط ذو سجل الدفع لا يُحذف.'], note:'يمكن للعميل الدفع من الرابط العام دون حساب SolMint، وتأتي بيانات الدفع الفعلية من Pay.' },
    'bulk-pay':{ title:'دليل الدفعات المجمعة', summary:'إرسال دفعات متعددة من محفظة مصدر Merchant الموثقة ضمن Batch واحد.', steps:['أدخل الأصل وعنوان Solana والمبلغ لكل مستلم؛ يدعم Batch حتى 50 دفعة.','أنشئ Batch وراجع محفظة المصدر وعدد الدفعات والإجمالي قبل التوقيع.','صِل المحفظة الموثقة ووقّع المعاملة التي جهزتها الخدمة ثم انتظر التحقق النهائي.'], note:'الإرسال لا يعني اكتمال الدفع؛ الحالة النهائية تأتي من التحقق المعتمد.' },
    'api-keys':{ title:'دليل مفاتيح API', summary:'إدارة بيانات الاعتماد المستخدمة للوصول إلى قدرات Pay المنشورة.', steps:['أنشئ مفتاحًا بالاسم وتاريخ الانتهاء الاختياري.','راجع النطاق المنشور؛ يعرض الإصدار الحالي payment.create.','احفظ السر الذي يظهر مرة واحدة بأمان وألغِ أو دوّر المفتاح عند الحاجة.'], note:'لا تضع المفتاح الكامل في URL أو السجلات أو التحليلات أو تخزين المتصفح.' },
  },
  ru: {
    invoices:{ title:'Руководство по счетам', summary:'Создавайте счета мерчанта, управляйте ими и отслеживайте оплату.', steps:['Укажите номер счёта, название и клиента при необходимости.','Настройте сумму в atomic units, актив, плательщика комиссии, язык Checkout, срок и описание.','Создайте счёт и отслеживайте его статус в списке.'], note:'Сумма вводится в atomic units. Статус оплаты приходит с Backend/Database.' },
    'payment-links':{ title:'Руководство по платёжным ссылкам', summary:'Создавайте публичную ссылку с фиксированной суммой для официального Checkout.', steps:['Укажите slug, название, фиксированную сумму, актив, плательщика комиссии и язык Checkout.','При необходимости задайте срок и описание, затем поделитесь публичной ссылкой.','Просматривайте, изменяйте и деактивируйте ссылку; ссылку с историей платежей удалить нельзя.'], note:'Клиенту не нужен аккаунт SolMint для оплаты; реальные данные платежа приходят из Pay.' },
    'bulk-pay':{ title:'Руководство по Bulk Pay', summary:'Отправляйте несколько выплат из подтверждённого кошелька-источника Merchant одним Batch.', steps:['Укажите актив, Solana-адрес и сумму для каждой строки; Batch поддерживает до 50 выплат.','Создайте Batch и проверьте источник, число выплат и итог до подписи.','Подключите подтверждённый кошелёк, подпишите подготовленную сервисом транзакцию и дождитесь финальной проверки.'], note:'Отправлено не означает завершено. Финальное состояние определяет авторитетная проверка.' },
    'api-keys':{ title:'Руководство по API-ключам', summary:'Управляйте учётными данными для доступа к опубликованным возможностям Pay.', steps:['Создайте ключ с названием и при необходимости сроком действия.','Проверьте опубликованный scope; текущий интерфейс показывает payment.create.','Сохраните одноразовый secret безопасно и при необходимости отозвите или ротируйте ключ.'], note:'Не помещайте полный ключ в URL, логи, аналитику или browser storage.' },
  },
};

export function sectionGuideChrome(locale: PayLocale): Chrome { return chrome[locale]; }
export function dedicatedSectionGuideTopic(locale: PayLocale, section: DedicatedTopicKey): PaySectionGuideTopic { return dedicated[locale][section]; }
