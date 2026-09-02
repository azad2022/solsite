# SolMint Pay — Authoritative Project Specification

> Status: Product and engineering source of truth for the SolMint Pay workstream.
>
> This document is intentionally broader than an API document. It defines the product boundary, commercial model, financial invariants, backend architecture, frontend/merchant experience, UI direction, multilingual requirements, security rules, testing expectations, operations, and release gates.
>
> **Critical rule:** documentation is not evidence of implementation. Every requirement in this document must eventually be traced to code, database constraints, automated tests, CI evidence, and—where financial or blockchain correctness is involved—real Devnet/E2E evidence.

## 1. Product Definition

SolMint Pay is a non-custodial Solana payment gateway for merchants. A merchant creates a payment intent, customer pays through a supported Solana asset, SolMint independently verifies the blockchain transaction, and only then is the payment considered financially valid.

Primary supported assets for the first release:

- SOL
- USDC
- USDT

The first release is intentionally single-chain: Solana.

The gateway must support, as the product matures:

- Hosted checkout
- Payment links
- QR / Solana Pay compatible payment requests
- API integration
- SDK/application integration
- Invoices
- Merchant dashboard
- Referral/affiliate program
- Webhooks
- Refund workflows
- Optional gas sponsorship
- Analytics and reporting

`/pay` must remain disabled until all release gates pass.

## 2. Source-of-Truth Rules

The following hierarchy is mandatory:

1. Database constraints and authoritative ledger state for financial invariants.
2. Server-side verification and authorization for security decisions.
3. Payment Intent snapshot for the business terms agreed at payment creation.
4. Verified blockchain observation for on-chain truth.
5. Frontend only for presentation and user input.
6. Webhooks only for notification and delivery, never for payment truth.
7. Referral codes only for attribution/discovery, never as proof of payment or authorization.

Never treat the following as equivalent:

- Payment Intent = Blockchain Transaction
- Reference = Proof of Payment
- Webhook = Source of Truth
- Frontend = Trusted System
- Observed transaction = Financially recognized payment

## 3. Commercial Model

### 3.1 Gateway economics

The intended launch economics are:

- SolMint gateway revenue target: **1.00% (100 bps)** of eligible successful payment value/fee base, subject to the final pricing-policy interpretation documented in the payment snapshot.
- The 1% SolMint revenue must be credited to the SolMint gateway revenue flow, not counted as merchant principal.
- Network fees are separate from the gateway fee.
- Gas sponsorship is a separate cost/accounting domain.
- Merchant principal and SolMint revenue must never be mixed in the same financial balance.

### 3.2 Immediate merchant settlement vs SolMint withdrawal

The requested business direction distinguishes two money flows:

1. **Merchant settlement:** the merchant's entitled payment proceeds should be made available/settled promptly after the payment becomes authoritative on-chain.
2. **SolMint gateway revenue:** SolMint's revenue is accumulated in the gateway revenue flow and is not treated as merchant funds.

The exact interpretation of the requested percentages—specifically whether **1.5%** is a merchant-side share/fee, a settlement deduction, or another commercial component—must be normalized into one explicit formula before implementation. No developer or automation may infer that meaning silently.

Until that formula is explicitly fixed, code must not introduce a second hidden fee or a conflicting percentage.

### 3.3 Recommended normalized launch formula

The preferred model for a simple first release is:

```text
Gross Payment
    |
    +--> Merchant Principal / Settlement
    |
    +--> SolMint Gateway Fee (1%)
             |
             +--> Referral Liability
             +--> SolMint Net Revenue
```

If a separate 1.5% commercial component is retained, it must be represented as a named fee/share with its own field, accounting entry, UI disclosure, and immutable Payment Intent snapshot. It must not be embedded inside generic `fee_bps` logic.

### 3.4 Financial unit rules

All money calculations must use integer atomic units. JavaScript floating-point arithmetic is forbidden for monetary decisions.

Use decimal strings / `BigInt` in application code and sufficiently wide numeric/decimal types in PostgreSQL.

Round deterministically. Prefer explicit floor/ceiling policy documented beside the calculation. Never perform hidden banker-style or locale-dependent rounding.

## 4. Accounting Model

The accounting domains are independent:

1. **Merchant Principal** — money economically belonging to the merchant.
2. **SolMint Gateway Revenue** — SolMint's earned gateway fee.
3. **Referral Liability** — amount owed to an eligible affiliate.
4. **Gas Cost / Sponsorship** — network-cost accounting, distinct from revenue.
5. **Refund** — return/reversal of previously recognized value.

Recommended financial flow:

```text
Verified Payment
      |
      +--> Merchant Principal Ledger
      |
      +--> Gateway Revenue Ledger
              |
              +--> Referral Liability Ledger
              |
              +--> Net SolMint Revenue
```

Financial writes happen only after complete verification.

Ledgers are append-only. Corrections use compensating entries/reversals rather than editing history.

## 5. Merchant Settlement and Withdrawal Model

The product must distinguish between:

- money that belongs to a merchant,
- money that belongs to SolMint,
- money owed to affiliates,
- money reserved for gas sponsorship,
- pending/held amounts awaiting final verification or reconciliation.

### Merchant payout/withdrawal

The desired product direction is that the merchant can request withdrawal of the merchant-controlled balance where applicable. The withdrawal subsystem must define:

- available balance
- pending balance
- minimum withdrawal
- supported asset/network
- destination wallet ownership
- withdrawal fee, if any
- request status
- idempotency
- anti-double-spend protection
- transaction signature and final settlement evidence
- failure/retry/reconciliation

A merchant withdrawal must never be inferred from a client-side balance.

## 6. Referral / Affiliate Economics

### 6.1 Core model

Referral commission is a percentage of **eligible SolMint gateway revenue**, not of gross merchant principal and not merely of signup activity.

Example policy baseline:

```text
Gateway Fee = 1.00 USDC
Referral Rate = 20%
Referral Liability = 0.20 USDC
SolMint Gross Gateway Revenue retained = 0.80 USDC
```

The rate may evolve, but the policy must be explicitly configured and captured for each eligible commission.

### 6.2 Referral tiers

Referral income should scale with the value and size of the affiliate's active merchant network. A person with two active merchants should not automatically receive the same commercial treatment as a partner managing ten or more active merchants.

Recommended **future** tier framework:

| Tier | Active referred merchants | Commission on eligible gateway revenue |
|---|---:|---:|
| Starter | 1–2 | 10% |
| Growth | 3–9 | 15% |
| Partner | 10–24 | 20% |
| Strategic | 25+ | 25% |

These numbers are a product-policy proposal, not a claim that the current code already implements them. The production policy must be explicitly approved before being encoded.

The tier decision must use a precisely defined metric (for example, active eligible merchants during a rolling period). Do not let frontend counts determine the tier.

### 6.3 Referral flow

```text
Affiliate
   |
   +--> verified affiliate identity
          |
          +--> referral relationship with Merchant
                  |
                  +--> Payment Intent snapshot
                          |
                          +--> verified payment
                                  |
                                  +--> commission liability
                                          |
                                          +--> approved/payable
                                                  |
                                                  +--> Affiliate withdrawal request
```

### 6.4 Referral money custody model

Requested business direction:

> Referral earnings initially flow to the SolMint-controlled referral payout balance. The affiliate must request withdrawal.

This means referral money must be represented as a **liability**, not SolMint's free revenue.

The system must keep:

- affiliate payable balance
- paid amount
- pending amount
- reversed amount
- withdrawal requests
- payout transaction signatures

separate and auditable.

### 6.5 Mandatory referral protections

- No multi-level referral in the first release.
- No commission merely for clicks/signups.
- No self-referral.
- Attribution must be tenant-scoped and server-validated.
- Attribution becomes immutable for the Payment Intent after creation.
- Commission is created only after successful authoritative payment verification.
- One `(referral, payment)` can produce at most one commission.
- Commission rate is snapshotted per commission.
- Refund/reversal creates compensating accounting entries.
- Affiliate payout destination requires ownership verification.
- Paid commissions cannot be paid twice.
- Withdrawal creation requires idempotency and concurrency protection.

## 7. Payment Intent

A Payment Intent is the canonical business agreement for a payment.

It must snapshot at creation time:

- merchant
- amount
- asset
- token mint
- token program
- decimals
- recipient
- reference
- gateway fee policy
- fee payer
- calculated gateway fee
- customer total
- merchant settlement amount
- fee destination
- expiry
- gas sponsorship policy
- relevant referral attribution/policy where applicable

Changing merchant configuration later must not silently change an existing Payment Intent.

## 8. Blockchain Verification

