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

## 5. Implemented structural-decoder checkpoint

The isolated compatibility harness now contains `src/transfer-subscription-instruction.ts`, a strict structural decoder for the pinned `TransferSubscription` instruction. It:

- requires the pinned Program ID and discriminator 10;
- requires exactly 73 instruction-data bytes and decodes the amount as `bigint` from little-endian u64;
- decodes the delegator and Mint public keys and requires the Mint argument to match the fixed Mint account;
- requires exactly the ten fixed account addresses in the pinned IDL order, rejects any trailing/remaining account, requires the original SPL Token Program and validates the self-Program account;
- returns named account positions without treating them as verified signer privileges, account ownership, CPI effects, transaction finality or payment evidence.

The decoder is intentionally a parser only. It does not inspect the compiled transaction message/header, signer/writable privileges, address lookup tables, transaction metadata, inner instructions, actual token deltas, Plan/Subscription state, Puller authorization, duplicate signatures or billing Attempt correlation. It cannot return a paid/verified result. It also derives and validates the event-authority PDA from the pinned Program's `event_authority` seed, matching the Program's `verify_event_authority` check. Regression coverage is in `test/transfer-subscription-instruction.test.mjs`, wired into the isolated harness `npm test` script. CI must compile and execute these tests before this checkpoint can be called PASS.

## 6. Verifier result semantics

The pure verifier may produce only:

- **Verified transaction observation:** every required verification stage passed for the exact signature/Cycle/Attempt and evidence is complete.
- **Rejected observation:** positive evidence proves the transaction is invalid for this expected Cycle/Attempt.
- **Unknown observation:** evidence is missing, stale, ambiguous, pruned, inconsistent or not sufficiently final. It must not be converted to failure/retry or paid.

The verifier must never return `paid`, `accounted`, `entitled`, or a customer-facing success state. Those are downstream database/product decisions.

The existing `validateSubscriptionAccountState` remains a separate component with its current `account-state-consistency-only` evidence label. It must not be renamed or upgraded to transaction verification.

## 7. Atomic accounting boundary

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

## 8. Adversarial verification test matrix

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

## 9. Required implementation order

1. Pin the exact `transfer_with_delegate` helper and SPL CPI behavior from the same upstream commit; record the source blob and add instruction/CPI golden fixtures. (Source pin is complete; golden transaction fixtures remain outstanding.)
2. Define a normalized, server-only finalized transaction evidence type from the actual Solana RPC response schema; preserve raw message/meta provenance.
3. Implement a pure, no-I/O transaction verifier in the isolated compatibility harness. It must not sign, submit, call RPC or write to a database.
4. Extend adversarial tests from the structural instruction decoder to compiled-message privileges, CPI/token effects, exact amount, Puller, fee payer, period rollover, duplicates and unknown evidence.
5. Implement an RPC adapter that fetches finalized transaction and same-bank account evidence from the dedicated configured endpoint; test provider errors, pruning and missing historical state.
6. Freeze the typed financial origin and atomic accounting contract only after the fee, referral, network-cost, refund and entitlement decisions are explicitly approved.
7. Build disposable-DB security tests for RLS, grants, SECURITY DEFINER ownership/search_path, unique constraints, fencing, balanced postings, rollback and outbox atomicity.
8. Only after those gates pass may server routes, billing worker and Collector signing be implemented. UI remains last.

## 10. Current status and authorization boundary

- Existing account-state consistency helper and its isolated tests: present in the repository; its exact-head CI must be rechecked before use.
- Strict TransferSubscription instruction structural decoder: implemented in the isolated compatibility harness; exact-head CI still required for PASS.
- Dedicated transaction verifier: **NOT IMPLEMENTED**.
- Finalized transaction RPC adapter: **NOT IMPLEMENTED**.
- Atomic Subscription accounting DB contract/runtime: **NOT IMPLEMENTED**.
- Subscription fee/entitlement product decisions: **BLOCKED / OPEN**.
- TM-01 upstream protocol remediation and owner disposition: **BLOCKED**.
- Production DDL and Subscription activation: **BLOCKED**.

This design does not authorize Production DDL, Supabase mutation, Secret/Key changes, signer creation, Devnet mutation, Mainnet mutation, Program upgrade, customer Consent, financial posting or customer entitlement.


## 2026-11-06 — First pure transaction-verifier implementation checkpoint

A first isolated policy implementation was added at `tools/subscription-sdk-compat/src/subscription-transaction-verifier.ts`. It is intentionally not an RPC adapter, transaction submitter, signer, persistence layer or accounting function.

The implementation currently checks:

- finalized commitment, configured cluster genesis, non-null execution result, signature shape, and Merchant-approved fee payer identity/fee-payer signer+writable flags;
- exact-slot Program deployment attestation fields (Program ID, pinned source commit, ELF SHA-256 and attested slot); absent or mismatched attestation returns UNKNOWN;
- exactly one top-level Subscription instruction, with Compute Budget instructions as the only additional top-level instruction class currently tolerated;
- fixed TransferSubscription instruction decoding and its ten fixed accounts, resolved account indexes, required writable positions and caller signer privilege;
- Plan Owner or configured Puller identity, expected Plan/Subscription/Authority/source ATA/Mint/amount binding;
- exactly one original-SPL TransferChecked CPI and one Subscription event self-CPI, including resolved inner-instruction index binding;
- SubscriptionTransfer event tag/discriminator/layout and correlation of Subscription, Plan, subscriber, Mint, amount, period, destination, receiver ATA and Puller;
- exact source debit and destination credit using raw integer token-balance strings.

