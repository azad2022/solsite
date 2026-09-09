# SolMint Pay — Frontend Master Specification, Engineering Direction & Long-Term Architecture

> **Master rule:** این سند راهنمای مرجع توسعه SolMint Pay است. قبل از هر implementation باید وضعیت واقعی repository، backend، database، migrations، contracts، deployment و production configuration بررسی شود. این سند نباید با حدس، mock، endpoint خیالی یا architecture فرضی اجرا شود.

## 1. مأموریت

هدف، ساخت یک **Frontend حرفه‌ای، Production-Grade و مستقل برای درگاه پرداخت رمزارزی SolMint Pay** است.

این Frontend باید یک محصول واقعی پرداخت باشد، نه یک Dashboard نمایشی، Landing Page، Mockup یا نمونه MVP.

رابط کاربری باید کاملاً با Backend، Database، API، Payment Engine، Reconciliation، Accounting، Security و معماری فعلی SolMint Pay همگام باشد.

اصل بنیادین:

**Frontend فقط لایه‌ی Presentation و Interaction است؛ هیچ تصمیم مالی، امنیتی یا اعتبارسنجی authoritative نباید توسط Frontend گرفته شود.**

هر چیزی که در UI نمایش داده می‌شود باید در صورت امکان از state معتبر Backend دریافت شود.

## 2. قانون شماره یک: Repository First

قبل از هرگونه تغییر یا ایجاد فایل جدید، ابتدا ساختار واقعی repository بررسی شود.

Repository فعلی:

`azad2022/solsite`

قبل از implementation باید حداقل این موارد بررسی شوند:

- ساختار فعلی پروژه
- `package.json`
- TypeScript configuration
- Vite/build configuration
- Cloudflare Pages/Functions architecture
- مسیرهای فعلی Frontend
- routing فعلی
- APIهای موجود
- Backend Pay
- Payment Intent API
- Merchant API
- Wallet Challenge API
- Reconciliation API
- Webhook API
- Authentication
- Authorization
- Supabase schema
- RLS
- migration chain
- domain types
- Pay services
- i18n
- existing tests
- CI
- deployment architecture
- runtime bindings و production environment variables/secrets

هیچ Frontend جدیدی نباید بدون شناخت این لایه‌ها ساخته شود.

### ممنوع

- حدس زدن قرارداد API
- ساخت endpoint خیالی
- ساخت field خیالی
- ساخت state مالی مستقل در Frontend
- duplicate کردن business logic در UI
- تغییر دادن Backend صرفاً برای ساده‌تر شدن UI
- ساخت mock به جای integration واقعی در production path
- اتصال مستقیم UI به RPC
- اتصال مستقیم UI به Supabase برای عملیات حساس
- ایجاد coupling غیرضروری با Frontend اصلی Solmint
- ساخت secret یا environment variable خیالی
- درخواست از مالک پروژه برای ساخت دوباره secretای که در production از قبل وجود دارد، بدون بررسی واقعی configuration

## 3. مرز معماری Frontend

SolMint Pay باید یک **Frontend Boundary مستقل** از Frontend اصلی Solmint داشته باشد.

معماری باید به شکلی باشد که در آینده بتوان:

- UI Pay را جداگانه توسعه داد
- کامپوننت‌ها را مستقل نگهداری کرد
- تست‌های Pay را مستقل اجرا کرد
- design system Pay را مستقل توسعه داد
- routing Pay را مستقل گسترش داد
- i18n Pay را مستقل مدیریت کرد
- در آینده در صورت نیاز بخش Frontend Pay را به package/application مستقل تبدیل کرد

Pay نباید تبدیل به مجموعه‌ای از componentهای پراکنده در Frontend فعلی Solmint شود.

منطق مالی، امنیتی و تجاری موجود در Backend نباید به UI منتقل شود.

## 4. محصول باید با Backend هم‌راستا باشد

Frontend باید Backend Contract را **مصرف** کند، نه اینکه آن را بازتعریف کند.

برای هر صفحه و قابلیت، ابتدا باید مشخص شود:

1. API یا source of truth چیست؟
2. Authentication مورد نیاز چیست؟
3. Authorization چگونه enforce می‌شود؟
4. داده از کدام endpoint می‌آید؟
5. کدام فیلد authoritative است؟
6. وضعیت loading چیست؟
7. وضعیت empty چیست؟
8. وضعیت error چیست؟
9. وضعیت retry چیست؟
10. وضعیت stale چیست؟
11. وضعیت unauthorized چیست؟
12. وضعیت forbidden چیست؟
13. چه چیزی فقط برای display است؟
14. چه چیزی transaction/financial state واقعی است؟

## 5. اصل امنیتی Frontend

Frontend هرگز trusted system نیست.

کاربر می‌تواند request، URL، merchantId، paymentId، referral code، amount و response را تغییر دهد، JavaScript را دستکاری کند، API را مستقیم صدا بزند یا state محلی را تغییر دهد.

بنابراین هیچ تصمیم امنیتی یا مالی نباید صرفاً بر اساس Frontend state گرفته شود.

Frontend فقط باید state authoritative سرور را نمایش دهد.

## 6. Payment Intent

Payment Intent باید مرکز تجربه پرداخت باشد.

Frontend نباید Payment Intent را خودش بسازد یا محاسبات authoritative انجام دهد.

Payment Intent باید از Backend دریافت شود و شامل اطلاعاتی نظیر موارد زیر باشد:

- merchant
- amount
- asset
- mint
- token program
- decimals
- receiving wallet
- fee destination
- reference
- fee policy
- fee payer
- gateway fee
- customer total
- merchant settlement amount
- expiry
- payment state
- referral snapshot
- gas policy

هر آنچه از Payment Intent آمده باید همان snapshot تجاری و مالی نمایش داده شود.

Frontend نباید هنگام نمایش دوباره این مقادیر را با منطق مستقل محاسبه کند مگر صرفاً برای presentation و با حفظ مقدار authoritative سرور.

## 7. Payment UX

تجربه پرداخت باید حرفه‌ای، ساده، سریع و قابل اعتماد باشد.

Customer Checkout باید حداقل شامل موارد زیر باشد:

- نام Merchant
- لوگو/هویت Merchant
- مبلغ
- Asset
- شبکه
- Gateway Fee
- مشخص بودن fee payer
- مبلغ نهایی مشتری
- مقصد
- reference در صورت نیاز
- expiration
- Wallet Connect / Payment Action
- وضعیت Verification
- وضعیت Payment
- Transaction Signature در صورت موجود بودن
- support/ticket access
- وضعیت نهایی

### وضعیت‌ها باید دقیق باشند

حداقل:

- Created
- Pending
- Awaiting Payment
- Verification Pending
- Confirming
- Paid
- Underpaid
- Overpaid
- Wrong Asset
- Wrong Destination
- Failed
- Expired
- Retryable
- Rejected
- Ambiguous

Frontend نباید `Transaction submitted` را به معنی `Payment successful` نمایش دهد.

Success فقط زمانی نمایش داده شود که Backend آن را authoritative اعلام کرده باشد.

## 8. Verification UX

Verification باید برای کاربر قابل فهم باشد اما جزئیات امنیتی خطرناک یا misleading نمایش داده نشود.

Frontend باید تفاوت میان این مراحل را روشن نمایش دهد:

- wallet connected
- transaction submitted
- transaction detected
- transaction confirming
- transaction verified
- payment finalized

Reference صرفاً correlation/discovery است و proof of payment نیست.

Webhook نیز source of truth مالی نیست.

## 9. Merchant Dashboard

Merchant Dashboard باید یکی از هسته‌های اصلی محصول باشد.

### Overview

- Total Volume
- Verified Payments
- Successful Transactions
- Failed Transactions
- Pending Payments
- Active Customers
- Payment Conversion
- Merchant Settlement
- Gateway Fees
- Refunds
- Recent Activity

هر KPI باید timestamp، time range، unit، currency و comparison period داشته باشد و اعداد از Backend بیایند.

## 10. Transactions

صفحه Transactions باید مرکز عملیاتی واقعی باشد.

امکانات:

