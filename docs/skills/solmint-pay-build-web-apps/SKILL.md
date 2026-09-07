# SolMint Pay — Build Web Apps Engineering Skill

## Status and authority

This is a project-specific engineering skill for work performed with the Build Web Apps workflow. It does not replace the repository, backend contracts, database schema, migrations, security policies, or production evidence. Those remain the source of truth.

Repository: `azad2022/solsite`
Primary application: SolMint Pay
Current hosting architecture: Cloudflare Pages/Functions + Supabase

The skill exists to make implementation and review disciplined, repeatable, and resistant to invented APIs, fake financial state, accidental security-boundary violations, and premature production activation.

## 1. Non-negotiable operating rules

1. Repository First. Inspect the real repository before changing or creating code.
2. Contract First. Never invent an API endpoint, request field, response field, state, role, permission, database column, or RPC name.
3. Backend Authority. Payment, verification, settlement, accounting, authorization, referral eligibility, and security decisions are server authoritative.
4. Frontend is untrusted. Never treat browser state as proof of payment, ownership, permission, balance, settlement, or identity.
5. No production mocks. A mock may exist only in an explicitly isolated test/design path and must never masquerade as production functionality.
6. No direct sensitive Supabase/RPC access from browser UI. Use the approved server-mediated boundary.
7. Never weaken backend security merely to make UI implementation easier.
8. Never expose secrets, private keys, seed phrases, webhook signing secrets, service-role credentials, or internal JWT signing material to the browser.
9. Preserve tenant isolation. Every merchant-scoped read/write must be authorized server-side and protected by the database authorization boundary.
10. Never declare PASS from a build alone. Validate the relevant behavior, security boundary, tests, and production gate.
11. Do not activate `/pay` merely because UI work is complete. Operational activation is a release decision after all required backend/security/E2E gates pass.
12. When evidence is missing, say `UNKNOWN` or `BLOCKED`; do not infer.

## 2. Required discovery before implementation

Before implementing any Pay feature, inspect at minimum:

- repository tree and current branch/commit;
- `package.json`, TypeScript configuration, Vite/build configuration;
- Cloudflare Pages/Functions middleware and routing;
- existing Pay files and shared server code;
- authentication/session implementation;
- authorization and tenant/RLS implementation;
- Pay migrations and migration runbooks;
- Payment Intent implementation;
- merchant implementation;
- wallet challenge implementation;
- transaction verification/reconciliation implementation;
- webhook implementation;
- accounting/ledger implementation;
- referral/commission implementation;
- gas sponsorship implementation;
- API key/idempotency/rate-limit implementation;
- audit logging;
- tests and CI workflows;
- current production/deployment status;
- current Supabase schema and migration state.

Do not assume that a table existing in Supabase means its API is production-ready. Do not assume that an API file existing in GitHub means its authorization contract is complete.

## 3. Current verified Pay domain model

The current Supabase project is `nvopkbiedorfshwbmyhn`, named `solmint.ir`, in `eu-central-1`, and is reported ACTIVE_HEALTHY.

The current public schema contains Pay structures including:

- `pay_merchants`
- `pay_merchant_members`
- `pay_merchant_wallets`
- `pay_wallet_challenges`
- `pay_payment_intents`
- `pay_payment_transactions`
- `pay_payment_transfers`
- `pay_payment_events`
- `pay_payment_links`
- `pay_invoices`
- `pay_referrals`
- `pay_affiliates`
- `pay_commissions`
- `pay_revenue_ledger`
- `pay_merchant_ledger`
- `pay_gas_accounts`
- `pay_gas_ledger`
- `pay_webhooks`
- `pay_webhook_deliveries`
- `pay_api_keys`
- `pay_idempotency_keys`
- `pay_rate_limit_buckets`
- `pay_audit_logs`

All of these tables currently report RLS enabled. Their actual policies/grants and runtime authorization must still be treated as the authoritative security contract and verified before exposing functionality.

