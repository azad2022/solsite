# SolMint Pay — V1 Product & Engineering Contract

> **Authority:** This document is the authoritative V1 product contract for SolMint Pay.
>
> It supersedes prior ambiguous commercial interpretations for the V1 launch. Code, database design, tests, CI, E2E work and automation decisions must conform to this document. Documentation alone is never implementation evidence.

## 1. Product Identity

SolMint Pay is a **separate product and business system**. It must not be treated as merely another feature of the existing SolMint website, wallet, content platform or other SolMint products.

The Pay repository boundary may live inside the same Git repository and domain, but the product architecture, accounting, API, merchant data, affiliate data, security controls and release gates are Pay-specific.

The product is a Solana payment gateway with two intentionally different wallet models:

1. **Merchant/Affiliate user wallets:** non-custodial wallets whose signing secrets belong to their users. SolMint must not possess, store, recover or reconstruct their seed phrase/private key material.
2. **SolMint-controlled operational wallets:** wallets intentionally controlled by SolMint for receiving gateway revenue, holding referral liabilities before payout, gas sponsorship where enabled, and other explicitly approved operational purposes. These are custodial/operational assets of the Pay business and must never be described as user-owned wallets.

Do not use the phrase "SolMint Pay is non-custodial" as a blanket statement. The correct model is **non-custodial user wallets + separately controlled Pay operational wallets**.

The first production release is single-chain: Solana.

Primary payment assets for V1:

- SOL
- USDC
- USDT

`/pay` and production Pay endpoints remain disabled until every mandatory release gate passes.

---

## 2. Product Principles

### 2.1 Trust boundaries

Never treat these as equivalent:

- Payment Intent = blockchain transaction
- Reference = payment proof
- Wallet submission = payment success
- Webhook = payment truth
- Frontend = trusted authority
- Affiliate code = authorization
- Observed transaction = financially recognized payment
- Displayed balance = spendable balance

### 2.2 Authority hierarchy

For financial/security decisions use this order:

1. Database constraints and authoritative append-only ledgers.
2. Server-side authentication, authorization and verification.
3. Immutable Payment Intent commercial snapshot.
4. Verified on-chain observation.
5. Frontend input/presentation.
6. Webhooks only as notifications.

### 2.3 Fail closed

Ambiguous, incomplete, stale, unauthorized, duplicated, replayed, unverifiable or provider-failed operations must not become successful financial events.

---

## 3. V1 Commercial Model

### 3.1 Gateway revenue

The V1 Gateway Fee is **1.00% = 100 basis points**.

There is no additional hidden 1.5% fee in V1.

The 1% Gateway Fee is SolMint Pay's earned gateway revenue. It is not Merchant Principal and it is not Referral Liability.

The fee payer is explicit in the Payment Intent and UI:

- `merchant`: the merchant absorbs the gateway fee; customer pays the gross principal amount and merchant receives principal less the gateway fee.
- `customer`: the customer pays principal plus gateway fee; merchant receives the full principal.

The fee policy is snapshotted into the Payment Intent and cannot be changed retroactively.

### 3.2 V1 settlement model

The first release is designed to preserve the user-wallet/non-custodial boundary:

```text
Customer wallet
      |
      +------------------> Merchant receiving wallet
      |                    Merchant Principal
      |
      +------------------> SolMint fee destination
                           Gateway Revenue
```

The exact transaction construction may vary by payment mode, but Merchant Principal must not be routed into a SolMint custodial merchant balance merely to implement a withdrawal screen.

Therefore:

- ordinary V1 Merchant Principal is paid/settled directly to the Merchant receiving wallet;
- Merchant does not need a withdrawal request for ordinary payment principal;
- Merchant dashboard may show an accounting/reporting mirror of verified merchant settlement;
- any future custodial Merchant balance or withdrawal product is a separate explicitly approved product extension and must not be silently introduced.

