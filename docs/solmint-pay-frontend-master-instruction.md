# SolMint Pay — Frontend Master Engineering Instruction

**Document role:** Canonical engineering direction for the SolMint Pay frontend.

**Repository:** `azad2022/solsite`

**Product route:** `/pay`

**Status:** Frontend implementation guide; not evidence that any feature is currently production-ready.

**Authority:** This document governs frontend design and implementation. For product/economic requirements, defer to `docs/solmint-pay-v1-product-contract.md`. For operational continuity, defer to `docs/solmint-pay-continuation.md`. For current implementation truth, inspect the actual repository, backend API, database, tests, CI and runtime state. Documentation alone is never implementation evidence.

---

## 1. Mission

Build a professional, production-grade, multilingual frontend for **SolMint Pay**, a real Solana cryptocurrency payment gateway.

The frontend is not a mock dashboard, landing page, prototype or MVP. It is a real product surface that must remain consistent with the Pay backend, database, blockchain verification, reconciliation, accounting, referral, webhook, authentication, authorization and security model.

The central rule is:

> **Frontend = presentation + interaction. Backend/database/blockchain verification = authority.**

Never move financial truth, authorization authority, reconciliation logic, transaction verification or security-critical business rules into the browser simply because doing so is convenient for UI implementation.

---

## 2. Non-Negotiable Engineering Rules

1. Repository first.
2. Backend contract before UI implementation.
3. Never invent APIs, fields, states, routes or business rules.
4. Never assume a file exists because documentation names it.
5. Never treat frontend state as authoritative financial/security state.
6. Never display success based only on a wallet popup, submitted signature, reference hit or webhook.
7. Never duplicate business logic in multiple UI components.
8. Never place secrets, seed phrases or private keys in frontend state, URLs, logs, telemetry or server requests.
9. Never break merchant tenant isolation.
10. Never use floating-point arithmetic for financial decisions.
11. Never make a retry change a terminal financial state into success.
12. Never activate `/pay` merely because the UI exists.
13. Never mark a feature complete while relevant tests, CI, security, accessibility or backend integration are incomplete.
14. Never modify unrelated parts of the existing Solmint site merely to make Pay easier to build.
15. When uncertainty exists, fail closed and investigate the real source of truth before coding.

---

## 3. Repository-First Procedure

Before touching code, inspect the current branch and HEAD and then inspect the relevant architecture.

At minimum review:

- `package.json`
- TypeScript configuration
- Vite/build configuration
- Cloudflare Pages/Functions runtime
- existing routing
- `src/pay/`
- Pay domain types
- Pay services
- Pay API routes under `functions/api/pay/`
- internal Pay reconciliation/webhook code
- Supabase migrations
- Pay database tests
- frontend tests
- E2E tests
- CI workflows
- authoritative Pay product contract
- continuation/handoff document

The current repository already contains a dedicated Pay boundary under `src/pay/` and uses React/TypeScript/Vite in the existing web platform. The Pay dependency boundary must remain intentionally isolated from unrelated site features.

Before implementing a new screen, search the repository for an existing type, service, API route, state mapping, test, design token or component that already represents the requirement.

Do not create a second implementation when a canonical one already exists.

---

## 4. Source-of-Truth Hierarchy

For financial and security decisions, use this order:

1. Database constraints and authoritative append-only financial state.
2. Server-side authentication, authorization and business rules.
3. Immutable Payment Intent snapshot.
4. Authoritatively verified blockchain observation.
5. API response derived from the above.
6. Frontend presentation state.
7. User input and client-local state.

A lower level must never override a higher level.

Examples:

- Local state cannot turn `pending` into `completed`.
- A query parameter cannot grant merchant access.
- A webhook cannot become payment truth.
- A transaction signature alone cannot become proof of payment.
- A frontend referral code cannot grant authorization.

---

## 5. Product Boundary

SolMint Pay is a separate payment product inside the `solsite` repository.

It must have a dedicated frontend boundary with:

- its own layouts
- its own components
- its own feature modules
- its own service/client layer
- its own design tokens
- its own i18n layer
- its own domain types where appropriate
- its own tests

