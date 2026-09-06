# SolMint Pay — Frontend Master Specification & Engineering Direction

## 1. مأموریت

هدف، ساخت یک **Frontend حرفه‌ای، Production-Grade و مستقل برای درگاه پرداخت رمزارزی SolMint Pay** است.

این Frontend باید یک محصول واقعی پرداخت باشد، نه یک Dashboard نمایشی، Landing Page، Mockup یا نمونه MVP.

رابط کاربری باید کاملاً با Backend، Database، API، Payment Engine، Reconciliation، Accounting، Security و معماری فعلی SolMint Pay همگام باشد.

اصل بنیادین:

**Frontend فقط لایه‌ی Presentation و Interaction است؛ هیچ تصمیم مالی، امنیتی یا اعتبارسنجی authoritative نباید توسط Frontend گرفته شود.**

هر چیزی که در UI نمایش داده می‌شود باید در صورت امکان از state معتبر Backend دریافت شود.

# 2. قانون شماره یک: Repository First

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

# 3. مرز معماری Frontend

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

# 4. محصول باید با Backend هم‌راستا باشد

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

# 5. اصل امنیتی Frontend

Frontend هرگز trusted system نیست.

کاربر می‌تواند:

- request را تغییر دهد
- URL را تغییر دهد
- merchantId را تغییر دهد
- paymentId را تغییر دهد
- referral code را تغییر دهد
- amount را تغییر دهد
- response را دستکاری کند
- JavaScript را تغییر دهد
- API را مستقیماً صدا بزند
- state محلی را دستکاری کند

بنابراین:

هیچ تصمیم امنیتی یا مالی نباید صرفاً بر اساس Frontend state گرفته شود.

Frontend فقط باید state authoritative سرور را نمایش دهد.

# 6. Payment Intent

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

# 7. Payment UX

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

Frontend نباید:

`Transaction submitted`

را به معنی:

`Payment successful`

نمایش دهد.

Success فقط زمانی نمایش داده شود که Backend آن را authoritative اعلام کرده باشد.

# 8. Verification UX

Verification باید برای کاربر قابل فهم باشد اما جزئیات امنیتی خطرناک یا misleading نمایش داده نشود.

Frontend باید بتواند تفاوت میان:

- wallet connected
- transaction submitted
- transaction detected
- transaction confirming
- transaction verified
- payment finalized

را به شکل واضح نمایش دهد.

Reference صرفاً correlation/discovery است و نباید به‌عنوان proof of payment معرفی شود.

Webhook نیز نباید source of truth نمایش داده شود.

# 9. Merchant Dashboard

Merchant Dashboard باید یکی از هسته‌های اصلی محصول باشد.

ساختار پیشنهادی:

### Overview

نمایش:

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

هر KPI باید:

- timestamp
- time range
- unit
- currency
- comparison period

داشته باشد.

اعداد باید از Backend بیایند.

# 10. Transactions

صفحه Transactions باید یک مرکز عملیاتی واقعی باشد.

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

هر Transaction باید Detail Page داشته باشد.

Transaction Detail باید تا حد نیاز شامل:

- Payment Intent
- Payment State
- Blockchain Signature
- Verification State
- Merchant
- Amount
- Asset
- Fee
- Settlement
- timestamps
- failure/retry information
- reconciliation status

باشد.

# 11. Blockchain Information

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

Frontend نباید بدون evidence اطلاعاتی مانند:

- successful
- confirmed
- finalized
- paid

را خودش تعیین کند.

# 12. Merchant Management

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

# 13. Wallet UI

Frontend هیچ‌وقت نباید:

- seed phrase را به Backend ارسال کند
- private key را ارسال کند
- private key را در localStorage ناامن ذخیره کند
- secret را در analytics بفرستد
- secret را در logs قرار دهد
- secret را در URL قرار دهد

Wallet connection باید با مدل واقعی Solana سازگار باشد.

