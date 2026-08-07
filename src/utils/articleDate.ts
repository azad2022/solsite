const PERSIAN_DATE_LOCALE = 'fa-IR-u-ca-persian';

/**
 * Returns a stable, human-readable Persian calendar date for article UI.
 * Database records may contain an empty Jalali field while published_at is an
 * ISO timestamp (for example, 2026-08-05T08:41:46.755Z). Never expose that
 * machine timestamp directly to readers.
 */
export function formatArticleDisplayDate(article: {
  publishedAtJalali?: string | null;
  publishedAtGregorian?: string | null;
  publishedAt?: string | null;
}): string {
  const jalali = article.publishedAtJalali?.trim();
  if (jalali) return jalali;

  const candidates = [article.publishedAtGregorian, article.publishedAt];
  for (const raw of candidates) {
    if (!raw) continue;
    const value = raw.trim();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(parsed);
    }
  }

  // Preserve a legacy Jalali value such as "1405/05/13 (2026/08/04)"
  // without ever manufacturing or exposing an ISO timestamp.
  const legacy = article.publishedAt?.trim();
  if (legacy) {
    const match = legacy.match(/^(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (match) return match[1];
  }

  return 'تاریخ انتشار نامشخص';
}

/**
 * Supplies a machine-readable ISO date for semantic HTML without displaying
 * the raw timestamp to users.
 */
export function getArticleDateTime(article: {
  publishedAtGregorian?: string | null;
  publishedAt?: string | null;
}): string | undefined {
  const raw = article.publishedAtGregorian?.trim() || article.publishedAt?.trim();
  if (!raw) return undefined;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
