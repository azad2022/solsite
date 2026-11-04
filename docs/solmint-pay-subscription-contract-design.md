# SolMint Pay — Subscription Domain and Lifecycle Contract Design

**Date:** 2026-11-03  
**Repository:** `azad2022/solsite`  
**Branch:** `feat/pay-subscription-billing`  
**Design source HEAD:** `8109532f8402bdb72dd3e0ab5ea8572dedd66481`  
**Pinned upstream Program:** `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75` (`program-v0.5.0`)  
**Document status:** DESIGN DRAFT — NOT FROZEN, NOT AN IMPLEMENTATION  
**Gate status:** G0 inventory segment PASS; overall G0 BLOCKED by its unresolved evidence items. G1 approval NOT RECORDED. G2 PARTIAL / BLOCKED.

This document records the first typed domain and lifecycle design derived from the current SolMint Pay source, the current read-only Production contract, and the exact pinned Subscription Program source. It intentionally does **not** define SQL table names, migration identifiers, API routes, request/response payloads, or new runtime enums. Those remain Contract Freeze work and require review before implementation.

No Subscription API, database object, signer, worker, transaction builder, verifier, accounting path, or UI is declared implemented by this document.

---

## 1. Decision summary

1. Subscription is a separate bounded context. It is not a recurring Payment Intent and must not be represented by arbitrary Payment Intent metadata.
2. The Solana Program exposes separate Plan, shared SubscriptionAuthority, and per-Plan/per-subscriber SubscriptionDelegation accounts. Their chain state is authoritative only for the fields they actually store.
3. Consent workflow, shared Authority state, SubscriptionDelegation state, collectability, Billing Cycle, transaction Attempt, financial accounting, entitlement, and webhook delivery are independent dimensions. A single `subscription_status` cannot faithfully represent them.
4. A Cycle is anchored to the actual on-chain `current_period_start_ts`; it is not a scheduler date, calendar month, or assumed renewal timestamp.
5. Every authorized Puller must be reconciled. The Plan Owner is always an implicit Puller in v0.5.0, even when the explicit Puller list is empty.
6. The Subscription Authority PDA is the token delegate and is shared per customer+mint. Its SPL delegate approval is `u64::MAX`; it is not a per-cycle allowance.
7. Collector, Puller, transaction fee payer, Rent payer, Plan Owner, subscriber, and token source authority are separate principals. SolMint must fund none of the Rent or transaction network fees.
8. The normal Pay verifier and `pay_apply_verified_observation` remain unchanged. A Subscription-specific verifier and atomic accounting boundary are mandatory.
9. The current Production ledger graph is Payment-Intent-centric. Subscription accounting needs an explicit typed financial origin; creating synthetic Payment Intent IDs is prohibited.
10. V1 exclusions remain in force: no finite Plans, Resume, Immediate CancelNow, implicit or SolMint-funded sponsorship, Durable Nonce or unresolved smart-wallet proposals; no split-fee charge until the remaining dedicated verifier/accounting, approved fee-model and Devnet gates pass (the LiteSVM two-destination cumulative-allowance/rollback sub-gate is PASS); and no Customer entitlement before finalized verification plus atomic accounting.

## 2. Evidence baseline and scope

### 2.1 Repository and CI evidence

At the source HEAD recorded above:

- `feat/pay-subscription-billing` is the active implementation branch.
- PR #366 is OPEN / DRAFT / NOT MERGED.
- Exact-HEAD CI was green at `8109532f8402bdb72dd3e0ab5ea8572dedd66481`: CI, Production Build, Database Security, ordinary Pay Devnet E2E, and Mainnet Read-only all completed SUCCESS. CI includes the pinned SDK compatibility, reproducible Program build, ProgramData read-only verification, and TM-06 sponsored-Plan refund regression jobs.
- Green CI validates only the checked source and workflows. It does not mean Subscription production lifecycle is implemented or that Stage 2 is release-ready.

### 2.2 Current Production database evidence — read-only

Project `nvopkbiedorfshwbmyhn` was inspected using metadata/SELECT-only operations on 2026-11-03:

- Project state: `ACTIVE_HEALTHY`; PostgreSQL 17.6.1.147.
- `supabase_migrations.schema_migrations`: 106 entries; latest recorded version `20261029140401`.
- Public base tables: 52; `public.pay_*` base tables: 33.
- No public base table named for Subscription was found.
- The current Pay membership, payment, transaction, transfer, merchant ledger, revenue ledger, commission, gas, idempotency and audit objects were inspected. They do not provide a typed Subscription/Cycle/Consent/Attempt/Collector aggregate.

No Production schema or data was changed.

### 2.3 Existing application contract

The current codebase has:

- Merchant membership roles: `owner`, `admin`, `finance`, `developer`, `viewer`.
- Existing Pay capabilities: merchant, payment, invoice, webhook, API-key, gas, and referral capabilities. There is no Subscription capability in the current authorization union.
- Server-side Better Auth application identity -> internal JWT -> PostgREST identity bridge.
- Membership-based `pay_has_merchant_access` and merchant-scoped SELECT RLS policies.
- Existing one-off Payment Intent APIs and verification/reconciliation paths.
- A validation-only `validateSubscriptionPlanPolicy` helper and an isolated SDK compatibility harness. Neither implements Subscription API, Plan creation, customer consent, billing, Collector signing, verification or accounting.

The application authorization helper contains a platform `superadmin` bypass, while the database `pay_has_merchant_access` helper relies on an active merchant membership. These are different enforcement layers. Contract Freeze must define where platform administration is permitted and how server routes remain consistent with RLS; a platform role must not be assumed to satisfy merchant membership automatically.

### 2.4 Existing Production Pay verifier — must remain unchanged

The live `public.pay_apply_verified_observation` is SECURITY DEFINER with an empty search path and is executable by `service_role` and `postgres`, not by `authenticated`.

It is bound to a Payment Intent. Among other invariants, it:

- locks and reads the Payment Intent;
- validates the snapshot, success, signature, reference match and required commitment;
- requires exactly one matching Merchant settlement transfer and one matching gateway-fee transfer;
- requires both transfer legs to have the same `sourceAuthority`;
- requires transaction `fee_payer` to equal that same source authority;
- writes Payment Transaction/Transfer observations and recognizes the existing Payment Intent revenue path.

A Subscription pull normally spends from the subscriber ATA under a SubscriptionAuthority PDA, while the transaction fee payer is a distinct Customer/Merchant-funded signer and the instruction caller is an authorized Plan Puller. Therefore the current source-authority/fee-payer equality is not the Subscription contract. Do not loosen or fork this RPC in place.

### 2.5 Existing accounting graph

The live Pay accounting objects are structurally tied to one-off payments:

- `pay_payment_transactions.payment_id` references `pay_payment_intents.id`.
- `pay_payment_transfers.payment_transaction_id` references a Payment Transaction.
- `pay_merchant_ledger` requires Payment Intent and Payment Transaction references.
- `pay_revenue_ledger.payment_id` references a Payment Intent and is unique per Payment Intent.
- `pay_commissions.payment_id` references a Payment Intent.
- `pay_gas_ledger.related_payment_id` references a Payment Intent.

A Subscription cycle cannot be represented safely by inserting fake Payment Intents just to satisfy these foreign keys. A typed Subscription financial origin and an explicit accounting bridge must be designed before any Subscription-ledger mutation.

## 3. Pinned on-chain model — facts, not SolMint enums

This section describes the pinned upstream Program and does not create SolMint states.

### 3.1 Plan

- Plan PDA seeds: `["plan", owner, plan_id]`.
- Plan records its Merchant/Plan Owner, bump, status, and immutable Plan data.
- Program Plan status values are exactly `Active = 1` and `Sunset = 0`.
- Plan terms include mint, amount per period, period hours, creation timestamp, optional end timestamp, destination owners and additional Pullers.
- Plan Owner is always authorized to pull; up to four additional Puller addresses can also be authorized.
- An empty destination array permits any receiver. SolMint's existing Plan policy correctly rejects an empty destination allowlist.
- `Sunset` blocks new Subscribe calls but does not itself stop already-created subscriptions from pulling.
- `end_ts = 0` represents a perpetual Plan. `DeletePlan` requires a non-zero end timestamp in the past and returns Plan account rent to the Plan Owner. A perpetual Plan therefore has no normal DeletePlan cleanup path in v0.5.0.

