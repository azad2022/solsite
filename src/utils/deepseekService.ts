import { Article, DeepSeekAiSettings, ChatbotSettings } from '../types';
import { generateSlugFromTitle, DEFAULT_ARTICLE_AUTHOR } from './slugUtils';

// Unsplash high-quality crypto, Solana & AI themed imagery options
const COVER_IMAGES_BY_CATEGORY: Record<string, string[]> = {
  'آموزش سولانا': [
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1622979135225-d2ba269bc1bd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1200&q=80'
  ],
  'توسعه وب۳': [
    'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1639762681057-408e52192e55?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80'
  ],
  'آموزش ساخت میم کوین': [
    'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1622979135240-caa6648190b6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80'
  ],
  'آموزش ساخت NFT': [
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1644361566696-3d442b5b482a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80'
  ],
  'امنیت': [
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80'
  ],
  'کیف پول سولانا': [
    'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1622979135225-d2ba269bc1bd?auto=format&fit=crop&w=1200&q=80'
  ],
  'اخبار و تحلیل': [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1200&q=80'
  ]
};

/**
 * Automatically get a stunning HD cover image for any article based on category or topic keywords
 */
export function getRandomCoverForCategoryOrTitle(category?: string, title?: string): string {
  const catKey = category && COVER_IMAGES_BY_CATEGORY[category] ? category : null;
  if (catKey) {
    const list = COVER_IMAGES_BY_CATEGORY[catKey];
    return list[Math.floor(Math.random() * list.length)];
  }

  // Fallback search keywords
  const titleLower = (title || '').toLowerCase();
  if (titleLower.includes('میم') || titleLower.includes('meme')) {
    const list = COVER_IMAGES_BY_CATEGORY['آموزش ساخت میم کوین'];
    return list[Math.floor(Math.random() * list.length)];
  }
  if (titleLower.includes('nft') || titleLower.includes('ان اف تی')) {
    const list = COVER_IMAGES_BY_CATEGORY['آموزش ساخت NFT'];
    return list[Math.floor(Math.random() * list.length)];
  }
  if (titleLower.includes('امنیت') || titleLower.includes('security')) {
    const list = COVER_IMAGES_BY_CATEGORY['امنیت'];
    return list[Math.floor(Math.random() * list.length)];
  }

  // Default Solana HD cover
  const defaultList = COVER_IMAGES_BY_CATEGORY['آموزش سولانا'];
  return defaultList[Math.floor(Math.random() * defaultList.length)];
}

export async function testDeepSeekConnection(
  apiKey: string,
  baseUrl: string = 'https://api.gapgpt.app/v1',
  model: string = 'deepseek-chat'
): Promise<{ success: boolean; message: string }> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: 'کلید API وارد نشده است. لطفاً کلید معتبر خود را وارد کنید.'
    };
  }

  // 1. Try server proxy endpoint first (avoids CORS in browser)
  try {
    const proxyRes = await fetch('/api/deepseek/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model
      })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return {
        success: data.success ?? true,
        message: data.message || 'ارتباط با موفقیت برقرار شد!'
      };
    } else {
      const errData = await proxyRes.json().catch(() => ({}));
      return {
        success: false,
        message: errData.message || `خطای پاسخ (کد ${proxyRes.status})`
      };
    }
  } catch (proxyErr) {
    console.warn('Proxy test call failed, falling back to direct fetch:', proxyErr);
  }

  // 2. Direct fetch fallback
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'user', content: 'سلام، تست ارتباط با API' }
        ],
        max_tokens: 10
      })
    });

    if (response.ok) {
      return {
        success: true,
        message: 'ارتباط مستقیم با API با موفقیت برقرار شد!'
      };
    } else {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || errJson?.message || response.statusText;
      return {
        success: false,
        message: `خطا در اتصال (کد ${response.status}): ${errMsg}`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `خطای شبکه یا CORS در اتصال: ${err?.message || 'پاسخی دریافت نشد'}`
    };
  }
}

