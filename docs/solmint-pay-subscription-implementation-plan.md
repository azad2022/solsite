# SolMint Pay — Subscription Billing Implementation Plan

Date: 2026-10-30  
Repository: `azad2022/solsite`  
Working branch: `feat/pay-subscription-billing`  
Base main SHA: `7b975d56860b6d937ad76ab2983c71937644dfa3`  
Reviewed source branch SHA: `b464efef66c394adae6249032f9b45d1d71dd5e8`  
Status: **Part 2.1 SDK/runtime compatibility PASS; Stage 2 remains BLOCKED on Mainnet ProgramData evidence and contract freeze. Subscription product/backend lifecycle is NOT IMPLEMENTED.**  
This is an implementation plan and a set of gates, not an API/schema contract, security approval, or release authorization.

## 1. Current verified baseline

### Repository
- The current feature branch contains a server-side Plan policy helper with unit tests and an isolated SDK compatibility harness (pinned SDK package, typed Kit→web3 adapter, pinned-IDL golden fixtures, local Pages/Workerd runtime test and non-mutating Devnet simulation). It still has no Subscription API route/domain lifecycle, migration/schema, billing worker, Collector implementation, dedicated verifier/accounting adapter, or UI. The root application package remains without direct `@solana/kit` or `@solana/subscriptions` dependencies.
- Existing foundations include Pay merchant identity/RBAC, verified merchant wallets, Payment Intent creation, fee snapshots, ordinary payment reconciliation, token asset policy, transaction/transfer observations, accounting, webhook delivery, idempotency, and Devnet E2E.
- The normal payment verifier is not a Subscription verifier. Keep it unchanged.

### Production database (read-only observation)
Project `nvopkbiedorfshwbmyhn` was reachable and reported healthy; PostgreSQL is 17.6.1.147.
- 33 `public.pay_*` base tables; RLS enabled on all 33; FORCE RLS on 0.
- Direct `authenticated` SELECT on 20 Pay tables; direct `anon` SELECT on 0; `service_role` has mutation privileges on all 33.
- The 106-entry migration ledger ends at `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- Read-only schema searches found no Subscription, Billing Cycle, Consent, or Collector application table/routine.
- RLS being enabled is not proof that every route, grant, policy, SECURITY DEFINER function, or service-role call is secure. New Subscription access needs server authorization and disposable-DB adversarial tests.

### Existing verifier constraint
The live `public.pay_apply_verified_observation` routine is SECURITY DEFINER with an empty search_path and is callable by `service_role` (and postgres). The ordinary Pay verification/accounting path enforces the normal payment's transfer/source-authority and fee-payer relationship and rejects sponsored gas observations. Subscription uses a shared `SubscriptionAuthority` PDA for token delegation while the Collector/Plan Owner signs and pays transaction fees as a separate caller. This is a different trust and accounting contract. Do not loosen or bypass the ordinary verifier.

### External Program/SDK
The pinned research target is upstream Program tag `program-v0.5.0` and SDK tag `ts-client-v0.5.0`, Program ID `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- The Cantina audit baseline is `d6b3a5dc7ab18c4168441af733c81ab0a599d414`; fixes are stated upstream through `debb4f75ff7571218b39de3b633074dd843e70db`. Release commit `364a41976c33347d092902443bbec2def9227e75` is eight commits later. Full release delta audit coverage is not established.
- Upstream Changelog reports target Mainnet deployment 2026-08-10 and labels the deployed binary/IDL `0.5.0-beta.1` from release commit `364a419`. This is an upstream statement, not independent live ProgramData evidence.
- SDK `@solana/subscriptions@0.5.0` peers on `@solana/kit ^7.0.0`; current SolMint uses `@solana/web3.js@1.99.0` and has no Kit/Subscriptions SDK dependency. A deliberate adapter and bundle/runtime compatibility test are required.
- Cantina PDF has now been fully reviewed; see the `Full Cantina report and SDK review follow-up` section below for the complete finding matrix and residual-risk decisions. ProgramData, actual deployed binary hash/source match, upgrade authority, deployment slot, cluster, and exact live on-chain IDL remain **UNKNOWN**.

## 2. V1 safety profile

These are conservative implementation constraints, not claims that current SolMint code enforces them:
1. Only currently configured original SPL Token assets supported by Pay (currently USDC/USDT). No native SOL subscription, Token-2022, TransferHook, or MemoTransfer support in v1.
2. Period is the Program's fixed number of hours (1–8760). Do not market it as a calendar month. If product wording says 30 days, the contract is 720 hours.
3. Plans must contain a non-empty explicit destination-owner allowlist. Validate Mint, Token Program, source ATA, destination token-account owner, ATA derivation, and asset decimals against the server snapshot.
4. Merchant's actual Plan Owner wallet signs Plan creation and remains an implicit Puller. Collector is an additional allowlisted Puller, never a fabricated Plan Owner. Include every authorized Puller in reconciliation.
5. Customer signs Authority initialization and Subscribe as two separate recent-blockhash transactions. Confirm initialization, fetch the actual `init_id` from the derived Authority PDA, then build Subscribe against that value. Reject `UNKNOWN_INIT_ID`; never bundle Init+Subscribe in production.
6. No Durable Nonce or unresolved smart-wallet/multisig proposals in v1 consent/control paths. Recent-blockhash expiry, cancellation of a pending proposal, and revocation are distinct states.
7. Do not enroll in a finite Plan with less than one full period remaining. Do not assume the Program prorates a partial first period.
8. No sponsored Plan rent by default. No Collector private key in public Pages/browser runtime; use an independently isolated signing boundary with audited permissions, rotation, emergency disable, and recovery.
9. No service entitlement/renewal until finalized transaction verification and atomic accounting commit.
10. Split principal + gateway fee remains **BLOCKED** until same-transaction multi-instruction behavior is proven in LiteSVM and Devnet, with dedicated verification and accounting tests.

