const CHAR_MAP: Record<string, string> = {
  'ا':'a','آ':'a','أ':'a','إ':'i','ء':'','ئ':'y','ب':'b','پ':'p','ت':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh',
  'د':'d','ذ':'z','ر':'r','ڕ':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a','غ':'gh',
  'ف':'f','ڤ':'v','ق':'q','ک':'k','ك':'k','گ':'g','ل':'l','ڵ':'l','م':'m','ن':'n','ه':'h','ە':'e','و':'v','ۆ':'o',
  'ؤ':'v','ی':'y','ى':'y','ێ':'e','ي':'y','ة':'h','ـ':'','ۀ':'h',
};

function transliterate(value: string): string {
  return Array.from(value).map((char) => CHAR_MAP[char] ?? char).join('');
}

export function slugifyMerchantName(value: string): string {
  const normalized = transliterate(value.trim().normalize('NFKD')).replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
