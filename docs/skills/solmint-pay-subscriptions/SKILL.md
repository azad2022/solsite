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

The audited repository baseline was azad2022/solsite, main, HEAD 688438b26ff846862d05d0dc1b914177b6ecf5ba (2026-10-30 audit). The live Supabase project had 106 recorded migrations and 33 pay_* tables, with RLS enabled on those tables. No Subscription tables or Subscription API family were found at that baseline. Existing Pay foundations include Payment Intent, transaction/transfer observations, reconciliation, merchant wallet challenge, Invoice/Customer, Bulk Pay, merchant/revenue/gas/referral ledgers, webhook delivery, merchant membership/RBAC, and Internal JWT. These are discovery findings, not a promise that every path is ready for Subscription reuse. Re-discover the current state before coding.

At that baseline:
- Payment Intent creation is idempotent and snapshots atomic amount, asset/mint/program/decimals, recipient/reference, fee payer, fee, customer total, merchant net/settlement, network, expiry and verification commitment.
- pay_apply_verified_observation requires the merchant and fee transfers to share a source authority, requires that authority to equal the transaction fee payer, and rejects gas_sponsored payments. A delegated Subscription transfer normally has a different source authority (the Subscription Authority PDA) and transaction fee payer (Collector); it does not satisfy those invariants.
- pay_payment_transfers has merchant settlement, gateway fee, refund and other roles. Authoritative merchant principal and gateway revenue are recorded through separate ledger paths; existing ledger protections and referral logic must be preserved.
- The existing Pay asset policy deliberately rejects Token-2022 for ordinary Pay flows; it supports configured SPL Token USDC/USDT only. Do not silently broaden that policy because the Solana program supports more token programs.
- Existing Solana RPC provider consumes SOLANA_RPC_URL. The Devnet CI workflow injects the dedicated SOLANA_DEVNET_RPC_URL into test SOLANA_RPC_URL. Production Cloudflare had separate secret names for mainnet/devnet; presence of names alone did not prove provider/cluster identity. Confirm network identity with non-mutating evidence. Never interchange mainnet and devnet.

## 3. Official Solana Subscriptions program — pinned facts and gates

Official source: https://github.com/solana-foundation/subscriptions  
Program address stated by the project: De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44  
Release under review: program tag program-v0.5.0; TypeScript SDK @solana/subscriptions@0.5.0, tag ts-client-v0.5.0.

Do not track upstream main as a dependency. Pin the exact audited/released Program source, IDL, SDK and transitive dependency versions together. The v0.5.0 changelog says the release targets a 2026-08-10 mainnet deployment, while the deployed binary/on-chain IDL report 0.5.0-beta.1 built at release commit 364a41976c33347d092902443bbec2def9227e75. This is a version-label distinction, not independent proof that the live ProgramData binary matches the local source. Before production use, verify cluster, Program ID, ProgramData/deployment authority, deployed binary hash/reproducible build, on-chain IDL and SDK/source compatibility. Record the exact evidence and date.

Audit scope is commit-based. The official audits/AUDIT_STATUS.md identifies Cantina audited-through baseline d6b3a5dc7ab18c4168441af733c81ab0a599d414 and fixes implemented/verified through debb4f75ff7571218b39de3b633074dd843e70db. Do not describe all later upstream commits, the entire v0.5.0 release, or current upstream main as audited without a file/commit-level delta review. The official Cantina PDF must be read and every finding, severity, remediation and residual risk recorded before production approval. A repository status file is not a substitute for the report.

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
