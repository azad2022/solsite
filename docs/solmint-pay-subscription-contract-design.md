# SolMint Pay — Subscription Domain and Lifecycle Contract Design

**Date:** 2026-11-03  
**Repository:** `azad2022/solsite`  
**Branch:** `feat/pay-subscription-billing`  
**Design source HEAD:** `${oldHead}`  
**Pinned upstream Program:** `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75` (`program-v0.5.0`)  
**Document status:** DESIGN DRAFT — NOT FROZEN, NOT AN IMPLEMENTATION  
**Current gate status (revalidated 2026-11-19):** G0 PASS / COMPLETE under the owner-confirmed 2026-11-06 provider setting and three post-change main-push log windows; Issue #355 is closed. Direct provider-setting read-back and historical initiating human actor remain UNKNOWN audit limitations. G1 approval NOT RECORDED and upstream TM-01 remediation remains BLOCKED. G2 PARTIAL / BLOCKED.

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


### 8.1 Database Cycle/Attempt claim, idempotency and recovery contract — G2 draft (2026-11-19)

**Status:** architecture/security invariants only; not a frozen SQL/API contract and not an implementation. No table, column, enum, RPC name, lease duration, index name or grant is authorized by this section.

#### Current read-only inventory

Rechecked on 2026-11-19 against Supabase project nvopkbiedorfshwbmyhn (PostgreSQL 17.6.1.147, ACTIVE_HEALTHY):

- 106 migration records; latest 20261029140401 (solmint_pay_payment_link_rpc_service_role_revoke).
- 33 public pay_* base tables.
- No Subscription, Billing Cycle or Billing Attempt base table was found in public or private; no corresponding routines were found in those schemas.
- pay_idempotency_keys is Merchant command idempotency keyed by merchant_id, scope, idempotency_key, with request hash and stored response. It is not a chain-period identity or worker lease.
- pay_payout_transaction_requests is one row per payout batch with claim token/expiry and prepared transaction/blockhash. Its claim RPC is scoped to the Payout Builder capability and Merchant owner/admin/finance roles.
- pay_webhook_deliveries uses SKIP LOCKED and an expiring worker lease. It is an at-least-once delivery queue, downstream of accounting, and cannot establish financial truth.
- Existing Pay ledgers remain Payment-Intent-centric. pay_apply_verified_observation remains unchanged and is not a Subscription accounting boundary.

These mechanisms solve different bounded-context problems. Do not rename, repurpose or generalize them into a Subscription Billing Cycle queue.

#### Four separate identities

1. **Command idempotency:** one authenticated Merchant/API command with a canonical request hash. Same key with a different hash is conflict. It does not identify an on-chain billing period.
2. **Cycle identity:** exact SubscriptionDelegation PDA plus the actual period start read from finalized chain state. Scheduler date, calendar month, retry count and API idempotency key cannot replace it.
3. **Attempt identity:** one exact prepared/signed/submitted transaction associated with one Cycle. A retry is a new Attempt only after proof the previous Attempt cannot have charged.
4. **Pull observation identity:** one independently verified on-chain TransferSubscription instruction/transaction. Cluster identity and signature are unique in the Subscription observation domain and cannot be rebound across Merchant, Customer, Plan, Subscription, Cycle or Attempt.

A Cycle is NOT synonymous with one chain transfer. The Plan Owner is an implicit Puller and other authorized Pullers can act outside SolMint. One on-chain period may therefore have multiple legitimate Pull observations under the same cumulative allowance. Database uniqueness must prevent duplicate SolMint work/accounting without suppressing independent Pull observations.

#### Cycle identity and claim invariants

- Canonical Cycle identity is the exact Subscription PDA plus the actual on-chain current_period_start_ts. The server derives and validates both; a browser, scheduler or Worker cannot choose the period start.
- A database uniqueness constraint must prevent two Cycle records for the same identity under concurrent schedulers/Workers.
- Claim serializes SolMint Workers only. It is not a reservation of Solana token allowance and cannot prevent Plan Owner/external Pullers from submitting directly.
- A successful claim must return an unguessable fencing token/generation tied to the Cycle and a bounded lease. Concrete storage type, generation rule and lease duration remain unfrozen.
- Every later write (Attempt create/update, signed transaction persistence, reconciliation result and accounting finalization) must validate the current fencing token and lease in the same short DB transaction. Expired/replaced tokens cannot write, finalize or release a new claimant lease.
- Reclaim must create a new token. A stale token must never become current again (ABA prohibited).
- Unknown claim outcome is not a claim. Re-read/reconcile; do not create or submit a new Attempt.
- DB lease/fence protects DB state only. It cannot revoke a signed Solana transaction or stop an external Puller. Once a signer or RPC side effect may have begun, reconcile the exact original Attempt before any new charge.