Wallet Address و SPL Token Account/ATA باید از نظر UI نیز با مفهوم درست نمایش داده شوند.

# 14. Referral / Affiliate Dashboard

Referral section باید مستقل و روشن باشد.

بخش‌ها:

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

Frontend نباید commission را خودش محاسبه authoritative کند.

Frontend فقط نتیجه محاسبه Backend را نمایش دهد.

# 15. Merchant vs Referral Accounting

این دو حوزه نباید از نظر UI با هم مخلوط شوند.

Merchant Principal:

پول اقتصادی Merchant

Gateway Revenue:

درآمد SolMint

Referral Liability:

تعهد مالی SolMint به Affiliate

Gas Cost:

هزینه زیرساخت/شبکه

Refund/Reversal:

اصلاح مالی

Dashboard باید این مفاهیم را دقیق و بدون ابهام نمایش دهد.

نباید از عباراتی استفاده شود که باعث شود Merchant تصور کند SolMint مالک principal او است، مگر واقعاً architecture محصول چنین چیزی را تعریف کرده باشد.

# 16. Reports & Analytics

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

# 17. Ticket / Support System

سیستم Ticket بخشی از محصول است، نه یک لینک تزئینی.

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

Ticket باید با Context مرتبط باشد؛ مثلاً:

- Payment ID
- Merchant ID
- Transaction Signature

در صورت امکان.

هیچ secret یا private key نباید به Ticket system راه پیدا کند.

# 18. Notifications

Notification center باید برای رویدادهای مهم استفاده شود:

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

Notification فقط notification است؛ source of truth مالی نیست.

# 19. Design Language

تم اصلی SolMint Pay باید:

**Light / Bright / Clean / Premium / Financial / Modern**

باشد.

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

از طراحی بیش‌ازحد شلوغ، gradientهای سنگین و animationهای غیرضروری پرهیز شود.

هدف:

**Stripe-like clarity + modern crypto identity + SolMint personality**

# 20. Pink Horned Dolphin Identity

ماسکات دلفین صورتی شاخ‌دار باید یکی از عناصر اصلی هویت برند باشد.

اما:

Mascot باید شخصیت برند باشد، نه عنصر مزاحم UI.

استفاده:

- Empty States
- Success States
- Onboarding
- Welcome
- Illustration
- Support
- Small Dashboard accents
- Loading states محدود
- Promotional areas

نباید mascot در تمام کارت‌ها و بخش‌ها تکرار شود.

لحن visual باید:

**Professional first, playful second**

باشد.

# 21. اختصاصی بودن Iconography

تا حد امکان از سیستم Icon اختصاصی SolMint Pay استفاده شود.

Iconها باید:

- ساده
- قابل تشخیص
- هماهنگ
- سبک
- مناسب UI مالی

باشند.

برای مفاهیم زیر می‌توان Icon اختصاصی داشت:

- Payment
- Settlement
- Revenue
- Referral
- Merchant
- Wallet
- Verification
- Security
- Ticket
- Webhook
- Invoice
- Refund
- Gas
- Analytics

Icon نباید صرفاً decorative باشد؛ باید semantic باشد.

# 22. Typography

متن‌های UI باید:

- کوتاه
- دقیق
- مستقیم
- قابل فهم
- بدون جمله‌های طولانی

باشند.

از متن‌های بازاریابی سنگین داخل Dashboard پرهیز شود.

مثال:

بد:

`به کمک پلتفرم قدرتمند و پیشرفته سولمینت پی می‌توانید...`

خوب:

`Payment verified`

یا در فارسی:

`پرداخت تأیید شد`

# 23. زبان و i18n

زیرساخت multilingual از ابتدا باید رعایت شود.

Localeهای فعلی:

- fa-IR
- en-US
- ar
- ru

RTL و LTR باید واقعی باشند.

هیچ متن کاربرمحور نباید hard-code شود.

