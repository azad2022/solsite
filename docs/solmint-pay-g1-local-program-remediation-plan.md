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
- Subscription branch before reconciliation: `298f3a79a357cb28438d70cb953b1ecfcafb4b83`.
- A manual two-parent merge commit reconciled current `main` into the existing feature branch: `4d7fc8a297ff49a5162de8f4fe807a85346b1785` (first parent = feature; second parent = main).
- The reconciled branch is now 315 commits ahead / 0 behind main; merge base is exactly `514d3401d8d725be106ab0c83557f8e43cdff13e`.
- Three divergent paths were manually reconciled in the merge tree: `.github/workflows/ci.yml` retains every Subscription job and adds the generic pinned Production CLI check; `docs/solmint-pay-production-migration-policy.md` retains the strict guard and records G0 PASS based on owner confirmation; `docs/solmint-pay-progress.md` retains the entire Subscription history and incorporates the G0 main-branch evidence/closure.
- Four other main-side paths were byte-identical before merge: Production migration workflow, migration guard, guard tests and workflow test.
- The first automatic merge attempt returned HTTP 409 and changed nothing. A two-parent commit was then created with the reviewed three-file resolution and the feature ref was advanced using a non-force fast-forward update.
- PR #366 remains OPEN / DRAFT / NOT MERGED; GitHub now reports `mergeable=true`. Exact checks for the merge commit and subsequent checkpoint commit must still complete before G1-0 is marked PASS.
- Local Working Tree is UNKNOWN through the remote connector.

Rules:
- No force reset, force push, blind rebase, or deletion of historical feature commits.
- The reviewed three-file reconciliation is now represented by the two-parent merge commit above; no force-push, reset, rebase or history deletion was used.
- Re-run exact-head CI after the merge; do not reuse green checks from earlier SHAs.
- Exact-head checks on the reconciled branch passed. G1-1 now uses a dedicated SolMint-owned fork rather than copying the Program source into the React application repository.

## 8. Current status and mutation boundary

- G0 Production migration governance: **PASS / COMPLETE** on 2026-11-06 by owner confirmation plus three usable post-change log windows; Issue #355 is closed. Historical runner actor remains UNKNOWN.
- G1 overall: **BLOCKED** — no SolMint-owned Program VNext source, IDL, legacy migration, full adversarial implementation, independent audit or deployment exists yet.
- G1-0: **PASS / COMPLETE** — branch reconciliation, PR mergeability and exact-head CI/companion checks all passed on `f908440...`.
- G1-1: **IN PROGRESS** — SolMint-owned fork, pinned source branch, MIT provenance and reproducible v0.5.0 baseline evidence established; no VNext source patch yet.
- G1-2 through G1-8: **NOT STARTED**.
- G2 Subscription contract/runtime: remains partial / blocked; production Subscription API/schema/Collector/verifier/accounting/billing worker are not implemented.
- Local Working Tree: **UNKNOWN** through the available remote GitHub connector.
- No Production DDL/data/provider setting/Secret/Key/signer, customer consent, Program deployment/upgrade, Mainnet/Devnet transaction, accounting posting or funds were changed in this checkpoint.


## 2026-11-06 — G1-0 branch reconciliation and exact-head CI: PASS

