# SolMint Pay — Subscription Billing Baseline Audit

Audit date: 2026-10-30  
Repository: `azad2022/solsite`  
Verified source baseline: `main` at `7b975d56860b6d937ad76ab2983c71937644dfa3`  
Working branch: `feat/pay-subscription-billing`, created from the exact baseline above  
Scope: read-only repository, Production database metadata/function inspection, and current Pay contract review. This is not an implementation or release approval.

## Executive decision

**Subscription Billing is not implemented in the inspected Production database contract.** No Subscription, Billing Cycle, Consent, or Collector tables or public Subscription-specific RPCs were found. The 2026-10-30 main commit adds documentation/engineering skills only; it does not add application routes, dependencies, migrations, or runtime behavior.

The existing Payment Intent and Bulk Pay paths are useful foundations, but the current normal-payment verifier is structurally incompatible with a delegated Subscription transfer whose source authority is the Subscription Authority PDA and whose transaction fee payer is a separate Collector. Do not weaken or bypass the existing verifier. A dedicated Subscription verification/accounting adapter is required before any recurring charge can be enabled.

No application code, database DDL, runtime configuration, secrets, Cloudflare settings, on-chain Program state, or funds were changed during this audit.

## Repository and branch evidence

- Current repository default branch: `main`.
- Latest reviewed main commit: `7b975d56860b6d937ad76ab2983c71937644dfa3` (2026-10-30 09:13:53 UTC), message: `docs(pay): add Subscription Billing engineering skills`.
- The commit diff changes the Build Web Apps and Release Audit guidance and adds `docs/skills/solmint-pay-subscriptions/SKILL.md`; its diff contains no application, migration, RPC, or runtime changes.
- No branch named `feat/pay-subscription-billing` existed when checked. It has now been created from the exact main SHA above. No PR has been opened.
- PR #311 (Wallet-native Hosted Checkout) is closed. PR #363 (Payment Link upgrade stages 2–3) is closed/merged at `33713e1e8e19248c1c4ce20fe9bc221475ed096d`.
- The local Working Tree could not be inspected in this session because direct Git access failed at DNS resolution. Therefore local status is **UNKNOWN**, not clean. GitHub reads and Supabase read-only metadata/SQL were used instead.
- The combined-status query and workflow-run query for the documentation-only HEAD returned no status entries/workflow runs. This is **NO CURRENT-HEAD CI EVIDENCE**, not a green CI result.

## Production database evidence

Production Supabase project `nvopkbiedorfshwbmyhn` (`solmint.ir`) was returned as `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.147.

- The live migration ledger contains 106 entries; the latest recorded version is `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- There are 33 `public.pay_*` base tables. All 33 have RLS enabled. None currently has FORCE ROW LEVEL SECURITY; that observation is recorded for future role-boundary analysis, not automatically treated as a vulnerability.
- No Subscription/Billing Cycle/Collector base table exists in the exposed Production schemas. The name search returned only PostgreSQL/Realtime system subscription objects outside the Pay domain.
- No Subscription/Billing Cycle/Collector application routine was found in the public schema.
- Relevant existing access policies are merchant-scoped: Payment Intents use `pay_has_merchant_access(merchant_id)`; transactions and transfers resolve access through their parent Payment Intent; payout batches/items are merchant-scoped; merchant/revenue ledger reads are similarly scoped by merchant access.
- This query did not test every role/policy combination adversarially. The presence of RLS policies is not a substitute for cross-tenant tests.

### Critical live reconciliation contract

The live definition of `public.pay_apply_verified_observation` was inspected. It is SECURITY DEFINER with an empty search path and currently:

1. Rejects payments where `gas_sponsored` is not false.
2. Requires a valid successful observation, matching Reference, required commitment, and non-empty fee payer.
3. Requires the observed asset, recipient, and merchant settlement amount to match the Payment Intent snapshot.
4. Requires exactly one matching merchant-settlement transfer and one matching gateway-fee transfer.
5. Requires both transfers to have the same `sourceAuthority`.
6. Requires transaction `fee_payer` to equal that same source authority.
7. Writes transaction and transfer observations and recognizes gateway revenue in the existing payment accounting flow.

