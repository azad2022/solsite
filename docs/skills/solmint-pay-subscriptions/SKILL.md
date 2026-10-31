# SolMint Pay — Subscription & Recurring Billing Skill

Status: engineering workflow and security constraints for the Subscription Billing bounded context. This skill does not assert that Subscription Billing is implemented or production-ready.

## 1. Authority and mandatory discovery

Authority order:
1. Current repository code and exact main/feature-branch HEAD.
2. Live Backend/API contracts, Database schema, migrations, grants, RLS, domain types, verification and accounting behavior.
3. Master Specification: docs/solmint-pay-frontend-master-instruction.md.
4. Build Web Apps and Release Audit skills.
5. This skill and external vendor documentation.

This skill is a workflow, not an independent source of API, schema, financial truth, security policy, or product requirements. Resolve every apparent conflict against current repository/backend evidence; update this skill when evidence changes.

Before each implementation or audit task, re-check the current HEAD, branch, working tree/PR scope, relevant services/routes/types, live schema and migration ledger, RLS/grants, production runtime configuration (names/status only; never values), workflows, tests, and deployment evidence. Re-read this skill and the applicable existing skills. Do not infer that an earlier audit or checkpoint remains current.

Never work directly on main. Subscription feature work uses feat/pay-subscription-billing, created from the then-current verified main HEAD. Keep unrelated site changes out of scope.

## 2. Current verified baseline — revalidate before use

Last revalidated baseline for this Skill revision: `azad2022/solsite`, `main`, HEAD `7b975d56860b6d937ad76ab2983c71937644dfa3` (2026-10-30). The live Supabase project `nvopkbiedorfshwbmyhn` returned `ACTIVE_HEALTHY`; 106 migration entries and 33 `public.pay_*` tables were observed, all 33 with RLS enabled (none with FORCE RLS). No Subscription, Billing Cycle, Consent, or Collector application tables or public routines were found. Local Working Tree was not readable in that audit and is **UNKNOWN**; no CI status was returned for the documentation-only HEAD. The feature branch `feat/pay-subscription-billing` was created from this exact main SHA. Revalidate every item before use; these are dated findings, not permanent truth.

Existing Pay foundations include Payment Intent, transaction/transfer observations, reconciliation, merchant wallet challenge, Invoice/Customer, Bulk Pay, merchant/revenue/gas/referral ledgers, webhook delivery, merchant membership/RBAC, and Internal JWT. Existing features may be reused only after their exact contracts and invariants are inspected.

At the audited baseline:
- Payment Intent creation is idempotent and snapshots atomic amount, asset/mint/program/decimals, recipient/reference, fee payer, fee, customer total, merchant net/settlement, network, expiry and verification commitment.
- `pay_apply_verified_observation` requires the merchant and fee transfers to share a source authority, requires that authority to equal the transaction fee payer, and rejects `gas_sponsored` payments. A delegated Subscription transfer normally has a different source authority (the Subscription Authority PDA) and transaction fee payer (Collector); it does not satisfy those invariants. Keep the existing verifier unchanged and build a separate adapter.
- `pay_payment_transfers` has merchant settlement, gateway fee, refund and other roles. Authoritative Merchant principal and Gateway revenue are recorded through separate ledger paths; preserve all existing ledger protections and referral rules.
- Existing Pay deliberately rejects Token-2022 for ordinary Pay flows; it supports configured SPL Token USDC/USDT. Do not broaden the supported asset policy because the external Program supports more token programs.
- The existing RPC provider consumes `SOLANA_RPC_URL`; Devnet CI injects the dedicated `SOLANA_DEVNET_RPC_URL` into test runtime. Never interchange Mainnet and Devnet. Secret names alone do not establish cluster identity; use non-mutating evidence.
- Issues #354, #355 and #356 were open at this baseline. #354 concerns authenticated full-lifecycle Bulk Pay E2E; #355 concerns Production migration-runner provenance and is a **Production DDL blocker** until resolved; #356 concerns Bulk Pay database-boundary canonical recipient/asset defense-in-depth. Re-check current issue/PR state before relying on this snapshot.

## 3. Official Solana Subscriptions program — pinned facts and gates

Official source: https://github.com/solana-foundation/subscriptions  
Program address stated by the project: De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44  
Release under review: program tag program-v0.5.0; TypeScript SDK @solana/subscriptions@0.5.0, tag ts-client-v0.5.0.