- Search
- Filter
- Date Range
- Asset
- Status
- Merchant
- Customer
- Payment ID
- Transaction Signature
- Amount
- Fee
- Settlement
- Reference
- Created At
- Verified At

هر Transaction باید Detail Page داشته باشد و تا حد نیاز شامل Payment Intent، Payment State، Blockchain Signature، Verification State، Merchant، Amount، Asset، Fee، Settlement، timestamps، failure/retry information و reconciliation status باشد.

## 11. Blockchain Information

اطلاعات on-chain باید دقیق و قابل حسابرسی نمایش داده شوند.

در صورت وجود داده معتبر:

- Network
- Signature
- Slot
- Confirmation/Finality state
- Block time
- Reference
- Source
- Destination
- Token Mint
- Token Program
- Amount
- Fee Payer

نمایش داده شود.

Frontend نباید بدون evidence اطلاعاتی مانند successful، confirmed، finalized یا paid را خودش تعیین کند.

## 12. Merchant Management

Merchant section باید شامل:

- merchant profile
- business information
- verified receiving wallet
- wallet verification status
- supported assets
- payment settings
- fee settings در محدوده مجاز
- payment links
- invoices
- API keys
- webhook configuration
- webhook delivery history
- security events
- support tickets
- account status

باشد.

Wallet ownership verification باید از Backend challenge flow استفاده کند.

Frontend نباید signature را خودش معتبر تلقی کند.

## 13. Wallet UI

Frontend هیچ‌وقت نباید:

- seed phrase را به Backend ارسال کند
- private key را ارسال کند
- private key را در localStorage ناامن ذخیره کند
- secret را در analytics بفرستد
- secret را در logs قرار دهد
- secret را در URL قرار دهد

Wallet connection باید با مدل واقعی شبکه/شبکه‌های فعال سازگار باشد.

Wallet Address و token account باید با مفهوم درست همان chain نمایش داده شوند.

## 14. Referral / Affiliate Dashboard

Referral section باید مستقل و روشن باشد:

- Referral Code
- Referred Merchants
- Active Eligible Merchants
- Current Tier
- Tier Progress
- Tier History
- Eligible Earnings
- Pending Earnings
- Paid Earnings
- Reversed Earnings
- Available Withdrawal
- Withdrawal Threshold
- Payout Wallet
- Wallet Verification
- Withdrawal History
- Payout Transactions
- Referral Events

Frontend نباید commission را خودش محاسبه authoritative کند؛ فقط نتیجه Backend را نمایش دهد.

## 15. Merchant vs Referral Accounting

این حوزه‌ها از نظر UI نباید مخلوط شوند.

- Merchant Principal: پول اقتصادی Merchant
- Gateway Revenue: درآمد SolMint
- Referral Liability: تعهد مالی SolMint به Affiliate
- Gas Cost: هزینه زیرساخت/شبکه
- Refund/Reversal: اصلاح مالی

Dashboard باید این مفاهیم را دقیق و بدون ابهام نمایش دهد.

## 16. Reports & Analytics

Reports باید حرفه‌ای ولی قابل فهم باشد.

حداقل:

- volume
- transaction count
- success rate
- failure rate
- pending rate
- average payment value
- fees
- settlement
- refunds
- referral cost
- revenue
- supported assets
- time series

Time rangeها:

- Today
- 7D
- 30D
- 90D
- Custom

تمام metrics باید unit و timezone مشخص داشته باشند.

## 17. Ticket / Support System

سیستم Ticket بخشی از محصول است، نه لینک تزئینی.

امکانات:

- Create Ticket
- Ticket ID
- Category
- Subject
- Priority
- Status
- Conversation
- Attachments در صورت پشتیبانی
- timestamps
- Last Update
- Assigned team
- Close/Reopen

وضعیت‌ها:

- Open
- In Progress
- Waiting for Customer
- Waiting for SolMint
- Resolved
- Closed

Ticket در صورت امکان با Payment ID، Merchant ID و Transaction Signature مرتبط شود. هیچ secret یا private key نباید وارد Ticket system شود.

## 18. Notifications

Notification center برای رویدادهای مهم:

- payment verified
- payment failed
- payment expired
- webhook failed
- wallet verification
- security event
- ticket update
- withdrawal update
- payout
- refund

Notification صرفاً notification است و source of truth مالی نیست.

## 19. Design Language

تم اصلی SolMint Pay:

**Light / Bright / Clean / Premium / Financial / Modern**

جهت بصری:

- سفید
- off-white
- light gray
- pink SolMint accent
- restrained purple/blue accents
- soft borders
- subtle shadows
- rounded corners
- whitespace زیاد
- typography واضح

از طراحی شلوغ، gradientهای سنگین و animationهای غیرضروری پرهیز شود.

هدف: **Stripe-like clarity + modern crypto identity + SolMint personality**

## 20. Pink Horned Dolphin Identity

ماسکات دلفین صورتی شاخ‌دار عنصر هویت برند است، اما نباید مزاحم hierarchy داده باشد.

مناسب برای:

- Empty States
- Success States
- Onboarding
- Welcome
- Illustration
- Support
- Small Dashboard accents
- Loading states محدود
- Promotional areas

اصل: **Professional first, playful second**

## 21. اختصاصی بودن Iconography

تا حد امکان از سیستم Icon اختصاصی SolMint Pay استفاده شود. Iconها باید ساده، قابل تشخیص، هماهنگ، سبک و مناسب UI مالی باشند.

مفاهیم پیشنهادی: Payment، Settlement، Revenue، Referral، Merchant، Wallet، Verification، Security، Ticket، Webhook، Invoice، Refund، Gas، Analytics.

## 22. Typography

متن UI باید کوتاه، دقیق، مستقیم و قابل فهم باشد. از متن‌های بازاریابی سنگین داخل Dashboard پرهیز شود.

## 23. زبان و i18n

Localeهای فعلی:

- fa-IR
- en-US
- ar
- ru

RTL و LTR باید واقعی باشند. هیچ متن کاربرمحور hard-code نشود. اعداد، تاریخ، currency، status و error باید semantic و locale-aware باشند.

## 24. Language Switcher

Language switcher باید سریع، واضح، accessible و RTL/LTR aware باشد. تغییر زبان نباید state مالی را خراب کند.

## 25. Responsive Design

Mobile First.

پشتیبانی:

- Mobile
- Tablet
- Laptop
- Desktop
- Wide Desktop

در موبایل sidebar به Drawer، جدول‌ها به Card/List، KPIها به stack و chartها به شکل usable تبدیل شوند و horizontal overflow ناخواسته وجود نداشته باشد.

## 26. Accessibility

حداقل:

- semantic HTML
- keyboard navigation
- focus state
- aria labels
- contrast مناسب
- readable typography
- reduced motion support
- usable form validation
- accessible tables
- accessible dialogs

## 27. Data States

هر component داده‌ای حداقل این stateها را در نظر بگیرد:

- loading
- loaded
- empty
- error
- unauthorized
- forbidden
- stale
- retryable

Empty state با Error state اشتباه نشود.

## 28. Error Handling

Error message باید کوتاه، دقیق، غیر فنی برای کاربر عادی و قابل اقدام باشد. جزئیات فنی باید در telemetry/server logs حفظ شوند.

## 29. Retry Behaviour

Retry فقط متناسب با نوع خطا:

- network failure
- timeout
- temporary RPC/backend failure

قابل retry هستند.

برای invalid payment، wrong recipient، wrong token، unauthorized، duplicate operation و rejected state نباید retry کورکورانه انجام شود.

## 30. Concurrency

Frontend نباید duplicate mutation ایجاد کند. برای عملیات حساس مانند Create Payment، Create Invoice، Wallet Verification، Withdrawal، API Key creation و Webhook action باید loading، disabled submit، request identity، idempotency awareness و race prevention در نظر گرفته شود.

## 31. Financial Display Rules

هیچ مبلغ مالی نباید با floating-point برای تصمیم‌گیری محاسبه شود.

Frontend باید مقادیر authoritative آماده‌شده توسط Backend را نمایش دهد و برای نمایش decimals صحیح، currency، atomic units و localized format را رعایت کند.

گرد کردن UI نباید معنای مبلغ واقعی را تغییر دهد.

