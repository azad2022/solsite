import type { PayLocale } from '../types';

type GuideCopy = {
  kicker: string;
  title: string;
  description: string;
  step1: string;
  step1Text: string;
  step2: string;
  step2Text: string;
  step3: string;
  step3Text: string;
  step4: string;
  step4Text: string;
  pending: string;
  ready: string;
  loading: string;
  lookupFailed: string;
  retry: string;
  merchantNotReady: string;
  merchantNotActive: string;
  merchantActive: string;
  walletVerified: string;
  walletPending: string;
  developer: string;
};

export const guideCopy: Record<PayLocale, GuideCopy> = {
  'fa-IR': {
    kicker: 'راهنمای شروع',
    title: 'برای شروع چه کاری انجام دهید؟',
    description: 'این مسیر فقط بر اساس وضعیت واقعی Merchant و کیف پول تأییدشده از سرویس Pay نمایش داده می‌شود.',
    step1: 'Merchant را بسازید',
    step1Text: 'نام کسب‌وکار را وارد کنید. شناسه فنی Merchant باید با حروف انگلیسی، عدد و خط تیره باشد.',
    step2: 'کیف پول دریافت را تأیید کنید',
    step2Text: 'یک کیف پول Solana را وصل کنید و پیام مالکیت را امضا کنید. این امضا تراکنش مالی نیست.',
    step3: 'وضعیت واقعی را بررسی کنید',
    step3Text: 'پس از پاسخ معتبر سرور، وضعیت Merchant و کیف پول در همین بخش نمایش داده می‌شود.',
    step4: 'وارد امکانات Pay شوید',
    step4Text: 'برای خواندن قراردادهای فعلی و APIهای منتشرشده، از مرکز توسعه‌دهندگان استفاده کنید.',
    pending: 'در انتظار تنظیم',
    ready: 'آماده',
    loading: 'در حال بررسی Merchant…',
    lookupFailed: 'وضعیت Merchant از سرویس Pay دریافت نشد. برای ساخت Merchant از فرم همین صفحه استفاده کنید؛ سرور از ایجاد Merchant تکراری جلوگیری می‌کند.',
    retry: 'تلاش دوباره',
    merchantNotReady: 'Merchant هنوز راه‌اندازی نشده است.',
    merchantNotActive: 'Merchant هنوز فعال نیست.',
    merchantActive: 'Merchant فعال است.',
    walletVerified: 'کیف پول دریافت تأیید شده است.',
    walletPending: 'کیف پول دریافت هنوز تأیید نشده است.',
    developer: 'مرکز توسعه‌دهندگان',
  },
  'en-US': {
    kicker: 'Getting started',
    title: 'What should you do first?',
    description: 'This path is driven only by the current Merchant and verified wallet state returned by the Pay service.',
    step1: 'Create your Merchant',
    step1Text: 'Enter a business name. The technical Merchant identifier must use English letters, numbers, and hyphens.',
    step2: 'Verify the receiving wallet',
    step2Text: 'Connect a Solana wallet and sign the ownership message. This signature is not a financial transaction.',
    step3: 'Review the authoritative state',
    step3Text: 'After a valid server response, the Merchant and wallet state appears here.',
    step4: 'Use the available Pay surfaces',
    step4Text: 'Use the Developer Center for the currently published contracts and APIs.',
    pending: 'Pending setup',
    ready: 'Ready',
    loading: 'Checking Merchant…',
    lookupFailed: 'The Pay service did not return the Merchant state. You can use the setup form on this page; the server prevents duplicate Merchant creation.',
    retry: 'Retry',
    merchantNotReady: 'The Merchant has not been set up yet.',
    merchantNotActive: 'The Merchant is not active.',
    merchantActive: 'The Merchant is active.',
    walletVerified: 'The receiving wallet is verified.',
    walletPending: 'The receiving wallet is not verified yet.',
    developer: 'Developer Center',
  },
  ar: {
    kicker: 'دليل البدء',
    title: 'ما الخطوة الأولى؟',
    description: 'يعتمد هذا المسار فقط على حالة Merchant والمحفظة الموثقة التي يعيدها خادم Pay.',
    step1: 'أنشئ Merchant',
    step1Text: 'أدخل اسم النشاط التجاري. يجب أن يستخدم المعرّف التقني أحرفًا إنجليزية وأرقامًا وشرطات فقط.',
    step2: 'تحقق من محفظة الاستلام',
    step2Text: 'صِل محفظة Solana ووقّع رسالة إثبات الملكية. هذا التوقيع ليس معاملة مالية.',
    step3: 'راجع الحالة الموثوقة',
    step3Text: 'بعد استجابة صحيحة من الخادم تظهر حالة Merchant والمحفظة هنا.',
    step4: 'استخدم أقسام Pay المتاحة',
    step4Text: 'استخدم مركز المطورين للعقود وواجهات API المنشورة حاليًا.',
    pending: 'بانتظار الإعداد',
    ready: 'جاهز',
    loading: 'جارٍ فحص Merchant…',
    lookupFailed: 'لم تُرجع خدمة Pay حالة Merchant. يمكنك استخدام نموذج الإعداد في هذه الصفحة؛ ويمنع الخادم إنشاء Merchant مكررًا.',
    retry: 'إعادة المحاولة',
    merchantNotReady: 'لم يتم إعداد Merchant بعد.',
    merchantNotActive: 'Merchant غير نشط.',
    merchantActive: 'Merchant نشط.',
    walletVerified: 'تم التحقق من محفظة الاستلام.',
    walletPending: 'لم يتم التحقق من محفظة الاستلام بعد.',
    developer: 'مركز المطورين',
  },
  ru: {
    kicker: 'Памятка',
    title: 'С чего начать?',
    description: 'Маршрут основан только на текущем состоянии Merchant и подтверждённого кошелька из Pay.',
    step1: 'Создайте Merchant',
    step1Text: 'Укажите название бизнеса. Технический идентификатор должен содержать латинские буквы, цифры и дефисы.',
    step2: 'Подтвердите кошелёк для приёма',
    step2Text: 'Подключите Solana-кошелёк и подпишите сообщение о владении. Это не финансовая транзакция.',
    step3: 'Проверьте достоверное состояние',
    step3Text: 'После корректного ответа сервера состояние Merchant и кошелька появится здесь.',
    step4: 'Используйте доступные разделы Pay',
    step4Text: 'В центре разработчика доступны опубликованные сейчас контракты и API.',
    pending: 'Ожидает настройки',
    ready: 'Готово',
    loading: 'Проверка Merchant…',
    lookupFailed: 'Сервис Pay не вернул состояние Merchant. Вы можете использовать форму настройки на этой странице; сервер не допускает создание дубликата Merchant.',
    retry: 'Повторить',
    merchantNotReady: 'Merchant ещё не настроен.',
    merchantNotActive: 'Merchant ещё не активен.',
    merchantActive: 'Merchant активен.',
    walletVerified: 'Кошелёк для приёма подтверждён.',
    walletPending: 'Кошелёк для приёма ещё не подтверждён.',
    developer: 'Центр разработчика',
  },
};
