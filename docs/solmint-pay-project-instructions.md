# دستورالعمل پایدار پروژه SolMint Pay
نسخه: 1.0 — تاریخ بازبینی: 2026-10-30  
Repository: azad2022/solsite  
هدف: توسعه و نگهداری درگاه واقعی، امن، قابل حسابرسی و Production-Grade با حداقل تکرار Prompt و حداقل مصرف Context.

این سند را در ChatGPT Project Instructions قرار بده. این سند راهنمای رفتار عامل است؛ منبع حقیقت فنی یا مجوز تغییر Production نیست. هر ادعا باید با Repository، Backend، Database، زنجیره و شواهد جاری تطبیق داده شود.

---

## 1. مأموریت و مرز حقیقت

SolMint Pay یک درگاه پرداخت واقعی بر Solana است. Frontend فقط Presentation و Interaction است. Backend، Database و Verification مستقل زنجیره مرجع حقیقت امنیتی، وضعیت پرداخت و حسابداری‌اند.

ترتیب تقدم منابع:

1. Repository جاری: Branch/HEAD، کد، Domain Types، API Contracts، تست، CI، Migration، RLS/Grants و PR.
2. Backend و شواهد زنده Database، Auth/RBAC، Runtime، Blockchain و Deployment.
3. docs/solmint-pay-frontend-master-instruction.md.
4. Skillهای مرتبط در docs/skills/.
5. این سند و گزارش‌های قبلی.
6. دانش عمومی، حدس و مستندات بیرونی.

در تعارض، Repository و Backend واقعی مقدم‌اند. Skill، Memory، Roadmap و Progress منبع حقیقت مستقل نیستند. سند متعارض باید اصلاح شود؛ نه اینکه کد برای هماهنگی با سند اشتباه تغییر کند.

قواعد ثابت:
- هیچ API، Route، Table، Column، RPC، State، Role، Fee، Business Rule، Secret یا قابلیت زنجیره‌ای را اختراع نکن.
- planned، designed، present in Skill و merged به معنی فعال‌بودن در Production نیست.
- نبود مدرک PASS نیست. نتیجه را دقیقاً PASS، BLOCKED، UNKNOWN یا NOT IMPLEMENTED اعلام کن.
- submitted ≠ paid. Signature، Reference، Program Event، Webhook و Browser State به‌تنهایی اثبات پرداخت نیستند.
- فقط Backend پس از Verification مستقل و ثبت اتمیک مالی مجاز به اعلام موفقیت است.
- مبلغ مالی همیشه integer/atomic units است؛ Floating Point برای منطق مالی ممنوع است.

## 2. پروتکل شروع هر Task

قبل از هر تغییر اجرایی یا ممیزی، این موارد را با شواهد تازه بررسی کن:

1. Repository azad2022/solsite، Default Branch، آخرین HEAD، Branch کاری، Working Tree، فایل‌های تغییرکرده و PRهای مرتبط.
2. وضعیت Branch/PR: باز، بسته، Merge شده، Draft، Base SHA، Head SHA و Checks.
3. Master Specification و Skill مربوط را از همان HEAD بخوان؛ وضعیت Merge یا وجود فایل را حدس نزن.
4. مسیرهای کد، API، Service، Types، Migration، DB/RLS/Grants، Auth/RBAC، Verification، Accounting، Webhook، تست، CI و Runtime مرتبط با همان Task را بررسی کن.
5. برای ادعای Production، شواهد زنده همان محیط و همان Cluster را بگیر. نام Environment Variable بدون بررسی رفتار Runtime اثبات پیکربندی نیست.
6. قبل از ایجاد فایل یا Migration، مسیر و محتوای فعلی را بخوان. فایل/Branch/PR موجود را دوباره نساز.

### Branch policy
- مستقیم روی main تغییر نده.
- برای Subscription از feat/pay-subscription-billing استفاده کن؛ ابتدا وجود و HEAD آن را بررسی کن. اگر وجود ندارد، از آخرین main تأییدشده بساز.
- اگر Branch موجود از main عقب است، Diff و Working Tree را بررسی کن؛ بدون بررسی، Force Reset، Force Push یا حذف تغییرات انجام نده.
- برای سایر Featureها Branch مستقل از HEAD تأییدشده بساز.
- تغییر کوچک و مرتبط باشد؛ Refactor گسترده یا تغییر نامرتبط سایت ممنوع.
- PR را فقط پس از ایجاد تغییر اجرایی/مستنداتی معنادار و بررسی Diff باز کن. PR خالی یا ادعای تکمیل بدون شواهد نساز.
- Merge، Release، Production success و Mainnet success فقط با شواهد واقعی اعلام شوند.

### وقتی ابزار یا دسترسی موجود نیست
- اگر Git محلی، Working Tree، Provider Dashboard، RPC، ProgramData، CI یا فایل باینری قابل خواندن نیست، محدودیت را واضح ثبت کن.
- از GitHub Connector برای Repository متصل استفاده کن؛ برای یافتن فایل Private Project از Web Search استفاده نکن.
- نبود دسترسی محلی را Working Tree clean اعلام نکن. نبود CI Status را CI green نگو. لاگ ناقص را مدرک هویت Actor فرض نکن.
- Secret را درخواست، نمایش، decode، copy یا log نکن؛ فقط وجود/نام/وضعیت غیرمحرمانه را بررسی کن.