## 32. Security UX

امنیت باید قابل مشاهده ولی غیرترساننده باشد.

موارد قابل نمایش: Wallet verified، Secure connection، Webhook signing، API key last used، security events، session activity، payout wallet verified.

UI نباید ادعای امنیتی فراتر از architecture واقعی داشته باشد.

## 33. API Keys

API Key UI:

- Create
- Revoke
- Last used
- Created date
- Scope/permission
- Status

Secret key فقط در زمان مناسب و طبق قرارداد Backend نمایش داده شود.

نباید API secret در URL، logs، analytics یا persistent frontend storage قرار گیرد.

## 34. Webhook UI

Webhook section:

- Endpoint
- Status
- Secret status
- Last delivery
- Success rate
- Retry count
- Failed deliveries
- Delivery history
- Signature status

Webhook transport از financial truth جدا نگه داشته شود.

## 35. Invoice & Payment Links

Merchant باید بتواند:

- Invoice ایجاد کند
- مبلغ تعیین کند
- Asset تعیین کند
- expiry تعیین کند
- توضیح اضافه کند
- Payment Link دریافت کند
- وضعیت Invoice را مشاهده کند

اما amount و payment policy authoritative باید با Backend هماهنگ باشد.

## 36. Onboarding

ترتیب پیشنهادی:

1. Create Account
2. Create Merchant
3. Verify Wallet
4. Choose Payment Assets
5. Create First Payment Link
6. Receive Verified Payment
7. View Dashboard

از کاربر اطلاعات اضافی و غیرضروری خواسته نشود.

## 37. Dashboard Visual Hierarchy

### Header

- Search
- Language
- Notifications
- Profile

### Sidebar

- Dashboard
- Transactions
- Customers
- Merchants
- Referrals
- Tickets
- Reports
- Settings

### Main

- Greeting
- KPI cards
- Transaction Volume
- Payment Methods
- Recent Transactions
- Top Merchants / relevant merchant data
- Quick Actions
- Latest Tickets

صفحه نخست نباید بیش از حد متراکم شود.

## 38. Search

Search در صورت امکان global باشد و Transaction ID، Payment ID، Signature، Merchant، Customer، Ticket ID و Invoice ID را جستجو کند. Result باید نوع entity را مشخص کند.

## 39. Tables

Tableهای مالی باید sortable، filterable، paginated، responsive و readable باشند. در موبایل به Card/List تبدیل شوند.

## 40. Charts

نمودارها برای فهم داده هستند، نه تزئین. Time range مشخص داشته باشند و Tooltip شامل date، amount و unit باشد. داده نمودار Backend-derived باشد.

## 41. State Synchronization

در موارد حساس state باید refresh/revalidate شود، به‌خصوص Payment status، Withdrawal status، Wallet verification، Webhook delivery و Ticket status و Security events.

## 42. Caching

Cache فقط برای داده‌ای مجاز است که stale بودن آن business decision را خراب نکند. برای state مالی و امنیتی freshness مهم‌تر از performance است.

## 43. Backend Contract Changes

هر تغییر در schema، endpoint، field، state، payment lifecycle، authorization یا financial meaning باید باعث بازبینی Frontend شود. Frontend و Backend باید version-aware باشند.

## 44. No Contradiction Rule

هیچ تناقضی میان UI، API، DB، Accounting، Payment State Machine، Verification، Webhook و Documentation پذیرفته نیست.

اگر Backend می‌گوید `PENDING`، UI حق ندارد `PAID` نمایش دهد. اگر wallet `UNVERIFIED` است، UI حق ندارد `Verified` نمایش دهد. اگر withdrawal `PROCESSING` است، UI حق ندارد `Paid` نمایش دهد.

## 45. Loading & Skeleton

از skeleton مناسب استفاده شود و layout تا حد امکان ثابت بماند.

## 46. Animation

Animation محدود و purposeful باشد. motion دائمی، particle سنگین و animation به جای hierarchy اطلاعاتی ممنوع است.

## 47. Performance

رعایت:

- route-level lazy loading
- component splitting
- جلوگیری از re-render اضافی
- virtualization برای لیست‌های بزرگ
- image optimization
- icon optimization
- minimal JS
- caching مناسب
- جلوگیری از query تکراری

Performance نباید با security یا correctness معامله شود.

## 48. Testing

### Unit

- formatting
- i18n
- state mapping
- utility functions
- display logic

### Component

- forms
- tables
- cards
- dialogs
- payment states

### Integration

- API contract
- authorization states
- payment lifecycle UI

### E2E

- login
- merchant onboarding
- wallet verification
- create payment
- checkout
- pending payment
- verified payment
- failed payment
- refund
- referral
- ticket

### Security

- unauthorized access
- cross-merchant access
- client tampering
- duplicate submission
- sensitive data leakage

## 49. Financial Test Matrix

Frontend باید با valid payment، underpayment، overpayment، wrong token، wrong recipient، wrong reference، failed transaction، expired payment، duplicate payment، replay، ambiguous candidate، RPC unavailable، incomplete discovery و concurrent reconciliation آزمایش شود.

در هیچ حالت UI نباید success جعلی نمایش دهد.

## 50. Observability

Frontend باید اطلاعات لازم برای debugging امن را ثبت کند، اما هرگز private key، seed phrase، API secret، webhook secret یا authentication credential را ثبت نکند.

Request ID / correlation ID در صورت وجود باید در UI و support flow قابل استفاده باشد.

## 51. Ticket / Incident Integration

برای خطاهای مهم امکان ایجاد Ticket از context فعلی وجود داشته باشد، مثلاً `Payment verification failed` با Payment ID. اطلاعات حساس نباید خودکار ارسال شوند.

## 52. Visual Reference

Dashboard:

- Light theme
- White/light gray background
- Pink SolMint accent
- Clean left sidebar
- Rounded cards
- Soft shadows
- Clear KPI hierarchy
- Professional charts
- Small mascot illustrations
- Custom icons
- Minimal text
- High readability

## 53. Brand Personality

لحن برند:

**Professional + Trustworthy + Modern + Friendly**

نه کودکانه، بیش‌ازحد رسمی، پرحرف، تبلیغاتی یا gimmicky.

## 54. Frontend Must Not Invent Business Rules

Frontend نباید خودش تعیین کند payment موفق است، commission قابل پرداخت است، wallet معتبر است، transaction نهایی شده، merchant فعال است، withdrawal قابل اجراست، revenue ثبت شده یا refund موفق شده است. این موارد Backend-authoritative هستند.

## 55. Frontend Must Reflect Backend State Machine

برای هر state mapping مرکزی مشخص شود:

- label
- icon
- description
- color/status treatment
- allowed action
- retry availability
- terminal/non-terminal status

این mapping نباید در چند component تکثیر شود.

## 56. Routing

Routing باید مستقل و قابل گسترش باشد. مسیرهای پیشنهادی:

`/pay`
`/pay/login`
`/pay/onboarding`
`/pay/dashboard`
`/pay/transactions`
`/pay/transactions/:id`
`/pay/merchants`
`/pay/merchants/:id`
`/pay/customers`
`/pay/invoices`
`/pay/payments`
`/pay/referrals`
`/pay/referrals/withdrawals`
`/pay/tickets`
`/pay/reports`
`/pay/settings`
`/pay/developer`
`/pay/developer/api-keys`
`/pay/developer/webhooks`
`/pay/security`

این فهرست contract قطعی routing نیست و باید با repository تطبیق داده شود.

## 57. Public Checkout vs Authenticated Panel

Customer Checkout و Merchant Dashboard دو محصول UX متفاوت‌اند.

Customer: ساده، focused و بدون پیچیدگی.

Merchant: data-rich، analytics، management و operational controls.

## 58. Merchant Isolation

هیچ merchant نباید merchant، transaction، webhook، API key یا customer data متعلق به merchant دیگر را مشاهده کند.

امنیت واقعی باید در Backend و DB/RLS enforce شود؛ UI فقط defense-in-depth است.

## 59. Security Boundary

هیچ credential حساس نباید به client منتقل شود مگر طبق contract امنیتی مشخص.