## 3. Target domain boundaries

Keep these concepts separately modeled and separately auditable:
- Merchant Plan definition and immutable on-chain terms snapshot.
- Customer wallet consent and its actual signed transaction evidence.
- On-chain Plan PDA, SubscriptionDelegation PDA, SubscriptionAuthority PDA, token delegate and token account state.
- Commercial Subscription lifecycle and entitlement.
- Billing Period/Cycle using the on-chain period-start and cumulative amount.
- Billing Attempt, claim/lease, submission, ambiguous outcome and retry/reconciliation.
- Collector authorization/signing, transaction and signer-key version evidence.
- Blockchain transaction/transfer observations and independent Subscription verification.
- Merchant principal, gateway revenue/referral liability/network cost/refund accounting.
- Webhook/event outbox and delivery state.

Do not represent Subscription as a recurring Payment Intent, metadata-only relationship, or a single boolean/status. The existing one-off Payment Intent contract remains for one-off checkout unless a separately reviewed typed relation is justified. Do not synthesize Payment Intent IDs to satisfy existing ledger foreign keys.

## 4. Expected transaction and billing flows

### Merchant Plan setup
- Resolve the merchant through the existing Better Auth → application user → internal JWT identity bridge and current merchant membership/RBAC.
- Resolve the actual active, verified receiving wallet from the existing merchant wallet boundary. The corresponding wallet must sign as Plan Owner; no backend key may impersonate it.
- Snapshot the approved Mint/Token Program/decimals, amount, hours, end time, merchant destination owner and fee destination (if approved), puller addresses, and the merchant fee policy from authoritative backend settings.
- Ensure the destination allowlist is non-empty and within the Program's fixed account capacity. The customer's consent must later display the exact snapshot.
- Build/sign/submit Plan creation through a wallet-mediated flow and independently read back the finalized Plan PDA before marking the Plan usable.

### Customer consent
- Read the actual finalized Plan and validate it against the backend terms snapshot before preparing consent.
- Read the customer ATA's owner, mint, delegate, frozen/amount state and verify its canonical derivation. Clearly disclose if the Program initialization will replace an existing SPL Token delegate.
- Prepare and submit Authority initialization alone. Reconcile timeout/unknown submission; do not issue another initialization or Subscribe while unresolved.
- After confirmation/finality per the configured policy, fetch and validate the derived Authority PDA and its actual `init_id`.
- Independently prepare Subscribe with the customer's signature and that actual `init_id`; verify the resulting SubscriptionDelegation PDA and immutable terms snapshot.
- A submitted signature is only pending evidence, never active consent until independent chain verification succeeds.

### Billing and Collector
- Scheduler/queue is only a wake-up mechanism. Atomically claim a cycle keyed by the Subscription identity and actual on-chain period start; persist a durable Attempt before network/signing work.
- Reconcile chain state and all prior Pulls first, including the implicit Plan Owner and all configured Pullers. Verify remaining per-period capacity and live collectability (delegate, source ATA, mint/program, frozen state, balance, destination eligibility).
- Build only the exact pinned Program instruction(s) for the known Plan/Subscription/Customer/Mint/destination/amount. Reject arbitrary caller-supplied transaction bytes and unexpected instructions/accounts.
- The isolated Collector signs only a server-created, policy-checked Job. Its public key must be an allowed Plan Puller. Transaction fee payer identity is distinct from the source token delegate authority.
- Never hold a database transaction/row lock over RPC or signing. Use short atomic claim/finalize operations and fencing/lease tokens.
- After timeout/restart, reconcile the original signature/message/blockhash/chain state. Unknown is not Failed and not Retryable; never create a second debit while the first may have landed.

### Discovery and verification
- Detect Pulls from Collector and non-Collector authorized Pullers. A Collector-only signature table is insufficient.
- Candidate discovery (including account-signature scans or program events) is not proof. Persist cursor/scan coverage and reconcile raw finalized transaction data and current Program account state.
- Verify cluster, Program ID, instruction discriminator/layout/accounts, PDA derivations/ownership, Subscriber, Plan Owner/Puller, source ATA and SubscriptionAuthority, Mint/Token Program/decimals, destination owner/ATA, exact amount legs, period allowance, finality, transaction success, and absence of unexpected transfers/instructions.
- Decode Program events as supporting evidence only. Verify actual token movement, transfer/balance evidence, and on-chain SubscriptionDelegation period-start/cumulative usage.
- Commit verified observation, Attempt/Cycle outcome, merchant settlement, fee/revenue/referral/gas records and durable event outbox atomically. Only then may the backend grant/renew service or emit a payment-success webhook.

