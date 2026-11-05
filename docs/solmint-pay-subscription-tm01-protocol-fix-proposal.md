# SolMint Pay — TM-01 Upstream Protocol Remediation Proposal

**Date:** 2026-11-05  
**Repository:** `azad2022/solsite`  
**Branch:** `feat/pay-subscription-billing`  
**Proposal status:** SECURITY DESIGN PROPOSAL — NOT IMPLEMENTED, NOT UPSTREAM-ACCEPTED  
**Owner decision:** The High old-signed-create residual risk is explicitly **NOT ACCEPTED**. Production Subscription launch is blocked until the protocol-level remediation is implemented, independently reviewed, deployed and verified.  
**Program ID:** `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`  
**Audited/pinned release source:** `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`  
**Upstream main inspected:** `abecf131886bec421e38544ec0c312c0325f6a8b` (2026-11-04)

This document is a proposal for upstream protocol review. It does not declare an instruction, account, field, SDK API or migration to exist. Conceptual names below are descriptive only; discriminator values, account layouts, exact integer representation and SDK names require upstream maintainer review and a versioned IDL.

## 1. Security decision and release consequence

On 2026-11-05, the project owner rejected acceptance of the Cantina High finding concerning delayed signed authority creation. The decision is narrow and explicit:

- SolMint will not accept the old-signed-create/revocation risk as a v1 residual risk.
- A strong-revocation claim and Production Subscription launch are prohibited until the upstream Program invalidates previously signed creation/authority operations after an on-chain invalidation.
- Browser policy, recent-blockhash-only UX, a backend generation column, or rejecting `UNKNOWN_INIT_ID` in SolMint builders are not substitutes for on-chain enforcement.
- This does not record acceptance of the other five detailed Cantina Acknowledged findings. G1 remains BLOCKED until their dispositions and the remaining v1 exclusions are separately reviewed.
- No Mainnet Program upgrade, Squads proposal, production setting, key, database object or live customer consent is authorized by this decision or by this proposal.

## 2. Exact source evidence

### 2.1 Pinned release behavior

The following behavior was verified against the pinned Program source:

1. `InitSubscriptionAuthority` uses discriminator `0` and carries no expected generation/action value. When the Authority PDA is absent, it stores `Clock::slot` as `init_id`; whether newly created or already present, the handler proceeds to SPL Token `Approve(u64::MAX)`. The existing-account path is explicitly idempotent and can therefore re-approve a revoked delegate.
2. `CloseSubscriptionAuthority` uses discriminator `6` and closes the Authority PDA.
3. `RevokeSubscriptionAuthority` uses discriminator `14`, revokes the matching token delegate when present, and closes the Authority PDA.
4. `Subscribe` uses discriminator `11`. Its payload contains `expected_subscription_authority_init_id`, but `SubscriptionAuthority::check_init_id` treats `UNKNOWN_INIT_ID` as the current clock slot. This is not a durable consent generation.
5. `SubscriptionAuthority.init_id` is currently assigned from the slot. The existing transfer helper compares the delegation header's `init_id` to the live Authority's `init_id` before signing the token transfer. That exact comparison is a potential compatibility seam for a durable generation, but it is not itself a persistent generation store.

Pinned source references:

- [initialize_subscription_authority.rs](https://github.com/solana-foundation/subscriptions/blob/364a41976c33347d092902443bbec2def9227e75/program/src/instructions/initialize_subscription_authority.rs)
- [close_subscription_authority.rs](https://github.com/solana-foundation/subscriptions/blob/364a41976c33347d092902443bbec2def9227e75/program/src/instructions/close_subscription_authority.rs)
- [revoke_subscription_authority.rs](https://github.com/solana-foundation/subscriptions/blob/364a41976c33347d092902443bbec2def9227e75/program/src/instructions/revoke_subscription_authority.rs)
- [subscribe.rs](https://github.com/solana-foundation/subscriptions/blob/364a41976c33347d092902443bbec2def9227e75/program/src/instructions/subscribe.rs)
- [subscription_authority.rs](https://github.com/solana-foundation/subscriptions/blob/364a41976c33347d092902443bbec2def9227e75/program/src/state/subscription_authority.rs)
- [transfer_utils.rs](https://github.com/solana-foundation/subscriptions/blob/364a41976c33347d092902443bbec2def9227e75/program/src/instructions/helpers/transfer_utils.rs)

### 2.2 Current upstream main recheck

The current upstream main ref was read at `abecf131886bec421e38544ec0c312c0325f6a8b`. The inspected Init, Close, Revoke, Subscribe and Authority state files still contain the behaviors above; no TM-01 protocol fix was found in those paths. This is a repository-source observation, not proof of the Mainnet deployment state. Mainnet ProgramData/ELF evidence remains the separate finalized read-only checkpoint already recorded in the Progress Ledger.

Current-main references:

- [initialize_subscription_authority.rs](https://github.com/solana-foundation/subscriptions/blob/abecf131886bec421e38544ec0c312c0325f6a8b/program/src/instructions/initialize_subscription_authority.rs)
- [revoke_subscription_authority.rs](https://github.com/solana-foundation/subscriptions/blob/abecf131886bec421e38544ec0c312c0325f6a8b/program/src/instructions/revoke_subscription_authority.rs)
- [subscription_authority.rs](https://github.com/solana-foundation/subscriptions/blob/abecf131886bec421e38544ec0c312c0325f6a8b/program/src/state/subscription_authority.rs)



### 2.3 Upstream security disclosure procedure

The upstream repository `SECURITY.md` says not to create a public GitHub Issue for a security problem and directs reporters to the private [Report a Vulnerability](https://github.com/solana-foundation/subscriptions/security/advisories/new) flow. This project will use that private disclosure path before opening a public issue or publishing an upstream implementation PR with exploit details. The available connected GitHub actions in this session do not expose private security-advisory creation, so no advisory was submitted and no public issue was created. This document records a proposed remediation; it is not a substitute for submitting the private report to the upstream maintainers.

## 3. Required security properties

Any acceptable upstream implementation must prove all of the following:

1. **Persistent generation:** the generation for a `(subscriber, mint)` pair survives Authority close/recreation and cannot be reset by closing an account.
2. **Pre-submit invalidation:** the subscriber can invalidate a previously signed but not-yet-landed Init/Subscribe even when the Authority PDA does not currently exist.
3. **Generation-bound actions:** every permission-creating or Authority-mutating operation checks the current generation and an action-specific freshness value.
4. **Legacy closure:** no old discriminator or sentinel-based compatibility path can recreate/re-approve Authority or close/revoke a newer Authority without advancing the generation.
5. **Atomic revocation:** generation advancement, token-delegate revocation and Authority state transition/closure occur in one Solana transaction. A partial effect must roll back.
6. **No slot ABA:** same-slot and later-slot close/reinitialize sequences cannot reproduce an earlier generation.
7. **Bounded approval lifetime:** new consent/control instructions carry a Program-validated deadline with a documented maximum lifetime. This supplements, but does not replace, the persistent generation.
8. **Fail-closed arithmetic:** generation/action counters use checked increments; overflow or malformed state fails without wrapping or resetting.
9. **Existing-state safety:** currently active v0.5.0 delegations are either safely migrated without silently changing their terms or explicitly invalidated. Migration must be tested against real legacy account layouts.
10. **No false guarantee for external SPL actions:** a raw SPL Token `Revoke` issued outside this Program does not mutate Program-owned generation state. The product must require the Program's V2 invalidation/revocation action for a strong protocol-level invalidation claim; a standalone delegate revoke must not be represented as invalidating held Program instructions.

## 4. Candidate architecture for upstream review

### 4.1 Persistent Authority Generation Registry

Preferred candidate: a separate, Program-owned PDA keyed by subscriber and mint (descriptive name: *Authority Generation Registry*). The exact seed prefix and account discriminator are not frozen.

Conceptual contents:

- State version and canonical subscriber/mint binding.
- A monotonic generation counter.
- Any action nonce/consent-enabled state required by the final instruction design.
- Canonical bump/derivation integrity.

Required behavior:

- The Registry is persistent: ordinary instructions must not close, reset, reinitialize or overwrite it. A permissionless excess-rent path may return only lamports above the current rent-exempt minimum for the exact Registry data length to its recorded funder; it must not change owner, data, discriminator, generation or the rent-exempt floor. The Registry must be added to any account-kind / rent-reclaim handling deliberately, not treated as an unknown account or silently routed through a generic close path.
- It is not caller-controlled: the Program derives and validates it from the signed subscriber and mint.
- A first invalidation must be able to create the registry/tombstone even when no Authority PDA exists.
- The initial generation is established by Program logic, never supplied freely by the caller.
- Counter increment is checked and monotonic. No clock slot, timestamp, transaction signature or browser-generated value is treated as a generation.
- Registry rent/capital is a product/security tradeoff: customer-funded and permanently retained unless an independently safe lifecycle is designed. SolMint sponsorship is not introduced.

Alternative requiring separate review: retain the Authority PDA itself as a non-closeable tombstone/generation store. This avoids a second PDA but permanently changes Authority rent-recovery semantics. Do not choose either model without upstream review of account lifecycle, rent and migration.

### 4.2 Authority initialization

A new generation-bound initialization path must:

- Require the subscriber signature, canonical Registry PDA and exact expected generation.
- Check a bounded `not_after`/deadline and any action nonce specified by the protocol.
- Create/recreate Authority only when the expected generation equals the current Registry generation.
- Store that exact generation in the Authority's generation field (the existing 8-byte `init_id` may be a compatibility candidate, but semantic/type compatibility must be proven).
- Reject the old idempotent behavior that silently re-runs `Approve(u64::MAX)` for an existing Authority.
- Never treat an existing Authority PDA as proof that the token delegate is approved or that fresh consent exists.
- Require a separate, explicit and reviewed reauthorization operation if reauthorization is ever supported; it must advance or consume generation/nonce as designed.

### 4.3 Subscribe and other permission-creation paths

- Subscribe must bind the exact current generation, exact Plan terms snapshot and a bounded deadline.
- `UNKNOWN_INIT_ID` must be rejected unconditionally; it must not resolve to the current slot.
- Every other instruction that creates a permission through the shared Authority, including fixed/recurring delegation creation, must reject the sentinel and bind to the exact current generation.
- A legacy Subscribe discriminator may not remain as a bypass. Preferred policy is to disable the old unbound format. Any compatibility path retained by upstream must prove it checks the same persistent generation, refuses the sentinel and cannot bypass the new action nonce/deadline policy.
- SubscriptionDelegation must snapshot the generation used at consent. The current transfer path compares delegation `Header.init_id` with Authority `init_id`; that comparison may preserve existing accounts if the registry is safely bootstrapped from the live legacy Authority value.

### 4.4 Revocation and invalidation

A new generation-bound revoke/invalidate path must handle both cases:

**Authority exists**

- Require the exact current generation and subscriber signature.
- Advance the persistent generation with checked arithmetic.
- Revoke the SubscriptionAuthority token delegate if it is the current delegate; do not revoke a foreign delegate.
- Close or transition the old Authority only after generation state is safely advanced in the same atomic transaction.
- Ensure all old SubscriptionDelegation/fixed/recurring records from the previous generation fail the existing exact generation comparison after a new Authority is created.

**Authority does not exist**

- Still permit a subscriber-signed generation advance/tombstone operation.
- This invalidates a previously signed but unsubmitted initialization that would otherwise create the Authority later.
- The old signed initialization must fail when submitted after the generation advance.

The operation must be serialized by the writable generation account and tested for both transaction orderings. If initialization lands first, the later invalidation must revoke/advance it. If invalidation lands first, the stale initialization must fail.

### 4.5 Legacy instruction closure

At minimum, the Program upgrade must address these currently observed instruction variants:

| Legacy instruction | Current discriminator | Required treatment |
|---|---:|---|
| InitSubscriptionAuthority | 0 | Reject; it has no expected-generation input and can re-approve `u64::MAX` |
| CloseSubscriptionAuthority | 6 | Reject or replace with generation-bound operation; it cannot advance persistent generation |
| Subscribe | 11 | Reject sentinel; preferably disable legacy format unless exact generation/deadline/nonce compatibility is proven |
| RevokeSubscriptionAuthority | 14 | Reject or replace with generation-bound operation; it currently closes without a persistent generation advance |

Also audit all other code paths that can mutate the Authority, create a permission, close/reclaim a PDA or alter rent. This includes every call site of the Authority close helper and current-main account-reclaim functionality. No second discriminator or convenience path may reintroduce the old behavior.

### 4.6 Legacy account migration

A candidate compatibility bridge requires explicit upstream migration tests:

- When a legacy Authority PDA exists and the Registry is absent, initialize the Registry from the validated live Authority `init_id`. Do not change that value in the migration transaction.
- Existing SubscriptionDelegation headers already carry the legacy `init_id`; preserving the Authority value allows the current exact transfer check to continue working before revocation.
- On V2 revocation, advance the Registry generation and close/transition the Authority atomically.
- A later V2 initialization must use the new generation. Old SubscriptionDelegation headers then no longer match the current Authority, so old subscriptions cannot silently become collectible again after reauthorization.
- Existing signed legacy Init/Close/Revoke/Subscribe messages must be rejected by the upgraded Program or proven unable to pass the new generation checks.
- For wallets with no Authority PDA and no Registry, initialize a canonical genesis generation. For users who have a pending signed Init but no Authority, the invalidation path must create the durable tombstone before that old Init can land.

This is only a migration candidate. It must be proven with real account fixtures from v0.5.0 and exact Program tests; no account layout or compatibility assumption is frozen here.

## 5. Mandatory adversarial test matrix

The upstream test suite must cover:

1. Sign Init + Subscribe against generation (g), withhold them, execute invalidation to (g+1), then submit both old instructions. They must fail and must not recreate Authority, approve the delegate or create Subscription.
2. Repeat when no Authority/Registry exists at signature time; invalidation must create the Registry/tombstone and stale Init must fail.
3. Reverse ordering: submit Init first, then invalidation. Final state must have no old spendable permission and the generation must be advanced.
4. Same-slot close/reinitialize and later-slot close/reinitialize. Generation must never repeat.
5. Submit pre-upgrade legacy discriminators 0, 6, 11 and 14 after the upgrade. No path may recreate/reapprove or close/revoke a newer Authority.
6. Reject `UNKNOWN_INIT_ID` for every authority/permission creation path, including fixed and recurring delegation paths.
7. Test stale Subscribe and stale fixed/recurring delegation creation after generation advance and after a new Authority is created.
8. Verify an existing v0.5.0 active subscription remains transferable after lazy Registry bootstrap, then becomes uncollectible after its Authority generation is invalidated; verify it does not revive after reinitialization.
9. Test concurrent Init/Subscribe/Invalidate transactions using the same Registry; only a valid current-generation operation may commit.
10. Test malformed Registry PDA, wrong owner/discriminator/bump, wrong subscriber/mint, replayed action nonce, expired deadline and generation overflow. All must fail closed.
11. Verify Registry cannot be closed/reset and that any supported excess-rent reclaim returns only lamports above the current rent-exempt floor to the recorded funder while preserving Registry bytes, owner, discriminator and generation.
12. Test a raw external SPL Token Revoke separately. It must be documented that this alone cannot advance Program generation; the Program invalidation transaction is required to invalidate previously signed Program operations.
13. Test full transaction atomicity across generation writes, token delegate CPI, Authority close/state transition and emitted events.

The Program's existing upstream integration suite must run against the exact proposed source commit. A SolMint-only mock or a UI test is not sufficient.

## 6. Deployment and verification gates

A protocol patch is not a fix until all of these are complete:

1. Upstream maintainers review and accept the design and implementation; no SolMint-only overlay is represented as an upstream fix.
2. Exact source, instruction layouts, account layout, IDL, TypeScript SDK/client and migration tooling are versioned together.
3. Full unit/LiteSVM/integration/adversarial suites pass, including the legacy migration matrix above.
4. Independent security review covers the changed Program code and the migration/compatibility surface. The old Cantina report does not automatically audit this new code.
5. Reproducible build proves the exact ELF from the approved source; IDL/account layouts are compared byte-for-byte with the release artifacts.
6. Devnet migration and end-to-end tests prove stale signed transactions fail before any Mainnet deployment.
7. The existing Program upgrade authority/governance path is reviewed. The recorded Mainnet Squads state has a zero-second timelock and member identity/custody remains UNKNOWN; no governance or upgrade action is part of this task.
8. A separately authorized Mainnet upgrade is executed by the appropriate authority. SolMint must then independently re-read finalized ProgramData/ELF/IDL and verify the deployed upgraded binary before enabling the feature.
9. Existing customer consent/authority/Subscription state is reconciled. No live charge or entitlement is inferred from migration alone.

## 7. Open design decisions

These require upstream protocol/product/security review before implementation:

- Separate permanent Registry versus non-closeable Authority tombstone; storage rent, customer cost and account recovery consequences.
- Exact generation integer representation and compatibility with current signed `i64 init_id` fields.
- Action nonce scope and whether each permission creation consumes a per-action nonce while allowing multiple Plan subscriptions under one customer+mint Authority.
- Exact deadline units, maximum validity window and transaction clock semantics.
- Legacy Subscribe and delegation-creation compatibility versus disabling all legacy creation formats.
- Existing sponsored Authority payer and rent-refund handling if the registry becomes permanent.
- Interaction with all current-main instructions, including any generic reclaim/excess-rent path.
- Token-account delegate replacement and direct external SPL Token Revoke behavior.
- Upgrade rollout, legacy client behavior and customer communication.

## 8. Current decision and status

- Owner decision on TM-01 residual risk: **DECIDED — NOT ACCEPTED**. Protocol correction is a hard prerequisite to Production Subscription.
- TM-01 security closure: **BLOCKED** until the upstream Program fix is accepted, independently reviewed, deployed and verified on Mainnet.
- G1 overall: **BLOCKED**. This decision does not accept the remaining Cantina risks or approve the complete v1 capability matrix.
- G0 migration-runner provenance: **BLOCKED** under Issue #355.
- G2 contract freeze: **PARTIAL / BLOCKED**.
- Upstream implementation/PR: **NOT IMPLEMENTED / NOT OPENED** by this checkpoint.
- SolMint Subscription API, schema, consent runtime, Collector, verifier/accounting, billing worker, Devnet Subscription E2E and UI: **NOT IMPLEMENTED**.

No Product runtime, Production database, Supabase/Cloudflare setting, secret/key, Collector signer, customer consent, Devnet/Mainnet transaction, Program upgrade, Squads proposal or funds were changed by this proposal.
