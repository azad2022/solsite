# SolMint Pay — Subscription Decision Register

**Register version:** 1.3  
**Owner decision dates:** 2026-11-19, 2026-11-26  
**Technical review:** 2026-11-27  
**Repository:** `azad2022/solsite`  
**Branch:** `feat/pay-subscription-billing`  
**Recorded from:** explicit owner selections submitted on 2026-11-19 and 2026-11-26  
**Source HEADs reviewed for v1.3 evidence-only clarification:** Product `75e09d6db99adfae41c095cd80deeb3364e9083d`; Program `5eded973c7c587e508e5fb12b5c0cfa2d2314c23`. The v1.2 owner decision was reviewed from Product `84caeaf6a9c5ab1289e489454b457cf26690ab92`; v1.1 from `962f532e254cb8d609a6c23916b8c6fa2283e3a2`; v1.0 from `1159454468e2b9c4b4aa940f22e314c9efc67816`.  
**PR:** #366 — OPEN / DRAFT / NOT MERGED  
**Register status:** OWNER SELECTIONS RECORDED; CONTRACT FREEZE **BLOCKED**  
**Scope:** design and product policy only. This register does not authorize runtime implementation, Production DDL/data changes, secrets/keys/signers, customer consent, Devnet mutation, Mainnet mutation or release.

## 1. Decision status vocabulary

- **RECORDED** — the owner explicitly selected this direction.
- **CONDITIONALLY ACCEPTED** — direction is compatible in principle, but exact contract details or technical evidence remain open.
- **BLOCKED** — cannot be implemented or represented as production-ready until the listed prerequisite is met.
- **OPEN** — owner input or source evidence is still required.
- **REJECTED** — conflicts with an established security invariant or explicit owner constraint.

A recorded product preference is not evidence that the feature exists or is safe to enable.

## 2. Owner-selected decisions

| ID | Area | Owner selection | Disposition |
|---|---|---|---|
| D-001 | Gateway fee model | Reuse the existing SolMint Pay gateway-fee policy; do not introduce a new Subscription-specific commission/rate. | CONDITIONALLY ACCEPTED |
| D-002 | Gateway fee bearer | Merchant bears the approved gateway fee; it is deducted from Merchant settlement, not added to Customer total. | RECORDED; Subscription implementation BLOCKED |
| D-003 | Signing architecture | Dedicated Merchant-related wallet/signing path with an isolated Signing Service. | CONDITIONALLY ACCEPTED; custody and signer implementation BLOCKED |
| D-004 | Activation | Subscription/entitlement becomes active only after independent finalized verification and atomic accounting commit. | RECORDED |
| D-005 | Grace period | 7 days. | RECORDED; exact clock and state transitions OPEN |
| D-006 | Retry policy | Up to 3 controlled retries. | RECORDED; retry schedule and retryable error taxonomy OPEN |
| D-007 | Missed cycles | Process the current on-chain period only; do not automatically charge arrears for every missed period. | RECORDED |
| D-008 | Plan administration | Owner and Admin. | RECORDED; exact capability mapping subject to Auth/RBAC review |
| D-009 | Subscription administration | Owner, Admin and Finance. | RECORDED; exact capability mapping subject to Auth/RBAC review |
| D-010 | Customer-record administration | Owner and Admin. | RECORDED; does not define Customer self-service permissions |
| D-011 | Ledger/report access | Owner, Admin and Finance. | RECORDED; read/write separation and export permissions OPEN |
| D-012 | Retry/recovery operations | Owner and Admin. | RECORDED; high-risk actions remain server-mediated and audited |
| D-013 | Refund/reversal authorization | Owner only. | RECORDED; financial workflow and reversal policy OPEN |
| D-014 | Customer identity | SolMint account linked to the customer's own wallet. | CONDITIONALLY ACCEPTED; identity-link proof and wallet ownership contract OPEN |
| D-015 | Wallet architecture | Preserve Smart Wallet and Multisig compatibility in the architecture. | RECORDED as an architectural requirement; actual support BLOCKED by protocol/approval-lifecycle gates |
| D-016 | Plan retirement | Archive Plans permanently and preserve historical/financial records. | RECORDED; on-chain sunset and existing-subscription behavior must be separately modeled |
| D-017 | VNext Program identity path | Select Path B: a new, independent SolMint-owned Program ID, with separate VNext PDAs/source-account lineage and fresh Merchant/Customer consent. | RECORDED 2026-11-26; Program ID/key custody, identity creation and deployment remain BLOCKED pending separate authorization and controlled custody |