## 5. Accounting and fee decision boundary

Existing Pay stores merchant fee basis points, fee payer policy, recipient and settlement snapshots and has integer-only fee calculation. Reuse those authoritative inputs only after designing the Subscription snapshot/ledger mapping. Do not accept client-supplied fee recipients or calculate financial truth in the browser.

The upstream `TransferSubscription` instruction has one destination and one amount. A principal/fee split therefore requires separate instructions in the same atomic Solana transaction and both destination owners must be in the Plan allowlist. Although the Program updates cumulative period usage within the instruction, the exact multi-instruction behavior, second-leg rollback, duplicate/extra instruction rejection and event/balance mapping are not yet proven by SolMint tests. Keep split-fee collection blocked until:
- LiteSVM test proves both legs share one cumulative period allowance.
- An over-limit/invalid second leg rolls back the first transfer and state.
- Extra, reordered, duplicated, wrong-mint, wrong-destination or unrelated transfers are rejected by the SolMint verifier.
- The dedicated DB commit creates exactly one correct financial outcome and cannot double-book either leg.
- Devnet E2E and independent review pass.

Do not repurpose the existing one-off `pay_revenue_ledger` / `pay_merchant_ledger` by fabricating payment IDs. Design a typed Subscription/Cycle source and atomic accounting relation after reviewing the full existing schema, constraints, triggers, referral logic and event delivery model.

## Phase 2 — Program assurance and contract freeze review (2026-10-30)

Status: **BLOCKED — isolated SDK runtime compatibility is PASS; Stage 2 remains open on Mainnet ProgramData assurance and API/DB/RBAC/Consent/Accounting contract freeze. No Production DDL or customer-facing Subscription enablement is authorized.**

### Exact upstream pins and audit delta
- Program tag `program-v0.5.0` resolves to commit `364a41976c33347d092902443bbec2def9227e75`.
- SDK tag `ts-client-v0.5.0` resolves to commit `5a347ffaa969036061d274d3c91e0277962e2b51`; it is not the same commit as the Program tag.
- Program ID in source: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- Upstream audit status identifies Cantina baseline `d6b3a5dc7ab18c4168441af733c81ab0a599d414` and remediation verified through `debb4f75ff7571218b39de3b633074dd843e70db`.
- Baseline-to-release comparison is 15 commits and includes Rust program source/instruction changes, IDL, SDK and tests. The narrower post-remediation comparison is 8 commits / 21 paths and contains release workflow/toolchain, dependency/lockfile, README/changelog/audit-status, the Cantina PDF, SDK package/changelogs/tests, IDL and demo webapp changes; it does **not** list `program/src/**` paths. This supports only a file-level statement about the post-remediation delta; it does not prove the report's findings were fully resolved or that the deployed binary matches the tag.
- Historical note: during the initial source-only checkpoint the PDF text was not available through GitHub/web readers. That limitation was resolved after the user added the PDF to Project resources; the full report has now been read and its findings/remediation/residual risk are mapped in the `Full Cantina report and SDK review follow-up` section below. This supersedes the earlier **NOT REVIEWED** status.

### Program source facts verified at the pinned tag
- `TransferSubscription` discriminator 10 requires the transaction caller to sign, checks `Plan::can_pull` (Plan Owner or one of the additional Pullers), checks the receiver token-account owner against the Plan destination allowlist, validates the subscription terms and period limit, then performs the delegate transfer and emits an event.
- Plan capacity is four destination owners and four additional Pullers; Plan Owner is implicitly allowed. An all-zero destination list is open to any receiver, so SolMint must continue requiring a non-empty allowlist.
- Plan periods are whole hours, 1–8760; Plan terms snapshot amount/period/created_at into SubscriptionDelegation.
- `Subscribe` binds the signed request to expected Mint, amount, period, Plan created_at and SubscriptionAuthority `init_id`; it verifies the PDA and rejects an existing Subscription.
- Program source supports SPL Token and Token-2022. SolMint's proposed V1 restriction to server-configured original SPL USDC/USDT is a deliberate narrower product policy, not an upstream Program limitation.
- Upstream README documents unresolved signed-transaction hazards: held Init+Subscribe using `UNKNOWN_INIT_ID`, pending durable-nonce or smart-wallet proposals, held authority-control transactions, same-period Resume replay, second-granular immediate-cancel replay, UpdatePlan ABA, and full-period charge near finite Plan expiry. These risks have now been mapped to Cantina findings and remediation commits in the `Full Cantina report and SDK review follow-up` section below.

### SDK compatibility finding

