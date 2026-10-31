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

**Pinned Program behavior verified**

At `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`, `resume_subscription.rs` decodes only `expected_expires_at_ts` for this freshness check. It verifies:
- the signed subscriber owns the Subscription PDA;
- the Plan PDA matches and the Subscription is not currently active;
- live `expires_at_ts == expected_expires_at_ts`;
- Plan terms and current SubscriptionAuthority `init_id` still match;
- the cancellation has not already expired.

If these checks pass, it sets `expires_at_ts = 0`. It does not compare a cancellation revision, action nonce or Subscription incarnation supplied by the signer.

The pinned `cancel_subscription.rs` computes expiry from `current_period_start_ts` and the fixed period length. Two cancellations during the same billing period therefore compute the same expiry value. A concrete stale-approval path is:

1. Customer signs Resume against expiry `E`, but withholds the signed transaction.
2. Customer's first cancellation is active with `expires_at_ts = E`.
3. A separate valid action clears that cancellation (for example, an earlier Resume executes), then the customer cancels again during the same period.
4. The second cancellation again writes `expires_at_ts = E`.
5. The old withheld Resume still matches `expected_expires_at_ts = E`; if its transaction remains executable and the Plan/Authority checks still pass, it clears the newer cancellation and restores future collection.

The external audit report records a Durable Nonce reproduction. Recent-blockhash-only policy narrows the replay window but does not make the protocol check generation-safe.

**SolMint v1 controls — mandatory exclusion**

- Resume is excluded from v1. Do not expose a Resume button, route, API operation, job, SDK builder path or support workflow that constructs the instruction.
- Cancellation in v1 is one-way within the SolMint product. Do not present it as a reversible toggle or promise in-app reactivation.
- Do not accept Durable Nonce or unresolved smart-wallet/multisig proposals for any consent/control action.
- Serialize any supported cancellation/control transaction, reconcile its exact signature and finalized state, and never issue a replacement while the original outcome or validity is unresolved.
- A backend row version or single-flight lock is defense-in-depth only. A previously signed transaction can be submitted directly to Solana and bypass those controls.
- Excluding Resume from SolMint does not disable the upstream Program instruction for other wallets/clients. Do not represent this UI/API exclusion as a global on-chain prohibition.

**Protocol fix required before Resume can be enabled**

The Program must bind Resume to a monotonically increasing cancellation/action revision that is advanced by every Cancel and Resume operation. The revision/incarnation must survive Subscription PDA close/recreate; a counter stored only in the closable Subscription account is insufficient. Resume must provide the exact expected revision and the Program must reject stale values. The Program must also disable the legacy revision-less Resume instruction; adding a V2 path while the old discriminator remains callable is not closure.

**Database / backend invariants**

- If a backend representation is later designed, keep cancellation requested, signed, submitted, outcome-unknown and finalized as distinct states. Exact object/column names remain deferred to Contract Freeze.
- No backend transition to active or restored collection state from a wallet response, event, webhook or submitted signature.
- A previous Resume is not evidence that a later cancellation was reversed; only the final verified on-chain state is authoritative.

**Recovery**

Reconcile the exact Resume signature and finalized Subscription state. If an old Resume lands after a newer cancellation, record the actual on-chain state and alert the customer/merchant. Do not silently restore entitlement or auto-submit compensating instructions.

**Adversarial tests / PASS evidence**

- Reproduce Cancel → sign/withhold Resume → cancel again in the same period → submit old Resume; assert the current v0.5.0 Program behavior.
- Repeat with a recent blockhash and a Durable Nonce; verify the SolMint builder rejects Durable Nonce.
- Repeat across Subscription PDA close/recreate.
- Test that all SolMint routes/builders reject Resume in v1 and no UI/API/job can submit its discriminator.
- Test competing control actions, timeout, crash and reconciliation.
- For a future protocol fix, demonstrate stale revision rejection, persistence across close/recreate and rejection of legacy Resume instructions.

**Gate**

Resume: **NOT IMPLEMENTED and EXCLUDED from SolMint v1**. The upstream Program risk remains **BLOCKED** for reliable reversible cancellation until a protocol-enforced persistent revision/incarnation is deployed and adversarially verified.

### TM-04 — Stale authority-control approvals restore or destroy later authority state (Cantina Medium, Acknowledged)

**Pinned Program behavior verified**

At `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`:

- `initialize_subscription_authority.rs` creates the Authority PDA and stores `Clock::slot` as `init_id` only when the account is absent. Whether or not it was just created, the instruction then invokes Token `Approve` for the same Authority PDA with `u64::MAX`. Therefore an old signed Init can re-approve the shared delegate after the customer manually revoked the SPL delegate while leaving the Authority PDA open.
- `close_subscription_authority.rs` delegates to `close_authority`. That helper checks the stored owner and deterministic PDA derivation, but the signed Close instruction carries no expected `init_id`/generation and the helper does not compare one.
- `revoke_subscription_authority.rs` likewise derives the expected PDA from customer+mint, revokes the matching delegate if present, and closes the currently open Authority PDA. It has no expected generation in its instruction data.

