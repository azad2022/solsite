# Solmint Better Auth Runtime

این branch لایه Identity سراسری Solmint را به‌صورت additive و جدا از legacy authentication مستقر می‌کند.

## وضعیت فعلی

- Better Auth روی نسخه pin شده `1.7.2` است.
- mount واقعی در `functions/api/auth/[[path]].ts` روی Cloudflare Pages Functions انجام می‌شود.
- runtime از PostgreSQL adapter رسمی و `pg` استفاده می‌کند.
- در production، اتصال PostgreSQL فقط از `HYPERDRIVE.connectionString` مجاز است؛ `BETTER_AUTH_DATABASE_URL` فقط برای development/test است.
- schema مستقل `better_auth` شامل user/session/account/verification/rate_limit است و clientهای Supabase به آن دسترسی ندارند.
- مسیر `/api/users/me` ابتدا legacy session را حفظ می‌کند و در نبود آن Better Auth session را نیز می‌شناسد؛ این mapping به‌طور عمدی هیچ role مدیریتی را از Better Auth اعطا نمی‌کند.
- legacy `public.users`, `public.auth_sessions` و `public.auth_login_attempts` حذف یا rename نشده‌اند.
- Pay tables، membership، authorization و RLS در این branch تغییر نکرده‌اند.
- رابط global login اکنون در `src/components/AuthModal.tsx` به APIهای واقعی Better Auth متصل است و session/token را در localStorage ذخیره نمی‌کند.
- صفحه مستقل `/reset-password` وجود دارد و توکن را فقط از query string دریافت و به endpoint رسمی Better Auth ارسال می‌کند.

## مرز امنیتی

Better Auth فقط Identity/Authentication است.

`role`، membership، merchant isolation، RBAC و financial authorization باید همچنان در application backend و PostgreSQL/RLS enforce شوند. Better Auth Organization یا UI permission نباید جایگزین این مرزها شود.

## قابلیت‌هایی که هنوز عمداً gated هستند

### Email verification و Password reset delivery
Better Auth endpointهای مربوط به verification/reset وجود دارند، اما ارسال ایمیل به یک transport واقعی server-side نیاز دارد. تا زمانی که provider و secretهای آن در محیط امن provision نشده‌اند، نباید این قابلیت‌ها production-active تلقی شوند.

### Google OAuth
UI و server route آماده‌اند، اما provider فقط وقتی فعال می‌شود که `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` در runtime server-side موجود باشند. secret هرگز در client bundle قرار نمی‌گیرد.

### Cloudflare Hyperdrive
Repository قرارداد fail-closed را دارد، اما provision شدن binding واقعی Cloudflare و تست end-to-end آن یک عملیات محیطی است و نباید با یک شناسه ساختگی در repository شبیه‌سازی شود.

## Migration policy

کاربر legacy مستقیماً روی Better Auth overwrite نمی‌شود. ترتیب intended:

`public.users`
→ staging/bridge mapping
→ `better_auth.user`
→ `better_auth.account`
→ application profile/roles

جلسه‌های legacy در اولین cutover فقط در صورت وجود mapping امن قابل نگه‌داری‌اند؛ در غیر این صورت sessionها invalidate و re-authentication کنترل‌شده انجام می‌شود.

هیچ migration identity نباید روی production بدون backup، dry-run، row-count/checksum evidence، rollback plan و verification انجام شود.

## Validation gate

PR تا زمانی که موارد زیر سبز نشده‌اند merge یا production activation نمی‌شود:

1. current-head CI
2. Bun frozen-lockfile production build
3. non-production `better_auth` migration
4. Cloudflare Pages Functions → Hyperdrive → PostgreSQL connectivity
5. auth E2E برای sign-up/sign-in/sign-out/session expiry/revocation
6. password reset و email verification با mail transport واقعی
7. Google OAuth با redirect/origin/state validation
8. adversarial security tests و Pay authorization regression tests
9. deployment smoke tests