- SDK package `@solana/subscriptions@0.5.0` is a Kit-v7 plugin with peer dependency `@solana/kit ^7.0.0`; SolMint's production application continues to use `@solana/web3.js@1.99.0`.
- The isolated harness pins SDK `0.5.0`, Kit `7.0.0`, web3.js `1.99.0`, Node `24`, Wrangler `4.156.0`, and a committed npm lockfile. It does not add Kit/Subscriptions dependencies to the root browser dependency graph.
- Exact feature HEAD `b464efef66c394adae6249032f9b45d1d71dd5e8`, PR #366, CI run `41096334615`: exact-head checkout, committed-lockfile reproducibility, `npm ci`, TypeScript adapter compile, SDK/PDA/IDL/Upgradeable Loader parser tests (16/16), local Pages/Workerd execution (1/1), and dedicated Devnet non-mutating CreatePlan simulation (1/1) passed. Root quality passed. The same CI run's `subscription-reproducible-build` job built the pinned upstream source commit `364a41976c33347d092902443bbec2def9227e75`, verified the `solana-verify 0.5.2` release binary checksum and pinned Docker image digest, computed the executable hash and uploaded artifact `12995278872`. The separate Mainnet ProgramData job failed before RPC because `secrets.SOLANA_RPC_URL` was not available. Separate workflows on this feature code SHA passed: Production Build `41096334572`, Database Security `41096334646`, ordinary Pay Mainnet-read-only smoke `41096334567`, and ordinary Pay Devnet E2E `41096334550`. Ordinary Pay Devnet E2E is separate from Subscription simulation.
- The golden fixture provenance was independently checked against upstream `program-v0.5.0` commit `364a41976c33347d092902443bbec2def9227e75`; its IDL blob SHA `208718e90bf9f8e7f42271b6e93284109b118172`, Program ID and version `0.5.0-beta.1` match the fixture. The tested instruction scope is InitSubscriptionAuthority, CreatePlan and Subscribe; tested PDA scope is Plan, SubscriptionAuthority and Subscription.
- **Decision: PASS for bounded SDK/runtime compatibility.** Kit instruction builders convert to web3.js with byte/account-meta parity; Node 24 and local Pages/Workerd execute the tested fixture; Devnet simulation validates the pinned Program is executable on Devnet and accepts the synthetic CreatePlan instruction without signing or submitting. This is not proof of the Mainnet deployed binary, all SDK instructions, production Backend integration, wallet signing, Collector custody, verification, accounting or full Subscription lifecycle.
- Keep the adapter isolated until the Subscription API/DB contract and deployment boundary are approved. Do not add Kit dependencies to the browser bundle. The ordinary Pay verifier remains unchanged.

### Proposed contract invariants (design constraints, not API/schema contracts)
1. Separate Plan definition/version, immutable on-chain terms snapshot, customer consent evidence, commercial Subscription, on-chain PDAs/token delegate, Billing Cycle, Attempt, Collector authorization/signing, chain verification, accounting and entitlement.
2. Plan Owner remains an implicit Puller. Collector must be a separate, explicitly allowed Puller and fee payer; never impersonate Plan Owner.
3. Init Authority and Subscribe are separate recent-blockhash wallet transactions. Reconcile Init, read actual on-chain `init_id`, then sign Subscribe with that value. Reject `UNKNOWN_INIT_ID` and unresolved durable-nonce/smart-wallet proposals for V1.
4. Cycle identity uses live on-chain `current_period_start_ts` and cumulative usage, not calendar-month math or scheduler time. Unique DB cycle identity and atomic claim remain mandatory.
5. Active on-chain state does not grant entitlement. Require live collectability and finalized transfer verification followed by atomic accounting commit.
6. Ordinary `pay_apply_verified_observation` remains unchanged. Subscription requires a dedicated verifier/accounting boundary for PDA source authority and separate Collector fee payer.
7. Split principal + gateway fee remains BLOCKED until same-transaction cumulative allowance, rollback, duplicate/extra instruction rejection, dedicated verification/accounting and Devnet behavior are proven.
8. V1 remains original SPL Token only with server-configured supported mints, non-empty destination owner allowlist and no TransferHook/Token-2022/MemoTransfer support unless separately reviewed.

### Remaining Stage 2 gates

- **PASS:** full Cantina PDF review and finding-by-finding residual-risk mapping; pinned Program/SDK source and release-delta review; bounded SDK runtime compatibility on exact feature HEAD (Node 24, committed lockfile, TypeScript adapter, 16 SDK/PDA/IDL/loader-parser tests, Pages/Workerd and non-mutating Devnet CreatePlan simulation).
- **PASS:** reproducible source build of pinned upstream Program commit `364a41976c33347d092902443bbec2def9227e75` with `solana-verify 0.5.2`, verified CLI checksum and Docker image digest `sha256:f71be5ca7620b7e40933b7f1294fa44e01d08c1fc5ba1f375a2478f5a01580d3`; executable hash artifact `12995278872` was uploaded.
- **BLOCKED:** approved read-only Mainnet Program/ProgramData evidence. The deployed ELF comparison probe failed at secret preflight because GitHub Actions did not receive `secrets.SOLANA_RPC_URL`; no Mainnet RPC request was made. Cloudflare Pages project `solsite` Production environment reports `SOLANA_RPC_URL` as `secret_text`, but its value was not read or exposed. Add the same approved Helius endpoint as a GitHub Actions repository secret named `SOLANA_RPC_URL`, without sharing the value in chat.
- The existing `solmint-pay-mainnet-readonly` workflow still hard-codes the public Mainnet RPC and is only an ordinary Pay parser/provider smoke. It is not ProgramData evidence and must not be repurposed as a Production RPC fallback.
- The official upstream Program is Pinocchio/Codama-based. The inspected `runbooks/deployment/main.tx` deploys the program binary; `.github/workflows/idl-check.yml` checks generated IDL files. No explicit on-chain IDL publication step was found in those inspected paths. Do not assume an Anchor IDL PDA exists; actual on-chain IDL publication/identity remains **UNKNOWN** until independently established.
- Reconcile the deployed `0.5.0-beta.1` label with Program tag `0.5.0`, release commit `364a419...`, and exact live ProgramData/binary evidence.
- Complete typed lifecycle transition table and freeze API/DB/RBAC/Consent/Accounting contracts only after deployed Program identity is confirmed and the current schema/migration/RLS/grant baseline is revalidated.
- Actual production Backend adapter integration, Subscription domain/API/schema, dedicated verifier/accounting, Collector signer boundary and Subscription lifecycle E2E remain **NOT IMPLEMENTED**; they are downstream implementation work, not established by the isolated compatibility harness.

