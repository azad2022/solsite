# SolMint Pay — Dedicated Subscription Verification & Accounting Contract

**Status:** DESIGN DRAFT — NOT FROZEN, NOT RUNTIME IMPLEMENTED  
**Repository:** `azad2022/solsite`  
**Branch:** `feat/pay-subscription-billing`  
**Design HEAD:** `16122cbd700b5e2b0d3313194837e7ce01a11501`  
**Pinned upstream Program:** `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`  
**Pinned IDL blob:** `208718e90bf9f8e7f42271b6e93284109b118172`  
**Scope:** transaction-level verification boundary and atomic accounting boundary for one Subscription pull; no schema, API, route, migration, fee model, signer or entitlement implementation is authorized here.

This contract extends `docs/solmint-pay-subscription-contract-design.md` and the isolated `tools/subscription-sdk-compat` harness. It deliberately does not name database tables, RPCs, API routes, public states, or new runtime enums. Those require the separate Contract Freeze process.

---

## 1. Non-negotiable separation

There are three different evidence layers:

1. **Account-state consistency:** the existing `validateSubscriptionAccountState` checks one finalized cross-account snapshot and reports identity/period/collectability consistency. Its explicit evidence label is `account-state-consistency-only`. It is not a transaction verifier.
2. **Transaction verification:** a new pure verifier must validate one exact finalized transaction and its actual token effects against the pinned Program, the expected billing Cycle/Attempt and a fresh account-state snapshot. It must not trust the event, signature, caller-supplied parsed JSON or a successful RPC response in isolation.
3. **Atomic accounting:** only a database-side atomic operation may persist the verified observation, unique Cycle/Attempt result, balanced financial postings and outbox event. A successful verifier result alone is not a paid/accounted result.

The existing one-off Pay verifier and `pay_apply_verified_observation` remain unchanged. Subscription source authority is the shared SubscriptionAuthority PDA; the instruction caller/Puller and transaction fee payer are distinct principals. The one-off source-authority/fee-payer equality is not a Subscription invariant.

## 2. Pinned Program facts used by this contract

The facts below were checked against the exact pinned Program source and IDL above, not upstream `main`.

### 2.1 TransferSubscription instruction

- Instruction name: `transferSubscription`.
- Instruction discriminator: one byte, decimal `10` (`0x0a`).
- Serialized `transferData` fields, in IDL order:
  - `amount: u64` (little-endian atomic units);
  - `delegator: public key`;
  - `mint: public key`.
- Fixed account order from the pinned IDL and `TransferSubscriptionAccounts::try_from`:
  1. SubscriptionDelegation PDA — writable;
  2. Plan PDA — read-only;
  3. SubscriptionAuthority PDA — read-only;
  4. subscriber/delegator ATA — writable;
  5. receiver ATA — writable;
  6. caller/Puller — signer, read-only;
  7. Mint — read-only;
  8. Token Program — read-only;
  9. event-authority PDA — read-only;
  10. this Program ID — read-only.
- The Rust account parser accepts a trailing `remaining` account slice. The exact pinned helper `program/src/instructions/helpers/transfer_utils.rs` (blob `241937f6ad46877c3d29f01f62109f5c33bf781e`) confirms that a mint with an active Transfer Hook forwards this slice to the hook CPI; without a hook it is ignored. SolMint v1 excludes Token-2022 and TransferHook, so the supported original SPL Token path requires **zero** trailing accounts. Reject every non-empty trailing account list.
- For original SPL Token with no hook, the pinned helper invokes `TransferChecked` signed by the SubscriptionAuthority PDA, with source ATA, Mint, receiver ATA, authority PDA, exact `u64` amount and Mint decimals. The transaction verifier must match the inner SPL Token instruction and its account metas to this exact CPI path.
- The transaction message fee payer is not an instruction account in this list. It must be derived from the actual transaction message/signature structure and checked separately against the approved Merchant-funded fee-payer policy.

### 2.2 On-chain checks and effects

The pinned `program/src/instructions/transfer_subscription.rs` shows that the Program:

- checks Plan mint, Plan expiry, caller authorization and receiver token-account owner against the Plan destination list;
- checks Subscription Plan terms, delegatee Plan PDA and delegator identity;
- blocks transfer at `current_ts >= expires_at_ts` when cancellation is scheduled;
- validates and updates the Subscription's period start and cumulative amount for this transfer;
- invokes the delegated token transfer using the SubscriptionAuthority PDA and the Subscription's stored `init_id`;
- emits a `SubscriptionTransferEvent` with Subscription, Plan, delegator, mint, amount, period start/end, cumulative period amount, receiver owner, receiver token account and Puller.

