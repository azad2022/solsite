import type { PayLocale } from '../types';

const messages={
  'fa-IR':{
    title:'امنیت',subtitle:'نمایش وضعیت‌های امنیتی قابل مشاهده از قراردادهای فعلی Pay.',
    refresh:'به‌روزرسانی',loading:'در حال دریافت وضعیت امنیتی…',loadFailed:'دریافت وضعیت امنیتی ناموفق بود.',
    retry:'تلاش مجدد',unauthorized:'برای مشاهده این بخش وارد شوید.',forbidden:'به اطلاعات امنیتی این پذیرنده دسترسی ندارید.',
    wallet:'کیف پول دریافت',walletVerified:'تأییدشده',walletUnknown:'وضعیت تأیید در داده فعلی نامشخص است.',
    apiKeys:'کلیدهای API',activeKeys:'فعال',revokedKeys:'باطل‌شده',expiredKeys:'منقضی',
    webhooks:'وبهوک‌ها',activeWebhooks:'فعال',signedWebhooks:'امضای سروری',
    secureBoundary:'مرز امنیتی',secureBoundaryText:'احراز هویت، مجوزدهی، بررسی تراکنش و داده مالی خارج از UI enforce می‌شوند.',
    noWallet:'Receiving wallet تأییدشده‌ای در snapshot فعلی وجود ندارد.',
    noWebhooks:'وبهوک فعالی در snapshot فعلی وجود ندارد.',
    noKeys:'کلید APIای در snapshot فعلی وجود ندارد.',
    observed:'وضعیت مشاهده‌شده',notClaimed:'این صفحه security score یا ضمانت امنیتی محاسبه نمی‌کند.',
    stale:'آخرین snapshot معتبر نمایش داده می‌شود؛ refresh جدید ناموفق بود.'
  },
  'en-US':{
    title:'Security',subtitle:'Security-relevant states exposed by the current Pay contracts.',
    refresh:'Refresh',loading:'Loading security status…',loadFailed:'Security status could not be loaded.',
    retry:'Retry',unauthorized:'Sign in to view this section.',forbidden:'You do not have access to this merchant security data.',
    wallet:'Receiving wallet',walletVerified:'Verified',walletUnknown:'Verification state is unknown in the current data.',
    apiKeys:'API keys',activeKeys:'Active',revokedKeys:'Revoked',expiredKeys:'Expired',
    webhooks:'Webhooks',activeWebhooks:'Active',signedWebhooks:'Server signing',
    secureBoundary:'Security boundary',secureBoundaryText:'Authentication, authorization, transaction verification, and financial truth are enforced outside the UI.',
    noWallet:'No verified receiving wallet is present in the current snapshot.',
    noWebhooks:'No active webhooks are present in the current snapshot.',
    noKeys:'No API keys are present in the current snapshot.',
    observed:'Observed status',notClaimed:'This page does not calculate a security score or make a security guarantee.',
    stale:'The latest valid snapshot is retained; the newest refresh failed.'
  },
  ar:{
    title:'الأمان',subtitle:'حالات أمنية يمكن ملاحظتها من عقود Pay الحالية.',
    refresh:'تحديث',loading:'جارٍ تحميل حالة الأمان…',loadFailed:'تعذر تحميل حالة الأمان.',
    retry:'إعادة المحاولة',unauthorized:'سجّل الدخول لعرض هذا القسم.',forbidden:'لا تملك صلاحية الوصول إلى بيانات أمان هذا التاجر.',
    wallet:'محفظة الاستلام',walletVerified:'تم التحقق',walletUnknown:'حالة التحقق غير معروفة في البيانات الحالية.',
    apiKeys:'مفاتيح API',activeKeys:'نشطة',revokedKeys:'ملغاة',expiredKeys:'منتهية',
    webhooks:'Webhooks',activeWebhooks:'نشطة',signedWebhooks:'توقيع الخادم',
    secureBoundary:'حد الأمان',secureBoundaryText:'يتم فرض المصادقة والتفويض والتحقق من المعاملات والحقيقة المالية خارج الواجهة.',
    noWallet:'لا توجد محفظة استلام موثقة في اللقطة الحالية.',
    noWebhooks:'لا توجد Webhooks نشطة في اللقطة الحالية.',
    noKeys:'لا توجد مفاتيح API في اللقطة الحالية.',
    observed:'الحالة المرصودة',notClaimed:'لا تحسب هذه الصفحة درجة أمان ولا تقدم ضمانًا أمنيًا.',
    stale:'يتم الاحتفاظ بآخر لقطة موثوقة لأن آخر تحديث فشل.'
  },
  ru:{
    title:'Безопасность',subtitle:'Безопасностно значимые состояния из текущих Pay-контрактов.',
    refresh:'Обновить',loading:'Загрузка статуса безопасности…',loadFailed:'Не удалось загрузить статус безопасности.',
    retry:'Повторить',unauthorized:'Войдите, чтобы открыть этот раздел.',forbidden:'У вас нет доступа к данным безопасности этого мерчанта.',
    wallet:'Принимающий кошелёк',walletVerified:'Подтверждён',walletUnknown:'Статус подтверждения неизвестен в текущих данных.',
    apiKeys:'API-ключи',activeKeys:'Активные',revokedKeys:'Отозванные',expiredKeys:'Истёкшие',
    webhooks:'Вебхуки',activeWebhooks:'Активные',signedWebhooks:'Подпись сервера',
    secureBoundary:'Граница безопасности',secureBoundaryText:'Аутентификация, авторизация, проверка транзакций и финансовая истина обеспечиваются вне UI.',
    noWallet:'В текущем снимке нет подтверждённого принимающего кошелька.',
    noWebhooks:'В текущем снимке нет активных вебхуков.',
    noKeys:'В текущем снимке нет API-ключей.',
    observed:'Наблюдаемое состояние',notClaimed:'Эта страница не рассчитывает security score и не даёт гарантий безопасности.',
    stale:'Показан последний достоверный снимок; новое обновление не удалось.'
  }
} as const;

export type SecurityTranslationKey=keyof typeof messages['fa-IR'];
export function securityT(locale:PayLocale,key:SecurityTranslationKey):string{return messages[locale][key];}
