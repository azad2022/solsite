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