Frontend نباید تبدیل شود به:

- signing oracle
- secret vault
- payment authority
- reconciliation engine
- accounting engine

## 60. Development Workflow

ترتیب هر feature:

`1. Inspect repository
2. Inspect backend contract
3. Inspect database/domain model
4. Inspect existing tests
5. Design UX
6. Define API/state mapping
7. Implement isolated frontend
8. Integrate real backend
9. Unit tests
10. Component tests
11. Integration tests
12. E2E
13. Security review
14. Accessibility review
15. Responsive review
16. Performance review
17. CI
18. Final architecture review`

## 61. No Premature Launch

وجود UI به معنی آماده بودن محصول نیست.

فعال شدن `/pay` فقط زمانی مجاز است که Backend، Database، RLS، Authentication، Authorization، Wallet verification، Payment verification، Reconciliation، Accounting، Webhook، Referral، Security، Observability، Frontend، i18n، Accessibility، Responsive UX، E2E، Deployment و Rollback validation شده باشند.

## 62. Implementation Principle

اول functionality و correctness؛ سپس polish، visual refinements، micro-interactions، animations و advanced analytics.

هیچ زیبایی بصری نباید correctness را compromise کند.

## 63. Design System

قبل از ساخت تعداد زیادی صفحه، Design System مرکزی ایجاد شود:

- colors
- typography
- spacing
- radius
- shadows
- buttons
- inputs
- selects
- badges
- status indicators
- cards
- tables
- dialogs
- notifications
- navigation
- charts
- empty states

Design System فقط برای Pay باشد و به UI فعلی Solmint وابسته نباشد مگر در موارد ضروری.

## 64. Component Architecture

ساختار منطقی پیشنهادی:

`src/pay/
├── app/
├── components/
├── features/
│   ├── checkout/
│   ├── dashboard/
│   ├── transactions/
│   ├── merchants/
│   ├── customers/
│   ├── referrals/
│   ├── invoices/
│   ├── tickets/
│   ├── reports/
│   ├── developer/
│   └── security/
├── layouts/
├── pages/
├── services/
├── i18n/
├── styles/
├── types/
└── utils/`

ساختار نهایی باید پس از بررسی repository تثبیت شود.

## 65. Service Boundary

`Page → Feature Component → Pay Service / API Client → Backend API → Database / Blockchain / Reconciliation`

UI نباید implementationهای backend/security را manipulate کند.

## 66. API Client

API client مرکزی باید authentication، request ID، error normalization، timeout، retry policy، parsing، unauthorized و forbidden handling را متمرکز کند.

## 67. No Duplicate Business Logic

Fee calculation، settlement، commission، payment validity و accounting logic نباید در Checkout، Dashboard، Invoice و Payment Detail تکرار شود. Business truth در Backend است.

## 68. UI as Financial Instrument

Dashboard باید مانند ابزار مالی واقعی پاسخ دهد:

- چه اتفاقی افتاده؟
- چه زمانی؟
- برای چه payment؟
- چه مقدار؟
- وضعیت چیست؟
- آیا نهایی است؟
- چه اقدامی ممکن است؟
- چه چیزی باید منتظر بماند؟

## 69. Final Product Standard

اگر هزاران Merchant و مشتری واقعی امروز از SolMint Pay استفاده کنند، آیا می‌توانیم از UI از نظر correctness، امنیت، شفافیت مالی، accessibility، performance، consistency و maintainability دفاع کنیم؟ اگر پاسخ روشن «بله» نیست، feature تمام نشده است.

## 70. اصل نهایی

**Never design the UI first and force the backend to fit it.**

ابتدا:

`Repository → Architecture → Backend Contract → Database → Domain State → Security → API → UX → UI`

هدف نهایی: یک پنل روشن، شیک، سریع، چندزبانه، امن، قابل حسابرسی و ساده برای استفاده که هویت SolMint را با ماسکات دلفین صورتی شاخ‌دار، آیکن‌های اختصاصی و طراحی مدرن نمایش دهد؛ در حالی که تمام داده‌ها، وضعیت‌های مالی و عملیات حساس کاملاً با Backend و معماری واقعی SolMint Pay همگام باقی بمانند.

---

# 71. راهبرد معماری جدید: Multi-Chain Ready, Solana First

**تصمیم معماری قطعی:** SolMint Pay و هسته Wallet باید از همین مرحله **Multi-Chain Ready** طراحی شوند، اما اولین و تنها شبکه فعال در release فعلی Pay همچنان **Solana** است.

این تصمیم به معنی فعال‌سازی Ethereum، Bitcoin، Tron، BNB Chain، Polygon یا شبکه دیگری در نسخه فعلی نیست.

اصل:

`Multi-Chain Ready ≠ Multi-Chain Enabled`

نسخه فعلی باید:

`SolMint Pay → Solana → SOL / USDC / USDT`

باشد، ولی abstractionهای داخلی نباید به شکلی طراحی شوند که اضافه کردن chain بعدی نیازمند بازنویسی Payment Intent، accounting، verification، wallet core یا merchant API باشد.

### ممنوع

- افزودن chain دوم فقط برای نمایش ظاهری
- قرار دادن `ethereum` یا chain دیگر در UI بدون backend support واقعی
- فرض اینکه token یکسان در همه شبکه‌ها یک asset واحد است
- فرض اینکه address، signature، confirmation، fee یا transaction model بین chainها یکسان است
- generic کردن بیش از حد abstraction قبل از داشتن contract واقعی

## 72. Chain Adapter Architecture

تمام قابلیت‌های chain-specific باید پشت adapter boundary قرار گیرند.

مدل مفهومی:

`ChainRegistry
  ├── SolanaAdapter (ACTIVE)
  ├── EvmAdapter (PLANNED)
  ├── BitcoinAdapter (PLANNED)
  ├── TronAdapter (PLANNED)
  └── FutureAdapters`

هر adapter باید در آینده مسئول contract مشخص خود باشد، از جمله:

- chain identity
- network/environment
- address validation
- transaction identification
- transaction observation
- transaction parsing
- token/asset identification
- decimals
- fee/gas semantics
- confirmation/finality semantics
- signing requirements
- payment verification
- explorer metadata

Shared layers نباید منطق اختصاصی یک chain را پنهانی داخل خود hard-code کنند.

## 73. Chain-Neutral Domain Model

Domain model باید chain-neutral باشد، ولی اطلاعات chain-specific را از بین نبرد.

حداقل مفاهیم آینده:

- `chain`
- `network`
- `asset`
- `assetType`
- `assetIdentifier`
- `contractOrMint`
- `decimals`
- `tokenProgram`
- `address`
- `transactionId`
- `confirmationState`
- `finality`
- `feeModel`
- `verificationModel`

در Solana فعلی `mint` و `tokenProgram` معنادارند؛ در EVM ممکن است `contractAddress` و event/log semantics لازم شود؛ در Bitcoin مدل دیگری لازم است.

هیچ field آینده‌نگر نباید به زور semantics یک chain را بر chain دیگر تحمیل کند.

## 74. Payment Intent در معماری Multi-Chain

Payment Intent باید در سطح domain قابلیت chain selection داشته باشد، اما در نسخه فعلی مقدار فعال فقط `solana` باشد.

مدل آینده باید بتواند موارد زیر را snapshot کند:

- chain
- network
- asset
- asset identifier
- amount atomic
- decimals
- destination
- reference/correlation mechanism
- fee policy
- fee payer
- gateway fee
- customer total
- merchant settlement
- expiry
- verification policy
- confirmation policy
- settlement policy
- referral snapshot
- gas policy

برای هر Payment Intent، chain و asset policy باید server-authoritative و immutable در حد contract باشند.

## 75. Solana First Release Contract

تا زمانی که تصمیم رسمی برای chain جدید گرفته نشده، Solana تنها chain فعال است.

دارایی‌های فعلی Pay باید بر اساس contract واقعی repository و environment configuration مدیریت شوند؛ در وضعیت فعلی release، assetهای پشتیبانی‌شده `SOL`، `USDC` و `USDT` هستند و token configuration از environment/backend می‌آید.

هیچ UI یا API نباید پشتیبانی از token یا mint دلخواه کاربر را القا کند.