A delegated Subscription payment normally has a Subscription Authority PDA as token source authority and a Collector as transaction fee payer. It does not satisfy checks 5–6. The mismatch is confirmed from the live function body, not inferred from the UI.

**Decision:** keep this routine and normal Pay invariants unchanged. Subscription needs a separately reviewed verifier/DB adapter that validates the Program, instruction/account layout, Plan/Subscription PDA state, subscriber, Puller, source authority, mint/program, destination, exact atomic amounts, period allowance, Collector fee payer, signature/cycle correlation, and finality; all related financial effects must commit atomically.

## Existing code contracts inspected

### Payment Intent

Inspected:
- `functions/api/pay/v1/payment-intents.ts`
- `functions/api/pay/v1/payment-intents/[id].ts`
- `src/pay/payment-intent-service.ts`
- `src/pay/services/assetPolicy.ts`
- `src/pay/types/domain.ts`

The current Payment Intent API authenticates a Merchant API principal with `payment.create`, validates an integer atomic amount, asset, fee payer, expiry and metadata, resolves the configured Merchant receiving wallet and asset metadata on the server, applies idempotency/rate limits, calculates the existing Payment Intent snapshot, and calls the existing server-side create RPC. Its public read contract exposes the existing payment snapshot/status; it is not a Subscription API.

The current Payment Intent schema has no typed Subscription, Plan, Billing Cycle, Consent, or Attempt relationship. Do not encode recurring state in arbitrary metadata or reuse a Payment Intent as the Subscription aggregate.

### Asset policy

`src/pay/services/assetPolicy.ts` resolves SOL and configured USDC/USDT metadata on the server. The currently accepted stablecoin program is the original SPL Token Program. Token-2022 is intentionally rejected in ordinary Pay flows pending separate review. Do not broaden the asset policy merely because the external Subscription Program can support Token-2022.

### Bulk Pay

Inspected:
- `functions/api/pay/v1/payout-batches.ts`
- `functions/api/pay/v1/payout-batches/[id].ts`
- `functions/api/pay/v1/payout-batches/[id]/transaction-request.ts`
- `functions/api/pay/v1/payout-batches/[id]/submit.ts`
- `functions/api/pay/v1/payout-batches/[id]/verify.ts`
- `functions/api/pay/_shared/internal-jwt.ts`
- `src/pay/services/bulkPayoutTransactionBuilder.ts`
- `src/pay/services/bulkPayoutPolicy.ts`

Bulk Pay is a merchant-controlled non-custodial payout flow. It resolves the merchant's verified source wallet, prepares and reserves a transaction server-side, returns the prepared transaction for the Merchant wallet to sign, validates the submitted signature against the prepared message, and verifies the finalized transfers against the batch snapshot. Its source wallet is also the expected transaction fee payer. The internal JWT capabilities in this flow are purpose-specific; they are not a Collector signing service.

Do not reuse the Merchant wallet signer model as Subscription Collector authority and do not expose a public arbitrary-transaction signing endpoint.

### Current dependency baseline

The reviewed `package.json` pins `@solana/web3.js@1.99.0` and `@solana/spl-token@0.4.15`. It does not declare `@solana/subscriptions`. No dependency or lockfile was changed.

## External Program facts and unverified release gates