### 3.2 Shared SubscriptionAuthority

- PDA seeds: `["SubscriptionAuthority", user, token_mint]`.
- One account exists per Customer wallet + token mint pair; it is shared across that pair's subscriptions.
- It stores `user`, `token_mint`, original Rent `payer`, bump, and slot-derived `init_id`.
- The Program approves the PDA as the ATA SPL delegate with `u64::MAX`. Effective spending limits are enforced in each SubscriptionDelegation and Plan path, not by a per-cycle delegate allowance.
- `init_id` is slot-granular, not a monotonic, globally unique revocation epoch.
- The Program can re-approve the shared delegate on an existing Authority. SolMint must not automatically reinitialize/reapprove after observing a missing delegate or a manual revoke.
- Revoking/closing this Authority affects the Customer+Mint pair, not only one Plan subscription.

### 3.3 SubscriptionDelegation

- PDA seeds: `["subscription", plan_pda, subscriber]`.
- Its header identifies the subscriber as delegator, Plan PDA as delegatee, original Rent payer, and the `init_id` copied from the shared Authority at Subscribe time.
- It stores a snapshot of Plan terms, `amount_pulled_in_period`, `current_period_start_ts`, and `expires_at_ts`.
- On Subscribe, `amount_pulled_in_period = 0`, `current_period_start_ts` is initialized from the on-chain clock and `expires_at_ts = 0`.
- `expires_at_ts = 0` means not cancelled. Ordinary cancellation writes an expiry boundary; transfer is blocked when `current_ts >= expires_at_ts`.
- Transfers update the on-chain period start and cumulative amount. The actual account state, not scheduler assumptions, establishes the current period and amount already consumed.

### 3.4 Transfer and cancellation semantics

- TransferSubscription checks Plan/Mint/terms, the subscriber/Plan binding, authorized caller, destination owner and remaining per-period allowance. The shared Authority PDA is the token delegate.
- The instruction has one destination and one amount. A gateway fee sent to another owner requires a separate instruction/leg and a separately approved accounting model.
- Program events help index and correlate. An event or signature is not, by itself, payment verification or accounting.
- Ordinary Cancel is a scheduled cancellation at the end of the current period, not immediate token-delegate revocation.
- Immediate dual-signed CancelNow and Resume are excluded from v1.
- Plan Owner and each additional authorized Puller may transfer outside the SolMint Collector. All such transfers must be reconciled.

Pinned upstream source locations:
- `program/src/state/common.rs`
- `program/src/state/plan.rs`
- `program/src/state/subscription_authority.rs`
- `program/src/state/subscription_delegation.rs`
- `program/src/instructions/subscribe.rs`
- `program/src/instructions/cancel_subscription.rs`
- `program/src/instructions/transfer_subscription.rs`
- `program/src/instructions/delete_plan.rs`

## 4. Bounded context and conceptual aggregates

The following are domain concepts, not proposed database object names.

| Concept | Responsibility | Primary source of truth |
|---|---|---|
| Merchant Plan | Merchant-authored terms and destinations; links to exact Plan PDA | Merchant contract snapshot + finalized Plan account |
| Customer Consent operation | What the Customer was shown and which exact message was signed/submitted | Immutable backend consent snapshot + wallet/transaction evidence + finalized chain read-back |
| Shared Authority | Customer+Mint delegate authority and its observed incarnation | Finalized SubscriptionAuthority PDA + finalized ATA delegate state |
| Subscription | One Customer's delegation under one Plan | Finalized SubscriptionDelegation PDA + Plan/Authority bindings |
| Billing Cycle | One actual Program period for one Subscription | `subscription PDA + on-chain current_period_start_ts` as conceptual unique identity |
| Billing Attempt | One concrete prepare/sign/submit/reconcile attempt for a Cycle | Durable backend attempt record + transaction and RPC evidence |
| Pull observation | Any successful TransferSubscription from any authorized Puller | Independently parsed finalized transaction and account/balance state |
| Accounting posting | Balanced financial effect for principal, approved gateway fee, referral, network costs and reversals | Dedicated atomic DB accounting commit |
| Entitlement | Service access determined by explicit product policy and paid/accounted evidence | Entitlement policy + committed verified accounting |
| Notification/outbox | Delivery of a previously committed event | Durable outbox and delivery state |