## 3. مدیریت Context و کاهش مصرف Token

برای هر Task فقط منابع مرتبط را بارگذاری کن:

- همه Taskها: HEAD/Branch/PR، Master Specification، Progress headings و آخرین Checkpoint مرتبط.
- UI/React: Build Web Apps Skill؛ React Best Practices فقط در صورت تغییر React، Data Fetching یا Performance.
- Subscription: Subscription Skill + Build Web Apps + Release Audit، همیشه.
- Database/Supabase: Supabase Skill و Postgres Best Practices مرتبط با Query/RLS/Lock/Schema.
- Release/CI/Production: Release Audit Skill، Migration Policy، Workflow و شواهد همان Deployment.
- Wallet/Verification/Accounting: سرویس و تست واقعی همان مسیر؛ نه مرور بی‌هدف همه Repository.

قواعد صرفه‌جویی:
- docs/solmint-pay-progress.md یک Ledger طولانی است؛ هر بار کل آن را دوباره وارد Context نکن. ابتدا Headingها و انتهای فایل را ببین، سپس با Search/Find فقط Checkpoint مرتبط را بخوان.
- به‌جای خواندن کل کد، Call Site، Contract و تست‌های مرتبط را دنبال کن.
- اطلاعات قبلاً تأییدشده را بی‌دلیل بازگو نکن؛ فقط اگر در تصمیم فعلی اثر دارد.
- از جست‌وجوهای تکراری بی‌هدف و Tool Call موازی برای تغییر یک فایل خودداری کن.
- سؤال تکراری نپرس؛ اطلاعات معلوم را از Repository/Progress بازیابی کن. فقط وقتی ورودی واقعاً ضروری است و از هیچ منبع مجاز قابل کشف نیست، یک سؤال مشخص بپرس.
- برای کار پیچیده ابتدا Plan کوتاه بده؛ سپس به‌جای گزارش‌های مکرر، Checkpointهای قابل اثبات ارائه کن.
- در پایان، تغییرات، شواهد، تست‌ها، Blocker و قدم بعدی را کوتاه و دقیق گزارش کن.

## 4. امنیت عمومی و داده‌های حساس

- Seed Phrase، Private Key، JWT Signing Key، Supabase Secret/Service Role، API Key، Webhook Secret و Cloudflare Secret هرگز وارد Browser، Bundle، URL، Log، Ticket، Analytics یا Telemetry نشود.
- Wallet Customer باید تراکنش/Consent را با Wallet خودش امضا کند؛ Backend فقط Public Address، Signature و Evidence لازم را نگه دارد.
- عملیات حساس Supabase/RPC از Browser مستقیم انجام نشود؛ فقط Server-mediated.
- احراز هویت، Merchant Principal، Membership و RBAC در Backend و DB enforce شوند؛ UI filtering امنیت نیست.
- RLS و Grants را مستقل بررسی کن. برای SECURITY DEFINER: search_path ثابت و ایمن، مالکیت دقیق، احراز Caller، حداقل EXECUTE، Revoke از PUBLIC/anon/authenticated در صورت لزوم، تست BOLA/IDOR و Cross-Tenant. تابع Definer راه‌حل مجوزدهی نیست.
- Viewهای حساس باید RLS semantics درست داشته باشند؛ رفتار Security Invoker/Definer را از نسخه PostgreSQL و DDL واقعی بررسی کن.
- هیچ Production RLS، Grant، Secret، Key، Migration یا Provider Setting را بدون مجوز صریح و Plan بازیابی تغییر نده.
- Helius Mainnet و Devnet endpoint مستقل‌اند. Public RPC fallback برای Production نساز.
- RPC Timeout نتیجه قطعی نیست؛ ممکن است تراکنش اجرا شده باشد. قبل از Attempt/Charge بعدی Signature، Blockhash/Height، Transaction و On-chain state قبلی را Reconcile کن.

## 5. امنیت مالی و Accounting

- Atomic Amountها در DB و API به شکل Integer/Numeric و در JavaScript به شکل String/BigInt نگهداری شوند؛ تبدیل به Number فقط برای Presentation امن و غیرمحاسباتی.
- Merchant Principal، Gateway Revenue، Referral Liability/Commission، Network/Gas Cost و Refund/Reversal حساب‌های جدا هستند.
- Ledger باید idempotent، append-only تا حد قرارداد واقعی، قابل Audit و دارای Invariantهای جمع/طرف مقابل باشد. هر تغییر مالی باید در یک مرز اتمیک با Verification متناظر ثبت شود.
- Payment Intent Snapshot شامل مقادیر واقعی Backend است؛ UI دوباره Fee/Settlement/Total را authoritative محاسبه نکند.
- Reference فقط Correlation/Discovery است؛ Webhook فقط Notification است؛ هیچ‌کدام اثبات Transfer نیست.
- Refund، Partial Payment، Overpayment، Duplicate، Replay، Ambiguous، Wrong Mint/Recipient/Amount و Finality failure باید طبق Contract واقعی مدل شوند.
- هیچ Payment یا Subscription را با Signature صرفاً ارسال‌شده Paid اعلام نکن.

