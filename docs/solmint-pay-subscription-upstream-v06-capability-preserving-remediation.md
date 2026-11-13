# SolMint Pay — Capability-Preserving Upstream Subscription Protocol Remediation

Date: 2026-11-06
Repository: `azad2022/solsite`
SolMint branch: `feat/pay-subscription-billing`
Affected upstream repository: `solana-foundation/subscriptions`
Reviewed upstream main snapshot: latest commit search result `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`
Deployed SolMint compatibility pin: Program `program-v0.5.0`, source `364a41976c33347d092902443bbec2def9227e75`

**Document status: REMEDIATION DESIGN / NOT IMPLEMENTED.**
**Product decision: NO CAPABILITY REDUCTION.**
**G1: BLOCKED until upstream implementation, independent security review, accepted release and deployed Program verification.**

## 1. Product-owner decision

The intended SolMint Subscription product must retain its full planned capability set. The following are product requirements, not features to delete as a way to make the security report green:

- Customer consent and shared Subscription Authority lifecycle, including safe initialization, revocation and reauthorization.
- Subscription Plan creation, updates, sunset, finite end dates and perpetual plans.
- Subscribe, end-of-period cancellation, immediate dual-authorized cancellation, Resume and re-subscription.
- Fixed and recurring periods, complete periods and a defined final partial-period policy.
- Durable-nonce transactions and supported program-controlled wallets / multisig proposals, provided protocol freshness checks make delayed execution safe.
- Explicit rent sponsorship for Authority, Subscription, delegation and Plan accounts, with transparent sponsor identity, exposure and recovery semantics.
- Plan Owner and additional Pullers, multi-pull accounting, split destination transfers and exact cumulative allowance enforcement.
- Legacy account continuity and a deliberate migration path.

A capability may remain **BLOCKED for launch** while its security property is unproven. It must not be permanently removed, hidden behind a reduced product specification, or treated as fixed by UI/backend restrictions. Off-chain controls remain defense-in-depth and are not substitutes for Program enforcement.

## 2. Root cause class

The main weakness across the acknowledged report and the additional protocol review is that several instruction approvals bind current values (or a slot/timestamp) rather than a durable, monotonic identity for the state incarnation and action being approved.

A value can be reused after close/recreate or can return to the same value (ABA). A still-executable signed instruction can then match a later state that the signer did not observe. A backend version, browser state, blockhash policy or database lock cannot invalidate a signed transaction submitted directly to Solana.

The remediation should therefore be one coherent versioned protocol, not six unrelated UI workarounds.

## 3. Target protocol generation

The design below is a candidate for upstream maintainers and an independent auditor. Account names, seeds, byte layouts, discriminators and exact integer widths are deliberately **not frozen** by this document.

### 3.1 Persistent Authority Generation Registry

A Program-owned, canonical PDA keyed by `(subscriber, mint)` should hold the durable authority lifecycle generation and action freshness state.

Required properties:

1. The registry survives Authority close/recreate and cannot be closed, reset, reinitialized or overwritten by ordinary lifecycle instructions.
2. Its generation is initialized by Program logic, never caller-selected; increments use checked arithmetic and fail closed on overflow.
3. A subscriber can advance/invalidate it even while no Authority PDA exists. This creates a tombstone that invalidates signed-but-unsubmitted initialization.
4. Every new Init, Subscribe, fixed/recurring permission creation, Authority Close/Revoke/Reauthorize and all transfer paths bind to the exact current generation.
5. Revocation advances the generation and revokes the matching SPL delegate / transitions Authority in one atomic Solana transaction.
6. The Program rejects an old signed operation when the registry generation has advanced, regardless of recent blockhash or durable nonce.
7. A generation/action deadline is checked on-chain at execution. A durable nonce or delayed multisig proposal may preserve the transaction bytes, but cannot extend the Program-approved action deadline.
8. Legacy unbound permission-creating and Authority-mutating instruction formats are disabled after migration. Adding V2 discriminators while leaving old paths callable is not a fix.