A domain concept does not become a table, field, enum or route until ownership, atomicity, uniqueness, retention, RLS, grants, query patterns and migration dependencies have been reviewed.

## 5. Independent lifecycle dimensions

Do not collapse these dimensions into one generic Subscription status.

### 5.1 Plan lifecycle

- **Local draft/prepared** — a SolMint-side proposal; not an on-chain Plan.
- **Create submitted / outcome unknown** — do not assume the Plan exists or retry with a new Plan ID until the original transaction is reconciled.
- **On-chain Active** — confirmed only by validating the derived Plan PDA, owner, status and exact terms from finalized chain state.
- **On-chain Sunset** — no new Subscribe calls; existing delegations may remain pullable under their own state and Plan expiry conditions.
- **Expired finite Plan / deletion** — excluded as a v1 customer capability; DeletePlan only applies to a finite Plan after its end timestamp. Perpetual Plan lifecycle exit/retention remains unresolved.

### 5.2 Consent transaction lifecycle

These are transaction workflow states, not proof of an active Subscription:

- prepared from an immutable, versioned consent snapshot;
- wallet prompt shown;
- signature obtained;
- submitted;
- outcome unknown;
- finalized and independently read back;
- rejected/expired before submit;
- failed on-chain.

A signature, browser callback, wallet return value, event, or submitted transaction is never enough to move a Subscription to verified/paid. Unknown after submit must reconcile the original signed transaction and exact chain state.

### 5.3 Shared Authority lifecycle

Observe independently:

- Authority PDA absent;
- initialization transaction prepared/signed/submitted/outcome unknown;
- Authority PDA present and validated, including Customer, Mint, recorded payer and actual `init_id`;
- ATA delegate approved/replaced/revoked/unknown;
- Authority closed;
- mismatch or stale Authority incarnation.

Initialization and Subscribe are separate Customer-signed transactions. After initialization, SolMint must read the actual finalized `init_id`, validate the Authority PDA and current ATA delegate, and only then prepare a separate Subscribe transaction. Never use `UNKNOWN_INIT_ID`. Never auto-reinitialize to repair a missing delegate.

### 5.4 SubscriptionDelegation lifecycle

- absent;
- Subscribe prepared/signed/submitted/outcome unknown;
- present and validated from finalized state;
- ordinary cancellation submitted/outcome unknown;
- cancellation observed with a non-zero `expires_at_ts`;
- period still collectable until the on-chain cancellation boundary;
- cancellation boundary elapsed;
- revoked/closed, if the exact upstream revoke/close conditions are met;
- stale/mismatched/unknown chain state.

The Program does not expose a backend delinquency state. An active account does not prove the ATA has sufficient funds, is unfrozen/open, or retains the expected delegate. Collectability must be observed separately before a pull.

### 5.5 Billing Cycle and Attempt lifecycle

A Cycle is derived from the Subscription PDA and actual on-chain period start, not from calendar time.

Conceptual Cycle processing:

1. **Due candidate:** fresh finalized Plan, SubscriptionDelegation, Authority, ATA, asset and all-Puller observations establish the current period and remaining allowance.
2. **Claimed:** a single worker owns a bounded lease/fencing version. A database-enforced unique cycle identity prevents competing work.
3. **Attempt prepared:** persist an immutable transaction intent/message, exact instruction/account plan, signer roles, fee payer, blockhash and last-valid block height before external signing/submission.
4. **Signed/submitted:** record the exact signature and transaction evidence. Collector may be an authorized Puller; the fee payer remains Merchant-owned or explicitly Merchant-funded.
5. **Outcome unknown:** no new charge attempt until the original transaction is reconciled against the chain. Unknown is neither Failed nor Retryable.
6. **Finalized observation:** parse the exact successful transaction, account states and transfers at the required finality.
7. **Verified:** the dedicated Subscription verifier confirms Program, instruction, account, PDA, Customer, Plan, Puller, Authority, ATA, mint/program, destination, atomic amount, cumulative allowance, fee payer and absence of extra instructions/transfers.
8. **Accounted:** one atomic database commit records the Cycle/Attempt result, verified observation, principal/fee accounting, relevant network cost/referral/refund entries and outbox event.
9. **Terminal failure or safe pre-submit retry:** only when evidence proves no charge was submitted/executed. A timeout or missing RPC result after submit is not a safe retry condition.

