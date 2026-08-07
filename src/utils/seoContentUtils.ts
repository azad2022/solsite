/**
 * Production SEO helpers for article creation.
 *
 * These helpers are deterministic and run locally in the CMS. They do not depend
 * on an AI provider, so article URLs and taxonomy remain available even when
 * DeepSeek is unavailable.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const LATIN_DIGITS = '0123456789';

const PERSIAN_STOPWORDS = new Set([
  'از','به','در','با','برای','را','و','یا','که','این','آن','یک','های','هایش','هم','اما','اگر','تا','بر','روی','پس','همه',
  'هر','چه','چگونه','چیست','چرا','کدام','درباره','مورد','می','شود','شد','شده','است','هست','هستند','بود','باشد','کرد',
  'کردن','کرده','کنید','کنیم','کنند','تواند','توانید','توان','باید','نیز','همچنین','فقط','بسیار','بیشتر','کمتر','بدون',
  'توسط','جهت','نحوه','روش','راه','راهنمای','آموزش','بررسی','معرفی','کامل','جامع','مهم','نکات','نکته','مقاله','موضوع',
  'استفاده','کاربرد','آشنایی','بهترین','جدید','جدیدترین','اولین','دومین','سومین','گزینه','دلیل','دلایل','توضیح','توضیحات'
]);

const ENGLISH_STOPWORDS = new Set([
  'the','a','an','and','or','for','to','of','in','on','with','from','by','is','are','was','were','be','this','that',
  'these','those','how','why','what','which','guide','complete','best','new','latest','article','introduction','using'
]);

const PERSIAN_TO_LATIN: Record<string, string> = {
  'ا':'a','آ':'a','أ':'a','إ':'e','ب':'b','پ':'p','ت':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh','د':'d','ذ':'z',
  'ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'gh',
  'ک':'k','ك':'k','گ':'g','ل':'l','م':'m','ن':'n','و':'v','ؤ':'v','ه':'h','ۀ':'e','ة':'h','ی':'y','ي':'y','ئ':'y',
  'ء':'','َ':'','ِ':'','ُ':'','ّ':'','ْ':'','ً':'','ٌ':'','ٍ':'','ـ':'','ٔ':'','ٕ':''
};

const normalizePersian = (value: string): string => value
  .normalize('NFKC')
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/ۀ/g, 'ه')
  .replace(/[\u200c\u200f\u200e]/g, ' ')
  .replace(/[۰-۹]/g, d => LATIN_DIGITS[PERSIAN_DIGITS.indexOf(d)])
  .replace(/[\u064B-\u065F\u0670]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const transliterateToken = (token: string): string => {
  let result = '';
  for (const char of token) {
    if (PERSIAN_TO_LATIN[char] !== undefined) result += PERSIAN_TO_LATIN[char];
    else if (/[A-Za-z0-9]/.test(char)) result += char.toLowerCase();
  }
  return result;
};

/** Generate a stable, ASCII, shareable SEO slug from a Persian/English title. */
export function generateSeoSlug(title: string): string {
  const normalized = normalizePersian(title)
    .replace(/^(مقاله\s*سئو\s*شده|آموزش\s*سئو\s*شده|عنوان\s*سئو\s*شده|سئو\s*شده|مقاله|آموزش|عنوان)\s*[:：\-–—]?\s*/i, '')
    .replace(/deepseek|دیپ\s*سیک|دیپ‌سیک|هوش\s*مصنوعی/gi, ' ')
    .replace(/[؟?!،,:;؛()[\]{}"“”'«»/\\|]+/g, ' ');

  const words = normalized
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean)
    .filter(word => !PERSIAN_STOPWORDS.has(word) && !ENGLISH_STOPWORDS.has(word.toLowerCase()));

  const slugWords = words.map(transliterateToken).filter(Boolean);
  let slug = slugWords.join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  // Keep URLs compact without cutting a token in half.
  if (slug.length > 72) {
    const compact: string[] = [];
    let length = 0;
    for (const word of slug.split('-')) {
      const nextLength = length === 0 ? word.length : length + 1 + word.length;
      if (nextLength > 72) break;
      compact.push(word);
      length = nextLength;
    }
    slug = compact.join('-');
  }

  return slug || `article-${Date.now()}`;
}

const tokenize = (value: string): string[] => normalizePersian(value)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
  .split(/[\s_-]+/)
  .map(w => w.trim())
  .filter(w => w.length >= 2)
  .filter(w => !PERSIAN_STOPWORDS.has(w) && !ENGLISH_STOPWORDS.has(w));

/**
 * Deterministically extracts topical tags from title + summary + body.
 * Title terms receive more weight, while repeated body phrases are promoted.
 */
export function extractArticleKeywords(
  title: string,
  content: string,
  summary = '',
  category = ''
): string[] {
  const sections = [
    { text: title, weight: 5 },
    { text: summary, weight: 3 },
    { text: category, weight: 3 },
    { text: content, weight: 1 }
  ];

  const scores = new Map<string, number>();
  const display = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const section of sections) {
    const tokens = tokenize(section.text);
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
      scores.set(token, (scores.get(token) || 0) + section.weight);
      if (!display.has(token)) display.set(token, token);
    }

    // Promote meaningful two-word concepts such as «کیف پول» and «ساخت توکن».
    for (let i = 0; i < tokens.length - 1; i++) {
      const phrase = `${tokens[i]} ${tokens[i + 1]}`;
      if (tokens[i].length < 3 || tokens[i + 1].length < 3) continue;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
      scores.set(phrase, (scores.get(phrase) || 0) + section.weight * 1.6);
      if (!display.has(phrase)) display.set(phrase, phrase);
    }
  }

  const candidates = Array.from(scores.entries())
    .filter(([term]) => term.length >= 3)
    .map(([term, score]) => ({ term, score, count: counts.get(term) || 0 }))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.term.localeCompare(b.term));

  const selected: string[] = [];
  const selectedTokens = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= 8) break;
    const words = candidate.term.split(' ');
    // Avoid filling all tags with near-duplicates of the same single word.
    if (words.length === 1 && selectedTokens.has(candidate.term)) continue;
    if (words.length === 1 && candidate.count < 2 && !tokenize(title).includes(candidate.term)) continue;

    const overlaps = words.filter(word => selectedTokens.has(word)).length;
    if (words.length > 1 && overlaps === words.length) continue;

    selected.push(display.get(candidate.term) || candidate.term);
    words.forEach(word => selectedTokens.add(word));
  }

  return selected.slice(0, 8);
}