The Registry may be a separate permanent PDA or a reviewed non-closeable tombstone. A rent-exempt base balance may remain locked for the lifetime of the consent lineage. This is a protocol storage trade-off and must be disclosed, charged to the appropriate customer/sponsor under an explicit rule, and never silently subsidized by SolMint.

### 3.2 Per-Subscription Lifecycle Revision Registry

A second persistent lifecycle revision is required for each logical `(Plan, subscriber)` subscription identity. The current deterministic Subscription PDA is closable and reusable, so a revision stored only inside that PDA is insufficient.

Required properties:

- A monotonically increasing incarnation/revision survives Subscription close/recreate.
- Subscribe, ordinary cancellation, CancelNow, Resume and terminal close/recreate consume or advance the expected revision atomically.
- Each signed control operation supplies the exact expected incarnation and revision observed by the signer.
- Stale CancelNow and Resume approvals fail even if timestamps and all business fields return to the same values.
- Concurrent actions against one subscription are serialized by the writable registry and only one expected-revision transition can commit.
- Plan/Subscriber identity, registry PDA, owner, discriminator, bump and account version are validated on every path.

### 3.3 Plan revision

Plan state should include a monotonic revision, not only a snapshot of mutable values. Every accepted Plan update increments the revision with checked arithmetic. Subscribe and all owner-side update/termination actions bind to the exact revision and exact terms snapshot. Reverting values to an old configuration must not revive a stale signed update.

## 4. Finding-by-finding remediation while preserving capabilities

### TM-01 — delayed signed Init/Subscribe and Authority lifecycle (High)

**Keep:** one-time customer consent, authority initialization, reauthorization, explicit revoke, same-transaction onboarding where it can be made safe, durable nonce and supported smart-wallet workflows.

**Program changes:**
- Add persistent Authority generation state as described in §3.1.
- Init requires exact generation, action nonce and on-chain deadline; it must not implicitly re-approve an existing delegate as a harmless idempotent retry.
- Reauthorization is an explicit operation with fresh customer approval and an expected current delegate/generation. It cannot be triggered by retrying Init.
- Subscribe binds exact Authority generation, exact Plan revision/terms, a Subscription lifecycle nonce and a deadline.
- A first invalidation works even without an Authority account.
- Generation advancement, token delegate revoke and Authority state transition are atomic.
- All legacy unbound Init/Close/Revoke/Subscribe and other permission-creating paths must be rejected or proven to enforce the same Registry state.
- A raw SPL Token Revoke must remain clearly distinct: it does not advance Program-owned generation and cannot invalidate pending Program instructions by itself.

**Acceptance evidence:** sign and withhold Init/Subscribe at generation g; invalidate to g+1 while Authority is absent and while it exists; submit stale actions and prove they fail without re-approval, account recreation or delegation creation. Repeat with durable nonce and delayed multisig proposals. Test both transaction orderings and rollback.

### TM-02 — stale immediate cancellation after same-second recreation (Medium, partially mitigated)

**Keep:** CancelNow with both required customer and current Plan Owner approvals.

The current `expected_current_period_start_ts` is a partial mitigation for different period starts, not a unique lifecycle revision. Replace timestamp-only freshness with the persistent Subscription incarnation/revision from §3.2. CancelNow must compare both the exact expected revision and any required expected billing-period state, then advance the revision atomically with cancellation.

**Acceptance evidence:** sign CancelNow for incarnation/revision n and withhold it; execute a cancel/close/recreate or other lifecycle sequence that returns timestamps to the same values; submit the old approval and prove it fails. Test both same-second and later-second cases, merchant ownership changes, signature order, concurrency and rollback.

### TM-03 — stale Resume clears a later cancellation (Medium)

**Keep:** Resume as a supported customer-approved operation.

Resume must bind to the current persistent Subscription incarnation and cancellation revision, not merely `expected_expires_at_ts`. Every Cancel, CancelNow and Resume transition increments the same monotonic lifecycle revision. Resume may clear a cancellation only when the exact cancellation revision and current state match the approval. A second cancellation in the same billing period must have a distinct revision even if it computes the same expiry timestamp.