### Repository state
- Current `main`: `514d3401d8d725be106ab0c83557f8e43cdff13e` (unchanged by this checkpoint).
- Current Subscription branch SHA: `f908440cf75b28299b1322e39f1148176e3c7c8c`.
- Subscription branch compares to current `main`: **317 commits ahead / 0 behind**, merge base is current main.
- PR [#366](https://github.com/azad2022/solsite/pull/366) is OPEN / DRAFT / NOT MERGED; GitHub API reports `mergeable=true`, `mergeable_state=clean`.
- The reviewed merge commit `4d7fc8a297ff49a5162de8f4fe807a85346b1785` has two parents: feature branch first parent, current main second parent. No force push, reset, blind rebase, history deletion or direct main edit was used.
- The CI merge preserves Subscription-specific SDK, reproducible Program build, TM-06/TM-07 regression, Mainnet ProgramData jobs and adds the generic pinned Production migration CLI check. The Production migration workflow, Guard and Guard tests are identical to the current main G0 versions.

### Exact-head GitHub evidence

All workflows below are bound to exact Subscription HEAD `f908440...`:
- CI [42233967558](https://github.com/azad2022/solsite/actions/runs/42233967558): **SUCCESS**, all seven jobs succeeded:
  - `quality`: typecheck, production build, unit tests, fail-closed migration guard tests and source-tree-cleanliness assertion.
  - `subscription-sdk-compat (24)`: pinned SDK TypeScript compatibility tests, PDA/web3.js transaction compatibility tests, Workerd and non-submitting Devnet CreatePlan simulation.
  - `subscription-reproducible-build`: exact pinned upstream v0.5.0 source/toolchain, checksum-verified `solana-verify`, deterministic source build and ELF/IDL hashes.
  - `subscription-tm06-sponsored-plan-refund`: pinned upstream test-only regression passed.
  - `subscription-atomic-split-transfer`: pinned upstream test-only split-transfer atomicity regression and integration suite passed.
  - `subscription-mainnet-programdata`: read-only identity/ProgramData check of the existing upstream Mainnet Program passed.
  - `production-migration-cli` and `subscription-production-migration-cli`: Supabase CLI 2.122.1 installation/version verification passed.
- Production Build [42233967582](https://github.com/azad2022/solsite/actions/runs/42233967582): **SUCCESS**.
- Ordinary Pay Devnet E2E [42233967417](https://github.com/azad2022/solsite/actions/runs/42233967417): **SUCCESS**. This is not a real Subscription charge E2E.
- Database Security [42233967519](https://github.com/azad2022/solsite/actions/runs/42233967519): **SUCCESS**.
- Mainnet Read-only [42233967433](https://github.com/azad2022/solsite/actions/runs/42233967433): **SUCCESS**.
- Cloudflare Pages PR check [127947226759](https://github.com/azad2022/solsite/runs/127947226759): **SUCCESS** (preview check, not a Production deployment).
- Supabase Preview was **SKIPPED** under the project's preview-free policy; no preview database was created or mutated.

### Strict interpretation limits
- CI verifies the reconciled source branch and existing toolchains/tests. It does **not** implement a VNext Program or prove stale v0.5.0 signatures are invalidated.
- TM-06 and TM-07 are regression overlays applied only to an ephemeral checkout of the exact pinned upstream v0.5.0 source. They do not change the upstream repository, deployed ELF or source behavior.
- The Mainnet ProgramData job proves read-only identity of the existing upstream Program, not deployment of a SolMint-owned VNext Program.
- The SDK Devnet CreatePlan check is simulation-only and does not submit a transaction; ordinary Pay Devnet E2E is not Subscription billing.
- No Production DB/configuration, secret/key, signer, customer consent, accounting entry, Mainnet/Devnet write, Program deploy/upgrade, Squads proposal or funds changed.

### G1 disposition
- G1-0 baseline/branch recovery: **PASS / COMPLETE**.
- G1-1 local MIT source intake and reproducible baseline: **NOT STARTED**.
- G1-2 protocol/ABI freeze: **NOT STARTED**.
- G1-3 VNext Program implementation: **NOT STARTED**.
- G1-4 legacy migration: **NOT STARTED**.
- G1-5 adversarial proof for VNext and legacy migration: **NOT STARTED**.
- G1-6 independent audit: **NOT STARTED**.
- G1-7 Devnet release/migration rehearsal: **NOT STARTED**.
- G1-8 separately authorized Mainnet deployment/migration: **NOT STARTED**.
- G1 overall remains **BLOCKED**. There is no SolMint-owned VNext Program source/IDL, legacy migration, full G1 adversarial proof, independent audit or deployed verification yet.


## 9. G1-1 — Independent source ownership and baseline intake (2026-11-06)

### SolMint-controlled repository
- Created public fork `azad2022/solmint-subscriptions-program` from `solana-foundation/subscriptions`.
- Fork default `main` tracks upstream latest `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`; no upstream repository or branch was changed.
- Created pristine baseline branch `solmint/v0.5.0-baseline` at immutable tag `program-v0.5.0` → `364a41976c33347d092902443bbec2def9227e75`.
- Created work branch `feat/solmint-g1-authority-vnext` at the same exact tag.
- Original MIT `LICENSE` and copyright notice are retained. Workspace package version is `0.5.0-beta.1`; toolchain pins are Rust `1.92` and Solana CLI `3.1.10`.
- Baseline documentation commit `d9e18eb3d7a494209aba04efd7c0562f2c942aa4` adds `docs/solmint-security-remediation-baseline.md`. Fork PR [#1](https://github.com/azad2022/solmint-subscriptions-program/pull/1) is OPEN / DRAFT and targets the pristine `solmint/v0.5.0-baseline` branch.
- The source baseline remains unmodified; the new fork branch currently contains documentation only.

### Reproducible source-build proof
The existing SolMint CI reproducibly built the exact source SHA `364a419...` in run [42233967558](https://github.com/azad2022/solsite/actions/runs/42233967558), job `subscription-reproducible-build` = **SUCCESS**. The sanitized artifact `solmint-subscription-reproducible-build` records:
- `solana-verify` 0.5.2; Solana CLI build version 3.1.10.
- Repository rust-toolchain 1.92; SBF build-container Rust 1.86.0.
- Docker digest `sha256:f71be5ca7620b7e40933b7f1294fa44e01d08c1fc5ba1f375a2478f5a01580d3`.
- Baseline ELF SHA-256 `056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318`.
- Baseline IDL SHA-256 `1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa`.

These hashes identify the unmodified v0.5.0 baseline only. They are not VNext hashes and do not prove any VNext deployment.

### Cantina residual finding inventory
The attached Cantina report (2026-07-30) records 9 findings: 4 Fixed, 5 Acknowledged. G1 must explicitly close the acknowledged residuals; the report is not treated as a clean security certificate:
- High: stale signed create bundle can restore revoked Authority / `u64::MAX` delegate; acknowledged, not fixed.
- Medium: stale Authority Init/Close/Revoke approvals are not generation-bound; acknowledged, not fixed.
- Medium: CancelSubscriptionNow's timestamp binding is not a unique incarnation; same-second replay requires adversarial proof.
- Medium: Resume uses expected expiry timestamp but no persistent monotonic cancellation revision; collision/replay requires proof.
- Medium: Subscribe can accept a finite Plan without a complete first billing period remaining; full-period-at-expiry issue remains to be fixed.
- Low: automatic rent sponsorship remains a feature, but must become explicit and bounded with enforceable recovery/quota.
- UpdatePlan stale approvals, optional CreatePlan payer/IDL, and IDL generation failure were previously verified fixed; retain regression tests and do not regress them.

### Isolation design status
- VNext will use a new Program ID and a dedicated customer-owned non-ATA source token account, with Authority bound to that exact account, as the leading isolation design.
- This is a **HYPOTHESIS**, not a proven security boundary. G1-5 must run the exact old v0.5.0 binary/source in LiteSVM and prove every stale legacy Init/Subscribe/Fixed/Recurring/Transfer path fails to accept or mutate/debit the VNext non-ATA account.
- The old Program remains active and old signed transactions remain valid for legacy ATAs. New Program ID alone does not disable them. Existing legacy funds, Plans and Subscriptions require explicit customer/merchant migration and fresh consent.
- Reusing the old Program ID requires its existing Squads upgrade authority approval; no governance bypass is permitted.

### Status
- G1-0: **PASS / COMPLETE**.
- G1-1: **IN PROGRESS** — own source repository, exact MIT baseline and reproducible build evidence established; VNext source patch and fork CI are still pending.
- G1-2 through G1-8: **NOT STARTED**.
- G1 overall: **BLOCKED** until VNext code, ABI/IDL, explicit migration, adversarial proof, independent audit and deployment evidence are complete.


## 10. Mainnet upgrade-authority evidence and fork-CI limitation (2026-11-06)

### Existing Mainnet Program — read-only observation
The successful `subscription-mainnet-programdata` CI artifact (run `42233967558`, observed at `2026-11-06T14:28:55.800Z`, finalized mainnet-beta) records:
- Existing Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- ProgramData: `HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg`.
- Upgrade authority: Squads vault `DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv`.
- Squads V4 state: `4CxQs26DewQ1KaCHfyyjktkYjndNdUqCJvVdygtJFwcJ`; threshold **3 of 5**, five members, finalized read-only state.
- On-chain ELF SHA-256 matches the pinned source build: `056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318`.
- On-chain IDL SHA-256 matches pinned source IDL: `1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa`.

This proves SolMint cannot unilaterally upgrade the existing Program ID. No Squads proposal or vote was created. The independent VNext Program ID path avoids waiting for upstream/old Program governance, but its own keypair custody, authority model and deployment still require explicit review/authorization.

### Fork Actions observation
- Fork repository Actions permission read: `enabled=true`, `allowed_actions=all`.
- Despite workflow files existing in the fork's default `main` and pinned work branch, the connected GitHub Actions workflow-list endpoint returned zero workflows; workflow enable/dispatch calls returned 404 and no fork PR check runs were observed.
- This is recorded as **FORK CI UNKNOWN / CONNECTOR OR GITHUB WORKFLOW DISCOVERY BLOCKED**, not as proof that GitHub Actions are disabled.
- The exact pinned baseline build is independently proven by SolMint's active CI run [42233967558](https://github.com/azad2022/solsite/actions/runs/42233967558). For VNext, the SolMint CI in `solsite` must be extended to checkout the SolMint fork branch and build/test its exact commit until fork-native Actions is demonstrably available.
