/**
 * SEO-safe article slug utilities.
 *
 * URLs are deliberately ASCII, lowercase and stable-friendly. Persian titles are
 * transliterated so public URLs remain readable, shareable and easy to type.
 */

const PERSIAN_TO_LATIN: Record<string, string> = {
  'ا':'a','آ':'a','أ':'a','إ':'e','ب':'b','پ':'p','ت':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh','د':'d','ذ':'z',
  'ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'gh',
  'ک':'k','ك':'k','گ':'g','ل':'l','م':'m','ن':'n','و':'v','ؤ':'v','ه':'h','ۀ':'h','ة':'h','ی':'y','ي':'y','ئ':'y','ء':'a'
};

const STOPWORDS = new Set([
  'از','به','در','با','برای','را','و','یا','که','این','آن','یک','های','هم','اما','اگر','تا','بر','روی','هر','چه',
  'چگونه','چیست','کدام','درباره','مورد','می','شود','شد','شده','است','هست','هستند','بود','باشد','کرد','کردن','کرده',
  'کنید','کنیم','کنند','تواند','توانید','توان','باید','نیز','همچنین','فقط','بسیار','بیشتر','کمتر','بدون','توسط',
  'جهت','نحوه','روش','راه','راهنمای','آموزش','بررسی','معرفی','کامل','جامع','مهم','نکات','نکته','مقاله','موضوع',
  'استفاده','کاربرد','آشنایی','بهترین','جدید','جدیدترین','اولین','گزینه'
]);

function transliterate(value: string): string {
  return value.split('').map(char => {
    if (PERSIAN_TO_LATIN[char] !== undefined) return PERSIAN_TO_LATIN[char];
    if (/[A-Za-z0-9]/.test(char)) return char.toLowerCase();
    return char;
  }).join('');
}

/** Generate a canonical ASCII slug from a Persian or English article title. */
export function generateSlugFromTitle(title: string): string {
  if (!title || !title.trim()) return `article-${Date.now()}`;

  let clean = title
    .trim()
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/^(مقاله\s*سئو\s*شده|آموزش\s*سئو\s*شده|عنوان\s*سئو\s*شده|سئو\s*شده|مقاله|آموزش|عنوان)\s*[:：\-–—]?\s*/i, '')
    .replace(/deepseek|دیپ\s*سیک|دیپ‌سیک|هوش\s*مصنوعی/gi, ' ')
    .replace(/[؟?!،,:;؛()[\]{}"“”'«»/\\|]+/g, ' ');

  const words = clean.split(/\s+/)
    .map(word => word.trim())
    .filter(Boolean)
    .filter(word => !STOPWORDS.has(word) && !STOPWORDS.has(word.toLowerCase()));

  let slug = transliterate(words.join(' '))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Keep public URLs compact; never cut a word in half.
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