Important existing schema facts:

### Merchant
`pay_merchants` contains owner identity, business name, slug, checkout/dashboard locale, default fee payer, gateway fee bps, status, and timestamps. Status values include `pending`, `active`, `suspended`, `closed`.

### Merchant membership/RBAC
`pay_merchant_members` models tenant membership with roles:

- owner
- admin
- finance
- developer
- viewer

Membership status includes active, suspended, removed. The UI must never assume a role grants an operation unless the backend authorization contract confirms it.

### Merchant wallets
`pay_merchant_wallets` supports Solana receiving and gas-source wallets, verification status, activation/deactivation, and verification timestamps. Wallet ownership must use the backend challenge flow.

### Payment Intent
`pay_payment_intents` is the business-level payment record and explicitly must not be treated as a raw blockchain transaction. It contains authoritative snapshots for amount, asset, mint, recipient, reference, fee, fee payer, customer total, merchant net/settlement, fee recipient, network, expiry, payment link/invoice relationship, verification commitment, customer wallet, fee payer address, token program, and token decimals.

Supported assets currently encoded by schema are `SOL`, `USDC`, and `USDT`; network is Solana. Do not add additional assets to UI as if supported unless the backend contract and schema support them.

Current database payment statuses include:

- created
- pending
- detected
- verifying
- confirmed
- completed
- expired
- underpaid
- overpaid
- wrong_token
- wrong_recipient
- duplicate
- ambiguous
- failed
- refunded

The frontend may map these to user-friendly labels, but must not invent additional financial meanings.

### Observed blockchain transactions
`pay_payment_transactions` records observed on-chain transactions linked to payment intents. It includes signature, slot, block time, observed amount, asset, recipient, reference match, confirmation, success, commitment, fee payer, network fee, verification status, raw observation/transaction data, token details, rejection reason, and an `is_authoritative` flag.

The existence of a transaction signature is not equivalent to a completed payment.

### Transfer legs
`pay_payment_transfers` explicitly models transfer roles such as merchant settlement, gateway fee, refund, and other. The UI may show these only when the backend exposes them as authoritative transaction evidence.

### Payment events
`pay_payment_events` is append-only event/state history for audit, reconciliation, and deterministic debugging. Use backend-provided history rather than reconstructing state from browser events.

### Merchant principal ledger
`pay_merchant_ledger` is an append-only reporting ledger for verified merchant settlement and is explicitly not a custody balance.

### SolMint revenue
`pay_revenue_ledger` recognizes gateway revenue after verified settlement. Its economics distinguish gross gateway fee, referral commission, net gateway revenue, and void status.

### Referral
`pay_affiliates` stores affiliate identity and server-resolved commission policy. `pay_referrals` associates an affiliate with a merchant. `pay_commissions` derives referral liability from eligible gateway revenue rather than sign-up alone. Commission status includes pending, approved, paid, and void.

The UI must never calculate authoritative commission amounts, eligibility, tier status, or withdrawable balances.

### Gas sponsorship
`pay_gas_accounts` and `pay_gas_ledger` separate gas sponsorship economics from merchant principal and SolMint treasury economics. The ledger is the source of truth for sponsorship credits/debits. A cached gas balance must not be presented as authoritative when the backend says otherwise.

### Webhooks
`pay_webhooks` stores merchant webhook configuration and protected secret material. `pay_webhook_deliveries` tracks at-least-once delivery, attempts, retry scheduling, response metadata, locks, and immutable endpoint/secret snapshots. Never display or return webhook secrets in plaintext.

### API keys and idempotency
`pay_api_keys` is server-mediated only. Browser UI may manage metadata/lifecycle through authorized backend endpoints, but never read key hashes/secrets or make direct database calls. `pay_idempotency_keys` provides merchant-scoped idempotency state for mutating Pay APIs.

### Audit and rate limiting
`pay_audit_logs` is append-only business audit history. `pay_rate_limit_buckets` is server-side rate limiting state. These are operational/security domains, not client-controlled state.