ترجمه نباید صرفاً replace کلمات باشد.

اعداد، تاریخ، currency، status و error باید semantic و locale-aware باشند.

# 24. Language Switcher

زبان باید از طریق UI قابل تغییر باشد.

Language switcher باید:

- سریع
- واضح
- قابل دسترس
- RTL/LTR aware

باشد.

تغییر زبان نباید state مالی کاربر را خراب کند.

# 25. Responsive Design

Mobile First.

صفحات باید روی:

- Mobile
- Tablet
- Laptop
- Desktop
- Wide Desktop

قابل استفاده باشند.

Dashboard نباید صرفاً یک Desktop UI فشرده‌شده روی موبایل باشد.

در موبایل:

- Sidebar به Drawer تبدیل شود
- جدول‌ها responsive شوند
- KPIها stack شوند
- chartها usable باشند
- actions در دسترس باشند
- هیچ horizontal overflow ناخواسته وجود نداشته باشد

# 26. Accessibility

همه UIها باید دسترس‌پذیر باشند.

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

# 27. Data States

هر component داده‌ای باید حداقل این stateها را در نظر بگیرد:

- loading
- loaded
- empty
- error
- unauthorized
- forbidden
- stale
- retryable

Empty state نباید با Error state اشتباه شود.

# 28. Error Handling

Error message باید:

- کوتاه
- دقیق
- غیر فنی برای کاربر عادی
- قابل اقدام

باشد.

مثلاً:

بد:

`RPC Error 429 JSON-RPC ProviderException...`

خوب:

`بررسی پرداخت موقتاً در دسترس نیست. دوباره تلاش کنید.`

اما اطلاعات فنی باید در telemetry/server logs حفظ شوند، نه اینکه حذف شوند.

# 29. Retry Behaviour

Retry باید با نوع خطا متناسب باشد.

برای مواردی مثل:

- network failure
- timeout
- temporary RPC/backend failure

می‌توان retry کرد.

اما برای:

- invalid payment
- wrong recipient
- wrong token
- unauthorized
- duplicate operation
- rejected state

نباید retry کورکورانه انجام شود.

# 30. Concurrency

Frontend نباید duplicate mutation ایجاد کند.

برای عملیات حساس:

- Create Payment
- Create Invoice
- Wallet Verification
- Withdrawal
- API Key creation
- Webhook action

باید:

- loading state
- disabled submit
- request identity
- idempotency awareness
- race prevention

در نظر گرفته شود.

# 31. Financial Display Rules

هیچ مبلغ مالی نباید با floating-point برای تصمیم‌گیری محاسبه شود.

Frontend باید ترجیحاً مقادیر authoritative آماده‌شده توسط Backend را نمایش دهد.

برای نمایش:

- decimals صحیح
- currency
- atomic units
- localized format

رعایت شود.

گرد کردن UI نباید باعث تغییر معنای مبلغ واقعی شود.

# 32. Security UX

امنیت باید در UI قابل مشاهده ولی غیرترساننده باشد.

موارد قابل نمایش:

- Wallet verified
- Secure connection
- Webhook signing
- API key last used
- security events
- session activity
- payout wallet verified

اما UI نباید ادعا کند چیزی امن است مگر آنکه Backend/architecture واقعاً آن را تضمین کند.

# 33. API Keys

API Key UI باید شامل:

- Create
- Revoke
- Last used
- Created date
- Scope/permission
- Status

باشد.

Secret key فقط در زمان مناسب و طبق قرارداد Backend نمایش داده شود.

نباید API secret:

- در URL
- logs
- analytics
- frontend persistent storage

قرار بگیرد.

# 34. Webhook UI

Webhook section باید شامل:

- Endpoint
- Status
- Secret status
- Last delivery
- Success rate
- Retry count
- Failed deliveries
- Delivery history
- Signature status

باشد.