Avoid coupling Pay pages to unrelated homepage, blog, wallet-content or CMS presentation logic.

Shared infrastructure may be reused only when the dependency is explicit, stable and does not transfer Pay business rules into the general site.

The architecture must remain capable of later extracting Pay into a separate application/package with minimal conceptual changes.

Suggested structure:

```text
src/pay/
├── app/
├── assets/
├── components/
├── features/
│   ├── checkout/
│   ├── dashboard/
│   ├── transactions/
│   ├── merchants/
│   ├── customers/
│   ├── invoices/
│   ├── referrals/
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
└── utils/
```

This is an architectural target, not permission to reorganize the repository blindly. First inspect the current structure and migrate incrementally where required.

---

## 6. Backend Contract Alignment

For every feature, write down the contract before implementing UI:

- endpoint(s)
- HTTP method
- authentication requirement
- authorization scope
- tenant/merchant scope
- request schema
- response schema
- authoritative fields
- state transitions
- error codes
- retryable errors
- terminal errors
- empty state
- stale-data behavior
- loading behavior

Use the actual repository implementation and tests as evidence. If the API is incomplete for the desired UX, do not fabricate a client-side workaround. Identify the backend contract gap and resolve it explicitly.

The frontend API layer must centralize:

- request construction
- response parsing
- error normalization
- request/correlation identifiers when available
- authentication behavior
- unauthorized handling
- forbidden handling
- retry policy where applicable

Components should not independently reimplement these concerns.

---

## 7. Current Pay Domain Rules

The current Pay domain model defines atomic monetary values as strings specifically to avoid JavaScript floating-point money calculations. Preserve this rule throughout the frontend.

The current domain also defines Pay locales:

- `fa-IR`
- `en-US`
- `ar`
- `ru`

and Payment statuses including:

- `created`
- `pending`
- `detected`
- `verifying`
- `confirmed`
- `completed`
- `expired`
- `underpaid`
- `overpaid`
- `wrong_token`
- `wrong_recipient`
- `duplicate`
- `ambiguous`
- `failed`
- `refunded`

Do not replace or reinterpret these states without first verifying the backend/domain contract.

Current supported Pay assets are:

- SOL
- USDC
- USDT

Current Pay product configuration defines a 1% gateway fee and supports `merchant` and `customer` fee payers. Display these values from authoritative server/domain state rather than duplicating policy constants in individual screens.

---

## 8. Payment Intent UX

Payment Intent is the center of the payment experience.

The frontend must consume the server-created immutable payment snapshot. It must not silently recompute or alter the commercial agreement.

Relevant fields may include:

- Payment ID
- Merchant
- order/external order context
- amount in atomic units
- customer total
- merchant settlement amount
- asset
- token mint
- token program
- token decimals
- network
- recipient
- fee recipient
- reference
- fee payer
- gateway fee
- gas sponsorship policy
- expiry
- creation time
- status

Use backend-provided values as the financial display source.

The existing Payment Intent API is server-side authenticated and returns fields such as amount, asset, token metadata, recipient, reference, fee information, expiry and status. The frontend must consume that contract rather than inventing a parallel object shape.

---

## 9. Customer Checkout

Customer Checkout must be intentionally simpler than a merchant dashboard.

Required experience, subject to the actual backend contract:

- merchant identity
- amount
- asset/network
- gateway fee
- who pays the fee
- customer total
- destination information as appropriate
- expiry
- payment action
- verification progress
- final payment state
- blockchain signature when authoritative evidence exists
- support access

The checkout must clearly distinguish:

`wallet connected` → `payment submitted` → `transaction detected` → `verification in progress` → `verified/confirmed` → `completed`

Never collapse these steps into one generic success screen.

`Submitted` is not `Paid`.

`Reference matched` is not sufficient proof by itself.

A webhook callback is not proof by itself.

---

## 10. Payment Status Presentation

Every backend payment state must have a centralized presentation mapping.

For each state define:

- label
- icon
- semantic meaning
- visual treatment
- whether it is terminal
- allowed user action
- retry behavior
- explanation text when needed