#### Attempt durability and external side-effect boundary

1. In one short DB transaction, acquire/revalidate Cycle claim, prove Attempt history is complete, and create/recover one eligible Attempt with immutable Cycle/Customer/Merchant/Plan/Subscription correlation.
2. Persist exact transaction intent and immutable message/account plan (Program/IDL pin, accounts/instructions, signer roles, Merchant-funded fee payer, blockhash and validity boundary) before any signer/RPC side effect.
3. Signing service returns the signed transaction/signature WITHOUT broadcasting. Persist exact signature, message hash and signed transaction evidence under the current fencing token before broadcast.
4. Only then may a trusted submission adapter broadcast that exact signed transaction. Timeout, crash or missing RPC response means UNKNOWN; reconcile the same signature/message/blockhash and finalized chain/account state. Never rebuild with a fresh blockhash or new signature while the prior Attempt may have landed.
5. Persist observation outcome in a short DB transaction, checking current fencing token and exact Cycle/Attempt binding. Do not hold row locks/transactions across RPC, simulation, HSM/KMS signing or network submission.
6. On successful verification, pass the immutable observation to the dedicated atomic accounting boundary. If its response is lost, reconcile the same accounting identity; never post again or create a new chain charge.

Attempt history is a security input. Recovery must receive explicit proof that the DB returned a complete Attempt history for the locked Cycle. Failed/partial query or missing row in incomplete results is not "no prior Attempt". Reject an Attempt whose Cycle identity differs from the currently claimed Cycle.

#### Recovery matrix

| Evidence under current Cycle claim | Permitted action | Prohibited action |
|---|---|---|
| Complete Attempt history proves none exists | Create one durable Attempt, then prepare | Sign/submit before Attempt persistence |
| Existing pre-submit Attempt; no signer/submission side effect occurred | Resume that exact Attempt | Create a second Attempt |
| Submission may have occurred; outcome missing/not final/unknown | Reconcile exact signature/message | Retry with new message/blockhash/signature |
| Finalized transaction verified; accounting not committed | Retry same atomic accounting operation with same observation key | Create second charge/posting |
| Accounting response unknown | Reconcile same accounting identity | Treat timeout as rollback |
| Finalized execution error proves no state changes and approved retry policy allows | New Attempt/new correlation under a fresh valid claim | Reuse prior Attempt identity |
| Verifier/identity rejection, malformed evidence, incomplete Puller discovery or contradictory history | Stop/manual reconciliation | Treat as no-charge or auto-retry |
| Claim or Attempt history incomplete/unknown | Block and reconcile | Treat absent response as empty history |

Verifier rejection is not proof no transfer occurred. Retry requires positive finalized execution-failure evidence plus a separate approved retry decision.

#### Pull observation and allowance reconciliation

- Persist independently verified Pull observations separately from SolMint Worker Attempts. Plan Owner and other authorized Pullers may create valid transfers without a SolMint Attempt.
- Before a Collector pull, rediscover successful pulls for the Subscription and reconcile finalized SubscriptionDelegation cumulative amount/period. Incomplete discovery or a possible external Pull blocks submission.
- Cycle claim is not an on-chain allowance lock. Another Puller may act after the read. Program transfer validation remains the final allowance enforcement; backend fails closed on stale/ambiguous state and never claims DB lease reserves chain capacity.
- Multiple verified Pull observations in one Cycle need independent signature-idempotent accounting treatment. Exact fee/entitlement effects remain open; do not assume a second observation is duplicate merely because Cycle identity is unchanged.
- Signature and cluster genesis identity bind once and cannot be credited to another financial origin.

#### Atomic accounting and lost-response recovery

The future DB commit is one all-or-nothing transaction. Its immutable input is a server-generated verified observation, not browser payload, caller-supplied RPC JSON, event or boolean.

It must, in the same commit:
- validate trusted server/Worker principal and immutable Cycle/Attempt/observation correlation;
- revalidate current claim/fencing ownership and reject stale workers;
- enforce uniqueness of chain observation and financial origin;
- validate typed Subscription origin, Merchant, Customer, asset and integer atomic amounts;
- post balanced principal/fee/referral/network-cost/reversal entries only under separately approved fee/accounting rules;
- transition accounting evidence without changing ordinary Pay Payment Intent states;
- enqueue the durable outbox event after the same accounting writes are valid.

The commit is idempotent on the exact verified observation identity. Identical retries return the existing committed result; differing evidence under the same identity conflicts. A timeout is UNKNOWN until the same key is read back; it cannot authorize new ledger inserts or a new Solana transaction. Never synthesize Payment Intent IDs. Exact ledger/FK shape and gateway fee/split-transfer decisions remain open for G2.

#### Authorization, RLS, grants and function boundary