## 3. Fee decisions — critical distinction

D-001 and D-002 concern the **SolMint Pay gateway commission**, not Solana transaction network fees and not account Rent.

The existing Pay system has a configured gateway-fee recipient and authoritative Payment Intent fee/customer-total/merchant-settlement snapshots. The repository documents the configured recipient as `C9Cas87cue2YaHHTugTsQp6XP1Ho5CsbQNHCNi2rqSxz`. This does not, by itself, establish the current fee rate/formula or prove that every Subscription transfer can reuse the one-off Payment Intent calculation unchanged.

The owner selection means:
- Reuse only an already-approved, currently authoritative Pay gateway-fee policy.
- The Merchant is the intended economic bearer of that gateway fee. The existing Pay fee calculation distinguishes this commercial bearer from the transaction network-fee payer: for `merchant`, `customerTotalAtomic = amountAtomic` and `merchantNetAtomic = amountAtomic - gatewayFeeAtomic`.
- Do not invent a new rate, formula, markup, fee field, destination or ledger rule.
- Snapshot the exact fee and commercial bearer in immutable, server-authoritative consent and billing data only after the existing policy and contract are verified.
- Use integer/atomic-unit arithmetic only.

**Implementation BLOCKED:** the pinned Subscription `TransferSubscription` instruction has one destination and one amount. A separate gateway-fee recipient requires a second instruction/transfer leg and explicit Plan destination allowlisting. The two-destination shared-allowance/atomic-rollback LiteSVM regression is a narrow PASS, but it does not prove the production verifier, accounting, settlement mapping, or the commercial fee formula. A dedicated Subscription verifier and atomic accounting/outbox path plus Devnet Subscription E2E are still required. The existing Pay verifier must remain unchanged.

**Separate, previously recorded network-cost rule remains in force:**
- Customer funds their own Authority/Subscription Rent and customer-initiated setup/control network fees.
- Merchant funds Plan Rent and Plan-operation network fees.
- A recurring Merchant billing pull must use a Merchant-owned or explicitly Merchant-funded transaction fee payer.
- The Collector may be an isolated, separately authorized Plan Puller; it must not spend SolMint-funded SOL or be silently conflated with the transaction fee payer.
- If the Merchant-funded recurring fee payer cannot sign, do not submit the pull.

Therefore “Merchant bears gateway fee” does **not** mean Merchant's gateway commission is the same thing as the recurring Solana transaction network fee. The recurring pull still requires a Merchant-owned or explicitly Merchant-funded transaction fee payer.

## 4. Signing and custody boundary

The selected isolated Signing Service is an architecture direction, not authorization to create or load a key.

Required separation:
- Customer wallet: signs explicit Consent and customer-controlled Authority/Subscription operations.
- Merchant-funded transaction fee payer: signs and funds recurring billing transaction network fees.
- Collector: separately authorized Plan Puller, constrained by exact Plan/Subscription/Attempt policy.
- Subscription Authority PDA: token source delegate; not a human or service signing key.
- Plan Owner and all additional authorized Pullers: independently discovered/reconciled because pulls can occur outside the Collector.

Still OPEN/BLOCKED:
- Whether the Merchant fee-payer key is held by Merchant-controlled infrastructure, a delegated custody arrangement, or another reviewed model.
- Exact signing-service custody, HSM/KMS, key ownership, authorization, rotation, revocation, emergency stop and compromise recovery.
- Whether the isolated Signing Service signs only as Collector/Puller or also coordinates a distinct Merchant fee-payer signature. It must not collapse these roles.
- No Cloudflare Worker secret is to be treated as an HSM.
- No persistent signer or secret/key change is authorized by this register.

