# SolMint Pay — G1 Local Program Fork and Protocol Remediation Plan

**Checkpoint date:** 2026-11-06  
**Repository:** `azad2022/solsite`  
**Working branch:** `feat/pay-subscription-billing`  
**Tracking issue:** [#370](https://github.com/azad2022/solsite/issues/370)  
**Status:** DESIGN / EXECUTION PLAN — NOT IMPLEMENTED  
**Product decision:** KEEP ALL PLANNED SUBSCRIPTION CAPABILITIES  
**G1 status:** BLOCKED until protocol implementation, legacy migration, adversarial proof, independent review and deployed verification pass.

This plan makes SolMint's own repository the executable source of the proposed corrected Program. Upstream maintainer acceptance is not a prerequisite to local development. It remains a separate disclosure/review channel; no public upstream security issue will be created.

## 1. Decisions and constraints

1. **Do not wait for upstream to implement the fix.** Vendor the exact reviewed upstream source into this repository under its MIT License, preserve copyright and license notices, and maintain our own versioned Program, IDL, SDK/client and build.
2. **Do not claim ownership of the existing Mainnet Program ID.** The current ProgramData record points to a Squads v4 3-of-5 authority with zero-second timelock. Member identity/custody and our direct authority to upgrade that Program are not established. A same-ID upgrade is possible only after the actual authorized governance path is independently proven and separately authorized.
3. **Default independent deployment path: a SolMint-owned Program ID.** This creates a new PDA namespace. Existing Plan, Authority, Subscription and consent accounts do not automatically become VNext accounts; never reinterpret or relabel them as migrated.
4. **Legacy funds must be isolated from delayed v0.5.0 instructions.** A Token Account has a single delegate slot. Reusing a legacy source account can let a still-executable old Program instruction alter that account's delegate state. A new Program ID alone does not make that token account safe. VNext must bind a dedicated customer-owned source Token Account whose address and authority cannot be reached by accepted v0.5.0 account paths, or use a dedicated new wallet. Exact legacy account checks and the VNext token-account model must prove this before migration is designed.
5. **Fresh consent is required for a new Program namespace.** Merchant Plans and customer Subscription consent must be recreated/approved under the new Program. Existing consent is never silently transferred to a different Program ID or a new set of Terms.
6. **Preserve the whole product scope.** Finite and perpetual Plans, immediate cancellation, Resume, shared Authority and reauthorization, durable-nonce workflows, supported smart-wallet/multisig proposals, explicit rent sponsorship, Plan edits/Sunset/Puller changes, all Pullers, split and multi-destination transfers remain required. They stay release-blocked individually until their protocol state, migration, tests and audit pass; none is permanently removed to obtain a superficial PASS.
7. **Keep ordinary Pay verification/accounting unchanged.** Subscription needs its own typed verifier/accounting origin and idempotency contract. No relaxation or bypass of `pay_apply_verified_observation`.
8. **No Production mutation is implied by this plan.** No DDL, secret/key change, signer deployment, Squads proposal, Mainnet transaction, Program upgrade, customer consent or fund movement is authorized here.

## 2. Verified source baseline

- Upstream repository: `solana-foundation/subscriptions`.
- Latest upstream `main` read on 2026-11-06: `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`. Current `initialize_subscription_authority.rs`, `revoke_subscription_authority.rs` and `subscribe.rs` still exhibit the old Authority lifecycle behavior. No relevant open upstream PR was found in the current read.
- Exact local-fork source baseline: `364a41976c33347d092902443bbec2def9227e75`, Program tag `program-v0.5.0`. It is not the same pin as the TypeScript SDK tag; source, IDL, SDK, lockfiles and toolchains must remain separately pinned.
- The source is MIT-licensed. The vendored copy must retain the original LICENSE and copyright notice; the fork must record its upstream commit and all local patches.
- The current repository contains a compatibility/RPC/ProgramData attestation/transaction-verifier harness and test-only upstream overlays, but no SolMint-owned Rust Subscription Program source or VNext IDL. Harnesses and patch overlays are not a protocol fix.
- The existing Cantina report (2026-07-30) records one High, five Medium, two Low and one Informational findings, with five Acknowledged entries in its reconciled summary. All finding-specific residuals remain release gates; a new fork is not audited by that report.
- Private report `GHSA-hvvh-pvqw-g3gx` is documented in the project as submitted / triage. Its current advisory state is not independently read back in this checkpoint. Local implementation proceeds independently.

Detailed finding mechanics and existing source references remain in:
- `docs/solmint-pay-subscription-v1-threat-model.md`
- `docs/solmint-pay-subscription-tm01-protocol-fix-proposal.md`
- `docs/solmint-pay-subscription-upstream-v06-capability-preserving-remediation.md`

## 3. Protocol architecture to design and prove

Names below are conceptual. Do not treat them as frozen account names, fields, seeds, discriminators or SDK methods before the Program source/IDL design is reviewed.

### 3.1 Persistent Authority generation

A Program-owned, non-resettable generation record must exist for each logical subscriber + mint Authority lineage. It must survive closing/recreating the current Authority PDA and any associated permission account.

The design must cover:
- checked monotonic authority generation;
- action-specific nonce / sequence and explicit consent-enabled state;
- exact subscriber, mint and VNext source Token Account binding;
- expected current generation and expected delegate state on every Authority-mutating/permission-creating operation;
- a bounded, Program-validated approval deadline that supplements rather than replaces generation/nonce checks;
- serialized write access so concurrent Init / Revoke / Reauthorize orderings cannot bypass invalidation;
- no normal close/reinitialize path that can reset the generation or tombstone.

### 3.2 Persistent Subscription lifecycle revision

A separate revision/incarnation is required for each logical Plan + subscriber Subscription lineage. It must survive closing and recreating the current closable Subscription PDA. Every Cancel, Resume, Close, recreate, and other lifecycle-changing action must bind and consume the expected revision. A revision stored only inside the closable Subscription account is insufficient.

### 3.3 Plan revision and consent binding

Mutable Plan fields and permission-creating actions must bind an exact Plan revision / terms snapshot. A Plan edit away and back to the old values must not revive an old signed approval. Subscribe must bind the intended finite end time and the Program-enforced initial/final period rule; UI/backend preflight is not a protocol guard.

### 3.4 Legacy instruction closure

All legacy unbound permission-creation and Authority-control paths must be rejected or proven to enforce the same persistent state. Adding V2 instructions while old unbound discriminators remain callable is not a security fix. The legacy Transfer path must also consult the new generation/revision state if the same Program ID is upgraded.

If VNext is deployed under a new Program ID, the old Program remains a separate live protocol. Its accounts and instructions must be isolated from VNext funds and the migration must never assume that deploying VNext invalidates old signed v0.5.0 transactions.

### 3.5 Capabilities that must survive

The architecture and compatibility matrix must explicitly preserve:
- one-time consent, explicit reauthorization and shared Authority semantics;
- normal and immediate cancellation, Resume, close/revoke and recovery;
- finite and perpetual Plans, Plan revisions, edits, Sunset and Puller changes;
- recent-blockhash, durable-nonce and supported smart-wallet/multisig proposals with safe invalidation and cancellation semantics;
- explicit rent sponsorship with recorded payer, refund beneficiary, exposure and recovery;
- Plan Owner plus all additional Pullers;
- split principal + gateway fee and multiple destination pulls with same-transaction cumulative allowance and rollback;
- original SPL token path currently allowed by SolMint, with Token-2022/extension support subject to its own compatibility and security proof.

## 4. Legacy migration: two mutually exclusive deployment paths

### Path A — authorized upgrade of the existing Program ID

This path preserves the existing Program/PDA namespace but requires proof that the actual upgrade authority can authorize the change. The current recorded authority is a Squads v4 3-of-5 vault; SolMint must not assume it controls the members or can execute an upgrade.

Required proof:
- exact authority ownership and permission to submit/execute a proposal;
- reviewed program account migration plan and account-size/rent impact;
- captured real v0.5.0 Plan, Authority, SubscriptionDelegation and Token Account fixtures;
- lazy or explicit Registry bootstrap from validated legacy state without changing old terms;
- old signatures/legacy instructions rejected after invalidation;
- active subscriptions remain usable until the customer invalidates their old generation;
- rollback and recovery without resetting generation or double-billing.

No proposal or upgrade is part of G1 planning.

### Path B — VNext under a new SolMint-controlled Program ID (default independent route)

A new Program ID creates new PDAs and cannot directly inherit v0.5.0 accounts or customer consent.

Minimum migration contract:
1. Stop/claim-protect old billing attempts and disable old Collector jobs for the migration cohort.
2. Snapshot every affected legacy Plan, customer, shared Authority, SubscriptionDelegation, period state, amount already pulled, cancellation/expiry, authorized Puller, Token Account and rent/refund provenance using finalized read-only evidence.
3. Determine the exact risk and behavior of any old signed transactions and smart-wallet proposals.
4. Create a customer-owned VNext source Token Account that is isolated from every legacy account path. Prove with the exact v0.5.0 Program that the old instructions cannot use or rebind it. If such isolation cannot be proven, migration stays BLOCKED; do not refill a legacy source account.
5. Move customer funds only through a separately approved customer-signed migration transaction. No server custody or automatic sweep.
6. Merchant recreates the Plan under VNext and signs its actual new terms. Customer signs fresh Authority consent and Subscription creation under VNext.
7. Persist an idempotent migration mapping between legacy and VNext logical subscriptions. Never equate old signatures, events, PDAs or consent with VNext proof.
8. Reconcile old cancellation/revoke, new collectability, first billing boundary, duplicate-cycle prevention, service entitlement and customer notices. There must be no overlap that can charge twice and no gap hidden by entitlement state.
9. Retain read-only legacy evidence and a recovery route; never delete or rewrite old records merely to make VNext appear clean.

A separate wallet is a fallback if a dedicated token-account design cannot be made safe. It changes the subscriber key and needs explicit identity, access and custody design; it is not an invisible migration.

## 5. Mandatory adversarial suite

Every test must run on the exact source commit and must assert both the expected error and the absence of unintended state/CPI/token-balance side effects.

- Old signed Init + Subscribe held through invalidation, then submitted after generation advance.
- Same-slot and later-slot Authority close/recreate; generation never repeats.
- Invalidate when no Authority PDA exists; tombstone/Registry created and stale Init fails.
- Both transaction orderings: Init before invalidation and invalidation before stale Init.
- Reauthorize after revoke; old signatures cannot reapprove `u64::MAX`.
- Stale Close/Revoke cannot close or revoke the later generation.
- Legacy instruction discriminators and legacy permission-creation routes after VNext migration/upgrade.
- Durable Nonce and delayed smart-wallet proposals before/after deadline, invalidation and cancellation.
- Same-period Cancel → Resume → Cancel; stale Resume fails across close/recreate.
- Same-second CancelNow + close/recreate; stale approval fails.
- UpdatePlan away-and-back ABA and stale Subscribe after revision change.
- Finite Plan exact boundaries, first/final partial period, checked integer rounding/overflow.
- Explicit rent payer, refund beneficiary, sponsorship exposure, rent reclaim and terminal/non-terminal lifecycle.
- Plan Owner and every additional Puller; external pulls; multiple destinations; same-period cumulative cap; atomic rollback on a failing second leg.
- Malformed Registry/Plan/Subscription PDA, wrong owner/discriminator/bump, wrong mint/token program/account owner, wrong source account, wrong delegate, replayed nonce, expired deadline and integer overflow.
- Concurrent conflicting operations, RPC unknown outcomes, retry, duplicate signature, crash/recovery and idempotent migration/entitlement.
- Legacy migration fixtures must use real captured v0.5.0 account bytes and test both before and after invalidation.
- Verify the old Program cannot modify VNext source Token Accounts under the new Program ID path.

No synthetic policy-only test or UI rejection substitutes for on-chain LiteSVM/integration proof.

## 6. Work phases and exit gates

| Checkpoint | Deliverable | Exit condition |
|---|---|---|
| G1-0 Baseline / branch recovery | Exact main-vs-feature reconciliation; current evidence inventory; final Program-ID route decision | Subscription branch mergeable, changes preserved, Progress Ledger updated |
| G1-1 Local source intake | MIT source vendor, pins, lockfiles, toolchain, reproducible baseline build | Exact source provenance and reproducible V0 baseline |
| G1-2 Protocol / ABI freeze | State machine, persistent Registry/revisions, instruction/account layouts, migration contract | Architecture review and golden ABI/IDL specification |
| G1-3 VNext Program | Rust Program implementation with legacy closure and retained capabilities | Unit/LiteSVM/integration tests and reproducible SBF build pass |
| G1-4 Legacy migration | Read-only inventory, migration tool, isolated source-account strategy, customer/merchant consent cutover | Disposable-fixture and Devnet rehearsals; no stale legacy path reaches VNext funds |
| G1-5 Adversarial proof | Complete named regression/fuzz suite | Exact-source suite green; every finding mapped to test evidence |
| G1-6 Independent audit | Third-party review and remediation | Written audit plus follow-up closure; no unresolved blocking finding |
| G1-7 Devnet release | VNext deploy, migration E2E, rollback/recovery, ProgramData/IDL attestation | Dedicated Devnet E2E, release checks and smoke pass |
| G1-8 Mainnet release | Explicitly authorized deployment and migration | Independent finalized ProgramData/ELF/IDL verification and approved customer migration |

## 7. G1-0 first task: recover and reconcile the working branch

Current state on 2026-11-06:
- Main: `514d3401d8d725be106ab0c83557f8e43cdff13e`.
- Subscription branch: `7340ec8eb27897c814a9feb55215d5e7c2d5e8c3`.
- Merge base: `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- Feature branch: 310 commits ahead and 7 commits behind main.
- Seven overlapping paths require reconciliation: CI workflow, Production migration workflow, migration policy, Progress Ledger, migration guard, guard tests and workflow tests.
- PR #366 is OPEN / DRAFT / NOT MERGED and GitHub reports `mergeable=false` / `mergeable_state=dirty`.
- Local Working Tree is UNKNOWN through the remote connector.

Rules:
- No force reset, force push, blind rebase, or deletion of historical feature commits.
- First inspect the exact diff and resolve the seven overlapping files while retaining both the current G0 guard and Subscription-specific CI.
- Re-run exact-head CI after the merge; do not reuse green checks from earlier SHAs.
- Only after the branch is reconciled may G1-1 source vendoring or Program code changes begin.

## 8. Current status and mutation boundary

- G0 Production migration governance: **PASS / COMPLETE** on 2026-11-06 by owner confirmation plus three usable post-change log windows; Issue #355 is closed. Historical runner actor remains UNKNOWN.
- G1 overall: **BLOCKED** — no SolMint-owned Program VNext source, IDL, legacy migration, full adversarial implementation, independent audit or deployment exists yet.
- G1-0: **IN PROGRESS** — branch reconciliation is the first execution task.
- G1-1 through G1-8: **NOT STARTED**.
- G2 Subscription contract/runtime: remains partial / blocked; production Subscription API/schema/Collector/verifier/accounting/billing worker are not implemented.
- Local Working Tree: **UNKNOWN** through the available remote GitHub connector.
- No Production DDL/data/provider setting/Secret/Key/signer, customer consent, Program deployment/upgrade, Mainnet/Devnet transaction, accounting posting or funds were changed in this checkpoint.