Keep the mapping centralized so different screens cannot display contradictory meanings.

Never display `completed` merely because the user signed or submitted a transaction.

For ambiguous, incomplete or unverifiable results, prefer honest pending/retryable/error messaging rather than optimistic success.

---

## 11. Blockchain Evidence UI

When authoritative data is available, the UI may display:

- network
- signature
- slot
- block time
- confirmation/finality status
- reference
- source/destination
- token mint
- token program
- amount
- fee payer

Do not infer these values from untrusted browser state.

Do not label a transaction `finalized`, `verified`, `paid` or `completed` without server-authoritative evidence.

Never expose provider credentials, private RPC URLs or secret operational configuration to the browser.

---

## 12. Merchant Dashboard

The merchant dashboard is the primary operational control center.

Core areas should be built only where the backend contract supports them:

- Overview
- Transactions
- Customers
- Merchant profile
- receiving wallet
- invoices
- payment links
- supported assets
- settings
- reports
- API keys
- webhooks
- security events
- tickets

The overview may contain:

- transaction volume
- successful payments
- pending payments
- failed payments
- transaction count
- settlement reporting
- gateway revenue/fees
- refunds
- customer metrics
- payment conversion

Every metric must have an explicit timeframe and unit.

Do not invent balances. If a number is a reporting mirror of direct on-chain merchant settlement, label it accurately and never imply custody that does not exist.

---

## 13. Transactions

The transaction center must be operational, searchable and auditable.

Search/filter dimensions may include:

- payment ID
- order ID
- transaction signature
- customer
- merchant
- asset
- status
- date range
- amount range where supported

Transaction detail should clearly separate:

- commercial Payment Intent snapshot
- payment lifecycle state
- blockchain evidence
- reconciliation state
- financial/accounting representation
- timestamps

The UI must never present a client-local interpretation as authoritative.

---

## 14. Merchant Wallet Verification

Wallet registration/verification must consume the existing backend challenge flow.

Frontend responsibilities:

- request/start the challenge through the real API
- display the challenge context clearly
- ask the user's wallet to sign when appropriate
- send only the required public verification material back to the backend
- display the authoritative verification result

Frontend must never receive, request, store or transmit a seed phrase/private key.

A wallet public address is not the same thing as an SPL token account/ATA. UI terminology must remain technically correct.

---

## 15. Referral / Affiliate UI

Referral is a separate accounting/business surface.

Where supported by backend contract, show:

- referral code
- referred merchants
- active eligible merchants
- current tier
- tier progress/history
- eligible earnings
- pending earnings
- paid earnings
- reversed earnings
- available withdrawal
- minimum withdrawal threshold
- payout wallet
- wallet verification status
- withdrawal history
- payout transaction signatures

The frontend does not calculate authoritative commission amounts, tiers or liabilities.

Referral code is attribution only, not authorization.

Referral liability is not free SolMint revenue.

---

## 16. Withdrawal UX

Withdrawal is a financial operation and must follow backend state.

Do not assume a requested withdrawal is paid.

Display actual states returned by the backend, including any equivalent of:

```text
REQUESTED
ELIGIBILITY_CHECKED
APPROVED
PROCESSING
SUBMITTED
CONFIRMED
PAID
```

and exceptional states such as:

```text
REJECTED
FAILED
CANCELLED
RETRYABLE
```

The browser must prevent obvious duplicate submissions, while the backend remains responsible for idempotency and concurrency correctness.

---

## 17. Financial Presentation Rules

The UI must clearly distinguish:

- Merchant Principal
- Gateway Revenue
- Referral Liability
- Gas Cost
- Refund/Reversal

Never call referral liabilities revenue.

Never call a customer wallet balance a SolMint balance.

Never call an accounting mirror a custodial balance unless the backend/product contract explicitly defines custody.

Monetary display must preserve exact atomic-unit semantics. Use decimal conversion only for presentation and keep the original authoritative atomic value available in the data model.

---

## 18. Invoices and Payment Links

Where API support exists, merchant tools should allow:

- invoice creation
- amount
- asset
- expiry
- order/reference metadata allowed by contract
- payment link
- status
- payment details