### 3.3 Revenue recognition

SolMint Gateway Revenue is recognized only after authoritative blockchain verification and atomic reconciliation.

A payment submission, wallet popup approval, transaction signature alone or webhook callback must never recognize revenue.

### 3.4 Financial example

For a 100 USDC principal payment with merchant-paid 1% fee:

```text
Gross principal:             100.00 USDC
Gateway fee:                   1.00 USDC
Merchant settlement:          99.00 USDC
SolMint gross gateway revenue: 1.00 USDC
```

For customer-paid 1% fee:

```text
Principal:                    100.00 USDC
Gateway fee:                   1.00 USDC
Customer total:              101.00 USDC
Merchant settlement:         100.00 USDC
SolMint gross gateway revenue: 1.00 USDC
```

All monetary calculations use integer atomic units. No floating-point arithmetic is permitted for financial decisions.

---

## 4. Accounting Model

Keep these economic domains strictly separate:

1. **Merchant Principal** — amount economically owed to the merchant.
2. **Gateway Revenue** — earned SolMint gateway fee.
3. **Referral Liability** — amount currently owed to affiliates.
4. **Gas Cost/Sponsorship** — network-cost spend and funding.
5. **Refund/Reversal** — compensating financial entries for previously recognized events.

Recommended flow:

```text
Authoritative verified payment
            |
            +--> Merchant Principal
            |
            +--> Gateway Revenue
                    |
                    +--> Referral Liability
                    |
                    +--> Net SolMint Revenue
```

Ledgers are append-only. Historical entries are never edited or deleted. Corrections use compensating entries/reversals.

The Pay accounting model must always distinguish:

- gross revenue
- affiliate liability
- affiliate paid amount
- affiliate reversed amount
- gas spend
- refund amount
- merchant settlement
- operational wallet balances

A liability owed to an Affiliate is not SolMint free cash and must not be counted as SolMint net revenue.

---

## 5. Referral / Affiliate Program

### 5.1 Purpose

The Referral program rewards partners for bringing active, economically useful merchants to SolMint Pay.

V1 uses a **single-level affiliate program**. Multi-level or recursive referral trees are forbidden in V1.

### 5.2 Attribution

A referral relationship is established server-side between:

```text
Affiliate -> Merchant
```

The frontend referral code is only an attribution input. It is never an authorization mechanism and never payment proof.

Once a Payment Intent is created, the applicable referral relationship/policy is snapshotted for that payment and cannot be changed retroactively.

### 5.3 Eligibility

A commission exists only when all of the following are true:

1. Merchant is valid and eligible.
2. Referral relationship is valid and active.
3. Affiliate is not self-referring the Merchant.
4. Payment becomes authoritative after blockchain verification.
5. Payment has eligible gateway revenue.
6. The same referral/payment pair has not already created a commission.
7. The commission policy is valid and snapshotted.

Clicks, page views, signup alone, unverified transactions and failed payments create no payable commission.

### 5.4 Referral commission base

Referral commission is calculated as a percentage of **eligible Gateway Revenue**, never as a percentage of gross Merchant Principal.

Example:

```text
Gateway Revenue = 1.00 USDC
Referral Tier   = 20%
Referral owed   = 0.20 USDC
SolMint retained gateway revenue before other costs = 0.80 USDC
```

The commission is a liability of the Pay business.

### 5.5 Referral tiers

V1 uses four simple tiers. The tier is determined server-side from the number of **active eligible referred merchants**.

```text
Starter      1–2   active merchants  -> 10% of eligible gateway revenue
Growth       3–9                      -> 15%
Partner      10–24                    -> 20%
Strategic    25+                      -> 25%
```

### 5.6 Definition: active eligible referred merchant

For tier counting, an eligible referred merchant is a merchant who:

- has an active Pay merchant account;
- has a verified receiving wallet;
- has a valid referral relationship with the Affiliate;
- has produced at least one authoritative successful payment within the previous 30 calendar days;
- is not suspended, closed, fraudulent or otherwise excluded by an explicit server-side risk rule.

The count is computed server-side from authoritative data. Frontend counters are never authoritative.

### 5.7 Tier behavior

The tier may change over time as merchant activity changes.

However, a commission that has already become eligible must retain its own **commission-rate snapshot**. Later tier changes must not rewrite historical commissions.

For V1, each eligible commission uses the Affiliate's tier at the time the underlying payment becomes authoritative.

### 5.8 Referral wallet model

Affiliate wallets used to receive referral payouts are **user-owned, non-custodial wallets**.

The wallet creation/recovery model must ensure:

- seed phrase/private key is generated for the user;
- SolMint never receives or stores the seed phrase/private key;
- SolMint cannot reconstruct the wallet from database records;
- the user can recover the wallet using their own secret material;
- wallet ownership is verified before payout destination activation.

The user-facing wallet panel may support a controlled seed-phrase reveal/export flow only from user-controlled local wallet state. The backend must never receive the phrase/private key.

### 5.9 Referral payout custody

Referral earnings are different from Merchant Principal.

Once a commission becomes payable, its financial amount is owed to the Affiliate and is represented as Referral Liability.

The business direction for V1 is:

```text
Verified payment
      ↓
Commission liability
      ↓
SolMint-controlled referral payout balance
      ↓
Affiliate withdrawal request
      ↓
Verified payout transaction
```

The operational payout wallet is controlled by SolMint. The Affiliate's destination wallet is user-owned.

The operational payout wallet must never be described as the Affiliate's wallet.

### 5.10 Affiliate withdrawal

Affiliate withdrawal is a separate financial operation.

It must have:

- available referral balance
- pending balance
- reversed balance
- minimum withdrawal threshold
- destination wallet
- wallet ownership status
- request status
- idempotency key
- concurrency protection
- transaction signature
- on-chain settlement evidence
- failure/retry/reconciliation states

V1 minimum withdrawal threshold: **10 USD equivalent**.

This threshold is a business rule, but the system may only convert USD to a token amount using an approved, auditable price source. If no trusted price source is available at runtime, the withdrawal must not be accepted on a fabricated conversion.

Payout batching is preferred over one on-chain payout transaction per tiny commission.

### 5.11 Withdrawal state machine

```text
REQUESTED
   ↓
ELIGIBILITY_CHECKED
   ↓
APPROVED
   ↓
PROCESSING
   ↓
SUBMITTED
   ↓
CONFIRMED
   ↓
PAID
```

Exceptional states:

```text
REJECTED
FAILED
CANCELLED
RETRYABLE
```

A payout signature can settle a withdrawal at most once.

### 5.12 Referral reversal and refund

If an underlying payment is refunded/reversed, any eligible commission must be reversed through a compensating entry.

The original commission record remains immutable.

Example:

```text
Original commission:   +0.20 USDC liability
Refund/reversal:       -0.20 USDC liability adjustment
```

An already paid commission may require a separate recovery/offset policy; it must never be silently edited.

### 5.13 Referral abuse controls

V1 must prevent or explicitly reject:

- self-referral
- fake merchant activation
- referral reassignment after payment creation
- frontend-only tier manipulation
- duplicate commission creation
- duplicate withdrawal
- payout to unverified destination
- cross-merchant attribution corruption
- commission after failed/unverified payment
- multi-level referral chains

---

## 6. User Wallet Product

The Pay wallet subsystem must be treated as a separate security boundary from the payment gateway's operational wallets.

### 6.1 User-controlled secrets

For Merchant and Affiliate user wallets:

- the seed phrase/private key must be generated and handled only in the user-controlled client boundary;
- SolMint backend must never receive it;
- Supabase must never store it;
- application logs must never contain it;
- analytics/error telemetry must never contain it;
- support tooling must never expose it;
- API responses must never return it from backend storage because backend storage must not exist.

