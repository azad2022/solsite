import React from 'react';
import { AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, Circle, Loader2, ShieldCheck, Store, WalletCards } from 'lucide-react';
import type { PayLocale, PaySection } from '../types';
import type { PayMerchant } from '../services/merchantOnboardingService';
import './pay-getting-started.css';

type MerchantLoadState = 'loading' | 'ready' | 'error';

interface Props {
  locale: PayLocale;
  merchant: PayMerchant | null;
  merchantLoadState: MerchantLoadState;
  onNavigate: (section: PaySection) => void;
  onRetryMerchant: () => void;
}

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
  merchantActive: string;
  walletVerified: string;
  walletPending: string;
  developer: string;
};

const copy: Record<PayLocale, GuideCopy> = {
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
    lookupFailed: 'وضعیت Merchant از سرویس Pay دریافت نشد؛ در این حالت فرم ساخت Merchant نمایش داده نمی‌شود.',
    retry: 'تلاش دوباره',
    merchantNotReady: 'Merchant هنوز راه‌اندازی نشده است.',
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
    lookupFailed: 'The Pay service did not return the Merchant state, so the creation form is not shown.',
    retry: 'Retry',
    merchantNotReady: 'The Merchant has not been set up yet.',
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
    lookupFailed: 'لم تُرجع خدمة Pay حالة Merchant، لذلك لا يتم عرض نموذج الإنشاء.',
    retry: 'إعادة المحاولة',
    merchantNotReady: 'لم يتم إعداد Merchant بعد.',
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
    lookupFailed: 'Сервис Pay не вернул состояние Merchant, поэтому форма создания не показывается.',
    retry: 'Повторить',
    merchantNotReady: 'Merchant ещё не настроен.',
    merchantActive: 'Merchant активен.',
    walletVerified: 'Кошелёк для приёма подтверждён.',
    walletPending: 'Кошелёк для приёма ещё не подтверждён.',
    developer: 'Центр разработчика',
  },
};

function statusIcon(done: boolean) {
  return done ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />;
}

export default function PayGettingStartedGuide({ locale, merchant, merchantLoadState, onNavigate, onRetryMerchant }: Props): React.ReactElement {
  const t = copy[locale];
  const merchantReady = Boolean(merchant);
  const walletVerified = merchant?.receivingWallet?.verificationStatus === 'verified' && merchant.receivingWallet.isActive;
  const merchantActive = merchant?.status === 'active';

  return (
    <section className="pay-getting-started" aria-labelledby="pay-getting-started-title">
      <div className="pay-getting-started-header">
        <div className="pay-getting-started-title-row">
          <div className="pay-getting-started-icon" aria-hidden="true"><BookOpen size={19} /></div>
          <div>
            <span className="pay-panel-kicker">{t.kicker}</span>
            <h2 id="pay-getting-started-title">{t.title}</h2>
            <p>{t.description}</p>
          </div>
        </div>
        <button type="button" className="pay-getting-started-developer" onClick={() => onNavigate('developer')}>
          <ArrowUpRight size={16} />
          {t.developer}
        </button>
      </div>

      {merchantLoadState === 'loading' ? (
        <div className="pay-getting-started-state" role="status" aria-live="polite"><Loader2 size={17} className="animate-spin" />{t.loading}</div>
      ) : merchantLoadState === 'error' ? (
        <div className="pay-getting-started-state is-error" role="alert">
          <AlertTriangle size={17} />
          <span>{t.lookupFailed}</span>
          <button type="button" className="pay-secondary-action" onClick={onRetryMerchant}>{t.retry}</button>
        </div>
      ) : (
        <div className="pay-getting-started-steps">
          <GuideStep number="1" icon={<Store size={16} />} title={t.step1} text={t.step1Text} done={merchantReady} active={!merchantReady} onClick={!merchantReady ? () => onNavigate('merchants') : undefined} status={merchantReady ? t.ready : t.pending} />
          <GuideStep number="2" icon={<WalletCards size={16} />} title={t.step2} text={t.step2Text} done={walletVerified} active={merchantReady && !walletVerified} onClick={merchantReady && !walletVerified ? () => onNavigate('merchants') : undefined} status={walletVerified ? t.ready : merchantReady ? t.pending : t.pending} />
          <GuideStep number="3" icon={<ShieldCheck size={16} />} title={t.step3} text={merchantActive ? t.merchantActive : walletVerified ? t.merchantActive : t.merchantNotReady} done={merchantActive} active={walletVerified && !merchantActive} status={merchantActive ? t.ready : t.pending} />
          <GuideStep number="4" icon={<BookOpen size={16} />} title={t.step4} text={merchantActive ? t.walletVerified : walletVerified ? t.walletVerified : t.walletPending} done={merchantActive && walletVerified} active={merchantActive && walletVerified} onClick={() => onNavigate('developer')} status={merchantActive && walletVerified ? t.ready : t.pending} />
        </div>
      )}

      {merchantLoadState === 'ready' && merchant && (
        <div className="pay-getting-started-footnote">
          <span>{merchant.businessName}</span>
          <span>{walletVerified ? t.walletVerified : t.walletPending}</span>
        </div>
      )}
    </section>
  );
}

function GuideStep({ number, icon, title, text: body, done, active, onClick, status }: {
  number: string; icon: React.ReactNode; title: string; text: string; done: boolean; active: boolean; onClick?: () => void; status: string;
}): React.ReactElement {
  const content = (
    <>
      <div className="pay-getting-started-step-icon">{statusIcon(done)}</div>
      <div className="pay-getting-started-step-copy">
        <span className="pay-getting-started-step-number">{number}</span>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <span className="pay-getting-started-step-status">{active ? status : done ? status : status}</span>
      {onClick ? <ArrowUpRight className="pay-getting-started-step-action" size={16} aria-hidden="true" /> : null}
    </>
  );
  return onClick ? <button type="button" className={`pay-getting-started-step is-action${active ? ' is-active' : ''}`} onClick={onClick}>{content}</button>
    : <div className={`pay-getting-started-step${done ? ' is-done' : active ? ' is-active' : ''}`}>{content}</div>;
}