Do not allow the browser to override server-defined fee rules, recipient rules or merchant identity.

Generated links must use canonical routing and real Payment Intent identifiers.

---

## 19. Customer Experience

The customer should not need to understand internal reconciliation machinery.

Customer copy should explain:

- what must be paid
- what asset/network is required
- what fee applies
- how much the customer pays
- whether payment is detected
- whether verification is ongoing
- whether action is required
- whether payment completed, failed or expired

Do not expose raw exception strings, SQL errors or provider internals as normal customer copy.

---

## 20. Support / Ticket System

Ticketing is a real operational capability, not decorative UI.

Where supported by backend:

- create ticket
- list tickets
- detail/conversation
- priority
- category
- status
- timestamps
- assignment
- attachments if the backend explicitly supports them
- close/reopen

Suggested status semantics:

- Open
- In Progress
- Waiting for Customer
- Waiting for SolMint
- Resolved
- Closed

Tickets may be linked to Payment ID, Merchant ID, Invoice ID or transaction signature where the backend contract supports it.

Never allow secrets, recovery phrases, private keys or webhook/API secrets into support forms.

---

## 21. Reports and Analytics

Reports must be derived from authoritative backend data.

Potential metrics include:

- payment volume
- transaction count
- success rate
- failure rate
- pending rate
- average payment value
- gateway fees/revenue
- merchant settlement reporting
- refunds/reversals
- referral costs/liabilities
- asset distribution

Supported ranges may include:

- Today
- 7D
- 30D
- 90D
- Custom

Do not fabricate analytics when the backend endpoint does not exist.

Charts are an information tool, not a source of truth.

---

## 22. Developer Portal

Developer features should be isolated from the main dashboard experience.

Where supported:

- API key management
- API scopes
- webhook configuration
- webhook delivery history
- developer documentation links
- request/correlation identifiers
- integration status

API key secrets must be handled according to the actual backend contract and must never be placed in URLs, ordinary analytics payloads, logs or unsafe persistent browser storage.

---

## 23. Webhook UI

Webhook delivery is a notification mechanism, not payment truth.

Where supported, display:

- endpoint
- status
- last delivery
- success/failure rate
- retries
- failed deliveries
- delivery history
- signing configuration status

Do not present webhook delivery as proof that a payment is financially completed unless the authoritative payment endpoint independently says so.

---

## 24. Notifications

Notification center may surface:

- payment verification changes
- payment failures/expiry
- webhook failures
- wallet verification events
- security events
- ticket updates
- referral/withdrawal updates
- refunds

Notifications must always deep-link to the authoritative entity when possible.

---

## 25. Visual Direction

SolMint Pay must use a **light, bright, premium financial-product aesthetic**.

Primary visual principles:

- white/off-white surfaces
- light gray page background
- restrained SolMint pink accents
- limited complementary purple/blue/green status colors
- soft borders
- subtle shadows
- clean rounded cards
- generous whitespace
- strong typographic hierarchy
- high readability
- restrained motion

Do not create a dark-only dashboard.

Do not use excessive gradients.

Do not fill every empty area with decoration.

The product must look like a serious financial platform while retaining SolMint identity.

Target feeling:

> **Professional financial SaaS + crypto-native clarity + SolMint personality.**

---

## 26. Pink Horned Dolphin Brand System

The pink horned dolphin mascot is part of the SolMint Pay identity.

Use it strategically in:

- onboarding
- welcome states
- empty states
- success states
- support
- lightweight illustrations
- selected dashboard accents

Do not place the mascot inside every card.

Do not let mascot usage reduce readability or make the product feel childish.

Rule:

> **Professional first, playful second.**

Existing SolMint mascot assets must be inspected and reused where appropriate rather than recreating incompatible variants.

---

## 27. Icon System

Use a consistent Pay icon language.

Prefer dedicated semantic icons for:

- Payment
- Wallet
- Merchant
- Customer
- Revenue
- Referral
- Verification
- Security
- Invoice
- Refund
- Webhook
- Ticket
- Analytics
- Gas