## 76. Helios / Solana RPC Runtime Rule

Solana RPC provider در معماری فعلی از abstraction مربوط به Solana RPC استفاده می‌کند.

**وضعیت عملیاتی شناخته‌شده:** `SOLANA_RPC_URL` در Cloudflare → Workers & Pages → `solsite` → **Choose Environment: Production** → **Variables and Secrets** وجود دارد و برای production باید همان configuration واقعی استفاده شود.

هوش مصنوعی/توسعه‌دهنده نباید بدون بررسی واقعی configuration ادعا کند `SOLANA_RPC_URL` وجود ندارد یا کاربر را برای ساخت دوباره آن راهنمایی کند.

در production:

- secret/value واقعی هرگز داخل source code commit نشود
- RPC URL در client expose نشود مگر contract صریحاً public بودن آن را تعریف کند
- Solana RPC access از server-side/provider abstraction عبور کند
- failure، timeout، rate limit و provider outage به شکل کنترل‌شده مدیریت شود
- provider change نباید domain logic را تغییر دهد

استفاده فعلی از **Helius** به عنوان Solana RPC provider باید در deployment/configuration واقعی لحاظ شود.

## 77. Wallet Core: Multi-Chain Ready

هسته Wallet SolMint باید از ابتدا chain adapter داشته باشد.

مدل مفهومی:

`Wallet Core
  ├── Secure Key/Seed Management
  ├── Account Derivation
  ├── Chain Registry
  ├── Solana Adapter (ACTIVE)
  ├── EVM Adapter (FUTURE)
  ├── Bitcoin Adapter (FUTURE)
  └── Other Adapters`

هسته مشترک باید مسئول:

- account lifecycle
- secure storage
- authorization for signing
- account selection
- backup/recovery UX
- chain/account presentation

باشد.

Chain adapter مسئول derivation، address، signing format و transaction model همان chain باشد.

**هیچ‌گاه فرض نشود یک private key یا derivation path با semantics یکسان در تمام blockchainها قابل استفاده است.**

## 78. Wallet Security Boundary

Seed/private key باید local-only باقی بماند مگر architecture رسمی آینده خلاف آن را تعریف کند.

هیچ multi-chain abstraction نباید باعث شود:

- private key به Backend ارسال شود
- seed در database ذخیره شود
- signing server-side شود بدون architecture مستقل و audited
- secret وارد logs/analytics شود
- chain adapter بتواند بدون consent کاربر تراکنش امضا کند

Wallet core باید secure-by-default باشد.

## 79. Wallet Connectivity Strategy

برای Solana فعلی، اتصال نباید برای همیشه به یک provider خاص وابسته بماند.

لایه connection باید در آینده قابلیت پشتیبانی از walletهای استاندارد Solana، browser wallets، mobile/deep-link و hardware walletها را داشته باشد.

در وضعیت فعلی، هر ادعای «پشتیبانی از همه کیف پول‌ها» ممنوع است مگر evidence واقعی integration وجود داشته باشد.

در آینده باید connection abstraction از UI جدا شود:

`UI → Wallet Connection Service → Chain/Wallet Adapter → Wallet`

## 80. Multi-Chain Pay Verification Architecture

Verification باید chain-specific adapter داشته باشد:

`Payment Verification Engine
        ↓
Chain Verification Adapter
        ├── Solana Verification (ACTIVE)
        ├── EVM Verification (FUTURE)
        ├── Bitcoin Verification (FUTURE)
        └── Other Verification`

هر adapter باید transaction را بر اساس rules همان chain بررسی کند.

برای Solana، evidence شامل transaction signature، slot، block time، success، commitment، fee payer، transfers، destination، asset، amount و reference/correlation است.

در chainهای آینده، مدل evidence ممکن است transaction receipt، contract event، UTXO، block confirmations یا semantics دیگری باشد.

## 81. Finality و Confirmation را Generic اما دقیق طراحی کن

`confirmed`، `finalized`، block confirmation و transaction success در همه شبکه‌ها معنی یکسان ندارند.

Domain باید مفهوم کلی `confirmation/finality state` داشته باشد، ولی adapter باید semantics واقعی chain را تعیین کند.

UI فقط mapping authoritative را نمایش دهد.

## 82. Asset Registry

برای جلوگیری از hard-code کردن assetها، یک Asset Registry/Policy Layer باید در معماری آینده وجود داشته باشد.

هر asset باید حداقل metadata داشته باشد:

- chain
- network
- symbol
- canonical identifier
- mint یا contract address در صورت وجود
- token program در صورت وجود
- decimals
- display precision
- enabled/disabled
- deposit/payment eligibility
- fee eligibility
- explorer metadata

در نسخه فعلی، registry فقط Solana assetهای مجاز release را فعال کند.

## 83. Network Registry

Network نیز باید از asset جدا باشد.

مثلاً در آینده یک asset symbol می‌تواند در چند network وجود داشته باشد و نباید صرفاً با `USDC` شناسایی شود.

Network registry باید بتواند:

- chain
- environment
- network identifier
- RPC provider reference
- explorer base
- confirmation policy
- enabled status

را مدیریت کند.

مقادیر production نباید از UI قابل جعل باشند.

## 84. Fee / Gas Architecture

Fee model باید chain-aware باشد.

در Solana فعلی:

- gateway fee
- merchant/customer fee payer
- network fee/gas policy

از هم جدا هستند.

در آینده EVM ممکن است gas، priority fee، base fee، token payment fee یا sponsor model متفاوت داشته باشد. Bitcoin و سایر شبکه‌ها نیز مدل خود را دارند.

نباید `gas` را به عنوان synonym universal برای همه network fees فرض کرد.

## 85. Accounting و Ledger در Multi-Chain

Ledger باید در آینده بتواند chain و asset را بدون از دست دادن atomic precision ثبت کند.

حداقل در مدل آینده:

- chain
- network
- asset identifier
- atomic amount
- decimal metadata
- transaction reference
- payment intent
- merchant
- settlement event
- fee event
- refund/reversal
- referral liability
- gas/network cost

باید قابل ردیابی باشد.

**Principal، SolMint revenue، referral liability و network cost هرگز با هم یکی نشوند.**

## 86. Cross-Chain ممنوع در نسخه فعلی

نسخه فعلی Pay نباید bridge، swap یا cross-chain settlement را بخشی از payment truth بداند.

اگر در آینده چنین محصولی اضافه شد، باید یک subsystem مستقل با risk model، liquidity model، slippage، bridge/provider trust و reconciliation مستقل داشته باشد.

درگاه فعلی فقط پرداخت native در chain انتخاب‌شده را هدف قرار می‌دهد.

## 87. Merchant API باید آینده‌پذیر باشد

Merchant API باید از امروز برای integrations ساخته شود، نه فقط برای UI فعلی.

API contract آینده باید قابلیت این مفاهیم را داشته باشد:

- create payment intent
- retrieve payment intent
- payment status
- checkout URL
- idempotency
- API key scopes
- merchant isolation
- webhooks
- refunds
- invoices
- payment links
- reconciliation evidence
- pagination
- filtering
- versioning
- request/correlation IDs

در نسخه فعلی فقط endpointهای واقعاً موجود و release شده قابل استفاده‌اند.

## 88. API Versioning و Compatibility

Public Merchant API باید versioned باشد.

Breaking change نباید silently روی integrationهای merchant اعمال شود.

برای هر version باید:

- request schema
- response schema
- error schema
- authentication
- scopes
- idempotency rules
- lifecycle semantics
- deprecation policy

مستند شود.

## 89. API Key Lifecycle

Merchant API key subsystem باید production-grade باشد:

- create
- display-once secret handling
- scope
- restrict
- rotate
- revoke
- last used
- created at
- expiry در صورت پشتیبانی
- audit event

Secret باید hash/securely stored server-side و فقط طبق contract در لحظه ایجاد قابل مشاهده باشد.

## 90. Webhook Architecture

Webhook باید یک delivery subsystem واقعی باشد، نه فقط HTTP POST ساده.

نیازهای آینده:

- event types
- endpoint registration
- secret/signing
- canonical payload
- event ID
- delivery ID
- idempotent delivery
- retry/backoff
- timeout
- delivery status
- failure reason
- replay/manual retry با authorization
- dead-letter handling در صورت نیاز
- audit trail

Webhook اعلام‌کننده event است، نه creator حقیقت مالی.

## 91. Webhook Event Semantics

Event باید state transition یا authoritative event را منتقل کند، نه نتیجه حدس client.

نمونه مفهومی:

- payment.created
- payment.pending
- payment.confirmed
- payment.completed
- payment.failed
- payment.expired
- payment.refunded
- invoice.created
- invoice.paid
- merchant.updated

نام‌ها فقط زمانی contract محسوب می‌شوند که در Backend/OpenAPI واقعاً release شده باشند.

## 92. Checkout URL و Integration Contract

برای integrationهای خارجی باید یک checkout contract پایدار وجود داشته باشد.

Merchant backend باید بتواند Payment Intent بسازد و کاربر را به checkout هدایت کند، بدون اینکه secret API وارد browser شود.

Browser/customer فقط checkout token/identifier مورد نیاز contract را دریافت کند.

Checkout URL نباید شامل API secret، private key یا اطلاعات حساس غیرضروری باشد.

## 93. WordPress / WooCommerce Integration

SolMint Pay باید از نظر معماری برای **WordPress و WooCommerce** آماده شود.

هدف محصول آینده:

`WooCommerce Store
→ SolMint Pay Plugin
→ Merchant API
→ Payment Intent
→ SolMint Pay Checkout
→ Solana Payment
→ Authoritative Verification
→ Webhook
→ WooCommerce marks order paid`

Plugin نباید API secret را در JavaScript browser یا source قابل مشاهده client قرار دهد.

Secret باید server-side در WordPress نگهداری شود و ارتباط plugin با Merchant API server-to-server باشد.

Plugin آینده باید قابلیت‌های زیر را داشته باشد:

- merchant API configuration
- environment selection
- API key validation
- payment method configuration
- supported Solana assets
- checkout redirect
- order/payment ID mapping
- webhook validation
- order status synchronization
- retry/reconciliation
- logs بدون secret
- admin settings
- compatibility با WooCommerce lifecycle

هیچ WordPress/WooCommerce plugin در repository فعلی وجود ندارد مگر اینکه بررسی بعدی خلاف آن را نشان دهد؛ بنابراین نباید وجود integration را ادعا کرد.

## 94. WordPress Plugin Boundary

WordPress integration باید package/plugin مستقل باشد و به database داخلی SolMint دسترسی مستقیم نداشته باشد.

Plugin فقط Merchant API و Webhook contract رسمی را مصرف کند.

هیچ SQL/RPC داخلی SolMint نباید در plugin قرار گیرد.

## 95. Android SDK

SolMint Pay باید در roadmap رسمی خود یک **Official Android Merchant SDK** داشته باشد.

هدف:

`Android Merchant App
→ SolMint Pay Android SDK
→ Merchant Backend / Merchant API
→ Payment Intent
→ SolMint Pay Checkout / Payment Flow`

SDK نباید merchant secret را در APK نگهداری کند.

SDK باید client/integration helper باشد و authority مالی در Merchant Backend + SolMint Pay باقی بماند.

## 96. Android SDK Scope

نسخه آینده SDK باید در حد contract رسمی بتواند:

- initialize
- environment configuration
- create/obtain checkout session via merchant backend integration
- open checkout
- observe payment UI state
- handle deep links/app links
- return payment result
- query authoritative status
- expose request/correlation ID
- support localization
- handle lifecycle/background/resume

را ارائه کند.

SDK نباید:

- API secret را داخل app ذخیره کند
- private key merchant را مدیریت کند
- payment success را خودش تعیین کند
- مستقیم به Supabase/RPC داخلی وصل شود
- Solana RPC را جای backend verification قرار دهد

## 97. Android SDK و Wallet Interaction

اگر در آینده SDK برای customer wallet connection لازم باشد، wallet signing باید از طریق استانداردهای wallet/deep-link همان chain انجام شود.

SDK نباید کلید کاربر را استخراج یا ذخیره کند.

در Solana-first release، integration باید با walletهای واقعی و supported compatibility layer کار کند و در future chainها adapter جدا داشته باشد.

## 98. SDKهای آینده

معماری developer platform باید امکان SDKهای زیر را در آینده فراهم کند:

- Android/Kotlin
- iOS/Swift
- JavaScript/TypeScript
- Node.js
- PHP
- Python

اما تا زمانی که contract و test suite رسمی وجود ندارد، SDK نباید fake یا generated-only اعلام شود.

## 99. Developer Portal

Developer section آینده باید از Dashboard صرفاً ظاهری فراتر رود و شامل:

- API documentation
- authentication guide
- API keys
- scopes
- webhooks
- event catalog
- checkout integration
- payment lifecycle
- idempotency
- error codes
- SDK documentation
- code examples
- test/sandbox guidance
- versioning
- changelog
- security guidance

باشد.

## 100. Sandbox / Test Environment

برای رشد ecosystem باید sandbox/test strategy مستقل وجود داشته باشد.

Production نباید محل fixtureهای جعلی برای اثبات E2E باشد.

Test environment باید برای:

- payment lifecycle
- webhook delivery
- API key
- retries
- refunds
- underpayment/overpayment
- failed transactions
- merchant isolation
- SDK integration
- WordPress integration

قابل استفاده باشد.

## 101. Production Data Integrity

هر ادعای production-ready باید با evidence واقعی پشتیبانی شود.

وجود صفر merchant یا صفر payment در production به معنی failure نیست، اما به این معنی است که نباید E2E واقعی production payment را ادعا کنیم.

هر fixture آزمایشی باید environment-appropriate باشد و fake payment نباید وارد production شود.

## 102. Current Repository Reality — 2026-09-09

این سند باید با وضعیت واقعی فعلی منطبق بماند.

وضعیت شناخته‌شده در زمان این نسخه:

- repository: `azad2022/solsite`
- Better Auth در main ادغام شده و UI login/registration واقعی دارد
- Pay دارای Payment Intent creation، public Payment Intent read، merchant onboarding/wallet challenge و authoritative verification/reconciliation primitives است
- Pay frontend در `src/pay/` وجود دارد و `PayApp.tsx` و `PayCheckout.tsx` در آن هستند
- Payment verification از Solana RPC provider abstraction استفاده می‌کند
- `SOLANA_RPC_URL` در Production Variables and Secrets محیط production وجود دارد
- Helius provider باید به عنوان RPC production فعلی در نظر گرفته شود
- RLS identity bridge برای Pay وجود دارد
- Pay هنوز از نظر Merchant Platform، Developer Platform و integration ecosystem کامل نشده است
- WordPress/WooCommerce plugin در repository فعلی وجود ندارد
- Android SDK رسمی در repository فعلی وجود ندارد
- multi-chain در نسخه فعلی **فعال نیست** و فقط باید architecture-ready باشد

این بخش باید در هر audit بعدی با repository و production evidence دوباره بررسی و در صورت تغییر update شود.

## 103. Current Solana Checkout Reality

Checkout فعلی در repository به browser wallet provider متکی است و نباید تا زمان تکمیل universal wallet abstraction ادعا شود همه walletها پشتیبانی می‌شوند.

Backend verification wallet-name agnostic است تا زمانی که transaction evidence با payment policy منطبق باشد.

بنابراین roadmap باید دو لایه داشته باشد:

1. **Current:** Solana checkout + supported browser wallet provider path
2. **Next:** standardized Solana wallet connectivity + mobile/deep-link + hardware wallet support where feasible

## 104. Current Pay Product Boundary

در وضعیت فعلی، Pay را باید از نظر product maturity به صورت زیر توصیف کرد:

`Payment Engine + Solana Checkout + Merchant Onboarding + Verification/Reconciliation`

نه هنوز به عنوان یک Merchant Gateway Platform کامل.

برای رسیدن به محصول کامل باید Merchant Dashboard، transaction operations، API key lifecycle، webhooks، invoices/payment links، refunds، reports، tickets، developer docs، SDKs، WordPress/WooCommerce integration، Android integration، operational controls و E2E evidence تکمیل شوند.