### 6.2 Seed phrase access from dashboard

A secure user wallet dashboard may provide a reveal/export flow, but this means:

- the secret is reconstructed locally from user-controlled encrypted/local wallet state;
- explicit user action is required;
- the UI must warn that exposing the phrase gives full wallet control;
- the phrase must never be sent to the server;
- the phrase must never be written to ordinary persistent server storage;
- screenshots/copy flows should be treated as user-risk events;
- clipboard handling should minimize exposure time where the platform allows.

The phrase itself is not a "password" and must be referred to accurately as a seed phrase/recovery phrase.

### 6.3 Wallet ownership verification

When a wallet is linked as a receiving/payout destination, use a short-lived, single-use, tenant-scoped challenge and real Ed25519 verification.

A verified wallet address is not equivalent to possessing the user's recovery phrase.

### 6.4 Wallet vs token account

A Solana wallet address and an SPL token account/ATA are different objects. Payment and payout code must not confuse them. For incoming SPL payments, the public receiving wallet address is the product-level destination; token accounts/ATAs are on-chain implementation details that require verification as appropriate. citeturn310665search0turn310665search2

---

## 7. Payment Intent Contract

A Payment Intent is the immutable business agreement for one payment.

It must snapshot, at minimum:

- merchant
- amount
- asset
- token mint
- token program
- decimals
- merchant receiving wallet
- SolMint fee destination
- reference
- Gateway Fee policy
- fee payer
- Gateway Fee amount
- customer total
- merchant settlement amount
- expiry
- gas policy
- referral attribution/policy if applicable

Later Merchant settings must not silently change these values.

---

## 8. Customer Checkout

The customer-facing checkout is a light, professional financial UI.

Default visual direction:

- light/bright theme
- white/light surfaces
- high readability and contrast
- restrained SolMint brand accents
- mobile-first
- responsive
- accessible
- no dark-only dependency
- no excessive gradients or decorative motion

Checkout must clearly show:

- Merchant identity
- payment amount
- asset/network
- Gateway Fee and who pays it
- customer total
- destination identity as appropriate
- expiry
- payment action
- verification status
- success / failed / pending / expired / underpaid / overpaid states

"Wallet transaction submitted" must never be rendered as final payment success.

Solana Pay links/QR requests should use the merchant receiving address plus the expected amount, token mint when applicable, and a unique reference for payment correlation. Solana's official payment documentation describes `recipient`, amount, SPL mint and reference as the relevant payment-request fields. citeturn310665search2

---

## 9. Merchant Dashboard

Merchant dashboard must provide a clear financial and operational view without implying custody where none exists.

Required V1 areas:

- verified wallet
- payment links
- invoices
- payment history
- payment details
- blockchain signature
- settlement status
- accounting/reporting mirror
- API keys
- webhooks
- security events
- supported assets
- payment settings
- future referral status where applicable

If a balance is a reporting mirror of direct on-chain settlement, label it accordingly. Never imply that SolMint holds that principal.

---

## 10. Affiliate Dashboard

Required V1/future-ready areas:

- referral code/relationship status
- active referred merchant count
- current tier
- tier history
- eligible earnings
- pending earnings
- paid earnings
- reversed earnings
- available withdrawal amount
- withdrawal threshold/status
- payout destination wallet status
- withdrawal history
- payout transaction signatures

Frontend numbers are presentation only. Server-side accounting is authoritative.

---

## 11. Backend Architecture

The logical pipeline is:

```text
API Request
   ↓
Authentication / Authorization
   ↓
Payment Intent / Business State
   ↓
Blockchain Observer
   ↓
Verifier
   ↓
Atomic Reconciliation
   ↓
Append-only Accounting
   ↓
Webhook Notification / Reporting
```

Responsibilities must stay separated:

- **Observer:** discover observations.
- **Verifier:** decide whether an observation satisfies the Payment Intent.
- **Reconciliation:** persist the decision atomically.
- **Ledger:** record financial truth.
- **Webhook system:** notify external systems.

---

## 12. Blockchain Verification

Verification must independently validate the transaction against the Payment Intent.

Where applicable, verify:

- signature
- transaction success
- required commitment/finality
- block/time validity
- reference presence and exact match
- destination
- amount in atomic units
- asset
- token mint
- token program
- decimals
- token-account ownership/authority
- transfer source authority
- fee payer/signers
- Merchant settlement transfer
- Gateway Fee transfer
- transaction/message invariants
- duplicate/replay state

Reference discovery is not payment proof.

`getSignaturesForAddress` is a discovery mechanism, not proof of a valid payment.

For high-volume production systems, indexing/streaming and reconciliation should be considered in addition to simple polling; Solana's current payment documentation explicitly points production users toward verification and indexing for higher-volume monitoring. citeturn310665search0

Discovery must:

- paginate
- use Payment Intent creation/expiry window
- detect whether the scan is complete
- retry incomplete scans
- reject/hold ambiguous candidates
- never select the first candidate merely because it appeared first

Incomplete scan != no_match.

---

## 13. Replay / Race / Idempotency

Required controls:

- globally unique blockchain signature
- cross-payment replay protection
- Payment Intent binding
- persistent idempotency keys
- request hash conflict detection
- database uniqueness
- row locking/atomic transactions
- concurrent-worker protection
- payout idempotency
- commission idempotency

One signature must never produce two financial recognitions.

One commission must never be paid twice.

One withdrawal must never be submitted twice because two workers raced.

---

## 14. Database and Accounting Invariants

Database must enforce important invariants wherever practical.

Examples:

- unique payment reference
- unique transaction signature
- unique `(referral, payment)` commission
- merchant tenant binding
- one active receiving wallet per V1 Merchant policy
- immutable ledger rows
- legal payment state transitions
- legal withdrawal state transitions
- non-negative financial amounts
- commission rate bounds
- commission amount cannot exceed eligible gateway revenue
- commission amount must match its snapshotted rate and base
- paid withdrawal cannot revert to payable without a compensating event

All `SECURITY DEFINER` functions must use `search_path = ''`, schema-qualified references and least privilege where such functions are required.

---

## 15. Merchant and Affiliate Isolation

Every Merchant and every Affiliate is a separate security principal.

No caller-controlled ID is trusted for authorization.

RLS and/or server authorization must prevent cross-tenant access to:

- payments
- balances/reporting
- wallet records
- API keys
- webhooks
- referrals
- commissions
- withdrawals
- invoices
- links
- analytics
- audit records

---

## 16. API Security

Sensitive Pay APIs require, where applicable:

- authentication
- authorization
- merchant/affiliate scope enforcement
- atomic rate limiting
- idempotency
- strict schema validation
- body-size limits
- request IDs
- audit logs
- safe errors
- timeout handling
- secret hygiene
- abuse controls

No sensitive API may trust a frontend-supplied merchant or affiliate identity without authentic server-side mapping.

---

## 17. Webhooks

Webhook events are notifications only.

Required controls:

- HMAC signing
- timestamp binding
- replay protection
- unique event IDs per destination
- retry/backoff
- timeout
- delivery history
- delivery locking
- dead-letter handling
- secret rotation
- encrypted secret persistence
- SSRF-safe destination validation

A webhook saying `payment_confirmed` does not itself prove payment.

---

## 18. SolMint Operational Wallets

SolMint-controlled wallets are operational infrastructure, not user wallets.

Examples:

- Gateway revenue destination
- Referral payout wallet
- Gas sponsorship wallet

Controls must include:

- strict key boundary
- no frontend exposure
- no database plaintext private keys
- no signing oracle
- transaction policy
- spend limits
- emergency disable
- audit logging
- on-chain reconciliation