Thus a held Close/Revoke signed for an earlier Authority lifecycle can target the same deterministic PDA after close+reinitialize. The new account has the same user, mint and PDA; the stale instruction has no signed value that distinguishes its generation. A held Init can also re-approve the delegate without changing `init_id` when the Authority account already exists.

**SolMint v1 controls — mandatory restrictions**

- Never use an idempotent Init as a retry or repair mechanism when the Authority PDA already exists but the SPL delegate is absent/different. It is an explicit reapproval of `u64::MAX`, not a harmless no-op.
- Do not automatically reinitialize/reapprove after a customer manually revokes the SPL delegate. Mark collectability unresolved and require a separately reviewed customer reauthorization flow; that flow is not enabled in v1.
- Do not expose self-service Authority Close/Revoke as a guaranteed permanent revocation while pending signed authority-control transactions may still execute.
- Use recent blockhash only and exclude Durable Nonce/pending wallet proposals; serialize authority actions and reconcile each exact signature before another. These measures reduce risk; they cannot invalidate external signed messages or remove the upstream replay condition.
- Explain that the shared Authority affects all subscriptions for one customer+mint. Never silently restore the delegate.
- A backend generation counter does not protect direct on-chain submissions.

**Protocol fix required for reliable authority lifecycle**

Bind Init, Close and Revoke to a persistent monotonic authority epoch/action nonce and the expected delegate state. The sequence must survive closing the Authority PDA; an epoch stored only inside that PDA would reset on recreation. Every successful control action must advance/consume the sequence. Disable the old unbound instruction formats after migration, including the current Init/Close/Revoke discriminators, or they remain an alternate path around the new checks.

**Database / backend invariants**

- Keep authority state separate from per-Subscription cancellation and from actual SPL delegate state.
- Enumerate all subscriptions affected by shared customer+mint authority operations.
- Do not mark authority active/revoked from request submission; verify finalized Authority PDA and token-account delegate state.
- Do not infer absence of pending approvals from SolMint's own database; it cannot observe signatures/proposals created elsewhere.

**Recovery**

On an unknown outcome, reconcile the original transaction and finalized Authority/token-account state. If an old Init restores the delegate, surface the state and require a fresh customer-approved recovery decision. If a stale Close/Revoke destroys a newer Authority, do not silently create a replacement; require fresh initialization and consent after reconciling existing delegations and all affected subscriptions.

**Adversarial tests / PASS evidence**

- Sign Init, revoke the delegate directly, then submit the held Init; verify delegate reapproval.
- Sign Close/Revoke for generation g1, close g1, create g2 at the same PDA, then submit the old action; verify whether g2 is closed/revoked.
- Test same-slot and later-slot close/recreate.
- Test that the SolMint builder never retries Init on an existing Authority and rejects reauthorization in v1.
- Test ambiguous submit, expired blockhash, external proposal exclusion, and cross-subscription impact.
- For a future protocol fix, demonstrate stale epoch/nonce rejection, persistence across close/recreate, expected delegate-state checking and rejection of all legacy unbound instructions.

**Gate**

Authority reauthorization/Close/Revoke: **NOT IMPLEMENTED as a SolMint customer flow and EXCLUDED from self-service v1 guarantees**. Strong permanent revocation and safe reauthorization remain **BLOCKED** until protocol-level persistent generation binding and legacy-instruction rejection are deployed and adversarially verified.

### TM-05 — Full-period charge near finite Plan expiry (Cantina Medium, Acknowledged)

**Pinned Program behavior — `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`**

- `SubscribeData` binds `expected_mint`, `expected_amount`, `expected_period_hours`, `expected_created_at` and the Authority `init_id`; it has no `expected_end_ts` field.
- `subscribe.rs` rejects an ended finite Plan only when `current_ts > end_ts`. Therefore `current_ts == end_ts` is accepted. It does not require `current_ts + period_length <= end_ts`.
- A successful Subscribe starts a new fixed-length period at the current chain timestamp and initializes `amount_pulled_in_period = 0`. It does not prorate the period allowance to the remaining Plan lifetime.
- `UpdatePlan` does protect its own approval with `expected_end_ts` and only allows a finite `end_ts` to be shortened. When the end is changed, `validate_plan_end_ts` rejects only if `current_ts + period_seconds > new_end_ts`; exact equality (one complete period remaining at update time) is accepted. That is a check at UpdatePlan execution, not a guarantee at a later Subscribe.
- Consequently, an owner can validly shorten a finite Plan to exactly one period ahead. Time then elapses; a previously signed Subscribe can still land while `current_ts <= end_ts` with less than one period remaining because Subscribe neither binds the observed end timestamp nor repeats the full-period condition.
- `TransferSubscription` also rejects only `current_ts > plan_end_ts`. It passes the configured per-period amount and the caller-requested transfer to `validate_recurring_transfer`, which enforces the cumulative period ceiling but has no time-based proration. The emitted `period_end_ts` is capped at `plan_end_ts`, so the recorded service window can be shorter than the fixed period while a full period amount remains permissible. At the exact Plan end boundary, the upstream helper test explicitly permits a transfer at `current_ts == expiry_ts`.
- The upstream README describes this as a full `amount` charge for a partial or zero-length first window at the exact boundary, without proration. This is not an automatic debit on Subscribe: an authorized Plan Owner/Puller submits the Transfer and chooses the transfer amount, up to the full per-period allowance.