## 6. Subscription یک Bounded Context مستقل است

در آخرین Baseline ممیزی‌شده (2026-10-30) در Production هیچ Subscription/Billing Cycle/Consent/Collector Table یا API/RPC اختصاصی پیدا نشد. این وضعیت باید در هر Task دوباره بررسی شود؛ تا وقتی Source خلاف آن را ثابت نکرده، Subscription را پیاده‌سازی‌نشده تلقی کن.

Lifecycleهای زیر جدا بمانند؛ آن‌ها را در یک Status یا Table ادغام نکن:

1. Plan و نسخه/Terms آن.
2. Customer Consent Snapshot و وضعیت امضا/اعمال.
3. Subscription تجاری.
4. On-chain Plan PDA، SubscriptionDelegation PDA و SubscriptionAuthority PDA.
5. Shared Token Delegate و وضعیت واقعی Token Account.
6. Billing Cycle بر اساس دوره واقعی On-chain.
7. Attempt، Claim/Lock، Retry و Dunning Policy.
8. Payment Intent یا Alternative Contract متصل به Cycle.
9. Collector Signing/Submission.
10. Blockchain Verification/Reconciliation.
11. Financial Accounting/Settlement/Refund.
12. Customer entitlement/service access و Notification/Webhook.

اسم Table/API/Field/State را قبل از بررسی مدل فعلی اختراع نکن. Transition Table با Source of Truth، Actor، Guard، Side Effect و Recovery برای هر Lifecycle لازم است.

## 7. Program رسمی Solana و Pinning

مرجع رسمی: solana-foundation/subscriptions  
Program ID: De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44  
هدف بررسی‌شده: Tag program-v0.5.0  
SDK هدف: @solana/subscriptions@0.5.0، Tag ts-client-v0.5.0.

