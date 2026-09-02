# SolMint Pay — Authoritative Project Specification

> **Status:** Product and engineering source of truth for SolMint Pay.
>
> This document is the binding product contract for the Pay workstream. It defines what SolMint Pay is, how money moves, how revenue is calculated, how referral earnings work, what the backend and database must guarantee, how the frontend must behave, and what must be proven before release.
>
> **Critical rule:** documentation is not implementation evidence. Every requirement below must eventually map to source code, database constraints, automated tests, CI evidence, and—where payment or blockchain correctness is involved—real Devnet/E2E evidence.

## 1. Executive Product Decision

SolMint Pay is a **non-custodial Solana payment gateway**.

For the first production release:

1. The customer pays a Merchant directly on Solana.
2. SolMint independently verifies the blockchain transaction.
3. SolMint's gateway fee is **1.00% (100 bps)**.
4. The gateway fee is sent to the SolMint fee destination according to the verified settlement plan.
5. Merchant principal is **not held in a SolMint custodial balance** in V1.
6. Therefore the Merchant does **not** need to request a withdrawal for ordinary payment principal in V1; the payment is settled directly to the Merchant receiving wallet.
7. Referral earnings are a separate liability. They are accumulated in a SolMint-controlled referral payout balance and the Affiliate requests withdrawal.
8. The first release is single-chain: Solana.
9. Primary supported assets: SOL, USDC and USDT.
10. `/pay` and production Pay APIs remain disabled until all release gates pass.

This decision intentionally resolves a potential contradiction between a non-custodial gateway and a custodial Merchant withdrawal model. A future managed/custodial Merchant settlement product would be a separate product mode with its own legal, custody, signer, treasury, reconciliation and release requirements. It is **not** part of V1.

## 2. Non-Negotiable Source-of-Truth Hierarchy

For any conflict, use the following authority order:

1. Database constraints and authoritative append-only financial ledger state for financial invariants.
2. Server-side verification and authorization for security decisions.
3. Immutable Payment Intent snapshot for business terms agreed at payment creation.
4. Verified blockchain observation for on-chain truth.
5. Frontend only for presentation and user input.
6. Webhooks only for notification and delivery.
7. Referral codes only for attribution/discovery.

Never treat these as equivalent:

- Payment Intent = Blockchain Transaction
- Reference = Proof of Payment
- Webhook = Source of Truth
- Frontend = Trusted System
- Observed transaction = Financially recognized payment
- Referral code = authorization
- Cached balance = accounting truth

## 3. V1 Commercial Model

### 3.1 Gateway fee

The V1 Gateway fee is **1.00% = 100 basis points**.

There is **no additional 1.50% fee/share in V1**.

The previously discussed 1.50% wording is intentionally not interpreted as a second fee because it was ambiguous and could create a hidden or conflicting commercial charge. V1 must have one unambiguous primary fee rule. A future 1.50% commercial component may be introduced only as a new, explicitly named, versioned policy with its own calculation, UI disclosure, ledger entry and Payment Intent snapshot.

### 3.2 Fee payer modes

SolMint Pay supports two V1 fee-payer modes:

**Merchant-paid fee**

```text
Gross Payment = 100 USDC
Gateway Fee   = 1 USDC
Merchant      = 99 USDC
SolMint       = 1 USDC
Customer pays = 100 USDC
```

**Customer-paid fee**

```text
Merchant Principal = 100 USDC
Gateway Fee        = 1 USDC
Merchant receives  = 100 USDC
Customer pays      = 101 USDC
SolMint            = 1 USDC
```

The selected fee payer and calculated values are immutable fields of the Payment Intent.

### 3.3 Direct settlement architecture

The preferred V1 transaction plan contains two value-transfer legs when applicable:

```text
Customer wallet
      |
      +---- Merchant settlement ----> Merchant receiving wallet
      |
      +---- Gateway fee ------------> SolMint fee destination
```

For SPL tokens, the corresponding token accounts/ATAs and authorities must be independently validated. Wallet addresses and token accounts must never be conflated.