No Production RPC configuration, Program state, database schema, secret/key, SDK dependency, API, migration, Collector or customer consent was changed in this review.

## 6. SDK, RPC and environment requirements

- Pin exact Program source/tag, IDL, SDK, toolchain, lockfile and transitive dependencies. Never follow upstream main.
- **Completed bounded evaluation:** official Kit-v7 SDK builders and typed Kit→web3.js adapter are tested in the isolated harness. Keep generated builders/decoders and exact IDL fixtures pinned; production integration still requires the approved Backend/DB contract and must not enter the browser bundle.
- Production Mainnet and Devnet RPC must be explicitly separate. No public-RPC fallback in production. The existing generic Mainnet-read-only workflow currently points to the public Solana endpoint; it is not proof of configured production RPC/Program deployment and must not be repurposed as a fallback.
- Read-only Mainnet inspection must establish cluster/genesis identity, Program account and ProgramData, deployed executable hash, upgrade authority, deployment slot, on-chain IDL/version, and reproducible source match. No Mainnet transaction or mutation is part of validation.

## 7. Implementation sequence and acceptance gates

1. **Close research blockers:** read/render all pages of the Cantina PDF; review the full source/IDL/SDK delta; SDK runtime compatibility is now PASS; independently verify Mainnet ProgramData and deployed IDL.
2. **Contract design:** domain lifecycle/state-transition table; merchant/customer authorization; wallet consent; Plan/Subscription read models; idempotency, cycle identity, claim/lease and Attempt recovery; event/outbox; fee and ledger mapping. Review against current schema before naming/creating tables or routes.
3. **Database/API foundation:** source-controlled migration, exact constraints/indexes, RLS and Grants; server-mediated APIs; no customer or Collector privilege escalation; disposable PostgreSQL tests including cross-merchant/customer adversarial cases. Production DDL is prohibited until issue #355 provenance is resolved and an explicit APPLY authorization is given.
4. **Program adapter:** pinned SDK/client and web3.js conversion; exact PDA/IDL validation; separate Init/Subscribe; Plan lifecycle; transaction construction and read-only parser tests.
5. **Collector/verification/accounting:** isolated signing service, key custody and rotation; external-puller discovery/reconciliation; dedicated Subscription verifier; atomic ledger and outbox; timeout/restart/replay concurrency tests.
6. **Adversarial and Devnet:** all Skill test cases including delayed signatures, same-slot init_id, stale Cancel/Resume/Plan update, owner pulls, shared allowance multi-leg, token account delegate/ATA failure, duplicate cycles, ambiguous RPC and cross-tenant RLS; then real Devnet E2E with isolated wallets/database.
7. **Frontend:** only after real contracts pass; dashboard/checkout/consent/cancel/portal UIs reflect backend-authoritative states and exact immutable terms. fa-IR/en-US/ar/ru, RTL/LTR and accessibility required.
8. **Release:** CI, production build, deployment of exact reviewed SHA, API and runtime smoke, rollback evidence, complete Release Audit. Mainnet changes, Production DDL, signing-key creation/rotation and customer-live consent require separate explicit approval.

## 8. Current blocking decision

- **PASS (bounded):** pinned SDK/runtime compatibility proof on exact feature HEAD, including deterministic lockfile, TypeScript Kit→web3 adapter compile, 16/16 SDK/PDA/IDL/Upgradeable Loader tests, local Pages/Workerd execution and non-mutating Devnet CreatePlan simulation; successful reproducible build and executable-hash generation for pinned upstream Program source.
- **BLOCKED:** Mainnet deployed ProgramData/ELF comparison because GitHub Actions does not currently receive the approved `SOLANA_RPC_URL` secret.
- **BLOCKED:** Stage 2 overall until approved Mainnet ProgramData/deployed binary/upgrade authority/deployment slot/on-chain IDL evidence and the typed API/DB/RBAC/Consent/Accounting contract freeze are complete.
- **NOT IMPLEMENTED:** production Subscription routes/domain/schema/migrations, Billing Engine, isolated Collector signer, dedicated verifier/accounting adapter, adversarial lifecycle tests and UI.
- **BLOCKED:** Production DDL until issue #355 migration-runner provenance is resolved and explicit APPLY is authorized.
- **BLOCKED:** split-fee billing until LiteSVM/Devnet atomic multi-leg proof and dedicated accounting/verifier tests pass.
- **UNKNOWN:** live Mainnet ProgramData, binary/source match, upgrade authority, deployment slot, on-chain IDL identity, approved Mainnet RPC availability and local Working Tree state.
- The isolated SDK harness does not certify production readiness and does not authorize live customer consent, Collector signing, Mainnet mutation, or Production schema changes.