Icons must communicate meaning, not merely fill visual space.

Do not mix unrelated icon families without a clear design-system reason.

---

## 28. Typography and Copy

Dashboard text must be:

- short
- precise
- operational
- easy to scan

Avoid long marketing copy in financial screens.

Prefer:

`پرداخت تأیید شد`

over a long paragraph explaining the same state.

Errors should tell the user what happened and what action is possible without leaking implementation internals.

---

## 29. Internationalization

Multilingual support is a first-class architecture requirement.

Current locale contract:

- `fa-IR` — first-class active locale
- `en-US` — first-class production target
- `ar` — RTL target
- `ru` — LTR target

All user-facing text must be behind the Pay i18n layer.

Never hard-code user-facing strings in feature logic.

Locale must not alter financial meaning.

Dates, times, decimal formatting, currencies, units and status labels must remain semantically correct in every locale.

---

## 30. RTL/LTR

RTL must be structural, not a collection of one-off CSS overrides.

Use logical layout concepts wherever possible:

- inline-start/end
- block-start/end
- direction-aware alignment
- locale-aware ordering

Verify both RTL and LTR layouts before accepting a feature.

Do not assume that mirroring a screenshot is sufficient for Arabic/Persian usability.

---

## 31. Responsive Design

Mobile-first is mandatory.

The dashboard must work on:

- mobile
- tablet
- laptop
- desktop
- wide desktop

On mobile:

- sidebar becomes drawer/navigation surface
- KPI cards stack/reflow
- tables become useful responsive lists/cards where appropriate
- charts remain readable
- actions remain reachable
- dialogs fit the viewport
- no unintended horizontal overflow

Do not merely shrink the desktop layout.

---

## 32. Accessibility

Every Pay feature must be designed for accessibility.

Minimum expectations:

- semantic HTML
- keyboard navigation
- visible focus states
- accessible labels
- appropriate ARIA where needed
- sufficient contrast
- readable text
- accessible form validation
- accessible tables/lists
- accessible dialogs
- reduced-motion support

Accessibility must be tested, not assumed from visual appearance.

---

## 33. Data and UI States

Every data-driven feature must consciously implement:

- loading
- loaded
- empty
- error
- unauthorized
- forbidden
- stale
- retryable

Do not use an empty state to hide an API error.

Do not show a loading spinner forever after an unrecoverable failure.

Show the user which action is available: refresh, retry, sign in, contact support, or wait.

---

## 34. Error and Retry Policy

Customer-facing errors must be understandable and safe.

Example:

`بررسی پرداخت موقتاً در دسترس نیست. دوباره تلاش کنید.`

Do not display raw stack traces, SQL messages, RPC credentials or implementation details.

Retry only errors that are actually retryable.

Do not retry blindly after:

- wrong recipient
- wrong token
- invalid authorization
- duplicate/replay conflict
- terminal rejection
- expired payment

A retry must not accidentally create a second financial operation.

---

## 35. Concurrency and Mutations

The UI should prevent obvious duplicate user actions for mutation operations.

For operations such as:

- create payment/invoice
- wallet verification
- withdrawal
- API key creation/revocation
- webhook mutations

implement appropriate:

- disabled submit during mutation
- progress state
- duplicate-click protection
- idempotency awareness
- authoritative refresh after completion

The browser is not a replacement for backend idempotency or database locking.

---

## 36. Refresh and Synchronization

Revalidate authoritative state after mutations and at appropriate intervals for rapidly changing state.

Pay special attention to:

- payment status
- verification status
- withdrawal status
- wallet verification
- webhook deliveries
- tickets
- security events

Do not trust stale local state for financial conclusions.

Caching must never create a false impression that a payment is complete when the authoritative backend says otherwise.

---

## 37. State Management

Use domain-oriented state, not presentation strings as business logic.

Centralize mappings for:

- payment states
- withdrawal states
- verification status
- ticket states
- webhook status
- permissions

Avoid putting the same state translation logic in several pages.

Keep server state and local interaction state conceptually separate.

---

## 38. Routing

Use a dedicated Pay routing boundary.