Do not track upstream main as a dependency. Pin the exact Program source, IDL, SDK and transitive dependency versions together. Program tag v0.5.0, Workspace/IDL 0.5.0-beta.1 and TypeScript SDK 0.5.0-beta.2 are distinct labels and must not be conflated. On 2026-10-31, finalized read-only Mainnet evidence verified Program ID De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44, ProgramData PDA HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg, deployment slot 438440823 and upgrade authority DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv. The deployed ELF hash equals the reproducible pinned-source build hash (056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318). The canonical Program Metadata PDA CCG1hwKFk32h11yE2PRZeEmNAdZsMQrSuiEmqx5eEhWE exists and its on-chain IDL hash equals pinned source IDL hash (1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa). The ProgramData authority resolves to the live Squads v4 Vault/State pair; current threshold is 3-of-5 and timelock is zero seconds. Real-world member identity/custody remains UNKNOWN. These checks prove identity and byte/source correspondence, not Program security or resolution of accepted audit risks. See the dated progress checkpoint and Run 41172466490.

Audit scope is commit-based. The official audits/AUDIT_STATUS.md identifies Cantina baseline d6b3a5dc7ab18c4168441af733c81ab0a599d414 and fixes implemented/verified through debb4f75ff7571218b39de3b633074dd843e70db. The eight-commit post-remediation delta to release commit 364a41976c33347d092902443bbec2def9227e75 was reviewed at file level; it contains no program/src/** changes, but does change release tooling, dependencies/lockfiles, IDL, SDK/client material and tests. Do not generalize the Cantina review to every later release artifact. The complete 12-page official Cantina PDF was reviewed on 2026-10-31: 9 findings (0 Critical; 1 High Acknowledged; 5 Medium, 2 Fixed and 3 Acknowledged; 2 Low, 1 Fixed and 1 Acknowledged; 1 Informational Fixed). Keep all five Acknowledged items as residual risks and require explicit v1 controls and adversarial tests before production approval.

### On-chain behavior that must shape product/security design

- initialize_subscription_authority creates a PDA for a user+mint and approves that PDA as SPL Token/Token-2022 delegate on the user's ATA with u64::MAX allowance. This is broad token-level delegate approval. The program's Plan/Subscription checks enforce the effective per-period constraints; never describe the token approval itself as a one-period or exact-amount allowance.
- create_plan stores one mint and immutable terms: amount, period_hours and on-chain created_at. Period must be 1..8760 hours. Plan has up to four destination addresses and up to four additional pullers. The Plan owner is always implicitly an authorized puller. An all-zero destination list means any destination is allowed; SolMint must use an explicit non-empty destination allowlist and must not expose the unrestricted default.
- Plan amount, period, mint and destination list are immutable. Mutable plan controls include status, end time, pullers and metadata, subject to version-specific stale-approval/immutability rules. A finite end time cannot simply be extended. Plan terms are copied/snapshotted into each Subscription at subscribe time and checked against the live Plan when pulling.
- subscribe requires the subscriber to sign and binds expected mint, amount, period, plan-created timestamp and Subscription Authority incarnation (init_id) to what was observed when the user approved. Use SDK/IDL builders matching the pinned release; do not hand-code stale/obsolete instruction layouts.
- transfer_subscription requires an authorized caller/Puller and validates Plan, Subscription, mint, destination, expiry and cumulative amount in the current period. Period advancement is on-chain. Missed periods do not imply an automatic catch-up debit for every missed cycle; the program advances its period accounting rather than accumulating unlimited past-period debt.
- Regular cancel_subscription schedules expiry at the end of the current period, so current-period pull rights can remain until then. cancel_subscription_now requires both subscriber and plan-owner signatures and is bound to the observed current period start. resume_subscription requires the observed expiry and checks the current plan/authority incarnation. revoke_delegation closes a subscription delegation subject to lifecycle rules. revoke_subscription_authority revokes this program's own token delegate on the user's ATA and closes its authority PDA; it is broader than cancelling one subscription and can affect other subscriptions for that same user+mint.
- Distinguish customer portal cancellation, on-chain subscription cancellation, token delegate revocation, plan sunset, and subscription-account close. Do not collapse them into one status/action.
- Program source supports SPL Token and Token-2022; the official v0.5.0 code path does not support inbound MemoTransfer requirements. SolMint's current supported-asset policy remains the narrower authority until separately audited and changed.
- The Program is an on-chain primitive, not a scheduler or autonomous payment service. SolMint must find due cycles, build and submit authorized pull transactions, observe them and reconcile the result.

### Product requirements that must not be assumed from the Program

The Program period is fixed hours, not calendar months. For example, 30 days is 720 hours, not "same day next calendar month". The Program does not provide a native maximum-total-charge count. Trial behavior, initial-charge timing, pause semantics, max charges, proration, missed-cycle catch-up, tax, plan migration and grace-period policy are not implied by its existence. Do not advertise or implement these until product rules and backend contracts explicitly define and test them.

## 4. Required architecture boundaries

Subscription Billing is an independent bounded context that consumes shared Pay services through explicit contracts. Frontend is presentation/interaction only. Backend and database own plans, consent records, schedule, cycle creation, attempts, retry policy and financial state. On-chain Program state and independent verification establish actual delegated authority and transfer evidence.

Keep these lifecycles separate:
1. Subscription lifecycle.
2. On-chain Plan/Subscription/Token-delegation state.
3. Consent snapshot/version and revocation state.
4. Billing cycle and attempt lifecycle.
5. Payment Intent lifecycle.
6. Collector signing/submission state.
7. Verification/reconciliation outcome.
8. Accounting/settlement/refund state.

Do not use one status column for several lifecycles. Proposed labels are not contracts until accepted in domain types and database/API schemas.

A due cycle must be uniquely identified per subscription and billing period using database-enforced uniqueness and atomic claim/lock. A scheduler is only a wake-up mechanism; it is not idempotency or a lock. Persist the attempt and prepared/submitted transaction identity before/around network side effects according to a designed recovery protocol. On timeout or interrupted RPC response, reconcile the existing signature/transaction/account state before any new transfer. Unknown outcome is not a failed payment and must not trigger a second charge.

Every billing period gets one auditable Payment Intent or an explicitly reviewed alternative linked to the cycle. Preserve the existing Payment Intent snapshot and fee/accounting semantics; do not put invented Subscription data in metadata as a substitute for a typed, constrained relationship. Reference is discovery/correlation only, not proof. Webhook is notification only.

## 5. Collector and signing security

Collector must be separate from public Merchant/Checkout APIs and from Plan Owner authority. It is an authorized Plan Puller, not an unrestricted signer. The plan owner remains implicitly authorized by the Program, so never make the Collector key the Plan Owner merely for convenience.

Prefer a dedicated signing service backed by an Ed25519-capable HSM/KMS or equivalent isolated signer. Cloudflare runtime secrets are not an HSM. Do not introduce a long-lived high-value Collector key into Pages/Workers secrets without a documented threat model, blast-radius analysis, rotation/revocation and incident plan.

The signing boundary must independently validate:
- authenticated internal caller and narrowly scoped job/attempt identity;
- exact cluster, Program ID, instruction discriminator/layout and allowed account set;
- Plan, Subscription, subscriber, mint, token program, source ATA/delegate, destination ATA/owner and non-empty destination allowlist;
- due period, remaining per-period allowance, amount, fee legs and policy limits;
- Collector key is an approved Puller for this exact Plan;
- blockhash/last-valid height and transaction simulation;
- no unexpected instruction, extra transfer, arbitrary CPI, altered account, memo or recipient;
- replay/idempotency, rate limit, audit event and signer-key version.

Do not accept arbitrary serialized transactions or message bytes from public callers. Construct or fully decode/re-validate the message inside the trusted signing boundary. Record transaction/message hash, attempt/cycle ID, Plan/Subscription, signer key version, simulation result, Signature and result without logging secret material. Define emergency disable, key rotation, old-key revocation, recovery and compromised-Collector playbooks.

The transaction fee payer may be the Collector while the token source authority is the Subscription Authority PDA. Keep these identities distinct in schemas, logs, verification and accounting.

## 6. Verification and accounting adapter — critical compatibility gate

Do not route Subscription transfers through the current normal-payment reconciliation by weakening its invariants. At the inspected baseline, pay_apply_verified_observation enforces the same source authority for Merchant and Gateway legs and equates it to transaction fee payer; it also rejects sponsored gas. A delegated transfer normally has a PDA source authority and Collector fee payer. This is a contract mismatch, not an exception to patch around.

Design a dedicated adapter/contract that verifies the pinned Program ID and instruction/event data, actual transaction success/commitment, Plan and Subscription PDA derivations/state, subscriber, approved Puller, Token Program/Mint/Decimals, source token authority/account, explicit destination owner/account, exact atomic amounts, fee payer, billing period allowance, duplicate signature and cycle/attempt correlation. Verify all settlement legs and their cumulative use of the same on-chain period allowance. Test whether the chosen multi-leg transaction is atomic and compatible with the Program before relying on it.

Do not assume the current Reference model discovers a Program-mediated transfer. Define and test how the cycle/Payment Intent links to Plan PDA, Subscription PDA, on-chain event, signature and transfer instruction. Discovery/correlation must not establish success.

Accounting must preserve separate, authoritative entries for Merchant Principal, Gateway Revenue, Referral Liability/Commission, Gas Cost and Refund/Reversal. Reuse current ledger tables only through a reviewed database contract that preserves their append-only/idempotency rules; otherwise design an additive, audited extension. The authoritative verified observation must be committed atomically with transaction/transfer records, ledger effects, Payment Intent result, billing attempt and event/outbox as applicable. Webhook delivery occurs after the authoritative event is committed.

## 7. Database, API and customer consent

Design and review contracts before migrations or routes. Candidate domain concepts (not table names or API contracts) include Plans, Subscriptions, Consent Snapshots, Billing Cycles, Attempts, Retry/Dunning Policy, Events, Collector Registry and Customer Portal access.

For every proposed table/function/API: define ownership and tenant keys, FK, unique constraints, numeric/atomic amount types, state transition constraints, idempotency scope/hash, atomic mutation, append-only events, audit actor, retention, grants/revokes, RLS, SECURITY DEFINER fixed search_path and failure behavior. Test cross-merchant and customer-vs-merchant access adversarially. Never rely on UI filtering for tenant isolation. Customer Portal access must not leak merchant data or another customer's subscriptions.

Consent must be explicit and signed by the customer's real wallet. Store an immutable, auditable snapshot of the exact terms accepted, including Merchant, Plan/version, asset, network, mint, amount per period, period definition, maximum charge per period, fee and payer, receiving destinations, first charge timing, renewal behavior, consent expiry/total duration where applicable, cancellation timing, revocation effect, retry/grace policy and the actual on-chain delegation scope. Clearly disclose that token delegate approval is u64::MAX while the Program enforces the Plan/period limits. Do not claim a maximum total charge count or calendar-month schedule unless the backend/on-chain design truly enforces it. Price, mint, destination, period or material fee changes must not silently mutate an existing consent; require a new consent/Plan transition policy.

Do not store customer seed phrases, private keys or wallet secrets. The customer signs in their own wallet; backend stores public addresses, signatures, consent evidence and on-chain references only.

## 8. State and failure rules

Keep subscription, on-chain authority, billing attempt, Payment Intent and financial states distinct. Proposed states such as awaiting_consent, activating, active, past_due, retry_scheduled, cancel_at_period_end, cancelled, expired, revoked, outcome_unknown, submitted, verifying, confirmed and completed require a written transition table and authoritative source before implementation.

Classify insufficient balance, revoked delegate, missing token account, expired consent/Plan, RPC timeout, simulation failure, transaction rejection, submitted-unknown, verification failure, duplicate/replay, wrong token/destination/amount and merchant suspension. Retry only errors proven retryable and within bounded attempts/grace policy. Never retry blindly after an unknown submission. submitted is never paid; only backend reconciliation over verified on-chain evidence can mark a billing cycle financially successful.

## 9. Frontend and i18n

Use the Build Web Apps skill. Add a dedicated Subscription area to Merchant Dashboard and a minimal Customer Portal only after its API contract exists. Show loading, empty, error, unauthorized, forbidden, stale and retryable states. Keep Plan, Subscription, Consent, On-chain Delegation, Billing Attempt and Payment Intent statuses separate. Customer consent UI must present the exact backend snapshot and plain-language scope of the broad token delegate approval, charge cap, destinations, period, fees, first/next charge, cancellation and revoke distinction. Do not infer status or financial totals in the browser.

Support fa-IR, en-US, ar, ru and real RTL/LTR. No hard-coded user-facing strings. Never connect the browser directly to Supabase/RPC for sensitive operations.

## 10. Mandatory test and release gates

Test Unit → Component → Integration → Devnet E2E → Security/Adversarial → CI. Separate Mainnet read-only checks from Devnet mutating tests. Never use public RPC as a production fallback.

Minimum scenarios: valid/declined/invalid consent; stale Plan terms; first charge and renewal; amount/period ceiling; missed cycle; insufficient balance; Token Account missing/closed; Token delegate revoked; Plan sunset/expiry; cancel-at-period-end; dual-approved immediate cancel; resume and stale approvals; authority re-init/old init_id; duplicate scheduler/claim and concurrent billing; RPC timeout/submitted unknown/restart; duplicate Signature/replay; wrong Program/Plan/Subscription/Mint/Token Program/recipient/amount/Puller/fee payer; malformed/extra instructions; MemoTransfer account; simulation failure; Collector compromise/rotation; accounting split and atomicity; referral attribution; gas accounting; refund/reversal; merchant suspension; cross-merchant/customer RLS and grants; webhook outbox/retry.

No production migration, signing-key creation/rotation, live Plan, real customer consent, or Mainnet transfer without explicit approval and a reviewed, reversible/controlled release plan. Never suppress failing tests or weaken existing payment/RLS invariants to get green CI.

## 11. Checkpoint discipline

After each genuinely validated milestone, update docs/solmint-pay-progress.md with exact branch/commit, files changed, validation commands and results, live evidence, blockers and next step. Do not mark audit, integration, Devnet, security or release checkpoints green based on design, compilation alone, or an unverified external claim. A design-only/documentation change is not an implementation checkpoint.

Read this skill together with:
- docs/solmint-pay-frontend-master-instruction.md
- docs/skills/solmint-pay-build-web-apps/SKILL.md
- docs/skills/solmint-pay-release-audit/SKILL.md


## 12. Critical upstream security findings — mandatory controls

The official program-v0.5.0 README's Security Considerations and the Cantina report contain residual risks that must be treated as design constraints, not optional warnings. The complete 12-page Cantina PDF and eight-commit post-remediation release delta were reviewed on 2026-10-31. The five Acknowledged report items remain unresolved by code changes evidenced here; the report's review and ProgramData/source identity match do not eliminate them. See the finding matrix above and the 2026-10-31 progress checkpoint.

### 12.1 Never use `UNKNOWN_INIT_ID` for production consent

- `init_id` is slot-granular. Closing and recreating a SubscriptionAuthority in the same slot can reproduce the same `init_id`; idempotent initialization does not refresh it. It is not a globally unique generation counter.
- A held, signed transaction containing both `InitSubscriptionAuthority` and `Subscribe` with `UNKNOWN_INIT_ID` can land later, recreate the shared authority, re-approve the `u64::MAX` delegate and create a spendable subscription without a new wallet signature at that later time—even after the customer attempted to revoke the authority.
- **Production v1 rule:** do not co-bundle authority initialization and subscription creation. First initialize the authority in a separate customer-signed transaction; wait for the required on-chain commitment, fetch and validate the actual `init_id` from the derived authority PDA, and only then request a separately signed `Subscribe` instruction using that exact observed value. Reject the sentinel in production API/builders. Reinitialization must be interpreted from actual account/delegate state, not inferred from a prior action.
- Record each wallet approval's message/transaction hash, recent blockhash, last-valid block height, signer, intended operation and submission/confirmation/reconciliation state. Re-check account state immediately before preparing the next consent operation.
- Do not claim the user has revoked all permission while an earlier signed but unlanded instruction can still execute.

### 12.2 Durable nonce and pending smart-wallet proposals

- A recent-blockhash transaction has a finite validity window; a durable-nonce transaction does not have the same short slot expiry. A pending Squads/Swig or other smart-wallet proposal may also remain executable until explicitly cancelled or its nonce is advanced.
- **Production v1 default:** use recent-blockhash consent/control transactions only. Do not accept durable-nonce transactions or pending multi-party proposals for Subscribe, Initialize, Cancel, Resume, Revoke or Plan administration until a versioned pending-approval lifecycle, expiry/cancellation verification and incident procedure are implemented and adversarially tested.
- If a supported wallet can hold proposals, UI and Backend must distinguish proposed, approved, executable, submitted, confirmed, failed and cancelled using real provider/wallet evidence. Closing a modal or clicking Cancel is not cryptographic cancellation.
- On expiry, do not reuse signed bytes. Re-read chain state, prepare a new message with fresh observed state and obtain a new signature.
- A held `InitSubscriptionAuthority` can restore the `u64::MAX` delegate after the customer manually revoked the SPL approval. A held close/revoke instruction may act on the same PDA after later recreation and destroy the newer authority. Revocation is not described as permanent while pending signed authority-control transactions remain.

### 12.3 Other stale-approval residuals

- `CancelSubscriptionNow` binds to `current_period_start_ts`, which is second-granular; a withheld dual-signed approval has a narrow same-second replay case after re-subscription.
- `ResumeSubscription` binds to `expected_expires_at_ts`; two cancellations within the same period can compute the same expiry. A held Resume can therefore clear a later same-period cancellation. Never leave signed Resume messages pending.
- `UpdatePlan` checks observed values rather than a monotonic revision. An ABA change (change a value, then restore it) may make an old signed update match again. Use fresh state, short recent-blockhash windows and one outstanding administration proposal at a time; do not accept long-lived signed proposals in v1.
- Subscribe binds mint, amount, period, plan creation timestamp and authority `init_id`, but not Plan `end_ts`. A Plan Owner can shorten a finite end after consent. A near-expiry subscription can be charged the full period amount for a partial first window, including a zero-length window at the exact boundary according to the upstream README. **V1 policy:** do not enroll when a finite Plan has less than one full period remaining; show exact end date and period boundary in consent. Any exception requires explicit product approval and tests.
- Plan Sunset blocks new subscriptions but the v0.5.0 transfer path does not check Plan status before existing subscriptions pull. Sunset is not immediate cancellation or a stop-payment switch. Existing subscriptions remain subject to their stored terms, expiry, destination and authority state.

### 12.4 Shared delegate and cross-subscription blast radius

- SPL Token token accounts have one approved delegate slot. Initializing SolMint's SubscriptionAuthority can replace an existing delegate. Before asking the customer to sign, inspect the actual token account and disclose the replacement. Do not silently override another application's delegate.
- SubscriptionAuthority is shared by a customer+mint pair, while each Plan subscription has its own SubscriptionDelegation PDA. Re-approving or revoking the shared authority affects every subscription for that customer+mint, not only the selected Plan.
- Revoking the token delegate does not necessarily close/terminate each SubscriptionDelegation. Reinitialization may restore the delegate and therefore restore collectability. UI must distinguish per-subscription cancel/close from shared authority revocation and explain cross-subscription effects before a wallet signature.
- `init_id` is not a per-subscription independent generation. Do not use it as the only off-chain consent ID or global revocation version.

### 12.5 Pulls outside the Collector

- Plan Owner is implicitly authorized to pull and cannot be removed from the on-chain authorization rule. Up to four additional Puller addresses may be listed. Merchant/Plan Owner can therefore perform pulls outside SolMint's Collector.
- Reconcile **all** successful `TransferSubscription` instructions for each Subscription, including pulls signed by the Plan Owner or another authorized Puller. Never reconcile only Collector signatures.
- Before a Collector pull, read live SubscriptionDelegation state and its current period start/cumulative `amount_pulled_in_period`; compute only remaining allowance. The Program is the final enforcement point, but Backend must not deliberately double-submit or misstate a cycle because another Puller already used the allowance.
- The unique billing-period key must be anchored to actual on-chain period start and Subscription identity, not a calendar month or assumed scheduler timestamp. If periods were skipped, the upstream Program advances to the current aligned period and does not create automatic debt for every skipped period. Catch-up policy is a separate product decision.
- Plan Owner is in addition to the four additional Pullers. Do not silently make Collector the Plan Owner merely to obtain signing authority.

### 12.6 Destination, ownership and fee-leg constraints

- The Program's destination allowlist checks the **owner address** stored in the receiving token account, not only the receiving ATA address. SolMint must derive/check the ATA for configured mint/token program, then verify its owner equals an explicitly allowed destination owner.
- An all-zero Plan destination list permits any destination. SolMint must reject such a Plan for Production. If a fee leg is paid to a separate gateway wallet, both Merchant destination owner and fee-recipient owner must be explicitly allowed by the Plan.
- A `TransferSubscription` instruction carries one transfer destination and one amount. Do not assume a single instruction distributes principal and fee to separate wallets. If the fee model requires two legs, construct a transaction with exact two allowed instructions and prove with pinned-program LiteSVM tests that both legs consume one shared cumulative period allowance; an invalid second leg rolls back the first; extra/duplicate legs are rejected by the backend verifier; and events/balance deltas reconcile exactly. Repeat on Devnet. Until this passes and accounting is approved, split-fee Subscription charging is **BLOCKED**.
- Do not invent a zero-fee or alternate-fee Subscription model to bypass this constraint. Gateway fee, payer, network fee and Merchant settlement require an explicit product/accounting decision.

### 12.7 Collectability and service entitlement

- On-chain `expires_at_ts == 0` / active Subscription is not proof a token pull will succeed. A customer can revoke the delegate, freeze/empty/close the token account or otherwise make it uncollectable. The Program has no delinquency/grace state.
- Before first activation and each renewal, Backend must inspect actual Plan, SubscriptionDelegation, SubscriptionAuthority, source ATA, mint/program, delegate and available token balance/transfer preconditions. This is a collectability observation, not a charge or payment result.
- Grant/renew service only according to a documented entitlement policy whose paid state comes from independently verified finalized transfer evidence and atomically committed accounting. Do not grant paid service from Plan state, event, active badge, Collector submission or wallet signature.
- Prefer a finite `end_ts` when sponsoring rent. A sponsor paying Plan rent does not become Plan Owner and does not recover that Plan rent on deletion; Plan Owner receives the rent. Default to Merchant-funded Plan rent unless a separately approved subsidy policy exists.

### 12.8 Token program and wallet compatibility

- Upstream Token-2022 support does not broaden SolMint's supported asset policy. v0.5.0 forwards caller-supplied TransferHook accounts; it does not validate arbitrary hook policy on SolMint's behalf. Inbound MemoTransfer-required destinations are unsupported and transfers fail atomically.
- Keep v1 to the currently approved SPL Token asset policy unless a separate mint/extension/TransferHook risk review changes it. Never add Token-2022 just by installing the upstream SDK.
- Upstream tests Squads/Swig program-controlled wallets, but native SPL Token multisig owner accounts are not supported for authority init/revoke. V1 wallet support must be explicitly tested against wallet type and exact instructions; do not infer compatibility from connection alone.

## 13. Subscription v1 safety profile

Unless a later reviewed decision explicitly changes it, use this conservative v1 profile:

1. Standard wallet-signed, recent-blockhash transactions only for customer consent and authority lifecycle.
2. Separate Authority initialization and Subscribe; use the fetched real `init_id`; reject `UNKNOWN_INIT_ID`.
3. No durable nonce or unresolved smart-wallet/multisig proposals in the consent/control path.
4. Original SPL Token assets only; use the existing backend asset allowlist and mint configuration. No Token-2022/TransferHook support.
5. Plan destination list must be explicit and non-empty. No arbitrary-destination Plan.
6. Plan Owner authority and all external Pullers are included in reconciliation and disclosed.
7. No enrollment in a finite Plan with less than one full remaining billing period.
8. No sponsored Plan creation by default.
9. No split principal/fee transfer until two-leg same-transaction tests, dedicated verification and the fee/accounting model are approved.
10. No entitlement/renewal until finalized on-chain transfer is independently verified and accounting commits atomically.

This is a proposed engineering default, not a claim that the current repository enforces it. Implement the profile server-side and in on-chain transaction construction; UI wording alone is not enforcement.

## 14. Evidence and context efficiency

- Treat this Skill as workflow guidance, not a substitute for source verification. Revalidate current main/feature HEAD, actual branch, changed files, live schema and deployment evidence for every task.
- Use `docs/solmint-pay-progress.md` as a chronological index. Do not reread its entire history on every request: inspect headings and the latest relevant checkpoint, then search/read only sections and files related to the task.
- Keep the exact project instruction in `docs/solmint-pay-project-instructions.md`; ChatGPT Project Instructions should contain the stable operating rules and a pointer to that canonical file. Do not paste the entire Progress ledger into every context.
- Read Master Specification and relevant Skills from the same HEAD; load Supabase/Postgres or React guidance only when change touches those areas.
- Every unknown must be recorded as UNKNOWN, not silently promoted to PASS. Distinguish repository fact, live provider fact, upstream claim, design proposal and unverified assumption.