### 3.4 Merchant withdrawal decision

**V1 does not implement custodial Merchant withdrawal of ordinary payment principal.**

The Merchant receiving wallet gets its entitled settlement directly on-chain. A merchant dashboard may show a **reporting mirror** of verified merchant principal, but that mirror is not a custody balance and cannot be spent by SolMint.

Any future feature described as Merchant Withdrawal must be a separate settlement mode and must not be silently added to the V1 direct-settlement model.

## 4. Accounting Model

The accounting domains are independent:

1. **Merchant Principal** — economically belonging to Merchant.
2. **SolMint Gateway Revenue** — earned 1% gateway fee.
3. **Referral Liability** — money owed to eligible Affiliates.
4. **Gas Sponsorship** — network-cost accounting.
5. **Refund/Reversal** — return or reversal of previously recognized value.

Recommended accounting flow:

```text
Authoritative Verified Payment
          |
          +--> Merchant Principal / Settlement evidence
          |
          +--> Gateway Revenue
                   |
                   +--> Referral Liability
                   |
                   +--> Net SolMint Revenue
```

Important: when Merchant settlement is direct to the Merchant wallet, the Merchant Principal ledger is a verified accounting/reporting mirror of the on-chain settlement. It is not a SolMint custody account.

Financial recognition happens only after complete verification.

Ledgers are append-only. Corrections use compensating entries/reversals rather than destructive mutation.

All monetary calculations use atomic integer units. No floating-point arithmetic is permitted for money.

## 5. Referral / Affiliate Program — V1 Contract

### 5.1 Core rule

Referral commission is a percentage of **eligible SolMint gateway revenue**, not gross Merchant principal and not signup/click activity.

Example:

```text
Gross payment             100 USDC
Gateway fee                1 USDC
Affiliate commission rate 20%
Affiliate liability        0.20 USDC
SolMint retained revenue   0.80 USDC
```

### 5.2 No multi-level referrals

V1 has exactly one referral level:

```text
Affiliate -> Merchant
```

There is no Affiliate -> Affiliate -> Merchant commission chain in V1.

### 5.3 Affiliate tiers

Referral income scales with the number of **active eligible referred Merchants**.

Launch policy:

| Tier | Active eligible referred Merchants | Commission on eligible Gateway Revenue |
|---|---:|---:|
| Starter | 1–2 | 10% |
| Growth | 3–9 | 15% |
| Partner | 10–24 | 20% |
| Strategic | 25+ | 25% |

These are the **V1 commercial policy values** for implementation unless a later signed/approved product specification explicitly versions the policy.

### 5.4 Definition of active eligible referred Merchant

A referred Merchant counts as **active eligible** when all of the following are true:

- the Merchant is active and not suspended/closed;
- the referral relationship is valid and attributable to the Affiliate;
- the Merchant has at least one authoritative completed payment within the trailing **30 calendar days**;
- the relevant payment is not merely detected, submitted, or unverified;
- the Merchant is not the Affiliate's prohibited self-referral identity.

Frontend counters are never authoritative for tier calculation.

### 5.5 Tier timing

The tier used for a commission is the Affiliate's tier at the moment the underlying payment becomes **authoritative and eligible for revenue recognition**.

The resulting commission rate is snapshotted permanently onto the commission record.

A later change in tier does not rewrite historical commissions.

### 5.6 Attribution rules

A Merchant may have at most one active referral relationship in V1.

Attribution must be:

- created/validated server-side;
- associated with the authenticated Merchant identity;
- associated with a real Affiliate identity;
- stored against the Merchant relationship;
- reflected into the Payment Intent snapshot where relevant.

Referral attribution may be corrected before the Merchant creates its first Payment Intent, subject to authorized server-side controls and audit logging. Once the Merchant has created its first Payment Intent, the referral relationship becomes immutable for ordinary application users. Any exceptional administrative correction requires an explicit audited compensating/accounting policy and may not silently rewrite historical commissions.

Referral codes are discovery/attribution mechanisms only. They are never payment proof, authorization, or settlement evidence.