Webhook dashboard باید notification/transport را از financial truth جدا نگه دارد.

# 35. Invoice & Payment Links

Merchant باید بتواند:

- Invoice ایجاد کند
- مبلغ تعیین کند
- Asset تعیین کند
- expiry تعیین کند
- توضیح اضافه کند
- Payment Link دریافت کند
- وضعیت Invoice را مشاهده کند

اما amount و payment policy authoritative باید با Backend هماهنگ باشد.

# 36. Onboarding

Onboarding باید ساده باشد.

ترتیب پیشنهادی:

1. Create Account
2. Create Merchant
3. Verify Wallet
4. Choose Payment Assets
5. Create First Payment Link
6. Receive Verified Payment
7. View Dashboard

از کاربران نباید اطلاعات اضافی و غیرضروری خواسته شود.

# 37. Dashboard Visual Hierarchy

صفحه اصلی Dashboard باید شبیه یک مرکز کنترل مالی باشد.

ساختار پیشنهادی:

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

طراحی باید تمیز باقی بماند و اطلاعات بیش از حد در صفحه نخست ریخته نشود.

# 38. Search

Search باید در صورت امکان global باشد.

قابل جستجو:

- Transaction ID
- Payment ID
- Signature
- Merchant
- Customer
- Ticket ID
- Invoice ID

Search result باید نوع entity را مشخص کند.

# 39. Tables

Tableهای مالی باید:

- sortable
- filterable
- paginated
- responsive
- readable

باشند.

در موبایل، table باید به Card/List قابل تبدیل باشد، نه اینکه متن فشرده و غیرقابل استفاده شود.

# 40. Charts

نمودارها باید برای فهم داده باشند، نه تزئین.

محدوده‌های زمانی مشخص داشته باشند.

Tooltip باید:

- date
- amount
- unit

را واضح نمایش دهد.

مقادیر نمودار باید از Backend-derived data بیایند.

# 41. State Synchronization

Frontend باید در موارد حساس state را refresh یا revalidate کند.

به‌خصوص:

- Payment status
- Withdrawal status
- Wallet verification
- Webhook delivery
- Ticket status
- Security events

نباید صرفاً روی cached client state تکیه شود.

# 42. Caching

Cache فقط برای داده‌ای مجاز است که stale بودن آن مشکلی برای business decision ایجاد نکند.

برای stateهای مالی و امنیتی:

freshness مهم‌تر از performance است.

# 43. Backend Contract Changes

هر تغییر Backend که روی:

- schema
- endpoint
- field
- state
- payment lifecycle
- authorization
- financial meaning

تأثیر می‌گذارد باید باعث بازبینی Frontend شود.

Frontend و Backend باید version-aware باشند.

# 44. No Contradiction Rule

هیچ‌گونه تناقض میان این موارد پذیرفته نیست:

- UI
- API
- DB
- Accounting
- Payment State Machine
- Verification
- Webhook
- Documentation

مثلاً اگر Backend می‌گوید payment:

`PENDING`

است، UI حق ندارد:

`PAID`

نمایش دهد.

اگر Backend می‌گوید wallet:

`UNVERIFIED`

است، UI حق ندارد آن را:

`Verified`

نمایش دهد.

اگر Backend می‌گوید withdrawal:

`PROCESSING`

است، UI حق ندارد:

`Paid`

نمایش دهد.

# 45. Loading & Skeleton

به‌جای spinnerهای متعدد و آزاردهنده، از skeleton مناسب استفاده شود.

Loading state باید layout را تا حد امکان ثابت نگه دارد.

# 46. Animation

Animation محدود و purposeful باشد.

مجاز:

- hover
- state transition
- skeleton
- drawer
- modal
- success confirmation

غیرمجاز:

- motion دائمی
- particleهای سنگین در Dashboard
- animationهای مزاحم
- استفاده از animation به جای information hierarchy

# 47. Performance

Frontend Pay باید سبک و سریع باشد.

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