The event is corroborating data only. The verifier must prove the successful Program instruction and token movement independently. The account snapshot validator remains a preflight/consistency component and cannot establish what a transaction actually transferred.

### 2.3 Period and multi-pull semantics

The Program maintains a cumulative amount for the current period on the SubscriptionDelegation. The current account-state validator computes an effective period from the observed chain time, but that snapshot capacity is not a reservation. A Plan Owner and each additional authorized Puller can independently pull. A billing worker must reconcile all such pulls before it decides an amount is collectable; it must not assume the Collector is the only actor.

A transaction containing multiple Subscription transfer instructions or multiple token-transfer effects is not accepted by the initial single-pull verifier contract. The pinned upstream two-destination atomic rollback test is a Program-level sub-gate; it does not approve a SolMint split-fee model or a multi-leg accounting implementation.

## 3. Verifier input boundary

The future verifier accepts only server-constructed, typed inputs:

- immutable expected Cycle/Attempt correlation from the backend;
- expected Merchant/Plan owner, Plan ID/PDA, Subscription PDA, subscriber, SubscriptionAuthority PDA, subscriber ATA, Mint and approved destination owner/ATA;
- pinned Program ID, expected cluster genesis hash, and the approved Program deployment/source identity;
- the complete finalized transaction response including transaction message, signatures, meta, execution error, inner instructions, logs, token balance metadata and slot;
- a same-bank finalized account snapshot for Plan, SubscriptionDelegation, SubscriptionAuthority, Mint and source/destination token accounts;
- the expected single TransferSubscription amount in atomic units and approved Puller/fee-payer identities.

Browser input may identify a requested object but cannot supply authoritative account state, transaction metadata, token balances, Puller membership, fee payer, Program version or cluster identity. RPC results must be obtained by the trusted server adapter from the configured cluster endpoint; no public RPC fallback is allowed.

All amounts remain `bigint`/canonical integer strings. Floating-point conversion is prohibited.

## 4. Required verification stages

A verifier result is valid only if every stage succeeds. It must return structured failure codes and evidence references, not a boolean derived from one field.

### V1 — Provenance and finality

- Cluster genesis hash exactly matches the server-configured cluster.
- Transaction is fetched from the configured RPC for that cluster and is finalized under the project's approved finality policy.
- The transaction has a canonical signature and slot; the finalized block time is associated with that observed slot.
- `meta.err` is null; missing, pruned, malformed or incomplete transaction metadata fails closed.
- Program deployment identity is still the approved pinned identity for this cluster; a Program upgrade/drift kill switch blocks verification until re-audited.
- The RPC adapter records provider and request provenance without recording credentials.

### V2 — Transaction identity and replay binding

- The exact transaction signature, serialized message hash, slot, Cycle identity and Attempt identity are bound together.
- The signature cannot be consumed by another Merchant, Customer, Plan, Subscription, Cycle or Attempt.
- The same Cycle cannot be finalized/accounted twice, even if multiple workers, providers or discovery sources report the transaction.
- A retry after an unknown result reconciles this exact signature/message first. Unknown is not Failed and never authorizes a second debit.
- A transaction without a durable pre-submit Attempt correlation is not automatically credited to a SolMint billing Attempt. It may still be an external Pull requiring reconciliation and accounting treatment under a separately approved policy.

### V3 — Exact top-level instruction and CPI effects

- Resolve static and address-table-loaded account keys using the actual message version and metadata.
- Find exactly one supported top-level instruction to the pinned Subscription Program for the expected Subscription PDA.
- Decode the instruction using the pinned IDL/layout: discriminator `10`, `amount`, `delegator`, `mint`; reject malformed/trailing bytes.
- Validate the ten fixed account positions listed in §2.1, including exact signer/writable roles and derived PDAs.
- Caller/Puller must sign and be either the Plan Owner or an explicitly configured Plan Puller in the same finalized Plan snapshot.
- The source token account must be the subscriber's expected ATA; destination token account owner must be in the non-empty Plan allowlist and match the expected Merchant settlement owner.
- Validate every inner instruction/CPI and token-balance effect associated with the transaction. Reject additional token transfers, unexpected programs/instructions, extra Subscription pulls, unapproved account metas, or ambiguous CPI mapping.
- The pinned helper/CPI shape is now source-verified as described in §2.3; the implementation must still prove it from finalized transaction metadata and golden fixtures before returning success.