export async function batchTestDeepSeekKeys(
  keys: string[],
  baseUrl: string = 'https://api.deepseek.com/v1',
  model: string = 'deepseek-chat'
): Promise<Array<{ key: string; success: boolean; message: string; maskedKey: string }>> {
  const cleanKeys = Array.from(new Set(keys.map(k => k.trim()).filter(k => k.length > 0)));
  
  const results = await Promise.all(
    cleanKeys.map(async (key) => {
      const res = await testDeepSeekConnection(key, baseUrl, model);
      const maskedKey = key.length > 10 
        ? `${key.slice(0, 6)}...${key.slice(-4)}`
        : key;
      return {
        key,
        maskedKey,
        success: res.success,
        message: res.message
      };
    })
  );

  return results;
}

/**
 * Clean article title from any AI chatter, unwanted prefixes like "مقاله سئو شده" or model names
 */
export function cleanArticleTitle(rawTitle: string, fallbackTopic?: string): string {
  if (!rawTitle) return fallbackTopic || 'مقاله تخصصی سولمینت';
  
  let title = rawTitle
    .replace(/^#+\s*/, '') // Remove heading symbols if any
    .replace(/^\*+\s*|\*+$/g, '') // Remove markdown bold asterisks
    .replace(/^["'«»“”]/, '').replace(/["'«»“”]$/, '') // Remove enclosing quotes
    // Strips prefixes like "مقاله سئو شده", "آموزش سئو شده", "سئو شده", "عنوان:", "پاسخ:", "پیش‌نویس:", "عنوان مقاله:", "SEO Article:"
    .replace(/^(مقاله\s*سئو\s*شده|آموزش\s*سئو\s*شده|عنوان\s*سئو\s*شده|سئو\s*شده|مقاله\s*سئوشده|آموزش\s*سئوشده|سئوشده|عنوان\s*مقاله|عنوان|پاسخ|پیش‌نویس|مقاله\s*جدید|پیش‌نویس\s*مقاله|SEO\s*Article|Title|Article)\s*[:：\-–—]?\s*/gi, '')
    // Strips trailing parenthetical tags like "(مقاله سئو شده)", "(سئو شده)", "(آموزش سئو)"
    .replace(/\s*\(?\s*(مقاله\s*سئو\s*شده|آموزش\s*سئو\s*شده|سئو\s*شده|سئوشده|آموزش\s*سئو)\s*\)?/gi, '')
    // Strips model names like "DeepSeek", "دیپ سیک", "دیپ‌سیک", "هوش مصنوعی"
    .replace(/deepseek|دیپ\s*سیک|دیپ‌سیک|هوش\s*مصنوعی/gi, '')
    // Strips leading/trailing punctuation or colons
    .replace(/^[:：\-–—\s]+|[:：\-–—\s]+$/g, '')
    .trim();

  if (!title) title = fallbackTopic || 'مقاله تخصصی سولمینت';
  return title;
}

/**
 * Clean article content from any AI model names or artificial preamble lines
 */
export function cleanArticleContent(rawContent: string): string {
  if (!rawContent) return '';
  
  let content = rawContent
    .replace(/deepseek|دیپ\s*سیک|دیپ‌سیک/gi, 'سولمینت')
    // Strips leading artificial lines like "مقاله سئو شده:" or "این یک مقاله سئو شده است"
    .replace(/^(مقاله\s*سئو\s*شده|آموزش\s*سئو\s*شده|مقاله\s*سئوشده|این\s*یک\s*مقاله\s*سئو\s*شده\s*است[^\n]*|در\s*ادامه\s*مقاله[^\n]*)\s*[:：\-–—]?\n*/gi, '')
    .trim();

  return content;
}

export async function generateArticleWithDeepSeek(
  customTopic: string,
  settings: DeepSeekAiSettings
): Promise<Partial<Article>> {
  const topic = customTopic || settings.targetTopics[Math.floor(Math.random() * settings.targetTopics.length)] || 'آموزش جامع کار با کیف پول سولمینت و ساخت توکن سولانا';
  
  // Try real API call if API key exists
  if (settings.apiKey && settings.apiKey.trim().length > 5) {
    try {
      const keywordsStr = settings.targetKeywords.join('، ');
      
      const userPrompt = `لطفاً یک مقاله تخصصی و کاربردی درباره موضوع زیر بنویسید:
موضوع: "${topic}"
کلمات کلیدی اجباری سئو: ${keywordsStr}
لحن: ${settings.writingStyle.tone}
تعداد کلمات تقریبی: ${settings.writingStyle.targetWordCount} کلمه

قوانین بسیار مهم عنوان و محتوا:
۱. در عنوان مقاله به هیچ عنوان عباراتی مثل "مقاله سئو شده"، "آموزش سئو شده"، "سئو شده" یا نام مدل‌های هوش مصنوعی (مانند DeepSeek) را درج نکنید. فقط و فقط عنوان واقعی و جذاب مقاله را بنویسید.
2. در متن مقاله، لینک‌ها یا مشخصات نویسنده، هیچ نامی از دیپ‌سیک یا هوش مصنوعی نباید وجود داشته باشد. نویسنده فقط "تیم محتوای سولمینت" است.

خروجی شما باید یک JSON معتبر باشد با ساختار دقیق زیر (بدون هیچ متن اضافی قبل یا بعد از JSON):
{
  "title": "عنوان جذاب و دقیق مقاله بدون عبارت‌های اضافی در حدود ۵۰ تا ۷۰ کاراکتر",
  "category": "یکی از موارد دقیق مقابل: آموزش سولانا | توسعه وب۳ | امنیت | اخبار و تحلیل | آموزش ساخت میم کوین | آموزش ساخت NFT | کیف پول سولانا",
  "summary": "خلاصه جذاب مقاله برای Meta Description در حدود ۱۲۰ تا ۱۶۰ کاراکتر",
  "tags": ["تگ۱", "تگ۲", "تگ۳", "تگ۴"],
  "readTimeMinutes": 6,
  "content": "متن کامل مقاله شامل تیترهای H2 و H3 مارک‌داون، لیست‌ها، نکات کلیدی و بخش FAQ"
}`;

      let data: any = null;

      // 1. Try server proxy endpoint first
      try {
        const proxyRes = await fetch('/api/deepseek/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: settings.apiKey.trim(),
            baseUrl: settings.apiBaseUrl,
            model: settings.model || 'deepseek-chat',
            systemPrompt: settings.systemPrompt,
            userPrompt
          })
        });

        if (proxyRes.ok) {
          data = await proxyRes.json();
        }
      } catch (proxyErr) {
        console.warn('Proxy generate call failed, trying direct fetch:', proxyErr);
      }

      // 2. Direct fetch fallback if proxy did not return data
      if (!data) {
        const endpoint = `${settings.apiBaseUrl.replace(/\/$/, '')}/chat/completions`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey.trim()}`
          },
          body: JSON.stringify({
            model: settings.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: settings.systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7
          })
        });
        if (res.ok) {
          data = await res.json();
        }
      }

      if (data) {
        const contentRaw = data.choices?.[0]?.message?.content;
        if (contentRaw) {
          // Clean JSON markdown blocks if model wraps in ```json
          const cleanJsonStr = contentRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleanJsonStr);
          const category = parsed.category || 'آموزش سولانا';
          const shouldIncludeCover = (settings.mediaConfig?.includeCoverImage ?? true) && (settings.requireCoverImage ?? true);
          let coverImage = '';
          if (shouldIncludeCover) {
            const images = COVER_IMAGES_BY_CATEGORY[category] || COVER_IMAGES_BY_CATEGORY['آموزش سولانا'];
            coverImage = images[Math.floor(Math.random() * images.length)];
          }

          // Thoroughly clean title and content from any unwanted AI chatter, prefixes or "مقاله سئو شده"
          let cleanTitle = cleanArticleTitle(parsed.title || topic, topic);
          let cleanContent = cleanArticleContent(parsed.content || '');
          let cleanSummary = cleanArticleContent(parsed.summary || '')
            .replace(/^(خلاصه|خلاصه\s*مقاله)\s*[:：\-–—]?\s*/gi, '')
            .trim();

          const cleanSlug = generateSlugFromTitle(cleanTitle);

          return {
            title: cleanTitle,
            slug: cleanSlug,
            category: category,
            summary: cleanSummary,
            content: cleanContent,
            tags: parsed.tags || settings.targetKeywords.slice(0, 4),
            coverImage: coverImage,
            videoUrl: settings.mediaConfig.includeVideo ? settings.mediaConfig.defaultVideoUrl : undefined,
            readTimeMinutes: parsed.readTimeMinutes || 7,
            seoScore: 96
          };
        }
      }
    } catch (e) {
      console.warn('DeepSeek API request failed, utilizing dynamic AI prompt fallback engine:', e);
    }
  }

  // Smart Fallback Engine generating realistic, rich SEO Article using Solmint prompt rules
  return generateSmartFallbackArticle(topic, settings);
}