Expected architectural surfaces may include:

```text
/pay
/pay/login
/pay/onboarding
/pay/dashboard
/pay/transactions
/pay/transactions/:id
/pay/customers
/pay/merchants
/pay/merchants/:id
/pay/invoices
/pay/referrals
/pay/referrals/withdrawals
/pay/tickets
/pay/reports
/pay/developer
/pay/developer/api-keys
/pay/developer/webhooks
/pay/security
/pay/settings
```

This list is a design direction, not permission to create routes that the backend/product does not support.

Do not invent route contracts. Validate every final route against the real product architecture.

---

## 39. Customer vs Merchant vs Affiliate vs Developer

These surfaces have different goals and must not be merged into one overloaded dashboard.

### Customer Checkout
Simple, focused, low-friction.

### Merchant Dashboard
Operational, financial, analytical.

### Affiliate Dashboard
Referral, liability, payout focused.

### Developer Portal
Integration, keys, webhooks, documentation.

Navigation and information hierarchy should make these role boundaries obvious.

---

## 40. Merchant Tenant Isolation

The UI must respect merchant tenancy everywhere, but the real enforcement must remain server-side and database/RLS-backed.

Never allow a client-provided merchant ID to determine authorization.

Never show cross-merchant:

- transactions
- customers
- API keys
- webhook records
- wallets
- reports
- tickets

Even when hiding the information in UI, the API request must also be properly authorized.

---

## 41. Security and Sensitive Data

Never expose in frontend state, URLs, logs, analytics, error reports or support payloads:

- seed phrase
- private key
- webhook secret
- API secret
- backend service credential
- RPC provider credential
- authentication credential

Do not use ordinary local storage for high-value secrets.

Do not create a frontend signing oracle.

Do not make the browser authoritative for financial operations.

---

## 42. Performance

Pay UI should be fast without compromising correctness.

Use where justified:

- route-level lazy loading
- component splitting
- image optimization
- icon optimization
- virtualization for large lists
- controlled re-rendering
- request deduplication where safe
- appropriate caching

Do not optimize by removing validation, reducing state accuracy or suppressing errors.

Avoid unnecessary animation and oversized assets.

---

## 43. Design System

Create a Pay-specific design system before building many screens.

Centralize:

- colors
- typography
- spacing
- radius
- shadows
- buttons
- inputs
- select/dropdown
- badges
- status indicators
- cards
- tables
- tabs
- dialogs
- toasts/notifications
- navigation
- charts
- empty states

Components must be composable and reusable without becoming generic abstractions that hide business meaning.

---

## 44. API/Service Boundary

Preferred flow:

```text
Page
  ↓
Feature
  ↓
Pay API/Service Client
  ↓
Authenticated Backend API
  ↓
Database / Verification / Reconciliation / Blockchain
```

Do not let a page call Supabase directly for privileged financial operations.

Do not let UI components contain RPC implementation.

Do not copy backend validation logic into a frontend fake validator that becomes the only visible rule.

Client-side validation may improve UX, but server-side validation remains authoritative.

---

## 45. Testing Strategy

Every meaningful Pay feature must have an appropriate test level.

### Unit

Test:

- formatting
- i18n selection
- state mappings
- pure utilities
- display transformations

### Component

Test:

- forms
- tables
- status components
- dialogs
- responsive state behavior where practical

### Integration

Test:

- API contracts
- authorization states
- error mapping
- state synchronization

### E2E

Cover realistic critical flows such as:

- customer checkout
- payment pending
- verified payment
- failed payment
- wallet verification
- merchant onboarding
- referral flow where implemented
- ticket creation

### Security

Test:

- unauthorized access
- forbidden access
- cross-merchant access attempts
- client tampering assumptions
- duplicate submissions
- sensitive data leakage

---

## 46. Mandatory Payment UI Scenarios

The checkout and payment detail experience must gracefully represent at least the backend-supported equivalents of:

- valid payment
- underpayment
- overpayment
- wrong asset/token
- wrong recipient
- wrong reference
- failed transaction
- expired payment
- duplicate/replayed payment
- ambiguous candidate
- RPC/provider outage
- incomplete discovery
- concurrent reconciliation

