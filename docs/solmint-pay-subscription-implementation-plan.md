# SolMint Pay — Subscription Billing Implementation Plan

Date: 2026-10-30  
Repository: `azad2022/solsite`  
Working branch: `feat/pay-subscription-billing`  
Base main SHA: `7b975d56860b6d937ad76ab2983c71937644dfa3`  
Reviewed branch SHA: `2a043a010cbb8d5d01d38f529760c5b247fbd6d3`  
Status: **Architecture discovery checkpoint; feature NOT IMPLEMENTED.**  
This is an implementation plan and a set of gates, not an API/schema contract, security approval, or release authorization.

## 1. Current verified baseline

### Repository
- The reviewed feature branch contains Subscription engineering documentation and Skills, but no Subscription application route, Domain Type, migration, billing worker, Collector implementation, verifier adapter, test, package, or UI.
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
- Cantina PDF is identified but has **NOT BEEN READ**. ProgramData, actual deployed binary hash/source match, upgrade authority, deployment slot, cluster, and exact on-chain IDL remain **UNKNOWN**.

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

## 6. SDK, RPC and environment requirements

- Pin exact Program source/tag, IDL, SDK, toolchain, lockfile and transitive dependencies. Never follow upstream main.
- Evaluate the official Kit-v7 SDK versus SolMint web3.js 1.x boundary. Prefer the upstream-generated builders/decoders through a small, tested adapter; do not hand-invent instruction discriminators or PDA codecs.
- Production Mainnet and Devnet RPC must be explicitly separate. No public-RPC fallback in production. The existing generic Mainnet-read-only workflow currently points to the public Solana endpoint; it is not proof of configured production RPC/Program deployment and must not be repurposed as a fallback.
- Read-only Mainnet inspection must establish cluster/genesis identity, Program account and ProgramData, deployed executable hash, upgrade authority, deployment slot, on-chain IDL/version, and reproducible source match. No Mainnet transaction or mutation is part of validation.

## 7. Implementation sequence and acceptance gates

1. **Close research blockers:** read/render all pages of the Cantina PDF; review the full eight-commit source/IDL/SDK delta; independently verify Mainnet ProgramData and SDK compatibility.
2. **Contract design:** domain lifecycle/state-transition table; merchant/customer authorization; wallet consent; Plan/Subscription read models; idempotency, cycle identity, claim/lease and Attempt recovery; event/outbox; fee and ledger mapping. Review against current schema before naming/creating tables or routes.
3. **Database/API foundation:** source-controlled migration, exact constraints/indexes, RLS and Grants; server-mediated APIs; no customer or Collector privilege escalation; disposable PostgreSQL tests including cross-merchant/customer adversarial cases. Production DDL is prohibited until issue #355 provenance is resolved and an explicit APPLY authorization is given.
4. **Program adapter:** pinned SDK/client and web3.js conversion; exact PDA/IDL validation; separate Init/Subscribe; Plan lifecycle; transaction construction and read-only parser tests.
5. **Collector/verification/accounting:** isolated signing service, key custody and rotation; external-puller discovery/reconciliation; dedicated Subscription verifier; atomic ledger and outbox; timeout/restart/replay concurrency tests.
6. **Adversarial and Devnet:** all Skill test cases including delayed signatures, same-slot init_id, stale Cancel/Resume/Plan update, owner pulls, shared allowance multi-leg, token account delegate/ATA failure, duplicate cycles, ambiguous RPC and cross-tenant RLS; then real Devnet E2E with isolated wallets/database.
7. **Frontend:** only after real contracts pass; dashboard/checkout/consent/cancel/portal UIs reflect backend-authoritative states and exact immutable terms. fa-IR/en-US/ar/ru, RTL/LTR and accessibility required.
8. **Release:** CI, production build, deployment of exact reviewed SHA, API and runtime smoke, rollback evidence, complete Release Audit. Mainnet changes, Production DDL, signing-key creation/rotation and customer-live consent require separate explicit approval.

## 8. Current blocking decision

- **NOT IMPLEMENTED:** Subscription routes, domain, DB contract/migrations, Billing Engine, Collector signer, verifier/accounting adapter, tests and UI.
- **BLOCKED:** Production DDL until issue #355 migration-runner provenance is resolved and explicit APPLY is authorized.
- **BLOCKED:** split-fee billing until LiteSVM/Devnet atomic multi-leg proof and dedicated accounting/verifier tests pass.
- **UNKNOWN:** full Cantina report, release delta audit, Mainnet ProgramData/binary/authority/slot/on-chain IDL, production RPC endpoint evidence, SDK compatibility and Collector key custody.
- **PASS (limited scope):** current Pay database identity/RLS/grant foundation and normal one-off Payment Intent path are available as foundations; this does not certify Subscription.
- Last read-only verification: 2026-10-30. Revalidate every fact against the current HEAD/environment before relying on it.

No Production schema, secret, key, runtime setting, Program state, Mainnet/Devnet transaction, merchant money or customer consent was changed by this checkpoint.