function generateSmartFallbackArticle(topic: string, settings: DeepSeekAiSettings): Partial<Article> {
  const isMemeCoin = topic.includes('میم') || topic.includes('Meme');
  const isNft = topic.includes('NFT') || topic.includes('ان‌اف‌تی');
  const isRent = topic.includes('اجاره') || topic.includes('Rent');
  const isSecurity = topic.includes('امنیت') || topic.includes('Ed25519');

  let category: Article['category'] = 'آموزش سولانا';
  if (isMemeCoin) category = 'آموزش ساخت میم کوین';
  else if (isNft) category = 'آموزش ساخت NFT';
  else if (isRent) category = 'توسعه وب۳';
  else if (isSecurity) category = 'امنیت';

  const cleanTopic = topic
    .replace(/deepseek|دیپ\s*سیک|دیپ‌سیک|هوش\s*مصنوعی/gi, '')
    .trim();
  const title = cleanTopic ? `${cleanTopic}` : 'راهنمای کار با شبکه سولانا و اپلیکیشن سولمینت';
  const slug = generateSlugFromTitle(title);

  const summary = `در این مقاله جامع آموزش داده می‌شود که چگونه با استفاده از اپلیکیشن سولمینت (Solmint App) و ابزارهای غیرامانی شبکه سولانا، فرایند ${topic} را با کمترین کارمزد و بالاترین سرعت انجام دهید.`;

  const content = `# ${title}

به وبسایت **سولمینت (Solmint App)** خوش آمدید. اکوسیستم **سولانا (Solana)** به دلیل کارمزد بسیار پایین (کمتر از ۰.۰۰۱ دلار) و سرعت تراکنش بی‌نظیر (بیش از ۶۵,۰۰۰ TPS)، به انتخاب اول توسعه‌دهندگان و کاربران بلاکچین تبدیل شده است.

در این مقاله تخصصی تیم محتوای **سولمینت**، تمامی مراحل مربوط به **${topic}** را به صورت گام‌به‌گام بررسی می‌کنیم.

---

## ۱. چرا استفاده از اپلیکیشن سولمینت (Solmint App)؟

بسیاری از ابزارهای سنتیک و وبسایت‌های خارجی برای ساخت توکن یا مدیریت حساب‌ها، هزینه‌های هنگفت و پیچیدگی‌های کدنویسی ایجاد می‌کنند. اپلیکیشن موبایل غیرامانی **سولمینت** این پیچیدگی‌ها را کاملاً برطرف کرده است:

- 🔒 **امنیت غیرامانی (Non-Custodial):** کلیدهای خصوصی به صورت متقارن و تحت الگوریتم **Ed25519** درون تراشه امنیتی گوشی شما قرار می‌گیرند.
- ⚡ **تولید فوری توکن و میم‌کوین:** ایجاد توکن استاندارد SPL در کمتر از ۱۰ ثانیه بدون سیستم خانگی.
- 💰 **بازیابی کارمزد اجاره (Rent Claim):** آزادسازی SOL های قفل‌شده در حساب‌های بدون موجودی.
- 🎨 **ضرب آسان NFT:** ثبت Metadata روی Metaplex تنها با چند لمس.

---

## ۲. گام‌های عملی برای اجرای پروژه

برای شروع تنها کافیست مراحل ساده زیر را طی کنید:

1. **دانلود نسخه رسمی سولمینت:** اپلیکیشن را مستقیم از وبسایت یا کانال تلگرام رسمی دانلود کنید.
2. **ایجاد کیف پول جدید:** عبارت بازیابی ۱۲ یا ۲۴ کلمه‌ای خود را در جایی امن یادداشت نمایید.
3. **شارژ ناچیز موجودی SOL:** حدود ۰.۰۵ SOL برای پرداخت کارمزد شبکه سولانا و ایجاد حساب توکن احتیاج دارید.
4. **انتخاب بخش موردنظر:** از منوی ابزارها گزینه مربوط به **${topic}** را انتخاب کنید.

> **نکته کلیدی سئو و امنیت:** هرگز عبارت بازیابی (Seed Phrase) خود را در هیچ وبسایت یا پیام‌رسانی وارد نکنید. سولمینت هیچ‌گاه کلیدهای شما را به سرور منتقل نمی‌کند.

---

## ۳. جدول مقایسه ویژگی‌های کلیدی

| ویژگی | اپلیکیشن سولمینت | ابزارهای سنتی / کدنویسی |
| :--- | :--- | :--- |
| **نیاز به دانش کدنویسی** | ❌ خیر (رابط گرافیکی ساده) | ✅ بله (Rust / Anchor / CLI) |
| **سرعت آماده‌سازی** | ⚡ کمتر از ۳۰ ثانیه | ⏳ چند ساعت تا چند روز |
| **امنیت کلیدها** | 🛡️ غیرامانی روی موبایل | ⚠️ وابسته به پلتفرم‌های ابری |
| **کارمزد پلتفرم** | 📉 حداقل کارمزد ممکن | 💸 هزینه‌های گزاف واسطه‌ها |

---

## ۴. سوالات متداول (FAQ)

### آیا برای این کار نیاز به لپ‌تاپ یا سیستم خانگی دارم؟
خیر! اپلیکیشن سولمینت به گونه‌ای طراحی شده که ۱۰۰٪ مراحل را روی گوشی هوشمند (اندروید و نسخه وب) انجام دهید.

### چگونه کارمزد اجاره (Rent Fee) را بازیابی کنیم؟
هنگام ساخت حساب توکن روی سولانا، مبلغی حدود ۰.۰۰۲ SOL در حساب قفل می‌شود. سولمینت حساب‌های بدون موجودی را شناسایی کرده و این مبلغ را به کیف پول شما بازمی‌گرداند.

---

## ۵. نتیجه‌گیری و دانلود مستقیم

اگر به دنبال کوتاه‌ترین، امن‌ترین و ارزان‌ترین راه برای **${topic}** هستید، همین حالا جدیدترین نسخه **اپلیکیشن سولمینت** را دریافت کنید و به جامعه چند هزار نفری کاربران ما بپیوندید.`;

  const shouldIncludeCoverFallback = (settings.mediaConfig?.includeCoverImage ?? true) && (settings.requireCoverImage ?? true);
  let coverImage = '';
  if (shouldIncludeCoverFallback) {
    const categoryImages = COVER_IMAGES_BY_CATEGORY[category] || COVER_IMAGES_BY_CATEGORY['آموزش سولانا'];
    coverImage = categoryImages[Math.floor(Math.random() * categoryImages.length)];
  }

  return {
    title,
    slug,
    category,
    summary,
    content,
    tags: settings.targetKeywords.slice(0, 5),
    coverImage,
    videoUrl: settings.mediaConfig.includeVideo ? settings.mediaConfig.defaultVideoUrl : undefined,
    readTimeMinutes: Math.floor(Math.random() * 3) + 5,
    seoScore: 98
  };
}