**Attack / impact**

A customer may sign Subscribe after viewing a finite Plan's end date, but the signed Subscribe message does not bind that end date. If the Plan Owner shortens `end_ts` before the signed transaction lands, the Program can accept the old consent against the shorter Plan lifetime. A near-expiry Subscribe can therefore create a full-period allowance even though the first service window is truncated or zero-length. A simple server-side preflight (`now + period <= end_ts`) cannot close this race because the Plan can change after the read and before execution.

**Existing source tests and uncovered cases**

- `test_subscribe.rs` covers a normal Plan with 30 days remaining and rejects a Plan after the clock has advanced three days beyond its end. It does not cover Subscribe exactly at `end_ts`, one second before it, or after an end-time shortening between consent and execution.
- `common.rs` unit tests cover the `validate_plan_end_ts` threshold, including exact one-period equality and one second below. They test the Plan-update helper, not the Subscribe consent/expiry binding.
- `test_update_plan.rs` proves a finite Plan may be shortened (30 days to 10 days for a 24-hour period); it does not test a valid one-period-remaining shortening followed by delayed Subscribe.
- `transfer_validation.rs` includes `catch_up_at_exact_expiry_boundary_succeeds`, which allows a full per-period transfer at the exact expiry boundary. No inspected integration test proves that a partial final service window is prorated.
- These source files were reviewed at the pinned commit; they were not executed in this checkpoint.

**Current SolMint coverage**

`src/pay/services/subscriptionPlanPolicy.ts` uses integer `bigint` arithmetic and cluster-derived time to reject a finite Plan whose `endTs` is less than `chainTime + periodHours * 3600`; equality is accepted. This is Plan-input validation only. It neither binds `end_ts` into a signed Subscribe instruction nor provides an atomic guard against a later Plan update. At the current SolMint HEAD there is no production Subscription API, customer consent flow, Subscribe builder/submission path, Collector or Subscription verifier/accounting path. The helper must not be represented as an enforced enrollment control.

**V1 decision and required future protocol behavior**

- Exclude all finite Plans from SolMint Subscription v1; not merely Plans that are already within one period of expiry. The proposed v1 shape is `end_ts = 0` (perpetual), subject to the pinned Program's exact perpetual semantics. This is a design restriction, not an implemented product gate at the current HEAD.
- A fresh finalized Plan read, exact consent snapshot, pre-sign/pre-submit time check and display of the end date are defense-in-depth only. They do not eliminate the race while `SubscribeData` omits `expected_end_ts`.
- Before finite Plans can be enabled, an approved Program version must bind the exact expected Plan end into Subscribe and atomically enforce a full remaining first period with checked integer arithmetic. It must also specify and enforce the final-period charging rule (reject a truncated final period or apply an explicitly approved on-chain integer proration rule); merely capping the event's `period_end_ts` is not proration.
- SolMint must not issue an owner-side end-time shortening that truncates a consented/active customer's billing period unless that lifecycle and customer-consent effect is explicitly modeled and protocol-enforced.

**Recovery**

If an enrollment or pull occurs near/after expiry, reconcile the finalized transfer, actual period start/end and accounting record. Do not auto-refund, prorate off-chain, or extend service based only on expected UI terms; any adjustment requires an approved, verified accounting/reversal policy.

**Adversarial tests / PASS evidence**

- Subscribe exactly at `end_ts`, one second before, exactly one period before, and one second after the minimum-period boundary.
- Shorten `end_ts` after customer consent is signed but before Subscribe lands; race UpdatePlan and Subscribe in both orderings.
- Delay submission after a valid one-period-remaining UpdatePlan and prove Subscribe rejects once less than a full period remains.
- Attempt a full amount transfer at the exact expiry and during a truncated final period; verify the selected full-charge/reject/proration rule atomically.
- Verify event `period_end_ts`, actual service entitlement and ledger debit agree for every boundary case.

**Gate**

Finite Plan enrollment: **BLOCKED for v1**. Current SolMint's Plan-input validator is insufficient to enforce the restriction end-to-end, and no production Subscription flow exists. Keep finite Plans disabled in any future v1 API/transaction builder. Finite support requires the Program-level consent binding, first-period guard, explicit final-period rule and adversarial evidence above. Perpetual-only v1 remains a design restriction, not a delivered feature.

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
