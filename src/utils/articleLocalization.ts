import type { Article } from '../types';

export type ArticleLocale = 'fa' | 'en';

export type LocalizedArticle = Article & {
  language?: ArticleLocale;
  translationGroupId?: string | null;
};

export function isLocalizedArticle(value: unknown): value is LocalizedArticle {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.slug === 'string' && (!item.language || item.language === 'fa' || item.language === 'en');
}

export function getArticleLocale(article: LocalizedArticle): ArticleLocale {
  return article.language === 'en' ? 'en' : 'fa';
}

export function getArticleTranslationPath(article: LocalizedArticle, locale: ArticleLocale): string {
  const base = `/article/${encodeURIComponent(article.slug)}`;
  return locale === 'en' ? `/en${base}` : base;
}

export function getArticleTranslationGroup(article: LocalizedArticle): string | null {
  return article.translationGroupId || article.id || null;
}