A SolMint operational wallet must never be exposed as a Merchant or Affiliate user wallet.

---

## 19. Gas Sponsorship

Gas sponsorship is optional and separate from revenue.

Distinguish:

- Merchant-funded gas
- SolMint-funded gas

Required controls include:

- per-payment limit
- daily limit
- policy enforcement
- simulation as appropriate
- emergency stop
- secure signer isolation
- ledgered gas spend
- on-chain reconciliation

Cached balances are not financial truth.

---

## 20. i18n and Localization

V1 must be multilingual-ready from the start:

- `fa-IR`
- `en-US`
- `ar`
- `ru`

Persian is the first fully polished locale.

Requirements:

- no hard-coded user-facing Persian strings inside feature components
- translation keys
- locale registry
- RTL/LTR support
- logical CSS properties
- localized dates/numbers
- locale-aware validation/error presentation
- grammar-safe message composition

Security logic must never depend on UI locale.

---

## 21. Frontend Architecture

Pay frontend is a separate product boundary under `src/pay/`.

Expected areas:

```text
app/
components/
features/merchant/
features/payments/
features/checkout/
features/invoices/
features/referrals/
features/analytics/
features/developer/
i18n/
layouts/
pages/
services/
styles/
types/
```

UI must be built around the financial state machine rather than mocked happy paths.

---

## 22. UI Design System

Default theme: **light**.

Visual requirements:

- professional payment-product appearance
- bright surfaces
- high contrast
- restrained brand color usage
- consistent spacing/typography
- clear primary actions
- obvious disabled/loading/error states
- accessible focus states
- responsive mobile/desktop layouts
- no excessive animations
- no decorative UI that obscures financial information

The product must look like a real payment platform, not a crypto demo.

---

## 23. SEO and Public Information

Public Pay information may include:

- product overview
- pricing
- merchant documentation
- API reference
- webhook documentation
- supported assets
- security model
- FAQ
- developer pages

Merchant/affiliate private dashboards and financial APIs must not be indexed.

SEO must not modify or weaken financial/security behavior.

---

## 24. Testing Contract

Required evidence for important Pay features:

- Unit
- Integration
- Security
- Failure
- Concurrency
- Real Devnet E2E

Mandatory adversarial cases include:

- valid payment
- underpayment
- overpayment
- wrong token
- wrong recipient
- wrong reference
- failed transaction
- expired intent
- duplicate signature
- cross-payment replay
- ambiguous candidates
- incomplete discovery
- RPC outage
- stale provider data
- concurrent reconciliation
- cross-merchant access
- forged wallet challenge
- expired wallet challenge
- idempotency-key conflict
- webhook replay
- webhook SSRF attempt
- referral self-attribution
- referral tier manipulation
- duplicate commission
- commission refund/reversal
- duplicate withdrawal
- withdrawal race
- payout to unverified wallet
- insufficient referral balance
- payout below threshold
- unavailable price source for USD threshold conversion

A test file existing in the repository is not evidence that the test was executed.

---

## 25. Production Release Gates

Release is allowed only when all relevant gates are proven on the same current HEAD:

1. Repository/branch integrity.
2. Current HEAD ancestry and integration with current `main`.
3. Typecheck and production build.
4. Unit/integration/security/failure/concurrency test execution.
5. Real Devnet E2E.
6. Blockchain verification.
7. Complete reference discovery.
8. Replay/idempotency/race protection.
9. Reconciliation atomicity.
10. Accounting invariants.
11. Merchant isolation/RLS.
12. Affiliate isolation/RLS.
13. Wallet ownership and user-secret boundary.
14. Merchant settlement correctness.
15. Affiliate commission calculation and liability correctness.
16. Affiliate withdrawal correctness.
17. Refund/reversal correctness.
18. Webhook production behavior.
19. RPC/provider reliability.
20. Gas sponsorship security if enabled.
21. Observability and incident readiness.
22. Documentation/source consistency.
23. Frontend accessibility/responsive validation.
24. i18n validation.
25. Public exposure and deployment configuration.