# 48. Testing

Frontend Pay باید مستقل تست شود.

حداقل:

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

# 49. Financial Test Matrix

Frontend باید با این حالت‌ها آزمایش شود:

- valid payment
- underpayment
- overpayment
- wrong token
- wrong recipient
- wrong reference
- failed transaction
- expired payment
- duplicate payment
- replay
- ambiguous candidate
- RPC unavailable
- incomplete discovery
- concurrent reconciliation

در هیچ‌یک از این حالات UI نباید success جعلی نمایش دهد.

# 50. Observability

Frontend باید برای debugging امن اطلاعات لازم را ثبت کند.

اما هرگز:

- private key
- seed phrase
- API secret
- webhook secret
- authentication credential

را ثبت نکند.

Request ID / correlation ID در صورت وجود باید در UI و support flow قابل استفاده باشد.

# 51. Ticket / Incident Integration

برای خطاهای مهم، امکان ایجاد Ticket از context فعلی وجود داشته باشد.

مثلاً:

`Payment verification failed`

و کاربر بتواند همان Payment ID را به Ticket متصل کند.

اما اطلاعات حساس نباید خودکار ارسال شوند.

# 52. Visual Reference

طراحی مرجع Dashboard:

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

Mascot در Header/Onboarding/Empty States می‌تواند حضور داشته باشد اما نباید جای hierarchy داده را بگیرد.

# 53. Brand Personality

لحن برند:

**Professional + Trustworthy + Modern + Friendly**

نه:

- کودکانه
- بیش‌ازحد رسمی
- پرحرف
- تبلیغاتی
- gimmicky

SolMint Pay باید حس یک محصول مالی واقعی را بدهد.

# 54. Frontend Must Not Invent Business Rules

Frontend نباید خودش تعیین کند:

- payment موفق است
- commission قابل پرداخت است
- wallet معتبر است
- transaction نهایی شده
- merchant فعال است
- withdrawal قابل اجراست
- revenue ثبت شده
- refund موفق شده

این موارد باید از Backend authoritative state بیایند.

# 55. Frontend Must Reflect Backend State Machine

هر state machine موجود در Backend باید mapping مشخص در UI داشته باشد.

برای هر state مشخص شود:

- label
- icon
- description
- color/status treatment
- allowed action
- retry availability
- terminal/non-terminal status

این mapping باید مرکزی باشد و در چند component تکثیر نشود.

# 56. Routing

Routing باید مستقل و قابل گسترش باشد.

ساختار منطقی:

`/pay
/pay/login
/pay/onboarding
/pay/dashboard
/pay/transactions
/pay/transactions/:id
/pay/merchants
/pay/merchants/:id
/pay/customers
/pay/invoices
/pay/payments
/pay/referrals
/pay/referrals/withdrawals
/pay/tickets
/pay/reports
/pay/settings
/pay/developer
/pay/developer/api-keys
/pay/developer/webhooks
/pay/security`

مسیر نهایی باید با architecture واقعی repository و routing فعلی تطبیق داده شود؛ این فهرست contract قطعی routing نیست، بلکه architectural direction است.

# 57. Public Checkout vs Authenticated Panel

Customer Checkout نباید با Merchant Dashboard یکی فرض شود.

دو تجربه متفاوت‌اند:

### Customer

- بسیار ساده
- بدون پیچیدگی
- focused payment flow
- clear status

### Merchant

- data-rich
- analytics
- management
- operational controls

# 58. Merchant Isolation

UI باید tenant isolation را رعایت کند.

هیچ merchant نباید:

- merchant دیگر
- transaction دیگر
- webhook دیگر
- API key دیگر
- customer data دیگر

را مشاهده کند.

اما امنیت واقعی باید در Backend و DB/RLS enforce شود؛ UI فقط یک لایه دفاعی اضافه است.

# 59. Security Boundary