Payment verification must independently validate the observed transaction against the immutable Payment Intent.

At minimum, where applicable:

- signature
- successful transaction execution
- required commitment
- block/time validity
- reference presence and exact match
- recipient/destination
- amount in atomic units
- asset
- token mint
- token program
- decimals
- token-account ownership/authority
- transfer source authority
- fee payer
- fee transfer
- merchant settlement transfer
- expected transaction structure/invariants
- duplicate/replay state

Reference lookup is discovery only.

`getSignaturesForAddress` alone is not proof of payment.

Discovery must be paginated and scoped to the Payment Intent creation/expiry window. An incomplete scan is a retryable/incomplete state, never `no_match`.

Multiple valid candidates are ambiguous and must be rejected rather than resolved by choosing the first result.

## 9. Reconciliation

Responsibilities must be separated:

```text
Observer -> discovers blockchain observations
Verifier -> decides whether an observation satisfies the Payment Intent
Reconciliation -> atomically persists the decision/state transition
Ledger -> records financial truth
```

Required outcomes include:

- confirmed
- duplicate
- underpaid
- overpaid
- wrong token
- wrong recipient
- failed
- expired
- ambiguous
- provider unavailable
- stale/incomplete

No financial recognition before authoritative verification.

Concurrent workers must converge to exactly one recognized signature.

## 10. Payment State Machine

Primary path:

```text
CREATED -> PENDING -> DETECTED -> VERIFYING -> CONFIRMED -> COMPLETED
```

Exceptional states:

```text
EXPIRED
UNDERPAID
OVERPAID
WRONG_TOKEN
WRONG_RECIPIENT
DUPLICATE
AMBIGUOUS
FAILED
REFUNDED
```

State transitions must be enforced both in application logic and at the database boundary where practical.

## 11. Merchant Identity and Isolation

Each merchant is a separate tenant.

Every sensitive API must derive merchant identity from authenticated credentials, not from a caller-controlled `merchantId`.

Database RLS/authorization must ensure a merchant cannot read or mutate another merchant's:

- payments
- invoices
- links
- wallet records
- API keys
- webhook configuration
- referral relationships
- balances
- withdrawal requests
- reports
- audit records

## 12. Merchant Wallet Ownership

Receiving wallet registration requires:

- short-lived challenge
- tenant/merchant binding
- single-use semantics
- real Ed25519 signature verification
- wallet address validation
- on-chain validation where required
- one authoritative active receiving wallet in the first-release policy

A private key must never enter SolMint backend, database, source, logs, or application configuration.

Wallet addresses and SPL token accounts/ATAs must not be conflated.

## 13. API Security

Production Pay APIs must implement, where applicable:

- authentication
- authorization
- merchant isolation
- atomic rate limiting
- idempotency
- request validation
- body-size limit
- request ID
- audit logging
- safe error responses
- secret hygiene
- abuse controls
- timeout handling

The API must reject malformed, ambiguous, stale, unauthorized, or incomplete financial operations.

## 14. API Keys

Merchant API keys are bearer credentials and must be handled as secrets.

Persist only one-way key digests where possible. Support:

- scopes
- expiry
- revocation
- prefix for operator recognition
- last-used timestamp
- merchant binding

Never expose full keys after creation.

## 15. Webhooks

Webhooks are notifications, not payment proof.

Required properties:

- HMAC signing
- timestamp binding
- replay protection
- event IDs
- per-webhook uniqueness
- retry/backoff
- timeout
- delivery history
- delivery locks
- dead-letter state
- secret rotation
- encrypted secret persistence
- SSRF-safe outbound delivery
- operational visibility

The same event may legitimately be delivered to different merchant endpoints. Uniqueness must therefore include the webhook identity.

## 16. Gas Sponsorship

Gas sponsorship is optional and separately accounted for.

The system must distinguish:

- merchant-funded gas
- SolMint-funded gas

Required controls:

- per-payment limit
- daily limit
- policy enforcement
- simulation where appropriate
- emergency disable
- signer isolation
- no signing oracle
- spend/reconciliation ledger
- on-chain spend observation

A cached SOL balance is not an accounting source of truth.

## 17. Frontend Product Scope

The Pay frontend must be a separate product boundary under `src/pay/`.

Core areas:

```text
src/pay/
├── app/
├── components/
├── features/
│   ├── merchant/
│   ├── payments/
│   ├── checkout/
│   ├── invoices/
│   ├── referrals/
│   ├── analytics/
│   └── developer/
├── i18n/
├── layouts/
├── pages/
├── services/
├── styles/
└── types/
```

### Customer checkout

The checkout must make the following obvious:

- merchant identity
- amount
- asset/network
- fee information
- total payable
- reference/payment status
- expiry
- wallet connection/payment action
- success/failure/incomplete state

Never claim success merely because a wallet transaction was submitted.

### Merchant dashboard

The dashboard should expose:

- current/pending/available balances
- payment history
- payment details and on-chain signature
- links
- invoices
- withdrawals
- API keys
- webhook settings and delivery history
- referral/affiliate status where applicable
- analytics
- wallet settings
- security events

### Affiliate dashboard

The affiliate experience should expose:

- active referred merchants
- tier/status
- eligible earnings
- pending earnings
- paid earnings
- reversed earnings
- withdrawal requests
- payout history
- payout destination status

Do not expose internal security fields or secrets.

## 18. UI / Visual Direction

The Pay product should use a **light/bright visual theme** as the default.

Requirements:

- clean white/light surfaces
- strong readability and contrast
- restrained use of SolMint brand accents
- responsive layouts
- mobile-first checkout
- professional merchant dashboard
- clear financial hierarchy
- accessible focus/hover/disabled states
- logical CSS properties for RTL/LTR
- no dark-only dependency

UI should feel like a professional payment product, not a crypto-themed demo.

The product should avoid visual clutter, excessive gradients, decorative motion, or animations that interfere with financial clarity.

## 19. Multilingual / i18n

The architecture must be multilingual from day one.

Required locales:

- Persian: `fa-IR`
- English: `en-US`
- Arabic: `ar`
- Russian: `ru`

Persian may be the first fully polished locale, but components must not hard-code Persian strings.

Requirements:

- locale registry
- translation keys
- RTL/LTR direction handling
- localized number/date formatting
- no string concatenation that breaks translation grammar
- logical CSS properties
- locale-aware validation/error presentation

The backend API must not depend on UI language for security decisions.

## 20. SEO and Public Information Architecture

SEO is required for public Pay information but must not drive premature activation of payment endpoints.

Public information may include:

- Pay overview
- merchant documentation
- API reference
- webhook documentation
- pricing
- FAQ
- security model
- supported assets
- developer integration pages

Sensitive merchant/dashboard/payment APIs must not be indexed.

SEO work starts after functionality/security are stable and should not modify financial behavior.

## 21. Database and Migration Rules

Migrations must be:

- ordered
- deterministic
- atomic where practical
- uniquely named
- auditable
- safe for repeatable validation

Important financial/security invariants should be enforced by the database as well as application code where practical.

`SECURITY DEFINER` is allowed only when necessary and must use `search_path = ''`, schema-qualified references, and least-privilege execution grants.

No experimental migration may be executed against production.

## 22. Testing Requirements

Every important payment feature requires a combination of:

- Unit tests
- Integration tests
- Security tests
- Failure-path tests
- Concurrency tests
- Real E2E tests

Mandatory payment cases:

- valid payment
- underpayment
- overpayment
- wrong token
- wrong recipient
- wrong reference
- failed transaction
- expired Payment Intent
- duplicate signature
- replay across payments
- ambiguous candidate
- RPC outage
- incomplete discovery
- concurrent reconciliation
- duplicate webhook delivery
- webhook replay
- idempotency conflict
- merchant isolation violation attempt
- unauthorized wallet change
- referral double-credit attempt
- referral reversal/refund
- withdrawal race/double-spend attempt

Mocks are for unit-level behavior; production readiness requires real Devnet/E2E evidence.

## 23. Observability and Operations

The system needs:

- request IDs
- structured logs
- security/audit logs
- payment state transition visibility
- reconciliation metrics
- RPC health/latency/error metrics
- webhook delivery metrics
- withdrawal metrics
- referral liability metrics
- alerts for stuck states
- alerting for reconciliation backlog
- alerting for repeated provider failure
- operational runbooks

No sensitive credentials, private keys, HMAC secrets, or full bearer tokens may appear in logs.

## 24. Release / Launch Gates

SolMint Pay is **not production-ready** until all of the following are PASS on the same current release candidate/HEAD:

1. Repository integrity and branch ancestry verified.
2. Current PR/base/head state verified.
3. TypeScript/build passes.
4. Unit/integration/security tests pass.
5. Database migration validation passes.
6. Auth/RLS/merchant isolation is verified.
7. Wallet ownership flow is verified.
8. Blockchain verification is verified.
9. Reference discovery is complete and retry-safe.
10. Replay/idempotency/race protections are verified.
11. Reconciliation is atomic and verified.
12. Accounting/ledger invariants are verified.
13. Merchant settlement/withdrawal flow is verified.
14. Referral attribution/commission/withdrawal flow is verified.
15. Webhook signing/retry/replay/dead-letter is verified.
16. RPC provider reliability/failover behavior is verified.
17. Gas sponsorship policy is verified if enabled.
18. Observability and incident readiness are verified.
19. Public API/docs/contract integrity is verified.
20. Real Devnet E2E is green on current code.
21. Production deployment configuration is validated without activating `/pay` prematurely.
22. Final independent adversarial audit passes.
23. Explicit production release authorization exists.

`UNKNOWN`, `AMBIGUOUS`, `INCOMPLETE`, `CANCELLED`, stale evidence, or evidence from an unrelated/old HEAD is **NOT PASS**.

## 25. Engineering Workflow

Every material Pay change follows:

```text
Repository review
      ↓
Architecture/design
      ↓
Authoritative research
      ↓
Implementation
      ↓
Unit/integration/security/failure/concurrency tests
      ↓
Adversarial security audit
      ↓
Current-HEAD CI/build/validation
      ↓
Final review
```

Do not merge, deploy, run production migrations, or enable `/pay` merely because code compiles or tests were written.

## 26. Automation Rules

All SolMint Pay scheduled automation lanes must read this document before acting.

### Lane 1 — Audit & Priority

Use this specification to identify the highest-risk unresolved requirement or contradiction. Verify current repository state first. Challenge stale assumptions and old CI evidence.

### Lane 2 — Implementation & Hardening

Use this specification as the implementation contract. Do not invent commercial rules that are not defined here. When the document marks a policy as unresolved, stop before encoding an irreversible financial behavior and report the decision needed.

### Lane 3 — Verification & Release Gate

Use this specification as the independent audit checklist. Attempt to falsify the implementation through code, database, CI, security, financial, concurrency, and E2E evidence. Documentation alone is never evidence of PASS.

No lane has authority to merge, deploy, execute production migrations, or activate `/pay` without explicit authorization.

## 27. Current Known Policy Decisions

Confirmed direction:

- Solana-only first release.
- SOL, USDC, USDT first-release assets.
- Gateway revenue baseline: 1%.
- Referral is based on eligible gateway revenue, not gross payment.
- Referral money is a liability until paid to the affiliate.
- Affiliate withdrawals are requested rather than silently pushed on every event.
- Referral tiers should scale with active referred merchant count/value.
- No multi-level referral in the first release.
- Light theme is the default Pay UI.
- Persian is first-class; English/Arabic/Russian are architectural requirements.
- `/pay` stays disabled until release gates pass.

## 28. Decisions Still Required Before Production

These are intentionally explicit so automation does not guess:

1. Exact mathematical interpretation of the requested 1.5% commercial component.
2. Final launch referral tier thresholds and percentages.
3. Exact definition of an "active referred merchant" for tier calculation.
4. Referral payout currency and supported networks/assets.
5. Minimum affiliate withdrawal amount and payout schedule.
6. Merchant withdrawal asset/network policy and minimum amount.
7. Whether merchant settlement is on-chain immediate transfer or an internal available-balance claim followed by withdrawal.
8. Final fee responsibility policy: merchant-paid, customer-paid, or selectable per Payment Intent.
9. Final refund/overpayment economics.
10. Production RPC/provider configuration and failover policy.

## 29. Non-Negotiable Security Principles

- Fail closed.
- Never trust frontend input for authorization or payment truth.
- Never treat a reference as payment proof.
- Never recognize money before complete verification.
- Never allow a signature to be recognized twice.
- Never allow one merchant to access another merchant's data.
- Never store or request customer private keys.
- Never expose server secrets in browser code.
- Never use floating-point arithmetic for money.
- Never mutate financial history to correct an error.
- Never treat an incomplete blockchain scan as no payment.
- Never mark cancelled/unknown CI as PASS.
- Never approve production release on stale HEAD evidence.