## 5. Entitlement, grace and retry semantics

D-004 requires the strict financial activation sequence:

1. Transaction submission or a signature is not payment.
2. Independently verify the exact finalized transaction, Program, Plan, Subscription, subscriber, Puller, source account, mint/token program, destinations, amounts, fee payer, period allowance and absence of unexpected transfers/instructions.
3. Commit the verified observation, balanced ledger effects, billing attempt/cycle result and required outbox event atomically.
4. Only after that commit may the authoritative backend grant/extend entitlement.

If verification or accounting is unknown, entitlement remains ungranted and the same transaction/observation is reconciled. No new charge is created to resolve an unknown outcome.

D-005/D-006 do not yet define:
- Whether the 7-day grace clock begins at the first failed due attempt, period boundary, or another backend-authoritative event.
- Whether “3 retries” means three attempts after the initial attempt (the submitted option was labelled “3 controlled retries”); the implementation must preserve that interpretation unless the owner explicitly changes it.
- Retry intervals/backoff, timezone/clock source, retryable error classes, terminal errors and behavior during RPC/verification/accounting uncertainty.
- Whether grace and retry windows overlap or are independent.
- Exact entitlement suspension/termination and customer notification behavior.

No blind retry after timeout, submitted-unknown, verifier uncertainty or accounting uncertainty.

## 6. Missed-cycle policy

D-007 is compatible with the pinned Program's period advancement semantics: missed periods do not automatically create an unlimited arrears balance. A new billing cycle must be derived from the actual on-chain period start and remaining allowance, not a calendar assumption. The policy does not permit a new charge while any earlier Attempt/observation/accounting outcome remains unresolved.

## 7. RBAC selections — provisional capability matrix

The selected role sets are recorded as product policy. They are not yet executable permissions.

| Capability area | Selected roles |
|---|---|
| Plan administration | Owner, Admin |
| Subscription administration | Owner, Admin, Finance |
| Customer-record administration | Owner, Admin |
| Ledger/report access | Owner, Admin, Finance |
| Retry/recovery operations | Owner, Admin |
| Refund/reversal authorization | Owner only |

Before implementation, map every operation to existing application roles and DB membership checks. Enforce server-side and database-side authorization; do not rely on UI hiding. Finance access to Subscription administration must not implicitly grant Plan mutation, Customer administration, retry execution, or refunds. Refund remains Owner-only. Application `superadmin` must not implicitly bypass database merchant membership/RLS. All sensitive actions require audit actor, tenant scope and server-mediated execution.

Customer self-service access to their own subscriptions/consent/cancellation is a separate customer-identity contract and is **not decided** by D-010.

## 8. Identity and wallet compatibility

D-014 selects a SolMint account linked to the customer's wallet. Before implementation, prove wallet ownership and link lifecycle, account/session binding, wallet replacement/unlinking, multiple wallets, and cross-customer isolation. Store public addresses and signed consent evidence only; never request or store seed phrases/private keys.

D-015 requires architecture extensibility for Smart Wallet and Multisig. It does **not** mean arbitrary pending proposals, durable-nonce transactions, or unsupported wallet execution flows are enabled. The current upstream risk gates concerning stale signed operations, proposal expiry/cancellation and lifecycle revision remain mandatory. Wallet-specific support must be enabled only after exact protocol/SDK compatibility and adversarial tests pass.

## 9. Plan archival

D-016 selects permanent archival and preservation of history. Archival is not physical deletion and must not erase financial, consent, audit, ledger or reconciliation records. Plan sunset, new-subscription blocking, existing subscription collection, on-chain account lifecycle and retention are separate transitions. In the pinned legacy Program, sunset does not itself stop existing pulls; do not represent archive as immediate cancellation or revocation.

## 10. Unresolved decisions and evidence gates