### V4 — Token movement

- Verify source and destination token accounts are owned by the original SPL Token Program and are the expected accounts for the expected Mint.
- Verify Mint address, initialized state and decimals against the backend asset snapshot.
- Verify the source token owner is the subscriber; the delegate is the exact SubscriptionAuthority PDA; the receiver token-account owner is the allowlisted destination.
- Verify actual source debit and destination credit in atomic units against the exact instruction amount, with no unexplained balance delta. Use token balance metadata and parsed token instructions together; neither is sufficient alone if the transaction metadata is incomplete.
- Reject Token-2022, transfer-fee extensions, transfer hooks, frozen/uninitialized accounts, unsupported token account layouts and any unsupported token behavior in v1.
- Verify the SubscriptionAuthority PDA, subscriber, Mint and actual stored `init_id`; verify SubscriptionDelegation's copied `init_id` matches it and is not `UNKNOWN_INIT_ID`.

### V5 — Period and cumulative allowance

- Validate the pre-transaction and post-transaction SubscriptionDelegation account states at the transaction's bank slot where the RPC provides reliable historical account data; otherwise use independently verified transaction state changes plus a finalized current-state reconciliation and mark any missing historical evidence UNKNOWN.
- Confirm Plan terms and Subscription's immutable term snapshot match exactly.
- Confirm the on-chain period start and cumulative amount advanced exactly according to the pinned Program logic for the transaction's block time.
- Confirm the transfer amount is within the remaining per-period allowance after including all earlier successful Pulls by the Plan Owner and every authorized Puller.
- Reject if another Pull may have consumed the same remaining allowance and discovery coverage is incomplete.
- An event's `amountPulledInPeriod` is a cross-check, not the sole source of truth.

### V6 — Fee payer and principal separation

- Derive the transaction fee payer from the transaction message, not from the Program event or browser request.
- Verify it is the exact Merchant-owned or explicitly Merchant-funded fee payer approved for this billing Attempt.
- Verify the Puller signer is separately authorized by the Plan.
- Verify the token source authority is the SubscriptionAuthority PDA.
- Reject any transaction where SolMint treasury/platform infrastructure is paying the recurring network fee or where the principal roles are conflated.
- Do not infer gateway fee, referral, gas markup or a split transfer from the ordinary Pay fee configuration. Those require an explicit approved Subscription fee decision.

## 5. Verifier result semantics

The pure verifier may produce only:

- **Verified transaction observation:** every required verification stage passed for the exact signature/Cycle/Attempt and evidence is complete.
- **Rejected observation:** positive evidence proves the transaction is invalid for this expected Cycle/Attempt.
- **Unknown observation:** evidence is missing, stale, ambiguous, pruned, inconsistent or not sufficiently final. It must not be converted to failure/retry or paid.

The verifier must never return `paid`, `accounted`, `entitled`, or a customer-facing success state. Those are downstream database/product decisions.

The existing `validateSubscriptionAccountState` remains a separate component with its current `account-state-consistency-only` evidence label. It must not be renamed or upgraded to transaction verification.

## 6. Atomic accounting boundary

No accounting write is part of the pure verifier. A future database-side commit must receive a verified, immutable observation and enforce all of the following in one transaction:

1. Re-check trusted caller identity, merchant/customer ownership and exact Cycle/Attempt correlation.
2. Lock/claim the unique Cycle and Attempt with a fencing/version token; reject stale workers.
3. Enforce global uniqueness for the transaction signature and message hash within the appropriate financial origin.
4. Persist the verified transaction/transfer observation with Program ID, cluster, slot, signature, instruction index, account identities, amount atomic, Mint/program/decimals, Puller and fee payer.
5. Post balanced integer-only ledger effects for Merchant principal and only those additional fee/referral/network-cost legs explicitly approved by the frozen fee model.
6. Preserve append-only original postings; refunds/reversals are separately verified and separately posted.
7. Persist Cycle/Attempt terminal result and an immutable audit correlation.
8. Insert the outbox event in the same database transaction, but deliver it only after commit.

If any validation, uniqueness, balance, posting, or outbox insert fails, the entire database transaction rolls back. No partial ledger update or entitlement change is allowed.

### Accounting facts that remain unresolved