## 105. Known Implementation Audit Rule: Fee Configuration

هر implementation جدید باید بررسی کند که gateway fee واقعاً از merchant configuration و contract رسمی خوانده می‌شود یا نه.

در وضعیت بررسی‌شده فعلی، Payment Intent creation در `functions/api/pay/v1/payment-intents.ts` snapshot fee را با `100` bps محاسبه و ارسال می‌کند. در حالی که domain/database دارای مفهوم `gateway_fee_bps` است.

این مورد باید قبل از ادعای «merchant-configurable fee» به صورت repository-first بررسی و در صورت تأیید contract، اصلاح شود.

AI نباید بدون بررسی live schema و code مسیر fee را حدس بزند یا UI برای fee setting بسازد که Backend آن را واقعاً enforce نمی‌کند.

## 106. Current Public API Contract Rule

Public OpenAPI باید فقط contractهایی را اعلام کند که واقعاً release شده‌اند.

در وضعیت فعلی، public OpenAPI محدود به contractهای release شده Pay است و نباید UI برای endpointهای داخلی یا planned بسازد.

هر feature جدید ابتدا باید:

`Backend implementation → contract test → OpenAPI/documentation → frontend integration`

را طی کند، مگر اینکه feature صرفاً internal و خارج از public contract باشد.

## 107. Integration Security Model

تمام integrationهای آینده باید این اصل را رعایت کنند:

`Customer App / Browser / WordPress Plugin / Android SDK
        ↓
Merchant Backend (when secret is required)
        ↓
SolMint Pay Merchant API
        ↓
Payment Engine
        ↓
Blockchain + Verification + Reconciliation`

API secret نباید در customer browser، APK، WordPress frontend JavaScript یا public source قرار گیرد.

## 108. Merchant Integration Lifecycle

Merchant باید بتواند از یک مسیر استاندارد:

1. Create account
2. Create merchant
3. Verify receiving wallet
4. Configure assets
5. Create API key
6. Configure webhook
7. Create test payment
8. Verify callback
9. Move to production
10. Monitor payments
11. Rotate/revoke credentials

عبور کند.

هر مرحله باید backend-authoritative و auditable باشد.

## 109. Refund Architecture

Refund را نباید صرفاً UI button فرض کرد.

Refund آینده باید contract مستقل داشته باشد:

- authorization
- refund eligibility
- amount
- asset
- destination
- reason
- idempotency
- state
- transaction evidence
- accounting reversal
- webhook event
- audit log

تا زمانی که backend contract واقعی refund وجود ندارد، UI نباید refund operation خیالی بسازد.

## 110. Operational Controls

برای production gateway باید roadmap آینده شامل:

- rate limits
- abuse protection
- API key restrictions
- webhook failure monitoring
- RPC health
- reconciliation lag
- stuck payments
- stale intents
- failed settlement
- suspicious activity signals
- audit logs
- incident handling
- rollback
- feature flags

باشد.

## 111. Reconciliation Operations

Reconciliation باید قابل مشاهده و operationally actionable شود.

Merchant/support/admin باید بتواند در حد authorization ببیند:

- verification attempt
- observed transaction
- candidate match
- rejection reason
- authoritative outcome
- reconciliation status
- timestamps
- request/correlation ID

UI نباید reconciliation engine را duplicate کند.

## 112. Payment Lifecycle Contract

Payment lifecycle باید به صورت یک state machine واحد تعریف شود و تمام surfaces از آن استفاده کنند:

`Created → Pending → Detected/Verification Pending → Confirming → Confirmed/Completed`

و branchهای failure/exception مانند:

`Underpaid / Overpaid / Wrong Asset / Wrong Destination / Ambiguous / Failed / Expired / Refunded`

نام دقیق stateها باید از domain contract واقعی repository گرفته شود. UI نباید دو state متفاوت را با یک label گمراه‌کننده نمایش دهد.

## 113. Idempotency Everywhere It Matters

تمام mutationهای مالی/integration باید idempotency semantics مشخص داشته باشند، خصوصاً:

- create payment
- invoice creation
- payment link creation
- refund
- API key mutation
- webhook mutation
- payout/withdrawal

Idempotency باید server-side enforce شود؛ client فقط آن را درست مصرف کند.

## 114. Pagination / Query Scalability

Merchant Platform نباید با فرض صدها یا هزاران رکورد طراحی شود.

تمام list APIs باید در صورت نیاز:

- pagination
- cursor/offset contract
- filtering
- sorting
- date range
- bounded query size

داشته باشند.

Frontend نباید تمام transactionها را یکجا دریافت کند.

## 115. Privacy / Data Minimization

Customer data فقط به اندازه نیاز محصول جمع‌آوری و نمایش داده شود.

Merchant dashboard نباید اطلاعات شخصی غیرضروری را نشان دهد.

Logs، analytics، tickets و SDK telemetry باید data minimization و secret redaction داشته باشند.

## 116. Auditability

برای هر عملیات حساس باید بتوان در حد authorization مسیر زیر را دنبال کرد:

`Actor → Request ID → API operation → Backend decision → DB event/ledger → Blockchain evidence → Final state`

UI باید در صورت وجود contract، شناسه‌های لازم را برای support و audit نمایش دهد، بدون افشای secret.

## 117. Product Extensibility Rule

قبل از افزودن feature جدید، بررسی شود آیا feature به یکی از این capabilityها نیاز دارد:

- chain adapter
- asset registry
- network registry
- merchant API
- webhook
- SDK
- authentication/authorization
- ledger/accounting
- notification
- audit log
- feature flag
- observability

اگر پاسخ مثبت است، capability باید در جای صحیح معماری اضافه شود و نباید فقط در یک صفحه hard-code شود.

## 118. Future Product Family

معماری نهایی باید امکان رشد از یک gateway به یک product family را فراهم کند، بدون اینکه نسخه Solana فعلی پیچیده و ناپایدار شود.

محصولات آینده می‌توانند در سطح architecture شامل:

- Solana Pay Gateway
- Multi-Chain Pay
- Merchant API Platform
- Android Merchant SDK
- iOS SDK
- JavaScript/Node SDK
- PHP/WordPress/WooCommerce integration
- Payment Links
- Invoices
- Subscription/recurring payments در صورت نیاز آینده
- Merchant analytics
- Developer portal
- Wallet integrations

باشند.

هر محصول جدید باید capabilityهای مشترک را reuse کند، ولی domainهای متفاوت را مخلوط نکند.

## 119. Roadmap — Phase 0: Freeze Facts

قبل از implementation:

- repository audit
- main/branch/commit verification
- current files
- current APIs
- DB schema
- migrations
- RLS
- auth
- runtime variables
- production configuration
- RPC provider
- current tests/CI

ثبت شود.

**خروجی:** baseline واقعی و بدون حدس.

## 120. Roadmap — Phase 1: Stabilize Current Solana Pay

تمرکز فعلی:

- Login/Registration
- Merchant onboarding
- wallet verification
- Payment Intent
- Solana checkout
- authoritative verification
- reconciliation
- accounting
- RLS
- production configuration
- error handling
- state machine
- tests

در این مرحله chain دوم فعال نمی‌شود.

## 121. Roadmap — Phase 2: Merchant Gateway Platform

تکمیل:

- Overview
- Transactions
- Transaction detail
- Customers
- Merchants
- payment links
- invoices
- API keys
- webhooks
- webhook delivery history
- refunds
- reports
- tickets
- notifications
- security
- developer portal

تمام integrationها باید با backend contract واقعی انجام شوند.

## 122. Roadmap — Phase 3: Integration Foundation

ساخت و تثبیت:

- public Merchant API v1
- API versioning
- OpenAPI
- API key lifecycle
- webhook event catalog
- checkout URL contract
- idempotency contract
- error contract
- sandbox/test strategy
- integration examples
- SDK architecture

## 123. Roadmap — Phase 4: WordPress/WooCommerce

اول plugin server-side architecture و contract tests، سپس:

- plugin settings
- API credentials
- payment gateway integration
- checkout redirect
- callback/webhook verification
- WooCommerce order mapping
- status synchronization
- retry/reconciliation
- admin UX
- security review
- compatibility tests
- release packaging