The following remain OPEN or BLOCKED and prevent G2 Contract Freeze:
1. Confirm the exact existing Pay gateway-fee formula/rate and whether its current customer-total/merchant-net semantics can be reused for Subscription without inventing or silently changing policy. The current `payment-intents.ts` path passes 100 bps to `calculateGatewayFee`; the helper uses integer ceiling division. The Master Specification separately flags the hard-coded 100 bps vs `gateway_fee_bps` domain/configuration as an audit item, so do not claim merchant-configurable pricing or silently change the rate.
2. Approve the exact split-transfer instruction/accounting design, including fee recipient allowlisting, duplicate/extra-leg rejection and balanced atomic ledger mapping.
3. Resolve Merchant recurring fee-payer custody and how it signs independently of the isolated Collector/Puller.
4. Define the grace clock, retry schedule/backoff, retryable errors and terminal states.
5. Complete the operation-by-operation RBAC matrix against existing Auth, roles, membership and RLS.
6. Define Customer self-service permissions and wallet-link lifecycle.
7. Define supported Smart Wallet/Multisig providers and safe pending-proposal lifecycle; preserve the architectural requirement without enabling unsupported execution.
8. Define refund/reversal financial semantics, approval/audit and ledger treatment (authorization is Owner-only).
9. Define operational finality/RPC freshness, Program drift monitoring, kill switch and all-Puller discovery/reconciliation.
10. Complete typed Subscription accounting origin, atomic commit, outbox and reconciliation contract.
11. Resolve the upstream G1 protocol/audit blockers. The previously rejected High TM-01 residual risk remains NOT ACCEPTED; no owner decision here overrides that rejection.
12. **Permanent Fixed/Recurring Lifecycle Registry rent funding and recovery — OPEN; no payer model selected.** The exact VNext lifecycle record must remain non-closeable and preserve its terminal tombstone after the separate closeable delegation account is closed. Its rent payer, any optional third-party sponsorship, excess-lamport handling, and the separate delegation-account refund policy must be decided before account metas or ABI are frozen. This item is a design gate, not authorization to charge or sponsor rent.

### 10.1 Fixed/Recurring Lifecycle Registry rent decision worksheet — OPEN

**Verified source constraints**
- Program design §8.4.4 requires a persistent per-logical-delegation lifecycle record that survives closure and rent recovery of the larger Fixed/Recurring account. The record is non-closeable; the payer/sponsorship/recovery policy is explicitly unresolved.
- The existing Authority Consent Registry is a distinct precedent, not an automatic policy for this new record: its v1 account is permanently retained, records the rent payer, and its current Program path initializes it with subscriber-funded rent. A separately funded VNext Authority is closeable and its recorded payer receives that Authority account's rent on a valid subscriber revoke. These rules must not be silently copied to a different lifecycle account.
- The Subscription Skill's conservative operating boundary is that SolMint does not sponsor account rent or network fees. User-owned Authority/Subscription/delegation accounts use the Customer as instruction-level rent payer; Merchant-owned Plan uses the Merchant. Any future external sponsorship requires explicit approval, exposure quotas, recorded payer/account/refund facts and an enforceable recovery path before the first sponsored transaction.
- Account rent payer, transaction network-fee payer, subscriber/revoker, permission owner and any sponsor are separate roles. A payer must not acquire the ability to delay, veto or prevent subscriber revocation.

**Candidate funding models — neither selected**
- **Subscriber-funded permanent record:** the subscriber funds allocation of the non-closeable Lifecycle Registry. The rent-exempt principal remains locked while the tombstone must exist; it must not be described as refundable or recoverable on ordinary revoke. Any optional excess recovery would be a separate, explicitly approved capability and could return only excess above the required rent-exempt floor to the recorded payer.
- **Approved external sponsor-funded permanent record:** a non-SolMint third party funds allocation under an explicit sponsorship contract. The permanent rent-exempt principal remains locked for the lifetime of the tombstone; closing the larger delegation account does not refund that principal. Sponsorship would require explicit disclosure/consent, per-account and aggregate exposure limits, an auditable payer-to-account record and a tested recovery policy for the separate closeable account. The sponsor must have no authority over subscriber revoke and no right to close/reset the permanent record.
- **SolMint/platform-funded rent:** not an available default under the current project security/operating policy. Do not introduce it as a workaround or infer approval from the existence of an optional payer account in another instruction.

