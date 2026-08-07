/**
 * Production-safe article slug utilities.
 *
 * Goals:
 * - stable, lowercase ASCII URLs
 * - preserve meaningful topic words instead of deleting semantic terms
 * - support Persian, English, acronyms and numbers
 * - avoid punctuation, duplicate separators and trailing separators
 * - keep URLs compact without cutting a token in half
 *
 * Uniqueness is enforced server-side/database-side; this helper deliberately
 * remains deterministic so changing the UI cannot silently change an existing URL.
 */

const PERSIAN_TO_LATIN: Record<string, string> = {
  'ا':'a','آ':'a','أ':'a','إ':'e','ب':'b','پ':'p','ت':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh',
  'د':'d','ذ':'z','ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a',
  'غ':'gh','ف':'f','ق':'q','ک':'k','ك':'k','گ':'g','ل':'l','م':'m','ن':'n','و':'v','ؤ':'v','ه':'h',
  'ۀ':'h','ة':'h','ی':'y','ي':'y','ئ':'y','ء':''
};

// Only grammatical stopwords are removed. Semantic terms such as «بهترین»
// or «هوش مصنوعی» must remain available to describe the page accurately.
const STOPWORDS = new Set([
  'از','به','در','با','برای','را','و','یا','که','این','آن','یک','های','هم','اما','اگر','تا','بر','روی','هر',
  'چه','چگونه','چیست','کدام','درباره','مورد','می','شود','شد','شده','است','هست','هستند','بود','باشد',
  'کرد','کردن','کرده','کنید','کنیم','کنند','تواند','توانید','توان','باید','نیز','همچنین','فقط','بسیار',
  'بیشتر','کمتر','بدون','توسط','جهت','نحوه','روش','راه','the','a','an','and','or','for','to','of','in',
  'on','with','from','by','is','are','was','were','be','this','that'
]);

function normalizePersian(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function transliterate(value: string): string {
  return value.split('').map(char => {
    if (PERSIAN_TO_LATIN[char] !== undefined) return PERSIAN_TO_LATIN[char];
    if (/[A-Za-z0-9]/.test(char)) return char.toLowerCase();
    return char;
  }).join('');
}

/** Generate a stable canonical ASCII slug from a Persian or English title/slug. */
export function generateSlugFromTitle(title: string): string {
  const raw = normalizePersian(String(title || ''));
  if (!raw) return `article-${Date.now()}`;

  const clean = raw
    .replace(/^[#>*_\s]+/, '')
    .replace(/[؟?!،,:;؛()[\]{}"“”'«»/\\|]+/g, ' ')
    .replace(/[–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => !STOPWORDS.has(word) && !STOPWORDS.has(word.toLowerCase()));

  let slug = transliterate(words.join(' '))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Keep public URLs compact without cutting the final token in half.
  if (slug.length > 72) {
    const parts = slug.split('-');
    const kept: string[] = [];
    let length = 0;
    for (const part of parts) {
      const next = length === 0 ? part.length : length + part.length + 1;
      if (next > 72) break;
      kept.push(part);
      length = next;
    }
    slug = kept.join('-');
  }

  return slug || `article-${Date.now()}`;
}

export const DEFAULT_ARTICLE_AUTHOR = {
  name: 'تیم تحریریه سول‌مینت',
  role: 'تحلیل‌گر ارشد وب۳ و کریپتو',
  avatar: '/avatars/editor.svg'
};