The Subscription Skill pins the intended upstream source/tag and SDK:
- Program repository: `solana-foundation/subscriptions`
- Stated Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`
- Source release: `program-v0.5.0`
- SDK: `@solana/subscriptions@0.5.0`

These are design targets, not verified live deployment facts. This audit did **not** verify Mainnet/Devnet ProgramData, deployed binary hash/reproducible build, deployment authority, on-chain IDL, SDK/source compatibility, or the complete Cantina audit PDF. Those gates remain **UNKNOWN**.

The program rules in the Skill must be preserved during design: broad token delegate approval is `u64::MAX`, while effective per-period limits are enforced by Plan/Subscription rules; periods are fixed hours (not calendar months); a Plan Owner is implicitly an authorized Puller; empty destination lists are unrestricted; and regular cancellation, immediate cancellation, delegation revocation, and authority revocation are different operations. The Program is not a scheduler.

Do not advertise calendar-month billing, Trial, proration, maximum lifetime charge count, automatic catch-up, pause, or grace-period semantics until backend and product contracts explicitly define and test them.

## Release governance and other open issues

- Issue #355 remains **OPEN / migration-runner provenance UNKNOWN**. Historical Supabase-linked runner logs show a Production migration applied outside the documented controlled workflow; the exact trigger/actor and current integration toggle have not been directly verified. Do not attribute an actor or change Supabase integration settings based on timestamps. Production DDL remains blocked until this control is resolved and the controlled path is explicitly authorized.
- The documented Production migration workflow requires a `DRY_RUN`, explicit `APPLY`, and post-apply migration-ledger verification. The Production migration policy is the controlling repository procedure.
- Issue #356 remains open for Bulk Pay database-boundary canonical-recipient/asset validation. This is separate from Subscription and must not be represented as a Subscription exploit.
- Issue #354 remains open for the complete authenticated Bulk Pay lifecycle E2E. Existing Devnet transaction-builder verification is not the same as full authenticated API/database lifecycle coverage.
- PR #363's Payment Link production gates and post-deployment API/Live/Browser smoke evidence passed. That evidence is specific to the Payment Link release; it does not validate Subscription.

## Implementation classification

| Area | Result | Evidence / limitation |
|---|---|---|
| Production DB connectivity | PASS | Project is ACTIVE_HEALTHY; metadata and read-only SQL succeeded |
| Current Pay table RLS presence | PASS (presence only) | 33/33 tables enabled; adversarial tenant matrix not rerun |
| Subscription DB tables/RPCs | NOT IMPLEMENTED | No Subscription/Billing Cycle/Collector objects in live application schema |
| Subscription API/domain contracts | NOT IMPLEMENTED / repository-wide search incomplete | No Subscription routes found in inspected code; local full tree unavailable |
| Existing Payment Intent/Bulk Pay foundations | CONFIRMED | Current route/service files inspected |
| Subscription-compatible verification/accounting | BLOCKED | Current live verifier enforces source authority = fee payer and rejects sponsored gas |
| Collector isolated signing | NOT IMPLEMENTED / UNKNOWN | No Collector registry/service or HSM/KMS evidence inspected |
| ProgramData/binary/IDL/audit delta | UNKNOWN | External deployment and complete audit artifacts not verified |
| Current HEAD CI | UNKNOWN | No status/check run was returned for the docs-only commit |
| Local Working Tree | UNKNOWN | Direct Git access failed at DNS resolution |
| Production migration provenance | BLOCKED / UNKNOWN | Issue #355 remains open |

## Next safe sequence

1. Complete read-only repository-wide API/schema inventory and inspect the full external Program release, deployed ProgramData/IDL and Cantina PDF/commit delta.
2. Write the Subscription domain contract and explicit transition model before creating routes or migrations. Keep Subscription, signed Consent, on-chain authority, Billing Cycle, Attempt, Payment Intent, Collector submission, Verification and Accounting distinct.
3. Design the isolated Collector trust boundary and dedicated Subscription verifier/accounting adapter. Preserve the existing ordinary Pay verifier.
4. Design database-enforced cycle uniqueness, atomic claim/lock, durable attempts and timeout/restart reconciliation before any scheduler can trigger a charge.
5. Implement additive API/schema changes on this feature branch only after contract review; validate with disposable PostgreSQL and adversarial tests.
6. Add Devnet-only E2E for consent, delegation, pull, finalized verification and atomic accounting; keep Mainnet checks read-only.
7. Build Customer consent UI and Merchant Subscription screens only after the real backend contracts are implemented and tested.
8. Use the controlled Production migration workflow only after issue #355 is resolved and the user explicitly authorizes the production Apply sequence.

**Checkpoint result:** baseline discovery is recorded. No Subscription implementation or Production release is claimed.


## 2026-10-30 follow-up — pinned upstream release and audit delta

The upstream repository was inspected at the pinned release tags and the audit-status document was checked.

### Release and audit lineage

- Upstream `audits/AUDIT_STATUS.md` identifies Cantina's current audit baseline as `d6b3a5dc7ab18c4168441af733c81ab0a599d414`, with remediation implemented/verified through `debb4f75ff7571218b39de3b633074dd843e70db`.
- GitHub compare confirms the `program-v0.5.0` release commit `364a41976c33347d092902443bbec2def9227e75e` is **8 commits ahead** of the stated remediation commit. The exact eight-commit compare contains 20 changed paths: release workflow/toolchain, Cargo and package manifests/lockfiles, README/audit-status documentation, published IDL, TypeScript/Rust SDK changelogs/package files, SDK tests, and demo webapp files. It does **not** list any `program/src/**` Rust instruction/state implementation files in this range. The delta still requires review because the SDK, IDL, dependency graph, build/release pipeline and demo client changed; however, this audit does not claim that Rust program instruction logic changed in these eight commits. “Audit fixes implemented” still does not prove the released artifact or client integration is fully covered.
- Upstream `main` is 31 commits ahead of the remediation commit. Do not pin upstream `main` for production.
- The current upstream changelog states that v0.5.0 targeted Mainnet on 2026-08-10 and was built reproducibly with `solana-verify`; it also states that the deployed binary and on-chain IDL report `0.5.0-beta.1`, built at release commit `364a419` before the version bump. This is an upstream declaration, not an independent verification of the currently deployed ProgramData bytes.
- The TypeScript SDK tag `ts-client-v0.5.0` declares package version `0.5.0` and peer dependency `@solana/kit ^7.0.0`. SolMint's current runtime is based on `@solana/web3.js 1.99.0` and does not include `@solana/kit`; SDK integration therefore needs an explicit adapter and dependency/lockfile review, not an assumed drop-in install.
- The upstream Cantina PDF is identified by `audits/AUDIT_STATUS.md`, but it could not be read in this session: GitHub file decoding failed for the binary PDF and the web PDF fetch did not return a document. The report contents are **NOT REVIEWED** here.

### Additional upstream security constraints

The official upstream README and v0.5.0 changelog call out risks that must shape the SolMint design and consent UX:

- Token approval to the shared `SubscriptionAuthority` is `u64::MAX`; effective restrictions are in the Plan/Subscription program state, not in a per-cycle Token Delegate allowance. The user-facing consent summary must explain this accurately.
- An on-chain Subscription showing as active is not proof that a pull can succeed. A user may revoke the ATA delegate, freeze/empty/close the token account, or otherwise make the authority uncollectable; the program has no delinquency state. Backend service entitlement must not be granted or renewed based only on the on-chain active flag or an emitted event.
- `init_id` is slot-granular. The upstream security notes describe held signed initialization/subscribe bundles and authority-control transactions that may execute later than the user expected; recent blockhashes expire, but durable-nonce or pending smart-wallet proposals can persist. A revoke operation is not a universal guarantee that every held signed transaction has become impossible to execute.
- `ResumeSubscription` and `UpdatePlan` have explicit stale-state arguments in v0.5.0, but other operations have different replay/freshness properties. SolMint must preserve the exact SDK/IDL instruction arguments and cannot treat all approvals as having the same freshness guarantee.
- Immediate cancellation requires both subscriber and current plan owner signatures; ordinary cancellation can leave the existing period collectable. Revoking the shared Subscription Authority is broader than revoking one subscription and can affect other subscriptions for the same user and mint.
- Token-2022 support in the upstream Program does not automatically authorize Token-2022 in SolMint. The existing SolMint Pay asset policy only accepts its configured original SPL Token Program stablecoin path. Any Token-2022 support needs an independent mint/extension/transfer-hook and destination-account security review.

### Updated implementation/release classification

- Pinned upstream source tag and SDK tag identified: **CONFIRMED**.
- Upstream declared version / deployed IDL version discrepancy: **CONFIRMED IN UPSTREAM RELEASE NOTES**; live ProgramData/IDL match: **UNKNOWN**.
- Audit coverage of deployed release: **NOT FULLY ESTABLISHED**; eight commits exist after remediation through the release commit, and the Cantina PDF was not read in this session.
- Mainnet ProgramData address, deployed binary hash, upgrade authority, deployment slot, and `solana-verify` reproduction against live bytes: **UNKNOWN**.
- Subscription SDK can be integrated into the current runtime without a Kit adapter: **NOT CONFIRMED**; dependency architecture differs.


## 2026-10-30 follow-up — upstream on-chain source spot-check

The following source files were read directly at tag `program-v0.5.0`. This is a focused source spot-check, **not** a complete review of the eight-commit release delta or the Cantina PDF.

| Upstream source | Verified on-chain behavior | SolMint design constraint |
|---|---|---|
| `program/src/instructions/create_plan.rs` | Plan amount is the maximum pull for one period; `period_hours` must be 1–8760; maximum 4 destination addresses and 4 additional puller addresses. Empty destinations mean any receiver is accepted. | Period input must be expressed as a fixed number of hours. Do not represent a calendar month as a native period. SolMint must reject empty destination allowlists at its own policy boundary if unrestricted destinations are not acceptable. |
| `program/src/state/plan.rs` | Plan Owner is always authorized to pull; listed pullers are additional authorized callers. A non-empty destination list restricts the receiver owner; an all-empty list permits any receiver. | Do not equate “empty puller list” with no authorized caller: the Plan Owner remains authorized. Do not assume empty destinations are safe. |
| `program/src/instructions/subscribe.rs` | Subscribe binds consent to the current plan mint, amount, period hours, plan creation timestamp and the subscriber's `SubscriptionAuthority.init_id`; the subscription stores a snapshot of PlanTerms and initializes period accounting at the on-chain clock time. | Consent evidence must snapshot those values and bind to the correct subscriber, plan and authority incarnation. The UI's displayed plan data is not itself proof that the on-chain consent transaction applied. |
| `program/src/instructions/initialize_subscription_authority.rs` | The shared `SubscriptionAuthority` PDA is approved as the token-account delegate for `u64::MAX`. Reinitialization can re-approve that delegate if the user previously revoked it; the original payer recorded in the authority is retained. | Do not state that the wallet grants only the current cycle amount. Model shared authority and per-subscription on-chain controls separately. A backend must re-check actual authority/delegate state and incarnation; a previous revoke is not necessarily a permanent revocation barrier. |
| `program/src/instructions/transfer_subscription.rs` and `program/src/instructions/helpers/transfer_utils.rs` | Each pull validates the Plan, caller authorization, destination owner, subscription-to-plan binding, terms snapshot and cancellation boundary, then transfers from the subscriber ATA with the shared SubscriptionAuthority PDA as token delegate. | Collector caller authorization, token source authority, transaction fee payer and destination are distinct facts. The verifier must inspect the actual instruction/account/transfer evidence, not infer roles from the signature or fee payer. |
| `program/src/instructions/cancel_subscription.rs` | Ordinary cancellation sets expiry at the end of the current billing period (with exact program boundary handling); the subscription may remain collectable until expiry. | Do not label a normal cancellation as immediate revocation. Entitlement and collection policy must match the actual on-chain expiry. |
| `program/src/instructions/update_plan.rs` | Plan mint, amount, period and destination list are not mutable through UpdatePlan. For an active Plan, status, end timestamp, pullers and metadata can be changed subject to freshness checks; a finite end can only be shortened. A Sunset Plan is otherwise immutable except puller removals. | A price/mint/period/destination change requires a distinct new Plan and fresh Subscriber consent. Puller removal is a security response path; do not treat plan update as arbitrary terms mutation. |
| `program/src/instructions/revoke_subscription_authority.rs` | RevokeSubscriptionAuthority revokes the Program's delegate if it matches the expected PDA and closes the shared authority. | This operation is authority-wide for a given user+mint, not a per-subscription revoke. UI/API naming and impact warnings must distinguish it from closing one SubscriptionDelegation. |
| `program/src/instructions/revoke_delegation.rs` and `revoke_abandoned_subscription.rs` | Subscription close/recovery has separate subscriber, sponsor and terminal-authority rules; sponsor recovery is not equivalent to subscriber cancellation. | Do not merge Cancel, Resume, Revoke Subscription, Revoke Shared Authority and sponsor rent recovery into one frontend status or button. |

### Consequences for backend and accounting

- The upstream Program enforces a per-period cap in on-chain SubscriptionDelegation state, but it does not schedule the pull. SolMint's backend must decide when to attempt a pull; a cron/scheduler is only a trigger, not a deduplication or truth boundary.
- A successful on-chain transfer instruction must be attributed to the correct Plan PDA, Subscription PDA, subscriber ATA, mint/token program, authorized Puller, destination owner/account, amount and period. The event can assist indexing/correlation but is not sufficient by itself to book financial success.
- “Subscription active” is not equivalent to “charge collectible” or “service entitled”: the user may have revoked the shared delegate, the ATA may be empty/closed/frozen, or transfer execution can otherwise fail. The Program does not provide delinquency/grace-period state.
- Slot-scoped `init_id` and delayed/held signed transactions create lifecycle/replay concerns. Recent blockhash expiry, durable nonce flows and smart-wallet pending proposals must be considered in the wallet flow, revoke UX and support/runbooks. Do not treat a displayed Revoke success as proof that all previously signed but unlanded authorization transactions are harmless.
- No Program source change or SDK dependency was made. The 8-commit delta to the release remains incompletely audited; ProgramData/binary/upgrade authority and Cantina PDF are still **UNKNOWN / NOT REVIEWED**.



## 2026-10-30 — Additional upstream residual-risk review

This section records the additional security considerations found in the official `program-v0.5.0` README Security Considerations and rechecked against the pinned instruction/source files. It is not a full Cantina report review.

### Delayed transaction / authority lifecycle

- `init_id` is slot-granular, not a global generation counter. Same-slot close/re-init may preserve the same value; idempotent initialization does not refresh it.
- A held signed transaction combining `InitSubscriptionAuthority` and `Subscribe` with `UNKNOWN_INIT_ID` can land after an attempted authority revoke, recreate the shared authority, approve `u64::MAX` and create a subscription without a new signature at landing time.
- Held authority init/close/revoke transactions are not all bound to a monotonic authority generation. Pending durable-nonce or program-controlled wallet proposals may execute long after the original UI session.
- V1 safety decision: separate customer-signed Authority initialization and Subscribe; fetch and use the actual on-chain `init_id`; reject `UNKNOWN_INIT_ID`; use recent blockhash for consent/control transactions; defer Durable Nonce and pending smart-wallet/multisig proposals until a proven pending-approval cancellation/recovery model exists. This is a recommended product/engineering gate, not an implemented feature.
- Same-period Resume replay, second-granular immediate-cancel replay and UpdatePlan ABA residuals must be included in adversarial tests. Never claim revocation is final while a signed pending operation can still execute.

### Shared authority, delegate replacement and collectability

- One SPL Token account has one approved Delegate slot; initializing the SubscriptionAuthority may replace a previously configured delegate. Customer consent must disclose and validate this before signing.
- Authority is shared per customer+mint; re-approving or revoking it can affect multiple Plan subscriptions for that pair. A revoke of the shared authority is not equivalent to cancelling one subscription.
- On-chain active state does not prove collectability: the delegate can be revoked, ATA frozen/empty/closed, or otherwise unspendable. The Program has no delinquency state; service entitlement needs independent Backend collectability and verified payment policy.
- Reinitialization may reapprove the broad delegate after manual revocation. Treat shared authority state and each SubscriptionDelegation lifecycle separately.

### All Pullers, period accounting and destination/fee constraints

- Plan Owner is an implicit Puller and can transfer independently of SolMint Collector. Reconciliation must discover all valid TransferSubscription instructions/events, not just Collector-generated signatures.
- Period accounting is cumulative within the current on-chain period. The Program advances to the aligned current period after missed periods; it does not create automatic debt for every missed period. Backend cycle identity must use actual on-chain period start and usage.
- Plan destination allowlist checks destination token-account owner. Empty list permits any destination. Production Plan policy must enforce a non-empty allowlist and validate the destination ATA, mint/program and owner.
- One TransferSubscription instruction carries one receiver/amount. A two-leg Merchant principal + Gateway fee design requires separate instructions in one transaction and explicit allowlisting for both destination owners. LiteSVM must prove shared allowance, rollback on any failed leg, no unexpected transfers and correct event/balance accounting; Devnet must then verify the same contract. Until then, split-fee Subscription charging is BLOCKED.
- Plan Sunset blocks new subscriptions but is not an immediate stop for existing pulls. A finite Plan may be shortened after consent, and a near-end Subscribe can incur a full amount for a partial first period. Recommended v1 gate: reject enrollment when less than one full period remains.

### Evidence status and policy impact

- These findings are included in the updated Subscription Skill, Build Web Apps Skill, Release Audit Skill and project-level instruction.
- Durable-nonce and pending-proposal restrictions, two-step init/subscribe, explicit non-empty destinations, no near-end enrollment and no split-fee charging before atomic tests are v1 safety decisions; they are not claims that current code already enforces them.
- The Cantina PDF still has **NOT REVIEWED** status; the eight-commit release delta, deployed ProgramData/binary/upgrade authority/live IDL and SDK compatibility remain **UNKNOWN**.
- No runtime, DB schema, secrets, signer, ProgramData or on-chain state was changed. No transaction was sent.


## 2026-10-30 — Cantina PDF and SDK follow-up (supersedes prior NOT REVIEWED status)

- Full 12-page Cantina PDF was reviewed at project upload. Summary: 9 findings (High 1, Medium 5, Low 2, Informational 1; no Critical/Gas); 4 Fixed and 5 Acknowledged. Cantina's follow-up at `debb4f75...` states all findings addressed/no new issues, but five accepted risks remain documented rather than coded out.
- Full item-level mapping is in `docs/solmint-pay-subscription-implementation-plan.md`. High 3.1.1 is a remaining delayed-signed-create protocol risk. Medium residuals include same-second CancelNow, same-period Resume replay, authority-control replay, finite-plan near-end full charge, and UpdatePlan ABA. Rent sponsorship remains a documented low risk. v1 restrictions are control measures, not claims of upstream code fixes.
- Program tag `program-v0.5.0` (`364a419...`) and SDK tag `ts-client-v0.5.0` (`5a347...`) differ by 3 release metadata/dependency commits. Their IDLs are structurally identical apart from version string (`0.5.0-beta.1` vs `0.5.0`).
- SDK static shape is incompatible with direct drop-in use in the current app: it is a Kit v7 plugin, while SolMint has web3.js 1.99.0 and no Kit dependency. Actual adapter/worker runtime proof was not performed.
- ProgramData remains UNKNOWN; existing Mainnet CI only checks a public RPC provider smoke and does not query Program account/ProgramData or IDL. Need approved read-only evidence from production RPC for program/ProgramData, slot, upgrade authority, ELF hash, verified source match and on-chain IDL hash.
- **Phase 2 remains BLOCKED.** Architecture-level security invariants can be treated as provisionally frozen, but no concrete API/DB/RBAC/fee/Collector contracts are frozen. No Stage 3/4/5 work.