**Decisions required before ABI freeze**
1. Who funds the permanent Lifecycle Registry: subscriber, or an explicitly approved external sponsor?
2. Is external sponsorship enabled for this capability at all, and what disclosure, opt-in, per-customer/global exposure caps and audit facts are required?
3. Is excess-lamport recovery supported? If so, the exact rent-floor calculation, trigger, authorized caller, refund destination and atomicity must be specified. The tombstone and its required rent-exempt principal remain intact.
4. Who funds the separate closeable Fixed/Recurring delegation account, and what exact VNext terminal/expiry/fully-spent conditions permit its closure and rent return? Do not assume the legacy v0.5.0 recovery behavior automatically applies to Path B.
5. Confirm independently funded transaction network fees; rent sponsorship must not silently become SolMint gas sponsorship.

**Non-negotiable acceptance conditions**
- Subscriber revoke/terminalization succeeds without sponsor signature, sponsor availability or sponsor approval.
- Registry state, owner and rent-exempt floor survive delegation closure, sponsor recovery and retries; no generation/revision reset.
- Any allowed excess recovery returns only to the exact recorded payer and cannot change Registry bytes, owner or lifecycle state.
- Failed close/refund/CPI paths roll back atomically and cannot strand a live delegation with a missing tombstone.
- Closeable delegation-account recovery cannot close, reclaim or mutate the permanent lifecycle record.
- Customer-facing consent must disclose the actual payer, locked rent principal, refundability limits and any sponsor role before signing.
- No sponsor ledger/quota table, API, Program field, instruction account position, amount or fee is created by this worksheet.

**Disposition:** OPEN / BLOCKED for Fixed/Recurring account ABI and implementation. The product capability is retained; no payer, sponsorship model, rent amount, refund promise or account layout is selected by this amendment. Source references: Program design §§3.1, 8.4.4–8.4.7; Subscription Skill §12.9; Build Web Apps Skill §Subscription rent-payer boundary.

## 11. Current implementation and release status

- Repository/PR: `feat/pay-subscription-billing`, PR #366 OPEN / DRAFT / NOT MERGED.
- Production Subscription API/domain/schema/RLS/grants, Billing worker, durable DB Cycle/Attempt claims, isolated Collector signer, dedicated production Subscription verifier/accounting/outbox and real Subscription billing E2E: **NOT IMPLEMENTED**.
- G2 Contract Freeze: **BLOCKED**.
- Overall Subscription Production readiness: **BLOCKED**.
- Local Working Tree state: **UNKNOWN** through the remote GitHub connector.
- Exact current-head workflow wrappers completed successfully, but multiple specialized Subscription jobs were SKIPPED by changed-path scope; wrapper success is not proof those jobs ran. See the corresponding progress checkpoint before making any CI claim.

## 12. Change control

This register is versioned. Amend it only with an explicit owner decision or newly verified source evidence, record the previous decision and reason for change, and update the project progress ledger after the Git commit is verified.

No Production database/schema/data/RLS/grant, Cloudflare/Supabase setting, secret/key, persistent signer, customer consent, ledger, Devnet transaction/deployment, Mainnet transaction or Program upgrade is authorized or performed by this register.


## 13. Version history

### v1.1 — 2026-11-19
- Owner explicitly revised D-002 from **Customer** to **Merchant** as gateway-fee bearer and confirmed the revision (“این درسته”).
- This supersedes only D-002 in v1.0; all other owner selections remain unchanged.
- Re-read the current Master Specification, Subscription Skill, Subscription contract design, gateway-fee recipient record, current Payment Intent API and fee calculation helper at source HEAD `962f532e254cb8d609a6c23916b8c6fa2283e3a2`.
- Confirmed current Payment Intent creation calls `calculateSnapshot(amountAtomic, feePayer, 100)`; the fee helper uses integer ceiling division. With commercial payer `merchant`, customer total remains the original amount and merchant net is reduced by the gateway fee. This is distinct from the separate Solana transaction network fee payer.
- Important open audit item: Master Specification flags the hard-coded 100 bps in Payment Intent creation against the `gateway_fee_bps` domain concept. D-001 means reuse the currently approved Pay policy, not assert configurability or authorize changing that rate.
- Subscription still requires a second transfer leg for the separate gateway-fee recipient, Plan destination allowlisting, dedicated finalized verifier and atomic accounting/outbox. The existing normal Pay verifier remains unchanged. Production Subscription fee collection remains BLOCKED.
- No code, database, RLS/grants, secrets/keys/signers, customer consent, ledger, Devnet or Mainnet state was changed by this amendment.