**Acceptance evidence:** sign Resume for cancellation revision n; cancel/resume/cancel again in the same period; submit old Resume and prove it fails. Repeat across close/recreate, durable nonce, smart-wallet proposal, transaction races and crash/reconciliation paths.

### TM-04 — stale Init/Close/Revoke approvals (Medium)

**Keep:** customer-controlled Authority close, shared Authority revoke, reauthorization and explicit recovery. Keep the documented shared `(subscriber, mint)` blast radius.

All Authority-mutating instructions must consume the persistent authority generation/action nonce. Close and Revoke must bind the exact generation and expected delegate state. A stale Close/Revoke signed for generation g must not affect a generation g+1 Authority at the same PDA. A stale Init must not re-approve `u64::MAX`. The Program must close every legacy unbound Authority lifecycle path after migration.

**Acceptance evidence:** stale Init/Close/Revoke against an already-open Authority and after close/recreate; same-slot and later-slot ABA; foreign delegate preservation; two subscriptions sharing one Authority; generation overflow; delegate replacement; all state/CPI changes atomic.

### TM-05 — finite Plan expiry and partial first/final periods (Medium)

**Keep:** both finite and perpetual Plans, with explicit customer-visible end dates and a deterministic final-period policy.

Plan and Subscribe instructions must bind exact Plan revision and `end_ts`. Subscribe must enforce the full-period rule at execution, not rely on a server preflight. The Program must define the end-boundary rule and enforce the final charge amount at the same on-chain decision point as the transfer.

Recommended Plan policy options:
- `FULL_PERIOD_ONLY`: reject a new subscription or final pull unless a complete fixed-hours period fits before Plan end.
- `PRORATE`: compute a final/first partial charge on-chain using integer atomic units and a documented deterministic rounding rule. Use checked wide-integer multiplication/division; no floating point. The precise floor/ceiling policy must be agreed with the product owner and independent auditor before layout freeze.

The selected policy is snapshotted into consent and cannot be changed for existing subscribers without a fresh, protocol-enforced consent transition. Do not truncate the event's period end while still allowing an unadjusted full-period debit.

**Acceptance evidence:** Subscribe at, before and after end boundary; shortened Plan between signing and execution; one second below/above full-period requirement; partial first/final periods; Plan update races; rounding extremes; zero/one atomic-unit results; event window, transfer amount and ledger amount all match exactly.

### TM-06 — SDK implicit rent sponsorship and stranded sponsor capital (Low)

**Keep:** explicit sponsorship for Authority, Plan, Subscription and fixed/recurring delegation account creation. Sponsorship must not be removed solely to simplify v1.

**SDK/client changes:**
- A distinct `client.payer` must not silently become an instruction-level rent sponsor. Every creation builder requires an explicit, named `rentPayer` choice; absent choice defaults to the account owner/customer/merchant, not a hidden sponsor.
- Preserve the ability to pass a sponsor signer deliberately while separating network fee payer from account-rent payer.
- Client documentation and generated types must state the actual rent recipient and all terminal-state recovery rules.

**Program/account changes:**
- Record rent payer/refund beneficiary for every rent-bearing account.
- New Plan account layout must retain the actual sponsor/refund beneficiary. New Plan deletion returns rent according to the signed creation-time refund rule, rather than routing a sponsored Plan's full rent to the Merchant by accident.
- Existing v0.5.0 Plan accounts have no reliable sponsor beneficiary field; migration must preserve current semantics (treat legacy owner as refund beneficiary) rather than infer a sponsor from transaction history.
- Authority and delegation sponsor recovery remains gated by safe terminal conditions. A sponsor must not force-close a healthy customer Authority or active Subscription merely to reclaim rent.
- Where a sponsored account is live and non-terminal, rent may remain locked by design. The UI/API must quote exposure and explain that no refund is guaranteed until the relevant terminal condition. This is a commercial term, not an undisclosed liability.
- SolMint's Collector/Relayer is never an implicit rent sponsor. Any SolMint-funded sponsorship requires a separate, explicitly approved exposure budget and recovery control.

**Acceptance evidence:** sponsor vs owner vs network fee payer separated in every builder; Plan create/delete refund recipient test; all Authority/Fixed/Recurring/Subscription recovery states; non-terminal/perpetual account exposure disclosed; repeated/concurrent sponsorship limits at the SolMint backend boundary; no hidden SDK payer default.