The result union is restricted to `verified_observation`, `rejected` or `unknown`; it does not expose paid, accounted or entitled states. The existing one-off Pay verifier is untouched.

### Evidence boundary — do not overstate this checkpoint

- The accompanying `test/subscription-transaction-verifier.test.mjs` uses generated keypairs and synthetic normalized evidence to exercise the pure policy. It is **not** a real serialized transaction golden fixture and does not prove the normalizer against a real Solana RPC response.
- The required historical Program deployment attestation producer is **NOT IMPLEMENTED**. The current ProgramData probe is a current read-only deployment probe; it does not prove which ELF executed at an arbitrary historical transaction slot. The verifier therefore returns UNKNOWN when the exact-slot attestation is absent.
- A production-grade RPC normalizer is **NOT IMPLEMENTED**. It must preserve v0 static + loaded address ordering, message signer/writable privileges, inner instruction indexes, pre/post token balance account indexes, commitment and raw response provenance.
- Historical Plan/Subscription state at the transaction bank slot, all-Puller discovery, duplicate signature/Cycle/Attempt fencing and transaction-message hash binding are not yet verified by this module.
- The single-pull v0.5.0 verifier path is not the final capability-preserving v0.6 contract. Multiple pulls/destinations, split transfer legs, TransferHook/Token-2022 policy and v0.6 revision/generation fields require a versioned verifier extension after the upstream protocol contract is pinned.
- A successful pure policy result is only a candidate immutable observation. It is not an accounting commit or payment success.

Status after this checkpoint: **pure verifier policy PARTIAL**; **real golden fixtures NOT IMPLEMENTED**; **RPC normalizer NOT IMPLEMENTED**; **historical Program-slot attestation NOT IMPLEMENTED**; **atomic Subscription accounting NOT IMPLEMENTED**. No release gate is closed by this checkpoint.


## 2026-11-06 — Verifier correlation and fail-closed classification hardening

The pure policy now requires the exact expected signature, SHA-256 of the serialized transaction message, Cycle ID and Attempt ID supplied by the trusted server-side Attempt record. It returns those correlation values with the immutable observation candidate. It also requires the fee payer to be the first resolved message account key and to be a signer+writable, and it validates every top-level and inner compiled instruction index against the fully resolved account-key list.

Outcome classification is deliberately conservative:

- A non-finalized transaction, missing block time, missing execution metadata, absent exact-slot Program attestation, or absent CPI group is **UNKNOWN**.
- A proven execution error, cluster mismatch, wrong fee payer, different signature/message hash, wrong Program/ELF identity, unauthorized Puller, unexpected instruction/CPI, event mismatch or token delta mismatch is **REJECTED**.
- A successful `verified_observation` remains a synthetic-policy-level result until a real RPC normalizer, historical Program attestation source, same-slot Plan/Subscription state proof, all-Puller reconciliation and genuine serialized transaction fixtures exist.

The current tests now include message-hash mismatch and Program ELF mismatch regressions. They remain generated/synthetic policy vectors and must not be labelled golden chain fixtures.


## 2026-11-06 — Historical RPC evidence and account-state decoder boundary

The isolated compatibility harness now contains:

- A read-only finalized transaction RPC adapter with exact message-hash and Ed25519 signature verification for legacy, v0 and v1 transaction wire formats. Unsupported future versions remain UNKNOWN.
- A ProgramData attestation reader that binds the finalized Program/ProgramData account metadata, deployment slot and ELF SHA-256 to the reproducible pinned build.
- A historical account archive adapter. It reads account bytes at slot S-1, scans the finalized full block at slot S to prove no earlier transaction could write the required accounts, and reads the Clock sysvar at exact slot S. The Clock owner/executable metadata and its serialized slot are checked.
- A pinned-SDK decoder for Plan, SubscriptionDelegation, SubscriptionAuthority, Mint and original SPL Token account bytes. It rejects Token-2022 and extension-bearing layouts rather than interpreting them as classic SPL.
- A pure account-state consistency result that is explicitly separate from transaction verification, accounting, payment and entitlement. The decoder now binds archive signature, slot and cluster genesis to the normalized transaction evidence and preserves archive response hashes in its result.

Evidence limits and gates:

- The RPC and account-archive tests use generated signed transactions and synthetic JSON-RPC fixtures. They are policy/adapter tests, not a real historical Mainnet/Devnet Subscription charge fixture.
- Alchemy documents historical `getAccountInfo(slot=...)` reads as paid-plan-only. This provider is an opt-in test-harness dependency; no production endpoint, API key or paid plan is configured or authorized.
- Archive data is provider-sourced evidence, not a cryptographic proof emitted by Solana consensus. The adapter hashes raw responses and binds the finalized block/slot, but the service must preserve the provider trust boundary in its audit record.
- The historical account decoder is not wired to a production API, worker, database transaction or accounting ledger.
- The exact-head CI for the decoder/correlation changes is pending; no PASS is claimed for those changes until that run completes.
- The one-off Pay verifier and existing Pay accounting path remain unchanged.