`UNKNOWN`, `AMBIGUOUS`, `INCOMPLETE`, `CANCELLED`, stale evidence, old CI, documentation-only evidence or missing production configuration means **NOT PASS**.

---

## 26. Automation Contract

Three daily automation lanes operate independently:

### Lane 1 — Audit & Priority

Find the highest-impact unresolved blocker/risk and verify current repository state.

### Lane 2 — Implementation & Hardening

Implement the smallest coherent safe fix for a verified issue, then validate it on the same HEAD.

### Lane 3 — Verification & Release Gate

Independently challenge the work, attempt adversarial failure and determine release status.

Execution order is not guaranteed. No lane may assume another lane completed successfully merely because its schedule exists.

All three lanes must read this document before taking Pay-specific decisions.

Documentation is a contract; source, database constraints, executed tests, CI and real E2E are evidence.

---

## 27. Definition of Done

A Pay feature is not complete because its UI exists or its endpoint returns a happy-path response.

A feature is done only when:

```text
Requirement
   ↓
Design
   ↓
Authoritative research
   ↓
Implementation
   ↓
Tests
   ↓
Adversarial security review
   ↓
Current-HEAD CI/build/migration validation
   ↓
Real E2E where applicable
   ↓
Documentation/source consistency
   ↓
Release Gate
```

No shortcut replaces a missing proof.

---

## 28. Explicit V1 Non-Goals

To prevent scope ambiguity, V1 does **not** include unless separately approved:

- custodial Merchant Principal balances
- Merchant withdrawal of ordinary payment principal
- multi-level referrals
- commission on signup/click alone
- frontend-defined referral tiers
- hidden extra payment fees
- arbitrary fee overrides through client input
- wallet private-key recovery by SolMint support
- SolMint possession of user seed phrases
- automatic payout from the Affiliate's own user wallet
- accepting ambiguous blockchain candidates as successful
- activating `/pay` before release gates pass

---

## 29. Authoritative Terminology

Use these terms consistently:

- **Seed phrase / recovery phrase:** user's wallet recovery secret.
- **Private key:** cryptographic signing secret.
- **User wallet:** Merchant/Affiliate wallet controlled by the user.
- **Operational wallet:** wallet controlled by SolMint for a defined business purpose.
- **Merchant Principal:** money economically belonging to Merchant.
- **Gateway Revenue:** SolMint's earned payment fee.
- **Referral Liability:** money owed to Affiliate.
- **Settlement:** on-chain movement satisfying the Payment Intent's economic terms.
- **Withdrawal:** separate request to move a held/owed balance from an operational balance to a verified destination.
- **Verification:** independent proof that an observed blockchain transaction satisfies the Payment Intent.
- **Reconciliation:** atomic persistence of verified blockchain outcome into application state and accounting.

Using "password" for a seed phrase is prohibited in technical documentation and UI copy where precise terminology is required.

---

## 30. Final Business Flow

The intended V1 end-to-end model is:

```text
                    CUSTOMER
                       |
                       v
               Payment Intent
                       |
                       v
                Solana payment
                       |
             +---------+---------+
             |                   |
             v                   v
       Merchant wallet      SolMint wallet
       Merchant Principal   Gateway Revenue
                                  |
                                  v
                          Referral Liability
                                  |
                                  v
                         Affiliate withdrawal
                                  |
                                  v
                          Affiliate wallet
```

The Merchant's ordinary payment principal never needs to enter a SolMint custodial Merchant balance in V1.

The Affiliate's earned amount is a liability and is paid from a SolMint-controlled operational payout flow only after withdrawal eligibility and destination ownership checks.

This is the authoritative V1 product and engineering model.