- No browser/client direct INSERT/UPDATE/DELETE on Cycle, Attempt, Pull observation, accounting or outbox data.
- Merchant/Customer reads must be tenant/customer scoped through Auth -> application identity -> internal JWT and an approved RBAC matrix. Application superadmin does not implicitly bypass DB membership RLS.
- Worker claim, Attempt write and accounting commit are server-mediated. Payout-specific solmint_pay_payout_builder is not a generic Collector/Subscription capability.
- Privileged SQL routines require fully qualified objects, empty/fixed search_path, explicit owner, narrow EXECUTE ACL and validation of tenant/Customer/Attempt relationships. They must not be exposed to anon/ordinary authenticated unless a reviewed route contract explicitly requires it.
- Service-role bypass of RLS still requires identity/ownership validation inside the Server/Database boundary. Do not grant direct authenticated DML to simplify PostgREST.
- Whether records belong in a non-Data-API schema or public with function-only access remains an open G2 decision.

#### Required disposable-Postgres and adversarial acceptance tests

1. Two Workers concurrently claim the same Subscription PDA + period-start key: exactly one current fencing token.
2. Worker A lease expires; Worker B reclaims with a new token; every late A write/release/Attempt persist/accounting finalize is rejected.
3. Same idempotency key/different canonical request hash conflicts; identical request replays without a second Cycle.
4. Incomplete Attempt-history query never permits a first Attempt.
5. Attempt from another Subscription/period/merchant/customer cannot be resumed.
6. Crash before signing resumes same pre-submit Attempt; crash after signing/before broadcast persists/reconciles exact signature/message.
7. Timeout after broadcast reconciles exact signature; no new blockhash/Attempt while outcome may have landed.
8. Duplicate signature/message hash binding across Cycle/Attempt/tenant identities is rejected within configured cluster.
9. Verified observation plus accounting timeout reconciles exactly once; different payload under same key conflicts.
10. Stale fencing token cannot write observations, ledger or outbox after a newer claimant takes over.
11. Cross-Merchant/Cross-Customer reads/writes fail through server RPC and DB policy; ordinary authenticated callers cannot invoke Worker/accounting mutations.
12. Plan Owner/external Pull consumes the same on-chain cumulative allowance; incomplete discovery blocks Collector; DB lease never reserves chain capacity.

These tests complement (not replace) exact Program/LiteSVM adversarial tests, dedicated Subscription transaction verification, real Subscription Devnet E2E and independent security review.

#### Current disposition

- PASS — read-only inventory: Supabase version/status, latest migration, 33 public Pay tables, no Subscription/Cycle/Attempt objects, and existing Idempotency/Payout/Webhook patterns were inspected on 2026-11-19.
- PASS — isolated policy tests: recovery requires complete Attempt history and exact Cycle identity matching, in addition to a current acquired claim/fencing token. No DB mutation occurs.
- NOT IMPLEMENTED — Subscription Cycle/Attempt tables, unique constraints, DB fencing/lease RPC, durable Attempt persistence, Pull observation storage, dedicated accounting commit and outbox.
- BLOCKED — schema/API/RLS/Grant/role freeze remains G2 work. G0 and Issue #355 are closed; Production DDL remains prohibited without separately authorized controlled Apply on exact main SHA.
- No Production DDL/data mutation, provider/configuration/Secret/key change, signing, Customer consent, ledger posting, Devnet transaction or Mainnet mutation occurred.


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
10. **Upstream residual risk decisions:** on 2026-11-05 the owner explicitly rejected accepting TM-01 (High old-signed-create) as a residual risk; upstream protocol remediation, independent review, deployment and finalized Mainnet verification are mandatory before launch. The other five detailed Cantina Acknowledged items and the remaining v1 exclusions still require separate dispositions; no blanket risk acceptance is recorded.
11. **Migration governance:** G0 migration-runner governance and Issue #355 were closed as PASS / COMPLETE on 2026-11-06 after owner confirmation and three post-change main-push log windows. Historical initiating human actor and direct provider-setting connector read-back remain UNKNOWN audit limitations. Production DDL still requires the controlled manual workflow, exact main SHA, DRY_RUN and explicit APPLY authorization; G0 closure does not authorize an Apply.

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
- G0 is now PASS / COMPLETE and Issue #355 is closed; any Production DDL still requires the controlled manual workflow and explicit controlled Apply approval on exact main SHA.

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


## 2026-11-05 — TM-01 owner decision

The owner has explicitly rejected the High old-signed-create residual risk. A protocol-level upstream fix is a hard release prerequisite; this decision does not accept the other Cantina residuals or complete G1. The candidate protocol remediation and migration compatibility requirements are documented in `docs/solmint-pay-subscription-tm01-protocol-fix-proposal.md`. No API/schema/instruction/Program change is implemented by that proposal.