## 5. Full feature compatibility matrix

| Product capability | Desired status | Required security property |
|---|---|---|
| Authority initialization | KEEP | Exact generation/action nonce/deadline |
| Authority revoke/close | KEEP | Persistent generation advance and atomic token delegate handling |
| Authority reauthorization | KEEP | Fresh explicit approval; stale Init cannot reapprove |
| Subscribe / re-subscribe | KEEP | Plan revision + authority generation + subscription lifecycle nonce |
| Durable Nonce | KEEP | On-chain deadline and expected generation/revision; stale approvals fail |
| Squads/Swig/supported smart wallets | KEEP | All required signers bind V2 message to current revisions; delayed proposals become stale after invalidation/deadline |
| End-of-period cancellation | KEEP | Monotonic lifecycle revision and verified final state |
| Immediate CancelNow | KEEP | Both approvals plus exact lifecycle revision |
| Resume | KEEP | Exact cancellation revision and incarnation |
| Finite Plans | KEEP | Exact end/revision binding and on-chain first/final period policy |
| Perpetual Plans | KEEP | Existing perpetual semantics plus same generation/nonce controls |
| Rent sponsorship | KEEP | Explicit rent payer, recorded refund beneficiary, exact exposure/recovery disclosure |
| Plan updates / Sunset / Puller changes | KEEP | Monotonic Plan revision; no ABA approval |
| Plan Owner + additional Pullers | KEEP | All-puller reconciliation and cumulative allowance |
| Multiple destination / split transfer | KEEP | Same transaction atomicity, all destination owners allowlisted, cumulative ceiling and verifier rejects extra/duplicate legs |
| Token-2022 / TransferHook | Product policy | Separate extension and hook security review; current SolMint asset allowlist remains authoritative |

This matrix is a product requirement, not evidence that the capabilities are already implemented or safe on the deployed Program.

## 6. Legacy state and upgrade compatibility

A protocol patch must not silently destroy existing customer consent or break existing subscriptions during the upgrade.

Minimum migration design:
1. Read and validate legacy account owner, discriminator, version, PDA/bump, user/plan/mint and stored `init_id` before initializing a generation Registry.
2. For an active v0.5.0 Authority, create the registry in a well-defined legacy-compatibility mode tied to the exact old `init_id`; do not assume a slot value is a permanent generation.
3. Existing active v0.5.0 delegations must continue to transfer only while the migrated legacy Authority state remains exactly consistent. Do not auto-reinitialize or silently renew old consent.
4. The first V2 invalidation atomically advances the new generation and marks the legacy generation retired, so old delegation headers cannot become collectable again after V2 reauthorization.
5. New v0.6.0 subscriptions/delegations store the V2 generation and lifecycle revision in versioned layouts.
6. Legacy account bytes are not reinterpreted as new fields without an explicit version discriminator and migration tests.
7. Existing sponsored account payer/refund facts remain unchanged where recorded. Where v0.5.0 never recorded a Plan sponsor, do not invent one.
8. The old unbound permission-creation and authority-control instruction formats are rejected after the program upgrade. Legacy transfer instructions must consult the Registry or they can bypass the new invalidation.
9. SDK/IDL/Rust client/TypeScript client/Program/upgrade fixtures ship as one pinned release set.

The Program upgrade authority/governance path is external. The current project evidence records a Squads v4 3-of-5 authority with zero-second timelock and unknown member identity/custody. SolMint does not control this upgrade and must not submit or execute a Mainnet proposal.

## 7. Mandatory upstream test plan

All tests must run against the exact proposed source/Program/IDL commit, with no test-only code path altering production semantics.