## 4. Authentication, registration, and authorization

The existing application authentication model uses the server-side session boundary, not browser Supabase Auth for Pay authorization. The session cookie is `__Host-solmint_session`.

Relevant current tables include `users`, `auth_sessions`, `auth_login_attempts`, and `registration_rate_limits`.

The Pay authorization architecture must preserve this model while establishing a server-to-Supabase identity boundary. A current draft JWT bridge establishes a server-only asymmetric signing boundary, but it intentionally does not yet authorize Pay requests, create RLS policies, or activate `/pay`.

Required UI behavior:

### Registration

- Do not invent registration fields or endpoints.
- Discover the real registration contract first.
- Show validation, rate-limit, duplicate-account, disabled-account, and server-error states based on actual responses.
- Never store passwords in client persistence.
- Never log passwords, tokens, challenge signatures, or secrets.

### Login/session

- Use the existing application login/session flow.
- Handle authenticated, unauthenticated, expired-session, unauthorized, and forbidden states distinctly.
- Do not interpret an HTTP 200 alone as proof of business authorization.

### Merchant tenant authorization

For every merchant-scoped route or operation:

1. resolve authenticated application user on the server;
2. resolve merchant membership server-side;
3. enforce role/action authorization;
4. enforce database/RLS boundary;
5. return only authorized data;
6. make UI reflect the authoritative permission response.

Changing `merchant_id` in a URL must never expose another merchant's data.

## 5. Product surfaces

The production product consists of distinct surfaces. Do not collapse them into one generic dashboard.

### Customer Checkout

Purpose: allow a customer to pay a merchant through a backend-created Payment Intent.

Must support, where contractually available:

- merchant identity;
- amount and asset;
- network;
- fee policy and fee payer;
- customer total;
- receiving destination;
- reference/correlation information;
- expiration;
- wallet connection/payment action;
- verification progress;
- transaction signature when observed;
- final backend-authoritative state;
- support/ticket path.

Checkout must clearly distinguish:

- wallet connected;
- transaction submitted;
- transaction detected;
- verification pending;
- confirming;
- verified/finalized;
- completed;
- underpaid;
- overpaid;
- wrong asset;
- wrong destination;
- failed;
- expired;
- ambiguous/retryable conditions.

Never display `Payment successful` because a wallet returned a signature. Success requires backend-authoritative verification/completion.

### Merchant Dashboard

Core areas:

- Overview
- Transactions
- Payment Links
- Invoices
- Merchant Settings
- Wallets
- API Keys
- Webhooks
- Gas/Sponsorship where enabled
- Reports/Analytics
- Support
- Team/Members where supported
- Security/Audit where permitted

KPIs must come from backend data and include an explicit time range, unit, and timezone. Do not invent balances by summing arbitrary UI rows.

### Merchant transactions

Provide server-backed search, filtering, date range, asset, status, payment ID, external order ID where supported, customer reference where supported, transaction signature, amount, fees, settlement, and verification/reconciliation state.

Transaction detail should connect the business Payment Intent with observed blockchain evidence and accounting/reconciliation state without implying that the chain transaction itself is the business ledger.

### Payment Links

`pay_payment_links` currently supports merchant association, slug, title, optional fixed amount, asset, fee payer, checkout locale, activation, expiry, and timestamps.

UI should support create/list/detail/edit/deactivate only for operations that have real backend contracts and authorized roles. A payment link must not bypass Payment Intent creation and verification rules.

### Invoices

`pay_invoices` currently supports invoice number, customer label, title, description, amount, asset, fee payer, locale, due date, and statuses including draft, open, paid, partially_paid, overdue, void, refunded.

Invoice status must be server authoritative. Do not infer `paid` from a submitted transaction.

### Merchant wallet management

The merchant can manage eligible wallets through a challenge/verification flow. The UI must make clear whether a wallet is unverified, verified, rejected, inactive, or otherwise restricted according to backend state.

