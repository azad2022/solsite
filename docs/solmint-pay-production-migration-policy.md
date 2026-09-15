# SolMint Pay — Production Migration Policy

## تصمیم عملیاتی قطعی

برای SolMint Pay، اجرای migration در Production به خرید Supabase Pro یا فعال‌سازی Supabase Preview Branching وابسته نیست.

Supabase Free برای خود PostgreSQL/Database قابل استفاده است. چیزی که برای این پروژه لازم نیست و نباید به‌عنوان پیش‌نیاز migration تلقی شود، Preview Branching است.

## مسیر رسمی Production

تغییرات schema و function باید همیشه ابتدا به‌صورت migration file در repository ثبت شوند و سپس از مسیر کنترل‌شده CI/CD اجرا شوند.

مسیر استاندارد پروژه:

`Repository migration → GitHub Actions → Supabase CLI → supabase db push → Production`

از اجرای دستی SQL در SQL Editor به‌عنوان مسیر معمول deployment استفاده نشود، چون این روش migration history را از repository جدا می‌کند.

`supabase migration repair` نیز جایگزین اجرای migration نیست و فقط برای اصلاح migration history در شرایط reconciliation مستند قابل استفاده است.

## Preview-Free Constraint

این پروژه عمداً بدون Supabase Preview Database/Branching کار می‌کند، چون maintainer به محیط پولی/کارت اعتباری دسترسی ندارد.

این یک constraint عملیاتی است، نه استثنای امنیتی.

برای validation از این موارد استفاده می‌شود:

1. migration-chain integrity در GitHub CI
2. PostgreSQL disposable برای تست‌های امنیتی و adversarial
3. CI / typecheck / unit tests / production build
4. Production API smoke
5. Devnet E2E و Mainnet read-only برای رفتار blockchain
6. Production migration از طریق workflow کنترل‌شده با Supabase CLI

## Production Migration Workflow

Workflow زیر در repository قرار دارد:

`.github/workflows/solmint-pay-production-migration.yml`

این workflow فقط با `workflow_dispatch` اجرا می‌شود و قبل از mutation یک انتخاب صریح `APPLY` می‌خواهد.

ابتدا:

`supabase db push --dry-run`

سپس:

`supabase db push`

و در پایان:

`supabase migration list`

نکته مهم: `supabase db push` تمام migrationهای pending repository را به‌ترتیب اعمال می‌کند؛ بنابراین این workflow یک مسیر deliberate production release است و نباید به‌عنوان اجرای یک SQL دلخواه در نظر گرفته شود.

## Credentials

برای اجرای workflow فقط این GitHub Actions secrets لازم‌اند:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

شناسه Production به‌صورت غیرمحرمانه در workflow ثبت شده است:

`nvopkbiedorfshwbmyhn`

این project ref secret نیست و نباید به‌عنوان secret جدید ساخته شود.

## وضعیت migration `20260915195212_pay_payment_intent_authoritative_response.sql`

این migration در Production با نسخه `20260915195212` ثبت شده و نام migration آن `pay_payment_intent_authoritative_response` است.

Repository قبلاً همان منطق را با timestamp متفاوت `20260915221500` نگه داشته بود. این حالت یک migration-lineage mismatch بود و نباید با `db push` روی Production به‌صورت کورکورانه اجرا می‌شد.

در اصلاح repository باید همان SQL موجود، با نسخه و نام ثبت‌شده Production (`20260915195212_pay_payment_intent_authoritative_response.sql`) نگهداری شود و فایل timestamp جایگزین حذف شود. این reconciliation فقط repository-side است و نباید با `migration repair` یا SQL دستی روی Production انجام شود.

پس از reconciliation، هر migration جدید باید timestamp منحصربه‌فرد خود را داشته باشد و قبل از اجرای production migration با live ledger تطبیق داده شود.

## Migration Failure Handling

Workflow قبل از اتصال و mutation، credential guard را اجرا می‌کند. اگر `SUPABASE_ACCESS_TOKEN` یا `SUPABASE_DB_PASSWORD` در GitHub Actions در دسترس نباشد، workflow باید همان‌جا متوقف شود و هیچ migration نباید اجرا شود.

این failure یک configuration/security gate است، نه failure در SQL migration. رفع آن باید با تنظیم secret صحیح در GitHub Actions انجام شود؛ مقدار secret نباید در issue، PR، log یا ChatGPT وارد شود.

## Rule for future ChatGPT sessions

قبل از پیشنهاد خرید Supabase Pro برای Pay، ابتدا این سند، `docs/solmint-pay-frontend-master-instruction.md`، `docs/solmint-pay-progress.md` و migration ledger repository بررسی شوند.

فرض نکن که migration نیازمند Pro است.

فرض نکن که Preview Branching برای production migration لازم است.

مسیر پیش‌فرض این پروژه برای Production migration همان GitHub Actions + Supabase CLI + `supabase db push` است، مگر اینکه یک محدودیت واقعی و مستند جدید خلاف آن را نشان دهد.