### 5.7 Self-referral

Self-referral is prohibited.

The system must reject an attribution where the Affiliate and Merchant resolve to the same prohibited ownership/identity relationship, subject to the application's authoritative identity rules.

This must be enforced server-side. Frontend checks are advisory only.

### 5.8 Commission eligibility

A commission may be created only when:

1. the payment intent is valid;
2. the referenced Merchant relationship is valid;
3. the payment has authoritative blockchain verification;
4. the gateway fee has been recognized;
5. the applicable Affiliate/tier policy is known;
6. the commission calculation is deterministic;
7. no prior commission exists for the same `(referral, payment)` pair.

### 5.9 Referral liability

Referral earnings are **not SolMint free revenue**.

They must be represented as a liability.

The system must separately track at least:

- pending earnings;
- payable earnings;
- paid earnings;
- reversed earnings;
- withdrawal requests;
- payout transaction signatures.

### 5.10 Referral payout custody model

The requested V1 product behavior is:

```text
Verified eligible commission
          |
          v
SolMint-controlled referral payout balance
          |
          v
Affiliate withdrawal request
          |
          v
Payout transaction
          |
          v
Verified on-chain payout
```

This creates an actual operational custody/liability boundary for Affiliate funds. The database and product must therefore treat the amount as an Affiliate liability, never as spendable SolMint revenue.

Any future change to this custody model requires a new product decision and security/legal review.

### 5.11 Referral payout wallet

The Affiliate payout destination must:

- be a valid Solana address;
- be owned by the Affiliate according to the project's wallet-ownership verification mechanism;
- be verified before payout;
- be bound to the withdrawal request;
- be immutable for that withdrawal after processing begins;
- never expose or require private keys from SolMint.

### 5.12 Withdrawal rules

Affiliate withdrawal creation requires:

- authenticated Affiliate identity;
- ownership verification;
- sufficient payable balance;
- idempotency;
- concurrent-worker protection;
- minimum-withdrawal policy;
- immutable payout destination snapshot;
- explicit state machine;
- payout transaction signature;
- final reconciliation.

**V1 minimum withdrawal:** 10 USD-equivalent of the payout asset, determined using a server-side documented pricing source at withdrawal eligibility time. A concrete oracle/price-provider implementation must be selected and independently audited before enabling USD-equivalent rules. Until that provider is available, the system must not pretend the threshold is operational.

Payout batching is preferred to per-commission transactions when economically and operationally safe.

### 5.13 Referral withdrawal state machine

```text
REQUESTED -> VALIDATING -> APPROVED -> PROCESSING -> PAID
```

Exceptional states:

```text
REJECTED
CANCELLED
FAILED
REVERSED
```

A paid withdrawal can never be paid again.

### 5.14 Refund/reversal interaction

If a payment that produced referral liability is refunded or otherwise financially reversed:

- the original commission record is not edited destructively;
- a compensating reversal is created;
- payable balance is reduced by the reversal where applicable;
- an already-paid amount becomes an Affiliate receivable/offset according to an explicit policy;
- future withdrawals must account for the resulting balance.

No refund may create free referral money.

## 6. Payment Intent Contract

A Payment Intent is the canonical business agreement before payment.

It must snapshot at creation time, where applicable:

- Payment Intent ID;
- Merchant ID;
- external order ID;
- amount in atomic units;
- asset;
- token mint;
- token program;
- token decimals;
- Merchant receiving destination;
- reference;
- gateway fee rate;
- fee payer;
- gateway fee amount;
- customer total;
- merchant settlement amount;
- SolMint fee destination;
- expiry;
- gas sponsorship policy;
- referral attribution/policy relevant to the payment.

Merchant/global settings must not silently rewrite an existing Payment Intent.

## 7. Blockchain Truth and Verification

Payment verification must independently validate the observed transaction against the immutable Payment Intent.

At minimum, where applicable:

- signature;
- successful execution;
- required commitment/finality;
- block/time validity;
- exact reference presence;
- recipient/destination;
- atomic amount;
- asset;
- token mint;
- token program;
- token decimals;
- token-account ownership/authority;
- source/transfer authority;
- fee payer and relevant signers;
- merchant settlement transfer;
- gateway fee transfer;
- expected transaction/message structure;
- duplicate/replay state.

Reference discovery is not proof of payment.

`getSignaturesForAddress` is a discovery mechanism, not payment proof.

Discovery must be paginated and restricted to a Payment Intent time window. Incomplete discovery is retryable/incomplete and must never become `no_match`.

Multiple independently valid candidates must become `ambiguous` and must not be resolved by selecting the first result.

## 8. Reconciliation Architecture

Responsibilities are separated:

```text
Observer
  -> discovers observations

Verifier
  -> decides whether observation satisfies Payment Intent

Reconciliation
  -> atomically persists decision and state transition

Ledger
  -> financial truth
```

No financial write happens before authoritative verification.

Required outcomes include:

- confirmed;
- duplicate;
- underpaid;
- overpaid;
- wrong token;
- wrong recipient;
- failed;
- expired;
- ambiguous;
- provider unavailable;
- stale/incomplete.

Concurrent workers must converge to one recognized signature.

## 9. Payment State Machine

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

Transitions must be guarded in application logic and database boundaries where practical.

## 10. Merchant Isolation and Authorization

Every Merchant is a separate tenant.

Every sensitive endpoint derives Merchant identity from authenticated credentials rather than trusting a caller-controlled Merchant ID.

RLS/authorization must block cross-tenant access to:

- payments;
- invoices;
- payment links;
- receiving wallets;
- API keys;
- webhook configuration;
- referral relationships;
- balances/reporting mirrors;
- withdrawal requests;
- reports;
- audit records.

## 11. Merchant Receiving Wallet

V1 permits one authoritative active verified receiving wallet per Merchant.

Registration requires:

- short-lived challenge;
- merchant binding;
- single-use semantics;
- genuine Ed25519 verification;
- valid Solana address handling;
- on-chain validation where required.

Private keys must never enter the backend, database, source code, logs or application configuration.

## 12. API Keys and API Security

Merchant API keys are bearer credentials.

Persist only one-way digests where possible. Support:

- scopes;
- expiry;
- revocation;
- key prefix;
- last-used timestamp;
- Merchant binding.

Production APIs must implement, where relevant:

- authentication;
- authorization;
- tenant isolation;
- atomic rate limiting;
- idempotency;
- input validation;
- body-size limits;
- request IDs;
- audit logging;
- safe error responses;
- secret hygiene;
- abuse controls;
- timeout handling.

## 13. Webhooks

Webhooks are notifications only.

Required properties:

- HMAC signing;
- timestamp binding;
- replay protection;
- event IDs;
- per-webhook uniqueness;
- retry/backoff;
- timeout;
- delivery history;
- delivery locks;
- dead-letter state;
- secret rotation;
- encrypted secret persistence;
- SSRF-safe outbound delivery;
- operational visibility.

The same event may be delivered to multiple Merchant endpoints, so uniqueness must include the webhook identity.

## 14. Gas Sponsorship

Gas sponsorship is optional and separately accounted for.

Supported funding models:

- merchant-funded;
- SolMint-funded.

Required controls:

- per-payment limit;
- daily limit;
- policy enforcement;
- simulation where appropriate;
- emergency disable;
- signer isolation;
- no signing oracle;
- spend ledger;
- on-chain spend reconciliation.

Cached balances are not accounting truth.

## 15. Backend Architecture

The Pay backend must keep these responsibilities separate:

```text
API/Auth
   |
   v
Payment Intent Service
   |
   v
Observer / RPC Provider
   |
   v
Verifier
   |
   v
Reconciliation
   |
   +--> Payment State
   +--> Accounting Ledger
   +--> Referral Liability
   +--> Webhook Event
```

Referral and withdrawal systems must not be able to bypass Payment Verification or ledger invariants.

The preferred architecture is modular and low-coupling. UI logic must never contain financial decision logic.