### 5.6 Accounting and entitlement lifecycle

- Chain transfer finalized and independently verified is not yet the same as committed accounting.
- Verified transfer plus a successful atomic ledger commit is the earliest point at which a financial charge may be reported as successfully accounted.
- Entitlement is a separate product policy. Its start, grace period, delinquency, pause, retry and cancellation effects are not defined by the upstream Program and remain unresolved.
- Webhook/outbox delivery is downstream of accounting. Delivery retry/failure cannot reverse or create financial truth.
- Reversal/refund is a separately verified and atomically accounted operation; it cannot erase an immutable original charge.

## 6. Principal and payment-cost matrix

| Principal | Authority / responsibility | What it must not be conflated with |
|---|---|---|
| Customer / subscriber | Owns token source ATA, signs Consent/init/Subscribe/cancellation operations, funds own Authority and Subscription Rent and own setup/control network fees | Plan Owner, Collector, transaction fee payer for Merchant billing |
| Merchant / Plan Owner | Owns and administers Plan, defines allowlisted destinations/Pullers, funds Plan Rent and Plan operation fees; must fund recurring pull network fee | Customer token source authority or Collector signer |
| Plan Owner | Always an implicit authorized Puller in the pinned Program; its pulls can occur outside SolMint | Collector-exclusive authorization |
| Additional Puller / Collector | Authorized caller/signatory for TransferSubscription only after being listed on the Plan and passing strict job policy | Plan Owner, token delegate, transaction fee payer paid by SolMint |
| Transaction network fee payer | Signs and funds the transaction's network fee; recurring billing fee payer must be Merchant-owned or explicitly Merchant-funded | Instruction-level Rent payer, token source authority, Puller |
| Instruction-level Rent payer | Funds creation of an on-chain account; account-specific refund routing follows Program account fields/rules | Transaction network fee payer |
| SubscriptionAuthority PDA | SPL Token delegate for the Customer+Mint pair; approved with `u64::MAX` | The Customer's signed Consent or a per-cycle spend amount |
| SolMint | Backend policy, scheduler/claim/reconciliation, isolated Collector orchestration, verifier and accounting | Rent/network-fee sponsor or source of funds |

V1 cost rule: SolMint pays no account Rent and no transaction network fees. If the Merchant-funded fee payer is not available and cannot sign the billing transaction, do not submit the recurring pull. No SolMint gas tank, treasury subsidy or pass-through markup is introduced. SolMint revenue remains only the previously approved gateway commission.

The existing `gateway_fee_bps` and one-off Payment Intent fee snapshot do not, by themselves, approve a Subscription fee rate or split-transfer design. No 100 bps default, fee amount, fee destination, referral percentage or new pass-through rule is carried into Subscription by assumption.

## 7. Authorization and tenant boundary

### 7.1 Existing facts

The current role vocabulary is:

- `owner`
- `admin`
- `finance`
- `developer`
- `viewer`

The current application capability mapping and current `pay_has_merchant_access` RLS helper are separate layers. Existing database read policies generally authorize an active merchant member; the application helper applies per-role capabilities. Sensitive mutations use server-side service-role RPCs. No Subscription-specific capability is present in the current authorization contract.

### 7.2 Freeze requirements

Before adding any Subscription endpoint or data mutation, explicitly decide:

- which existing Merchant roles may create/update/sunset Plans;
- who may see Customer Consent and Subscription details;
- who may request a manual retry/reconciliation or cancellation;
- whether platform support operators have read-only cross-tenant access, and how that is represented consistently in API authorization and RLS;
- how Customer identity is bound to the wallet/ATA/Subscriber PDA and how Customer queries are scoped only to the authenticated Customer;
- which server principal may enqueue a billing job and which signer capability may approve the exact TransferSubscription message.

