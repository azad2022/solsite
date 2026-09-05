import type { Direction, PayLocale } from '../types/domain';
import { faIR } from './locales/fa-IR';
import { enUS } from './locales/en-US';
import { ar } from './locales/ar';
import { ru } from './locales/ru';

/**
 * Locale dictionaries share the same message keys while allowing each locale
 * to provide different string values. Inferring values as string literals
 * would incorrectly reject valid translations at compile time.
 */
export type PayMessages = {
  readonly [K in keyof typeof faIR]: string;
};

export const PAY_LOCALES: readonly PayLocale[] = ['fa-IR', 'en-US', 'ar', 'ru'];

export const PAY_MESSAGES: Record<PayLocale, PayMessages> = {
  'fa-IR': faIR,
  'en-US': enUS,
  ar,
  ru,
};

export function getPayDirection(locale: PayLocale): Direction {
  return locale === 'fa-IR' || locale === 'ar' ? 'rtl' : 'ltr';
}

export function resolvePayLocale(value: string | null | undefined, fallback: PayLocale = 'fa-IR'): PayLocale {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'fa' || normalized === 'fa-ir' || normalized.startsWith('fa-')) return 'fa-IR';
  if (normalized === 'en' || normalized === 'en-us' || normalized.startsWith('en-')) return 'en-US';
  if (normalized === 'ar' || normalized.startsWith('ar-')) return 'ar';
  if (normalized === 'ru' || normalized.startsWith('ru-')) return 'ru';
  return fallback;
}

export function createPayTranslator(locale: PayLocale) {
  const messages = PAY_MESSAGES[locale];
  return (key: keyof PayMessages): string => messages[key] || PAY_MESSAGES['fa-IR'][key] || String(key);
}