## 16. Database Rules

Migrations must be:

- uniquely named;
- ordered;
- deterministic;
- auditable;
- dependency-safe;
- atomic where practical.

Financial/security invariants should be enforced in the DB where practical.

`SECURITY DEFINER` is allowed only when necessary and must use `search_path=''`, schema-qualified references, and least privilege.

Ledger tables must be append-only. Historical financial records must not be updated or deleted merely to correct an error.

## 17. Referral Data Model — Required Concepts

The production data model must be capable of representing at least:

```text
Affiliate
  ├─ identity
  ├─ status
  ├─ payout wallet
  └─ tier policy / effective rate

Referral Relationship
  ├─ Affiliate
  ├─ Merchant
  ├─ attribution time
  └─ active/immutable state

Commission
  ├─ Referral
  ├─ Payment
  ├─ eligible Gateway Revenue
  ├─ commission rate snapshot
  ├─ commission amount
  └─ lifecycle status

Affiliate Liability
  ├─ pending
  ├─ payable
  ├─ paid
  └─ reversed

Affiliate Withdrawal
  ├─ requested amount
  ├─ destination snapshot
  ├─ idempotency
  ├─ status
  └─ payout signature
```

A schema containing only Affiliate + Commission rows is not sufficient evidence of a complete payout system.

## 18. Frontend Product Scope

Pay is a separate frontend product boundary under `src/pay/`.