No Production schema, secret, key, runtime setting, Program state, Mainnet/Devnet Subscription transaction, merchant money or customer consent was changed by this checkpoint.

## 2026-10-30 — Full Cantina report and SDK review follow-up

Repository: `azad2022/solsite`  
Branch: `feat/pay-subscription-billing`  
Source-reviewed HEAD: `c11acab73c92ed3a8341d35b2549cd56e264cb89`  
PR #366: OPEN / DRAFT / NOT MERGED.  
Status: **Stage 2 BLOCKED; no Stage 3/4/5 work started.** This entry supersedes earlier statements in this document that the Cantina PDF had not yet been read.

### Cantina report — complete finding matrix

Reviewed the complete 12-page file `report-cli-cantina-a1f6fc40-7817-446d-bb88-abd0f2b96106-2026-07-30-solana-foundation-subscriptions.pdf` (report date 2026-07-30; audit baseline `d6b3a5dc7ab18c4168441af733c81ab0a599d414`). The report summary records 9 findings: 0 Critical, 1 High, 5 Medium, 2 Low, 0 Gas, 1 Informational; aggregate remediation tally: 4 Fixed and 5 Acknowledged. The tally maps to 3.2.1 (partial mitigation), 3.2.2, 3.3.1 and 3.4.1 as Fixed/Mitigated; 3.1.1, 3.2.3, 3.2.4, 3.2.5 and 3.3.2 are Acknowledged. Cantina says its holistic follow-up at `debb4f75ff7571218b39de3b633074dd843e70db` found all findings addressed and no new vulnerabilities. “Addressed” includes accepted/documented residual risks; it does not mean each recommendation was implemented as a code fix.

**Scope caveat:** the report's initial 2026-07-24/25 scope list is limited to `program/src/constants.rs`, `program/src/instructions/create_plan.rs`, helpers `plan.rs`, `system.rs`, `transfer_utils.rs`, and `program/src/state/header.rs`. Some finding contexts reference other instruction files. The later holistic review at `debb4f75` is an additional assurance statement, but neither the report nor that statement proves that the deployed Mainnet ELF is byte-for-byte that source.