The exact state name must come from the backend/domain contract. Do not invent a second vocabulary merely for presentation convenience.

---

## 47. Observability

Use correlation/request identifiers where the backend provides them.

A support or troubleshooting flow should be able to associate a problem with the correct Payment ID, request ID, ticket or transaction without exposing sensitive secrets.

Never send sensitive secrets to telemetry.

Do not log the full request/response body if it could contain confidential financial or authentication data.

---

## 48. Visual Content and Assets

Use the actual SolMint brand assets from the repository after verifying their path and license/usage context.

Do not invent external image URLs for production UI.

Do not block functionality on decorative imagery.

Mascot and icon assets must be optimized and accessible.

Decorative images should use appropriate empty alt attributes; meaningful images require meaningful localized alternative text.

---

## 49. UX Writing Rules

Use concise financial-product language.

Every important message should answer one of:

- What happened?
- What is the current state?
- What should I do?
- Do I need to wait?

Avoid vague text such as:

`Something went wrong.`

Prefer a safe actionable message such as:

`بررسی پرداخت موقتاً در دسترس نیست. دوباره تلاش کنید.`

Never promise a financial outcome that the backend has not confirmed.

---

## 50. No Contradiction Rule

The following must never disagree:

```text
UI
API
Database
Payment Intent
Payment State Machine
Blockchain Verification
Reconciliation
Accounting
Webhook
Documentation
```

Examples:

Backend `pending` → UI must not say `paid`.

Backend `unverified` → UI must not say `verified`.

Backend `processing` → UI must not say `paid`.

Backend `forbidden` → UI must not expose protected data.

Backend `expired` → UI must not offer an action that the backend will reject as valid payment submission without an explicit new flow.

---

## 51. Launch Lock

The existence of a completed-looking UI does not authorize production activation.

Do not flip the Pay launch flag merely to make the route accessible during development.

Current Pay configuration intentionally keeps launch disabled.

Final public activation of `/pay` requires all relevant release gates to pass on the same release candidate, including where applicable:

- backend/API
- database/migrations
- RLS/tenant isolation
- authentication/authorization
- wallet verification
- blockchain verification
- reconciliation
- accounting
- webhooks
- referrals/withdrawals implemented for the declared release scope
- frontend functionality
- i18n
- accessibility
- responsive validation
- security validation
- observability
- E2E
- deployment
- rollback readiness
- adversarial release audit

A green frontend build alone is never sufficient.

---

## 52. Development Sequence

For every feature follow this order:

```text
1. Inspect current repository state
2. Inspect authoritative product contract
3. Inspect backend/API
4. Inspect database/domain model
5. Inspect security boundaries
6. Inspect existing tests
7. Define UX states
8. Define API/state mapping
9. Implement inside Pay boundary
10. Integrate real backend
11. Unit tests
12. Component tests
13. Integration tests
14. E2E tests
15. Security review
16. Accessibility review
17. Responsive review
18. Performance review
19. CI validation
20. Architecture/release review
```

Do not proceed to the next layer while a blocker in the current layer remains unresolved.

---

## 53. Review Checklist for Every PR

Before merging frontend work, verify:

### Architecture

- Is the change inside the Pay boundary?
- Did it avoid unrelated site coupling?
- Is the responsibility of each new component clear?

### Backend

- Does every API call map to a real backend contract?
- Are authoritative states preserved?
- Are error and retry semantics correct?

### Security

- Is tenant isolation preserved?
- Can client tampering change financial meaning?
- Could any secret leak to browser storage, logs, telemetry or URLs?

### Financial correctness

- Are atomic units preserved?
- Is principal separated from revenue/liability?
- Is success based on authoritative verification?

### UX

- Are loading, empty, error, unauthorized, forbidden and stale states represented?
- Are user actions obvious?
- Is wording concise and accurate?

### i18n

- Is every user-facing string localized?
- Does both RTL and LTR work?
- Are dates and numbers locale-correct?

### Accessibility

- Keyboard?
- Focus?
- Labels?
- Contrast?
- Dialog semantics?

