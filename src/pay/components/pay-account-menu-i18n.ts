import type { PayLocale } from '../types';

type AccountMenuMessages = {
  accountMenu: string;
  close: string;
  walletBalance: string;
  walletBalanceSource: string;
  refreshBalance: string;
  loadingBalance: string;
  balanceUnavailable: string;
  walletNotConfigured: string;
  walletAddress: string;
  copyAddress: string;
  copied: string;
  observedAt: string;
  solana: string;
  stablecoin: string;
  logout: string;
  loggingOut: string;
  network: string;
  directReferrals: string;
  directReferralsDescription: string;
  loadingReferralStats: string;
  referralStatsUnavailable: string;
};

const messages: Record<PayLocale, AccountMenuMessages> = {
  'fa-IR': {
    accountMenu:'حساب کاربری', close:'بستن',
    walletBalance:'موجودی کیف پول دریافت',
    walletBalanceSource:'داده زنده از سرویس Pay و شبکه Solana',
    refreshBalance:'به‌روزرسانی موجودی',
    loadingBalance:'در حال دریافت موجودی…',
    balanceUnavailable:'موجودی فعلاً در دسترس نیست؛ دوباره تلاش کنید.',
    walletNotConfigured:'هنوز کیف پول دریافت تأییدشده‌ای برای این Merchant در دسترس نیست.',
    walletAddress:'آدرس کیف پول',
    copyAddress:'کپی آدرس',
    copied:'کپی شد',
    observedAt:'آخرین مشاهده',
    solana:'Solana',
    stablecoin:'Stablecoin',
    logout:'خروج از حساب',
    loggingOut:'در حال خروج…',
    network:'شبکه',
    directReferrals:'زیرمجموعه‌های مستقیم',
    directReferralsDescription:'آمار ثبت‌نام‌های منتسب به لینک شما',
    loadingReferralStats:'در حال دریافت آمار…',
    referralStatsUnavailable:'آمار فعلاً در دسترس نیست',
  },
  'en-US': {
    accountMenu:'Account', close:'Close',
    walletBalance:'Receiving wallet balance',
    walletBalanceSource:'Live read from the Pay service and Solana network',
    refreshBalance:'Refresh balance',
    loadingBalance:'Loading balance…',
    balanceUnavailable:'Balance is temporarily unavailable. Try again.',
    walletNotConfigured:'No verified receiving wallet is currently available for this Merchant.',
    walletAddress:'Wallet address',
    copyAddress:'Copy address',
    copied:'Copied',
    observedAt:'Observed',
    solana:'Solana',
    stablecoin:'Stablecoin',
    logout:'Sign out',
    loggingOut:'Signing out…',
    network:'Network',
    directReferrals:'Direct referrals',
    directReferralsDescription:'Sign-ups attributed to your link',
    loadingReferralStats:'Loading referral stats…',
    referralStatsUnavailable:'Referral stats unavailable',
  },
  ar: {
    accountMenu:'الحساب', close:'إغلاق',
    walletBalance:'رصيد محفظة الاستلام',
    walletBalanceSource:'قراءة مباشرة من خدمة Pay وشبكة Solana',
    refreshBalance:'تحديث الرصيد',
    loadingBalance:'جارٍ تحميل الرصيد…',
    balanceUnavailable:'الرصيد غير متاح مؤقتًا. أعد المحاولة.',
    walletNotConfigured:'لا توجد محفظة استلام موثّقة متاحة لهذا التاجر حاليًا.',
    walletAddress:'عنوان المحفظة',
    copyAddress:'نسخ العنوان',
    copied:'تم النسخ',
    observedAt:'آخر قراءة',
    solana:'Solana',
    stablecoin:'عملة مستقرة',
    logout:'تسجيل الخروج',
    loggingOut:'جارٍ تسجيل الخروج…',
    network:'الشبكة',
    directReferrals:'الإحالات المباشرة',
    directReferralsDescription:'التسجيلات المنسوبة إلى رابطك',
    loadingReferralStats:'جارٍ تحميل الإحصاءات…',
    referralStatsUnavailable:'إحصاءات الإحالة غير متاحة حاليًا',
  },
  ru: {
    accountMenu:'Аккаунт', close:'Закрыть',
    walletBalance:'Баланс кошелька для приёма',
    walletBalanceSource:'Данные из сервиса Pay и сети Solana',
    refreshBalance:'Обновить баланс',
    loadingBalance:'Загрузка баланса…',
    balanceUnavailable:'Баланс временно недоступен. Повторите попытку.',
    walletNotConfigured:'Для этого мерчанта сейчас нет доступного подтверждённого кошелька приёма.',
    walletAddress:'Адрес кошелька',
    copyAddress:'Копировать адрес',
    copied:'Скопировано',
    observedAt:'Время наблюдения',
    solana:'Solana',
    stablecoin:'Стейблкоин',
    logout:'Выйти',
    loggingOut:'Выход…',
    network:'Сеть',
    directReferrals:'Прямые рефералы',
    directReferralsDescription:'Регистрации по вашей ссылке',
    loadingReferralStats:'Загрузка статистики…',
    referralStatsUnavailable:'Статистика рефералов недоступна',
  },
};

export function accountMenuT(locale: PayLocale, key: keyof AccountMenuMessages): string {
  return messages[locale][key];
}
