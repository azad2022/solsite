# کتابخانه تصاویر GitHub — معماری Production

## معماری فعلی

```text
Admin Panel
   |
   | HttpOnly __Host-solmint_session
   v
Cloudflare Pages Function: /api/media/*
   |
   | GITHUB_MEDIA_TOKEN فقط روی سرور
   v
GitHub REST API
   |
   +--> Repository / Branch / Media Path
   +--> GitHub raw URL برای نمایش تصویر

Supabase
   +--> media_config
   +--> media_assets
```

مرورگر هرگز توکن GitHub را ارسال یا ذخیره نمی‌کند. credential کتابخانه فقط در محیط server/Edge نگهداری می‌شود. مسیرهای privileged کتابخانه با session مدیریتی server-side احراز هویت می‌شوند.

## Secrets مورد نیاز

- `GITHUB_MEDIA_TOKEN`: Fine-grained GitHub Personal Access Token با حداقل دسترسی لازم به Repository مقصد.
- `SUPABASE_SECRET_KEY` یا credential سروری معادل: فقط برای APIهای server-side.

`GITHUB_MEDIA_TOKEN` نباید در React، localStorage، جدول Supabase یا payload مرورگر قرار بگیرد.

## تنظیم پیش‌فرض Production

- Owner: `azad2022`
- Repository: `solsite`
- Branch: `main`
- Base path: `public/media/articles/`

## قابلیت‌ها

- تست مرحله‌ای GitHub Token، Repository، Branch و Media Directory
- فهرست تصاویر واقعی موجود در Repository
- تبدیل تصویر در مرورگر به WebP/JPEG و ارسال نسخه بهینه‌شده به سرور
- محدودیت حجم ۸ مگابایت سمت سرور
- محدودیت فرمت به WebP/JPEG/PNG/GIF/AVIF
- جلوگیری از Path Traversal و نام فایل ناامن
- جلوگیری از overwrite تصادفی و کنترل SHA در GitHub
- ثبت metadata در `media_assets`
- حذف فایل با بررسی SHA
- مهاجرت Repository با تست مبدا و مقصد قبل از فعال‌سازی مقصد؛ در صورت شکست مهاجرت، Repository فعال قبلی تغییر نمی‌کند

## نکته Repository خصوصی

اگر Repository رسانه خصوصی باشد، URL مستقیم `raw.githubusercontent.com` برای کاربران عمومی سایت مناسب نیست. در این حالت باید image proxy/CDN سمت سرور اضافه شود.

## Endpoint مستقیم Supabase Edge Function

`supabase/functions/github-media` به‌صورت legacy غیرفعال است و برای کاهش سطح حمله اجازه mutation مستقیم نمی‌دهد. تمام عملیات production از `/api/media/*` انجام می‌شود.
