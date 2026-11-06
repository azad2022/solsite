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

Workflow فعلی از این GitHub Actions secrets استفاده می‌کند:

- `SUPABASE_DB_URL`: URI اتصال PostgreSQL که مستقیماً از Supabase Dashboard → Connect گرفته شده باشد. Hostname مربوط به pooler را از روی region حدس یا سرهم نکنید.
- `SUPABASE_DB_PASSWORD`: تنها منبع رمز احراز هویت PostgreSQL؛ Workflow آن را از طریق `PGPASSWORD` به CLI می‌دهد.

اگر URI دارای password باشد، Workflow پیش از اجرای هر دستور Supabase CLI آن بخش را از URI حذف می‌کند؛ بنابراین رمز جاسازی‌شده در URL نمی‌تواند بر مقدار مستقل `SUPABASE_DB_PASSWORD` غلبه کند. مقادیر secrets هرگز نباید در log، issue، PR یا ChatGPT چاپ یا وارد شوند.

`SUPABASE_ACCESS_TOKEN` دیگر برای مسیر فعلی این workflow لازم نیست؛ روش قبلی مبتنی بر `supabase link` به محدودیت مجوز Management API خورد. مسیر فعلی مستقیماً از Supabase CLI و PostgreSQL connection URI استفاده می‌کند.

شناسه Production به‌صورت غیرمحرمانه این است:

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


## Fail-closed Production APPLY and target binding — 2026-11-06

The controlled workflow now separates read-only authentication/preview from the mutating Production apply path.

### APPLY commit guard

For `confirm=APPLY`, all of the following are mandatory before Production database credentials are exposed to a step:

1. The GitHub event is `workflow_dispatch`.
2. The selected ref is exactly `refs/heads/main`.
3. `expected_main_sha` is a full 40-character commit SHA and equals `GITHUB_SHA` for the exact event commit.
4. Checkout uses that exact `GITHUB_SHA`, not a moving branch name.
5. The run still performs `supabase db push --dry-run` immediately before `supabase db push`.

A dispatch from a feature branch, tag, pull request, push event, missing confirmation, malformed SHA or stale/different SHA fails closed. This is an application-level guard in this repository; it does not itself merge code or authorize a Production run.

### Exact database target

For `DRY_RUN` and `APPLY`, the guard accepts only the SolMint Production Session Pooler target:

- Host under `.pooler.supabase.com` (no direct database or arbitrary host).
- Exact user `postgres.nvopkbiedorfshwbmyhn`.
- Port `5432`.
- Database `postgres`.
- TLS required (`sslmode=require` by default; stronger `verify-ca` / `verify-full` modes are preserved).
- Only the SSL mode query parameter is accepted.
- If the connection URI contains an embedded password, it must exactly match `SUPABASE_DB_PASSWORD`; otherwise the run aborts.
- The password is removed from the URI and passed only as `PGPASSWORD`. The original URI and password are never printed.

The direct `AUTH_PROBE` remains read-only and uses the known direct project endpoint; it requires the standalone password but does not require a Session Pooler URI. `DRY_RUN` remains non-mutating and may be run to inspect a candidate migration set. `APPLY` still applies every pending repository migration, not an arbitrary selected SQL statement.

### External Supabase GitHub Integration boundary

The repository guard protects only the source-controlled GitHub Actions workflow. Supabase Dashboard's separate GitHub Integration `Deploy to production` setting can independently apply pending migrations on pushes/merges. The repository and connected Supabase APIs available to this project do not expose a verified read/write operation for that Dashboard setting. Do not represent this code change as disabling it. Issue #355 stays **OPEN / BLOCKED** until the historical runner actor/trigger and current provider toggle are verified. No Production provider setting is changed by this workflow guard.


### Supabase CLI release pin

The controlled Production workflow pins Supabase CLI to **2.122.1** instead of `latest`. Supabase CLI v3 became the default release on 2026-11-02 and changes hosted-command targeting/confirmation behavior; the current workflow has not completed a dedicated v3 migration. Keep the established v2 command contract stable until a separate upgrade updates every command (including explicit hosted targeting/confirmation), tests it against a non-Production environment and verifies the migration plan. The CI job `subscription-production-migration-cli` installs the exact v2 version and checks the reported version without connecting to Production.

Official references:
- [Supabase CLI v3 breaking-change notice](https://supabase.com/changelog/supabase-cli-v3)
- [Supabase setup-cli action and version input](https://github.com/supabase/setup-cli)
- [Supabase CLI v2.122.1 release](https://github.com/supabase/cli/releases/tag/v2.122.1)


## 2026-11-06 — G0 closed by explicit owner confirmation

**Current disposition: PASS / COMPLETE.** This section supersedes the interim OPEN/BLOCKED wording above, which described the state before the project owner completed the Dashboard action and before the three post-change log windows were available.

- The project owner explicitly confirms that Supabase Project Settings → Integrations → GitHub Integration → `Deploy to production` is OFF.
- Three subsequent main pushes (`d06c0546...`, `a39e1e0c...`, `514d3401...`) had normal records in all four Supabase log sources and zero independent migration-runner markers / PostgreSQL DDL or migration-apply matches.
- Repository-controlled Production migration guard, exact-main CI, Production Build, Authentication Build Verification and Cloudflare Production deployment evidence passed.
- Issue [#355](https://github.com/azad2022/solsite/issues/355) is CLOSED / COMPLETED.
- The connected Supabase API still cannot independently read the provider toggle; this is recorded as **OWNER-CONFIRMED OFF**, not connector-read. Historical October runner actor remains UNKNOWN and is not a current G0 blocker.

No Production DDL, migration APPLY, provider-setting mutation, credential/Secret/Key change or blockchain transaction was performed to close G0.