- **Generation registry:** genesis, absent-Authority invalidation, close/recreate, same-slot ABA, monotonic checked increment, overflow, malformed owner/discriminator/bump/seeds, wrong subscriber/mint, concurrent mutations.
- **Stale signed authority actions:** withhold Init/Subscribe/Close/Revoke/Reauthorize, advance generation, then submit old signatures; all stale operations fail with no CPI side effect.
- **Durable nonce / smart wallets:** hold V2 actions in durable nonce and program-controlled proposals; before deadline exact revision succeeds only once; after deadline or after invalidation action fails.
- **Subscription lifecycle revision:** Cancel → Resume → Cancel same period; stale Resume fails. Same-second close/recreate; stale CancelNow fails. Parallel conflicting control transactions serialize.
- **Plan revision:** Plan edit away and restore exact prior values; old signed update fails. Pending Subscribe against a changed revision fails.
- **Finite billing:** all boundary and partial-period cases in §4 TM-05; integer arithmetic overflow and rounding tests.
- **Rent payer:** all account kinds, every create/revoke/close route, sponsor/owner/network fee payer split, actual refund beneficiary, non-terminal exposure, Plan sponsor create→delete end-to-end.
- **All Pullers and allowance:** Plan Owner plus each permitted Puller, concurrent pulls, same-period cumulative cap, two destinations, over-limit second leg full rollback, and external Puller reconciliation.
- **Atomicity:** generation/lifecycle/plan revision writes, token delegate CPI, token transfers, account lifecycle, events and errors roll back as one Solana transaction.
- **Backward compatibility:** real captured v0.5.0 account fixtures; lazy migration; v0.5.0 active subscription transfer before invalidation; stale v0.5.0 signed instruction rejection after upgrade; all legacy transfer paths consult new generation state.
- **SDK/IDL:** golden instruction bytes, generated clients, account layouts, optional signer positions, explicit rent payer and wallet integration tests.
- **Adversarial:** malformed remaining accounts, unexpected instructions, CPI substitution, signer/writable privilege mismatches, duplicate actions, stale lookup-table message, wrong cluster/program, RPC unknown outcomes and crash/retry behavior.

## 8. Independent security and release gates

A design or passing LiteSVM suite is not a release fix. Required order:

1. Maintainer triage of private report `GHSA-hvvh-pvqw-g3gx`.
2. Upstream protocol architecture review covering every finding and backward-compatibility migration.
3. Maintainer-approved implementation and upstream code review.
4. Full Rust unit/integration, LiteSVM, TypeScript/Rust SDK, IDL freshness, format, lint and deterministic-build tests.
5. Independent security audit of the entire changed Program and migration surface; the July 2026 Cantina report does not automatically audit the new code.
6. Immutable Program release/tag, source commit, generated IDL/client hashes and reproducible ELF evidence.
7. Devnet migration and mutating E2E proving old signatures cannot execute after invalidation, existing v0.5 state is preserved and every retained capability works.
8. Mainnet upgrade by the actual authorized governance path (outside SolMint control), followed by independent finalized ProgramData/ELF/IDL verification.
9. SolMint backend/DB/Collector/verifier/accounting tests against the exact deployed Program version.
10. Only then enable the relevant product capabilities. No entitlement or paid outcome is granted from an instruction signature, event, RPC submission or account state alone.

## 9. Current execution status

- Private TM-01 report: **SUBMITTED / TRIAGE**, GHSA `GHSA-hvvh-pvqw-g3gx`. Submission is not maintainer acceptance or remediation.
- Temporary private fork creation: **BLOCKED** by a GitHub 403 OAuth App access restriction enabled by the `solana-foundation` organization. No public fork or public upstream issue was created.
- Upstream Program v0.6 implementation: **NOT IMPLEMENTED by SolMint**; no permission to claim upstream code changes.
- Independent audit of proposed protocol changes: **NOT STARTED**.
- Upstream deployment and finalized Mainnet verification: **NOT STARTED**.
- G0 Production migration-runner provenance: **BLOCKED / UNKNOWN** under Issue #355; separate from this G1 protocol work.
- SolMint production Subscription lifecycle/Collector/verifier/accounting: **NOT IMPLEMENTED**.
- Capability policy: **KEEP ALL PLANNED FEATURES**; no feature is approved for deletion as a way to close G1.

No Production database/settings, Secret/Key, signer, customer consent, Program upgrade, Mainnet/Devnet transaction, accounting posting or customer funds were changed in preparing this design.