هیچ credential حساس نباید به client منتقل شود مگر مطابق contract امنیتی کاملاً مشخص.

Frontend نباید تبدیل شود به:

- signing oracle
- secret vault
- payment authority
- reconciliation engine
- accounting engine

# 60. Development Workflow

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

# 61. No Premature Launch

وجود UI به معنی آماده بودن محصول نیست.

فعال شدن `/pay` فقط زمانی مجاز است که:

- Backend
- Database
- RLS
- Authentication
- Authorization
- Wallet verification
- Payment verification
- Reconciliation
- Accounting
- Webhook
- Referral
- Security
- Observability
- Frontend
- i18n
- Accessibility
- Responsive UX
- E2E
- Deployment
- Rollback

همگی validation شده باشند.

# 62. Implementation Principle

اول functionality و correctness.

بعد:

- polish
- visual refinements
- micro-interactions
- animations
- advanced analytics
- visual enhancements

هیچ زیبایی بصری نباید باعث compromise در correctness شود.

# 63. Design System

قبل از ساخت تعداد زیادی صفحه، Design System مرکزی ایجاد شود.

شامل:

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

این Design System فقط برای Pay باشد و به UI فعلی Solmint وابسته نباشد مگر در موارد کاملاً ضروری.

# 64. Component Architecture

کامپوننت‌ها باید بر اساس responsibility تفکیک شوند.

مثلاً:

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

# 65. Service Boundary

UI نباید مستقیماً implementationهای backend/security را manipulate کند.

از service/client layer استفاده شود:

`Page
  ↓ Feature Component
  ↓ Pay Service / API Client
  ↓ Backend API
  ↓ Database / Blockchain / Reconciliation`

# 66. API Client

API client باید centralized باشد.

مسائل زیر نباید در هر component به‌صورت جداگانه پیاده شوند:

- authentication
- request ID
- error normalization
- timeout
- retry policy
- parsing
- unauthorized handling
- forbidden handling

# 67. No Duplicate Business Logic

مثلاً fee calculation نباید در:

- Checkout
- Dashboard
- Invoice
- Payment Detail

هرکدام جداگانه نوشته شود.

Business truth باید Backend باشد.

Frontend فقط display mapping داشته باشد.

# 68. UI as Financial Instrument

Dashboard باید مثل یک ابزار مالی واقعی طراحی شود.

هر عنصر باید پاسخ دهد:

- چه اتفاقی افتاده؟
- چه زمانی؟
- برای چه payment؟
- چه مقدار؟
- وضعیت چیست؟
- آیا نهایی است؟
- چه اقدامی ممکن است؟
- چه چیزی باید منتظر بماند؟

# 69. Final Product Standard

معیار پذیرش این Frontend:

اگر هزاران Merchant و مشتری واقعی امروز از SolMint Pay استفاده کنند، آیا می‌توانیم از UI از نظر correctness، امنیت، شفافیت مالی، دسترس‌پذیری، performance، consistency و maintainability دفاع کنیم؟

اگر پاسخ روشن «بله» نیست، feature هنوز تمام نشده است.

# 70. اصل نهایی

**Never design the UI first and force the backend to fit it.**

ابتدا:

`Repository → Architecture → Backend Contract → Database → Domain State → Security → API → UX → UI`

سپس implementation.

Frontend باید انعکاس دقیق سیستم باشد، نه نسخه‌ای خیالی از آن.

**هدف نهایی:**

یک پنل روشن، شیک، سریع، چندزبانه، امن، قابل حسابرسی و بسیار ساده برای استفاده که هویت SolMint را با ماسکات دلفین صورتی شاخ‌دار، آیکن‌های اختصاصی و طراحی مدرن نمایش دهد؛ در حالی که تمام داده‌ها، وضعیت‌های مالی و عملیات حساس کاملاً با Backend و معماری واقعی SolMint Pay همگام و منطبق باقی بمانند.