| Finding | Severity | Report disposition / code evidence | Residual risk and SolMint V1 constraint |
|---|---|---|---|
| 3.1.1 Old signed creates restore revoked permissions | High | Solana Foundation: Acknowledged; Cantina: Acknowledged. Documentation change `7ffef203`; no persistent consent epoch/action nonce/tombstone/deadline was added to the Program. | High-risk delayed signed action remains a protocol limitation. V1 must reject `UNKNOWN_INIT_ID`, separate Init and Subscribe, use recent blockhash only, prohibit durable nonce and unresolved smart-wallet/multisig proposals, never retain pending signed approval bytes, and reconcile/expire every operation. These are operational controls, not a Program-level fix; same-PDA stale signed creation remains a bounded residual. |
| 3.2.1 Stale CancelSubscriptionNow approvals cancel a recreated subscription | Medium | Partial mitigation (included in Cantina's aggregate Fixed count): `expected_current_period_start_ts` was added in `d4b29e80e2b3db3fc5cd449ffb7b563055644d51`; Cantina says differing-timestamp replays are prevented. | Same-second recreation remains replayable and is explicitly acknowledged/documented as residual risk. Do not retain unsubmitted dual-signed cancellation transactions; use short-lived recent blockhash flows and test same-second boundary behavior. |
| 3.2.2 Stale UpdatePlan approvals restore removed pullers | Medium | Fixed and Cantina Verified at `653dec58206bd2819cd88b934e0862a94be075a3`; instruction now checks expected `created_at`, `end_ts`, puller set and metadata. | Current README documents an ABA residual if mutable state changes away and is later restored to the exact previously observed values; no monotonic plan revision/deadline is present. V1 must refresh plan state before every owner update and never leave signed updates pending. |
| 3.2.3 Stale Resume approvals undo a later cancellation | Medium | Acknowledged/documented in `67ad7173ae7b61855e5cdcfd9f473d364565c603`; current instruction binds `expected_expires_at_ts`. | Two cancellations within one billing period can have the same expiry, allowing a held Resume to clear the later cancellation. V1 must not keep signed Resume transactions outstanding; the same-period residual remains. |
| 3.2.4 Stale authority-control approvals restore or destroy authority state | Medium | Acknowledged/documented in `689cbbfdd2311518b379a13ebeccc8d192dfbcbe`; current Init/Close/Revoke instructions do not bind a persistent authority epoch, action nonce or validity deadline. `InitSubscriptionAuthority` can re-Approve `u64::MAX` when the Authority PDA already exists. | A held Init can re-enable the delegate after direct ATA delegate revocation; held Close/Revoke can affect a later authority generation at the same PDA. V1 must block implicit reauthorization, disallow direct/manual delegate revocation as an app workflow, distinguish authority-wide revoke from one-subscription cancel, and never keep control transactions pending. |
| 3.2.5 Full-period charge at finite Plan expiry | Medium | Acknowledged/documented in `37986eb472d58877bc75c07b368748b6cf93e321`; current `SubscribeData` does not bind `end_ts`, and Subscribe permits `current_ts == end_ts` while creating the full amount allowance. | A full amount can be collected for a partial or zero-length first window; an owner can shorten `end_ts` after consent. V1 must reject enrollment unless at least one full period remains at preparation and immediately before submission, disclose fixed-period/non-prorated terms, and document the remaining race because the Program does not bind `expected_end_ts`. |
| 3.3.1 Optional CreatePlan payer absent from IDL/generated clients | Low | Fixed at `11173179605e3b7339f11a4e0b633b1ad0281e48`; Cantina Verified. | No open finding remains from this item in the reviewed release source/IDL. Keep IDL and generated client freshness as a release check. |
| 3.3.2 Automatic rent sponsorship can lock relayer funds | Low | Acknowledged/documented in `0ac23b9f7e53449874c59aecbc25a3efbddcb489`; SDK still defaults a distinct `client.payer` into optional creation payer accounts. | The README clarification is not an explicit sponsorship opt-in or enforceable recovery rule. V1 disables rent sponsorship: explicitly set payer to the user for user-owned accounts; merchant funds its Plan; Collector only pays network fee. |
| 3.4.1 IDL generation failure does not fail release | Informational | Fixed at `1b6e98e55fd5191b374bd00fe5128df874d36cd`; `program/build.rs` now returns `generate_idl()` errors to Cargo rather than swallowing them as warnings. | Preserve fail-closed IDL generation and require generated-IDL/client comparison before release. |

### Source and remediation cross-check

- Program tag `program-v0.5.0`: `364a41976c33347d092902443bbec2def9227e75`. Cantina baseline → remediation comparison: 7 commits. Remediation → Program release comparison: 8 commits / 21 paths and no `program/src/**` files in that later delta. This supports that Program Rust sources at the pinned release are unchanged after the Cantina follow-up commit; it does not establish the deployed binary is this build.
- The source review confirmed `initialize_subscription_authority.rs` approves the shared authority delegate for `u64::MAX`; Init is idempotent and re-approves when the authority PDA already exists. `revoke_subscription_authority.rs` revokes the current derived delegate and closes the authority. Neither control instruction binds a persistent epoch/deadline. `SubscribeData` binds mint/amount/period/Plan created_at/authority init_id but not Plan end_ts. `TransferSubscription` validates the caller as Plan Owner or additional Puller, validates the destination owner against the Plan allowlist, checks period allowance and transfers through the shared delegate.
- Current Program source confirms the medium residuals: CancelNow binds to second-granular `current_period_start_ts`; Resume binds to `expires_at_ts` but same-period cancellations may collide; UpdatePlan uses expected current values but has no monotonic revision; near-expiry Subscribe remains non-prorated. These are explicit v1 threat-model constraints.
- `program/build.rs` on the pinned release propagates IDL generation errors. The generated optional CreatePlan payer is present in the IDL fix. SDK plugin behavior remains auto-sponsor-sensitive; it must not be used with a separate payer unless the caller explicitly intends rent sponsorship.

### SDK tag and compatibility review

- `ts-client-v0.5.0` resolves to `5a347ffaa969036061d274d3c91e0277962e2b51`, three commits after Program tag commit `364a419...`. The compare lists 10 changed release/metadata paths; no `program/src/**` or TypeScript plugin source path changed in this three-commit SDK release delta.
- Program tag's workspace/IDL version is `0.5.0-beta.1`; SDK tag package and IDL version are `0.5.0`. The two IDL JSON files are byte-equivalent after replacing only the program `version` string; instruction/account schema is otherwise identical. SDK changelog states that SDK `0.5.0` matches `program-v0.5.0`; this remains to be reconciled against live ProgramData.
- Exact compatibility proof is recorded in the earlier `SDK compatibility finding` section and the progress ledger: pinned package graph, committed lockfile, Node 24, TypeScript adapter compile, SDK/PDA/IDL golden tests, Pages/Workerd and non-mutating Devnet simulation all passed on exact feature HEAD.
- **Compatibility result: PASS (bounded test scope).** The tested adapter is isolated and is not a production Backend route or Collector signer. No root Kit/Subscriptions dependency was added to the browser application. Mainnet ProgramData, live on-chain IDL and production Backend integration remain separate open gates.

### ProgramData proof and Mainnet workflow finding

- The existing `.github/workflows/solmint-pay-mainnet-readonly.yml` hard-codes `https://api.mainnet-beta.solana.com`; its test reads ordinary finalized System Program transactions and exercises the existing Pay parser. It does not query the Subscription Program account, ProgramData account, deployment slot, upgrade authority, executable bytes, verified source or on-chain IDL. It is only a public-RPC Pay provider smoke.
- Cloudflare Pages project `solsite` Production environment metadata confirms a variable named `SOLANA_RPC_URL` with type `secret_text`. Only its name/type were inspected; the secret value was not retrieved, logged or changed.
- A dedicated read-only Mainnet ProgramData probe now exists under `tools/subscription-sdk-compat/test/mainnet-programdata.test.mjs`, with a pure Upgradeable Loader parser and unit tests. It allows only `getGenesisHash` and `getAccountInfo`, verifies Mainnet genesis, Program executable/loader owner, loader-derived ProgramData PDA, ProgramData owner, deployment slot, upgrade authority and ELF SHA-256. It writes sanitized metadata only; it never logs the RPC URL/API key or raw ProgramData bytes.
- Exact-head CI run `41096334615` on `b464efef66c394adae6249032f9b45d1d71dd5e8`: SDK compatibility and root quality **SUCCESS**; 16 offline SDK/PDA/IDL/loader parser tests, Workerd and Devnet simulation passed. Pinned upstream source build and executable-hash generation also **SUCCESS**, artifact `12995278872` was uploaded. The separate `subscription-mainnet-programdata` job failed before RPC because GitHub Actions did not provide `secrets.SOLANA_RPC_URL`; therefore **no Mainnet ProgramData query occurred**, and the deployed Program account/ProgramData, slot, upgrade authority, ELF hash and Mainnet cluster identity remain **UNKNOWN**.
- The same exact-head workflow set also completed Database Security, ordinary Pay Devnet E2E, ordinary Pay Mainnet-read-only smoke and Production Build successfully. The ordinary Pay Devnet workflow is a separate funded mutating test of existing Pay flows; it is not Subscription E2E. The Subscription Devnet simulation is non-mutating.
- Upstream Program source identifies Pinocchio and Codama IDL generation. The inspected deployment runbook `runbooks/deployment/main.tx` deploys the binary; the inspected `.github/workflows/idl-check.yml` checks generated files. No explicit on-chain IDL publish operation was found in those paths. Do not assume Anchor IDL storage; whether an on-chain IDL is published remains **UNKNOWN**.
- Required sanitized artifact after an approved Mainnet read-only run: cluster/genesis identity; Program ID and owner/loader; executable flag; ProgramData address; deployed slot; upgrade authority or null; ELF byte length and SHA-256; reproducible `solana-verify` match to the exact upstream commit/toolchain; and a documented determination of whether an on-chain IDL exists and, if so, its bytes/hash. The RPC URL/key must never appear in logs or uploaded artifacts.

### Contract freeze decision

**Frozen as architecture/security invariants only (not DB/API schema):** separate Plan definition and immutable on-chain terms; customer Consent; Authority and Subscription PDAs; commercial Subscription; Billing Cycle/Attempt; Collector; independent chain verification; atomic accounting; entitlement/outbox. Plan Owner is implicit Puller; Collector is an additional explicit Puller and separate fee payer; all Pullers must be reconciled. Init and Subscribe remain separate recent-blockhash transactions and Subscribe uses the actual observed `init_id`; no `UNKNOWN_INIT_ID`, Durable Nonce or unresolved smart-wallet proposal in V1. Cycle identity comes from on-chain `current_period_start_ts` and cumulative usage. `Active` never grants entitlement; finalized independent transfer verification plus atomic accounting is required. Keep ordinary Pay verifier unchanged and build a dedicated Subscription verifier/accounting boundary. V1 is original SPL Token only, approved configured mint(s), non-empty destination owner allowlist, no rent sponsorship, no Token-2022/TransferHook/MemoTransfer, and no split principal+gateway-fee transfer until atomic same-transaction tests pass.

**Not frozen:** API routes/payloads, SQL table/column/state names, RBAC grants, exact entitlement/grace/retry policy, gateway fee model, split-fee mechanics, Collector key custody, and deployed Program/IDL binding. These require ProgramData proof and later backend/database contract design against the current schema. No APIs/tables/fields/roles/fees were invented in this checkpoint.

### Stage 2 gate status

- **PASS:** full Cantina PDF read and finding-by-finding mapping; pinned Program/SDK source and release delta review; bounded SDK runtime compatibility on exact feature HEAD (Node 24, committed lockfile, TypeScript adapter, IDL golden fixtures, Workerd and non-mutating Devnet simulation).
- **BLOCKED:** Mainnet ProgramData/deployed binary/upgrade authority/deployment slot/source-match evidence because the GitHub Actions Mainnet secret is unavailable; API/DB/RBAC/Consent/Accounting contract freeze; issue #355 Production migration-runner provenance for any future Production DDL.
- **UNKNOWN:** Mainnet ProgramData/binary/source match and upgrade authority; exact Mainnet on-chain IDL presence/bytes/hash; actual value/cluster of the Cloudflare `SOLANA_RPC_URL` secret (value intentionally not accessed); current local Git Working Tree.
- **NOT IMPLEMENTED:** production Subscription domain/schema/API/Collector/verifier/accounting lifecycle and Subscription transaction E2E.

No Production database/schema, runtime secret/key, Program state, Mainnet or Devnet Subscription transaction, funds, Collector signer or customer consent was changed in this review. Stage 3/4/5 remain prohibited until every Stage 2 gate is closed.