Never ask for seed phrases or private keys.

### API key management

Merchant developers may need:

- list key metadata;
- create key;
- reveal newly-created secret exactly once if the backend contract supports this;
- revoke key;
- view scopes and expiry;
- view last-used time.

The UI must never retrieve stored key hashes or plaintext secrets after creation. If one-time secret display is not supported by backend, do not fabricate it.

### Webhook management

Support endpoint configuration, subscribed events, activation/pausing, delivery history, failure state, retry status, and secret rotation only through actual server contracts.

Do not expose signing secrets or encrypted secret material.

### Team and RBAC

Merchant tenant roles are owner, admin, finance, developer, viewer.

The UI should use least-privilege presentation:

- viewer: read-only where authorized;
- finance: financial/reporting actions only when backend permits;
- developer: integration/API/webhook capabilities where backend permits;
- admin: operational merchant management where backend permits;
- owner: ownership-sensitive actions where backend permits.

Do not infer this matrix as a backend permission contract; verify actual authorization rules first.

## 6. Referral/Affiliate product

Referral is a separate economic domain.

Affiliate capabilities may include:

- account/profile;
- referral code;
- referred merchants;
- active/eligible merchants;
- commission policy/tier information;
- eligible earnings;
- pending earnings;
- approved earnings;
- paid earnings;
- void/reversed earnings;
- available withdrawal;
- payout threshold;
- payout wallet;
- wallet verification;
- withdrawal history;
- payout transaction evidence;
- referral events.

Critical economic rule:

Referral liability is derived from eligible gateway revenue, not merchant sign-up alone. The UI must never promise commission simply because a merchant registered through a code.

The frontend may display server-calculated rates and amounts but may not calculate authoritative commission or withdrawal eligibility.

Referral attribution must be immutable where the backend snapshots it. Do not allow a customer or merchant to rewrite attribution from the browser after the backend has established it.

## 7. SolMint operator/admin console

The internal SolMint operator surface is not the same as the merchant dashboard.

Where actual backend authorization exists, an operator console should provide controlled operational visibility into:

- merchant lifecycle and status;
- merchant membership and security state;
- wallet verification state;
- payment lifecycle and ambiguous payments;
- transaction verification/reconciliation;
- payment events;
- merchant principal ledger reporting;
- gateway revenue ledger;
- referral commissions/liabilities;
- gas sponsorship accounts and ledger;
- webhook health/delivery failures;
- API key lifecycle metadata;
- idempotency conflicts;
- rate-limit/security events;
- audit logs;
- support tickets;
- system health and operational alerts;
- release/feature flags if an actual backend contract exists.

Sensitive operator actions must be explicit, auditable, and role protected. Examples include suspending a merchant, disabling a webhook, revoking a key, approving an exception, or performing a financial adjustment. Never create a UI control for an irreversible or financial action unless the backend contract, authorization, audit behavior, idempotency, and recovery semantics are verified.

Do not provide arbitrary SQL/RPC execution controls in production UI.

Do not allow an operator dashboard to silently mutate accounting ledgers. Accounting corrections must use the reviewed backend workflow and append-only/compensating-entry semantics.

## 8. Money and accounting presentation

Use integer/atomic-unit values received from the backend. Avoid floating-point arithmetic for authoritative financial calculations.

The UI must distinguish at least:

- customer payment amount;
- gateway fee;
- fee payer;
- merchant settlement/principal;
- SolMint gateway revenue;
- referral commission liability;
- gas sponsorship cost/credit/debit;
- refunds/reversals;
- reconciliation state.

Never label merchant principal as SolMint revenue.

Never label a pending commission as paid.

Never label a gas sponsorship credit as spendable cash unless the backend defines it that way.

Never derive a financial balance by trusting browser cache.

## 9. Payment lifecycle and state machine UX

Frontend state is a projection of backend state.

A recommended presentation sequence is:

`Created -> Awaiting Payment/Pending -> Detected -> Verification Pending -> Confirming -> Verified/Completed`

with explicit terminal or exceptional paths for:

- expired;
- underpaid;
- overpaid;
- wrong token/asset;
- wrong recipient;
- duplicate;
- ambiguous;
- failed;
- refunded.

Do not collapse states merely to make the UI simpler if doing so hides material financial meaning.

Every polling/revalidation strategy must:

- stop or back off according to the actual contract;
- tolerate stale responses;
- avoid race conditions where an older response overwrites newer state;
- never locally promote a payment to a more trusted state than the server supplied.

## 10. Security and privacy checklist

Before marking any frontend feature complete, verify:

- no private key/seed phrase reaches the server;
- no private key/seed phrase is stored in localStorage/sessionStorage;
- no secrets appear in URL/query parameters;
- no secrets appear in analytics payloads;
- no secrets appear in logs or error reports;
- no service-role key is shipped to Vite/browser code;
- no internal JWT signing private key reaches the browser;
- no webhook signing secret is rendered;
- no API key secret is persisted client-side beyond the minimum one-time UX required by a real contract;
- merchant IDs and payment IDs are not treated as authorization tokens;
- route guards are not mistaken for server authorization;
- CORS/CSRF/session behavior follows the existing backend contract;
- errors do not leak sensitive backend/database details;
- all sensitive mutations are idempotent where the backend requires it;
- rate-limit states are handled gracefully;
- audit-sensitive operations remain auditable.

## 11. Accessibility, UX, and reliability

Production Pay UI must include:

- keyboard accessibility;
- semantic controls;
- visible focus;
- correct labels and descriptions;
- accessible status announcements for payment state changes;
- sufficient contrast;
- reduced-motion compatibility;
- responsive mobile checkout;
- clear loading/empty/error/retry/unauthorized/forbidden states;
- deterministic formatting for amount, asset, time, and timezone;
- copy-to-clipboard feedback without exposing secrets accidentally;
- safe handling of very long addresses/signatures;
- graceful wallet-extension/mobile-wallet failures;
- network/provider failure recovery;
- no misleading optimistic financial success state.

Persian/RTL and English/LTR must be treated as first-class requirements. Pay already has locale fields for checkout/dashboard in the database; UI locale behavior must follow the actual contract.

## 12. Testing workflow required from Build Web Apps

For every meaningful Pay frontend change:

### Static checks

- TypeScript check
- lint if configured
- unit/component tests where applicable
- production build

### Integration checks

- real backend contract where available;
- authentication/session behavior;
- authorization/role behavior;
- merchant tenant isolation;
- error and retry behavior;
- Payment Intent state rendering;
- transaction/verification rendering;
- webhook/API-key lifecycle behavior where implemented.

### Browser verification

Exercise at least:

- desktop checkout;
- mobile checkout;
- authenticated merchant dashboard;
- unauthorized user;
- forbidden merchant role;
- empty state;
- loading state;
- backend failure;
- stale/revalidation behavior;
- long address/signature;
- RTL/Persian layout;
- English layout;
- wallet connection failure;
- transaction submitted but not verified;
- final authoritative completion;
- underpayment/overpayment/wrong destination/wrong asset when the test environment supports them.

### Security regression

Attempt adversarial identifiers:

- another merchant ID;
- another payment ID;
- another referral ID;
- another webhook ID;
- another API-key ID;
- manipulated amount/asset fields;
- expired session;
- revoked membership;
- wrong role.

Expected result is denial or safe server response according to the real authorization contract.

## 13. Production readiness gates

Do not report SolMint Pay as production-ready until the project-specific release gates are satisfied.

At minimum, the release process must separately establish:

1. Backend Contract complete and documented.
2. Authentication/session behavior validated.
3. Authorization and tenant isolation validated.
4. Supabase RLS policies and explicit grants validated.
5. Internal JWT bridge, if used, validated against live Supabase signing configuration.
6. Payment lifecycle implemented and tested.
7. Blockchain verification/reconciliation implemented and tested.
8. Accounting/revenue/referral/gas semantics validated.
9. Webhook delivery/retry/security validated.
10. API keys/idempotency/rate limiting validated.
11. Merchant and referral UI integrated with real contracts.
12. Operator/admin actions authorized and audited.
13. E2E/Devnet payment flows pass.
14. Security audit passes.
15. Performance and accessibility gates pass.
16. Production build and deployment validation pass.
17. `/pay` activation is explicitly approved.

A green frontend CI run is not sufficient evidence for any of these gates.

## 14. Migration and production-history safety

The repository contains a dedicated Pay migration baseline runbook. Production schema is authoritative, and migration history repair is deliberately separated from applying Pay schema.

Never:

- reconstruct historical migrations from filenames;
- create fake historical migration stubs;
- directly edit Supabase migration ledger tables;
- run Pay migrations simply because a baseline was repaired;
- claim schema rollback from metadata-only migration repair.

Frontend work must not introduce database migrations merely to satisfy UI convenience. If a required field or operation does not exist, stop and identify the backend/schema gap.

## 15. Build Web Apps behavior contract

When this skill is used with Build Web Apps, the workflow should behave as follows:

### Phase A — Discover

Read repository and current Pay documentation/code. Identify real contracts and blockers.

### Phase B — Map

Map the requested UI feature to:

`route -> auth -> authorization -> backend contract -> source of truth -> domain state -> UI states -> mutation semantics -> tests`

### Phase C — Refuse invention

If any endpoint, field, permission, state transition, or backend behavior is unknown, do not invent it. Report the missing evidence and continue only with non-authoritative presentation work if appropriate.

### Phase D — Implement

Implement the smallest production-quality change that fits the existing architecture. Avoid unnecessary dependencies and avoid coupling Pay to unrelated Solmint frontend code.

### Phase E — Verify

Run typecheck/tests/build and browser-level verification appropriate to the change. Review security and accessibility.

### Phase F — Review

Ask:

- Did we duplicate business logic?
- Did we create a fake financial state?
- Did we bypass authorization?
- Did we introduce direct sensitive database access?
- Did we expose secrets?
- Did we assume a backend contract?
- Did we break RTL/LTR?
- Did we create a misleading payment-success state?
- Did we add a dependency that the architecture does not need?
- Did we alter unrelated Solmint functionality?

### Phase G — Evidence

Report exactly what was inspected, changed, tested, blocked, and still unknown. Never convert assumptions into facts.

## 16. Feature completion template

For each Pay feature, produce an internal completion record containing:

- Feature
- User role/surface
- Route
- Backend source of truth
- Authentication requirement
- Authorization requirement
- Data fields consumed
- Mutations performed
- Idempotency requirement
- Financial/security sensitivity
- Loading state
- Empty state
- Error state
- Unauthorized state
- Forbidden state
- Retry behavior
- Stale-data behavior
- Accessibility checks
- RTL/LTR checks
- Tests run
- Browser verification
- Security checks
- Known blockers
- Production-readiness status

## 17. Current project direction

The intended engineering order remains:

`Backend Contract -> Authorization/RLS -> Payment Lifecycle -> Checkout UX -> Merchant Dashboard -> Transactions -> other domains -> E2E -> Security Audit -> Performance/Accessibility -> Production Release`

Any UI created before its real backend exists is a shell only. It must be visibly and explicitly treated as non-operational. Never create an illusion of a functioning payment gateway.

## 18. Final principle

SolMint Pay is a financial infrastructure product, not a decorative dashboard.

The objective of this skill is not to make code generation faster at any cost. The objective is to make every change:

- contract-driven;
- tenant-safe;
- financially honest;
- security-conscious;
- testable;
- observable;
- reversible where appropriate;
- consistent with the real repository and Supabase state;
- ready for production only when evidence supports that conclusion.