### Responsive

- Mobile?
- Tablet?
- Desktop?
- No unintended overflow?

### Testing

- Unit?
- Component?
- Integration?
- E2E/security where appropriate?

### CI

- Current HEAD validated?
- No cancelled/obsolete run accepted as PASS?
- No hidden type errors or bypasses?

---

## 54. Definition of Done

A frontend feature is **not done** until all applicable requirements are satisfied:

1. Repository architecture was inspected.
2. Backend contract was inspected.
3. Domain and financial meaning are correct.
4. Tenant/security boundaries are preserved.
5. UX covers the full state machine needed by the feature.
6. i18n is complete.
7. RTL/LTR is validated.
8. Responsive behavior is validated.
9. Accessibility is validated.
10. Tests exist at the appropriate levels.
11. Current HEAD CI passes.
12. No known blocker remains.
13. Documentation is updated when architecture or contract changes.
14. The implementation does not rely on mocks for the production path.

---

## 55. Product Visual Blueprint

The preferred Dashboard composition is:

```text
Header
├── Global Search
├── Language
├── Notifications
└── Profile

Sidebar
├── Dashboard
├── Transactions
├── Customers
├── Merchants
├── Referrals
├── Tickets
├── Reports
├── Developer
├── Security
└── Settings

Main
├── Greeting / Context
├── KPI Summary
├── Transaction Volume
├── Asset / Payment Method Analytics
├── Recent Transactions
├── Operational Activity
├── Quick Actions
└── Support / Alerts
```

This is a visual and information-hierarchy reference, not a requirement to show every section simultaneously.

The first viewport should communicate:

- what is happening now
- financial/operational health
- recent payments
- urgent issues
- the next useful action

Do not overload the first screen.

---

## 56. Design Quality Standard

The Pay interface should feel:

- trustworthy
- fast
- calm
- modern
- financial
- crypto-native
- distinctly SolMint

It should not feel:

- childish
- noisy
- overloaded
- dark by default
- marketing-heavy
- technically confusing

The pink horned dolphin provides brand personality; precise data hierarchy provides product credibility.

---

## 57. Architecture Evolution Rule

As the product grows, preserve clear boundaries among:

- presentation
- API client
- authentication
- authorization
- domain state
- financial data
- blockchain evidence
- reconciliation
- accounting
- notification transport

Do not add convenience shortcuts that gradually turn the frontend into a second backend.

When a frontend requirement cannot be satisfied cleanly from the existing API, treat that as an architecture/API requirement, not as a reason to fake the data in the browser.

---

## 58. Conflict Resolution

When documents or implementation disagree:

1. Identify the conflicting claims.
2. Inspect current code and backend behavior.
3. Inspect database state and tests where relevant.
4. Check the authoritative product contract.
5. Decide which statement is current.
6. Update the stale documentation.
7. Add or update tests where the conflict could recur.
8. Do not silently choose the most convenient interpretation.

Historical documents do not override current verified implementation.

---

## 59. No Speculative Implementation

Do not implement a feature based only on:

- a screenshot
- an idea
- a guessed API
- a remembered earlier conversation
- an outdated document
- a placeholder database field

A screenshot is a visual reference only.

The implementation must be derived from the current architecture and contract.

---

## 60. Final Standard

The final SolMint Pay frontend must satisfy this principle:

> **If thousands of real merchants and customers used SolMint Pay today, every important screen should communicate the true backend state clearly, never invent financial truth, never violate security boundaries, remain usable in Persian and other supported locales, and remain maintainable as an independent product surface.**

Final flow:

```text
Repository truth
→ Product contract
→ Backend/API contract
→ Domain/database model
→ Security boundaries
→ UX/state model
→ Pay frontend
→ Real integration
→ Tests
→ Security/accessibility/responsive audits
→ CI
→ Release review
→ Controlled activation
```

### Absolute rule

**Do not make the backend fit a fictional frontend. Build the frontend as an accurate, elegant representation of the real SolMint Pay system.**

When any requirement conflicts with payment correctness, security, accounting integrity or backend truth, correctness wins.
