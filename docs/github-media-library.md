# کتابخانه تصاویر GitHub — راه‌اندازی Production

## معماری

```text
Admin Panel
   |
   | admin passcode فقط برای احراز هویت
   v
Supabase Edge Function: github-media
   |
   | GITHUB_MEDIA_TOKEN فقط روی سرور
   v
GitHub Repository / Branch / Media Path
   |
   +--> GitHub raw URL برای نمایش تصویر
   |
   +--> Supabase media_assets برای metadata
```

توکن GitHub هرگز در React، localStorage، Supabase table یا payload مرورگر ذخیره نمی‌شود. مقدار `githubToken` قدیمی در API کلاینت نیز عمداً نادیده گرفته می‌شود تا حتی در صورت باقی ماندن UI قدیمی، secret ارسال نشود.

## Secrets مورد نیاز در Supabase Edge Functions

در پروژه Supabase `nvopkbiedorfshwbmyhn` این دو Secret را تنظیم کنید:

- `GITHUB_MEDIA_TOKEN`: Fine-grained GitHub Personal Access Token با دسترسی حداقلی به Repositoryهای کتابخانه تصاویر.
- `MEDIA_ADMIN_PASSCODE`: همان رمز فعلی پنل مدیریت Solmint. این مقدار برای احراز هویت درخواست‌های Media Gateway است و نباید در Git commit شود.

Supabase متغیرهای داخلی مانند `SUPABASE_URL` و کلیدهای سرور را در Edge Function فراهم می‌کند؛ Secretهای اختصاصی را باید از بخش Edge Functions → Secrets تنظیم کرد.

## تنظیم اولیه کتابخانه

مقدار پیش‌فرض:

- Owner: `azad2022`
- Repository: `solsite`
- Branch: `main`
- Base path: `public/media/articles/`

Repository مقصد باید برای نمایش مستقیم تصاویر از مرورگر public باشد. اگر در آینده Repository خصوصی شود، URL مستقیم `raw.githubusercontent.com` برای کاربران سایت مناسب نخواهد بود و باید یک image proxy/CDN سمت سرور اضافه شود.

## قابلیت‌های پیاده‌سازی‌شده

- تست دسترسی Repository و Branch
- مشاهده تصاویر موجود در Repository با Git tree API
- آپلود و تبدیل تصویر به WebP در مرورگر، سپس ارسال محتوای بهینه‌شده به Edge Function
- ایجاد/به‌روزرسانی فایل در GitHub با SHA برای جلوگیری از overwrite اشتباه
- جلوگیری از Path Traversal
- محدودیت حجم آپلود ۸ مگابایت
- حذف امن فایل از GitHub
- ثبت metadata در `media_assets`
- همگام‌سازی Library با فایل‌های واقعی Repository، حتی اگر فایل قبلاً خارج از پنل ایجاد شده باشد
- تغییر Repository/Branch/Path از پنل
- مهاجرت fail-safe به Repository جدید؛ ابتدا همه فایل‌ها کپی و تأیید می‌شوند و فقط بعد از موفقیت کامل مقصد فعال می‌شود

## نکته مهم درباره مهاجرت

توکن باید به Repository مبدا و مقصد دسترسی داشته باشد. برای همین در Fine-grained Token، هر دو Repository را در بخش Repository access انتخاب کنید.

هرگز Token را در کد، `.env` داخل Git، Supabase table یا localStorage قرار ندهید.
