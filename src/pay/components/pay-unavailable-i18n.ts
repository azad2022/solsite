import type { PayLocale } from '../types';

const messages={
  'fa-IR':{
    backendUnavailable:'این بخش هنوز فعال نشده است',
    backendUnavailableText:'برای این قابلیت هنوز Backend contract منتشر و اعتبارسنجی نشده است. تا آن زمان هیچ داده ساختگی یا وضعیت مالی فرضی نمایش داده نمی‌شود.',
    contractState:'Backend contract',
    notReleased:'منتشر نشده',
  },
  'en-US':{
    backendUnavailable:'This section is not active yet',
    backendUnavailableText:'A released and validated Backend contract does not exist for this capability yet. No mock data or assumed financial state is shown.',
    contractState:'Backend contract',
    notReleased:'Not released',
  },
  ar:{
    backendUnavailable:'هذا القسم غير مفعّل بعد',
    backendUnavailableText:'لا يوجد بعد عقد Backend منشور ومتحقق منه لهذه الوظيفة. لن يتم عرض بيانات وهمية أو حالة مالية مفترضة.',
    contractState:'عقد Backend',
    notReleased:'غير منشور',
  },
  ru:{
    backendUnavailable:'Этот раздел пока не активен',
    backendUnavailableText:'Для этой возможности ещё нет опубликованного и проверенного Backend-контракта. Поддельные данные и предполагаемое финансовое состояние не отображаются.',
    contractState:'Backend-контракт',
    notReleased:'Не опубликован',
  },
} as const;

export type PayUnavailableTranslationKey=keyof typeof messages['fa-IR'];
export function payUnavailableT(locale:PayLocale,key:PayUnavailableTranslationKey):string{return messages[locale][key];}