## 124. Roadmap — Phase 5: Android SDK

اول contract و architecture، سپس:

- Kotlin SDK
- API integration boundary
- checkout session
- deep link/app link
- lifecycle handling
- result handling
- authoritative status refresh
- localization
- error model
- sample app
- instrumentation tests
- security review
- release/versioning strategy

## 125. Roadmap — Phase 6: Wallet Multi-Chain Core

در این مرحله Wallet Core را توسعه می‌دهیم:

- chain registry
- account model
- secure key abstraction
- Solana adapter
- EVM adapter
- Bitcoin adapter در صورت تصمیم محصول
- wallet connection abstraction
- mobile wallet connectivity
- hardware wallet strategy

ولی chainهای Pay فقط پس از readiness کامل فعال می‌شوند.

## 126. Roadmap — Phase 7: First Additional Chain

اولین chain جدید فقط پس از gateهای زیر:

- chain adapter
- asset registry
- network registry
- address validation
- transaction parser
- verification adapter
- confirmation policy
- fee model
- accounting
- webhook events
- API contract
- checkout UX
- test matrix
- security review
- E2E evidence
- production rollback plan

سپس chain به صورت feature-flagged فعال شود.

## 127. Roadmap — Phase 8: Multi-Chain Expansion

پس از موفقیت chain اول، chainهای بعدی یکی‌یکی اضافه شوند.

هیچ batch بزرگ و uncontrolled از چند blockchain نباید بدون تست مستقل وارد production شود.

## 128. Chain Addition Gate

هیچ chain جدیدی «supported» محسوب نمی‌شود مگر اینکه تمام موارد زیر evidence داشته باشند:

- wallet support
- address validation
- asset policy
- transaction observation
- verification
- reconciliation
- finality/confirmation
- fees
- accounting
- API
- webhooks
- checkout
- SDK/integration impact
- monitoring
- tests
- documentation
- rollback

## 129. Feature Flagging

Chain و assetهای آینده باید قابلیت gradual rollout داشته باشند.

Feature flag نباید جای authorization یا security policy را بگیرد.

Backend باید source of truth برای enabled/disabled بودن chain و asset باشد.

## 130. Documentation as Contract

این فایل، OpenAPI، API docs، domain types، migration docs و code باید همگام باشند.

هر feature release باید documentation update داشته باشد.

Documentation نباید capability planned را به شکل available معرفی کند.

## 131. AI Development Safety Rules

هر AI که روی پروژه کار می‌کند باید قبل از تغییر:

1. repository را inspect کند
2. commit/branch واقعی را ببیند
3. فایل‌های مرتبط را بخواند
4. backend contract را بررسی کند
5. DB/RLS را بررسی کند
6. production/runtime assumptions را بررسی کند
7. existing tests را بررسی کند
8. فقط سپس implementation پیشنهاد یا اعمال کند

AI نباید به دلیل ناقص بودن context، endpoint، table، secret، environment variable، wallet support یا chain support را اختراع کند.

## 132. AI Must Distinguish Facts From Plans

در گزارش‌ها و commitها باید این سه وضعیت از هم جدا باشند:

- **Implemented / Verified**
- **Planned / Architecturally Prepared**
- **Missing / Blocked**

`Planned` هرگز به `Implemented` تبدیل نشود.

`Multi-Chain Ready` هرگز به معنی `Multi-Chain Enabled` نیست.

## 133. AI Must Respect Production Configuration

اگر production environment variable یا secret در Cloudflare وجود دارد، AI باید ابتدا configuration واقعی را بررسی کند.

برای این پروژه، وجود `SOLANA_RPC_URL` در Production Variables and Secrets یک fact عملیاتی شناخته‌شده است و Helius provider فعلی باید در بررسی production لحاظ شود.

AI نباید با مشاهده نبودن variable در source code نتیجه بگیرد variable در Cloudflare وجود ندارد.

## 134. No Fake Completion

موارد زیر ممنوع است:

- UI سبز برای endpointی که وجود ندارد
- mock payment در production path
- fake webhook success
- fake API key
- fake wallet verification
- fake SDK API
- fake WordPress integration
- fake chain support
- fake E2E evidence
- ادعای production-ready بدون evidence

## 135. Final Release Gates

قبل از release اصلی SolMint Pay باید این gateها پاس شوند:

### Product

- Customer Checkout
- Merchant Dashboard
- Transactions
- Merchant Management
- Payment Links
- Invoices
- API Keys
- Webhooks
- Refunds
- Reports
- Referrals
- Tickets
- Notifications
- Security

### Backend

- API contracts
- authorization
- RLS
- payment state machine
- verification
- reconciliation
- accounting
- idempotency
- rate limiting
- auditability

### Blockchain

- Solana RPC
- asset policies
- transaction parsing
- confirmation policy
- authoritative verification
- reconciliation
- provider failure handling

### Integrations

- Merchant API
- OpenAPI
- Webhooks
- WordPress/WooCommerce
- Android SDK
- documentation

### Quality

- unit
- component
- integration
- E2E
- security
- accessibility
- responsive
- performance
- CI
- deployment
- rollback

## 136. Final Architecture Target

معماری هدف:

`                         SolMint Platform
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
     SolMint Wallet                         SolMint Pay
          │                                       │
     Wallet Core                              Gateway Core
          │                                       │
     Chain Registry                         Payment Intent
          │                                       │
   ┌──────┼──────┐                    ┌───────────┼───────────┐
   │      │      │                    │           │           │
 Solana  EVM  Bitcoin             Verification Accounting Integrations
   │      │      │                    │           │           │
   └──────┴──────┘                    └───────────┼───────────┘
                                                  │
                                   Merchant API / Webhooks / SDKs
                                                  │
                            ┌─────────────────────┼─────────────────────┐
                            │                     │                     │
                       Web Checkout       WordPress/WooCommerce   Android SDK
                            │                     │                     │
                            └─────────────────────┴─────────────────────┘

Current active blockchain boundary:

`Solana only`

Future capability boundary:

`Solana + additional chains through explicit audited adapters`

## 137. قانون طلایی توسعه آینده

هر developer یا AI باید قبل از اضافه کردن feature از خود بپرسد:

> «آیا این تغییر فقط feature امروز را حل می‌کند، یا architecture را برای productهای فردا خراب می‌کند؟»

راه‌حل باید هر دو را پوشش دهد:

**امروز:** Solana-first, production-grade Pay.

**فردا:** Multi-chain Wallet + Multi-chain Pay + Merchant API + Webhooks + WordPress/WooCommerce + Android SDK + سایر integrationها.

اما هیچ قابلیت آینده نباید تا زمانی که backend، security، verification، accounting، tests و operational evidence آن آماده نشده است به عنوان قابلیت فعال معرفی شود.

## 138. دستور نهایی به هوش مصنوعی

**قبل از هر تغییر، فکر کن، inspect کن، evidence جمع کن، contract را بفهم، impact را روی امروز و آینده بررسی کن، سپس تغییر حداقلی و production-grade اعمال کن.**

اگر چیزی در repository موجود نیست، آن را حدس نزن.

اگر چیزی planned است، آن را implemented اعلام نکن.

اگر چیزی در Cloudflare production configuration وجود دارد، نبودن آن در source code را به معنی نبودن آن در production تلقی نکن.

اگر chain جدید هنوز فعال نشده، آن را در UI/API به عنوان supported معرفی نکن.

اگر WordPress/WooCommerce یا Android SDK هنوز ساخته نشده‌اند، فقط architecture و roadmap آن‌ها را آماده کن؛ integration جعلی نساز.

اگر payment transaction فقط submitted شده است، success اعلام نکن.

اگر Backend authoritative state را نداده است، Frontend حق تصمیم‌گیری ندارد.

**SolMint Pay فعلاً یک درگاه پرداخت Solana است؛ اما باید از همین امروز به شکلی ساخته شود که فردا بدون بازنویسی بنیادی بتواند به یک زیرساخت پرداخت چندزنجیره‌ای و یک پلتفرم integration واقعی تبدیل شود.**