## 14. VNext Program identity path — owner decision 2026-11-26

The owner selected the route that provides the shortest independently controllable path toward production: **Path B, VNext under a new independent SolMint-owned Program ID**.

This selection resolves the architecture-path choice only. It does not establish a Program address, prove key custody, grant upgrade authority, or authorize a deployment.

Required consequences:

1. VNext uses a separate Program ID and PDA namespace. Existing v0.5.0 Program accounts, Plan/Authority/Subscription PDAs, consent, allowances and signed transactions remain legacy state; none is reinterpreted as VNext state.
2. VNext permissions must bind to a dedicated customer-owned source token account whose identity and authority cannot be reached by accepted v0.5.0 account paths. A separate wallet is only a separately reviewed fallback. Source-account isolation must be proven against the exact immutable v0.5.0 binary and all relevant legacy instruction/account paths.
3. Merchant Plans and customer Authority/Subscription/Fixed/Recurring permissions require fresh VNext creation and explicit signatures. Customer fund movement, when needed, must be an explicit customer-signed transaction; no automatic sweep or server custody.
4. Legacy collection must be claim-protected and reconciled as part of any cohort cutover. The old Program remains independently callable; a new Program ID does not revoke old permissions or invalidate old signed transactions.

**Authorization boundary:** this decision does not authorize generating a Program keypair/ID, selecting or changing key custody, assigning an upgrade authority, creating a persistent signer, submitting a Devnet/Mainnet transaction, deploying or upgrading a Program, or migrating customer funds/consent. Those require a separate explicit authorization and reviewed key-custody procedure.

**Remaining blockers:** Program identity creation/custody and deployment preparation; full exact-binary legacy-to-VNext source-account isolation proof; the permanent Fixed/Recurring lifecycle Registry rent-payer/sponsorship/refund policy; versioned VNext account/dispatcher/revoke boundary; ABI golden tests and adversarial migration proof. G1-2 ABI freeze and Subscription Contract Freeze remain **BLOCKED**. No capability is permanently de-scoped.


## 15. Version history

### v1.2 — 2026-11-26
- Owner selected Path B, the independent SolMint-owned VNext Program ID route, as the shortest independently controllable architecture path.
- Recorded the fresh-consent, new-PDA namespace, dedicated source-token-account isolation and explicit customer-signed migration requirements.
- Clarified that the route selection does not authorize Program ID/keypair generation, custody changes, signer creation, deployment, customer consent or fund movement.
- Existing D-001 through D-016 remain unchanged. Contract Freeze and Subscription Production readiness remain BLOCKED.


### v1.3 — 2026-11-27 (evidence-only clarification; no new owner selection)
- Added OPEN item 12 and a source-linked worksheet for the permanent Fixed/Recurring Lifecycle Registry rent funding and recovery decision.
- Separated the non-closeable lifecycle tombstone from the separately closeable Fixed/Recurring delegation account and distinguished both from the already implemented Authority Consent Registry / closeable Authority rent behavior.
- Recorded subscriber-funded and approved external-sponsor-funded models as unselected alternatives, plus the required excess-rent, separate fee-payer, refund, consent-disclosure and no-sponsor-control invariants.
- No payer, sponsor model, rent amount, recovery promise, Program field, account-meta position, PDA seed or ABI was selected. This amendment does not authorize implementation, billing, DB/API work, Production mutation or any on-chain action.
