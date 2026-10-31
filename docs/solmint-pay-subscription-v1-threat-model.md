# SolMint Pay — Subscription v1 Threat Model and Control Specification

Date: 2026-10-31
Repository: `azad2022/solsite`
Branch: `feat/pay-subscription-billing`
Design baseline: `5b8d24b3e2a63531313dddb591bd353aa80e98f0`
Pinned upstream Program source: `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`
Program release tag: `program-v0.5.0`
Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`

**Document status: DESIGN / NOT AN IMPLEMENTATION.**
**Stage 2: BLOCKED. Part 2.2: NOT STARTED.**
No new API, database object, instruction, account field, permission, or business state is declared to exist by this document. Names in code blocks are conceptual unless explicitly identified as existing upstream instruction/account names. This document is a security gate and implementation specification, not a release authorization.

## 1. Purpose and security decision

This threat model converts the July 30, 2026 Cantina Subscription report and the verified Program/SDK behavior into enforceable SolMint v1 design constraints, attack tests, recovery requirements, and release evidence.

The central design constraint is that the official Mainnet Subscription Program is an external, already-deployed program. SolMint's Backend and transaction builder cannot retroactively add a persistent consent epoch, invalidate an old signed instruction format, or change on-chain replay semantics. A SolMint-side policy can prevent SolMint from constructing certain transactions, but it cannot prove that a customer has no separately signed, still-executable transaction or proposal created by another client.

Therefore:
- Off-chain controls are defense-in-depth; they must not be described as fixing an upstream on-chain vulnerability.
- Any risk requiring an on-chain program change remains a protocol residual risk until the changed Program is deployed and independently verified.
- SolMint must not promise that a browser cancellation, a backend status, recent-blockhash expiry, or a token delegate read proves that every previously signed action is impossible to execute.
- Where a finding cannot be reduced to an acceptable, testable v1 residual risk, the affected capability must be excluded and the gate remains BLOCKED.

## 2. Source basis, scope, and an audit-report inconsistency

### 2.1 Sources used

1. Official Cantina report dated 2026-07-30, review baseline `d6b3a5dc7ab18c4168441af733c81ab0a599d414`, with remediation marker `debb4f75ff7571218b39de3b633074dd843e70db`.
2. Eight-commit post-remediation delta through release commit `364a41976c33347d092902443bbec2def9227e75`; no `program/src/**` paths changed in that delta. This does not mean all changed release/client artifacts were covered by the original Program audit.
3. Pinned Program tag `program-v0.5.0`, SDK `@solana/subscriptions@0.5.0`, and the exact source/IDL identity evidence recorded in the 2026-10-31 Progress checkpoint.
4. Mainnet finalized read-only evidence: deployed ELF hash equals the reproducible pinned-source ELF hash; canonical on-chain IDL hash equals pinned source IDL hash.
5. Current repository instructions, Subscription Skill, Release Audit Skill, and implementation plan at feature HEAD `5b8d24b`.

### 2.2 Material count inconsistency inside the Cantina PDF — unresolved

The PDF's page 3 summary table says: High 1 acknowledged; Medium 5 with 2 fixed and 3 acknowledged; Low 2 with 1 fixed and 1 acknowledged; Informational 1 fixed; total 4 fixed and 5 acknowledged.

The detailed finding pages say:
- High: old signed creates — Acknowledged.
- Medium: stale CancelSubscriptionNow — Acknowledged.
- Medium: stale update_plan — Fixed (Cantina says verified fix).
- Medium: stale ResumeSubscription — Acknowledged.
- Medium: stale authority-control — Acknowledged.
- Medium: full-period charge near Plan expiry — Acknowledged.
- Low: optional CreatePlan payer missing from IDL — Fixed (Cantina says verified fix).
- Low: automatic rent sponsorship — Acknowledged.
- Informational: IDL generation failure not stopping release — Fixed (Cantina says verified fix).

Thus the detailed pages enumerate **four Acknowledged Medium findings**, not the three in the summary table. The detailed pages enumerate six Acknowledged findings overall (one High, four Medium, one Low), while the summary table says five. The detailed pages also enumerate three Fixed findings overall, while the summary table says four. This conflict must not be silently reconciled.

**Audit accounting status: UNKNOWN / BLOCKED pending written clarification or corrected report from Cantina/Solana Foundation.** Until resolved, the security gate uses the more conservative detailed finding-by-finding classification and treats all six detailed Acknowledged findings as residual risks. This count discrepancy does not change the fact that the High and named Medium/Low issues require controls.

## 3. Assets, principals, and trust boundaries

### 3.1 Assets to protect

- Customer token balances and the customer's ability to stop future token pulls.
- Merchant revenue and the correctness of merchant settlement.
- Gateway fee, referral liability, network-cost and refund/reversal ledgers.
- Customer service entitlement and the correctness of access duration.
- Plan terms, customer consent evidence, subscription lifecycle and cancellation intent.
- Collector signing authority, signing keys, job integrity and transaction policy.
- Integrity, availability and confidentiality of merchant/customer data.
- Audit trail, transaction evidence, reconciliation coverage and dispute evidence.

### 3.2 Principals and authorities

- Customer wallet: signs consent, Authority initialization, Subscribe and customer-controlled lifecycle actions.
- Merchant Plan Owner: creates and controls its Plan; the Plan Owner is always an authorized Puller under the Program and cannot be removed as a Puller.
- Additional Plan Pullers: up to the Program's configured limit; they may pull within on-chain constraints and must be included in reconciliation.
- SolMint application user and merchant membership: backend identity/RBAC principal; not an on-chain signer.
- Billing scheduler/worker: trigger only; never an authorization or lock by itself.
- Collector signer: separately isolated transaction signer and additional Plan Puller; never the Plan Owner and never a public arbitrary-message signing service.
- RPC/indexer/provider: untrusted discovery and transport boundary; provider response alone is not payment truth.
- Supabase/Postgres: authoritative application state only when protected by verified constraints, grants, RLS and atomic server-mediated transitions.
- Upstream Subscription Program and its upgrade authority: external protocol boundary. SolMint cannot assume control over upstream code or governance.
- Squads v4 governance for the Program upgrade authority: on-chain state was observed as 3-of-5 with zero-second timelock; real-world member identity/custody is UNKNOWN.

### 3.3 Trust-boundary rules

1. Browser, wallet adapter, webhook, scheduler, queue, RPC notification and indexer are untrusted inputs.
2. Backend must derive merchant/customer ownership from authenticated server-side identity and current RBAC, never caller-supplied IDs alone.
3. Transaction construction must be deterministic from server-read chain state and immutable backend terms; arbitrary caller-supplied message bytes are not signable.
4. Finalized chain evidence must be independently parsed and verified before accounting.
5. Database writes that establish financial outcome and entitlement must commit atomically.
6. Program Owner, other Pullers and Collector are separate collection actors. Never infer that a Collector signature is the only possible debit source.
7. SolMint UI cannot claim that an upstream protocol risk is fixed by hiding a button or displaying a status.

## 4. Protocol facts that materially affect the threat model

- `SubscriptionAuthority` is shared for a customer+mint and is approved as an SPL Token delegate with `u64::MAX`; the effective limit is enforced by Program Plan/Subscription state, not a one-period token allowance.
- One SPL Token account has one delegate slot; initialization may replace an existing delegate. This requires explicit disclosure and a pre-signature delegate check.
- Revoking the shared authority can affect other subscriptions for the same customer+mint.
- Plan Owner is implicitly a Puller. Up to four additional Pullers may exist; reconciliation must include all authorized Pullers.
- An empty destination allowlist means any destination is permitted. SolMint v1 must reject empty/unrestricted destination lists.
- Program period is fixed hours, not a calendar month. Actual period start and cumulative amount are on-chain state.
- The Program does not create an automatic debt for each missed period. Catch-up is a separate product/backend policy.
- A `TransferSubscription` instruction carries one destination and one amount. Split principal+fee is not approved.
- Active Subscription PDA state does not prove that the shared delegate, ATA, balance or destination remains collectible.
- Signature, event, webhook, browser state and submitted transaction are not proof of payment.
- The Program's current on-chain semantics include stale-approval risks described below. A backend cannot change those semantics.

## 5. Finding-specific threat and control register

### TM-01 — Old signed creates restore revoked permissions (Cantina High, Acknowledged)

**Attack / impact**

An unexecuted signed transaction can contain `InitSubscriptionAuthority` followed by `Subscribe` (or another permission-creation instruction) using `UNKNOWN_INIT_ID`. If retained and later submitted after the customer revoked/closed the shared authority, the transaction can recreate the authority, approve the token delegate for `u64::MAX`, and create a new spendable permission without a fresh signature at that later time. The report explains that the sentinel is slot-bound, not bound to that particular transaction or approval time. Durable Nonce and pending smart-wallet/multisig actions widen the retention window.

**Trust boundary / preconditions**

Customer wallet signature → relayer/proposal holder → upstream Program. The attack requires a distinct signed action that has not previously executed and remains executable; it is not merely replay of an already successful transaction.

**On-chain control required for a true protocol fix**

The Cantina recommendation requires persistent consent state that survives closure of both Authority and permission PDAs, with at least a monotonic authority epoch, action nonce and approval-enabled flag. Authority/permission creation and revoke operations must bind expected epoch, nonce and short deadline; successful lifecycle actions consume/advance state. Individual permission revocation also needs persistent generation/tombstone. Remove `UNKNOWN_INIT_ID` where possible; if same-transaction onboarding remains, validate the matching preceding init instruction through the Instructions sysvar **and still require persistent epoch/nonce/deadline checks**. Disable legacy unbound instruction formats after migration. Merely adding V2 instructions while old unbound formats remain callable is not a fix.

**SolMint v1 controls (defense-in-depth only)**

- Transaction builder MUST reject `UNKNOWN_INIT_ID` and MUST NOT create an Init+Subscribe bundle.
- Authority initialization and Subscribe MUST be separate customer-signed transactions.
- After finalized initialization, fetch the actual Authority PDA and its actual `init_id`; construct Subscribe only with that observed value.
- Use recent blockhash only. Reject Durable Nonce transactions and unresolved Squads/Swig/smart-wallet proposals for consent and authority control.
- Persist the exact unsigned message digest, blockhash/last-valid-height, wallet, Plan, mint, destination and intent context before asking for signature; after signature, reconcile that exact transaction. Do not issue a replacement while outcome is unknown.
- Do not describe Authority revoke as a permanent cryptographic invalidation of all previously signed approvals. Explain the upstream residual risk in consent/cancellation UX.
- A backend record of SolMint-issued signatures is incomplete with respect to signatures created outside SolMint; it cannot prove there are no outstanding approvals elsewhere.

**Database / backend invariants**

- No subscription may become consented merely because an Authority PDA exists.
- Consent evidence must bind customer, exact Plan/terms snapshot, mint/program, destination owner, amount, fixed-hours period, actual `init_id`, wallet signature and exact transaction identity.
- Track outstanding SolMint-issued authority/consent actions and their blockhash validity/reconciliation status. This is a conceptual requirement, not an approved table name.
- No entitlement from Authority/Subscription state alone.

**Recovery**

On unknown submit, query/reconcile the original signature/message and relevant finalized PDA/token-account state. Do not create a new Init or Subscribe. If a customer reports an externally signed pending transaction/proposal, mark authority status as unresolved and do not promise that revoke is final. A true protocol-level recovery requires the upstream persistent consent epoch/nonce fix or a protocol-supported invalidation mechanism; SolMint cannot fabricate one.

**Adversarial tests / PASS evidence**

1. Build path rejects `UNKNOWN_INIT_ID`.
2. Build path never emits an Init+Subscribe atomic bundle.
3. Subscribe builder refuses missing, stale or mismatched observed `init_id`.
4. Simulate an unsubmitted signed Init+Subscribe bundle, revoke, then submit old bundle; test must demonstrate the upstream Program behavior and document whether it succeeds. This is a residual-risk reproduction, not a SolMint PASS.
5. Test Durable Nonce and pending smart-wallet proposal rejection.
6. Test timeout/restart reconciliation without duplicate Init/Subscribe.
7. For protocol remediation, test persistent epoch/nonce/tombstone, stale signature rejection after revoke and individual permission close/recreate; test legacy instruction rejection.

**Gate**

- SolMint builder policy: NOT IMPLEMENTED until code and tests exist.
- Upstream protocol invalidation: BLOCKED / NOT EVIDENCED.
- Overall TM-01: **BLOCKED for production claims of reliable revocation**. Off-chain builder rules alone do not close the High finding.

### TM-02 — Stale CancelSubscriptionNow approval can affect a recreated subscription (Cantina Medium, Acknowledged)

**Attack / impact**

The report says `CancelSubscriptionNow` binds participants and Plan/Subscription PDA but not a unique Subscription incarnation. `expected_current_period_start_ts` added later mitigates replay across different timestamps, but a same-second close/recreate can preserve the timestamp and leave an old unexecuted approval usable against the new Subscription. A stale approval may immediately cancel a newly recreated Subscription.

**Controls**

- Do not expose immediate dual-signed cancellation in v1 unless the stale-approval behavior is accepted and tested. Prefer the supported ordinary cancellation path where its semantics are independently verified.
- No Durable Nonce or unresolved program-controlled wallet proposal.
- Every control transaction must use a recent blockhash, short validity, fresh chain state and an exact expected current period start.
- Serialize lifecycle controls per Subscription. Do not issue a second conflicting control approval while a prior SolMint-issued approval may still be executable.
- Do not recreate/re-enroll at the same deterministic PDA while a previously issued control transaction remains within its validity window or outcome is unknown.
- Because external clients may create approvals unknown to SolMint, these rules do not provide a global guarantee. Do not claim same-second replay is fixed.

**Database / backend invariants**

- Record control action identity, expected chain state, blockhash validity and submission outcome.
- Enforce one in-flight control workflow per subscription identity in the application database, with atomic compare-and-set/claim semantics. Exact schema is not yet approved.
- Do not let a browser Cancel action set a terminal backend state before chain verification.

**Recovery**

Reconcile the original cancellation transaction and live Subscription PDA before allowing a retry or recreation. Unknown remains unresolved. If a stale cancel lands, record the verified chain outcome and require a fresh customer/merchant lifecycle action where supported; do not silently re-enable service.

**Adversarial tests / PASS evidence**

- Reproduce close/recreate in the same second and submit a stale signed CancelNow transaction.
- Verify SolMint builder rejects Durable Nonce and stale expected period.
- Race two conflicting control operations and prove only one backend claim can proceed.
- Test timeout/restart and no duplicate control instruction.
- Prove no UI/backend state is marked cancelled until the finalized on-chain result is independently verified.

**Gate**

Immediate cancellation: **BLOCKED for v1** until exact behavior and residual acceptance are approved. Ordinary cancellation may be considered only after its separate state machine and tests are reviewed.

### TM-03 — Stale Resume approval undoes a later cancellation (Cantina Medium, Acknowledged)

**Attack / impact**

A retained, unexecuted Resume approval can clear a later cancellation if it still passes the Program's current checks. The report reproduced the sequence with a Durable Nonce transaction. This can restore future collection after the customer cancelled.

**Controls**

- No Durable Nonce or unresolved smart-wallet/multisig proposal in v1.
- Serialize Resume/Cancel actions and do not create a new control approval while a prior action can still execute.
- Use recent blockhash, short validity and fresh on-chain state for every action.
- Until an on-chain cancellation revision/incarnation is available, disable Resume in v1 rather than representing it as a reliable reversible toggle.
- A backend revision/row version is not a substitute for a Program-enforced revision; direct on-chain submission bypasses backend state.

**Database / backend invariants**

- Conceptually maintain a monotonic control-action sequence and an atomic single-in-flight claim; exact table/column names remain undecided pending Contract Freeze.
- Keep cancellation requested, submitted, unknown and finalized states distinct.
- A previous Resume must not be interpreted as proof that a newer cancellation was reversed unless its own finalized transaction is verified.

**Recovery**

Reconcile the exact Resume signature and live Subscription state. If the old Resume lands after a newer cancellation, record the actual on-chain state, alert the customer/merchant and require a fresh supported action. Never attempt compensating transactions automatically without a reviewed state transition.

**Adversarial tests / PASS evidence**

- Reproduce cancel → sign Resume and withhold → cancel again → submit old Resume.
- Test same PDA close/recreate lifecycle where applicable.
- Test builder rejection of Durable Nonce/proposals.
- Test competing Resume/Cancel claims, timeout and recovery.
- A protocol fix must enforce expected cancellation revision and persistent incarnation across close/recreate, with stale Resume rejection.

**Gate**

Resume: **NOT IMPLEMENTED / BLOCKED for v1** until a reliable protocol-level binding exists or a formally approved residual-risk decision permits a narrower behavior.

### TM-04 — Stale authority-control approvals restore or destroy later authority state (Cantina Medium, Acknowledged)

**Attack / impact**

The report identifies two directions:
1. An old signed initialization can re-approve the shared delegate after a user directly revoked it while the Authority PDA remains open.
2. Old signed Close/Revoke instructions can close or revoke a newer Authority generation at the same deterministic PDA because the signed action is not bound to the generation it inspected.

**Controls**

- Do not treat repeated `InitSubscriptionAuthority` as harmless/idempotent reauthorization.
- Do not automatically refresh `u64::MAX` delegate approval.
- Reauthorization, if ever supported, must be an explicit customer action with clear delegate replacement disclosure and fresh observed delegate state.
- Use recent blockhash only; no Durable Nonce or unresolved proposals.
- Do not expose Close/Revoke/Init as independently retryable UI buttons; reconcile the previous action before another authority action.
- A true fix requires Program-enforced expected epoch/action nonce/deadline and expected delegate state, with old unbound instructions disabled. Backend serialization cannot stop a previously signed transaction submitted directly to Solana.

**Database / backend invariants**

- Keep shared authority state scoped to customer+mint and enumerate all affected subscriptions before a revoke/close action.
- Record which subscriptions may be affected by shared delegate replacement/revoke.
- Require fresh wallet authentication and customer confirmation for explicit reauthorization.
- Do not mark revoked or active from request submission; verify finalized token-account delegate and Authority PDA state.

**Recovery**

On ambiguous outcome, inspect the original transaction and finalized Authority PDA/token-account delegate. If the old init re-approves the delegate, surface the actual state and require a fresh customer-signed revoke/repair operation; do not hide the event. If a stale close/revoke destroys a new generation, require a fresh initialization/consent lifecycle, with the old signature state reconciled first.

**Adversarial tests / PASS evidence**

- Old Init signed before direct delegate revoke, then submitted; reproduce whether delegate is re-approved.
- Old Close/Revoke signed for generation g1, close g1, create g2, then submit stale action; reproduce impact.
- Test explicit reauthorization, existing delegate replacement and shared-subscription impact.
- Test concurrent Init/Revoke/Close attempts and timeout/restart.
- Protocol fix must reject stale epoch/nonce/deadline and disable legacy unbound instructions.

**Gate**

Authority-control lifecycle: **BLOCKED for reliable revocation/re-authorization semantics** until protocol-level generation binding exists or residual risk is explicitly accepted. No automatic reapproval in v1.

### TM-05 — Full-period charge near finite Plan expiry (Cantina Medium, Acknowledged)

**Attack / impact**

The report says Subscribe accepts a finite Plan at the inclusive end boundary and does not bind customer consent to the Plan end timestamp or require one complete period remaining. Transfer may then collect a full period for a truncated or zero-length service window. A Plan Owner shortening the end time after the customer signs can also change the effective window because the signed Subscribe terms omit expected end time.

**Controls**

- Safest v1 profile: support only perpetual Plans (the exact on-chain perpetual representation must be verified against the pinned Program before coding). Do not assume a backend check can prevent a Plan Owner's direct on-chain update.
- If finite Plans are later proposed, require a fresh finalized Plan read and exact immutable terms snapshot, verify `now + period_seconds <= end_ts` using checked integer arithmetic, and bind customer consent to the observed end timestamp. The upstream instruction must enforce the same expected end timestamp and full-period condition to close the race; the current Program behavior does not establish that.
- Never use calendar-month math or floating point. Period and timestamps are integer seconds/hours derived from pinned Program semantics.
- Do not allow a SolMint-controlled Plan update to shorten a finite Plan below a full remaining billing period while subscriptions exist, unless the complete effects and customer consent are separately modeled. This is an application policy, not a protocol guarantee against direct Plan Owner actions.

**Database / backend invariants**

- Store exact Plan terms snapshot and on-chain Plan lifecycle/created time and end time as verified evidence.
- Reject enrollment when full-period eligibility cannot be established from chain state.
- Keep Plan sunset, end-time expiry, Subscription cancellation and actual pull collectability distinct.
- Do not advertise trial, proration, calendar month or fixed charge count without a separate tested contract.

**Recovery**

If an enrollment or pull occurs near/after expiry, reconcile actual transfer and service period. Do not auto-refund or auto-extend based only on expected UI terms; any adjustment requires a verified accounting/reversal policy and authorized decision.

**Adversarial tests / PASS evidence**

- Subscribe exactly at `end_ts`, one second before, and one full period before.
- Shorten end time after consent is signed but before Subscribe is submitted.
- Race Plan update with Subscribe.
- Test perpetual Plan boundary and integer overflow/checked-add.
- Confirm the service period and actual full-period debit are never misrepresented.

**Gate**

Finite Plan enrollment: **BLOCKED for v1** until Program-level end-time binding/full-period enforcement is available or the residual risk is explicitly accepted. Perpetual-only v1 remains a proposal pending verification of exact pinned Program semantics.

### TM-06 — Automatic rent sponsorship can lock relayer funds (Cantina Low, Acknowledged)

**Attack / impact**

The SDK/plugin can infer rent sponsorship from a different transaction fee payer and create long-lived sponsored Authority, delegation, subscription or Plan accounts. Some accounts cannot be reclaimed by the sponsor while healthy or active; non-expiring state can lock capital indefinitely. A user can create many sponsored accounts or abandon them.

**Controls**

- V1 default: no SolMint-funded customer/merchant rent sponsorship.
- Do not use SDK convenience behavior that silently infers sponsorship from `payer != identity`.
- Construct instructions with explicit payer/sponsor choice and omit optional rent payer unless a reviewed, explicit policy authorizes it.
- If sponsorship is introduced later: require explicit opt-in, finite lifetime/recovery design, per-user and aggregate quotas, maximum outstanding sponsored rent, monitoring, and an enforceable recovery path. A UI disclosure alone is not recovery.
- Keep network transaction fee payer separate from account rent sponsor and from token Source Authority.

**Database / backend invariants**

- Track rent sponsor, sponsored account, amount in lamports (integer), policy, outstanding exposure, expiry/recovery condition and refund outcome if sponsorship ever exists.
- Enforce quotas atomically; never rely on a dashboard-only limit.
- No sponsorship policy or schema is approved in this document.

**Recovery**

No automatic closure of customer-controlled accounts. Stop new sponsorship, reconcile outstanding accounts and use only a protocol-authorized recovery path. Do not promise sponsor refund if the Program does not allow it.

**Adversarial tests / PASS evidence**

- Assert transaction builders do not append an optional rent payer implicitly.
- Test customer cannot increase sponsorship by changing fee payer.
- Test per-user and global quota races if sponsorship is later enabled.
- Prove every sponsored account has an enforceable expiration/recovery path before enabling.

**Gate**

Rent sponsorship: **NOT IMPLEMENTED / DISABLED BY POLICY** for v1. Enabling it requires a separate approval and proof.

## 6. Cross-cutting threats and mandatory controls

### 6.1 Plan Owner and additional Pullers

**Threat:** SolMint's Collector is not the exclusive Puller. The Plan Owner is always authorized; up to four additional Pullers can also pull. An unobserved external Pull can consume period allowance before the Collector, change the remaining amount, or create accounting gaps.

**Controls:**
- Read the Plan's current Owner/Puller set and SubscriptionDelegation period-start/cumulative usage from finalized chain state before each billing decision.
- Discover and reconcile transfers from every authorized Puller, not only Collector signer transactions or SolMint jobs.
- Before signing, compute remaining capacity using integer atomic units from current on-chain cumulative usage and all reconciled pulls.
- If discovery coverage is incomplete, do not charge or mark the period reconciled.
- Collector must be a listed additional Puller, never a synthetic Plan Owner.
- A Plan with empty destination allowlist is rejected. Validate destination Token Account owner, mint, token program and canonical ATA derivation.

**Tests:** external Plan Owner pull before Collector; concurrent Owner/Collector pulls; other Puller pull; discovery gap; wrong destination owner; empty allowlist; cumulative amount boundary. Prove no overcharge and no duplicate ledger posting.

### 6.2 Shared Authority, delegate replacement and cross-subscription blast radius

**Threat:** The token delegate is shared per customer+mint and has one delegate slot. Replacing/revoking it can affect multiple subscriptions.

**Controls:** enumerate impacted subscriptions; disclose current delegate replacement; require explicit consent; read finalized ATA state; do not imply per-subscription revoke equals shared-authority revoke; entitlement is separately evaluated.

**Tests:** two subscriptions same customer+mint, replace delegate, revoke shared authority, close one Subscription only; prove the exact blast radius and customer messaging.

### 6.3 Collector compromise / arbitrary transaction signing

**Threat:** A compromised API, worker or key can sign unauthorized instructions or drain the scope permitted by the shared delegate/Plan.

**Controls:**
- Dedicated isolated signer boundary; Cloudflare Pages/Workers Secret is not an HSM.
- Signer accepts only server-authenticated, durable internal jobs; never arbitrary transaction bytes from a public endpoint.
- Re-derive and verify Program, Cluster, instruction discriminator, account order, PDA, Plan/Subscription/customer, authorized Puller, mint/token program, source ATA/delegate, destination owner/ATA, exact amount, period remaining, fee payer, blockhash and absence of extra instructions/CPI/transfer legs.
- Enforce per-job amount ceiling from the verified remaining on-chain period allowance; aggregate rate/volume limits and emergency kill switch.
- Key version, signer identity, policy decision, job/attempt, simulation, signature and outcome are audit logged; never log key material.
- Rotation, compromise response, disable Puller, revoke/reinitialize and customer notification procedures must be tested.

**Tests:** arbitrary message rejection; wrong cluster/program/PDA/account order; extra transfer; amount above remaining; unauthorized Puller; expired blockhash; duplicate job; compromised key simulation; kill switch; key rotation. No signer implementation is authorized by this document.

### 6.4 Billing Cycle, concurrency and uncertain RPC outcomes

**Threat:** Scheduler duplication, worker concurrency, crashes and RPC timeouts can produce double debit or false failure.

**Controls:**
- Cycle identity comes from actual on-chain Subscription period start, not scheduler date/calendar month.
- Require a database-enforced unique cycle identity and atomic claim/lease with fencing/version semantics before work begins.
- Persist an Attempt before signing/submission; do not keep DB transactions open across RPC or signer calls.
- Use short claim and finalize transactions. Network/signing occurs outside DB transactions.
- `UNKNOWN` is a first-class unresolved outcome, not Failed or Retryable.
- After timeout/restart, reconcile the original signature/message/blockhash/chain state before any new attempt.
- Include every authorized Puller and all observed transfers in cumulative allowance and accounting.

**Tests:** two concurrent workers, duplicate queue delivery, crash after claim, crash after signing, timeout after submit, RPC lag/fork, stale worker lease, duplicate signature, Plan Owner pull race. Verify one debit at most and one atomic accounting result.

### 6.5 Independent Subscription verification and atomic accounting

**Threat:** Ordinary Pay verifier assumes source authority/fee-payer semantics that differ from Subscription's shared Authority PDA and Collector fee payer. Reusing or weakening it could accept forged/incomplete transfers or corrupt accounting.

**Controls:**
- Keep `pay_apply_verified_observation` and ordinary Pay invariants unchanged.
- Implement a separate typed Subscription verification/DB adapter only after the actual schema, routine grants and transaction semantics are inspected and frozen.
- Verify finalized transaction, exact Program ID/discriminator/accounts, PDA derivations/ownership, Subscriber, Plan, every authorized Puller, Source ATA/Authority, Mint/Token Program/decimals, destination owner/ATA, transfer legs, exact amounts, cumulative period allowance, transaction success and absence of unexpected instructions/transfers.
- Events, signatures and indexer notifications are discovery/correlation evidence, not standalone proof.
- Commit verified observation, cycle/attempt outcome, merchant settlement, fee/revenue/referral/network-cost/refund entries and outbox event atomically. If atomic commit fails, no success/entitlement/webhook.
- Split principal+fee remains BLOCKED until two destination legs are proven to share one cumulative period allowance, rollback atomically, pass LiteSVM adversarial tests and Devnet E2E, and are verified/accounted by the dedicated adapter.

**Tests:** wrong cluster/program/mint/destination/amount/authority/puller; source authority != fee payer; extra token transfer; duplicate observation; non-finalized/failed tx; two-leg cumulative limit; DB rollback; ledger imbalance; RLS cross-merchant/customer isolation; outbox retry without duplicate accounting.

### 6.6 Supabase/RLS/Grants/Auth boundary

**Threat:** Cross-merchant/customer reads or writes, direct browser RPC execution, SECURITY DEFINER escalation, service-role overreach or an incorrectly scoped worker can mutate financial state.

**Controls:**
- All sensitive Subscription mutations are server-mediated.
- Merchant membership/RBAC is revalidated for every merchant operation; customer endpoints are scoped to the authenticated customer wallet/identity and only their own subscriptions.
- No browser access to service-role credentials or direct sensitive RPC.
- Every exposed table requires reviewed RLS policies, grants/revokes, views and function EXECUTE permissions; RLS enabled alone is insufficient.
- SECURITY DEFINER functions require fixed search_path, explicit caller capability/ownership checks and minimum grants.
- Cross-merchant and cross-customer tests must use distinct fixtures and hostile identifiers.
- No Production DDL while Issue #355 provenance and controlled migration policy remain unresolved.

**Tests:** anonymous, authenticated non-member, viewer vs finance/admin, merchant A vs merchant B, customer A vs customer B, direct RPC, function EXECUTE, view leakage, service-role scope, forged IDs, replayed idempotency keys. Use disposable DB only until migration policy is approved.

## 7. Squads v4 upgrade governance — external protocol risk

Finalized Mainnet evidence recorded at the 2026-10-31 checkpoint establishes the ProgramData upgrade authority is the inspected Squads v4 Vault/State pair. The current parsed state is 3-of-5; all five entries have Initiate/Vote/Execute permission mask 7; config authority is default/zero; timelock is 0 seconds. Real-world member identity and custody remain UNKNOWN.

Threat: once the threshold approves an upgrade, the zero-second timelock provides no additional enforced delay before execution. SolMint cannot assume it can veto, delay or control upstream Program changes.

Controls:
- Monitor ProgramData authority, deployment slot/ELF hash, canonical Program Metadata/IDL hash and relevant Program account state using approved Mainnet read-only RPC.
- Pin the expected Program ID, source commit, ELF hash, IDL hash and instruction layouts in the release policy.
- Any unexpected ProgramData/ELF/IDL/authority drift triggers a Subscription safety stop: stop new enrollments and Collector signing pending independent review; continue reconciliation of existing transactions and do not erase customer/accounting state.
- Do not attribute member keys to named people or the Solana Foundation without independent evidence.
- Do not create, sign, approve or execute Squads proposals as part of this application task.

Tests/evidence: monitor detects changed ProgramData slot/hash/authority/IDL; stale RPC/unknown account state fails closed; alert and kill-switch runbook tested. Monitoring is not yet implemented unless evidenced separately.

## 8. Required lifecycle state distinctions

These are semantic distinctions; final enum/column names are deferred until Contract Freeze:

- Consent prepared / wallet prompt shown / signed / submitted / outcome unknown / finalized and independently verified.
- Authority present / delegate approved / delegate replaced / delegate revoked / authority closed / authority status unknown.
- Subscription on-chain state / collectability / billing state / entitlement are separate dimensions.
- Cycle due / claimed / attempt prepared / signed / submitted / unknown / finalized / verified / accounted / retryable-before-submit / terminal failure.
- Cancellation requested / signed / submitted / unknown / finalized; Resume is separate and disabled in v1 pending control revision semantics.
- Payment success is allowed only after finalized transfer verification and atomic accounting commit.
- Webhook delivery status is not payment status.

No transition is approved by this list alone. A formal transition table with source of truth, actor, guard, side effect and recovery is a Contract Freeze deliverable.

## 9. V1 capability matrix — proposed, not yet implemented

| Capability | Proposed v1 decision | Why / gate |
|---|---|---|
| Create Plan | Restricted | Non-empty destination allowlist; exact terms read-back; real Plan Owner signer; verified Plan PDA |
| Finite Plan | Exclude | Upstream expiry/consent race not bound on-chain |
| Perpetual Plan | Candidate only | Verify exact Program representation and all lifecycle semantics first |
| Authority init | Restricted | Separate recent-blockhash customer transaction; no implicit reapproval; actual init_id read-back |
| Subscribe | Restricted | Separate transaction; actual init_id; immutable terms snapshot; no UNKNOWN_INIT_ID |
| Durable Nonce | Exclude | Retains stale signed authority/control actions |
| Pending smart-wallet / Squads / Swig proposals | Exclude | Delayed execution and cancellation/recovery not implemented |
| Immediate dual-signed CancelNow | Exclude | Same-second stale approval residual |
| Ordinary cancellation | Candidate only | Separate exact Program state machine and adversarial tests required |
| Resume | Exclude | Stale Resume can undo later cancellation |
| Authority reauthorization | Exclude by default | Stale Init can reapprove revoked delegate; explicit protocol-safe lifecycle absent |
| Shared Authority revoke | Restricted / do not promise global invalidation | Shared blast radius and old signed create residual |
| Collector | Exclude until isolated signer + policy + recovery | No signer or lifecycle implemented |
| Split principal + gateway fee | Exclude | Single-destination instruction; cumulative allowance/rollback/verifier/accounting unproven |
| Rent sponsorship | Disabled | No implicit sponsor; no enforceable recovery design |
| Customer entitlement | Exclude until verification/accounting | Active PDA is not paid/collectable |
| UI | Not started | No production contracts or lifecycle to present |

The table is a conservative design proposal. It does not authorize implementation or customer-facing claims.

## 10. Implementation sequence and release gates

### Gate G0 — Evidence and contract inventory

- Revalidate feature branch HEAD, PR, CI and relevant docs.
- Read current API/domain/database/migration/RLS/grants/auth/verifier/accounting code.
- Inspect exact pinned upstream IDL/source and test helpers.
- Resolve Cantina report count inconsistency with authoritative clarification.
- Resolve Issue #355 actor/trigger/integration state and document a controlled Production migration path.
- No new API/table/column/state names before inventory and design review.

### Gate G1 — Threat-model approval

- Review this document with product/security owner.
- Explicitly accept or reject the upstream residual risks; no silent acceptance.
- Confirm v1 capability exclusions, especially Resume, immediate CancelNow, finite Plans, reauthorization, rent sponsorship, Durable Nonce and pending smart-wallet proposals.
- Decide whether upstream protocol change is a prerequisite for launch. Current recommendation: the High old-signed-create finding blocks any claim of reliable revocation; if the business requires strong revocation, an upstream program fix is mandatory.

### Gate G2 — Contract Freeze

- Typed API/domain contract and lifecycle transition tables.
- Actual database schema, RLS, grants, function ownership/search_path and RBAC.
- Consent snapshot and exact on-chain evidence mapping.
- Billing Cycle/Attempt/idempotency/claim/recovery.
- Collector authorization and signer boundary.
- Dedicated Subscription verifier and atomic accounting/settlement.
- No Production DDL until Issue #355 is closed with evidence and migration policy is proven.

### Gate G3 — Implementation and adversarial evidence

- Unit/component/integration tests.
- Disposable database RLS/grants adversarial tests.
- LiteSVM tests for all applicable Program edge cases.
- Devnet mutating E2E with real customer test wallet and isolated test signer only after explicit authorization.
- Reconciliation, retry, crash and duplicate-attempt tests.
- Independent security review of new code and changed assumptions.

### Gate G4 — Release

- CI exact-head success.
- Production build.
- Devnet E2E evidence distinct from Mainnet read-only checks.
- Deployment smoke in intended environment.
- Release audit and rollback/recovery plan.
- Explicit approval for any Production migration, key/signer, live consent or Mainnet mutation.

## 11. Mandatory PASS evidence per finding

A finding is not PASS because the control is written here, a UI hides a button, a build succeeds, or a simulation passes. The minimum evidence is:

- **TM-01:** upstream stale signed bundle rejection after revocation through protocol-level epoch/nonce/tombstone enforcement, plus legacy instruction rejection; otherwise remain BLOCKED for strong revocation.
- **TM-02:** stale same-second CancelNow adversarial reproduction and either protocol incarnation binding or a documented, approved v1 exclusion/residual decision with builder and backend tests.
- **TM-03:** stale Resume adversarial reproduction and protocol-enforced cancellation revision/incarnation, or Resume excluded from v1 with proof it is unreachable through all SolMint endpoints/builders.
- **TM-04:** stale Init/Close/Revoke adversarial reproductions and protocol epoch/action nonce/deadline/delegate-state enforcement, or affected authority operations excluded with an approved residual-risk decision.
- **TM-05:** finite-plan boundary and post-consent Plan-shortening adversarial tests; protocol-enforced expected end/full-period guard, or finite plans excluded and perpetual-only semantics verified.
- **TM-06:** transaction-builder proof that no implicit rent payer is appended; no sponsorship path exposed. If later enabled, quotas and enforceable recovery tests.
- **Plan Owner/Pullers:** evidence that all authorized pull sources are discovered/reconciled and cumulative allowance cannot be exceeded.
- **Collector:** independent signer policy, key custody, rotation, kill switch and compromise recovery tests.
- **Verification/accounting:** independent finalized transaction verification plus atomic balanced ledger and entitlement gating.
- **Database security:** actual disposable DB schema, grants, RLS and cross-tenant adversarial test evidence.

## 12. Current status and explicit non-claims

As of feature HEAD `5b8d24b`:

- SDK/runtime compatibility harness: PASS (compatibility evidence only).
- Reproducible Program build and Mainnet ELF/source identity: PASS (identity only).
- Canonical on-chain IDL/source identity: PASS (identity only).
- Squads v4 Vault/State authority-chain parsing: PASS; member identity/custody UNKNOWN; zero-second timelock is a material operational risk.
- Cantina detailed findings: six Acknowledged items are conservatively tracked pending report clarification; summary/detail count inconsistency is unresolved.
- Production Subscription API/domain/schema/migrations: NOT IMPLEMENTED.
- Customer Consent lifecycle: NOT IMPLEMENTED.
- Billing worker/cycle claim/recovery: NOT IMPLEMENTED.
- Isolated Collector signer: NOT IMPLEMENTED.
- Dedicated Subscription verifier/accounting: NOT IMPLEMENTED.
- Subscription adversarial lifecycle suite: NOT IMPLEMENTED.
- Real Subscription transaction E2E: NOT IMPLEMENTED.
- Subscription UI: NOT IMPLEMENTED.
- Issue #355: OPEN; exact migration actor/trigger and current Supabase integration state UNKNOWN; Production DDL BLOCKED.
- Local Working Tree: UNKNOWN through remote GitHub connector.
- Stage 2: BLOCKED. Part 2.2: NOT STARTED.

No Production database, Cloudflare/Supabase configuration, Secret/Key, Collector signer, Mainnet account, Program, customer consent or Squads proposal was changed by authoring this design document.