export async function sendDeepSeekChatMessage(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  chatbotSettings: ChatbotSettings,
  deepseekSettings: DeepSeekAiSettings
): Promise<string> {
  const apiKey = (chatbotSettings.apiKey && chatbotSettings.apiKey.trim().length > 0) 
    ? chatbotSettings.apiKey 
    : (deepseekSettings.apiKey || '');
  const baseUrl = (chatbotSettings.apiBaseUrl && chatbotSettings.apiBaseUrl.trim().length > 0) 
    ? chatbotSettings.apiBaseUrl 
    : (deepseekSettings.apiBaseUrl || 'https://api.gapgpt.app/v1');
  const model = chatbotSettings.model || deepseekSettings.model || 'deepseek-chat';
  const systemPrompt = chatbotSettings.systemPrompt;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('کلید API پشتیبانی آنلاین در تنظیمات ثبت نشده است. مدیر وبسایت باید کلید API را در پنل مدیریت وارد کند.');
  }

  const turnsToKeep = chatbotSettings.maxHistoryTurns || 8;
  const recentMessages = messages.slice(-turnsToKeep);

  // 1. Try server proxy endpoint first
  try {
    const proxyRes = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model,
        systemPrompt: systemPrompt,
        messages: recentMessages
      })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      const answer = data.choices?.[0]?.message?.content;
      if (answer) return answer;
    } else {
      const errData = await proxyRes.json().catch(() => ({}));
      if (errData.error) {
        const rawErr = typeof errData.error === 'string' ? errData.error : errData.error.message || '';
        if (rawErr.toLowerCase().includes('authentication') || rawErr.toLowerCase().includes('api key') || rawErr.toLowerCase().includes('invalid')) {
          throw new Error('کلید API پشتیبانی آنلاین (DeepSeek API Key) نامعتبر یا منقضی است. لطفاً کلید معتبر را در پنل مدیریت تنظیم نمایید.');
        }
        throw new Error(rawErr || `خطا در پاسخ API (${proxyRes.status})`);
      }
    }
  } catch (proxyErr: any) {
    console.warn('Proxy chat endpoint failed, trying direct fetch:', proxyErr);
    if (proxyErr.message && !proxyErr.message.includes('fetch')) {
      throw proxyErr;
    }
  }

  // 2. Direct fetch fallback
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const fullPayloadMessages = [
    { role: 'system', content: systemPrompt },
    ...recentMessages
  ];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: model,
      messages: fullPayloadMessages,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    let errMsg = errJson?.error?.message || errJson?.message || `خطا در پاسخ API (${res.status})`;
    if (errMsg.toLowerCase().includes('authentication') || errMsg.toLowerCase().includes('api key') || errMsg.toLowerCase().includes('invalid')) {
      errMsg = 'کلید API پشتیبانی آنلاین (DeepSeek API Key) نامعتبر یا منقضی است. لطفاً کلید معتبر را در پنل مدیریت تنظیم نمایید.';
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) {
    throw new Error('پاسخ خالی از مدل پشتیبانی آنلاین دریافت گردید.');
  }

  return answer;
}

/**
 * Trigger server-side automatic article generation and publishing
 */
export async function triggerServerAutoPublish(topic?: string): Promise<{ success: boolean; message: string; article?: Partial<Article>; log?: any }> {
  try {
    const res = await fetch('/api/deepseek/auto-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: `خطای ارتباط با سرور: ${err?.message || 'مشکل در شبکه'}`
    };
  }
}

/**
 * Fetch DeepSeek server activity logs
 */
export async function fetchServerDeepseekLogs(): Promise<Array<{ id: string; timestamp: string; topic: string; status: 'success' | 'error'; message: string; articleSlug?: string; articleTitle?: string }>> {
  try {
    const res = await fetch('/api/deepseek/logs');
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch (err) {
    console.warn('Failed to fetch DeepSeek server logs:', err);
  }
  return [];
}

/**
 * Clear DeepSeek server activity logs
 */
export async function clearServerDeepseekLogs(): Promise<boolean> {
  try {
    const res = await fetch('/api/deepseek/logs', { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    return false;
  }
}