- Upstream main را Pin نکن. Program Source، IDL، SDK، Toolchain و Dependencyهای Transitive باید نسخه/Commit دقیق و سازگار داشته باشند.
- Upstream Changelog هدف Mainnet و تفاوت برچسب نسخه را گزارش می‌کند: Program tag برابر program-v0.5.0، درحالی‌که Binary/IDL منتشرشده برچسب 0.5.0-beta.1 را دارند و به Release Commit 364a41976c33347d092902443bbec2def9227e75 نسبت داده شده‌اند. این تفاوت نسخه باید حفظ شود؛ از یکی‌گرفتن Tag برنامه، Workspace/IDL و TypeScript SDK خودداری کن. تطبیق زنده Mainnet در Checkpoint مورخ 2026-10-31 مستقلاً انجام شده است.
- Cantina audit baseline برابر d6b3a5dc7ab18c4168441af733c81ab0a599d414 و remediation marker برابر debb4f75ff7571218b39de3b633074dd843e70db است. Delta هشت‌Commitی از remediation تا Release Commit بررسی شد؛ در آن هیچ مسیر program/src/** تغییر نکرده، اما release workflow/toolchain، dependency و lockfileها، IDL، SDK/client packages و tests، demo و اسناد تغییر کرده‌اند. این فقط نتیجه file-level delta است و به معنی Audit کامل همه artifactها یا حذف ریسک‌های Acknowledged نیست.
- گزارش رسمی ۱۲ صفحه‌ای Cantina در 2026-10-31 کامل خوانده و بصری بازبینی شد. ماتریس گزارش: ۹ یافته؛ Critical=0، High=1 (Acknowledged)، Medium=5 (2 Fixed، 3 Acknowledged)، Low=2 (1 Fixed، 1 Acknowledged)، Informational=1 (Fixed). یافته‌های Acknowledged همچنان Residual Risk هستند و باید به Controls اجرایی و Adversarial Tests نسخه اول تبدیل شوند؛ آن‌ها را Fixed تلقی نکن.
- Evidence خواندنی Finalized در Mainnet Beta روی کد اجرایی Commit 40456d8 و Workflow دقیق HEAD مستنداتی 3960b95 (Run 41172466490، Job برابر subscription-mainnet-programdata) موفق شد: Program ID برابر De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44، ProgramData برابر HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg، Deployment Slot برابر 438440823 و Upgrade Authority برابر DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv است. SHA-256 باینری مستقر و Build بازتولیدپذیر هر دو 056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318 هستند. Canonical Program Metadata PDA برابر CCG1hwKFk32h11yE2PRZeEmNAdZsMQrSuiEmqx5eEhWE و Hash مربوط به IDL روی زنجیره و Source برابر 1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa است. Upgrade Authority با Vault/State رسمی Squads v4 تطبیق داده شد؛ Multisig فعلی 3-of-5 و Timelock آن 0 ثانیه است. هویت واقعی و Custody اعضا UNKNOWN باقی می‌ماند. این نتایج فقط Binary/Source/IDL identity و زنجیره اختیار را تأیید می‌کنند، نه امنیت Program یا رفع Cantina residual risks.
- SDK تگ 0.5.0 به @solana/kit ^7 وابسته است؛ SolMint فعلی بر @solana/web3.js 1.x است. نصب مستقیم SDK را فرض نکن؛ Adapter، Compatibility، Dependency، Bundle و Lockfile را بررسی و تست کن.
- Verified Build فقط انطباق Binary با Source را نشان می‌دهد؛ Verified بودن به‌تنهایی Audit یا امنیت کد را ثابت نمی‌کند.

## 8. قواعد واقعی On-chain که نباید تحریف شوند

### Plan و اجازه Pull
- Period برحسب ساعت و بین ۱ تا ۸۷۶۰ ساعت است؛ ۳۰ روز = ۷۲۰ ساعت، نه «روز مشابه ماه بعد».
- Amount سقف Token Pull هر دوره است؛ Program آن را با وضعیت Subscription کنترل می‌کند.
- حداکثر ۴ Destination و ۴ Puller اضافی وجود دارد. Plan Owner همیشه مجاز به Pull است؛ پس مجموع Actorهای بالقوه Owner + چهار Puller است.
- Empty Puller list به معنی بی‌اجازه بودن Owner نیست.
- Empty/All-zero Destination list به معنی هر مقصدی مجاز است؛ SolMint باید Plan تولیدی با Allowlist غیرخالی بسازد/بپذیرد.
- مقصد با Owner آدرس Token Account سنجیده می‌شود؛ فقط مقایسه ATA کافی نیست. Mint، Token Program، ATA derivation و Token Account Owner باید همگی تطبیق داده شوند.
- Mint، Amount، Period و Destinationهای Plan از طریق UpdatePlan قابل تغییر نیستند. برای تغییر مادی Terms/Price/Mint/Period/Destination باید Plan/Consent جدید یا مسیر مستقلاً طراحی‌شده و آزموده‌شده باشد.
- در Plan فعال Status، End Time، Pullerها و Metadata با شروط Stale State قابل تغییرند؛ End Time محدودشده فقط کوتاه می‌شود. بعد از Sunset فقط کاهش Pullerها مجاز است.
- Sunset جلوی Subscribe جدید را می‌گیرد اما به‌خودی‌خود Pull اشتراک‌های موجود را فوراً متوقف نمی‌کند. End Time و Subscription Expiry واقعی تعیین‌کننده‌اند.
- Plan Owner خودبه‌خود Puller است و قابل حذف از آن نقش نیست؛ Collector را فقط به‌عنوان Puller مجاز اضافه کن، نه Owner ساختگی.

### Consent و Shared Authority
- Subscriber باید با Wallet خودش Consent/Subscribe را امضا کند. Subscribe، Mint، Amount، Period، Plan Created At و Authority init_id واقعی را به مشاهده امضاکننده bind می‌کند؛ UI یا Metadata جای On-chain Consent نیست.
- Init Authority، Delegate مشترک کاربر+Mint را با Allowance برابر u64::MAX تأیید می‌کند. سقف مؤثر از Plan/Subscription On-chain می‌آید. هرگز این را «اجازه دقیق یک دوره/یک مبلغ در Token Account» توصیف نکن.
- یک SPL Token Account فقط یک Delegate slot دارد؛ Init می‌تواند Delegate قبلی را جایگزین کند. پیش از امضا Delegate فعلی را بخوان و جایگزینی را شفاف اعلام کن.
- Authority برای User+Mint مشترک است. Revoke آن می‌تواند همه Subscriptionهای همان User+Mint را متأثر کند. Cancel/Close یک Subscription با Revoke Shared Authority متفاوت است.
- init_id شماره نسل جهانی نیست؛ slot-granular است. Same-slot close/reinit می‌تواند همان مقدار را بازتولید کند. آن را به‌عنوان تنها Consent ID یا Revocation Generation استفاده نکن.

### تراکنش‌های امضاشده و Pending
- UNKNOWN_INIT_ID را در Production ممنوع کن. InitSubscriptionAuthority و Subscribe باید دو تراکنش مستقل باشند؛ Init را جدا اجرا و تأیید کن، مقدار واقعی init_id را از PDA بخوان، سپس Subscribe را با همان مقدار واقعی بساز و امضا بگیر.
- Bundle امضاشده Init+Subscribe با sentinel می‌تواند بعد از Revoke هم اجرا شود و Authority/Delegate/Subscription را دوباره بسازد.
- Recent Blockhash عمر محدود دارد؛ Durable Nonce آن محدودیت را حذف می‌کند. Pending Squads/Swig/smart-wallet proposal نیز می‌تواند دیرتر اجرا شود.
- Default نسخه اول: فقط Recent Blockhash برای Consent و عملیات Authority/Cancel/Resume/Revoke/Plan. Durable Nonce و Proposalهای چندامضایی/نیمه‌تمام تا طراحی و تست کامل Pending-Approval/Cancel/Nonce Lifecycle پشتیبانی نشوند.
- Expire شدن Transaction، Cancel شدن Proposal و Revoke شدن Authority مفاهیم جدا هستند. دکمه بستن Modal یا Cancel UI اثبات عدم اجرای Transaction نیست.
- تراکنش/Proposal امضاشده Outstanding را ثبت کن؛ تا تعیین تکلیف آن ادعای Revoke قطعی نکن.
- Resume در همان Billing Period می‌تواند همان expected_expires_at_ts قبلی را ببیند؛ Immediate Cancel نیز current_period_start_ts ثانیه‌ای دارد؛ UpdatePlan هم خطر ABA دارد. Fresh State، Recent Blockhash، یک Proposal فعال در هر لحظه و عدم نگهداری Signature بلااستفاده ضروری‌اند.

### Period، Cancellation و Collectability
- On-chain Subscription هنگام Subscribe، Period Start را از Clock واقعی زنجیره می‌گیرد و مبلغ مصرف‌شده دوره را صفر می‌کند.
- در Pull، Program در صورت گذشت چند دوره به مرز دوره جاریِ هم‌تراز جلو می‌رود و مصرف قبلی را reset می‌کند؛ برای هر دوره ازدست‌رفته یک بدهی خودکار ایجاد نمی‌کند. Catch-up/Dunning یک قاعده Backend/Product مستقل است.
- وضعیت Period Start و Cumulative Amount Pull شده در SubscriptionDelegation، همراه تمام Pullهای Owner/Collector/Other Puller، مرجع میزان قابل برداشت دوره است.
- Cancel عادی می‌تواند اجازه Pull تا پایان Period جاری را باقی بگذارد؛ Cancel فوری نیازمند امضای Subscriber و Plan Owner است؛ Resume، Close یک Subscription، Revoke Shared Authority، Plan Sunset و Expiry جدا هستند.
- End Time Plan در Source برای Pull مرز خاص خود را دارد؛ در مرز دقیق، به‌جای محاسبه UI، منطق pinned Program و تست‌های boundary را ملاک بگیر.
- On-chain Active به معنی Collectable نیست. Delegate ممکن است Revoked، ATA خالی/بسته/Freeze، Mint/Program نامعتبر یا Transfer ناممکن باشد. Program Delinquency/Grace state ندارد. Collectability را در Backend از وضعیت واقعی بررسی کن.
- Full period charge در نزدیک End Time ممکن است برای پنجره ناقص هم اعمال شود. سیاست v1: در Plan محدود با کمتر از یک Period کامل باقی‌مانده ثبت‌نام را رد کن.
- Plan sponsor rent لزوماً Plan Owner نیست و ممکن است Rent را پس نگیرد؛ پیش‌فرض نسخه اول Merchant-funded Plan rent.

## 9. Collector: مرز اعتماد مستقل

Collector باید Puller مجاز Plan باشد، نه Plan Owner و نه Signer عمومی. Public Checkout، Merchant API و Collector signing API کاملاً جدا هستند.

- Cloudflare Worker/Page Secret، HSM نیست. کلید باارزش Collector را به‌عنوان long-lived private key در Runtime عمومی/Pages قرار نده مگر Threat Model، Blast Radius، Key Rotation، Kill Switch و Recovery تأیید شده باشد.
- ترجیح با Signing Service مجزا و HSM/KMS یا معادل ایزوله با Audit، Key Version و Least Privilege است.
- Collector فقط بر اساس Job/Attempt داخلی محدود و قابل Audit امضا کند. هیچ Public Endpoint نباید Transaction bytes/Message دلخواه مشتری را امضا کند.
- داخل مرز امضا، Cluster، Program ID، Instruction Discriminator/Layout، PDA derivation، Subscription/Plan/Subscriber، Puller، Mint/Program/Decimals، Source ATA/Delegate، Destination owner/ATA، مبلغ باقیمانده Period، Fee Legها، Blockhash/Last Valid Height، Simulation و نبود Instruction/CPI/Transfer اضافی بررسی شود.
- Transaction hash، Attempt/Cycle ID، Plan/Subscription، Signer key version، Simulation، Signature و نتیجه ثبت شوند؛ Secret هیچ‌وقت Log نشود.
- Emergency disable، Rotation، Revoke/Replace Puller، incident response و compromise recovery باید مستند و آزمایش شوند.
- Fee Payer تراکنش می‌تواند Collector باشد؛ Source Token Authority برابر SubscriptionAuthority PDA است. این دو را در Schema/Verifier/Accounting یکی فرض نکن.

## 10. Billing Engine، Cycle و Idempotency

Scheduler فقط Wake-up است؛ نه Lock، نه Idempotency و نه Truth.

- Cycle identity باید بر اساس Subscription و Period Start واقعی On-chain unique باشد. کلید پیشنهادی مفهومی Subscription + on-chain period_start است؛ نام Column/Constraint تا دیدن Schema واقعی قرارداد نیست.
- برای هر Cycle، DB باید Unique Constraint، Atomic Claim/Lease، Attempt پایدار، Idempotency scope/hash و Recovery داشته باشد.
- Workerهای هم‌زمان باید از Claim اتمیک/Row Lock/قفل مورد تأیید DB استفاده کنند؛ صرف Select سپس Update امن نیست.
- Transaction DB را هنگام RPC یا تماس با Signer باز نگه ندار. ابتدا Claim کوتاه و Commit؛ Network/Simulation/Signing خارج از Transaction DB؛ سپس Conditional Finalize کوتاه با Claim Token/Version. از قفل طولانی و Deadlock اجتناب کن.
- پس از Timeout، Restart یا HTTP failure، Attempt قبلی را از روی Signature/Prepared message/Blockhash/Chain state Reconcile کن؛ قبل از تعیین تکلیف، Charge جدید نساز.
- Outcome Unknown نه Failed است، نه Retryable. Retry فقط برای خطایی که قطعاً قبل از Submit رخ داده یا با Evidence به‌عنوان retryable شناخته شده.
- اگر Periodهای قبلی از دست رفته، Program برای هرکدام خودکار برداشت معوق نمی‌سازد؛ سیاست Catch-up باید جدا تعریف شود.
- Pullهای Plan Owner یا Pullerهای دیگر را کشف و در همان Cycle/Period حساب کن. Unique Cycle به‌تنهایی از Pull خارج Collector جلوگیری نمی‌کند.
- هیچ Cron/Queue بدون idempotency، lock، timeout، recovery و reconciliation معتبر نیست.

## 11. Verification و Accounting اشتراک

Verifier فعلی Pay را تغییر نده تا Subscription را قبول کند. pay_apply_verified_observation در Baseline شرط Source Authority یکسان و برابر با Fee Payer دارد و Gas Sponsored را رد می‌کند. Subscription Authority PDA و Collector Fee Payer دو Principal متفاوت‌اند.

Adapter مستقل باید حداقل این موارد را از Transaction واقعی بررسی کند:
- Cluster و Program ID دقیق، Instruction Discriminator/Layout و Accountها.
- Plan PDA، Subscription PDA، SubscriptionAuthority PDA و Derivation/Ownership/Discriminator.
- Subscriber، Authorized Puller، Source ATA Owner/Mint/Delegate و Authority init_id.
- Mint، Token Program، Decimals، Destination owner/ATA/Allowlist.
- مقدار هر Transfer، مجموع Amount، cumulative per-period allowance و وضعیت Subscription/Plan در زمان اجرای تراکنش.
- Success، Commitment/Finality، Slot/Block Time، Signature و Transferهای واقعی.
- Fee Payer تراکنش جدا از Source Authority.
- تطبیق Cycle/Attempt/Payment Intent/Plan/Subscription/Signature/Events/Transferها؛ Event و Signature به‌تنهایی کافی نیست.
- Duplicate Signature، Replay، Transfer اضافی، Wrong Mint/Recipient/Amount/Puller/Program، چند دستور و اثر واقعی Balance.

هر پرداخت باید با حسابداری سازگار و اتمیک ثبت شود: Payment/Transfer Observation، Cycle/Attempt، Payment Intent یا ارتباط typed، Merchant Principal، Gateway Revenue، Referral Liability، Gas و Refund/Reversal. اگر این داده‌ها در یک تراکنش/قرارداد اتمیک commit نمی‌شوند، پرداخت را موفق اعلام نکن. Webhook فقط پس از ثبت Event مالی معتبر ارسال شود.

### Split principal + gateway fee یک Blocker مستقل است
یک TransferSubscription فقط یک Destination/Amount دارد. اگر Principal و Gateway Fee دو مقصد جدا داشته باشند، احتمالاً به دو Instruction در یک Transaction نیاز است؛ هر دو باید در Plan Allowlist باشند و مجموعشان از سقف همان Period تجاوز نکند. تا وقتی LiteSVM تست نکند که دو Transfer به همان SubscriptionDelegation مصرف تجمعی درست دارند، شکست دستور دوم دستور اول را Rollback می‌کند، Eventها قابل تطبیق‌اند و Devnet E2E پاس است، Split Fee BLOCKED است. Fee model را حدس نزن و Verifier را تضعیف نکن.

## 12. Backend و Database Contract

قبل از Migration/API، Contract را طراحی و از Source واقعی تطبیق بده. مفاهیم Plan، Subscription، Consent Snapshot، Authority State، Billing Cycle، Attempt، Collector Registry، Verification، Payment Intent و Accounting مستقل‌اند؛ این‌ها پیشنهاد Bounded Context هستند، نه نام Table/API قطعی.

برای هر Table/Function/API تعریف کن:
- Tenant/Customer ownership، Merchant membership/RBAC و Principal دقیق.
- FK، Unique، Check، Index، Atomic Mutation و Allowed Transitions.
- Amount type و Atomic Units، Currency/Asset/Mint/Program.
- Idempotency scope/key/hash، Request replay، concurrency lock و timeout recovery.
- Audit Actor، Created/Updated/Verified times، retention و redaction.
- Grants/Revoke، RLS policies، SECURITY DEFINER، search_path و Caller capability.
- Customer Portal دسترسی فقط به Subscriptionهای همان Customer و داده لازم؛ هیچ Merchant/Cross-Customer leakage.
- Event/Outbox قابل Retry با Event ID پایدار؛ delivery state با Financial State یکی نیست.

Supabase:
- برای تمام جدول‌های Exposed schema RLS و Policy متناسب لازم است؛ صرف TO authenticated Authorization نیست.
- Cross-Merchant و Customer-vs-Merchant access را با fixture adversarial تست کن.
- SECURITY DEFINER فقط با دلیل مستند، حداقل مجوز، search_path ثابت، caller validation و EXECUTE grant محدود.
- RLS وجودی معادل امنیت اثبات‌شده نیست؛ Policy، Role، Grant، View، Function، RPC و Service Role را inspect کن.
- از Data API Exposure و Grant غافل نشو. Secret/Service Role به Browser نرود.
- DB Claim از الگوی سازگار با Postgres استفاده کند (مثلاً FOR UPDATE SKIP LOCKED در queue در صورت تناسب)؛ هیچ Network call داخل Transaction قفل‌شده انجام نشود.
- Query Plan، Index، FK Index و Connection Pooling متناسب با بار واقعی بررسی شوند؛ بدون Benchmark ادعای مقیاس نکن.

## 13. Frontend و تجربه کاربری

Frontend فقط API واقعی از Service Layer مرکزی را مصرف کند. هیچ Scheduler، Retry مالی، Signer، Verification یا محاسبه authoritative در Browser قرار نده.

- UI اشتراک فقط بعد از آماده شدن Backend Contract ساخته شود.
- Plan، Consent، Subscription Lifecycle، On-chain Authority، Billing Cycle، Attempt، Payment Intent، Verification، Accounting و Entitlement را جدا نمایش بده.
- Loading، Empty، Error، Unauthorized، Forbidden، Stale، Retryable، Outcome Unknown و Pending Approval stateهای واقعی داشته باشند.
- Customer Consent باید دقیقاً Snapshot Backend را نمایش دهد: Merchant/Plan/Version، Asset/Network/Mint، Atomic Amount و واحد قابل فهم، Period به ساعت، سقف هر دوره، Fee/Payer، Destination ownerها، End Time، First/Next charge، Shared Authority scope و قاعده Cancel/Revoke.
- واضح بگو Delegate Token approval برابر u64::MAX است و محدودیت مؤثر از Plan/Subscription می‌آید؛ آن را مجوز یک‌دوره/یک‌مبلغ معرفی نکن.
- Plan Owner امکان Pull دارد و ممکن است Collector تنها Puller نباشد.
- Active On-chain ≠ Paid/Collectable/Service Entitled.
- fa-IR، en-US، ar، ru با RTL/LTR واقعی؛ متن UI hard-code نشود؛ اعداد/تاریخ/Timezone locale-aware باشد.
- Light/Bright/Premium/Clean/Financial، هویت دلفین شاخ‌دار صورتی با اصل Professional first, playful second. ظاهر حرفه‌ای و واضح بر Decoration مقدم است.
- Accessibility، Keyboard، Focus، Semantic HTML، Contrast، Reduced Motion و Responsive Mobile/Tablet/Desktop بخشی از Definition of Done است.

## 14. تست و ممیزی اجباری

ترتیب معمول:
Unit → Component → Integration → Disposable DB/RLS Security → Devnet E2E → Adversarial/Security → CI → Production Build → Deployment Smoke → Release Audit.

Subscription test matrix حداقل:
- Consent معتبر/ردشده/منقضی، stale Plan، Init جداگانه، real init_id، رد sentinel.
- held Init+Subscribe، Durable Nonce، pending smart-wallet proposal، authority re-init، held close/revoke، همان slot، revocation scope و existing delegate replacement.
- Plan terms immutable، Plan sunset و existing pull، finite end، near-end subscription، exact period boundaries و same-period Cancel/Resume.
- Owner/Collector/other Puller، unauthorized Puller، destination owner/ATA، empty allowlist، wrong Mint/Program/Decimals/ATA.
- Period cumulative amount، missed periods، concurrent pulls، Owner pull قبل/حین Collector، scheduler duplicate، duplicate Claim/Attempt/Cycle.
- RPC Timeout، process restart، Submit unknown، expired Blockhash، retry، duplicate Signature/replay.
- Principal+Fee multi-instruction atomicity، failure second leg rollback، over allowance، extra transfer/instruction، duplicate events.
- Token account empty/frozen/closed، delegate revoked، insufficient balance، TransferHook/MemoTransfer unsupported.
- Verifier Program/PDA/Instruction/Transfer/Amount/Recipient/Puller/Fee Payer mismatch، commitment insufficient، finalized outcome.
- Cross-Merchant، Cross-Customer، RLS، Grants، Security Definer، Customer Portal BOLA.
- Ledger split/atomicity، referral، gas، refund/reversal، webhook outbox/retry.

Devnet mutating tests وMainnet read-only جدا باشند. Public RPC fallback ممنوع. تست با Key/Wallet/DB ایزوله؛ هیچ Mainnet transfer یا تغییر مالی Merchant واقعی برای QA انجام نشود. سبز بودن Build یا Unit به‌تنهایی Release Readiness نیست.

## 15. Production، Migration، Secret و Release

- هیچ Production DDL، تغییر RLS/Grant، Runtime/Secret/Key، ایجاد/چرخش Collector Key، Plan زنده، Consent مشتری واقعی، Mainnet Transfer، Merge/Release غیرقابل‌بازگشت بدون شواهد و مجوز صریح انجام نشود.
- Production Migration فقط از مسیر Source-controlled موجود در .github/workflows/solmint-pay-production-migration.yml و مطابق docs/solmint-pay-production-migration-policy.md: ابتدا DRY_RUN، سپس تأیید صریح APPLY، اجرا، بررسی Migration Ledger و تست پس از اجرا.
- Issue #355 درباره منشأ Migration Runner تا زمان حل با شواهد معتبر، Production DDL را مسدود می‌کند. از زمان‌بندی Log برای حدس Actor استفاده نکن. تنظیم Provider را بدون تأیید تغییر نده.
- Devnet E2E فقط از RPC مخصوص Devnet؛ Mainnet Read-only از RPC مخصوص Mainnet. Cluster را از Evidence بررسی کن.
- Deploy فقط طبق مسیر موجود Repository/Cloudflare Pages. Worker قدیمی یا Integration جانبی را Deployment اصلی فرض نکن؛ دقیقاً مشخص کن کدام Workflow و Deployment اجرا شده است.
- Production Smoke و Live Smoke باید بعد از Deploy همان Commit اجرا و SHA/Run ID/نتیجه ثبت شوند.
- Rollback/Recovery باید بر اساس آخرین Commit شناخته‌شده و مسیر رسمی باشد. موفقیت Rollback را بدون Smoke تأییدشده اعلام نکن.
- Release decision:
  - PASS: همه Gateهای کاربردی با Evidence مثبت همان SHA/Environment پاس شده‌اند.
  - BLOCKED: مانع بحرانی امنیت/DB/Verifier/Accounting/CI/Deployment/Runtime وجود دارد.
  - UNKNOWN: دسترسی یا Evidence کافی نیست.
  - NOT IMPLEMENTED: قابلیت در کد/Backend وجود ندارد.

## 16. Progress و Documentation به‌عنوان قرارداد

- بعد از Checkpoint واقعاً تأییدشده، docs/solmint-pay-progress.md را با Date، Branch، Base/HEAD، Commit SHA، فایل‌های تغییر، تست/CI واقعی، DB/On-chain/Deployment evidence، Blocker و Next Step به‌روز کن.
- Design، مستندات یا Compile به‌تنهایی Checkpoint اجرایی سبز نیست.
- اگر Skill، API contract، State Machine، Threat Model یا Migration policy تغییر می‌کند، سند متناظر را نیز در همان Branch اصلاح کن.
- هر سند باید تاریخ و محدوده Evidence داشته باشد. یافته قدیمی را بدون revalidation جاری نگو.
- این دستورالعمل در docs/solmint-pay-project-instructions.md نگهداری می‌شود؛ Skill تخصصی در docs/skills/ و شواهد تاریخی در Progress می‌مانند.

## 17. نحوه گزارش به مالک پروژه

در پایان هر Task، مختصر اما دقیق بگو:
1. چه چیزی واقعاً بررسی یا تغییر کرد؛ Branch و Commit/PR.
2. نتیجه به تفکیک PASS/BLOCKED/UNKNOWN/NOT IMPLEMENTED.
3. تست‌ها و Evidence واقعی (SHA/Workflow Run/Query/Cluster)؛ تست اجرا‌نشده را اجراشده نگو.
4. ریسک یا Blocker باز و قدم بعدی مشخص.
5. آیا چیزی در Production، Secret، Key یا Blockchain تغییر کرده است؛ اگر نه صریحاً بگو.

از تعریف و تأیید بی‌مورد، بازگویی طولانی، وضعیت‌نمایی بدون نتیجه و درخواست Prompt تکراری پرهیز کن. کار را با اطلاعات موجود و امن‌ترین فرض پیش ببر؛ فقط یک سؤال ضروری بپرس، آن هم وقتی از Repository/Backend قابل کشف نیست.

---

## خلاصه قواعد غیرقابل مذاکره

- Source و Live Evidence بر Skill و حافظه مقدم‌اند.
- روی main مستقیم تغییر نده.
- API، Schema، State، Fee یا Permission اختراع نکن.
- Submitted ≠ Paid؛ Event/Reference/Webhook proof نیست.
- Atomic Units؛ Ledger تفکیک‌شده و اتمیک.
- Subscription lifecycleها جدا؛ Shared Authority، Plan Owner Pull و تمام Pullerها دیده شوند.
- u64::MAX را دقیق افشا کن؛ UNKNOWN_INIT_ID و Init+Subscribe bundle در Production ممنوع.
- Durable Nonce/Pending proposal تا حل ریسک Delayed Execution ممنوع.
- Collector ایزوله؛ Cloudflare Secret HSM نیست.
- Verifier عادی Pay را تضعیف نکن؛ Subscription adapter جدا.
- Cycle unique + atomic lock + durable attempt + reconciliation قبل از retry.
- Production migration فقط Controlled Workflow و APPLY مجاز؛ #355 blocker جاری تا رفع Evidence.
- Unknown را PASS نکن؛ Rollout را فقط با شواهد واقعی تأیید کن.
