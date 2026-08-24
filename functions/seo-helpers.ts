export type ArticleLocale = {
  lang: 'fa' | 'en';
  dir: 'rtl' | 'ltr';
  schemaLanguage: 'fa-IR' | 'en-US';
  ogLocale: 'fa_IR' | 'en_US';
};

/**
 * Detect the dominant writing system of article content.
 * This is intentionally conservative: Persian is selected only when there is
 * meaningful Persian-script content and it clearly dominates Latin text.
 */
export function detectArticleLocale(input: {
  title?: string | null;
  summary?: string | null;
  content?: string | null;
}): ArticleLocale {
  const text = [input.title, input.summary, input.content].filter(Boolean).join(' ');
  const persianCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;

  const isPersian = persianCount >= 20 && persianCount >= latinCount * 0.2;

  return isPersian
    ? { lang: 'fa', dir: 'rtl', schemaLanguage: 'fa-IR', ogLocale: 'fa_IR' }
    : { lang: 'en', dir: 'ltr', schemaLanguage: 'en-US', ogLocale: 'en_US' };
}