Target structure:

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
│   ├── withdrawals/
│   ├── analytics/
│   └── developer/
├── i18n/
├── layouts/
├── pages/
├── services/
├── styles/
└── types/
```

## 19. Customer Checkout

The customer must clearly see:

- Merchant identity;
- amount;
- asset/network;
- fee payer and fee information;
- total payable;
- reference/payment status;
- expiry;
- wallet action;
- success/failure/incomplete states.

The UI must never claim payment success merely because a wallet transaction was submitted.

## 20. Merchant Dashboard

The dashboard should expose:

- verified/pending payment reporting;
- payment history;
- transaction signature/details;
- payment links;
- invoices;
- webhook settings/delivery history;
- API keys;
- wallet settings;
- security/audit events;
- analytics.

Because V1 is direct-settlement/non-custodial, the dashboard may show:

- verified Merchant Principal;
- pending Merchant Principal;
- payment settlement history;

but must not represent those values as SolMint-held custodial funds.

## 21. Affiliate Dashboard

The Affiliate dashboard should expose:

- active eligible referred Merchants;
- current tier;
- next tier threshold;
- eligible earnings;
- pending earnings;
- payable earnings;
- paid earnings;
- reversed earnings;
- withdrawal requests;
- payout history;
- payout wallet verification state.

Internal secrets, signing material and security-only fields must never be displayed.

## 22. UI and Visual Direction

The default Pay UI is **light/bright**.

Required direction:

- white/light surfaces;
- high readability and contrast;
- restrained SolMint brand accents;
- mobile-first checkout;
- responsive dashboard;
- clear financial hierarchy;
- accessible focus/hover/disabled states;
- logical CSS properties for RTL/LTR;
- no dark-only dependency;
- minimal decorative animation;
- professional payment-product visual language.

Do not build Pay as a visually noisy crypto demo.

## 23. Multilingual / i18n

Required locales from the architecture stage:

- Persian `fa-IR`;
- English `en-US`;
- Arabic `ar`;
- Russian `ru`.

Persian is the first polished locale, but components must not hard-code Persian strings.

Requirements:

- locale registry;
- translation keys;
- RTL/LTR handling;
- localized numbers and dates;
- grammar-safe translated messages;
- logical CSS properties;
- locale-aware error presentation.

Backend security decisions must never depend on UI language.

## 24. SEO and Public Information Architecture

SEO is part of the Pay public information layer, not part of financial truth.

Public pages may include:

- Pay overview;
- pricing;
- merchant documentation;
- API reference;
- webhook documentation;
- supported assets;
- security model;
- FAQ;
- integration guides.

Merchant dashboards, internal payment endpoints and sensitive API surfaces must not be indexable.

SEO work must never change payment accounting or verification behavior.

## 25. Supported Channels

The engine is designed to support:

- hosted checkout;
- payment links;
- QR / Solana Pay-compatible requests;
- API integration;
- SDK/application integration;
- invoices;
- social sharing via payment links.

A channel is not production-ready until its path ends at the same Payment Intent, Verification, Reconciliation and Ledger invariants.

## 26. Security Invariants

The following are absolute:

- ambiguity = reject/retryable ambiguous;
- incomplete verification = retry/incomplete;
- RPC failure = failure/retry;
- stale state = reject/retry;
- invalid authorization = reject;
- duplicate signature = reject;
- replay = reject;
- cross-tenant access = reject;
- private key exposure = never allowed;
- frontend state = untrusted;
- webhook = notification only;
- referral code = attribution only.

## 27. Testing Requirements

Important features require:

- unit tests;
- integration tests;
- security tests;
- failure tests;
- concurrency tests;
- real Devnet/Testnet E2E where appropriate.

Payment cases must include at least:

- valid payment;
- underpayment;
- overpayment;
- wrong asset/token;
- wrong recipient;
- wrong reference;
- failed transaction;
- expired intent;
- duplicate signature;
- cross-payment replay;
- ambiguous candidates;
- incomplete discovery;
- RPC outage/stale observation;
- concurrent reconciliation;
- cross-Merchant access;
- wallet challenge replay/forgery;
- idempotency-key reuse with changed request;
- webhook replay;
- webhook SSRF attempt;
- referral self-attribution;
- tier manipulation;
- duplicate commission;
- refund commission reversal;
- duplicate Affiliate withdrawal;
- withdrawal race;
- payout to unverified wallet.

Mocks are evidence for unit behavior only. They do not prove production readiness.

## 28. CI and Release Gates

The following must all pass before V1 production launch:

1. Current branch/HEAD integrity and correct ancestry.
2. No unresolved divergence from the production base.
3. Typecheck and production build on current HEAD.
4. Unit/integration/security/failure/concurrency tests on current HEAD.
5. Real Devnet/Testnet transaction E2E on current implementation.
6. Blockchain verification correctness.
7. Reference discovery completeness.
8. Replay/idempotency/race protection.
9. Reconciliation atomicity.
10. Accounting separation and ledger integrity.
11. Referral attribution/commission/liability/payout path.
12. Merchant authentication and RLS isolation.
13. Receiving wallet ownership verification.
14. API abuse controls and rate limiting.
15. Migration validation and deterministic migration history.
16. Webhook signing/replay/retry/DLQ/SSRF controls.
17. RPC provider reliability and stale-data behavior.
18. Gas sponsorship policy and signer isolation.
19. Observability and incident readiness.
20. Frontend responsive/accessibility review.
21. i18n/RTL/LTR validation.
22. Public SEO/information-architecture review.
23. Documentation/source consistency.
24. Production infrastructure/deployment validation.
25. Explicit final production approval.

`UNKNOWN`, `CANCELLED`, `INCOMPLETE`, stale evidence, old SHA evidence, or missing evidence is **NOT PASS**.

`/pay` must remain disabled until all required gates pass.

## 29. Evidence Rules

The following are explicitly **not** sufficient evidence:

- a migration file exists;
- a test file exists;
- a previous CI run was green;
- a PR is mergeable;
- a reference was found;
- a webhook was signed;
- a payment transaction was submitted by a wallet;
- a mock passed;
- a frontend says `success`;
- a documentation statement says a feature exists.

Valid evidence must be tied to the current relevant HEAD and, for payment correctness, preferably to real Devnet/Testnet behavior.

## 30. Operational and Incident Requirements

The system must produce sufficient structured evidence to answer:

- what Payment Intent was involved;
- what Merchant was involved;
- what blockchain signature was observed;
- which verifier decision was made;
- which reconciliation worker/state transition ran;
- which ledger entries were created;
- whether a Referral Liability was created;
- whether a withdrawal was created;
- whether a webhook was dispatched;
- whether an RPC/provider was stale or unavailable.

Do not log secrets, private keys or sensitive bearer credentials.

## 31. Implementation Priorities

When several tasks are available, work in this order unless current evidence proves a different critical blocker:

1. Correctness/security blockers.
2. Current-HEAD branch/migration/CI blockers.
3. Payment verification and reconciliation.
4. Accounting invariants.
5. Referral attribution, tier, liability and payout.
6. Merchant/affiliate authorization and RLS.
7. Webhook/RPC/gas reliability.
8. Frontend checkout/dashboard.
9. UI polish.
10. SEO/public growth work.

Do not optimize visuals while a financial or security invariant remains unresolved.

## 32. Required Documentation Map

The Pay workstream should keep these documents aligned:

```text
docs/solmint-pay-project-spec.md     <- this authoritative product/engineering contract
docs/solmint-pay-foundation.md      <- foundation architecture and release planning
docs/solmint-pay-payment-engine.md  <- payment engine details
docs/solmint-pay-reconciliation.md  <- reconciliation details
docs/solmint-pay-security-audit.md  <- security/audit findings and decisions
docs/solmint-pay-api-v1.md          <- public API contract
docs/solmint-pay-devnet-e2e.md      <- real E2E procedure/evidence
docs/solmint-pay-foundation-audit.md <- foundation audit record
src/pay/README.md                   <- developer-facing Pay module entry point
```

If a lower-level document conflicts with this file, the conflict must be reported and resolved rather than silently choosing one.

## 33. Automation Contract

Three recurring SolMint Pay lanes consume this document:

### Lane 1 — Audit & Priority

Find the highest-risk unresolved security, financial, architectural, integration or release issue. Verify it on the current HEAD. Do not invent requirements.

### Lane 2 — Implementation & Hardening

Implement the smallest coherent fix for the highest-priority verified issue. Follow this document and validate on the same HEAD.

### Lane 3 — Verification & Release Gate

Independently try to break the implementation. Challenge Lane 1 and Lane 2 results. Determine PASS/NOT PASS for every release gate using direct evidence.

Recurring execution order is not guaranteed. Every lane must fetch current repository state before acting.

## 34. Change-Control Rules for Product Economics

The following values are V1 product policy and may not be silently changed by automation or ordinary implementation work:

- Gateway fee: 1.00% / 100 bps;
- no additional 1.50% fee/share in V1;
- direct non-custodial Merchant settlement;
- no ordinary Merchant custodial withdrawal in V1;
- one referral level;
- referral commission based on eligible Gateway Revenue;
- referral tiers: 10% / 15% / 20% / 25%;
- active referred Merchant metric: authoritative payment activity within trailing 30 days;
- commission rate snapshot at authoritative payment recognition;
- Affiliate withdrawal model;
- 10 USD-equivalent V1 minimum Affiliate withdrawal, subject to an approved operational price source before enabling the rule.

Any change to these values is a **product decision**, not a routine implementation detail. It requires an updated version of this document and corresponding code/schema/test changes.

## 35. Final Product Definition

SolMint Pay V1 is therefore defined as:

```text
Customer
   |
   |  Solana transaction
   v
Merchant receiving wallet  <---- Merchant principal settles directly
   |
   +------------------------------+
                                  |
                                  v
                           SolMint gateway fee
                                  |
                      +-----------+-----------+
                      |                       |
                      v                       v
                SolMint revenue      Referral liability
                                              |
                                              v
                                      Affiliate request
                                              |
                                              v
                                      SolMint payout flow
                                              |
                                              v
                                      Verified Affiliate wallet
```

The gateway's job is not to become the custodian of Merchant principal in V1. Its job is to create deterministic payment intents, produce a verifiable transaction plan, independently verify blockchain truth, reconcile exactly once, account correctly, notify safely, and operate a controlled Affiliate payout/liability system.

That is the contract to implement, test, audit and verify before production launch.