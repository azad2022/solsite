import type { PayLocale } from '../types';
import type { PayAffiliate, PayCommission, PayReferral } from '../services/referralService';

const messages = {
  'fa-IR': {
    title:'معرفی و همکاری', subtitle:'داده‌های واقعی Affiliate، ارجاع‌ها و کمیسیون‌های ثبت‌شده در سرویس Pay.',
    refresh:'به‌روزرسانی', noData:'داده‌ای برای نمایش وجود ندارد.', loadFailed:'دریافت اطلاعات معرفی و همکاری ناموفق بود.',
    retry:'تلاش مجدد', unauthorized:'برای مشاهده این بخش وارد شوید.', forbidden:'به این داده‌های معرفی و همکاری دسترسی ندارید.',
    affiliates:'همکاری‌ها', referrals:'ارجاع‌ها', commissions:'کمیسیون‌ها', referralCode:'کد معرفی', rate:'نرخ ثبت‌شده',
    status:'وضعیت', merchant:'پذیرنده', attributedAt:'زمان ثبت', active:'فعال', inactive:'غیرفعال',
    commissionAmount:'مبلغ کمیسیون اتمیک', payment:'Payment ID', commissionStatus:'وضعیت کمیسیون',
    approvedAt:'تأیید شده', paidAt:'پرداخت شده', gatewayFee:'کارمزد Gateway اتمیک', createdAt:'ایجاد شده',
    readonly:'مقادیر کمیسیون و وضعیت‌ها مستقیماً از Backend خوانده می‌شوند؛ Frontend هیچ commission یا payout را محاسبه نمی‌کند.', stale:'آخرین داده معتبر نمایش داده می‌شود؛ به‌روزرسانی جدید ناموفق بود.',
  },
  'en-US': {
    title:'Referrals', subtitle:'Real affiliate, referral, and commission records from the Pay service.',
    refresh:'Refresh', noData:'No data to display.', loadFailed:'Referral data could not be loaded.',
    retry:'Retry', unauthorized:'Sign in to view this section.', forbidden:'You do not have access to these referral records.',
    affiliates:'Affiliates', referrals:'Referrals', commissions:'Commissions', referralCode:'Referral code', rate:'Recorded rate',
    status:'Status', merchant:'Merchant', attributedAt:'Attributed', active:'Active', inactive:'Inactive',
    commissionAmount:'Atomic commission', payment:'Payment ID', commissionStatus:'Commission status',
    approvedAt:'Approved', paidAt:'Paid', gatewayFee:'Atomic gateway fee', createdAt:'Created',
    readonly:'Commission amounts and statuses are read directly from the Backend; the Frontend never calculates commission or payout truth.', stale:'The latest valid snapshot is retained; the newest refresh failed.',
  },
  ar: {
    title:'الإحالات', subtitle:'سجلات حقيقية للشركاء والإحالات والعمولات من خدمة Pay.',
    refresh:'تحديث', noData:'لا توجد بيانات للعرض.', loadFailed:'تعذر تحميل بيانات الإحالات.',
    retry:'إعادة المحاولة', unauthorized:'سجّل الدخول لعرض هذا القسم.', forbidden:'لا تملك صلاحية الوصول إلى سجلات الإحالات هذه.',
    affiliates:'الشركاء', referrals:'الإحالات', commissions:'العمولات', referralCode:'رمز الإحالة', rate:'المعدل المسجل',
    status:'الحالة', merchant:'التاجر', attributedAt:'وقت الإسناد', active:'نشط', inactive:'غير نشط',
    commissionAmount:'العمولة الذرية', payment:'معرّف الدفع', commissionStatus:'حالة العمولة',
    approvedAt:'تمت الموافقة', paidAt:'تم الدفع', gatewayFee:'رسوم البوابة الذرية', createdAt:'تم الإنشاء',
    readonly:'تُقرأ مبالغ العمولات وحالاتها مباشرة من Backend؛ ولا تحسب الواجهة أي عمولة أو قيمة صرف.', stale:'يتم الاحتفاظ بآخر لقطة موثوقة لأن آخر تحديث فشل.'
  },
  ru: {
    title:'Рефералы', subtitle:'Реальные записи партнёров, рефералов и комиссий из Pay.',
    refresh:'Обновить', noData:'Нет данных для отображения.', loadFailed:'Не удалось загрузить данные рефералов.',
    retry:'Повторить', unauthorized:'Войдите, чтобы открыть этот раздел.', forbidden:'У вас нет доступа к этим реферальным данным.',
    affiliates:'Партнёры', referrals:'Рефералы', commissions:'Комиссии', referralCode:'Реферальный код', rate:'Зафиксированная ставка',
    status:'Статус', merchant:'Мерчант', attributedAt:'Дата привязки', active:'Активен', inactive:'Неактивен',
    commissionAmount:'Комиссия в atomic units', payment:'ID платежа', commissionStatus:'Статус комиссии',
    approvedAt:'Одобрено', paidAt:'Оплачено', gatewayFee:'Комиссия Gateway в atomic units', createdAt:'Создано',
    readonly:'Суммы и статусы комиссий читаются непосредственно из Backend; Frontend не рассчитывает комиссии или выплаты.', stale:'Показан последний достоверный снимок; новое обновление не удалось.'
  },
} as const;

export type ReferralTranslationKey = Exclude<keyof typeof messages['fa-IR'], 'active' | 'inactive'>;
export function referralT(locale: PayLocale, key: ReferralTranslationKey): string { return messages[locale][key]; }
export function referralActiveT(locale: PayLocale, active: boolean): string { return active ? messages[locale].active : messages[locale].inactive; }
export function referralStatusT(locale: PayLocale, status: string): string { return status; }
export function affiliateRateLabel(_affiliate: PayAffiliate, locale: PayLocale): string { return referralT(locale, 'rate'); }
export function referralMerchantId(referral: PayReferral): string { return referral.merchant_id; }
export function commissionStatusLabel(commission: PayCommission, locale: PayLocale): string { return referralT(locale, 'commissionStatus') + ': ' + commission.status; }