Never assume a platform `superadmin` bypass in application code also bypasses RLS membership checks. Never add a new role or capability name until the route and policy matrix is reviewed and the DB enforcement is designed.

## 8. Verification and accounting contract boundary

A future dedicated Subscription adapter must independently verify, at required finality:

1. Correct cluster genesis, Program ID, pinned Program version/source identity and instruction discriminator/layout.
2. Exact Plan PDA derivation, owner, status, terms, destination allowlist and authorized Puller set.
3. Exact SubscriptionDelegation PDA, subscriber/delegator, Plan/delegatee, copied `init_id`, immutable term snapshot, expiry/cancellation boundary, period start and cumulative amount.
4. Exact shared SubscriptionAuthority PDA, Customer, Mint, `init_id`, and the live ATA delegate state.
5. Correct source ATA, source token owner, token mint/program/decimals, delegate, amount and all associated token-account owners.
6. The actual caller/Puller and transaction fee payer as distinct principals.
7. Every actual token transfer in the transaction, including all instructions/CPI effects relevant to the Program; reject extra, duplicated or unexpected transfers and instructions.
8. The live cumulative per-period allowance after including pulls from Plan Owner and every other authorized Puller.
9. Transaction success, finalized commitment, slot/block time and durable signature/cycle/attempt correlation.
10. No duplicate accounting or reuse of a signature/Attempt/Cycle under a different Merchant, Customer, Plan, Subscription or period.

The verifier must not accept a Program event as proof without validating the transaction and account/balance effects. The existing `pay_apply_verified_observation` remains unchanged and continues to serve the one-off Pay contract.

The atomic accounting contract must not reuse Payment Intent IDs to satisfy current foreign keys. Before implementation, design a typed Subscription origin for at least:

- Merchant principal settlement;
- approved gateway-fee revenue;
- referral liability if and only if the existing approved policy explicitly applies;
- Merchant-funded network cost (attributed separately from token principal);
- refunds/reversals and corrections;
- verified transfer observation and signature/slot;
- Cycle and Attempt result;
- immutable audit actor/request/job correlation;
- outbox event emitted only after the same financial commit.

Amounts remain integer atomic units. If a multi-leg transfer/accounting commit cannot be made atomic and balanced, the charge is not reported as paid or entitled.

## 9. v1 restrictions carried into the domain contract

The following are exclusions, not runtime capabilities:

- No finite Plan enrollment. Use only the exact perpetual representation after all Plan lifecycle semantics are validated.
- No `UNKNOWN_INIT_ID`; separate Authority initialization and Subscribe.
- No Durable Nonce or unresolved pending smart-wallet/Squads/Swig proposal.
- No Resume operation.
- No Immediate CancelNow.
- No automatic Authority reinitialization/reapproval after manual delegate revocation.
- No statement that shared Authority revoke permanently invalidates all previously signed transactions.
- No Rent sponsorship, including Plan sponsorship.
- No SolMint-paid network fee or platform SOL gas subsidy.
- No empty Plan destination allowlist.
- No Token-2022/TransferHook until separately reviewed; retain existing original SPL Token asset policy.
- No split principal+gateway-fee pull until the remaining dedicated verifier/accounting, approved fee-model and Devnet gates pass; the pinned-source LiteSVM two-destination cumulative-allowance/atomic-rollback sub-gate is now PASS.
- No recurring charge while Puller discovery is incomplete or a separate authorized Puller may have consumed remaining allowance.
- No Customer entitlement until finalized independent verification and atomic accounting are complete.
- No Subscription UI before Backend/DB/API contracts and lifecycle evidence are implemented.

The High old-signed-create finding remains an upstream protocol residual. Off-chain rejection of the sentinel and recent-blockhash-only policy are defense-in-depth; they do not revoke a previously signed external instruction.

## 10. Decisions that remain open — Contract Freeze blockers

These decisions cannot be inferred from the existing code or Program. They must be recorded explicitly before API/schema implementation:

1. **Subscription fee model:** whether gateway fee applies; amount/rate, payer, destination and accounting; whether one transfer or multiple destination instructions are intended. Existing one-off defaults do not decide this.
2. **Merchant fee-payer custody:** how a Merchant-owned or Merchant-funded signer signs each automated recurring transaction while the Collector remains a separately authorized Puller. No signer/key custody design is implemented.
3. **Entitlement policy:** activation point, service term, grace/delinquency, failed collection, retries, pause, termination, proration and refund rules. Upstream on-chain state does not define these.
4. **Cycle catch-up:** how skipped periods are handled. The Program advances the current period; it does not automatically create arrears for each missed period.
5. **Plan shutdown/retention:** perpetual Plans cannot be deleted by the v0.5.0 DeletePlan path. Sunset blocks new Subscribe but does not immediately stop existing pulls. The product's Plan retirement and data-retention policy must be explicit.
6. **Merchant RBAC:** role-to-Plan/Subscription capabilities, including the application superadmin versus database membership boundary.
7. **Customer identity and wallet support:** exact supported wallet types, wallet-to-application identity link, ATA ownership proof, and unsupported multisig/smart-wallet behaviours.
8. **Operational freshness/finality:** the exact finalized read policy, cluster/RPC availability gate, Program drift monitoring/kill switch, discovery coverage for external Pullers and stale observation recovery.
9. **Accounting origin and settlement:** typed ledger relationships, atomic write set, referral applicability, network-fee accounting, reversal and outbox semantics.
10. **Upstream residual risk acceptance:** explicit owner/security acceptance of the six detailed Cantina Acknowledged items and whether reliable revocation requires an upstream protocol change before launch.
11. **Migration governance:** the Production migration runner provenance remains unresolved (Issue #355). This blocks Production DDL; it does not authorize bypassing the controlled migration workflow.

## 11. Contract Freeze exit criteria

G2 cannot be marked PASS until every item below has an approved, source-linked decision:

- Versioned domain contract and explicit separation of Plan, Consent, Authority, Subscription, Cycle, Attempt, Pull observation, Accounting, Entitlement and Outbox.
- Transition matrix with source of truth, authorized actor, guard, atomic side effect, unknown outcome and recovery for every supported operation.
- Exact signed-consent snapshot and supported wallet/transaction format.
- Exact API contracts and Merchant/Customer/platform authorization matrix, derived from existing Auth/RBAC and enforced by server + DB.
- DB schema design with typed financial origin, unique Cycle identity, durable Attempt, atomic claim/fencing, retention, indexes, FK, RLS, grants and function ownership/search_path.
- Collector/fee-payer/Rent-payer/Puller custody and capability boundary, including safe stop/recovery.
- Independent finalized Subscription verifier and atomic accounting contract, with explicit split-fee and no-split decisions.
- Entitlement, retry, grace, catch-up and termination policies.
- Threat-model residual decisions and applicable adversarial tests.
- Disposable DB contract-security tests and exact pinned Program/LiteSVM test plan.
- Production DDL only after Issue #355 evidence is resolved and the explicit controlled Apply approval is obtained.

Until then: G2 remains PARTIAL / BLOCKED; no migration, API runtime, Collector signer, recurring charge or UI may be described as ready.

## 12. Next implementation sequence after G2 approval

1. Review/approve this domain draft and close the open product/security decisions.
2. Produce an exact typed API/DB/RLS/Grant contract and threat-to-test mapping.
3. Build the dedicated verifier/accounting design and its disposable-DB/LiteSVM adversarial fixtures before enabling any pull.
4. Implement server-side Plan/Consent/Authority operations only after exact contract/schema freeze, with separate customer-signed Init and Subscribe operations.
5. Implement billing Cycle claim, durable Attempt, Merchant-funded fee-payer operation and all-Puller reconciliation; fail closed on missing discovery or unknown outcome.
6. Implement isolated Collector signing under least privilege only after custody/recovery review and explicit authorization.
7. Run Unit -> Component -> Integration -> Disposable DB/RLS -> LiteSVM adversarial -> Devnet E2E -> CI -> production-build -> deployment-smoke -> release-audit.
8. Implement UI last, from the tested domain/API state machines.

**This document is a design draft. It does not authorize production DDL, secret/key changes, a real signer, customer Consent, Devnet mutation or Mainnet mutation.**