- The current live Pay ledgers are Payment-Intent-centric; fake Payment Intent IDs are prohibited.
- A typed Subscription financial origin and exact FK/ledger extension have not been designed/frozen.
- Subscription fee rate/destination/payer, referral applicability, network-cost attribution, refund treatment and settlement semantics are not approved.
- Entitlement start/grace/delinquency/catch-up/termination rules are not approved.
- Production migration-runner provenance Issue #355 remains a DDL blocker.

Therefore the accounting database function/table/RPC and its schema are NOT IMPLEMENTED. No fee or ledger semantics are invented in this document.

## 7. Adversarial verification test matrix

A future pure verifier test suite must include, at minimum:

| Attack / fault | Expected result |
|---|---|
| Wrong cluster genesis or unapproved Program deployment | Reject / Unknown if provenance unavailable |
| Confirmed or processed transaction only | Unknown |
| Non-null transaction execution error | Reject |
| Missing transaction/meta/inner instructions/token balances | Unknown |
| Wrong Program ID or discriminator | Reject |
| Malformed or non-canonical instruction data | Reject |
| Wrong fixed account order, PDA, subscriber, Mint or ATA | Reject |
| Unauthorized Puller or Plan not active for the expected operation | Reject |
| Extra top-level instruction, extra Subscription pull or unexpected CPI/token transfer | Reject |
| Event present but no matching actual token movement | Reject |
| Correct event but wrong destination owner/ATA | Reject |
| Source debit/destination credit differs from instruction amount | Reject |
| Token-2022, frozen ATA, wrong decimals or changed delegate | Reject |
| Authority/Subscription initId mismatch or UNKNOWN_INIT_ID | Reject |
| Subscription terms differ from live Plan | Reject |
| Period rollover/cumulative amount differs from Program execution | Reject |
| Plan Owner or another Puller already consumed allowance | Reject / Unknown if discovery incomplete |
| Wrong fee payer, SolMint-paid network fee, or Puller/fee payer conflation | Reject |
| Duplicate signature or Cycle/Attempt correlation | Reject duplicate accounting |
| Same signature replayed against another tenant/Plan/Cycle | Reject |
| RPC timeout after submission | Unknown; reconcile same Attempt |
| Two workers finalize same Cycle concurrently | Exactly one atomic accounting commit |
| Accounting/posting/outbox failure | Full DB transaction rollback |
| Duplicate webhook delivery | No duplicate financial effect |

Golden fixtures must be generated from the exact pinned Program/IDL and real serialized transaction metadata. Hand-authored mock events alone are insufficient.

## 8. Required implementation order

1. Pin the exact `transfer_with_delegate` helper and SPL CPI behavior from the same upstream commit; record the source blob and add instruction/CPI golden fixtures.
2. Define a normalized, server-only finalized transaction evidence type from the actual Solana RPC response schema; preserve raw message/meta provenance.
3. Implement a pure, no-I/O transaction verifier in the isolated compatibility harness. It must not sign, submit, call RPC or write to a database.
4. Add adversarial tests for instruction/account ordering, CPI/token effects, exact amount, Puller, fee payer, period rollover, duplicates and unknown evidence.
5. Implement an RPC adapter that fetches finalized transaction and same-bank account evidence from the dedicated configured endpoint; test provider errors, pruning and missing historical state.
6. Freeze the typed financial origin and atomic accounting contract only after the fee, referral, network-cost, refund and entitlement decisions are explicitly approved.
7. Build disposable-DB security tests for RLS, grants, SECURITY DEFINER ownership/search_path, unique constraints, fencing, balanced postings, rollback and outbox atomicity.
8. Only after those gates pass may server routes, billing worker and Collector signing be implemented. UI remains last.

## 9. Current status and authorization boundary

- Existing account-state consistency helper and its isolated tests: present in the repository; its exact-head CI must be rechecked before use.
- Dedicated transaction verifier: **NOT IMPLEMENTED**.
- Finalized transaction RPC adapter: **NOT IMPLEMENTED**.
- Atomic Subscription accounting DB contract/runtime: **NOT IMPLEMENTED**.
- Subscription fee/entitlement product decisions: **BLOCKED / OPEN**.
- TM-01 upstream protocol remediation and owner disposition: **BLOCKED**.
- Production DDL and Subscription activation: **BLOCKED**.

This design does not authorize Production DDL, Supabase mutation, Secret/Key changes, signer creation, Devnet mutation, Mainnet mutation, Program upgrade, customer Consent, financial posting or customer entitlement.
