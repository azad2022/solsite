/**
 * Deterministic SEO helpers for article creation.
 *
 * These helpers are deliberately provider-independent. They are suitable as a
 * CMS suggestion layer and as a safety net when an AI provider is unavailable.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const LATIN_DIGITS = '0123456789';

const PERSIAN_STOPWORDS = new Set([
  'از','به','در','با','برای','را','و','یا','که','این','آن','یک','های','هم','اما','اگر','تا','بر','روی','هر',
  'چه','چگونه','چیست','کدام','درباره','مورد','می','شود','شد','شده','است','هست','هستند','بود','باشد','کرد',
  'کردن','کرده','کنید','کنیم','کنند','تواند','توانید','توان','باید','نیز','همچنین','فقط','بسیار','بیشتر','کمتر',
  'بدون','توسط','جهت','نحوه','روش','راه','مقاله','موضوع','راهنما','آموزش','بررسی','معرفی','کامل','جامع','مهم',
  'نکات','نکته','استفاده','کاربرد','آشنایی'
]);

const ENGLISH_STOPWORDS = new Set([
  'the','a','an','and','or','for','to','of','in','on','with','from','by','is','are','was','were','be','this',
  'that','these','those','how','why','what','which','guide','complete','article','introduction','using'
]);

const normalizePersian = (value: string): string => value
  .normalize('NFKC')
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[ۀة]/g, 'ه')
  .replace(/[\u200c\u200f\u200e]/g, ' ')
  .replace(/[۰-۹]/g, d => LATIN_DIGITS[PERSIAN_DIGITS.indexOf(d)])
  .replace(/[\u064B-\u065F\u0670]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenize = (value: string): string[] => normalizePersian(value)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
  .split(/[\s_-]+/)
  .map(w => w.trim())
  .filter(w => w.length >= 3)
  .filter(w => !PERSIAN_STOPWORDS.has(w) && !ENGLISH_STOPWORDS.has(w));

const isUsefulSingleWord = (term: string): boolean => {
  // Very short generic Persian words tend to create poor taxonomy pages.
  if (term.length < 4) return false;
  return !new Set(['سولمینت','کریپتو','وب۳','web3','crypto']).has(term);
};

/**
 * Extract up to eight topical tags from title, summary, category and body.
 * Title and summary receive higher weights; meaningful two-word phrases are
 * promoted over isolated generic words. Explicit CMS tags can be merged by the caller.
 */
export function extractArticleKeywords(
  title: string,
  content: string,
  summary = '',
  category = ''
): string[] {
  const sections = [
    { text: title, weight: 6 },
    { text: summary, weight: 4 },
    { text: category, weight: 3 },
    { text: content, weight: 1 }
  ];

  const scores = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const section of sections) {
    const tokens = tokenize(section.text);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      scores.set(token, (scores.get(token) || 0) + section.weight);
      counts.set(token, (counts.get(token) || 0) + 1);

      if (i < tokens.length - 1) {
        const next = tokens[i + 1];
        if (isUsefulSingleWord(token) && isUsefulSingleWord(next)) {
          const phrase = `${token} ${next}`;
          scores.set(phrase, (scores.get(phrase) || 0) + section.weight * 2.2);
          counts.set(phrase, (counts.get(phrase) || 0) + 1);
        }
      }
    }
  }

  const candidates = Array.from(scores.entries())
    .map(([term, score]) => ({ term, score, count: counts.get(term) || 0 }))
    .filter(candidate => candidate.term.includes(' ') || isUsefulSingleWord(candidate.term))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.term.localeCompare(b.term));

  const selected: string[] = [];
  const covered = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= 8) break;

    const words = candidate.term.split(' ');
    if (words.length === 1 && candidate.count < 2 && !tokenize(title).includes(candidate.term)) continue;

    // Do not fill the taxonomy with phrases that are merely repetitions of a
    // phrase already selected.
    const overlap = words.filter(word => covered.has(word)).length;
    if (words.length > 1 && overlap === words.length) continue;

    selected.push(candidate.term);
    words.forEach(word => covered.add(word));
  }

  return selected;
}
