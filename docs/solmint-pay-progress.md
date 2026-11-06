# SolMint Pay — Engineering Progress Ledger

This file is the durable project checkpoint for Pay work. Update it when a major gate is completed so later work does not repeat an already-validated stage.

## 2026-09-14 — Devnet E2E blocker closed

Status: **COMPLETED**

Merged PR: `#79`

Merge commit on `main`: `4f261f3173ba3948fb2f607c9762edb9ef059d5d`

Scope: stabilize the real Solana Devnet payment E2E path and transaction observation.

Validated before merge:

- Dedicated Devnet CI funding wallet is configured through GitHub Secret `DEVNET_E2E_FUNDER_SECRET_KEY_B64`; the private-key value is not stored in this document.
- Funder key material validation and public-key consistency validation passed.
- Real Devnet payment submission reached the verification path.
- Memo/reference account is a signer in the real E2E transaction construction.
- Funding, submission, observation, discovery and verification use the dedicated Devnet RPC path rather than an unreliable public faucet/RPC fallback.
- RPC transaction observation now first requires finalized signature status, then may use confirmed transaction details only to tolerate provider-side transaction-detail indexing lag. Effective finality is not downgraded by this fallback.
- `SolMint Pay Devnet E2E` passed.
- CI passed.
- Production Build passed.
- Solmint Pay Mainnet Read-only passed.
- Solmint Pay Production API Smoke passed.

Conclusion: the long-running **Devnet E2E funding/transaction-observation blocker is closed and must not be re-investigated unless a new regression appears**.

## 2026-09-14 — Production API origin gate closed

Status: **COMPLETED**

Merged PR: `#81`

Validated:

- Production Pages configuration contains the real `PAY_APP_ORIGIN` value used by the authenticated Pay API origin check.
- Production API smoke was rerun after deployment and passed.
- The earlier `403 ORIGIN_FORBIDDEN` result was a pre-deployment/stale-environment observation and is not the current production blocker.

## 2026-09-14 — Repository migration history reconciliation

Status: **COMPLETED**

Merged PR: `#82`

Merge commit on `main`: `16e8dfaf51a948920e1375f04db969d0fc86a411`

Scope: reconcile the repository migration chain with the live Production migration ledger without mutating the live database, and establish a preview-free validation path.

Live database evidence used for reconciliation:

- Live Supabase project: `nvopkbiedorfshwbmyhn`.
- The earlier reconciliation recorded 69 applied migration versions through `20260911061000`.
- Repository migration history was reconstructed from the live ledger and verified historical Git sources.
- The live database was not migration-repaired or otherwise mutated by this repository-only reconciliation.
- The incorrect local `20260905000100` mapping was corrected; `20260905000200` and `20260905000300` were restored.
- The seven Better Auth migrations were restored under the exact production-recorded timestamp/name mapping.
- The non-live root migration `20260906000001` was removed from the active chain in favor of the live `20260906135730` migration.

### Preview-free decision

Status: **COMMITTED PROJECT CONSTRAINT**

The project will not depend on Supabase Preview Branching/Preview Database for Pay delivery.

The maintainer does not have access to a credit card and cannot use a paid Supabase Pro/Branching environment. This is a delivery constraint, not a security exception. Production database/RLS remains authoritative.

### Preview-free validation path

1. Keep the production migration ledger as the source of truth for the applied migration history.
2. Validate the repository migration chain in GitHub CI.
3. Run Pay database security/adversarial SQL against isolated disposable PostgreSQL in CI.
4. Run CI/typecheck/unit tests and Production Build.
5. Reuse the already-validated dedicated Devnet E2E and Mainnet read-only/runtime smoke paths for blockchain behavior.
6. Never use a public RPC/faucet fallback as a production test assumption.
7. Do not run `supabase migration repair` against production unless a later explicit, evidence-backed reconciliation requires it.

The preview-free migration gate is an integrity/reproducibility check. It does not claim plain PostgreSQL is equivalent to Supabase Preview.

### Migration-chain gate repair

The first CI implementation failed correctly by detecting six stale/duplicate Better Auth/identity filenames in the branch while the canonical production names were missing. The test was not weakened.

A second issue in the new gate was also corrected: version-boundary comparison now uses numeric 14-digit migration timestamps so newer pending migrations are not rejected accidentally.

The migration lineage was then corrected using verified historical blobs: the exact production names are restored, redundant unsuffixed files are removed, and the newer repository migration `20260911103000_pay_webhook_read_projection.sql` remains an explicit pending migration until the live migration boundary advances beyond it.

### Final validation evidence

- `SolMint Pay Database Security` passed: migration-chain integrity, identity/RLS security, and API-key lifecycle security.
- `CI` passed: typecheck, production build, unit tests, and source-tree invariant.
- `Production Build` passed.
- Cloudflare Pages preview deployment for the final PR head succeeded.
- Repository code search found no remaining references to the removed legacy identity migration filename.

This checkpoint remains **completed**.

## 2026-09-14 — API credential security gate hardening

Status: **COMPLETED**

Merged PR: `#83`

Merge commit on `main`: `6b5cc0f2e31a461f739ab5aa13a40444cb8c3751`

Scope: close the repository/runtime security gaps found during Issue #68 acceptance work without inventing a new API contract or changing financial rules.

Validated before merge:

- Pay runtime no longer logs upstream Supabase response bodies on error. Only non-sensitive scope/status context is retained.
- A dedicated regression test proves secret-looking upstream error payloads are not emitted through the Pay database error logger.
- Production API smoke explicitly verifies API-key list/create endpoints fail closed on an untrusted `Origin` before authentication is attempted.
- `CI` passed.
- `Production Build` passed.
- `SolMint Pay Production API Smoke` passed.
- `SolMint Pay Devnet E2E` passed.

Conclusion: the **API credential runtime-redaction and origin-gate hardening stage is fully passed** and must not be repeated unless a regression appears.

## Cloudflare Workers Builds — identified external deployment integration

Status: **EXTERNAL / NOT A REPOSITORY FAILURE**

Evidence on relevant commits shows two separate Cloudflare check runs:

- `Cloudflare Pages` deploy — success.
- `Workers Builds: solsite` — failure, pointing to a separate Cloudflare Worker service named `solsite`.

The repository is configured for Cloudflare Pages, not for that separate Worker service. No GitHub Actions workflow in the repository owns the `Workers Builds: solsite` check.

Required remediation is a Cloudflare Dashboard integration action: disconnect the obsolete `Workers Builds` integration for that Worker service. Repository code must not be changed or a fake Worker created merely to make this unrelated check green.

## 2026-09-14 — Better Auth production session-boundary correction

Status: **COMPLETED**

Scope: align the shared application authentication boundary with the actual Better Auth cookie emitted by the deployed production runtime.

Evidence:

- Production sign-in for the controlled E2E account returns HTTP 200 and a Better Auth session cookie.
- The production cookie name observed in the authenticated smoke path is `__Secure-__Host-solmint_auth_session`.
- The shared auth boundary was corrected to recognize the deployed prefixed cookie form at the Better Auth session boundary.
- Authenticated production E2E subsequently passed on `main`.

## 2026-09-15 — Authenticated API credential lifecycle gate closed

Status: **COMPLETED**

Merged PR: `#85`

Final production evidence:

- `SolMint Pay Authenticated API-Key E2E` succeeded on `main`.
- Controlled production E2E covered authentication/session establishment, merchant authorization, create/list, idempotent replay, concurrency, wrong-scope rejection, cross-merchant IDOR rejection, rotation, old-secret rejection, rotation replay, revoke, post-revoke rejection, expiry, and plaintext-secret handling.
- Source-tree invariant passed after the E2E run.
- Issue `#68` is closed as completed.

Conclusion: the **production API credential lifecycle acceptance gate is closed**. This does not mark SolMint Pay production-ready.

## 2026-09-15 — Payment Intent implementation and contract hardening

Status: **COMPLETED**

Relevant merged PRs: `#87`, `#88`, `#92`, and subsequent replay-contract correction.

Current `main` HEAD at the time of this checkpoint update: `bbf5d6efe18077f7ca7b39e3f1f57a97b8bee737`.

### Payment Intent creation gate

PR `#87` introduced the controlled production Payment Intent creation E2E. The flow uses the real Better Auth session, a temporary `payment.create` API key, the controlled merchant, an existing verified receiving wallet, and real server-side Payment Intent creation. It verifies idempotent replay/conflict handling and revokes the temporary API credential afterward. No customer on-chain payment is performed by this gate.

PR `#88` corrected the E2E wallet-message signer by replacing the unsupported `Keypair.sign()` call with a supported detached Ed25519 signer.

A later manual run exposed an E2E runtime incompatibility caused by importing the Solana SDK into the wallet-message-only production creation harness. The harness was simplified so the production creation test uses the required Ed25519 signer without unnecessarily loading the incompatible SDK dependency graph.

A further wallet-verification failure exposed persisted challenge-integrity handling; PR `#92` hardened that boundary and made the manual workflow wait for the successful Cloudflare Pages deployment of the exact `main` commit before mutating the controlled fixture.

Finally, the production creation E2E replay assertion was aligned with the actual backend contract: a fresh idempotent create returns `201`, while a replay of the same completed request returns `200` and the same Payment Intent ID.

### Final creation-gate evidence

Run `35022672293`, Job `104562021327`:

- checkout succeeded;
- the exact `main` commit was successfully deployed by Cloudflare Pages before mutation;
- controlled Payment Intent E2E passed;
- source-tree cleanliness assertion passed;
- the complete job concluded `success`.

Therefore the **controlled Production Payment Intent creation gate is COMPLETED**.

### Live database/backend evidence

Current live Supabase project: `nvopkbiedorfshwbmyhn`.

The live `public.pay_payment_intents` table contains the authoritative `fee_recipient`, `merchant_net_atomic`, `merchant_settlement_atomic`, `customer_total_atomic`, and `verification_commitment` fields.

The live `public.pay_create_payment_intent` routine accepts `p_fee_recipient`, enforces the canonical fee/customer-total/merchant-net invariants, and snapshots the supplied server-side fee recipient into the Payment Intent.

The live migration ledger contains the Payment Intent hardening migrations through `20260915175809`.

### Controlled merchant wallet evidence

The controlled production merchant has exactly one active, verified receiving wallet. This is the merchant receiving destination and is intentionally distinct from the SolMint Pay gateway-fee recipient.

No private key or signing material for this wallet is stored in this ledger.

## 2026-09-15 — Gateway fee recipient recorded

Status: **CONFIGURED / RECORDED**

The public Solana address configured as `PAY_FEE_RECIPIENT` in `wrangler.toml` is:

`C9Cas87cue2YaHHTugTsQp6XP1Ho5CsbQNHCNi2rqSxz`

This is the configured **SolMint Pay gateway-fee destination**. It must not be confused with merchant principal, merchant receiving wallets, referral liabilities, Solana network-fee accounts, or refund destinations.

The durable reference is `docs/solmint-pay-gateway-fee-recipient.md` together with the runtime configuration in `wrangler.toml` and the authoritative Payment Intent `fee_recipient` field.

Important change-control rule: this address must not be replaced by assumption. Any future change requires an explicit production decision, synchronized runtime/backend configuration, contract-test updates, and a checkpoint entry.

No private key associated with this address belongs in repository code, documentation, client bundles, logs, URLs, or telemetry.

## 2026-09-15 — Payment Intent public read contract expanded

Status: **IMPLEMENTED / VALIDATED BY STATIC CONTRACT TESTS**

The public Payment Intent GET contract exposes these authoritative financial snapshot fields in addition to the existing amount/fee/status information:

- `feeRecipient`
- `merchantNetAtomic`
- `merchantSettlementAtomic`

The frontend `PayPaymentIntent` domain type and parser consume these values as server-authoritative atomic strings. Contract tests cover the newly exposed values.

The POST creation response remains narrower because the live `pay_create_payment_intent` routine currently returns its existing creation response shape. The complete authoritative snapshot must therefore be read from `GET /api/pay/v1/payment-intents/:id` rather than assumed from the POST response.

## 2026-09-15 — Temporary QA artifacts removed

Status: **COMPLETED**

Removed from `main`:

- obsolete `.github/workflows/_temp-pay-authenticated-e2e.yml` workflow;
- obsolete `__temp_test.txt` artifact.

This cleanup prevents temporary validation machinery from remaining in the production repository.

## 2026-09-16 — Wallet Ownership E2E fixture decoupling

Status: **IMPLEMENTATION CORRECTED / VALIDATION PENDING**

PR: `#109`

The Wallet Ownership E2E fixture was redesigned so it no longer depends on dedicated PR-local account/merchant secrets.

Implementation:

- Reuse the existing controlled Better Auth E2E account via `PAY_E2E_EMAIL` and `PAY_E2E_PASSWORD`.
- Reuse the existing cross-merchant security fixture `PAY_E2E_OTHER_MERCHANT_ID`.
- Resolve the primary Merchant through the real `GET /api/pay/v1/merchants` contract.
- When no Merchant exists for the authenticated E2E user, create it through the real authenticated `POST /api/pay/v1/merchants` contract.
- Keep the wallet signer ephemeral Ed25519 in CI; no private-key Secret is introduced.
- Do not perform direct Auth/DB INSERTs and do not introduce a new public API, field, financial rule, or production database behavior.

### Real CI failure and root cause

Manual Workflow Run `35119983044`, Job `104875005944`, failed before any Auth/Pay/backend interaction.

The runner successfully received the existing E2E secrets and completed dependency installation, but the Workflow checked out `main` at `bb7c1ad10b3ccfb8666cd83267e47e6b27b2f75c1`. The E2E source file exists on the Wallet Ownership test branch, not on that `main` snapshot.

The failing command was:

`bunx tsx e2e/pay-wallet-ownership-lifecycle.e2e.ts`

and the exact error was:

`ERR_MODULE_NOT_FOUND: Cannot find module '/home/runner/work/solsite/solsite/e2e/pay-wallet-ownership-lifecycle.e2e.ts'`

This was a Workflow ref-selection defect, not an authentication, Secret, database, wallet-signature, or Production API failure.

### Correction

The registered Workflow on `main` now exposes a `workflow_dispatch` input named `test_ref`, defaulting to:

`test/pay-wallet-ownership-lifecycle-v2`

The checkout uses that selected ref and a preflight verifies that the Wallet Ownership E2E source and its two wallet-challenge API files exist before dependencies/tests run.

The same Workflow correction was mirrored onto PR #109's test branch to prevent merge regression.

### Validation state

The gate remains **PENDING**. Run `35119983044` is recorded as an infrastructure/test-run failure and is not evidence against the wallet ownership backend contract itself. The next required evidence is a manual rerun using the default `test_ref` above, followed by analysis of the actual Wallet Ownership lifecycle results.

## 2026-09-18 — Wallet Ownership autonomous validation checkpoint

Status: **VALIDATION BLOCKED — EXTERNAL PRODUCTION RUNTIME CONFIG**

Authoritative evidence:

- main HEAD: `081a5023284493e0715cc2ec9f491bc11ce2de5b`.
- CI: Run `35283781161` — **PASS**.
- Production Build: Run `35283781011` — **PASS**.
- Authentication Build Verification: Run `35283780987` — **PASS**.
- Autonomous Wallet Ownership E2E: Run `35283781051` — **FAIL** at live authenticated merchant lookup with `503 AUTH_BRIDGE_PRIVATE_KEY_INVALID`.
- PR `#115` remains open, draft, with head `1458effbe54322500bfc3facec85c1f5b10a59e6`.

The Wallet Ownership E2E now executes without GitHub Workflow UI interaction. The old manual Wallet Ownership workflow was removed from `main`; the active one-shot runner is triggered only by the controlled repository trigger file.

The E2E harness itself was revalidated against Better Auth 1.7.2. Its credential fixture requires the documented credential issuer `local:credential`, uses the repository Better Auth-compatible password hashing, and the E2E branch was restored to the clean lifecycle test before the issuer fix. Relative to the clean fixture baseline, the current PR test branch has only the issuer correction.

The live Production failure is therefore not being treated as a test-fixture failure. The Pay internal JWT bridge rejects the currently deployed Cloudflare runtime value for `SUPABASE_INTERNAL_JWT_PRIVATE_KEY`. Repository code intentionally requires a server-side PKCS#8 PEM key and does not introduce a client fallback, RLS bypass, or weaker parser to accommodate a malformed secret.

No success is inferred from the attached status report or from unrelated Auth/CI green checks. Wallet Ownership remains open until a fresh authenticated Production lifecycle run reaches the challenge/signature/replay/concurrency/expiry assertions successfully.

**Do not repeat:** GitHub Workflow registration troubleshooting, nested `workflow_dispatch` dispatching, DB password/pooler troubleshooting for this fixture path, or Better Auth credential issuer debugging unless a new regression is demonstrated.

**Next action:** correct the existing Cloudflare Pages production secret for `SUPABASE_INTERNAL_JWT_PRIVATE_KEY` in the production runtime, then rerun the autonomous Wallet Ownership E2E. After that run is green, record the Gate as **COMPLETED** and proceed to the funded Devnet Payment Intent reconciliation gate.
## 2026-09-18 — Wallet Ownership and funded Devnet reconciliation gate closed

Status: **COMPLETED**

Final merged implementation:

- PR #116 was squash-merged.
- Merge commit: dca631ea7a0caa2300241f6470d72448a5ff6a99.
- Production migration 20260918153647_solmint_pay_wallet_rotation_atomicity was applied and recorded in the live migration ledger.
- The root production failure in concurrent wallet rotation was fixed at the database transaction boundary: the existing active receiving wallet is deactivated before the challenged wallet is promoted, while both updates remain inside the same transaction.
- The Wallet Ownership One-Shot harness was corrected to checkout merged main rather than a stale test branch.

Authoritative validation:

- Production Wallet Ownership One-Shot #23: PASS after the database rotation-order correction.
- Merged-main Wallet Ownership One-Shot #24: PASS.
- SolMint Pay Live Smoke #22: PASS after the merged deployment.
- SolMint Pay Production API Smoke post-merge: PASS.
- SolMint Pay Database Security post-merge: PASS.
- SolMint Pay Devnet E2E post-merge: PASS, including real payment verification and Payment Intent reconciliation.
- Post-merge CI, Production Build, and Authentication build verification: PASS.
- Issue #101 is closed as completed.

The Wallet Ownership lifecycle gate and funded Devnet reconciliation gate are therefore closed. No bypass, synthetic Production financial state, or frontend-derived payment-success assumption was used.

## 2026-09-18 — Pay SECURITY DEFINER path hardening

Status: **COMPLETED**

Production migration:
- 20260918154623_solmint_pay_security_definer_search_path_hardening

Validated:
- All remaining Pay SECURITY DEFINER routines now use search_path=''.
- Sensitive Pay mutation routines remain service_role-only.
- Pay authenticated SELECT policies remain merchant/affiliate scoped.
- Post-change CI passed.
- Post-change Production Build passed.
- Post-change Authentication Build Verification passed.
- Post-change SolMint Pay Database Security passed.
- Supabase Security Advisor no longer reports the previously identified Pay SECURITY DEFINER search_path issue.

## 2026-09-18 — Final Release Audit status

Status: **BLOCKED — RELEASE CONTROL**

Completed operational evidence:
- Wallet Ownership Lifecycle on merged main: PASS.
- Funded Devnet verification and Payment Intent reconciliation: PASS.
- Production API Smoke: PASS.
- Production Live Smoke: PASS.
- Database Security: PASS.
- CI / Production Build / Authentication Build Verification: PASS.

Blocking evidence still required:
- GitHub main branch protection / equivalent required-status enforcement. Current repository metadata reports main as protected=false and rulesets are empty. Issue #117 tracks the required maintainer action.
- Production rollback/recovery evidence has not been independently closed by the release audit.

Separate security track:
- Issue #38 remains open for pre-existing site-wide SECURITY DEFINER and broad-grant findings. Pay-specific access controls are separately hardened and have not been treated as resolved by closing that issue.
## Explicitly not complete yet

Do not mark SolMint Pay production-ready.

Completed gates now include:

- API credential lifecycle.
- controlled Payment Intent creation.
- Wallet Ownership Lifecycle.
- funded Devnet payment verification.
- funded Devnet Payment Intent reconciliation.
- adversarial payment-verification contract coverage used by the merged Wallet Ownership work.
- post-merge Production Build, CI, Database Security, Production API Smoke, Live Smoke, and merged-main Wallet Ownership E2E.

Still open:

- final Security / Release Audit.
- production rollback / recovery evidence.
- branch-protection enforcement evidence.
- any remaining release-gate findings from the audit.

The external Cloudflare Workers Builds: solsite check remains separate from the Pages delivery path, and Supabase Preview remains outside the committed preview-free Pay delivery path.

## Working rule

Before starting a new Pay task:

1. Read this ledger and the master specification.
2. Check the current `main` HEAD and relevant CI evidence.
3. Revalidate the real backend/database contract for the requested capability.
4. Never repeat the Devnet funding/observation work unless CI demonstrates a regression.
5. Do not add Supabase Preview Branching as a prerequisite for Pay delivery.
6. Record a gate as **COMPLETED** only after the relevant implementation, validation, and release evidence are actually green.


## 2026-09-18 — Merchant receiving-wallet frontend/backend binding checkpoint

Status: **IMPLEMENTED / VALIDATION BLOCKED BY EXTERNAL DEVNET FUNDING**

Repository state reconciliation:

- Base `main` HEAD when this checkpoint was evaluated: `964df8a26022c9efedd6695859dd684f945800c9`.
- This checkpoint was then recorded on `main` by documentation commit `4d6af9f9958fa66e9e38d8293428398a2ff13e6a`.
- PR `#118` is already present on `main` and hardens the existing wallet-verification UI against stale merchant state, localized state/progress, and unexpected provider errors.
- PR `#122` is open on top of this `main` and adds the authoritative receiving-wallet snapshot to the existing Merchant GET contract.

Contract implemented in PR `#122`:

- Reuses the existing `GET /api/pay/v1/merchants` endpoint.
- Reads `pay_merchant_wallets` through the authenticated identity path.
- Exposes only the wallet matching `wallet_role=receiving`, `is_active=true`, and `verification_status=verified`.
- Frontend parses the snapshot fail-closed and maps it to the existing `PayMerchant` domain model.
- Merchant onboarding displays the persisted authoritative wallet/verification timestamp after reload instead of relying only on transient browser state.
- No new payment rule, secret, private key, RPC, or direct browser database access was introduced.

Live database evidence reconfirmed on 2026-09-18:

- `public.pay_merchants` and `public.pay_merchant_wallets` have RLS enabled.
- Authenticated SELECT on both tables is restricted by the existing `pay_has_merchant_access(...)` policies.
- `pay_merchant_wallets` contains the existing receiving-wallet, active-state, verification-status, and verification-timestamp fields used by this contract.

PR validation after test-fix commit `b6ed7a17ea11a26c63c18f25030e87d5707576a0`:

- CI run `35369298851`: **PASS**.
- Production Build run `35369298809`: **PASS**.
- SolMint Pay Database Security run `35369298783`: **PASS**.
- SolMint Pay Production API Smoke run `35369298816`: **PASS**.
- SolMint Pay Mainnet Read-only run `35369298799`: **PASS**.
- SolMint Pay Devnet E2E run `35369298897`: **BLOCKED/FAILURE — EXTERNAL FUNDING**, before the real payment flow: the configured Devnet funder had `0.000680 SOL` while this flow requires at least `0.510100 SOL`.

The CI failure in the first PR run was a real test defect (`getMyMerchant is not defined`) and was corrected in commit `b6ed7a17ea11a26c63c18f25030e87d5707576a0`. The remaining Devnet failure is not evidence of a repository regression; it is an exhausted external CI funding fixture.

Do not repeat:

- the already-passed Wallet Ownership backend/reconciliation gate;
- Better Auth/JWT bridge debugging;
- Devnet RPC redesign;
- Supabase Preview setup;
- the fixed merchant-wallet test import defect.

Next gate:

1. Replenish the existing dedicated Devnet funder sufficiently for the real E2E.
2. Rerun the existing `SolMint Pay Devnet E2E` workflow against the current PR head.
3. If that run is green, recheck the full required PR evidence and merge `#122`.
4. Immediately after merge, run the production deployment/runtime smoke and continue the next contract-backed Pay surface. Do not mark production-ready until the separate branch-protection and rollback/recovery release controls are also closed.



## 2026-09-19 — Wallet-status contract merged and release runbook committed

Status: **COMPLETED / NEXT RELEASE GATES OPEN**

Authoritative merge evidence:

- PR #122 `feat(pay): expose authoritative merchant receiving wallet` was squash-merged.
- Merge commit: `85f88aaf3b44293f07a44f3031b4f9b1396f9e9c`.
- Issue #121 was closed as **completed** after the merged contract restored persistent authoritative receiving-wallet state in Merchant UI.
- The dedicated Devnet E2E rerun `35369298897` completed **successfully** after the existing dedicated funder was replenished.
- The previous Devnet blocker (`0.000680 SOL` vs `0.510100 SOL` required) is therefore closed. Do not repeat funder/RPC investigation unless a new regression appears.
- PR #123 `docs(release): add Cloudflare Pages rollback and recovery runbook` was squash-merged.
- Merge commit for the rollback runbook: `de80ad1e2a60ad0edcc52ec47e15adbee9b31929`.

Post-merge release-control state:

- The receiving-wallet contract is now part of `main`.
- The production runbook for Cloudflare Pages rollback/recovery is now part of `main`.
- The runbook is documentation/evidence preparation only; it does **not** count as a completed controlled rollback validation.
- GitHub main branch protection / required-status enforcement remains an open release gate (Issue #117).
- Production rollback/recovery validation remains an open release gate (Issue #120).
- Pre-existing site-wide security debt remains tracked separately in Issue #38.

Current next engineering sequence:

1. Revalidate the merged `main` against the production deployment and post-merge Pay smoke evidence.
2. Close any deployment/runtime regression before starting a new surface.
3. Continue the Backend-first contract pipeline for Invoices / Payment Links and then Referrals/Affiliates where the live schema provides the required source of truth.
4. Only enable frontend surfaces after server-mediated API contract + tests exist.
5. Keep Customers/Reports/Developer/Security/Notifications/Refunds as UNKNOWN/BLOCKED where no released API contract exists; never create placeholder financial data.

Release rule remains unchanged: SolMint Pay must not be called production-ready until all applicable security, database/RLS, authentication/authorization, verification/reconciliation, deployment, rollback, branch-protection, and runtime evidence gates are green.


## 2026-09-19 — Invoice and Referral read surfaces merged

Status: **COMPLETED / FRONTEND-BACKEND READ BINDING EXPANDED**

Authoritative merge evidence:

- PR #124 `feat(pay): add authoritative invoice read surface` was squash-merged.
- Merge commit: `3eac09de24ebdddf97143b0d8cc1de6b6a05c821`.
- Validation before merge: CI `35439728410`, Production Build `35439728394`, Database Security `35439728404`, Production API Smoke `35439728407`, Mainnet Read-only `35439728385`, Devnet E2E `35439728416` — all **PASS**.
- The Invoice UI is read-only and consumes the real `pay_invoices` contract through the central Pay service layer. Amounts remain atomic strings; no invoice mutation or financial calculation is invented.

- PR #125 `feat(pay): add authoritative referral read surface` was squash-merged.
- Merge commit: `bca504cd5517d887b09877afc37f23fa913cd051`.
- Final validation after the translation/type correction: CI `35439913062`, Production Build `35439913046`, Database Security `35439913059`, Production API Smoke `35439913051`, Mainnet Read-only `35439913124`, Devnet E2E `35439913077` — all **PASS**.
- The Referral/Affiliate UI reads `pay_affiliates`, `pay_referrals`, and `pay_commissions` through authenticated server mediation and does not calculate commission, payout, tier, or withdrawal truth.
- Issue #121 was already closed after the merged receiving-wallet contract.

Current roadmap interpretation:

- Merchant / Wallet verification, Dashboard, Transactions, Checkout / Payment Intent, API Keys, Webhooks, Tickets, Invoices (read), and Referrals/Affiliates (read) now have real frontend/backend bindings.
- Customers, Reports, Developer, Security, Notifications, Refunds, and Invoice/Referral mutations remain unimplemented where no released HTTP contract exists. They must remain UNKNOWN/BLOCKED rather than placeholders pretending to be operational.

Next engineering gate:

1. Reconcile the current Payment Links table and any existing backend routines/routes.
2. Add only a contract-backed read/mutation surface that is supported by the live schema and server API.
3. Validate through the full applicable CI/security/build/Devnet/Mainnet evidence.
4. Update this ledger after merge before starting the next surface.

Release controls remain separate:
- Branch protection evidence: Issue #117.
- Controlled rollback/recovery evidence: Issue #120.
- Site-wide pre-existing security debt: Issue #38.


## 2026-09-19 — Payment Links read binding merged

Status: **COMPLETED / READ CONTRACT**

- PR #126 `feat(pay): add authoritative payment links read surface` was squash-merged.
- Merge commit: `4834487e9274ba64f0ea6132fd4c08a3c9607b66`.
- Validation before merge: CI `35440046597`, Production Build `35440046559`, Database Security `35440046640`, Production API Smoke `35440046570`, Mainnet Read-only `35440046578`, Devnet E2E `35440046550` — all **PASS**.
- The Payment Links UI reads the real `pay_payment_links` table through an authenticated server-mediated endpoint.
- No public checkout URL, create/edit/delete action, or financial rule was invented because the live backend currently exposes no released mutation contract for Payment Links.

## 2026-09-19 — Security overview merged

Status: **COMPLETED / OBSERVABILITY-STYLE SECURITY UX**

- PR #128 `feat(pay): add contract-backed security overview` was squash-merged.
- Merge commit: `a2926881bddde7f08da706c97758b4288841a467`.
- Validation before merge: CI `35440160243`, Production Build `35440160229`, Database Security `35440160232`, Production API Smoke `35440160228`, Mainnet Read-only `35440160248` — all **PASS**.
- Security UI is intentionally descriptive rather than evaluative: it surfaces the current receiving-wallet verification snapshot, API-key status counts, and webhook signing/active state without producing a security score or guarantee.
- No new Security API endpoint was created.

Current frontend/backend binding coverage now includes:

- Merchant onboarding / Wallet Ownership verification.
- Dashboard activity.
- Transactions and transaction detail.
- Checkout / Payment Intent read + verification.
- API key lifecycle.
- Webhook read/delivery history.
- Support Tickets.
- Invoices — read-only.
- Payment Links — read-only.
- Referrals/Affiliates/Commissions — read-only.
- Customers — read-only, merchant-scoped customer projection.
- Reports — read-only, backend/DB-derived report summary.
- Security overview — read-only configuration state.

Still contract-blocked / not enabled:

- Notifications.
- Developer Portal documentation/API contract surface beyond existing API-key/webhook controls.
- Refund mutation UI.
- Invoice creation/mutation.
- Payment Link creation/mutation.
- Referral enrollment/mutation and payout/withdrawal operations.

These remain disabled or represented as unavailable states rather than mock functionality.

Release controls remain:

- Issue #117 — enforce branch protection / required-status checks on `main`.
- Issue #120 — perform and document a controlled Cloudflare Pages rollback/recovery validation.
- Issue #38 — separate site-wide pre-existing security debt, not closed by Pay-specific hardening.

The external Cloudflare Workers Builds integration remains separate from the Pages deployment path.


## 2026-09-19 — Production auth smoke coverage for new read contracts

Status: **COMPLETED / PRODUCTION AUTH READ-CONTRACT GATE**

Authoritative merge evidence:

- PR #133 `test(pay): add production auth checks for new read contracts` was squash-merged.
- Merge commit: `dbb6862af3d6e67b7b62e51bdc2649cdcb2ada84`.
- Production API Smoke run `35440600192`: **PASS**.
- CI run `35440600216`: **PASS**.
- Production Build run `35440600314`: **PASS**.
- The added checks are non-mutating and verify that unauthenticated requests to the Invoice, Payment Link, and Referral read endpoints fail closed with the real `401 UNAUTHORIZED` contract.
- No production fixture mutation, synthetic financial state, or authentication bypass was introduced.

Conclusion:

The newly released read contracts now have explicit production unauthenticated-fail-closed regression coverage on `main`. This gate is completed and should not be repeated unless a regression appears.

Current active release blockers remain:

- Issue #117 — GitHub `main` branch protection / required-status enforcement evidence.
- Issue #120 — controlled Cloudflare Pages rollback/recovery validation evidence.
- Issue #38 — separate pre-existing site-wide security debt.

Next engineering focus:

- Continue only with backend-contract-backed Pay capabilities or release-control closure.
- Do not fabricate Customers, Reports, Notifications, Refund mutation, Invoice/Payment-Link mutations, or Referral enrollment/payout operations without released contracts.


## 2026-09-20 — Customers backend/frontend contract completed

Status: **COMPLETED / PRODUCTION-VERIFIED**

Authoritative implementation:

- PR #134 `feat(pay): add authoritative Customers read surface` was squash-merged.
- Merge commit: `ef4aa73111d7061a8517ed63ba62c84fce46ab5a`.
- Added `GET /api/pay/v1/customers` as an authenticated, read-only, merchant-scoped server contract.
- Customer identity is derived only from the persisted non-empty `customer_wallet_address` on authoritative `pay_payment_intents` records.
- Added the read-only `public.pay_customer_projection` PostgreSQL view using `security_invoker = true`, preserving the underlying Pay RLS boundary.
- Added the central frontend service, Customers UI, responsive styling, and fa-IR/en-US/ar/ru translations.
- Removed the previous unavailable/placeholder rendering path for the now-real Customers section.
- Published the contract in OpenAPI 1.3.0 and the API Catalog.
- No customer financial calculation, payment-success inference, private-key data, or service-role credential was introduced into the client.

Validation before merge:

- CI run `35503836414`: **PASS**.
- Production Build run `35503836358`: **PASS**.
- SolMint Pay Database Security run `35503836312`: **PASS**.
- SolMint Pay Production API Smoke run `35503836391`: **PASS**.
- SolMint Pay Mainnet Read-only run `35503836345`: **PASS**.
- SolMint Pay Devnet E2E run `35503836399`: **PASS**.

Production database validation:

- The customer projection migration was applied successfully to live Supabase project `nvopkbiedorfshwbmyhn`.
- Live migration ledger recorded the applied version as `20260920100630`.
- Repository migration filename was corrected in PR #135 to `20260920100630_solmint_pay_customer_projection.sql` so repository and live migration history remain aligned.
- PR #135 merge commit: `e1a846cc79c341457ac37d251f71ed3b10c8f203`.
- Post-rename Database Security run `35504157799`: **PASS**.
- Post-rename Production Build run `35504157818`: **PASS**.
- Post-rename CI run `35504157797`: **PASS**.
- Live verification confirmed `pay_customer_projection` is a PostgreSQL VIEW with SELECT granted to `authenticated`; `anon` has no SELECT grant.
- A transactionally isolated SQL validation was performed against the live PostgreSQL version before permanent application and rolled back successfully.

Production deployment/auth evidence:

- PR #136 added the non-mutating production unauthenticated Customers regression check.
- Production API Smoke run `35504239098`: **PASS**.
- The deployed production endpoint returned the expected `401 UNAUTHORIZED` contract for an unauthenticated Customers read request.
- CI run `35504239083`: **PASS**.
- Production Build run `35504239109`: **PASS**.
- PR #136 merge commit: `350bc80e9ac59364b71f6af04011117ca2cfecdf`.

Security note:

- Supabase Security Advisor still reports pre-existing site-wide findings (including RLS-enabled/no-policy findings and public SECURITY DEFINER functions). These were observed after the Customers migration and are not newly introduced by this feature.
- The Pay-specific Customer projection uses `security_invoker` and does not weaken existing Pay RLS.

Conclusion:

The **Customers section is now a real Backend-backed, RLS-mediated, production-deployed read surface**. It is no longer an unavailable placeholder. Customer mutations, profiles, names, email/CRM data, or customer-level financial analytics remain outside the released contract and were intentionally not invented.

Next engineering focus:

- Continue with the next Backend-contract-backed Pay capability, prioritizing Reports/Analytics only after its authoritative metric sources and definitions are established.
- Reconcile any remaining frontend/backend mismatches discovered during that implementation.
- Record each completed capability in this ledger before moving to the next one.

Release controls remain separate:
- Issue #117 — main branch protection / required-status enforcement evidence.
- Issue #120 — controlled Cloudflare Pages rollback/recovery evidence.
- Issue #38 — pre-existing site-wide security debt.


## 2026-09-20 — Reports backend/frontend contract completed

Status: **COMPLETED / PRODUCTION-VERIFIED**

Authoritative implementation:

- PR #137 `feat(pay): add authoritative Reports read surface` was squash-merged.
- Merge commit: `10e1f0a6a09c9ceb62974f7413b70d85e6c0f250`.
- Added authenticated read-only `GET /api/pay/v1/reports`.
- Added PostgreSQL `public.pay_read_report(uuid,timestamptz,timestamptz)` as `SECURITY INVOKER`, with pinned empty `search_path` and authenticated-only execution.
- Report metrics are derived in Backend/DB from authoritative `pay_payment_intents` and visible `pay_revenue_ledger` records.
- Financial values remain decimal strings representing atomic units; the Frontend does not calculate payment amounts or revenue.
- Added period filters (today / 7 / 30 / 90 days / custom), daily trend, status summary, completion-rate basis points, customer count, completed payment amount, fee snapshot, and recognized revenue fields.
- Added fa-IR/en-US/ar/ru translations and loading, empty, stale, unauthorized, forbidden, retryable states.
- Fixed a Frontend refresh-loop risk and replaced an unsafe `Number()` financial formatter with integer-safe `BigInt` formatting before merge.
- Published OpenAPI 1.4.0 and the API Catalog.

Validation before merge:

- CI run `35504527862`: **PASS**.
- Production Build run `35504527979`: **PASS**.
- SolMint Pay Database Security run `35504527858`: **PASS**.
- SolMint Pay Production API Smoke run `35504527895`: **PASS**.
- SolMint Pay Mainnet Read-only run `35504527905`: **PASS**.
- SolMint Pay Devnet E2E run `35504527872`: **PASS**.

Revenue-ledger authorization completion:

- Live validation initially exposed a real backend permission gap: authenticated report execution reached `pay_revenue_ledger` but had no SELECT grant.
- PR #138 `fix(pay): secure report revenue ledger access` was merged as `88a35f5cd4fa37e37302715fe2086e9a654c1ef8`.
- Added authenticated SELECT + merchant-scoped RLS on `pay_revenue_ledger`; anonymous access and mutation privileges remain denied.
- Added an isolated adversarial security fixture covering the exact report function, authenticated/anonymous function privileges, revenue-ledger access, and merchant A/B isolation.
- CI run `35504967068`: **PASS**.
- Production Build run `35504966996`: **PASS**.
- Database Security run `35504967044`: **PASS**.
- Live Supabase migration recorded the RLS change as version `20260920102516`.

Migration lineage:

- The already-applied report function was recorded live as `20260920101617`; PR #138/PR #139 aligned the repository migration filename to that live version.
- PR #139 `fix(pay): align revenue RLS migration with live ledger` was merged as `6d24574de2d2c0e1268c52ad0374e5a991977a8f`.
- Repository now tracks the live revenue-ledger migration as `20260920102516_solmint_pay_report_revenue_ledger_rls.sql`.
- Post-alignment CI run `35505112554`: **PASS**.
- Post-alignment Production Build run `35505112560`: **PASS**.
- Post-alignment Database Security run `35505112542`: **PASS**.

Live database authorization verification:

- With a real active merchant identity, `pay_read_report` returned only that merchant's Payment Intent data.
- Requesting the second merchant with the first merchant's identity returned an empty report rather than cross-tenant data.
- `authenticated` has EXECUTE on the report function and SELECT on the revenue ledger.
- `anon` has neither.
- Current E2E merchant data contains 3 Payment Intents in the tested period, all in `created` state; therefore completed amount and recognized revenue are legitimately `0` for that merchant. The Frontend does not manufacture or infer these values.

Production deployment/auth evidence:

- PR #140 `test(pay): verify Reports production auth boundary` was squash-merged as `b23977d0363af94a4d9a44580baf5d3b325c7497`.
- Production API Smoke run `35505158498`: **PASS**.
- The deployed production Reports endpoint returned the expected `401 UNAUTHORIZED` contract to an unauthenticated request.
- CI run `35505158516`: **PASS**.
- Production Build run `35505158495`: **PASS**.

Conclusion:

The **Reports section is now a real Backend/Database-backed, merchant-scoped, production-deployed read surface**. It does not invent financial KPIs, bypass RLS, or perform authoritative payment/revenue calculations in the browser.

Remaining Pay capabilities intentionally not enabled because their released backend contracts are still absent:

- Notifications.
- Refund mutation UI.
- Invoice creation/mutation.
- Payment Link creation/mutation.
- Referral enrollment/mutation and payout/withdrawal operations.
- Developer Portal documentation/API contract surface beyond existing API-key/Webhook controls.

Release controls remain separate:
- Issue #117 — main branch protection / required-status enforcement evidence.
- Issue #120 — controlled Cloudflare Pages rollback/recovery evidence.
- Issue #38 — pre-existing site-wide security debt.

## 2026-09-20 — Pre-existing site security debt remediation

Status: **COMPLETED / PRODUCTION HARDENED**

Issue: #38

Production evidence:

- Supabase migration 20260920131133 was applied successfully to the live project nvopkbiedorfshwbmyhn.
- The five pre-existing category/media SECURITY DEFINER functions no longer expose EXECUTE to PUBLIC, anon, or authenticated.
- Their search_path is pinned to the empty path (search_path="") to remove public-schema path-shadowing risk.
- Direct INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER privileges were removed from anon and authenticated on article_categories and category_default_media_assets; required read access remains.
- All direct privileges on private_service_secrets were removed from anon and authenticated.
- A transactional production preflight passed before the permanent migration was applied.
- Post-migration live privilege verification passed for function execution and table DML/read boundaries.
- Security Advisor no longer reports the five pre-existing anonymous SECURITY DEFINER executable findings. Remaining Advisor findings are separate existing debt/intentional Pay SECURITY DEFINER boundaries and the existing pg_net extension placement; they are not claimed as resolved by this checkpoint.

Regression coverage:

- supabase/tests/site_security_hardening.sql verifies the exact client privilege boundary.
- The existing SolMint Pay Database Security workflow now executes this regression fixture.
- Corrected CI run 35512939739 — PASS.
- Production Build run 35512939751 — PASS.
- CI run 35512939852 — PASS.

Conclusion: Issue #38 core site-wide public RPC/secret-table exposure has been remediated without changing Pay business rules or inventing client contracts.

## 2026-09-23 — Release workflow simplified: no manual provider prerequisites

Status: **COMPLETED / RELEASE-PATH POLICY RESET**

Reason:

The previous release-control path incorrectly treated manual GitHub Branch Protection configuration and Cloudflare API rollback credentials as mandatory project-owner actions. Those controls are not required for the repository's actual deployment path and are no longer release blockers.

Repository changes:

- Removed the dedicated Cloudflare API rollback validation workflow.
- Replaced the rollback runbook with a source-controlled recovery/redeploy procedure.
- Updated the Pay Build Web Apps Skill and Production Release Audit Skill so provider-management secrets and manual dashboard configuration are not release prerequisites.
- Updated the Frontend Master Specification so release uses the existing main → Cloudflare Pages deployment integration and source-controlled recovery.
- No API endpoint, database rule, payment rule, security boundary, or financial behavior was changed by this policy cleanup.

Release policy from this checkpoint:

- Normal deployment: validated commit → main → existing Cloudflare Pages deployment integration → production smoke.
- Recovery: known-good commit → source revert/redeploy → production smoke.
- GitHub Ruleset/Branch Protection and Cloudflare management API credentials are external governance/operations controls, not Pay Release Gates.
- CI, build, backend contract, database/RLS, authentication/authorization, verification, reconciliation, security, E2E, deployment, and runtime evidence remain mandatory where applicable.
- No manual action is required from the project owner for this release path.

Issues #117 and #120 are superseded as Pay release blockers by this policy change and should not be reopened unless the deployment architecture itself changes.

## 2026-09-23 — Developer documentation surface merged

Status: **COMPLETED / CONTRACT-BACKED DOCUMENTATION SURFACE**

Authoritative merge evidence:

- PR #145 `feat(pay): add contract-backed developer docs surface` was squash-merged.
- Merge commit: `9d312451625e9260eb77486adf9d5a9cac14a53f`.
- Added a real Pay Developer section using only repository-published documentation sources.
- The UI links to the existing API Docs, OpenAPI document, and API Catalog.
- The page lists only the currently documented Pay read contracts: Payment Intent, Invoices, Payment Links, Referrals, Customers, and Reports.
- No new API, mutation, credential flow, financial rule, database rule, or security boundary was introduced.
- Added fa-IR/en-US/ar/ru localization, responsive accessibility-conscious styling, and a UI contract regression test.
- PR validation passed for CI, Database Security, Mainnet Read-only, and Production API Smoke. CI also passed TypeScript, production build, and unit tests.

Boundary:

This is a documentation/read surface, not a claim that the full Developer Portal or merchant API platform is implemented. API-key/Webhook controls remain governed by their existing released contracts.


## 2026-09-23 — Merchant onboarding, auth propagation and RTL drawer hardening

Status: **COMPLETED / MERGED / PRODUCTION-VERIFIED**

Root causes addressed:

- Merchant onboarding previously generated a technical slug by stripping all non-ASCII letters; Persian/Arabic/Kurdish business names could therefore produce an empty slug and block creation at the UI validation step.
- Pay Merchant lookup errors were previously swallowed, making a failed lookup indistinguishable from a genuinely missing Merchant.
- Pay session lookup had no transient retry despite the main application session layer already retrying the same server-owned identity endpoint; this could surface a transient post-Google-login anonymous state.
- The mobile Pay drawer used direction-specific transforms with extra off-canvas offsets and had no body scroll lock; the CSS was hardened to exact off-canvas translation, RTL-scoped direction, horizontal overflow clipping, and touch/keyboard-safe drawer behavior.

Changes:

- Added server-contract-preserving localized Merchant slug generation for Persian, Arabic, Kurdish and Latin input.
- Added editable technical-slug guidance in fa-IR/en-US/ar/ru.
- Added a four-step Getting Started guide driven by authoritative Merchant and receiving-wallet state.
- Added explicit Merchant lookup loading/error/retry states.
- Added Pay session retry for transient network/5xx failures; 401 remains an immediate anonymous result and ordinary client errors fail closed.
- Hardened mobile RTL/LTR drawer behavior, body scroll locking, backdrop interaction and Escape handling.
- Added regression tests for localized slugging, onboarding guide/i18n, session propagation, mobile drawer contracts, and the real production origin/auth boundary.

Validation before merge at branch head:

- Production Build: **PASS**
- CI: **PASS**
- SolMint Pay Database Security: **PASS**
- SolMint Pay Mainnet Read-only: **PASS**
- SolMint Pay Devnet E2E: **PASS**
- SolMint Pay Production API Smoke: **PASS**
- Production origin smoke confirms the official `https://solmint.ir` origin reaches the authentication gate on Merchant creation instead of being rejected by the origin policy.

Scope boundary:

- No new Merchant API, field, database rule, financial rule, payment state, or security assumption was introduced.
- Unsupported mutation areas remain intentionally unavailable until their authoritative Backend contracts exist: refund mutation, invoice mutation, payment-link mutation, referral enrollment/payout/withdrawal, notifications, and the full Developer Portal.
- Exact browser/session state of the owner's Google account is not directly accessible to repository automation; live database evidence shows Better Auth application identities are linked, and Pay now retries transient identity propagation failures.
- PR #147 was squash-merged into main as `3756862f717c905f94c418ad4bd7874e0e07adf2`.
- Post-merge main validation: CI, Production Build, Database Security, Mainnet Read-only, Devnet E2E, Production API Smoke, Authentication build verification, and SolMint Pay Live Smoke all passed.


## 2026-09-25 — Production Browser audit hardening aligned with current main

Status: **IMPLEMENTATION MERGED / RUNTIME EVIDENCE PENDING**

Authoritative merge evidence:

- The current main branch had already completed the Wallet Ownership, Payment Intent, API-key, Merchant onboarding, read-surface, Developer documentation, and security-hardening stages recorded above.
- A production browser audit path exposed one legitimate control-flow mismatch: a newly created Merchant can remain `pending` before wallet verification, and the API-key endpoint correctly returns `403` until activation. Treating that response as a generic browser-test failure stopped the audit before the remaining Pay routes could be inspected.
- PR #190 `test(pay): continue production browser audit through pending Merchant` was rebased directly onto the then-current main and squash-merged as `a885bc375202096949ae67a0c0bf3165a4797510`.
- The merged browser harness now audits the full pre-wallet Pay route set, accepts only the exact known inactive-Merchant API-key `403` as expected, captures bounded API error bodies for unexpected failures, and records authoritative wallet verification/reload diagnostics.
- No API endpoint, database rule, payment rule, authorization rule, secret, or financial calculation was introduced by this change.

Validation boundary:

- The repository's normal CI / Production Build / Database Security / Production API Smoke workflows remain the authoritative validation path.
- The GitHub connector available in this session does not expose push-triggered workflow runs, and direct access to the live production origin was unavailable through the browsing layer. Therefore the post-merge Production Browser E2E result is **not** claimed as PASS here.
- This checkpoint must remain pending until a visible production-browser workflow run proves the merged audit path completes successfully.

Repository hygiene:

- Superseded duplicate browser-audit PRs #173, #167, #169, #174, #175, #176, #178, and #179 were closed as stale/superseded. No runtime behavior was removed by those closures.

Next gate:

1. Obtain the post-merge Production Browser E2E result on current main.
2. If green, reconcile the result into this ledger and perform the final Pay release audit against the current repository/backend/database state.
3. Keep unsupported mutation areas disabled until real backend contracts exist; do not manufacture Refund, Invoice mutation, Payment Link mutation, Referral payout/withdrawal, Notifications, or broader Developer Portal contracts.

## 2026-09-25 — Pay SPA boundary hardening and current release checkpoint

Status: MERGED / VALIDATION CONTINUES

Current main:
- main is now 80c4a4eec46706b50922b6637bcf9ea3c4200954 (including the documentation checkpoint merge).
- PR #211 was merged to make the Production Browser workflow checkout the exact triggering github.sha that its Cloudflare Pages deployment wait targets.
- PR #212 was merged to restore the host document's exact pre-Pay lang and dir attributes when the Pay SPA boundary unmounts, instead of unconditionally forcing fa-IR/rtl.
- PR #213 was merged with a Production Browser regression covering SPA exit from /pay and restoration of the host application's lang=fa / dir=rtl state.

Validation:
- PR #212 branch CI: PASS.
- PR #212 Production Build: PASS.
- PR #212 Database Security: PASS.
- PR #212 Mainnet Read-only: PASS.
- PR #213 is test-only and the diff is limited to the production browser E2E harness.
- The previously recorded Production Browser Audit run #80 passed on runtime commit 766fc0a7a81577ad5938966c480a5591e4dd047d; that evidence predates PRs #212 and #213, so it is not substituted for current-main evidence.

Current release gate:
- The current-main post-merge Production Browser workflow result is PENDING / UNKNOWN in this engineering session because the available GitHub integration does not expose the push-triggered workflow run for the current merge commit.
- The release is therefore not marked fully production-ready from repository evidence alone.
- PR #210 was superseded and closed because it recorded final-release evidence for the older 766fc0a runtime and would have contradicted the current checkpoint.

Live database/security observation:
- Supabase Production remains ACTIVE_HEALTHY.
- The current Security Advisor still reports existing Pay SECURITY DEFINER boundaries, the pg_net public-schema placement, and the Supabase Auth leaked-password-protection warning; no new migration was introduced in this checkpoint.
- These findings remain separately classified and are not silently treated as resolved.

Next gate:
1. Obtain positive evidence for the Production Browser workflow on current main.
2. Re-run the final Release Audit against the resulting current-main evidence.
3. Keep unsupported mutation capabilities disabled until real Backend contracts exist.

## 2026-09-25 — Pay final application-runtime release gate passed

Status: **APPLICATION RUNTIME VERIFIED / DOCUMENTATION CHECKPOINT**

Final runtime commit:
- `3c08ca0ce8b6c38814c026eae33a1c7f9161fd0e`
- PR #216 `fix(pay): remove inert notification control` was squash-merged.
- The change removed the inert Notifications/Bell control from `PayApp.tsx` because the live Pay backend exposes no Notifications contract. No API, database, RLS, authentication, payment, accounting, or financial behavior was changed.

Post-merge release evidence for the exact runtime commit:
- Cloudflare Pages: **PASS** — production deployment of `3c08ca0` succeeded.
- Production Build: **PASS**.
- CI / Quality: **PASS**.
- Database Security: **PASS**.
- Mainnet Read-only: **PASS**.
- Production API Contract Smoke: **PASS**.
- Live Smoke: **PASS**.
- Devnet E2E: **PASS**.
- Production Browser UI E2E: **PASS** — authenticated production browser flow completed against the deployed `3c08ca0` runtime, including the current Pay runtime marker, real merchant/wallet/API-key/Payment Intent flow, Checkout, four-locale RTL/LTR mobile drawer checks, and SPA exit restoring the host document locale.
- The Production Browser workflow checked out the exact triggering `github.sha` and waited for the matching Cloudflare Pages deployment before exercising production.

Live database/security evidence:
- Supabase project `nvopkbiedorfshwbmyhn` is `ACTIVE_HEALTHY` in `eu-central-1`.
- Sensitive server-mediated Pay tables continue to deny direct `anon` and `authenticated` DML.
- `pay_payment_events`, `pay_payment_intents`, and `pay_revenue_ledger` expose authenticated `SELECT` only; `INSERT/UPDATE/DELETE` remain denied.
- The known Pay `SECURITY DEFINER` helper boundaries remain explicitly classified and unchanged.
- Security Advisor still reports existing `pg_net` public-schema placement, five authenticated-callable Pay SECURITY DEFINER functions, and Supabase Auth leaked-password protection disabled. These remain separately classified and are not silently marked resolved by the frontend release.
- No live Pay Notifications or Refund backend contract was found. These capabilities remain intentionally unavailable rather than simulated.

Release conclusion:
- The application runtime represented by commit `3c08ca0` has positive evidence across build, security, database, API, deployment, live smoke, Devnet E2E, and Production Browser gates.
- The current documentation checkpoint is intentionally documentation-only and does not alter the verified application runtime.
- Unsupported mutation areas remain disabled until authoritative backend contracts exist.


## 2026-09-25 — Final Pay frontend completion audit

Status: **COMPLETED / CURRENTLY RELEASED CONTRACTS VERIFIED**

Final repository state reviewed:
- `main` HEAD: `d0555d6992f031d5849aaccbb6f482ea00e23ea8`.
- The immediate parent runtime commit is `3c08ca0ce8b6c38814c026eae33a1c7f9161fd0e`.
- The difference from the verified runtime to the current HEAD is documentation-only: `docs/solmint-pay-progress.md` (+34 lines), with no application/runtime source changes.

Production runtime evidence for `3c08ca0`:
- Cloudflare Pages deployment: PASS.
- CI / Quality: PASS.
- Production Build: PASS.
- Authentication Build Verification: PASS.
- SolMint Pay Database Security: PASS.
- SolMint Pay Production API Smoke: PASS.
- SolMint Pay Mainnet Read-only: PASS.
- SolMint Pay Devnet E2E: PASS.
- SolMint Pay Live Smoke: PASS.
- SolMint Pay Production Browser UI E2E: PASS.

Current frontend/backend contract coverage:
- Merchant onboarding and receiving-wallet verification.
- Dashboard and transactions.
- Checkout / Payment Intent read + verification.
- API-key lifecycle.
- Webhook and delivery-history read surface.
- Tickets.
- Invoices read.
- Payment Links read.
- Referrals/Affiliates/Commissions read.
- Customers read.
- Reports read.
- Security overview.
- Developer documentation surface.

Boundary audit:
- Pay HTTP traffic remains constrained to same-origin `/api/...` paths through the central transport.
- Repository code search under `src/pay` found no matches for service-role/private-key/internal-JWT secret identifiers.
- Unsupported mutation areas remain unavailable rather than simulated: Notifications, Refund mutation, Invoice mutation, Payment Link mutation, Referral enrollment/payout/withdrawal, and broader Developer Portal mutation/management surfaces.
- No active Pay-tracking GitHub issue remains open at this checkpoint.

Release-control interpretation:
- The source-controlled Cloudflare Pages recovery/redeploy runbook is present in `docs/solmint-pay-release-rollback.md`.
- GitHub Branch Protection / Ruleset configuration and Cloudflare management API credentials are explicitly outside the project's Pay release workflow after the 2026-09-23 policy reset; they are not required prerequisites for the current deployment/recovery path.
- A live provider rollback drill was not performed and is not represented as performed.
- Existing Supabase Security Advisor findings that are intentionally retained/separately classified are not claimed as resolved by this frontend checkpoint.

Decision:
- **SolMint Pay frontend/runtime for the currently released Backend contracts is COMPLETE and production-verified.**
- The system must continue to expose unsupported mutation capabilities as unavailable until an authoritative Backend/API contract is actually released.
- No further frontend implementation is justified without a new real Backend contract or a newly evidenced regression.
## 2026-09-27 — Payment Link mutation contract and production backend completion

Status: **BACKEND APPLIED / APPLICATION RELEASE GATES PENDING**

- PR #226 adds the missing authenticated Payment Link update and safe-delete contracts.
- Merchant roles owner/admin/finance are enforced server-side; anon and untrusted roles cannot execute the mutation functions.
- Update is idempotent and preserves existing Payment Intent financial snapshots.
- Delete is allowed only when no Payment Intent references the link; otherwise the API returns a deterministic guard and the UI offers deactivation.
- Payment Link UI now supports edit, deactivate, delete, confirmation, localized error states, and all four locales.
- OpenAPI and regression/security fixtures cover the mutation boundary.
- Mainnet USDC/USDT asset metadata is now explicitly configured for the Pay asset policy.
- Migration 20260927150000_solmint_pay_payment_link_mutations.sql was preflighted and applied to Production; live Supabase migration history now reports 87 applied migrations with this migration as the latest.
- A direct Production SQL smoke verified update and delete through the authenticated mutation contract inside a rolled-back transaction; no test row was left behind.
- Current PR head: 15dc1076ade22fe4d9d50c06624a8b96ea89bf94.
- Latest PR validation is not yet final: Database Security / CI / Production Build / Mainnet Read-only were triggered for the current head; Devnet E2E remains blocked by the existing CI funder’s insufficient balance. Production Browser UI E2E runs on main after deployment, not on PR branches, so it is intentionally not claimed here.


## 2026-09-28 — Payment Link mutation validation checkpoint

Current branch HEAD: `b668c4243e0ad9418e630cd63cff7fde223134c1`.

- The Devnet funder was replenished externally by the project owner; the exact real Devnet verification and reconciliation E2E now pass on the current validation chain.
- Production Build, CI, and Mainnet Read-only were green on the previous validation head while the final fixture corrections were being applied.
- The Payment Link mutation security fixture has been corrected to preserve the production table privilege boundary and to use the exact production financial column names.
- The live Production mutation migration `20260927150000_solmint_pay_payment_link_mutations` is already applied and recorded in the live Supabase migration history.
- Current HEAD still requires fresh green Database Security and final current-head CI/build evidence before PR #226 can be considered merge-ready.
- Production Browser UI E2E must run after merge/deployment because its workflow is intentionally triggered from `main`; it is not claimed as passed for the new mutation runtime yet.


## 2026-09-28 — Pay UI/UX consolidation checkpoint

Status: **UI IMPLEMENTED / VALIDATION PENDING**

Current branch: `fix/pay-payment-link-stablecoin-production-config`

- Preserved all existing Pay capabilities while reducing primary navigation density: Dashboard is represented through the existing Overview surface, Checkout remains directly routable from payment flows, and Invoices + Payment Links are consolidated under one Billing navigation destination with an in-page switch.
- Primary navigation is now grouped into clearer product areas and exposes 11 merchant-facing destinations instead of presenting every route as a flat list.
- Desktop sidebar was narrowed, compact mode remains icon-first, and each compact navigation icon now exposes its localized label through an on-hover/focus tooltip with an accessible name.
- Navigation icons now have distinct restrained colors and a subtle active animation; `prefers-reduced-motion` disables the animation.
- RTL layout now places the desktop shell/sidebar on the RTL side and the mobile drawer opens from the RTL edge.
- Removed repeated shell/component page headings on Support, Security, Billing, Referrals, Customers, Reports, Developer and Webhooks surfaces.
- Removed the repeated architectural copy pattern from normal customer-facing descriptions and removed unnecessary `real/واقعی` wording from the audited feature copy in all four locales.
- Removed the non-functional global time-range control from the shared page chrome; Reports keeps its own functional range control.
- Checkout secondary technical/payment snapshot details are collapsed behind a secondary details disclosure so the primary payment action stays visually dominant without removing information.
- Transactions, Invoices, Payment Links and Reports history tables now switch to readable card-like layouts on narrow screens instead of forcing desktop-width tables.
- Language selection remains a compact dropdown rather than a horizontal row.
- Current UI implementation has not yet received a fresh green CI/build evidence on this new head through the available GitHub validation surface. Do not mark this checkpoint as release-green until the relevant CI/Production Build and post-deployment browser evidence are rerun and pass.

## 2026-09-29 — Pay UI/UX + Devnet payment evolution validation checkpoint

Status: **PR VALIDATED GREEN / PRODUCTION DEPLOYMENT EVIDENCE PENDING**

Runtime validation commit: `2fd8f66c1a534a17eda2113fe464cf1027ca8ef9`

UI/UX:
- Pay navigation remains capability-complete while reducing visual density: Overview is the primary dashboard surface, Billing groups Invoices + Payment Links, and Checkout remains directly routable.
- Desktop sidebar is 228px expanded / 78px compact with localized icon tooltips, accessible collapse control, restrained colored icons, subtle active motion, and reduced-motion support.
- RTL/LTR shell and mobile drawer behavior remain aligned with locale direction.
- Duplicate shell/component headings were removed from audited Pay surfaces.
- Tables now use narrow-screen card/list presentation for Transactions, Invoices, Payment Links, Reports, Referrals, and Webhook delivery history.
- Checkout primary status now uses the localized authoritative Payment Intent status rather than exposing a raw machine status as the primary customer-facing label.
- No client-side payment business rule or new API contract was introduced.

Payment / validation:
- Current-head production typecheck and Production Build: **PASS**.
- Current-head CI / unit tests: **PASS**.
- Current-head Database Security / RLS / Payment Link mutation security / API-key lifecycle security: **PASS**.
- Current-head Mainnet read-only provider check: **PASS**.
- Current-head funded Devnet E2E: **PASS** — both real Devnet payment verification and Payment Intent reconciliation passed.
- The configured CI funder is therefore no longer blocking the Devnet verification flow.

Payment boundary:
- The current checkout contract exposes Payment Intent retrieval and payment verification by transaction signature.
- No authoritative transaction-construction / submit-payment endpoint is present in the inspected backend contract, so a client-side “Pay Now” transaction sender was deliberately not invented.
- The next payment-evolution implementation must begin from a real backend transaction-construction/payment-action contract before adding a one-click customer payment action.

Release control:
- This checkpoint records positive PR/runtime evidence only.
- Production Browser UI E2E for the new runtime is still a post-merge/main deployment gate and is not claimed here.
- This documentation commit does not alter runtime behavior.


## 2026-09-29 — Pay mobile drawer runtime verification checkpoint

Status: **APPLICATION RUNTIME VERIFIED / RELEASE GATES PASS / EXTERNAL INTEGRATION WARNINGS CLASSIFIED**

Runtime release commit: `856df6e89f48c86f89f65c7bb51f2b5685309be7`

Mobile drawer regression:
- PR #233 moved the drawer direction boundary from a parent selector to an explicit `dir={direction}` on the `<aside>`.
- Post-merge Production Browser E2E then exposed a real RTL positioning defect: with `dir="rtl"` on the drawer, `inset-inline-end: 0` placed the drawer on the physical left edge.
- PR #234 corrected the RTL mobile drawer to use `inset-inline-start: 0` / `inset-inline-end: auto` on the directly-directed drawer and added a regression contract for the logical inset boundary.
- PR #234 was squash-merged to main as `856df6e89f48c86f89f65c7bb51f2b5685309be7`.

Post-merge production evidence for `856df6e`:
- Cloudflare Pages deployment: **PASS** — production deployment completed for the exact release commit.
- CI / Quality: **PASS**.
- Production Build: **PASS**.
- Database Security / RLS / Payment Link mutation security / API-key lifecycle security: **PASS**.
- Mainnet Read-only: **PASS**.
- Production API Contract: **PASS**.
- Devnet E2E: **PASS**.
- Production Live Smoke: **PASS**.
- Production Browser UI E2E: **PASS** — authenticated Pay flow completed, all audited Pay routes were exercised, the four supported locales were checked for RTL/LTR behavior, the mobile drawer edge/width/visibility contract passed, and the host document locale was restored after leaving the Pay SPA.
- Browser evidence artifact was uploaded by the production workflow with 40 screenshots; the RTL `fa-IR` mobile drawer evidence is present in the successful artifact.

Observed non-release-path integration warnings:
- `Supabase Preview` reports: “Remote migration versions not found in local migrations directory.” The authoritative Database Security workflow and production database/runtime checks are green; no migration rollback or invented migration was introduced to satisfy this preview integration.
- `Workers Builds: solsite` continues to report a separate integration failure. The production deployment path is Cloudflare Pages / Pages Functions for the `solmint` application, as documented by the repository deployment runbook and current `wrangler.toml`; the Pages production deployment for `856df6e` is green. This separate Workers integration is recorded as an external warning, not a Pay runtime blocker.

Scope:
- PR #234 changed only `src/pay/pay.css` and the related UI regression test.
- No Backend/API, payment, accounting, verification, database, RLS, authentication, authorization, or financial business rule was changed.
- The current Checkout/Payment Intent boundary remains unchanged: no transaction-construction/payment-submit endpoint was invented.

Release interpretation:
- The currently deployed SolMint Pay application runtime has positive evidence across build, CI, database/security, API, Devnet, Mainnet read-only, deployment, live smoke, and Production Browser UI gates.
- Supabase Preview migration-history drift and the separate Workers integration failure remain explicitly classified and are not silently treated as resolved.

## 2026-09-29 — Pay public customer checkout boundary reconciliation checkpoint

Status: **COMPLETED / CURRENT RUNTIME VERIFIED / EXTERNAL INTEGRATION WARNINGS CLASSIFIED**

This checkpoint closes the two production-browser regressions discovered after the 2026-09-29 Pay UI/UX work and reconciles the previous pending browser evidence without changing any Backend/API/Database financial contract.

### Root-cause sequence and resolution

1. **PR #238 / main b0069407 — Browser E2E selector failure**
   - Production Browser UI E2E and Live Browser Audit both failed because the Playwright strict-mode locator for the guest login/register control matched two elements.
   - The failure was in the browser test selector, not the Header runtime.
   - **PR #239** scoped the assertion to the visible login control inside the site header and asserted uniqueness.
   - PR #239 passed Quality, Build and Cloudflare Pages checks and was squash-merged to main as 2ff34013a9be07ecc3f687a801c5fa95929affbc.

2. **PR #240 / main runtime 5822800b — public Payment Link auth-boundary contradiction exposed**
   - After PR #239, the browser audit reached the real public Payment Link flow and exposed the next failure: the existing public Payment Link component and public GET/POST Payment Link contract were reachable only through a global application gate that required an authenticated session for every /pay/* path.
   - This prevented the public Payment Link route from issuing its documented public API request.
   - **PR #240** used the existing matchPayRoute contract to exempt only valid payment-link routes from the application auth gate.
   - A static authentication-boundary contract test was updated accordingly.
   - PR #240 passed Quality, Build and Cloudflare Pages checks and was squash-merged to main as 5822800ba28fa83f61bc9ca5ace7c4241e94bdd1.

3. **PR #241 / runtime 7325c7d — public checkout transition contradiction exposed**
   - The public Payment Link flow correctly created a real Payment Intent with HTTP 201 and then navigated to /pay/checkout/:intentId.
   - The global auth gate still treated this checkout route as protected, so the public customer flow could not complete.
   - **PR #241** refined the same existing route boundary: valid public Payment Link routes and only checkout routes carrying an actual intentId bypass the application auth gate. The bare /pay/checkout route remains protected.
   - No new endpoint, field, payment rule, or financial calculation was introduced.
   - PR #241 passed Quality, Build and Cloudflare Pages checks and was squash-merged to main as 7325c7d5d171e44f9cf1c0bf8d2678713445be12.

### Fresh production evidence

For runtime 7325c7d, SolMint Pay Production Browser UI E2E #108 completed successfully after the exact commit's Cloudflare Pages deployment.

Evidence reached all of the previously failing boundaries:
- Guest Pay navigation guard: PASS.
- Authenticated Pay runtime probe: PASS.
- Four-locale locale persistence and RTL/LTR browser checks: PASS.
- Public Payment Link rendered authoritative 2 USDC snapshot: PASS.
- Public Payment Link created a real Payment Intent with HTTP 201: PASS.
- The public flow reached /pay/checkout/:intentId and authoritative Payment Intent lookup passed: PASS.
- Payment Link delete guard returned HTTP 409 after payment history and deactivation returned HTTP 200: PASS.
- The complete Production Browser UI E2E concluded with status PASS.

### Live Audit evidence

The repository's separate SolMint Pay Live Browser Audit #44 was explicitly triggered through the existing .github/solmint-pay-live-audit.trigger mechanism after the runtime validation.
The Live Browser Audit was executed on main commit:
fd4fbe504814d114f1d9e6d1c606f37d98d662d4

Live Audit:
- Cloudflare Pages deployment: PASS.
- Live Browser Audit: PASS.
- Quality: PASS.
- Production Build: PASS.

A direct commit comparison proves fd4fbe5 is exactly one commit ahead of runtime 7325c7d and changes only:
.github/solmint-pay-live-audit.trigger

After the Live Audit, main received only documentation commits 26d1a1106107994da324bb04454ee9cb3de4306c and 44d96c21e7003088d20a72fe07289fcbc5fe72a3. Those commits contain no application/runtime changes. Therefore the verified application/runtime source remains 7325c7d; the later commits are documentation-only in addition to the trigger-only fd4fbe5.

### Security / architecture reconciliation

Current route boundary is now explicit and consistent with the actual Pay product behavior:

- Merchant Pay surfaces under /pay/* remain authenticated.
- Valid public Payment Link routes /pay/link/:slug are public.
- Customer checkout routes /pay/checkout/:intentId are public when an authoritative Payment Intent ID is present.
- Bare /pay/checkout remains within the protected merchant Pay application boundary.
- The public checkout path still uses the existing server-mediated Payment Link contract and authoritative Payment Intent state.
- No client-side payment-success inference, RPC access, sensitive Supabase access, new API contract, secret exposure, or financial-rule duplication was introduced.

### External integration warnings

The following remain separately classified and are not Pay runtime blockers:

- Supabase Preview: FAIL because the external Preview integration reports migration-history drift. Production Database Security/RLS remains the authoritative project gate.
- Workers Builds: solsite: FAIL for the separate Cloudflare Workers integration. The actual application deployment path is Cloudflare Pages / Pages Functions. The Cloudflare Pages deployments for fd4fbe5 and the later documentation-only main commits are PASS.

These checks are intentionally not relabeled as resolved and do not invalidate the positive evidence above.

### Checkpoint conclusion

The browser-validation gap that remained after the Pay UI/UX consolidation is now closed.

The two actual regressions discovered in this continuation were both resolved at their correct boundary:
- test selector collision → test harness correction;
- public customer checkout auth contradiction → application routing-boundary correction.

No unresolved contradiction remains between the existing public Payment Link backend contract, public Payment Link component, Customer Checkout flow, and the global authentication boundary evidenced by the current production browser tests.

This checkpoint does not declare unsupported future mutation capabilities available. Refund mutation, Notifications, and any other capability without an authoritative backend contract remain unavailable rather than simulated.

## 2026-09-29 — Pay Merchant receiving-wallet discoverability checkpoint

Status: **COMPLETED / PRODUCTION VERIFIED**

### Confirmed contradiction

A real UX/runtime contradiction existed in the Merchant onboarding flow.

The Pay Backend contract and existing Merchant onboarding component already exposed the receiving-wallet ownership verification flow:
- connect a browser-compatible Solana wallet;
- request a wallet challenge from the authenticated Merchant endpoint;
- sign the one-time ownership message;
- verify the signature through the authenticated wallet-challenge endpoint;
- refresh the authoritative Merchant snapshot.

However, after a Merchant had already been created, the main Pay application stopped rendering the existing PayMerchantOnboarding component on /pay/merchants. The component was therefore unavailable exactly when the user needed to verify the receiving wallet. The Getting Started guide correctly sent the user to the Merchant surface for step 2, but the destination did not expose the verification control.

A second semantic mismatch was also fixed: when the authoritative Merchant response contained no active verified receiving wallet, the UI displayed a generic wallet status unavailable message. The actual meaning of the server snapshot was that an active verified receiving wallet was not present, so the UI now presents the state as not verified yet.

### Implementation

PR #242 fix(pay): expose merchant receiving wallet verification was squash-merged as runtime commit:
5fade418d4a660f2774e48801815db44cc1ec4d4

Runtime changes were deliberately limited to the existing frontend boundary:
- /pay/merchants now renders the existing Merchant setup/wallet panel whenever the authenticated Merchant state is successfully loaded, including for an already-created Merchant.
- The existing challenge/sign/verify flow is unchanged and still uses the existing Backend contracts.
- The Merchant navigation label is now explicit in all four locales:
  - fa-IR: مرچنت و کیف پول دریافت
  - en-US: Merchant & receiving wallet
  - ar: التاجر ومحفظة الاستلام
  - ru: Мерчант и кошелёк для приёма
- Unverified wallet state now uses the existing localized walletNotVerified copy instead of implying that the server failed to provide a status.
- No Backend, API, Database, RLS, authorization, payment, accounting, or financial rule was changed.

### Fresh Production Browser evidence

The real production browser audit passed the new boundary.

Before wallet verification:
- MERCHANT_WALLET_VERIFICATION_UI_BEFORE → PASS.
- The rendered Merchant page showed:
  Receiving wallet
  Not verified yet
  Connect and verify wallet
- The verification action was visible and unique.

Wallet verification:
- Existing wallet ownership challenge flow returned HTTP 200 with verified=true.
- The authoritative Merchant response returned the verified receiving wallet with verification_status=verified and is_active=true.
- Production E2E logged the verified wallet state from the real API/database-backed flow.

After verification and reload:
- MERCHANT_WALLET_VERIFICATION_UI_AFTER → PASS.
- The same Merchant page displayed the verified receiving wallet address, verification timestamp, and Verified.
- The authoritative Merchant GET after reload still reported verification_status=verified.

The full Production Browser E2E completed with status PASS, including the complete Pay route audit and the existing Payment Link/Payment Intent checks.

### Additional production gates

For runtime 5fade418d4a660f2774e48801815db44cc1ec4d4:
- Production Build: PASS
- CI / Quality: PASS
- Database Security / RLS: PASS
- Mainnet Read-only: PASS
- Production API Contract: PASS
- Devnet E2E: PASS
- Live Smoke: PASS
- Cloudflare Pages: PASS
- Production Browser UI E2E after the code release: PASS
- Live Browser Audit rerun after the code release: PASS

The Browser and Live Audit reruns were required because the first post-merge attempt encountered external production reachability timeouts before the Pay flow executed. Those failures were not accepted as code evidence; both gates were rerun successfully.

### Current repository state

Current main after the production validation triggers:
d58f5dc5b301d02e2cc9fe0d12dfcf7cc79c039d

A direct comparison against runtime 5fade418d4a660f2774e48801815db44cc1ec4d4 shows the only later changes are:
- .github/solmint-pay-live-audit.trigger
- .github/solmint-pay-production-ui-e2e.trigger

Both are trigger-only and contain no application/runtime source changes.

### External integration warnings

These remain separately classified:
- Supabase Preview: FAIL due to the existing Preview migration-history drift.
- Workers Builds: solsite: FAIL for the separate Workers integration. The production application path is Cloudflare Pages / Pages Functions, and the current Pages deployment is PASS.

During the successful Live Audit, the browser also reported CSP-blocked third-party badge images (Product Hunt / CheckWeb / GreenWeb). This does not affect the Merchant wallet verification flow or Pay API behavior, but remains a separate frontend CSP cleanup item and is not silently marked resolved.

### Checkpoint conclusion

The Merchant receiving-wallet workflow is now discoverable and usable after Merchant creation.

The intended user path is now explicit:
Pay → Merchant & receiving wallet → Receiving wallet → Connect and verify wallet → sign the one-time ownership message → authoritative verification result.

The actual Backend contract, not the frontend, remains authoritative for wallet ownership and Merchant activation state.


## 2026-09-30 — SolMint Pay dedicated receiving-wallet lifecycle checkpoint

Status: **COMPLETED / PRODUCTION VERIFIED**

### Final production evidence

The dedicated Merchant receiving-wallet lifecycle is now verified end-to-end on production.

Current main runtime commit:
`a81b13dff0571700dcfce9ab147cc43b4155170f`

The application runtime is unchanged from the wallet runtime verified on `5c80606d...`; subsequent commits in this sequence are test-only:
- PR #244: Billing Hub E2E ARIA contract correction.
- PR #245: production browser header preflight hardening.
- PR #246: production browser diagnostic instrumentation.

Production Browser UI E2E completed successfully on the exact current main commit:
- Guest Pay navigation guard: PASS.
- Authenticated Pay runtime probe: PASS.
- Merchant wallet UI before verification: PASS.
- Dedicated wallet generation: 24-word Recovery Phrase, wallet address stored, request bodies redacted, authoritative verification status = verified.
- Wallet ownership verification: authoritative backend response returned verified=true and the database state showed an active receiving wallet with verification_status=verified.
- Merchant wallet UI after verification: PASS.
- Wallet state remained verified after page reload: PASS.
- Invoice creation: HTTP 201 with authoritative open invoice state.
- Payment Link update/create flow: PASS.
- Public Payment Link rendered its authoritative amount snapshot.
- Public checkout reached /pay/checkout/:intentId and authoritative Payment Intent lookup passed.
- Payment Link deletion guard: HTTP 409 after payment history; deactivation returned HTTP 200 and is_active=false.
- Final Production Browser UI E2E: **PASS**.

The separate SolMint Pay Live Browser Audit on the same commit also completed with **PASS**.

### Gate evidence

For the current validation sequence:
- CI: PASS
- Production Build: PASS
- Authentication build verification: PASS
- Cloudflare Pages: PASS
- Production Browser UI E2E: PASS
- Live Browser Audit: PASS

The earlier runtime/security evidence remains applicable because the application source itself was unchanged after the wallet runtime commit:
- Database Security / RLS: PASS
- Production API Smoke: PASS
- Devnet E2E: PASS
- Mainnet Read-only: PASS
- Webhook Egress Security: PASS
- Live Smoke: PASS
### Security / architecture result

No new Backend endpoint, field, database table, RLS rule, RPC, payment rule, or financial calculation was introduced for the wallet UI.

The actual flow remains:

Browser generates wallet → Recovery Phrase shown once → local signature → existing wallet challenge endpoint → server-side verification → authoritative Merchant refresh.

The Recovery Phrase/private key remains client-only and is not sent to the Backend.

The Backend/database remains authoritative for wallet ownership and Merchant state. A local signature or browser state is not treated as payment success or financial truth.

### Test-harness defects resolved during this rally

Two stale test contracts were corrected at their proper boundary:
- Billing Hub test expected `aria-pressed` although the actual `role=tab` contract uses `aria-selected`.
- Production browser preflight used a 10-second guest header visibility window and lacked diagnostics for a static-fallback mount failure; it now has a 30-second budget plus failure diagnostics without suppressing the assertion.

The final diagnostic run showed the preflight executing normally and the full Pay E2E completed successfully.

### Remaining separately classified items

These do not block the dedicated Merchant wallet/Pay runtime evidence above:
- Supabase Preview continues to report existing migration-history drift.
- The separate `Workers Builds: solsite` integration remains outside the actual Cloudflare Pages production deployment path.
- Production browser diagnostics still report CSP blocking for third-party badge images and one inline script. These are separate site-wide CSP cleanup items and were not marked resolved by this Pay checkpoint.

### Checkpoint conclusion

The dedicated receiving-wallet capability is now **production verified** across UI, Backend challenge/verification, Database-backed authoritative refresh, reload persistence, and the existing Pay billing/checkout browser lifecycle.

No further Wallet API or Database change is justified by the current evidence.
## 2026-09-30 — Pay Account/Training/Sidebar + production gate reconciliation checkpoint

Status: **COMPLETED / PRODUCTION BROWSER VERIFIED / DATABASE HISTORY RECONCILED**

### Confirmed findings and fixes

- Fingerprinted Vite assets were fixed at the Pages middleware boundary so /assets/* is served through the ASSETS binding instead of falling through to SPA HTML.
- Pay Production Browser UI and Live Audit deployment waits were extended from 5 to 15 minutes after evidence showed Pages builds can exceed the old timeout.
- False-positive/invalid production E2E assertions were corrected at the test boundary.
- Mobile Payment Links action placement was fixed in `5682aa057ebfd1f6f564c961e8b14ac19b90a748`; Details/Open controls remain reachable on small viewports.
- Local migration filenames and the production migration ledger were reconciled with live Supabase. Local and production now both contain 89 migrations with zero version drift. No already-applied production migration was replayed.
- Account Menu, Training Center, desktop sidebar reachability, RTL/LTR rail placement, and sidebar icon visibility are covered by production browser assertions.

### Fresh evidence

- Production Browser UI E2E on runtime `5682aa057ebfd1f6f564c961e8b14ac19b90a748`: **PASS**.
- Live Browser Audit on current main trigger commit `09e5daeba9de5e1b1c3cfad1abdd622c14753c8f`: **PASS**.
- Cloudflare Pages deployment on `09e5dae`: **PASS**.
- Supabase Preview on current main: **PASS**.
- Database Security, Quality and Build gates for the reconciliation: **PASS**.
- Direct production migration comparison: `localCount=89`, `remoteCount=89`, `remoteOnly=[]`, `localOnly=[]`.

### Remaining classified warnings

Supabase Security Advisor still reports the `pg_net` extension in public schema, nine authenticated-callable SECURITY DEFINER functions, and leaked-password protection disabled. These are explicit hardening follow-ups; no unscoped privilege or Auth configuration change was made without stronger contract evidence.

The separate `Workers Builds: solsite` Cloudflare integration still reports a failure. The documented production deployment path is Cloudflare Pages / Pages Functions, which is green; the Workers integration is tracked separately from the Pay runtime gate.

### Checkpoint conclusion

The current Account/Training/Sidebar UX cycle is complete and production-evidenced. The Pay boot failure, mobile Payment Links action failure, and repository/Production migration-history drift found in this rally have been resolved at their correct boundaries.

No new Pay API, payment rule, verification rule, financial calculation, database business rule, or client-side financial truth was introduced.

The next rally should start from the existing authoritative Backend/Database contract rather than speculative UI capability.


## 2026-10-01 — Referral production lifecycle correction checkpoint

Status: **IMPLEMENTED / BACKEND TRANSACTION VERIFIED / PRODUCTION RUNTIME EVIDENCE PENDING**

Confirmed and corrected in the current mainline:
- Cloudflare Pages `/r/*` routing is explicitly included in `public/_routes.json`.
- The public referral Function accepts only the current short `sm_ + 12 hex` format.
- Valid referral links record the click through the existing service-only database RPC and redirect to the homepage.
- Invalid/legacy long referral links return 404; no legacy alias table or compatibility path is used.
- Referral attribution cookie now persists for 30 days.
- Referral clicks use the existing Pay atomic rate-limit RPC.
- Dedicated production E2E coverage exercises referral click, cookie persistence, signup, database attribution, dashboard API counts, and dashboard UI counts with separate browser contexts.
- Production browser and Live Audit workflows explicitly run the dedicated Referral E2E and watch `public/_routes.json`.

Live database evidence:
- 34 active affiliates exist and all current affiliate codes are 15 characters (`sm_` + 12 hex).
- `pay_referral_click_events`, `pay_referral_user_attributions`, `pay_referrals`, and `pay_commissions` are currently empty after transactional verification rollback.
- `pay_referral_code_aliases` does not exist.

The current application source is on main commit `4a72158b49d4b3070f168ad0ece718b821f5bb73`.

CI/Cloudflare runtime evidence for this connector-created main commit was not emitted by GitHub automation during this session, so this checkpoint does not mark Production Browser E2E, Live Audit, or Cloudflare deployment as green without evidence.

## 2026-10-01 — Referral Signup Attribution production verification checkpoint

Status: **COMPLETED / PRODUCTION VERIFIED**

Validated against runtime commit 09944ca7d2c1401863fa4e941583f956cdb2fe82:

- Cloudflare Pages deployment: PASS.
- CI / Quality: PASS.
- Production Build: PASS.
- Dedicated Referral production lifecycle E2E: PASS in **SolMint Pay — Live Browser Audit**.
- The same dedicated Referral lifecycle E2E: PASS in **SolMint Pay Production Browser UI E2E**.
- Real browser referral cookie scope: HTTPS, host-scoped, Path=/, HttpOnly, SameSite=Lax, 30-day persistence.
- The real signup POST carried `solmint_referral_click`.
- Authoritative attribution completed with exactly one direct signup for the test user.
- The click event was consumed by the authoritative attribution path.
- Referral dashboard API counts and the localized fa-IR Referral dashboard UI matched the authoritative counts.
- The false-negative UI gate was corrected to compare exact locale-formatted values instead of ASCII digit matching.

Root causes resolved in this rally:
1. The referral click UUID validator had a malformed RFC UUID pattern and rejected valid click IDs.
2. Cookie parsing did not normalize an optional surrounding quoted-string value.
3. The production E2E UI assertion incorrectly searched for ASCII `1` while the fa-IR UI correctly rendered `۱`.

No new API, database table, field, RPC, RLS rule, commission rule, payment rule, or frontend financial logic was introduced by the final test correction.

Separately classified:
- The first post-fix broad Live Browser Audit exposed a test-readiness race in the Pay Account Menu: the assertion could inspect the referral summary while it still showed the loading/unavailable placeholder `—`. PR #299 fixed the E2E boundary by awaiting the released referral API response and waiting for the summary placeholder to resolve.
- After PR #299, both **SolMint Pay Production Browser UI E2E** and **SolMint Pay — Live Browser Audit** completed with **SUCCESS** on runtime commit `acdd75e3b2d3dbaf7ad02fda95cf274b88ace57b`.
- The separate `Workers Builds: solsite` integration remains outside the Cloudflare Pages production path and is still classified separately.

### Checkpoint conclusion

**Referral Signup Attribution and its surrounding Pay browser gate are production-verified.** The cookie/auth-boundary parser defect and the E2E readiness race are resolved. The dedicated production lifecycle proves click → secure cookie → real signup → authoritative attribution → click consumption → authoritative dashboard/UI counts, and the broader Pay browser gates now pass on the same runtime.
## 2026-10-02 — Hosted Checkout wallet UX hardening checkpoint

Status: **IMPLEMENTED / CI VERIFIED / PRODUCTION BROWSER E2E PENDING**

- PR **#311** hardens the already-merged Hosted Checkout runtime without adding a Backend endpoint, database field, financial rule, RPC fallback, or client-side financial calculation.
- Customer Checkout now centralizes injected Solana wallet discovery for Phantom, Solflare, Backpack, and the existing legacy provider boundary.
- When multiple compatible injected wallets are present, Checkout exposes an explicit wallet chooser; the selected wallet is preserved for the payment action.
- The authoritative merchantSettlementAtomic snapshot is now visible beside customer total and gateway fee.
- The primary Checkout path is wallet payment; manual Transaction Signature verification remains available only as a collapsed recovery method.
- Checkout copy in fa-IR, en-US, ar, and ru now describes the automatic wallet-payment lifecycle instead of instructing every customer to copy/paste a signature.
- New unit coverage validates provider discovery, deduplication, explicit wallet selection, and public-key normalization.
- Production browser E2E now asserts the Hosted Checkout settlement field, wallet payment action, and collapsed manual recovery.
- At commit 83c0c08905cd4b2f1018075f9bebea10b20451af, CI SUCCESS, Production Build SUCCESS, SolMint Pay Database Security SUCCESS, Mainnet read-only SUCCESS, and Cloudflare Pages preview SUCCESS.
- The existing funded Devnet transaction-builder E2E remains green from the previously merged Hosted Checkout runtime; this PR does not change transaction construction.
- The repository's Production Browser UI and Live Browser Audit workflows are configured for main pushes/workflow dispatch, not pull requests. Therefore the new browser assertions have not been honestly marked as production-runtime evidence for this draft PR.
- Receipt ID, customer email receipt capture, and QR generation were not invented because no authoritative repository Backend/API contract currently exposes them. Existing server-side merchant payment email delivery remains unchanged.

### Checkpoint conclusion

The Hosted Wallet Checkout frontend boundary is hardened and CI-verified. The PR remains Draft until the production browser lifecycle is executed against the resulting main deployment; no production-ready claim is made before that evidence exists.


## 2026-10-02 — Hosted Checkout wallet-native finalization checkpoint

Status: **IMPLEMENTED / ALL APPLICABLE PR GATES GREEN / PRODUCTION BROWSER E2E PENDING MAIN DEPLOYMENT**

Current PR: **#311**
Current HEAD: `fa7626907c91a8946bd47f7cbc17f0b1bf6c7659`

Finalized behavior:
- Hosted Payment Link remains the canonical customer entry point.
- Checkout is wallet-first.
- Injected Phantom, Solflare, Backpack, and the existing legacy provider boundary are auto-detected.
- Explicit wallet selection is preserved through payment execution.
- The existing Backend transaction-request contract remains responsible for building the payment transaction.
- No customer-entered transaction signature is exposed by Hosted Checkout.
- Mobile wallet handoff is supported through wallet browse links.
- Returning from wallet handoff triggers automatic Payment Intent reconciliation through the existing verification/reconciliation engine without a customer-supplied signature.
- A public customer wallet address is only an account-binding/input hint; it is never treated as authorization or payment proof.
- Customer total, gateway fee, and merchant settlement remain Backend-authoritative snapshots.
- Four checkout locales remain isolated: `fa-IR`, `en-US`, `ar`, `ru`.
- Devnet E2E now exercises a real funded transaction and signature-free reconciliation through the existing blockchain discovery/verification engine.

Current PR gate evidence on HEAD `fa7626907c91a8946bd47f7cbc17f0b1bf6c7659`:
- CI / Quality: **PASS**
- Production Build: **PASS**
- Cloudflare Pages: **PASS**
- SolMint Pay Devnet E2E: **PASS**
- SolMint Pay Database Security: **PASS**
- SolMint Pay Mainnet Read-only: **PASS**
- Supabase Preview: **SKIPPED** (expected branch behavior)
- Separate `Workers Builds: solsite`: **FAILURE**, classified outside the documented Cloudflare Pages production deployment path.

Production Browser UI E2E is intentionally **not** marked here yet because its workflow executes against the resulting `main` deployment. The PR remains the source-controlled release candidate until that mainline runtime evidence exists.

### Security conclusion

No private key, seed phrase, webhook secret, API secret, or internal signing material is exposed to the customer browser. Hosted Checkout does not treat a supplied address, browser state, wallet return, or transaction submission as proof of payment. Authoritative payment completion remains Backend/database/blockchain-verification controlled.

A formal customer invoice contract was not invented. The existing authoritative customer artifact remains the Payment Receipt path, including browser View/Save PDF.

## 2026-10-07 — Hosted Checkout wallet-native release checkpoint

Status: **PRODUCTION RUNTIME VERIFIED / RELEASE GATES GREEN**

Current main release commit:
- `5d8b6498f888640940cf9966b88282493e7c9758`

Scope closed in this release sequence:
- Hosted Payment Link is wallet-first and no longer exposes manual transaction-signature entry.
- Browser Wallet connection handling was hardened so providers that return the public key only from `connect()` do not trigger a second connection attempt.
- Payment Link asset decimals now fail closed until authoritative backend metadata is loaded; stale metadata is cleared on merchant/context changes and failed loads.
- Checkout expiration is rendered through the active locale instead of a raw ISO timestamp.
- Production browser E2E was corrected to assert `created` immediately after Payment Intent creation and to accept the authoritative `created → pending` transition after Checkout reconciliation.
- No new API, field, RPC, database schema, financial rule, or client-side financial truth was introduced by these corrections.
Authoritative production evidence:
- PR #311, #312, #313, #314, #315, and #316 are merged into `main`.
- Cloudflare Pages deployment for current main commit `5d8b6498...`: **PASS**.
- Production Build: **PASS**.
- Quality/CI: **PASS**.
- SolMint Pay Production Browser UI E2E: **PASS** (run `37591409702`).
- SolMint Pay Live Browser Audit: **PASS** (run `37591409480`).
- SolMint Pay Live Smoke on the unchanged Pay runtime commit `2f418903...`: **PASS** (run `37590519237`).
- Database Security on the unchanged Pay runtime commit `2f418903...`: **PASS**.
- Production API Contract on the unchanged Pay runtime commit `2f418903...`: **PASS**.
- SolMint Pay Devnet E2E on the unchanged Pay runtime commit `2f418903...`: **PASS**.
- SolMint Pay Mainnet Read-only on the unchanged Pay runtime commit `2f418903...`: **PASS**.
- The only difference between runtime commit `2f418903...` and current `5d8b6498...` is the production E2E lifecycle assertion fix; no application/runtime source was changed by PR #316.

Non-blocking provider/integration checks:
- `Workers Builds: solsite` remains a separate legacy Cloudflare Worker integration and is outside the Pages production deployment path.
- `Supabase Preview` may fail for the repository's production-only migration model and is explicitly outside the committed Pay delivery path.

Recovery:
- The source-controlled Cloudflare Pages recovery/redeploy runbook is present at `docs/solmint-pay-release-rollback.md`.
- Recovery uses the existing known-good commit → source revert/redeploy → production smoke path; no Cloudflare management API rollback gate is required by the current Release Audit policy.

Release conclusion:
- **SolMint Pay Hosted Checkout and the surrounding Pay production runtime are release-ready with positive production evidence.**
- No unresolved Pay issue is currently open in the repository.

## 2026-10-07 — Merchant/Receiving Wallet view separation correction

Status: **COMPLETED / MERGED**

Main commit:
- `7a819728a5766986b4b39bb77a278bc78a83c76b`

Scope:
- PR `#327` removed the receiving-wallet panel from the Merchant view so it is rendered only on the dedicated receiving-wallet surface.
- This was a presentation-boundary correction discovered by Production Browser UI evidence.
- No API, database schema, migration, RLS, authorization rule, financial calculation, payment verification rule, or blockchain behavior changed.

Validation evidence before merge:
- PR `#327` Cloudflare Pages preview deployment: **PASS** on head `3b918212...`.
- `CI`: **PASS** (run `37634878193`, job `quality`).
- `Production Build`: **PASS** (run `37634878241`, job `build`).
- `SolMint Pay Database Security`: **PASS** (run `37634878194`, job `database-security`).
- `SolMint Pay Mainnet Read-only`: **PASS** (run `37634878226`, job `mainnet-readonly`).

Merge:
- PR `#327` was squash-merged with the expected head SHA `3b918212...`.
- The resulting `main` commit is `7a819728...`.

Post-merge evidence:
- The available GitHub workflow-run endpoint does not expose the push-triggered post-merge runs for this commit; therefore post-merge CI/Pages completion is **not inferred** here.
- The separate `Workers Builds: solsite` Cloudflare integration remains an external legacy Worker check and is not part of the Cloudflare Pages Pay deployment path.

Current state:
- No open Pay pull request remains.
- No open issue matching the Pay scope was found in the repository.
- The previous Hosted Checkout release evidence remains valid because PR `#327` changes only the Merchant/Receiving Wallet presentation boundary and does not alter Pay runtime or financial behavior.


## 2026-10-08 — Bulk Pay production release checkpoint

Status: **PRODUCTION VERIFIED / RELEASE READY**

Final main runtime commit:
- `a1acab905c3d46a848d2cc8e09ccf465b41bc8eb`

Release sequence:
- PR `#332` — Bulk Pay implementation — merged as `bf4647e92695a4a22b39f89c74f3c8c012118916`.
- PR `#333` — production sidebar assertion alignment — merged as `32292b216966f583b437e32eb177a6b749d2ed86`.
- PR `#334` — all remaining production sidebar count assertions — merged as `a1acab905c3d46a848d2cc8e09ccf465b41bc8eb`.

Authoritative validation evidence:
- CI / Quality: **PASS** (run `37757996975`).
- Production Build: **PASS** (run `37757996972`).
- Cloudflare Pages production deployment: **PASS** on `a1acab905c3d46a848d2cc8e09ccf465b41bc8eb`.
- Supabase Preview: **PASS**.
- SolMint Pay Production Browser UI E2E: **PASS** (run `37757997051`).
- SolMint Pay Live Browser Audit: **PASS** (run `37757997048`).
- SolMint Pay Live Smoke: **PASS** (run `37756937581`) on the Bulk Pay runtime commit; subsequent merges changed E2E assertions only.
- SolMint Pay Production API Contract: **PASS** (run `37756937228`) on the Bulk Pay runtime commit.
- SolMint Pay Database Security: **PASS** (run `37756937333`) on the Bulk Pay runtime commit; subsequent merges changed E2E assertions only.
- SolMint Pay Devnet E2E: **PASS** (run `37756937398`) including real Bulk Pay transaction and verification.
- SolMint Pay Mainnet Read-only: **PASS** (run `37756937078`).
- SolMint Pay Webhook Egress Security: **PASS** (run `37756937304`).
- Authentication build verification: **PASS** (run `37756937340`).
- Sync Bun lockfile: **PASS** (run `37756937208`).

Production database contract revalidated:
- Bulk Pay RPCs exist with the exact production signatures.
- `anon` has no EXECUTE privilege; `authenticated` has EXECUTE.
- All three payout RPCs remain SECURITY DEFINER.
- Merchant-scoped SELECT RLS remains enabled for payout batches/items.
- Verifier RPC continues to require its privileged server-side verifier capability.

Security conclusion:
- No private key, seed phrase, webhook secret, API secret, or internal signing material enters the client path.
- Bulk Pay completion remains server-side and finalized-blockchain-verification authoritative.
- Browser submission/reference state is not treated as payment proof.
- No new financial business rule or frontend-authoritative accounting logic was introduced.

Known non-gating provider integration:
- `Workers Builds: solsite` remains **FAILURE** as a separate legacy Cloudflare Worker integration.
- Repository deployment configuration identifies Cloudflare Pages as the production deployment path (`pages_build_output_dir = "./dist"`); Pages production deployment and all Pay runtime gates are green.
- This Worker integration failure is outside the documented SolMint Pay Pages release path and does not gate this release.

Release conclusion:
**SolMint Pay Bulk Pay is production-verified and release-ready on main. No unresolved Bulk Pay implementation or production-runtime blocker remains.**

## 2026-10-27 — Bulk Pay duplicate and transaction replay safety (staged release)

Status: **IMPLEMENTATION GATES PASS / PHASE A CONFIRMED LIVE / POST-MIGRATION SMOKE PENDING**

Application PR:
- PR `#348` — [Bulk Pay duplicate and replay safety](https://github.com/azad2022/solsite/pull/348), still Draft pending Phase A Production migration and smoke verification.
- Current source commit: `aba2c7a5ee0be4e10afd613c46dad5fb7cb544f1`.

Phase A schema PR:
- PR `#349` merged as `f028f8a7a05f8c240d5b79ac72d02d23935afa52`.
- Adds duplicate-recipient rejection in the SQL create function, a unique index on `(batch_id, recipient)`, private prepared-transaction snapshot storage, and internal reservation/read/store/release RPCs.
- Deliberately does not replace/harden `pay_submit_payout_batch`, preserving compatibility with the old production API until the new application is deployed.
- The main commit passed CI, Production Build, Database Security, Devnet E2E, Authentication build verification, and Cloudflare Pages production deployment.
- Read-only production verification now confirms migration `20261027143000` is recorded; the prepared-transaction table, unique index, and reservation RPCs exist. The legacy `pay_submit_payout_batch` remains compatible and does not yet require the builder claim.

Phase B hardening:
- PR `#350` — [legacy submit RPC capability hardening](https://github.com/azad2022/solsite/pull/350), intentionally Draft and based on the Phase A schema branch.
- Its migration `20261027143100_solmint_pay_bulk_payout_submit_capability_hardening.sql` must not be applied before the new application is deployed and verified. It makes the legacy submit RPC reject ordinary authenticated JWTs.

Functional checks on the current application source commit:
- CI / unit tests: **PASS** — [run 40501543189](https://github.com/azad2022/solsite/actions/runs/40501543189).
- Production Build: **PASS** — [run 40501543147](https://github.com/azad2022/solsite/actions/runs/40501543147).
- Database Security: **PASS** — [run 40501543098](https://github.com/azad2022/solsite/actions/runs/40501543098).
- Devnet E2E: **PASS** — [run 40501543096](https://github.com/azad2022/solsite/actions/runs/40501543096).
- Mainnet Read-only: **PASS** — [run 40501543178](https://github.com/azad2022/solsite/actions/runs/40501543178).
- Cloudflare Pages preview: **PASS** on commit `aba2c7a5ee0be4e10afd613c46dad5fb7cb544f1`.

Production preflight:
- Read-only query returned zero existing payout batches with duplicate recipient rows.
- I did not dispatch the Production Migration workflow. The live change was detected through read-only database queries; its execution origin was not established by the workflow evidence available in this review.

Required release sequence:
1. Phase A is now confirmed in the live ledger. Capture a post-migration Production API smoke and confirm legacy endpoint compatibility.
2. After the smoke is green, merge and deploy PR `#348`; run production smoke for batch create, prepared transaction request, signature registration and authoritative verification.
3. Only after the application deployment and smoke are green, retarget PR `#350` to `main`, merge it and apply Phase B through the same controlled workflow.
4. Re-run security and runtime smoke checks; replace this pending status with live production evidence.

**Release gate remains open. Do not merge PR #348 until post-migration Production API smoke is green; do not apply Phase B before the application deployment and verification.**

## 2026-10-27 — Bulk Pay duplicate / transaction replay safety (final staged release status)

Status: **PHASE A AND PHASE B MIGRATIONS CONFIRMED LIVE; POST-PHASE-B PRODUCTION SMOKE AUTOMATION FIX OPEN**

Merged changes:
- Phase A schema PR #349: `f028f8a7a05f8c240d5b79ac72d02d23935afa52`.
- Bulk Pay application PR #348: `39d4f0dd13199a05937af7c39d50588a989c21a3`.
- Per-batch pending-signature recovery PR #351: `0e228bb3553a20d8e345038ff9e71cb93604aea0`.
- Phase B submit capability migration PR #350: `38223b14272aab57bf0d1c3ebfe993d9ec054dc0`.

Current Production application commit: `0e228bb3553a20d8e345038ff9e71cb93604aea0`; Cloudflare Pages deployment passed.

Production read-only queries confirm:
- Latest migration ledger version: `20261027143100`.
- `pay_payout_transaction_requests` exists; `authenticated` cannot SELECT it.
- `pay_payout_items_batch_recipient_uq` exists.
- `pay_create_payout_batch` rejects duplicate recipients.
- `pay_submit_payout_batch` checks `solmint_pay_payout_builder`.
- Authenticated retains EXECUTE permission on the submit RPC, but ordinary user JWTs fail its function-level capability check; the server-issued payout-builder JWT is required by the function body.

Application commit `0e228bb3553a20d8e345038ff9e71cb93604aea0` passed:
- CI / unit tests: [run 40504617076](https://github.com/azad2022/solsite/actions/runs/40504617076).
- Production Build: [run 40504617137](https://github.com/azad2022/solsite/actions/runs/40504617137).
- Database Security: [run 40504617162](https://github.com/azad2022/solsite/actions/runs/40504617162).
- Devnet E2E: [run 40504616977](https://github.com/azad2022/solsite/actions/runs/40504616977).
- Mainnet Read-only: [run 40504617067](https://github.com/azad2022/solsite/actions/runs/40504617067).
- Production API Smoke: [run 40504617133](https://github.com/azad2022/solsite/actions/runs/40504617133).
- Live Smoke: [run 40504617047](https://github.com/azad2022/solsite/actions/runs/40504617047).
- Live Browser Audit, including referral lifecycle and authenticated browser UI script: [run 40504617088](https://github.com/azad2022/solsite/actions/runs/40504617088).
- Cloudflare Pages production deployment: PASS.

Production Browser UI E2E: **PASS** — [run 40504617153](https://github.com/azad2022/solsite/actions/runs/40504617153), including the dedicated referral lifecycle and authenticated UI.

Migration provenance note: read-only database queries show Phase B is recorded in Production. I did not dispatch the Production Migration workflow, and the available GitHub Actions history did not establish the execution origin. No direct SQL migration was issued by this work. Provenance is **UNKNOWN** and is not attributed to a specific actor.

At the time this entry was written, post-Phase-B smoke automation was pending. That status was superseded by the 2026-10-27 follow-up below after PR #352 merged and both post-deployment smoke workflows passed.

The separate `Workers Builds: solsite` is a legacy Worker integration failure, not the documented Cloudflare Pages deployment path. No payment completion is inferred from a submitted signature; authoritative verification remains server-side.

## 2026-10-27 — Bulk Pay post-Phase-B smoke closure and follow-up blockers

Status: **POST-DEPLOYMENT AUTOMATION PASS / FULL FINANCIAL-LIFECYCLE ACCEPTANCE BLOCKED**

Current `main` release commit for workflow evidence: `d8523ea01c4d4cb7e16f522587b322a300744242`. PR [#352](https://github.com/azad2022/solsite/pull/352) is merged. This change touched smoke workflows and documentation, not payout application code or database migrations.

Evidence on the merge commit:
- CI / Quality and unit tests: **PASS** — [run 40520417775](https://github.com/azad2022/solsite/actions/runs/40520417775).
- Production Build: **PASS** — [run 40520417755](https://github.com/azad2022/solsite/actions/runs/40520417755).
- Authentication Build Verification: **PASS** — [run 40520417756](https://github.com/azad2022/solsite/actions/runs/40520417756).
- Cloudflare Pages deployment: **PASS** — [check 122246331873](https://github.com/azad2022/solsite/runs/122246331873).
- Production API Smoke: **PASS** after Pages passed — [run 40520417881](https://github.com/azad2022/solsite/actions/runs/40520417881).
- Live Smoke: **PASS** after Pages passed — [run 40520417819](https://github.com/azad2022/solsite/actions/runs/40520417819).

Database Security and actual Devnet Bulk Pay transaction build/send/finalized-verification E2E passed on unchanged app/Phase B source commit `38223b14272aab57bf0d1c3ebfe993d9ec054dc0`: [run 40505975783](https://github.com/azad2022/solsite/actions/runs/40505975783) and [run 40505975665](https://github.com/azad2022/solsite/actions/runs/40505975665). These were not rerun on `d8523ea` because application code did not change. The current Production API Smoke and Live Smoke are non-mutating and do not exercise an authenticated end-to-end payout batch lifecycle.

Production database read-only evidence:
- Both Phase A and Phase B are recorded in the live migration ledger; latest relevant version: `20261027143100`.
- `pay_payout_transaction_requests` exists and is not readable by `authenticated`.
- The unique `(batch_id, recipient)` index exists; there are currently no payout batches/items or stored prepared requests.
- The `pay_submit_payout_batch` and transaction-preparation RPCs check the server-issued internal capability. The ordinary user JWT is rejected by the isolated database security fixture.
- **Migration provenance remains UNKNOWN**. The live ledger proves the version is recorded but the available evidence does not establish which actor/workflow applied it. No Production migration was run by this audit.

Superseding status after PR #353 merged and the current Production database was re-verified:
1. **PASS — Direct create-RPC boundary.** The live `pay_create_payout_batch` requires `solmint_pay_payout_creator=true`; a rollback-only probe using an ordinary authenticated JWT returned `{"state":"unauthorized"}`.
2. **PASS — SOL atomic upper bound.** API and live SQL now reject SOL item values greater than `9007199254740991`, matching the existing builder.
3. **NOT RUN — Full authenticated Bulk Pay payout lifecycle E2E.** Track [issue #354](https://github.com/azad2022/solsite/issues/354); current smoke suites do not run create → prepare → sign/send → registration recovery → finalized verification.
4. **UNKNOWN — Production migration execution provenance.** Version `20261027150000` is present in the live ledger and its function body is live. Supabase runner logs identify internal workflow `139e72e99c09443a9cc8d0ee1ef10e36` on the project's `main` branch, but no initiating actor/control is logged and no matching official GitHub `workflow_dispatch` run on 2026-10-27 was found. Track [issue #355](https://github.com/azad2022/solsite/issues/355).
5. **MEDIUM — Transaction-size / expiry recovery UX.** Batches that exceed Solana transaction size can still be persisted before the builder failure is known; expired prepared transactions are not silently rebuilt, but safe user/operator recovery needs lifecycle tests and explicit UX.
6. **NOT RUN on the current release SHA — Mainnet Read-only.** Last previously observed pass was on older commit `0e228bb3553a20d8e345038ff9e71cb93604aea0`; that is historical evidence, not a fresh run.

The legacy `Workers Builds: solsite` check still fails independently of the successful Cloudflare Pages deployment. It is not the configured Pages production deployment, and it was not masked or changed. No real Mainnet transfer was attempted by this audit. Payment completion remains dependent on server-side finalized blockchain verification.


## 2026-10-27 — PR #353 deployed; security patch live; governance gate remains

Current code release SHA: `6972b0e7aa74e670245045720d332c24c604af27` (merged PR [#353](https://github.com/azad2022/solsite/pull/353)).

Post-merge gates: CI/quality [40523523302](https://github.com/azad2022/solsite/actions/runs/40523523302), Production Build [40523523154](https://github.com/azad2022/solsite/actions/runs/40523523154), Auth Build Verification [40523523389](https://github.com/azad2022/solsite/actions/runs/40523523389), Cloudflare Pages [122257148361](https://github.com/azad2022/solsite/runs/122257148361), Database Security [40523523221](https://github.com/azad2022/solsite/actions/runs/40523523221), Devnet E2E [40523523771](https://github.com/azad2022/solsite/actions/runs/40523523771), Production API Smoke [40523523238](https://github.com/azad2022/solsite/actions/runs/40523523238), Live Smoke [40523522949](https://github.com/azad2022/solsite/actions/runs/40523522949), Browser UI E2E [40523523299](https://github.com/azad2022/solsite/actions/runs/40523523299): **PASS**. The browser run covered authenticated merchant/wallet/invoice/payment-link/support flows, not a Bulk Pay payout lifecycle. Legacy Workers check [122257789655](https://github.com/azad2022/solsite/runs/122257789655) remains **FAIL** but is distinct from Pages.

Production ledger/runtime now show Phase A `20261027143000`, Phase B `20261027143100`, and hardening migration `20261027150000`. A real production RPC probe in a transaction that was rolled back confirms a normal authenticated token receives `unauthorized` for create RPC without the internal creator capability. No Mainnet payout was sent.

**Migration audit deviation:** no manual SQL, Supabase `apply_migration`, Supabase branch-merge, or official GitHub `workflow_dispatch` migration was intentionally invoked by this audit. However, Supabase logs show an internal runner cloning `git_ref=main` at `2026-10-27T14:41:49.895Z` and applying `20261027150000_solmint_pay_bulk_payout_create_capability_hardening.sql` at `14:41:54.694Z`, followed by its PostgreSQL DDL at `14:41:54.831Z`. The Supabase app check for the merge SHA ran in the same window. The logs don't name the initiating actor/control; the official GitHub migration workflow has no matching run that day. Keep provenance **UNKNOWN**, do not rollback the security migration, and resolve automation ownership/control through [issue #355](https://github.com/azad2022/solsite/issues/355).

Remaining acceptance gate: full authenticated Bulk Pay lifecycle E2E [issue #354](https://github.com/azad2022/solsite/issues/354). The feature is **not yet fully production-accepted** until that lifecycle is covered with an isolated database and Devnet, plus the migration deployment provenance is resolved.

## 2026-10-28 — Payment Link webhook payload enrichment (Feature 1a)

Status: **LIVE IN PRODUCTION — POST-DEPLOY SMOKES PASS — RELEASE-PROVENANCE GATE UNKNOWN/BLOCKED**

Release identity:
- PR [#361](https://github.com/azad2022/solsite/pull/361) merged on 2026-10-28 at `06:58:15Z`.
- Main merge commit: `dbe7453ba7b48bb47ebe6db158c4bb9816c92c88`.
- Feature migration: `20261028064400_solmint_pay_webhook_payload_enrichment.sql`.
- The repository migration ledger now records the 104 migrations observed in Production, including this feature migration. The migration was deployed, but **not by the repository's documented migration workflow**; the execution path must remain marked unknown until the existing control issue is resolved.

Feature implementation:
- Enriches only `pay_enqueue_webhook_deliveries()`; preserves the existing `id/type/createdAt/data` envelope and `payment.status_changed` event type.
- Adds a strict allowlist: Payment Intent ID, current/previous status, exact atomic amounts as JSON strings, asset, network, external order ID, Payment Link ID/slug and existing reason.
- Emits the Payment Link slug only when authoritative `payment_link_id` is present. Direct Payment Intent metadata cannot impersonate a Payment Link snapshot.
- Excludes full metadata, fee recipient, payer identity fields, webhook secrets/ciphertext, IP and unrelated private data.
- Retains SECURITY DEFINER, empty `search_path`, role restrictions, merchant/active/subscription filters, immutable endpoint/signing snapshots and delivery idempotency.
- Adds an isolated PostgreSQL trigger-path/security test and wires it into the existing database-security workflow.

Validation evidence:
- **PASS** — PR CI/quality, Database Security, Devnet E2E, Production Build and Cloudflare Pages preview on the final PR revisions. Main push checks on merge commit `dbe7453ba7b48bb47ebe6db158c4bb9816c92c88` passed: [CI](https://github.com/azad2022/solsite/actions/runs/40647101366), [Database Security](https://github.com/azad2022/solsite/actions/runs/40647101402), [Devnet E2E](https://github.com/azad2022/solsite/actions/runs/40647101311), [Production Build](https://github.com/azad2022/solsite/actions/runs/40647101352), and Cloudflare Pages [check 122678596923](https://github.com/azad2022/solsite/runs/122678596923).
- **PASS — post-deploy Live Smoke:** [run 40647249201](https://github.com/azad2022/solsite/actions/runs/40647249201).
- **PASS — post-deploy Production API Smoke:** [run 40647249254](https://github.com/azad2022/solsite/actions/runs/40647249254).
- **FAIL — official production migration workflow:** [run 40647321161](https://github.com/azad2022/solsite/actions/runs/40647321161) failed at `supabase db push --dry-run` with PostgreSQL `28P01` / password authentication failed for the configured database user. The workflow skipped both Apply and Verify steps. Do not claim this workflow deployed the migration.
- **FAIL — separate legacy Workers check:** [run 122678580472](https://github.com/azad2022/solsite/runs/122678580472). Cloudflare Pages succeeded. The separate Workers failure is recorded rather than suppressed.
- Supabase Preview passed on the merged commit, but its linked integration runner also applied the migration outside the documented workflow, which is the provenance discrepancy below.

Production migration and read-only checks:
- Supabase unified logs show a runner with `workflow_run=88b3c77423ff488a88715a60699c2728` and branch `fabf1ac3-5428-45a1-a707-f466ee49eaed` cloning `git_ref=main` at `2026-10-28T06:58:44.885Z` and logging `Applying migration... file=20261028064400_solmint_pay_webhook_payload_enrichment.sql` at `2026-10-28T06:58:49.406Z`.
- PostgreSQL logs record the migration's `CREATE FUNCTION`, `REVOKE`, and `GRANT` at `06:58:49Z`. This strongly correlates the database change with the Supabase-linked runner, but the logs do not identify the initiating actor/control. **Provenance remains UNKNOWN.**
- Read-only verification confirms 104 live migration records and the expected latest version, matching function definition, SECURITY DEFINER, empty `search_path`, enabled event trigger, and EXECUTE grants only to `postgres` and `service_role`.
- Production counts remained 48 payment links, 111 payment intents and 45 payment events; webhook subscriptions and deliveries remained zero. No production Payment Intent, webhook or event was created for testing.

Release governance / next gate:
- The feature implementation is deployed and the available post-deploy smoke checks passed.
- **Do not mark release governance fully accepted** until issue [#355](https://github.com/azad2022/solsite/issues/355) establishes why the Supabase-linked runner applies migrations on merge and reconciles that behavior with `docs/solmint-pay-production-migration-policy.md`. This release's evidence was added to issue #355. No Supabase integration setting was changed and no migration was retried through an alternate path.
- The official migration workflow's database credential must be corrected through the approved secret-management route; do not ask for or print the secret value.
- No rollback is requested: the deployed function matches the reviewed source migration and read-only contract/security checks passed. If rollback becomes necessary, use a new forward migration restoring the exact prior function definition; never use ad hoc Production SQL or migration history repair.


## 2026-10-29 — Payment Link Upgrade re-audit (HELD; no Production mutation)

Status: **RELEASE BLOCKED — PR #363 remains Draft and unmerged. No Production SQL, migration, or payment operation was executed in this re-audit.**

### Repository / CI evidence

- Audited branch: `feat/pay-payment-link-upgrade-stages-2-3`; code HEAD at audit start: `9c6d98178b2952e92ee2c007069901a0c75ee746`.
- PR #363 remains open, Draft, and unmerged: https://github.com/azad2022/solsite/pull/363
- Current HEAD checks passed: CI run [40727991265](https://github.com/azad2022/solsite/actions/runs/40727991265), Production Build [40727991037](https://github.com/azad2022/solsite/actions/runs/40727991037), Database Security [40727991149](https://github.com/azad2022/solsite/actions/runs/40727991149), Devnet E2E [40727990982](https://github.com/azad2022/solsite/actions/runs/40727990982), Mainnet read-only [40727991194](https://github.com/azad2022/solsite/actions/runs/40727991194).
- Historical Production Build failure [40673983476](https://github.com/azad2022/solsite/actions/runs/40673983476) on earlier source: application build passed; the Referral route smoke step chose the Cloudflare dashboard “View logs” URL as the preview URL and timed out after 120 attempts. The branch's current preview-URL parser now selects a successful Pages check with an explicit Preview URL; the current Production Build workflow passes.
- Cloudflare Workers Builds preview failure was caused after `bun run build` succeeded: the old duplicate preview build ran `npx wrangler versions upload`, then Wrangler failed with “Missing entry-point to Worker script or to assets directory.” This is the separate legacy Workers Builds integration, not the repository's passing Cloudflare Pages production path. Cloudflare's old non-production trigger is marked deleted; the current main-only trigger deploys Pages with `npx wrangler pages deploy dist`. Do not modify Cloudflare settings as part of this checkout change.

### Read-only Production database verification

- Live Supabase migration ledger currently returns 104 migration records; latest is `20261028064400_solmint_pay_webhook_payload_enrichment`.
- Target migration `20261028101500_solmint_pay_payment_link_upgrade_stages_2_3` is absent from the live ledger.
- Live `public.pay_payment_links` has no `success_url`, `max_payments`, or `checkout_fields`; live `public.pay_payment_intents` has no `payment_link_success_url`, `payment_link_checkout_fields`, or `customer_custom_fields`.
- Earlier controlled DRY_RUN [40880951699](https://github.com/azad2022/solsite/actions/runs/40880951699) passed Session Pooler authentication and listed only the target migration; Apply was skipped. The live ledger/schema are still unchanged from the read-only verification.
- Supabase-linked migration provenance remains unresolved in [Issue #355](https://github.com/azad2022/solsite/issues/355). The controlled Apply path remains blocked until provenance and the approved sequence are resolved.

### Payment Link implementation audit — partial pass, open findings

- The new intent creator locks the Payment Link row with `FOR UPDATE` before checking idempotency/capacity. A completed matching idempotency record is replayed before link availability and capacity checks; a mismatched hash conflicts.
- Capacity is currently defined as completed intents (permanent consumption) plus `created/pending/detected/verifying/confirmed` intents whose `expires_at > now()`. Expired timestamps free capacity even if a status-cleanup job has not changed the status. Failed/expired/underpaid/overpaid/wrong-token/wrong-recipient/duplicate/ambiguous/refunded states do not count.
- Disposable-PostgreSQL Database Security workflow currently passes and includes a two-session capacity race, idempotent replay, expiry release, custom field validation and selected `has_function_privilege` checks. The privilege checks are not a complete matrix across anon/authenticated/service_role for every changed overload; strengthen them before release.
- Public Payment Intent GET explicitly selects and returns a bounded field list; it excludes first/last name, purpose, custom field values and the custom field definitions. Public checkout logs do not intentionally serialize request bodies/custom values. Existing webhook payload construction is explicit/allowlisted and excludes customer names and custom field values (D2 default NO is currently respected).
- API success URL validation uses the platform URL parser and rejects invalid URLs/credentials, whereas the SQL constraint currently relies on a looser HTTPS-authority regex. These are not fully equivalent two-way validators and must be aligned/tested before release.
- API preserves multiline whitespace for `textarea`, but the SQL normalizer collapses whitespace. Align semantics or document/test deliberate behavior.
- The migration is additive and defaults existing links to `success_url = NULL`, `max_payments = NULL` (unlimited), and `checkout_fields = []`; this should preserve old behavior structurally. A live smoke against the existing 48 links is **not yet validated**, because the migration remains unapplied.
- The named `solmint-pay-payment-link-upgrade` skill file was not found at the expected repository skill paths; the available Build Web Apps, Release Audit, master frontend instruction and checkpoint docs were reviewed. The pasted task text remains the task contract; no alternative skill file is assumed.

### Deployment sequence proposal and owner decisions pending

- Recommended: split into Phase A (migration and SQL security/concurrency tests only) and Phase B (application/API/UI changes only after read-only production schema/RPC/grant/RLS verification confirms Phase A). Keep old overload removal as Phase C. Do not merge or apply until the maintainer explicitly approves the sequence and all blocking findings are reconciled.
- D2: default is no customer PII/custom values in webhooks; current payload follows an allowlist.
- D3: proposed capacity statuses are completed + unexpired active reservation statuses listed above.
- D5: current implementation allows at most five `text/email/textarea` fields with required/optional semantics. Owner decision remains pending.

This checkpoint records findings only. It is not production acceptance and does not authorize `APPLY` or merge.

## 2026-10-29 — Payment Link upgrade stages 2–3 released and live-verified

Status: **RELEASED — controlled migrations applied, Production deployed, requested release gates passed**

- Pull request [#363](https://github.com/azad2022/solsite/pull/363) was squash-merged to `main`.
- Merge commit: `33713e1e8e19248c1c4ce20fe9bc221475ed096d`.
- Feature head immediately before merge: `a24bd0a028e87240756b68f1cacaf11387664c51`.
- The exact merge commit was deployed by Cloudflare Pages; the Pages check is [here](https://github.com/azad2022/solsite/runs/123501907314). The legacy external `Workers Builds: solsite` check still fails independently and is not the configured Pages deployment path.

### Controlled Production migration evidence

Both Production migrations were applied using the repository-controlled `SolMint Pay Production Migration` workflow. No manual SQL mutation was used.

| Gate | Evidence | Result |
|---|---|---|
| DRY_RUN of feature migration; exactly one pending migration | [Run 40886346878](https://github.com/azad2022/solsite/actions/runs/40886346878) | PASS |
| APPLY + migration ledger verification for `20261028101500_solmint_pay_payment_link_upgrade_stages_2_3.sql` | [Run 40887513648](https://github.com/azad2022/solsite/actions/runs/40887513648) | PASS |
| DRY_RUN of corrective privilege migration; exactly one pending migration | [Run 40888030531](https://github.com/azad2022/solsite/actions/runs/40888030531) | PASS |
| APPLY + migration ledger verification for `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke.sql` | [Run 40888257913](https://github.com/azad2022/solsite/actions/runs/40888257913) | PASS |

### Independent read-only Production verification

After both APPLY runs, live PostgreSQL read-only checks confirmed:

- Both target versions are recorded in `supabase_migrations.schema_migrations`.
- All six new columns exist across `public.pay_payment_links` and `public.pay_payment_intents`.
- RLS remains enabled on `pay_payment_links`, `pay_payment_intents`, and `pay_idempotency_keys`.
- The configured create/update Payment Link RPC overloads have `anon EXECUTE=false`, `authenticated EXECUTE=true`, `service_role EXECUTE=false`. The corrective migration was added after the first live verification found a direct `service_role` grant that the first migration/test fixture had not exposed.
- The custom Payment Intent creator remains service-role-only; the old creator signature without payer identity/capacity is non-executable. Existing pre-Phase-C overloads remain in place and Phase C has not been executed.
- Before production Browser UI E2E created its test fixture, all **48 pre-existing Payment Links** had the intended backward-compatible defaults: `success_url IS NULL`, `max_payments IS NULL`, and `checkout_fields = []`. The post-smoke count is 49 because the authenticated Browser UI E2E intentionally retained one inert test link and append-only audit history; all 49 current links have the same legacy defaults.
- At final post-smoke read, counts were 113 Payment Intents, 46 payment events, 0 webhook subscriptions and 0 webhook deliveries. The retained fixture's merchant is suspended, the user is inactive, and its link is inactive. Two fixture Payment Intents and one event remain as immutable audit evidence by design; the E2E cleanup explicitly verifies the fixture is inert.

### CI and post-merge Production smoke evidence

Checks on the reviewed feature head:

- [CI / Quality — Run 40888025387](https://github.com/azad2022/solsite/actions/runs/40888025387): PASS.
- [Database Security, including capacity concurrency and corrective grants — Run 40888024956](https://github.com/azad2022/solsite/actions/runs/40888024956): PASS.
- [Devnet E2E — Run 40888025250](https://github.com/azad2022/solsite/actions/runs/40888025250): PASS.
- [Mainnet read-only — Run 40888024988](https://github.com/azad2022/solsite/actions/runs/40888024988): PASS.
- [Production Build — Run 40888024821](https://github.com/azad2022/solsite/actions/runs/40888024821): PASS.

Post-merge gates on `main` / merge commit:

- [Production API Smoke — Run 40888926558](https://github.com/azad2022/solsite/actions/runs/40888926558): PASS.
- [Live Smoke — Run 40888926402](https://github.com/azad2022/solsite/actions/runs/40888926402): PASS.
- [Production Browser UI E2E — Run 40888926564](https://github.com/azad2022/solsite/actions/runs/40888926564): PASS. This includes the dedicated referral lifecycle E2E, authenticated browser UI, Payment Link create/update/delete guard, Payment Intent lookup, ticket lifecycle, locale persistence, and evidence artifact upload ([screenshots/artifact](https://github.com/azad2022/solsite/actions/runs/40888926564/artifacts/12903553899)).

### Security and scope decisions

- D2: no customer names, purpose or custom-field values in merchant webhook payloads; payload stays allowlisted.
- D3: no separate capacity-status lookup table was added. Capacity status semantics remain explicit in the authoritative database routine and are covered by database/security tests.
- D5: custom Checkout fields remain capped at five and restricted to the existing `text`, `email`, and `textarea` types.
- Capacity is database-authoritative and serialized under `SELECT ... FOR UPDATE` on the Payment Link row. Matching idempotent replays are handled before capacity rejection. Expired reservations stop consuming a slot. Checkout redirects only after the public Intent API returns authoritative `completed`.
- Custom field values and definitions are not returned by the public Payment Intent response; the webhook envelope remains allowlisted.
- No new API family or financial business rule was introduced. Financial truth remains backend-owned.

### Known exceptions that are not silently marked resolved

- [Issue #355](https://github.com/azad2022/solsite/issues/355) remains **OPEN / provenance UNKNOWN**. A read-only 24-hour Supabase unified-log query on 2026-10-29 found one internal runner clone of `main` but zero `Applying migration` rows in that window; this does not identify the earlier runner's initiator or prove the integration setting. Do not attribute an actor or disable/reconfigure Supabase GitHub Integration based on timing alone.
- The separate external `Workers Builds: solsite` check remains failed; Cloudflare Pages for the actual site deployment passed. Do not create an unrelated Worker or weaken repository gates to mask that external integration.
- The project-wide Supabase Security/Performance advisor findings observed on 2026-10-29 were recorded as baseline advisories; unrelated RLS/SECURITY DEFINER, extension, index or auth settings were not changed as part of this release.
- The extra [Live Browser Audit run 40888926523](https://github.com/azad2022/solsite/actions/runs/40888926523) had a first-attempt referral stats locator timeout while the same dedicated referral lifecycle E2E passed in the official Browser UI E2E. Attempt 2 was requested; record its final result when completed. This separate audit is not substituted for the passing three requested post-merge gates above.

Phase C (removal of old Payment Link RPC overloads) is intentionally **not performed** and requires separate explicit approval.

## 2026-10-29 — Payment Link Upgrade stages 2–3 released and verified

Status: **RELEASED — migration ledger, live schema/security verification, CI, production API smoke, live smoke, and browser UI E2E passed.**

### Repository / merge
- PR [#363](https://github.com/azad2022/solsite/pull/363) is closed and merged by squash.
- Merge commit on `main`: `33713e1e8e19248c1c4ce20fe9bc221475ed096d`.
- Final feature branch commit reviewed by CI: `9b5cef7505c9b6b15e913e8d3a26e98e844e30f4`.
- Scope remains additive: success redirect snapshots, capacity enforcement under Payment Link row lock, idempotent replay before capacity checks, custom Checkout field validation/snapshotting, and the service-role grant correction. No Phase C overload removal was included.

### Controlled Production migration evidence
- Initial `DRY_RUN` on the PR branch: [Run 40886346878](https://github.com/azad2022/solsite/actions/runs/40886346878) — authentication and preview passed; exactly `20261028101500_solmint_pay_payment_link_upgrade_stages_2_3.sql` was pending; Apply and Verify were skipped.
- Feature migration `APPLY` and workflow ledger verification: [Run 40887513648](https://github.com/azad2022/solsite/actions/runs/40887513648) — PASS.
- Corrective migration `DRY_RUN`: [Run 40888030531](https://github.com/azad2022/solsite/actions/runs/40888030531) — only `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke.sql` pending.
- Corrective migration `APPLY` and workflow ledger verification: [Run 40888257913](https://github.com/azad2022/solsite/actions/runs/40888257913) — PASS.
- No SQL was manually executed against Production.

### Independent read-only live verification after release
- The live migration ledger records both `20261028101500` and `20261029140401`.
- All six expected columns exist:
  - `pay_payment_links.success_url`, `max_payments`, `checkout_fields`
  - `pay_payment_intents.payment_link_success_url`, `payment_link_checkout_fields`, `customer_custom_fields`
- Latest post-smoke counts: 51 Payment Links, 117 Payment Intents, 48 payment events, 0 webhook subscriptions (`pay_webhooks`), and 0 webhook deliveries.
- All 51 links retain legacy-compatible values: `success_url IS NULL`, `max_payments IS NULL`, and `checkout_fields = []`. This includes 46 suspended browser-E2E fixture links and 5 non-browser-E2E links; no existing link was rewritten to a new redirect, capacity cap, or custom field schema.
- All 117 intents retain null success redirect snapshots, empty field-definition snapshots, and empty custom field values at verification.
- RLS is enabled on `pay_payment_links`, `pay_payment_intents`, and `pay_idempotency_keys`.
- Live `has_function_privilege` matrix for the new merchant-session create/update overloads: `anon=false`, `authenticated=true`, `service_role=false`.
- Live Payment Intent creation overload with custom-field values: `anon=false`, `authenticated=false`, `service_role=true`. The legacy creator overload without the payer/capacity contract is non-executable for all three checked roles.
- The database grants and schema were read-only inspected; no additional Production DDL was executed during verification.

### CI and post-merge runtime gates
- CI / typecheck / unit tests: [Run 40888025387](https://github.com/azad2022/solsite/actions/runs/40888025387) — PASS.
- Database Security including Payment Link grant-reproduction and two-session capacity concurrency tests: [Run 40888024956](https://github.com/azad2022/solsite/actions/runs/40888024956) — PASS.
- Devnet E2E: [Run 40888025250](https://github.com/azad2022/solsite/actions/runs/40888025250) — PASS.
- Mainnet read-only: [Run 40888024988](https://github.com/azad2022/solsite/actions/runs/40888024988) — PASS.
- Production Build / Cloudflare Pages preview-route validation: [Run 40888024821](https://github.com/azad2022/solsite/actions/runs/40888024821) — PASS.
- Post-merge Production API Smoke: [Run 40890460032](https://github.com/azad2022/solsite/actions/runs/40890460032) — PASS.
- Post-merge Live Smoke: [Run 40890459973](https://github.com/azad2022/solsite/actions/runs/40890459973) — PASS.
- Post-merge Production Browser UI E2E, including dedicated referral lifecycle and authenticated browser route/UI audit: [Run 40890460838](https://github.com/azad2022/solsite/actions/runs/40890460838) — PASS.
- The browser E2E intentionally retains historical fixtures with immutable Payment Intent references; its disposable test merchants are suspended and their links use legacy defaults. No real on-chain payment was submitted by these smoke checks.

### Decisions preserved
- D2: customer personal/custom-field data remains excluded from merchant webhook payloads.
- D3: no separate capacity-state table; PostgreSQL remains authoritative for capacity.
- D5: maximum five custom Checkout fields.
- Phase C (removing legacy overloads) is not part of this release and requires separate explicit approval.
- Issue [#355](https://github.com/azad2022/solsite/issues/355) remains open for the separate Supabase-linked migration-runner provenance investigation. Both migrations in this release were applied through the controlled, auditable GitHub Actions workflow. The independent runner's exact trigger/actor remains **UNKNOWN** and must not be described as resolved.



## 2026-10-29 — Workers Builds duplicate deployment path retired

Status: **RESOLVED for Cloudflare Workers Builds duplicate trigger; production remains on the existing Cloudflare Pages integration.**

- Read-only Cloudflare inspection found a second active Workers Builds trigger for the same `azad2022/solsite` repository and `main` branch. It ran the same `bun run build` command and then attempted `npx wrangler pages deploy dist`.
- The last three main-branch Workers Builds logs show that the build itself completed, but the deploy command failed because it targeted Pages project `solmint`; the actual configured Pages project is `solsite`.
- The actual Cloudflare Pages project remains linked to `azad2022/solsite:main`, builds `bun run build` to `dist`, and the latest deployment for `29ac6279fe9060db784d2802057c8038a78bb5ab` passed its build and deploy stages. The `solmint.ir` domain remains attached to that Pages project.
- Deleted the single active duplicate Workers Builds production trigger through the Cloudflare API on 2026-10-29. A read-back of the Worker-build trigger list returned an empty list. Historical failed build records remain as audit history; the failed checks were not suppressed or relabeled.
- No Cloudflare Pages settings, custom domains, runtime bindings, secrets, repository code, or production database were changed for this cleanup.

### Separate unresolved database deployment governance item

Issue [#355](https://github.com/azad2022/solsite/issues/355) remains **OPEN**. Supabase unified logs still show the linked internal runner cloning `main`, but a read-only query over 2026-10-28 17:00 UTC through 2026-10-29 17:00 UTC found no `Applying migration` event in that window. This is not proof that automatic Production deployment is disabled or that the historical provenance issue is resolved.

The available Supabase connector does not expose the GitHub Integration dashboard setting. Per [Supabase's GitHub Integration documentation](https://supabase.com/docs/guides/deployment/branching/github-integration), the `Deploy to production` toggle is the provider-level control for automatic migration deployment. Do not close Issue #355 until that toggle is directly inspected, disabled if enabled with owner approval, and the state is verified. Both Payment Link Upgrade migrations were still applied through the documented, audited GitHub Actions `DRY_RUN` → approved `APPLY` path.


## 2026-10-30 — Subscription Billing baseline discovery (documentation checkpoint)

Status: **BASELINE AUDIT RECORDED — no Subscription implementation or release claimed.**

### Repository and branch
- Reviewed `main` baseline: `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- Latest main commit is documentation-only; it adds the Subscription Billing engineering Skill and updates Build Web Apps / Release Audit guidance.
- Created `feat/pay-subscription-billing` from that exact main SHA.
- Added `docs/solmint-pay-subscription-baseline-audit.md` in commit `eea8ddb0685c20d03fd317424d548ca736ea212f`.
- No PR was opened. No source application code or dependency was changed.
- Local Working Tree could not be inspected because direct Git access failed at DNS resolution; record local status as **UNKNOWN**.
- No current-head CI statuses/workflow runs were returned for the documentation-only baseline; do not claim CI PASS.

### Live Production discovery
- Supabase project `nvopkbiedorfshwbmyhn` returned `ACTIVE_HEALTHY`.
- Live Migration Ledger: 106 entries, latest `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- 33 `public.pay_*` tables exist; all 33 have RLS enabled. No Subscription, Billing Cycle, Consent, or Collector application tables or public routines were found. RLS FORCE is not enabled on these tables; this is an observation, not a standalone vulnerability finding.
- The live `pay_apply_verified_observation` body confirms normal Pay requires the merchant and gateway transfers to share one `sourceAuthority`, requires that authority to equal transaction `fee_payer`, and rejects gas-sponsored payments. A delegated Subscription Authority PDA and Collector fee payer are distinct; ordinary reconciliation is therefore incompatible without a separate reviewed adapter. Do not weaken the normal verifier.

### Existing implementation contracts inspected
- Payment Intent creation/read routes, domain types, fee snapshot and asset policy were inspected. Existing payment creation is idempotent and server-mediated; no typed Subscription/Cycle/Consent relation exists in the live Payment Intent schema.
- Asset policy supports SOL and configured USDC/USDT with the original SPL Token Program. Token-2022 remains intentionally unsupported in ordinary Pay.
- Bulk Pay routes and builder were inspected: the Merchant source wallet signs the server-prepared transaction; the current transaction fee payer is that Merchant source wallet. This is not a Collector signing architecture.
- Current `package.json` contains `@solana/web3.js@1.99.0` and `@solana/spl-token@0.4.15`; it does not declare `@solana/subscriptions`.

### Blockers / unknowns carried forward
- Subscription API/domain implementation and isolated Collector signer are not present in the inspected implementation.
- Mainnet ProgramData/binary hash, on-chain IDL, release compatibility, complete Cantina PDF and audit delta were not verified: **UNKNOWN**.
- Issue #355 remains open; historical external migration-runner provenance is **UNKNOWN**. Production DDL is not authorized by this checkpoint.
- Issue #356 remains open for Bulk Pay database-boundary recipient/asset validation.
- Issue #354 remains open for authenticated full-lifecycle Bulk Pay E2E. This is separate from Subscription.
- No Production schema, secrets, runtime settings, on-chain Program, or funds were mutated.

### Next sequence
1. Complete a repository-wide route/domain inventory and external Program release/deployment/audit verification.
2. Write and review Subscription domain/API/DB contracts before creating migrations or routes.
3. Design the isolated Collector boundary and a dedicated Subscription verification/accounting adapter; preserve the current Pay verifier.
4. Define durable unique billing cycles, atomic claims, attempts and timeout/restart reconciliation before any scheduler/charge flow.
5. Implement and test only on `feat/pay-subscription-billing`, using disposable PostgreSQL and Devnet.
6. Build UI only after real Backend contracts exist. Production Apply, signing-key creation, live Plan/consent and Mainnet transfers require separate explicit approval.


## 2026-10-30 — Upstream Subscription release and audit-delta review

Status: **SOURCE TAGS IDENTIFIED; DEPLOYED-BINARY/AUDIT GATES STILL UNKNOWN.**

- Inspected upstream `solana-foundation/subscriptions` audit status, release changelog, pinned source/SDK tags, package metadata and IDL.
- Cantina audit baseline is `d6b3a5dc7ab18c4168441af733c81ab0a599d414`; remediation is stated through `debb4f75ff7571218b39de3b633074dd843e70db`.
- Compare confirms release commit `364a41976c33347d092902443bbec2def9227e75e` is 8 commits after the remediation commit. The exact eight-commit compare lists changes to release workflow/toolchain, manifests and lockfiles, audit/README files, IDL, TypeScript/Rust SDK files and tests, and sample webapp files. It does **not** list `program/src/**` Rust source files in this range; the earlier wording that claimed Rust instruction/state/transfer-helper changes was incorrect and is superseded. The SDK/IDL/dependency/build delta still needs security and compatibility review, and the Cantina report remains NOT REVIEWED. The release binary's full audit coverage is therefore not established by the remediation marker alone.
- Upstream changelog says v0.5.0 targeted Mainnet on 2026-08-10, but the deployed binary and on-chain IDL report `0.5.0-beta.1`, built at `364a419` before the version bump. This is upstream release-note evidence only; live ProgramData/binary/authority/slot and exact on-chain IDL were not independently read.
- SDK tag `ts-client-v0.5.0` declares `@solana/subscriptions@0.5.0` and peer dependency `@solana/kit ^7.0.0`; current SolMint runtime declares `@solana/web3.js@1.99.0` and no `@solana/kit`. SDK integration requires a compatibility/dependency design.
- Cantina PDF was identified by its path in upstream `audits/AUDIT_STATUS.md` but was not successfully retrieved/read in this session. Do not report the PDF as reviewed.
- Upstream security notes reinforce: u64::MAX ATA delegate, active does not imply collectable, slot-granular `init_id`, held/delayed signed transaction risks, dual-signer immediate cancellation, and broad impact of revoking shared authority. These behaviors must be explicit in Consent, authority lifecycle, reconciliation and customer support design.
- Follow-up evidence and exact limitations are recorded in `docs/solmint-pay-subscription-baseline-audit.md`.
- No source code, dependency, lockfile, migration, signer, ProgramData, RPC setting, or funds changed. No live or Devnet transaction was sent.


## 2026-10-30 — Upstream on-chain Subscription instruction spot-check

Status: **ON-CHAIN RULES SPOT-CHECKED; FULL RELEASE SECURITY REVIEW / LIVE DEPLOYMENT VERIFICATION STILL BLOCKED.**

- Read the pinned `program-v0.5.0` source for `create_plan`, `plan`, `subscribe`, `initialize_subscription_authority`, `transfer_subscription`, `transfer_utils`, `cancel_subscription`, `update_plan`, `revoke_subscription_authority`, `revoke_delegation`, and `revoke_abandoned_subscription`.
- Source confirms Plan cap of 1–8760 hours, 4 destination addresses and 4 additional pullers; Plan Owner is always an eligible Puller. Empty destination allowlist means any destination, so SolMint must enforce a non-empty allowlist at its own plan policy boundary.
- Subscribe binds current plan mint/amount/period/created_at and the subscriber's `SubscriptionAuthority.init_id`; SubscriptionDelegation stores a terms snapshot and per-period accounting. The shared ATA Token Delegate is approved for `u64::MAX`; effective limits are enforced by Plan/Subscription program state, not a single-cycle delegate allowance.
- Plan mint, amount, period and destinations are not mutable through UpdatePlan. Active plan lifecycle/status, end time, pullers and metadata may be updated with stale-state checks; finite end may only be shortened. After Sunset the plan is otherwise immutable except removal of Pullers.
- Normal cancellation remains valid through the current period's expiry boundary. It is different from dual-signed immediate cancellation, a per-subscription close, and revoking the shared User+Mint authority.
- Reinitializing the shared authority can re-approve the `u64::MAX` token delegate after a user revoked it, while retaining its original recorded payer. Revoke success must not be described as permanent protection against all held/delayed signed authorization transactions.
- The source confirms that the program enforces each pull's Plan/Subscription constraints but does not schedule billing. “Active” does not guarantee a pull is currently collectible.
- These verified source behaviors and SolMint implications are recorded in `docs/solmint-pay-subscription-baseline-audit.md`.
- This is a focused source spot-check, not a complete review of the 8-commit audit delta or Cantina PDF. Live ProgramData, deployed binary hash, upgrade authority, deployment slot, and exact live IDL remain **UNKNOWN**.
- No implementation, dependency, lockfile, schema, runtime config, signer, chain transaction or funds were changed.



## 2026-10-30 — Persistent Subscription Billing project instructions and security-skill hardening

Status: **DOCUMENTATION / THREAT-MODEL CHECKPOINT COMPLETE — NO SUBSCRIPTION IMPLEMENTATION OR RELEASE CLAIMED.**

### Repository and branch
- Revalidated `main` HEAD: `7b975d56860b6d937ad76ab2983c71937644dfa3`; the latest Main commit remains documentation-only.
- Work remains isolated on `feat/pay-subscription-billing`, based on that exact Main SHA. No PR is open for this branch.
- Created `docs/solmint-pay-project-instructions.md` (4,354 words, 332 lines) to be copied into ChatGPT Project Instructions. It consolidates stable engineering rules, task discovery, branch discipline, context efficiency, Subscription security, backend/DB boundaries, testing and Production gates.
- Updated `docs/skills/solmint-pay-subscriptions/SKILL.md`: corrected the dated baseline and added delayed signed transaction, sentinel `UNKNOWN_INIT_ID`, Durable Nonce, smart-wallet proposal, authority lifecycle, stale approval, Plan Owner external pulls, on-chain period, destination-owner, multi-leg fee, collectability and v1 safety controls.
- Updated `docs/skills/solmint-pay-build-web-apps/SKILL.md` with consent, collectability, delegated authority, pending approval, Plan Owner and UI truth constraints.
- Updated `docs/skills/solmint-pay-release-audit/SKILL.md` with adversarial release gates for delayed signatures, all Pullers, period accounting, multi-leg transfers, ProgramData/Audit and issue #355.
- Added the persistent instructions pointer to `docs/solmint-pay-frontend-master-instruction.md`.
- Extended `docs/solmint-pay-subscription-baseline-audit.md` with the additional official upstream residual-risk review.
- No source application code, package, lockfile, migration, live schema, RLS, grants, runtime bindings, secrets, signer, on-chain Program or funds were changed.

### New upstream security findings now made durable
- `init_id` is slot-granular, not a global generation. Same-slot close/re-init may preserve it.
- A held Init+Subscribe bundle using `UNKNOWN_INIT_ID` can recreate a revoked shared authority and establish a spendable subscription later without a new signature at landing. V1 therefore requires separate customer-signed Init and Subscribe using the actual observed `init_id`.
- Durable Nonce and pending smart-wallet/multisig proposals can outlive the normal recent-blockhash window. V1 defers these consent/control paths until pending transaction cancellation and recovery are proven.
- Same-period Resume replay, second-granular immediate-cancel replay and UpdatePlan ABA are explicit adversarial cases.
- The shared User+Mint authority has cross-subscription blast radius; token delegate initialization can replace an existing Delegate.
- Plan Owner is always an authorized Puller and can collect outside SolMint's Collector. Reconciliation must observe every authorized Puller and the cumulative on-chain Period state.
- Destination validation checks token-account owner; an empty destination list means any destination.
- A TransferSubscription instruction carries one receiver/amount. Principal+Gateway fee split is blocked until two-leg atomicity, cumulative period budget, verifier and accounting are proven by LiteSVM and Devnet tests.
- Active On-chain state does not prove collectability or service entitlement. The backend must inspect delegate/ATA/mint/amount preconditions and grant service only under a verified financial policy.
- These are upstream source/README facts and recommended v1 controls; they do not imply the repository has implemented those controls.

### External evidence and limitations
- Solana official documentation confirms durable nonces remove the normal 150-slot recent-blockhash expiry and allow delayed submission; official verified-build docs distinguish source/binary matching from code security or audit. References: Solana Durable Nonces and Verifying Programs documentation.
- The official upstream README Security Considerations is the source for the residual-risk review. The complete Cantina PDF was located and its GitHub blob SHA recorded, but it could not be decoded/rendered/read in this environment. PDF status remains **NOT REVIEWED**.
- The eight-commit post-remediation release delta remains incompletely audited; live ProgramData, binary hash, upgrade authority, deployment slot, exact live IDL and runtime SDK compatibility remain **UNKNOWN**.
- Issue #355 remains open; Production DDL remains blocked pending verified migration-runner provenance and the documented controlled workflow.
- Issue #354 and #356 remain separate open Bulk Pay gates; they are not represented as solved by this Subscription documentation work.
- Local Working Tree remains **UNKNOWN** because direct Git access failed in this session. GitHub connector confirms the changed branch files. Combined CI status for documentation-only commits returned no statuses; CI is **NOT RUN / NO EVIDENCE**, not PASS.

### Validation performed
- Re-read all updated Skill/spec/audit/progress files from `feat/pay-subscription-billing`.
- Confirmed the project instruction is 4,354 words, below the 7,700-word limit.
- Compared the feature branch against `main`; changes are confined to documentation paths for this checkpoint.
- No application tests were run because no application code changed. No CI, Devnet mutation or Production smoke was claimed.
- No PR opened; no merge or release performed.

### Next engineering sequence
1. Obtain and review the full Cantina PDF and eight-commit code/IDL/SDK delta.
2. Verify Mainnet ProgramData, Program binary hash/source, upgrade authority, deployment slot and on-chain IDL through read-only RPC/verified-build evidence.
3. Resolve the SDK Kit-v7 versus current web3.js 1.x integration strategy and pin the exact dependency/toolchain.
4. Design Subscription Domain/API/DB contracts, consent state/transition model, cycle identity, Collector trust boundary and dedicated verification/accounting adapter.
5. Decide and test the exact fee/transfer-leg model; no split-fee charging until atomic same-transaction tests pass.
6. Implement incrementally on this feature branch with isolated PostgreSQL, RLS/RBAC adversarial tests and Devnet E2E.
7. Keep Production migration, Collector key creation, live customer consent and Mainnet transaction disabled until all gates and explicit authorization are satisfied.


## 2026-10-30 — Draft documentation PR opened

- Opened Draft PR [#366](https://github.com/azad2022/solsite/pull/366), base `main` at `7b975d56860b6d937ad76ab2983c71937644dfa3`, head `feat/pay-subscription-billing` at `502aca934be7f2c934d4970c2fca89d827483048`.
- PR scope is documentation only: seven files, 830 additions and 6 deletions. It contains the project instruction, Subscription/Build Apps/Release Audit Skill updates, Master Specification pointer, baseline audit and this Progress update.
- PR #366 is **OPEN / DRAFT / NOT MERGED**. GitHub returned no status checks/workflow runs in the evidence fetched for this documentation checkpoint; do not describe CI as passed.
- No code, migrations, DB, runtime, secrets, signer, on-chain Program or funds were changed.


## 2026-10-30 — PR #366 latest documentation head CI observation

- At this check, PR #366 branch head was `670d83a09c4104e3db3dba35bf53b5b607829221`; it remained ahead of main with no behind commits.
- Production Build run `41036798997` for this documentation-only head completed with conclusion **success**.
- CI run `41036798704` remained **in_progress** at the time of observation. No CI PASS is recorded here.
- The Build result is not a test, Security, Devnet, Production smoke or Release Readiness result.


## 2026-10-30 — Fresh Production/Repository revalidation and Subscription implementation plan

Status: **READ-ONLY BASELINE REVALIDATED; IMPLEMENTATION PLAN COMMITTED; SUBSCRIPTION APPLICATION STILL NOT IMPLEMENTED.**

### Repository / PR / CI
- Revalidated `main` base at `7b975d56860b6d937ad76ab2983c71937644dfa3` and Subscription branch at `27001d3d9690c242115b87f41cb877e67dad6931` before this checkpoint.
- PR #366 remains **OPEN / DRAFT / NOT MERGED**.
- Prior head `27001d3` had CI and Production Build success; Supabase Preview was skipped. These are documentation-only checks, not Subscription validation.
- Added `docs/solmint-pay-subscription-implementation-plan.md` in commit `aca3e22fffb85f82a3eb1f27ea40cbabec68c913`, parent `27001d3`. The new commit's CI, Production Build and Cloudflare Pages checks were **IN PROGRESS** at this observation; Supabase Preview was skipped. Do not report this new head as green until terminal checks are read.
- New document records verified baseline, bounded-context separation, v1 constraints, merchant/customer consent, billing/Collector/reconciliation flow, accounting constraints, SDK/RPC gates and release sequence. It deliberately does not create API routes, SQL objects, or invented schema names.

### Current live Supabase read-only evidence
Project `nvopkbiedorfshwbmyhn` was reachable and healthy; PostgreSQL version reported as `17.6.1.147`.
- Exactly 33 `public.pay_*` base tables; RLS enabled on all 33; FORCE RLS on 0.
- `authenticated` has direct SELECT on 20 Pay tables; `anon` has direct SELECT on 0; `service_role` has INSERT/UPDATE/DELETE privileges on all 33.
- Production migration ledger contains 106 versions; latest is `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- Read-only table/routine discovery found no Subscription, Consent, Billing Cycle, or Collector application tables/routines.
- Relevant existing identity helpers use the internal JWT claim `solmint_user_id`; `pay_request_user_id` and `pay_has_merchant_access` are SECURITY DEFINER with empty search_path. This is a foundation to reuse only through the existing trusted server-mediated boundary, not permission to expose service-role writes to clients.
- Existing ordinary Pay verifier/accounting routine `pay_apply_verified_observation` has a different payer/source-authority contract from Subscription; keep it unchanged and design a separate Subscription adapter.
- All these DB operations were SELECT/introspection only. No row, schema, grant, policy, migration, or provider setting was changed.

### Source and external behavior
- Reconfirmed the upstream v0.5.0 Subscription source behavior relevant to Plan destination allowlists, implicit Plan Owner Pull rights, one-destination TransferSubscription instructions, per-period cumulative allowance, and token-account owner validation.
- Multiple pulls are covered by upstream tests as separate submissions; no reviewed upstream test established the exact same-transaction principal+fee multi-instruction case for SolMint. Split fee remains **BLOCKED** pending dedicated LiteSVM and Devnet proof.
- V1 remains restricted to configured original SPL Token assets (currently USDC/USDT); no native SOL or Token-2022 expansion.
- The current generic Mainnet read-only workflow uses the public Solana RPC endpoint. Do not treat it as the configured production RPC, a production fallback, or proof of the deployed Program identity.
- Full Cantina PDF remains **NOT REVIEWED**. Mainnet ProgramData, binary/source hash, upgrade authority, deployment slot, exact on-chain IDL, production RPC evidence and SDK Kit-v7/web3.js compatibility remain **UNKNOWN**.

### Open independent blockers
- Issue #355 is still **OPEN**. Migration-runner provenance and trigger remain **UNKNOWN**; Production DDL is blocked.
- Issues #354 and #356 remain open Bulk Pay gates and are unrelated to Subscription completion.
- Subscription API/domain/schema/migrations, Billing Engine, Collector signer, dedicated verifier/accounting adapter, adversarial tests, Devnet E2E and frontend are **NOT IMPLEMENTED**.

### Validation / mutation statement
- Read-only Repository, GitHub Actions and Production Supabase metadata/schema/privilege/function introspection performed.
- No application tests, Subscription integration tests, Devnet transactions, Mainnet transactions, Production DDL, deployment, secret/key changes or user funds movement occurred.
- Local Git Working Tree remains **UNKNOWN**; direct local Git access was unavailable. GitHub branch state and commit were verified via connector.
- No Production schema, RLS, grants, environment, secrets, signer, Program state, or funds changed.

### Next engineering sequence
1. Retrieve/render/read every page of the Cantina PDF and review the full post-remediation source/IDL/SDK delta.
2. Establish read-only Mainnet ProgramData/binary/upgrade-authority/IDL evidence through an approved non-public Mainnet RPC path.
3. Resolve and test the Kit-v7 SDK/web3.js 1.x adapter.
4. Produce reviewed Domain/API/Database/authorization/consent/state-transition contracts and exact fee/accounting model before adding migrations or routes.
5. Build isolated Collector signing, external-Puller discovery, dedicated verification, atomic billing cycles/attempts/accounting, with disposable DB/RLS adversarial tests.
6. Complete LiteSVM multi-leg and delayed-signature tests, then Devnet E2E; build UI only after backend gates.
7. Resolve Issue #355 and obtain explicit approval before any Production migration APPLY, signing key creation/rotation, live customer consent, or Mainnet transaction.


## 2026-10-30 — Subscription Plan policy slice + Mainnet CI false-positive correction

Branch: `feat/pay-subscription-billing`  
Validated HEAD: `157b594cea9180e5360c116c0f34dc190e9b92cc`  
Base main: `7b975d56860b6d937ad76ab2983c71937644dfa3`  
PR #366: OPEN / DRAFT / NOT MERGED.

### Code added
- `src/pay/services/subscriptionPlanPolicy.ts`: fail-closed pure server-side policy for pinned upstream v0.5.0 Plan input. It validates canonical u64 strings, non-zero amount, whole-hour period 1..8760, i64 end timestamp and one-period minimum finite Plan end using caller-supplied cluster time, canonical non-zero Solana addresses, explicit non-empty unique destination-owner allowlist (maximum 4), unique additional Pullers (maximum 4), UTF-8 metadata <=128 bytes, and server-resolved USDC/USDT on original SPL Token Program only.
- `tests/pay-subscription-plan-policy.test.ts`: 14 unit cases for valid input, maximum period and exact end boundary, too-near end, invalid amount/period/u64 representations, asset restrictions, empty/zero/oversized/duplicate destination list, Puller capacity/duplicates, address validation, UTF-8 metadata boundary and chain time/Plan ID.
- The module does not authorize a merchant, resolve a wallet, construct/sign a blockchain transaction, persist a Plan, or claim consent. Those remain separate contracts.

### Mainnet read-only workflow defect corrected
- Found that old Mainnet workflow command `bun test e2e/pay-mainnet-readonly.e2e.ts` returned success with **zero tests executed** (Bun filename filter mismatch). Previous green status was a false-positive and is not an evidence of Mainnet read-only validation.
- Updated the workflow to call `bunx tsx e2e/pay-mainnet-readonly.e2e.ts`.
- Removed implicit fallback from the test's `SOLANA_RPC_URL`; it now fails closed without explicit config and checks HTTPS.
- An initial syntax error in the new URL assertion caused commit `4a5f70d` to fail Mainnet E2E and Production Build. It was corrected to `startsWith('https://')` before the validated HEAD below. Do not hide this intermediate failure; the correction and final passing evidence are recorded here.

### CI evidence on exact HEAD `157b594...`
- Production Build run `41050650048`: **SUCCESS** (TypeScript production source check and production build passed).
- General CI run `41050650189`: **SUCCESS**. Unit-test job completed with 424 reported tests, 422 passed, 0 failed, 2 skipped. The 15 new Subscription Plan policy cases were explicitly present in the logs and all passed.
- SolMint Pay Database Security run `41050650137`: **SUCCESS**. This runs existing isolated PostgreSQL/Pay security fixtures; it does not validate a Subscription schema (none exists yet).
- SolMint Pay Devnet E2E run `41050650205`: **SUCCESS**. It ran existing real Pay SOL verification, hosted transaction builder, Bulk Pay and Payment Intent reconciliation/replay tests. It did not create a Subscription Plan or charge a Subscription.
- SolMint Pay Mainnet Read-only run `41050650136`: **SUCCESS**. The corrected command actually executed the test; TAP reported one passing test reading a finalized Mainnet transaction through the workflow's configured public Solana endpoint. This is a read-only provider smoke only, not proof of SolMint's production Helius endpoint or the Subscription Program's deployed binary/ProgramData.
- Supabase Preview check: **SKIPPED** (not failed; no database branch validation was run).
- These checks validate this code slice and current existing Pay gates only. They are not Release Readiness.

### Overall state after this slice
- **PASS:** policy-only Plan input boundary; standard CI/Production Build; current existing Pay disposable DB security; existing ordinary Pay Devnet E2E; one actual public-RPC Mainnet read-only provider smoke.
- **NOT IMPLEMENTED:** Subscription API, domain state machine, DB schema/migrations, merchant Plan creation wallet flow, customer two-step Consent, Collector signer/service, Billing Cycle/Attempt engine, external Puller discovery, dedicated Subscription verifier/accounting adapter, Subscription cancellation/recovery, Subscription Devnet E2E, and Subscription UI.
- **BLOCKED:** production DDL while issue #355 migration-runner provenance remains unresolved and until explicit APPLY authorization; split principal+gateway-fee subscription charges until LiteSVM/Devnet multi-instruction atomicity and independent verifier/accounting tests pass.
- **UNKNOWN:** full Cantina PDF (not read), post-remediation release delta audit, deployed Mainnet ProgramData/binary hash/upgrade authority/deployment slot/on-chain IDL, approved production RPC evidence, SDK Kit-v7/web3.js-1.x compatibility, and Collector signing custody.
- Mainnet read-only Workflow still hardcodes public `https://api.mainnet-beta.solana.com`; it is not production RPC evidence and must never become a production fallback.

### Mutation statement
- Repository changes only on feature branch; main and PR base unchanged.
- Production Supabase operations were read-only introspection. No DDL, grants, RLS, provider settings, runtime secrets, key material, live Plan, user consent or funds were changed.
- Mainnet E2E was read-only. Existing Devnet E2E submitted only its established isolated ordinary-Pay test transactions; no Subscription transaction was built or submitted.
- Local Git Working Tree remains UNKNOWN because local repository access was unavailable; remote branch and commit were verified via GitHub.


## 2026-10-30 — Mainnet read-only smoke now executes a compatible finalized transaction

Branch: `feat/pay-subscription-billing`  
Validated code HEAD: `cca17dfb3e4a6d89a2f87e81fca9fda7df35854f`  
Base main: `7b975d56860b6d937ad76ab2983c71937644dfa3`  
PR #366: OPEN / DRAFT / NOT MERGED.

### Additional Mainnet E2E correction
- With the false-success command fixed, the read-only test revealed that the first System Program signature can be transaction version 1, while the current Pay parser explicitly sends `maxSupportedTransactionVersion: 0`.
- The test now checks a bounded list of finalized signatures and selects the first transaction the existing parser can actually decode. It skips only the explicit unsupported-version response; all other RPC/parse errors still fail the test.
- This change does not expand the parser's claimed transaction-version support and does not alter the ordinary verifier.
- The corrected test completed successfully on run `41051316560`; TAP proves one real Mainnet read-only test passed. It used the workflow's hard-coded public Solana Mainnet RPC; this is not the configured production Helius endpoint or a production RPC fallback.

### Exact-HEAD validation on `cca17df...`
- CI run `41051316556`: **SUCCESS**.
- Production Build run `41051316512`: **SUCCESS**.
- SolMint Pay Database Security run `41051316589`: **SUCCESS**.
- SolMint Pay Devnet E2E run `41051316592`: **SUCCESS**.
- SolMint Pay Mainnet Read-only run `41051316560`: **SUCCESS**, one actual finalized transaction parsed.
- The 14 Subscription Plan policy unit tests are included in general CI and all passed on the previous validated code SHA `157b594...`; the source/test files are unchanged on `cca17df...`. The new general CI run also passed, covering the same code plus E2E test changes.
- Supabase Preview remains skipped; no Subscription migration or preview database was created.

### Correction to the previous Progress entry
- The Plan policy test file contains **14** distinct `test()` cases, not 15. The count above supersedes the prior count wording.

### Current feature decision remains unchanged
- **PASS:** fail-closed Plan input policy, general CI, Production Build, existing Pay disposable DB security, existing ordinary Pay Devnet E2E, and one actual read-only Mainnet provider smoke.
- **NOT IMPLEMENTED:** all persisted Subscription domain/API/schema, wallet consent, Collector, Billing Engine, dedicated verifier/accounting, Subscription-specific recovery/tests, and UI.
- **BLOCKED:** Production DDL pending issue #355 provenance resolution and explicit APPLY; split fee pending dedicated same-transaction LiteSVM/Devnet and accounting/verifier proof.
- **UNKNOWN:** Cantina PDF review, release delta audit, deployed ProgramData/binary/source match/upgrade authority/slot/IDL, approved production Mainnet RPC evidence, SDK compatibility and Collector key custody.

No Production database/schema/grant/RLS, runtime setting, secret/key, Mainnet transaction, live Plan, customer consent or funds were changed. Existing Devnet E2E remained limited to the pre-existing ordinary Pay test flows; no Subscription transaction was submitted. Local Git Working Tree remains UNKNOWN; remote branch state was verified through GitHub.


## 2026-10-30 — Subscription Phase 1 read-only baseline audit

Repository: `azad2022/solsite`  
Main HEAD at audit: `7b975d56860b6d937ad76ab2983c71937644dfa3`  
Subscription branch HEAD reviewed: `9f67efb12d30775085f7fe9c828dae84d1e6800b`  
Branch comparison: `ahead 28 / behind 0`  
PR: [#366](https://github.com/azad2022/solsite/pull/366), OPEN / DRAFT / NOT MERGED.

### Scope actually verified
- Re-read the persistent project instructions, Master Specification, Subscription Skill, Build Web Apps Skill, Release Audit Skill, and installed Supabase Skill.
- Revalidated repository default branch, exact main SHA, feature branch existence/head, PR base/head and current diff. Local Git Working Tree remains **UNKNOWN** because local Git access is unavailable in this environment.
- Production Supabase project `nvopkbiedorfshwbmyhn`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.147`.
- Fresh read-only DB introspection: 33 `public.pay_*` tables; RLS enabled on all 33; FORCE RLS on 0. No public table or routine with Subscription/Billing Cycle/Consent/Collector naming was found. This proves only schema presence/absence, not adversarial tenant isolation.
- Production migration ledger contains 106 entries; latest is `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- Live ordinary verifier `public.pay_apply_verified_observation`: SECURITY DEFINER, empty `search_path`, definition MD5 `862417b40ce5db32abc714184ef475f5`. Its audited contract requires ordinary-payment source-authority/fee-payer alignment and rejects sponsored gas; it is not compatible with the Subscription Authority PDA + separate Collector fee-payer model. Keep it unchanged and require a dedicated Subscription verifier/accounting boundary.
- Current branch compare contains one Subscription application slice: pure Plan-input policy `src/pay/services/subscriptionPlanPolicy.ts` plus `tests/pay-subscription-plan-policy.test.ts` (14 test cases). It is not a persisted Plan API or lifecycle implementation. No Subscription route, migration, tables, Billing Engine, Collector signer, dedicated verifier/accounting adapter, Consent flow, or Subscription UI is present in this branch diff.
- Exact-head Actions evidence on `9f67efb...`: CI run `41051484372` SUCCESS (quality/typecheck/build/unit tests, 424 tests reported); Database Security `41051484223` SUCCESS; existing Pay Devnet E2E `41051484239` SUCCESS; Production Build `41051484250` SUCCESS; Mainnet read-only `41051484232` SUCCESS. The Devnet job covers existing ordinary Pay, hosted transaction builder, Bulk Pay and Payment Intent reconciliation—not Subscription charges. Database Security has no Subscription schema to exercise. Mainnet job is a non-mutating provider smoke, not ProgramData or production-Helius verification.
- Issue #355 remains OPEN; migration-runner provenance/trigger is UNKNOWN. Production DDL remains BLOCKED until the repository's controlled path is evidenced and explicit APPLY is authorized.
- Corrected the post-remediation upstream delta description in this ledger and `docs/solmint-pay-subscription-baseline-audit.md` (commit `f8c90880bba1fae7374d4c4cac37c6db5f0d61d7`): the eight-commit compare lists SDK/IDL/dependency/build-release/sample-app changes and does not list `program/src/**` Rust source files. This does not clear the release audit gate.
- Upstream Cantina report exists in the upstream repository but was not rendered/read in this environment: **NOT REVIEWED**. Actual Mainnet ProgramData/binary hash/upgrade authority/deployment slot/IDL and approved production RPC evidence remain **UNKNOWN**. SDK v0.5.0 requires `@solana/kit ^7`; SolMint uses `@solana/web3.js 1.x`; adapter compatibility remains **UNKNOWN**.

### Phase 1 result
- **PASS (limited scope):** repository/branch/PR inventory, current Production schema/migration read-only discovery, existing Pay CI workflow status and current Subscription gap inventory.
- **BLOCKED:** Production DDL due Issue #355; split principal + gateway-fee charging until same-transaction cumulative allowance/atomic rollback, dedicated verifier and accounting are proven.
- **NOT IMPLEMENTED:** persisted Subscription domain/API/schema, customer consent/authority lifecycle, billing cycle/attempt engine, isolated Collector, dedicated verification/accounting, Subscription-specific adversarial/Devnet E2E and UI.
- **UNKNOWN / NOT REVIEWED:** full Cantina PDF findings; live ProgramData/binary/IDL/upgrade authority/slot; approved production Mainnet RPC; SDK adapter compatibility; Collector key custody and isolation. RLS presence is not an adversarial security PASS.
- No Production DDL, runtime/secret/key change, Collector creation, live Plan, customer consent, Mainnet transaction or funds movement occurred in this checkpoint. No Subscription Devnet transaction was run by this task.

### Five-stage delivery sequence
1. **Baseline audit** — this checkpoint; repository and DB inventory completed with the unresolved evidence above explicitly retained.
2. **Program assurance + contract freeze** — read the full Cantina report, verify the actual deployed Program/IDL through approved read-only Mainnet evidence, resolve SDK compatibility, and review Domain/API/DB/RBAC/Consent/state-transition/accounting contracts before naming schema or routes.
3. **Backend implementation** — additive DB/API, atomic Billing Cycle/Attempt claim and reconciliation, isolated Collector, dedicated Subscription verification/accounting and outbox; ordinary Pay remains unchanged.
4. **Adversarial validation + product UI** — unit/component/integration/database RLS security/LiteSVM/Devnet E2E, retries and ambiguous outcome recovery, then Merchant Dashboard and Customer Consent/Portal UI based only on real contracts.
5. **Controlled production release** — resolve Issue #355, controlled migration DRY_RUN and separately authorized APPLY, isolated signer/key lifecycle approval, exact deployment SHA, Pages deployment smoke, runtime verification, rollback and final Release Audit.

Next checkpoint: Stage 2. Do not begin Production migrations, create Collector signing material, or enable live billing while any relevant gate above remains BLOCKED/UNKNOWN.


## 2026-10-30 — Subscription Phase 2 Program assurance investigation

Repository: `azad2022/solsite`  
Branch: `feat/pay-subscription-billing`  
Reviewed HEAD: `2a043a010cbb8d5d01d38f529760c5b247fbd6d3`  
PR #366: OPEN / DRAFT / NOT MERGED.

### Evidence gathered
- Re-read project instructions, Master Specification, Subscription Skill, Build Web Apps Skill and Release Audit Skill from this exact branch HEAD.
- Revalidated the Program tag `program-v0.5.0` at `364a41976c33347d092902443bbec2def9227e75`, SDK tag `ts-client-v0.5.0` at `5a347ffaa969036061d274d3c91e0277962e2b51`, Program ID and upstream audit-status file.
- The upstream audit baseline-to-release compare is 15 commits and includes program source/instruction changes. The post-remediation-to-release compare is 8 commits / 21 paths and contains no `program/src/**` paths, but does include SDK/IDL/lockfile/release workflow/demo app changes. This distinction is now recorded in the implementation plan.
- Read the pinned Program's `TransferSubscription`, `Subscribe`, `CreatePlan` source, IDL, README Security Considerations, SDK package manifest/plugin, SDK changelog and release workflow/upgrade ADR.
- Confirmed the SDK is a Kit plugin requiring `@solana/kit ^7`; SolMint's app package uses `@solana/web3.js 1.99.0` and has no direct Kit dependency. No SDK was installed.
- Confirmed exact-head CI on `2a043a0`: CI, Database Security, existing Pay Devnet E2E, Production Build and Mainnet Read-only all completed SUCCESS. These do not prove Subscription behavior or deployed ProgramData.
- Cantina PDF was retrieved as base64 from GitHub (blob SHA `876a71e6fce36f54d76cfbcf1452f68fdb9a252b`), but neither connector nor web PDF reader exposed its text; the local runtime has no network access for retrieval/conversion. Findings remain NOT REVIEWED.
- No approved read-only production RPC/ProgramData access is available through the connected tools. Mainnet workflow smoke uses a public RPC and does not inspect ProgramData; deployed binary hash, slot, upgrade authority and on-chain IDL remain UNKNOWN.

### Stage 2 status
- **PASS (limited source review):** pinned Program/SDK references, source-level instruction constraints, post-remediation file delta, Kit/Web3 dependency mismatch and upstream documented security edge inventory.
- **BLOCKED:** full Cantina finding-by-finding review; independent live ProgramData/binary/upgrade-authority/slot/on-chain-IDL verification; final contract freeze dependent on those findings.
- **UNKNOWN:** actual deployed binary/source correspondence and the exact on-chain metadata/IDL.
- **NOT IMPLEMENTED:** isolated SDK compatibility adapter; no SDK/dependency/runtime changes were made.

### Explicit stop condition
**Stage 2 is NOT COMPLETE. Do not start Stage 3 backend/schema/API work, Stage 4 UI/adversarial implementation, or Stage 5 deployment/release.** Resume only after the Cantina PDF is readable and approved Mainnet ProgramData evidence is available; then finish the finding matrix, adapter proof and contract freeze.

No Production database, runtime configuration, secret/key, on-chain Program state, Mainnet funds, Devnet Subscription state, or customer consent was changed.


### Follow-up — Phase 2 implementation-plan record

- Added the detailed Stage 2 source/audit/SDK findings and explicit stop gates to `docs/solmint-pay-subscription-implementation-plan.md` in commit `e55292e1e40621aca5c0772e4b4c8792dfc23eff`.
- Correctly separated the 15-commit audited-baseline-to-release delta (which includes Rust program source changes) from the 8-commit post-remediation-to-release delta (21 paths, no `program/src/**` entries).
- Stage 2 remains **BLOCKED**, not complete: Cantina PDF text was not extractable in this environment and live Mainnet ProgramData/binary/upgrade authority/slot/on-chain IDL evidence is unavailable. SDK adapter and final API/DB contract freeze are not approved.
- Latest source-reviewed application HEAD remains `2a043a010cbb8d5d01d38f529760c5b247fbd6d3`; subsequent commits are documentation-only. PR #366 remains OPEN / DRAFT / NOT MERGED.


## 2026-10-30 — Subscription Phase 2 Cantina report completed; ProgramData gate still open

Repository: `azad2022/solsite`  
Branch: `feat/pay-subscription-billing`  
Source code reviewed at: `c11acab73c92ed3a8341d35b2549cd56e264cb89`  
Phase 2 documentation follow-up: `4cf0dd42cd86891d5ad4388d82e9aceba92be26f` (implementation-plan review matrix)  
PR #366: OPEN / DRAFT / NOT MERGED at last revalidation.  
Working Tree: UNKNOWN (local Git unavailable; remote GitHub refs reviewed).

### Cantina PDF — completed review
- Read the complete 12-page Cantina report dated 2026-07-30. Audit baseline `d6b3a5dc7ab18c4168441af733c81ab0a599d414`; remediation follow-up commit `debb4f75ff7571218b39de3b633074dd843e70db`.
- Summary: 9 findings — 1 High, 5 Medium, 2 Low, 1 Informational; no Critical or Gas findings. Aggregate report disposition: 4 Fixed and 5 Acknowledged. Cantina's follow-up says all findings were addressed and no new vulnerabilities were found. Acknowledged means residual risk accepted/documented, not fixed by Program code.
- High `3.1.1` remains the dominant protocol risk: old signed but unsubmitted create operations, especially Init+Subscribe with `UNKNOWN_INIT_ID`, can land later and restore authority/delegation after attempted revoke. The Program did not gain persistent consent epoch/action nonce/tombstone/deadline in the remediation. V1 limits: separate Init and Subscribe, fetch actual `init_id`, reject sentinel, recent blockhash only, no Durable Nonce or unresolved smart-wallet/multisig proposals, no retained pending signed bytes, reconcile approval lifecycle. Residual protocol risk remains.
- Medium `3.2.1` CancelNow: `expected_current_period_start_ts` added (`d4b29e80...`), but same-second replay residual remains acknowledged. `3.2.2` UpdatePlan: fixed and Cantina verified (`653dec58...`) via expected state fields; README still notes ABA if values are changed and later restored. `3.2.3` Resume: same-period cancellation can collide on `expires_at_ts`; old pending Resume can undo a later cancellation. `3.2.4` Authority controls: held Init can reapprove `u64::MAX`; held Close/Revoke can affect a newly created authority at same PDA. `3.2.5` finite Plan near-end Subscribe: full period amount may be charged for a partial/zero-length first window; `end_ts` is not bound by the signed Subscribe payload.
- Low `3.3.1` optional CreatePlan payer missing from IDL/generated client was fixed and Cantina verified (`11173179...`). Low `3.3.2` rent sponsor lock risk was acknowledged/documented (`0ac23b9...`); not an enforceable opt-in/recovery guarantee. V1 decision: no rent sponsorship; Merchant funds Plan rent; user funds their Authority/Subscription rent; Collector pays network fee only. Informational `3.4.1` IDL generation errors swallowing was fixed (`1b6e98e...`); current Program `build.rs` propagates errors.
- Full finding matrix, source evidence and V1 mitigations are in `docs/solmint-pay-subscription-implementation-plan.md`.

### Program, SDK, IDL and release comparison
- Program tag `program-v0.5.0` = `364a41976c33347d092902443bbec2def9227e75`; SDK tag `ts-client-v0.5.0` = `5a347ffaa969036061d274d3c91e0277962e2b51` (3 commits later). Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- Audit baseline → Program release delta: 15 commits. Remediation → Program release delta: 8 commits / 21 paths and no `program/src/**` paths. This means Program source did not change in that narrower post-remediation release delta; it is not deployment proof.
- Program tag root Cargo/IDL reports `0.5.0-beta.1`, package TypeScript at that tag `0.5.0-beta.2`; SDK tag package and IDL report `0.5.0`. Program and SDK IDL JSON are byte-equivalent after changing only the program version string; no structural instruction/account schema delta was found. SDK changelog says SDK 0.5.0 matches Program 0.5.0 and the deployed binary/IDL were built from commit `364a419` while labeled beta.1. Live chain must independently confirm that.
- Official SDK `@solana/subscriptions@0.5.0` is an `@solana/kit` plugin with peer `@solana/kit ^7.0.0`; its overlay builders produce Kit instructions and rely on Kit RPC/signers. SolMint root package uses `@solana/web3.js@1.99.0`, no Kit/Subscriptions SDK dependency. Static compatibility assessment is PASS; actual Kit↔web3.js / worker/runtime / signer compatibility spike was not executed. SDK integration remains BLOCKED / NOT IMPLEMENTED; no dependency was installed.

### ProgramData / Mainnet evidence
- Re-inspected `.github/workflows/solmint-pay-mainnet-readonly.yml` and `e2e/pay-mainnet-readonly.e2e.ts`. Workflow hard-codes the public Mainnet RPC endpoint and checks Pay provider health plus a finalized System Program transaction. It does not query the Subscriptions Program/ProgramData, deployed slot, upgrade authority, executable bytes, source verification or on-chain IDL.
- Therefore the successful Mainnet workflow is not ProgramData proof and is not proof of the production Helius endpoint. No approved read-only production RPC tool was available in this session. Program executable/loader owner, ProgramData address, deployment slot, upgrade authority, deployed bytecode hash, `solana-verify` match, and on-chain IDL bytes/hash remain UNKNOWN.
- ProgramData gate requires a sanitized read-only artifact produced in the approved Mainnet environment; never include RPC URL credentials, API keys, signer material or private data in output. Required evidence: cluster/genesis, Program ID/loader owner/executable, ProgramData address, deployment slot, upgrade authority/null, deployed ELF length+SHA-256, reproducible source/commit match, on-chain IDL hash and structural comparison to pinned IDL.

### Contract freeze checkpoint
- **PASS (architecture/security invariants only):** bounded-context separation; Plan Owner implicit Puller; Collector additional explicit Puller and independent fee payer; all Puller reconciliation; two-step Init/Subscribe with actual `init_id`; V1 rejection of `UNKNOWN_INIT_ID`/Durable Nonce/unresolved proposals; fixed-hours period and chain-derived cycle identity; Active != collectable/entitled; finalized transfer verification + atomic accounting before entitlement; unchanged Pay verifier with dedicated Subscription verification/accounting; original SPL Token only; approved mints; explicit non-empty destination-owner list; no rent sponsorship; no split principal+gateway fee until same-tx atomic tests pass.
- **NOT FROZEN:** concrete API paths/payloads, SQL table/column/state names, grants/roles/permissions, exact retry/grace/entitlement policy, gateway fee model, split-fee mechanics, Collector key custody. Do not create routes, migrations, APIs or domain schemas as part of this checkpoint.

### Exact-head CI and scope
- At source HEAD `c11acab...`, the following GitHub workflows completed SUCCESS: CI run `41058801495`; Pay Database Security `41058801594`; Pay Mainnet Read-only `41058801611`; Pay Devnet E2E `41058801628`; Production Build `41058801579`. These are existing Pay/site tests and do not include Subscription application/ProgramData tests. No local tests were run during this documentation/audit update.
- No Production DDL, runtime configuration, secret/key, Program state, Mainnet transaction, Devnet Subscription transaction, Collector signer, live Plan, funds or customer consent was changed. Only documentation on the feature branch changed.

### Phase 2 decision
- **PASS:** complete Cantina PDF read and finding matrix; pinned upstream source/audit/SDK static review; Program/SDK IDL structural comparison; architecture-level security invariants.
- **BLOCKED:** approved live ProgramData/deployed binary/upgrade authority/slot/on-chain IDL proof; actual SDK adapter/runtime compatibility; final schema/API/RBAC/Consent/Accounting contract freeze.
- **UNKNOWN:** all live deployment facts above and local Working Tree.
- **NOT IMPLEMENTED:** isolated SDK adapter, persisted Subscription domain/schema/API, Collector, dedicated verifier/accounting, Subscription integration/adversarial/Devnet E2E and UI.

**STOP:** Phase 2 is not complete. Do not begin Phase 3 backend/schema/API/Collector, Phase 4 adversarial implementation/UI, or Phase 5 production release.
## 2026-10-30 — Part 2.1 initial isolated SDK compatibility spike

Status: **BLOCKED — partial Node runtime evidence; Workerd, reproducibility, protocol-fixture and exact-head CI gates remain open.**

- Repository: `azad2022/solsite`; main HEAD/base: `7b975d56860b6d937ad76ab2983c71937644dfa3`; Subscription branch: `feat/pay-subscription-billing`; PR #366 remains OPEN / DRAFT / NOT MERGED.
- Feature HEAD tested by PR: `26943301ca4a0fb8d9cba69851f42038b0cf49bc`. PR merge commit used by the GitHub Actions checkout: `540e4c1a4a11020efe9e2c4836578278d85a2f26`. Therefore this run is evidence for the PR merge result, not a standalone exact-head checkout of the feature commit.
- CI run `41064773575`: quality PASS; six isolated SDK tests PASS under Node 22.23.4 and Node 24.22.1; Workerd bundle FAILED under both versions because esbuild could not resolve Node built-ins `fs/promises`, `path`, and `events` from Kit dependency paths. Mainnet read-only, existing Pay Devnet E2E, Database Security and Production Build jobs reported SUCCESS in this run; none is Subscription RPC/simulation or Subscription E2E evidence.
- Isolated dependency graph resolved in CI with direct pins: `@solana/subscriptions@0.5.0`, `@solana/kit@7.0.0`, `@solana/web3.js@1.99.0`, `@solana-program/token@0.15.0`, `@solana-program/token-2022@0.14.0`, and `esbuild@0.28.2`. Installed metadata reports Token and Token-2022 packages require Node >=24; Node 22 ran with `engine-strict=false` and emitted EBADENGINE warnings. Root application remains Node >=20, Bun-managed, with web3.js 1.99.0 and no root Kit/Subscriptions dependency.
- The SDK spike is isolated under `tools/subscription-sdk-compat/`; it does not alter the browser dependency graph. The CI generates `package-lock.json` during each run; no committed package-lock exists at this path, so transitive dependency reproducibility is not yet established. Artifacts 12982800679 (Node 22) and 12982387376 (Node 24) were uploaded; the Workerd output was absent because bundling failed.
- Current six tests exercise SDK imports, three PDA comparisons (Plan, Authority, Subscription), Init Authority/Create Plan/Subscribe builders, Kit-to-web3 instruction conversion, and unsigned legacy/v0 serialization. They do not yet establish an independent pinned-IDL golden fixture for full instruction bytes/account order/privileges; the conversion parity assertion compares the adapter output to the same SDK instruction object. The three builder Program IDs and discriminators are checked, but this is not a complete IDL consistency proof.
- No actual Workerd execution, deployed Worker import, RPC call, transaction simulation, wallet signing, Collector signer test, or blockchain mutation was performed. The README explicitly describes the harness as non-signing and non-submitting. No Devnet transaction was sent; Mainnet remained read-only.
- Working Tree cannot be observed through the GitHub connector; local status remains UNKNOWN. No local clone was available in this audit.
- No Production database/runtime/secret/key, Mainnet or Devnet state, or funds were changed. No application verifier or accounting code was modified.
- Next action remains inside Part 2.1: diagnose the Workerd conditional-export/Node-built-in resolution against the actual Pages Functions runtime (`nodejs_compat`) and select a supported isolated server-side execution target; commit a deterministic dependency lock; add independent pinned-IDL golden fixtures and explicit expected account-meta assertions; then run the compatibility job against the exact feature HEAD and capture non-mutating RPC/simulation evidence where approved. Do not proceed to Part 2.2.

## 2026-10-30 — Part 2.1 Runtime test methodology correction

Status: **BLOCKED — real Pages Workerd runtime test added; execution evidence pending CI.**

- Revalidated exact repository state before changes: main `7b975d56860b6d937ad76ab2983c71937644dfa3`; `feat/pay-subscription-billing` at `9f4590eb70dbc2f72231a0b8b2738e3a0c21974b`; PR #366 OPEN / DRAFT / NOT MERGED.
- Re-read the project instructions, Master Specification, Subscription Skill, Build Web Apps Skill, Release Audit Skill, implementation plan and current progress checkpoint from the feature HEAD.
- Inspected the actual deployment boundary: Pay API routes live under `functions/api/pay/` (Cloudflare Pages Functions); `wrangler.toml` sets compatibility date `2026-08-10` and `nodejs_compat`. The repository explicitly states `server.ts` is a separate Node/Express server and is not deployed as a Worker. Existing Pay Functions already import `node:buffer` and use `@solana/web3.js`.
- Re-read CI run `41080565057` logs. Six SDK tests pass under Node 24; the failing step is an esbuild command using `--platform=browser`, which selected dependency `.node.mjs` entrypoints and cannot resolve Node built-ins. This is a bundler-target resolution failure, not an execution test in Workerd; it does not by itself establish that the deployed Pages runtime rejects those imports.
- Current Cloudflare documentation states that compatibility dates on/after `2026-08-04` enable Node.js compatibility by default, and documents Events, File System and Path as supported APIs. Pages Wrangler configuration applies to local `wrangler pages dev`. Sources reviewed: Cloudflare Node.js compatibility, compatibility flags, Pages Wrangler configuration and Pages local development docs.
- Updated the isolated spike design to use a pinned Wrangler CLI and a real local Pages Functions endpoint. The endpoint imports the SDK, adapter, `node:events`, `node:path`, `node:fs/promises`, and exercises the instruction builder/conversion with synthetic inputs and a no-op test signer. It makes no RPC call, signs nothing, submits no transaction and performs no deployment.
- The compatibility CI job is configured to checkout the exact PR head SHA (separate from the normal PR merge-result quality run) and use Node 24 because pinned `@solana-program/token` packages declare `engines.node >=24`.
- This is only a test-method correction and an isolated harness change. The original esbuild bundle failure remains documented as historical evidence; it is not reclassified as a passing runtime check. Workerd status remains pending until the Pages runtime test actually passes in CI.
- No root runtime configuration, existing Pay route, SDK production dependency, API contract, database schema, secret, signer, Production, Mainnet or Devnet state was changed. No chain interaction occurred.
- Still BLOCKED after this checkpoint: committed deterministic npm lockfile; TypeScript adapter compile; independent pinned-IDL golden instruction/account-meta fixtures; real adapter/backend integration boundary; approved non-mutating RPC/simulation proof; actual exact-head CI success for the new runtime harness. Part 2.2 remains prohibited.

## 2026-10-30 — Part 2.1 local Pages / Workerd runtime proof

Status: **PARTIAL PASS — Workerd runtime compatibility proven for the isolated SDK fixture; Part 2.1 remains BLOCKED.**

- Tested feature HEAD: `9e3c564e82a51427f185b71a62f19236c565f527`; main remained `7b975d56860b6d937ad76ab2983c71937644dfa3`; PR #366 remained OPEN / DRAFT / NOT MERGED.
- Exact-head checkout is proven by the compatibility job: expected PR head and actual `git rev-parse HEAD` both equal `9e3c564e82a51427f185b71a62f19236c565f527`.
- GitHub Actions CI run `41083695595`: `subscription-sdk-compat (24)` SUCCESS and `quality` SUCCESS. Compatibility execution used Node `v24.22.1`, npm `11.19.1`, and `engine-strict=true`; installed SDK graph includes `@solana/subscriptions@0.5.0`, `@solana/kit@7.0.0`, `@solana/web3.js@1.99.0`, Token `0.15.0`, Token-2022 `0.14.0`, Wrangler `4.156.0`. Token packages declare Node >=24, so Node 22 is no longer treated as a supported host for this harness.
- Six Node SDK / PDA / instruction conversion / unsigned transaction serialization tests passed (6/6).
- The new `npm run test:workerd` starts `wrangler pages dev` against the isolated Pages harness and calls its local HTTP Function. The real local Workerd execution passed (1/1; request completed in approximately 1.6 seconds). It imported `node:events`, `node:path`, `node:fs/promises`, used `Buffer`, imported the upstream Subscription SDK, built a synthetic CreatePlan instruction and converted it through the Kit→web3 adapter. The response asserted the expected Subscription Program ID and non-empty instruction metadata. This supersedes the earlier esbuild `--platform=browser` bundle check as the relevant local runtime test; the old esbuild resolution failure is historical and was not itself proof of Workerd incompatibility.
- Generated npm lockfile artifact: workflow artifact `12991410620`, `package-lock.json` lockfileVersion 3, 216 package records, SHA-256 `d2dcca34fe5e8cc1c9e49c4bf495e69c3214473fd3b54b3c6f3d1e7d59dc35bd`. `npm ci` consumed that generated lock successfully. **The lockfile is still not committed to the repository**, so deterministic, source-controlled dependency resolution remains BLOCKED.
- Existing six Node tests continue to prove only three PDA derivations and the current fixture builders. Independent pinned-IDL golden instruction-byte fixtures and independently authored expected account-meta fixtures are still absent. The adapter remains JavaScript (`.mjs`); a TypeScript compile of the adapter is NOT IMPLEMENTED.
- The Workerd route is test-only and isolated beneath `tools/subscription-sdk-compat/`. It uses synthetic addresses and a no-op signer. No SDK production dependency, existing Pay Function, API contract, backend signer, Collector, verifier, accounting code, Production configuration or database was changed. The local runtime probe made no RPC call and sent no Subscription transaction.
- Other checks for this exact feature HEAD: CI quality SUCCESS; Pay Database Security run `41083695604` SUCCESS; Pay Mainnet Read-only run `41083695601` SUCCESS; Production Build run `41083695686` SUCCESS.
- **Important existing workflow side effect:** the PR path filter also ran the existing funded Pay Devnet E2E workflow `41083695724` SUCCESS. Its logs show real Devnet SOL payment, hosted transaction-builder and Bulk Pay test scenarios, followed by Payment Intent reconciliation reusing the existing real transaction. This is existing Pay coverage, not Subscription E2E. The workflow used the preconfigured GitHub Devnet RPC/funder secrets (values remained masked); no secret/key was read or changed by this task. This is a Devnet test, not Mainnet or Production activity.
- No Mainnet transaction, Production DDL, Production secret/key/configuration change, live Subscription consent, Collector signing, or Subscription Program state mutation occurred. Mainnet job was read-only. The only chain activity observed was the pre-existing Pay Devnet test workflow described above.
- Local Working Tree remains UNKNOWN because no local clone was available; the attempted network clone could not resolve github.com. The GitHub branch commit history is verified.
- Gate matrix after this checkpoint:
  - Dependency resolution and `npm ci` under supported Node 24: **PASS**.
  - Node runtime SDK tests: **PASS** (six fixture tests).
  - Local Pages / Workerd SDK import + builder + adapter execution: **PASS** (one local HTTP runtime test).
  - Exact PR-head checkout for compatibility job: **PASS**.
  - Program ID assertions: **PASS**, limited to tested builders/fixture.
  - PDA derivation: **PASS**, limited to Plan, SubscriptionAuthority and Subscription seeds covered by tests.
  - Committed lockfile / deterministic repository dependency graph: **BLOCKED** (CI artifact generated, file not committed).
  - TypeScript adapter compile: **NOT IMPLEMENTED**.
  - Complete IDL consistency and independent instruction/account-meta golden fixtures: **BLOCKED**.
  - Backend/signer/Collector integration: **NOT IMPLEMENTED**.
  - Subscription RPC / simulation evidence: **NOT IMPLEMENTED**.
  - Subscription Devnet E2E / adversarial verification and accounting: **NOT IMPLEMENTED**.
- **Overall Part 2.1: BLOCKED.** Do not start Part 2.2 until the remaining gates are independently evidenced as PASS.


## 2026-10-30 — Part 2.1 runtime target and exact-head revalidation

Status: **PARTIAL PASS — Pages Functions is the selected runtime target for the non-signing SDK adapter; Part 2.1 remains BLOCKED.**

- Revalidated repository refs: `main` = `7b975d56860b6d937ad76ab2983c71937644dfa3`; `feat/pay-subscription-billing` = `4d1bf9ddf079f00310f9839f86bc73f9f594ca35`; PR #366 is OPEN / DRAFT / NOT MERGED.
- Compared the compatibility-tested commit `9e3c564e82a51427f185b71a62f19236c565f527` with current feature HEAD. The only intervening change is this progress ledger; runtime harness, SDK pins, adapter and CI workflow are unchanged.
- Current feature HEAD `4d1bf9ddf079f00310f9839f86bc73f9f594ca35` has successful runs: CI `41084539839`, Devnet E2E `41084539632`, Mainnet read-only `41084539638`, Production Build `41084539973`, and Database Security `41084540044`. The CI compatibility job reports SUCCESS for exact-head checkout, Node 24 setup, lock resolution, `npm ci`, six SDK tests, and local Pages/Workerd runtime test.
- Runtime target decision is based on current source, not a new deployment assumption: existing Pay API transaction-request routes and transaction builders are Cloudflare Pages Functions under `functions/api/pay/`; root `wrangler.toml` enables `nodejs_compat`. `server.ts` is a separate Node/Express server and is not deployed as a Worker. Therefore the SDK instruction-builder + Kit→web3 adapter should target the existing Pages Functions runtime when integrated into customer/API transaction construction; a new Node service is not justified for this adapter by current code evidence.
- This runtime decision does **not** place Collector private-key signing in Pages Functions. Collector signing remains a separate, isolated trust boundary and must be designed independently; the local Workerd test uses synthetic inputs and a no-op signer only.
- The Workerd proof is bounded: it imports the pinned SDK, invokes a synthetic CreatePlan builder and converts the result in local Workerd. It is not proof of deployed production behavior, RPC/simulation, customer consent, Collector signing, verification, accounting, or Subscription E2E.
- Gate state: Pages/Workerd fixture **PASS**; exact-head CI for current HEAD **PASS**; supported Node 24 dependency installation **PASS**. Committed lockfile **BLOCKED** (generated artifact only); TypeScript adapter compile **NOT IMPLEMENTED**; independent pinned-IDL byte/account-meta golden fixtures **BLOCKED**; real Backend adapter integration **NOT IMPLEMENTED**; approved RPC/simulation **NOT IMPLEMENTED**; Subscription Devnet E2E and adversarial Verification/Accounting **NOT IMPLEMENTED**.
- No source code, production runtime configuration, database, secret, key, Collector signer, verifier, accounting, Mainnet or Devnet state was changed by this checkpoint. Existing Devnet E2E ran as a separate CI workflow for ordinary Pay flows; it is not Subscription E2E.
- Local Working Tree remains **UNKNOWN** because no local clone/status is available through the GitHub connector.
- Next Part 2.1 work: make the isolated dependency graph reproducible with a committed lockfile; add TypeScript compile coverage for the adapter; add independent fixtures derived from the pinned release IDL/source for instruction bytes and account metas. Keep Part 2.2 blocked until every Part 2.1 gate is PASS.

## 2026-10-30 — Part 2.1 typed adapter and independent IDL golden checkpoint

Status: **PARTIAL PASS — typed adapter, pinned-IDL instruction fixtures and exact-head runtime CI passed; Part 2.1 remains BLOCKED.**

- Repository/PR revalidation: main `7b975d56860b6d937ad76ab2983c71937644dfa3`; feature HEAD tested `da1e34431f8167f3ebf54e6f320ca88e32698505`; PR #366 OPEN / DRAFT / NOT MERGED. The compatibility CI job verified expected PR HEAD equals actual checkout HEAD.
- Replaced the JavaScript Kit→web3 adapter with a typed TypeScript adapter under `tools/subscription-sdk-compat/src/kit-to-web3.ts`. It validates the Program address, data type and account roles and maps account order, signer and writable flags. The adapter only converts instructions; it does not sign, submit, simulate or perform RPC/payment verification.
- Added a TypeScript compile target for the adapter and SDK instruction-builder call sites, using the repository-pinned TypeScript 5.9.3 from the root Bun lockfile. The isolated SDK package remains pinned to Node 24 because its Token packages declare Node >=24.
- Added independent golden fixtures for `initSubscriptionAuthority`, `createPlan` and `subscribe`, derived from upstream Program tag `program-v0.5.0` / commit `364a41976c33347d092902443bbec2def9227e75`, IDL `idl/subscriptions.json` Git blob `208718e90bf9f8e7f42271b6e93284109b118172`, SDK tag `ts-client-v0.5.0` / commit `5a347ffaa969036061d274d3c91e0277962e2b51`. The tests independently encode u8/u64/i64/PublicKey/fixed UTF-8 data layouts and assert exact instruction bytes, Program ID, PDA-derived accounts, account order and signer/writable roles before and after adapter conversion.
- Added `tools/subscription-sdk-compat/**` to `tsconfig.ci.json` exclusions because this isolated harness owns a separate dependency graph; its TypeScript files are checked by the dedicated compatibility job. This avoids the main app compiler trying to resolve Kit packages from the root node_modules. No production route or application payment logic was added.

### Exact-head evidence — CI run `41088541644`

- `subscription-sdk-compat (24)`: **SUCCESS**. Exact-head SHA check passed; Node `v24.22.1`, npm `11.19.1`, `engine-strict=true`; dependency lock resolution and `npm ci` passed; dedicated adapter TypeScript compile passed; SDK + PDA + IDL golden suite passed **10/10**; local Pages/Workerd runtime test passed **1/1**.
- `quality`: **SUCCESS**. Root production TypeScript check and Production Build passed; unit tests reported 424 tests, 422 passed, 0 failed (the remaining tests were skipped); source tree unchanged check passed.
- `SolMint Pay Database Security` run `41088541693`: **SUCCESS** (existing ordinary Pay security suite; no Subscription schema/RLS exists yet).
- `Production Build` run `41088541707`: **SUCCESS**.
- `SolMint Pay Mainnet Read-only` run `41088541654`: **SUCCESS**, read-only provider/transaction smoke only; not ProgramData/deployed binary/IDL verification.
- Existing funded ordinary Pay `SolMint Pay Devnet E2E` run `41088541647`: **SUCCESS**. Its four scenarios covered ordinary Pay SOL verification, hosted transaction builder, Bulk Pay and Payment Intent reconciliation/replay. This workflow used the existing Devnet CI configuration and performed ordinary Pay Devnet transactions; it is **not Subscription E2E** and does not verify Subscription pulls or accounting.

### Remaining Part 2.1 gates

- Dependency graph resolves and CI `npm ci` passes, but the lockfile is still generated at workflow time rather than committed. Artifact `12993165867` contains lockfileVersion 3 with 216 package records. Raw `package-lock.json` SHA-256: `d2dcca34fe5e8cc1c9e49c4bf495e69c3214473fd3b54b3c6f3d1e7d59dc35bd`; artifact ZIP SHA-256: `fcbed084a2224c5ad1c03f56f67ad51ca609b1a1067cc9da7dfc925187cbf928`. **Committed lockfile remains BLOCKED**; artifact presence is not source-controlled reproducibility.
- Typed adapter compile: **PASS** in the isolated harness; this does not mean the adapter is integrated into a production Subscription API.
- Independent instruction byte/account-meta fixtures: **PASS**, limited to the three tested instructions and the pinned source IDL. Live deployed on-chain IDL has not been independently fetched/hashed.
- Local Pages/Workerd SDK import + instruction build + conversion: **PASS** for the synthetic fixture and configured compatibility date; not a deployed Production runtime test.
- Subscription Backend/API adapter integration: **NOT IMPLEMENTED**; current repository/Production baseline has no Subscription routes/domain/schema/Collector/verifier/accounting lifecycle. Do not add an imagined endpoint or reuse/relax the ordinary Pay verifier.
- Approved Subscription RPC read/simulation evidence: **NOT IMPLEMENTED**. No Subscription RPC request, transaction simulation, signing, submission or Subscription chain mutation was made by this compatibility harness.
- Production ProgramData, deployment slot, upgrade authority, binary hash/source match and live on-chain IDL: **UNKNOWN**.
- Local Working Tree: **UNKNOWN**; the GitHub connector verifies remote branch commits but cannot inspect a local clone.

### Security and next decision

- The ordinary Pay verifier and Accounting implementation were not changed. No Production DDL, Production runtime setting, secret, key, Collector signer, customer consent or funds were changed. No Mainnet transaction was sent. The only observed chain mutations were the existing ordinary Pay Devnet CI scenarios identified above.
- Overall **Part 2.1 remains BLOCKED** until the deterministic lockfile is committed and the remaining approved RPC/simulation and applicable adapter-boundary evidence is resolved. Part 2.2 remains prohibited. Subscription Backend, Collector, verifier/accounting, schema and UI work must not be represented as implemented or production-ready.

## 2026-10-30 — Part 2.1 committed dependency lockfile checkpoint

Status: **LOCKFILE COMMITTED — exact-head revalidation on the lockfile-bearing commit is pending; Part 2.1 remains BLOCKED.**

- The passing compatibility run `41089646678` generated artifact `12994250080` from the exact tested source head `91de7ee7b555b361332bf8082013f98952d39593`. The isolated `npm ci`, TypeScript compile, 10 SDK/IDL tests and 1 local Pages/Workerd test passed before artifact upload.
- A separate `subscription-sdk-lockfile` job downloaded that artifact, verified its checkout matched the tested PR HEAD, and added `tools/subscription-sdk-compat/package-lock.json` in commit `7ad729441fabb63566bc16a7fc7c77ded1c2927e`. Job `124180283609` completed SUCCESS; the push targeted only `feat/pay-subscription-billing` and used a contents-write token isolated to the final push step.
- The committed file is lockfileVersion 3 with 216 package records, 124,989 bytes, matching raw lockfile SHA-256 `d2dcca34fe5e8cc1c9e49c4bf495e69c3214473fd3b54b3c6f3d1e7d59dc35bd`. GitHub reports the file at the expected repository path. Compare from `91de7ee7...` to `7ad7294...` shows exactly one file added: the package lock.
- GitHub created pull_request workflow records for the GITHUB_TOKEN-authored bot commit with conclusion `action_required` and no jobs (`41089805312`, `41089805382`, `41089805255`, `41089805393`, `41089805481`). These records provide **no CI evidence** and are not marked PASS. A subsequent owner-authored feature-branch commit is used to trigger the normal exact-head workflows and verify the committed lockfile remains synchronized.
- The next compatibility CI pass must execute `npm install --package-lock-only` against the committed lockfile and prove `git diff --exit-code -- package-lock.json`, then run `npm ci`. Until that exact-head result is observed, committed lockfile presence is established but lockfile synchronization is still **BLOCKED / pending revalidation**.
- No Production database/runtime/secret/key, Mainnet transaction or Subscription Program state was changed. The previous existing funded Devnet workflow remained ordinary Pay coverage only; no Subscription RPC, simulation, signing or submission was performed.
- Remaining Part 2.1 blockers are unchanged: exact-head revalidation of the committed lock, approved non-mutating Subscription RPC/simulation evidence, and a real Backend adapter boundary (Subscription API/backend lifecycle remains NOT IMPLEMENTED). Part 2.2 remains prohibited.

## 2026-10-30 — Part 2.1 clean lockfile regeneration and commit

Status: **CLEAN LOCKFILE COMMITTED AFTER GREEN COMPATIBILITY TESTS — exact-head validation of the lockfile-bearing commit is pending.**

- The first committed lockfile (`7ad7294...`) contained an `extraneous` nested `utf-8-validate@5.0.10` entry. On the next clean Node 24 / npm 11.19.1 checkout, `npm install --package-lock-only` correctly removed that 14-line extraneous record. The drift check exposed this; the prior lockfile was not accepted as synchronized.
- CI workflow run `41090281489` executed on code/workflow HEAD `36abcdc7848c88c71be00983b8f5a9e3b6f56633`. Compatibility tests passed: clean lock resolution, `npm ci`, TypeScript adapter compile, SDK/PDA/IDL test suite and local Pages/Workerd test. Root quality job also passed. The compatibility artifact was then committed only after the job passed.
- Lockfile commit: `e66505ab39f163e29fbe326bcc747b7a886c3917`, generated by `subscription-sdk-lockfile` job in run `41090281489`. The new file is `tools/subscription-sdk-compat/package-lock.json`, lockfileVersion 3, 216 package records, 124,485 bytes. GitHub blob SHA: `844434dd07da7f075279dad86db7115bef18a0b3`. The only change from the earlier lock was deletion of the 14-line extraneous nested package record; no declared dependency version changed.
- This lockfile update was produced from the clean resolution in the exact-head compatibility job and the same run completed `npm ci` plus the compatibility tests before the commit job pushed. This is stronger than the earlier artifact-only state; nevertheless the new lockfile-bearing HEAD still needs one fresh exact-head CI run to prove npm's lockfile check remains clean from source control.
- Current feature branch head is `e66505ab39f163e29fbe326bcc747b7a886c3917`; PR #366 remains OPEN / DRAFT / NOT MERGED; main remains `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- No Production DDL/configuration/secrets/keys, Collector signer, Mainnet transaction or Subscription Program state was changed. Existing ordinary Pay Devnet E2E is separate from the SDK compatibility work and is not Subscription E2E.
- Part 2.1 remains **BLOCKED** pending exact-head lockfile revalidation and the remaining Subscription backend boundary / approved read-only RPC-simulation evidence. Part 2.2 remains prohibited.

## 2026-10-30 — Part 2.1 SDK runtime plus non-mutating Devnet simulation checkpoint

Status: **PASS — isolated SDK runtime compatibility gates evidenced on exact feature HEAD; broader Subscription backend lifecycle and Mainnet deployed-program assurance remain open.**

- Repository refs at validation: main `7b975d56860b6d937ad76ab2983c71937644dfa3`; `feat/pay-subscription-billing` tested HEAD `7e9099b0e00f4caec1edc66e84c2eeb11682eb7b`; PR #366 OPEN / DRAFT / NOT MERGED. Compatibility job verified expected PR HEAD equals actual checkout HEAD.
- CI run `41091597310`, job `subscription-sdk-compat (24)`: **SUCCESS** on Node `24.22.1`, npm `11.19.1`, `engine-strict=true`. Clean lock regeneration produced no diff from the committed `tools/subscription-sdk-compat/package-lock.json`; `npm ci` passed; root-pinned TypeScript adapter compile passed; SDK/PDA/IDL golden suite passed **10/10**; local Pages/Workerd HTTP runtime test passed **1/1**; dedicated Devnet non-mutating simulation passed **1/1**.
- The Devnet simulation reads and asserts Devnet genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, reads the pinned Program account and verifies it exists, is executable and owned by the Upgradeable BPF Loader, checks the test fee-payer public address balance/rent preconditions, builds the SDK CreatePlan instruction and invokes only `simulateTransaction` with `sigVerify=false` and `replaceRecentBlockhash=true`. The simulation returned `err=null`, positive compute units and a Program success log. No private key was loaded; no signature was generated; no transaction submission method is present in the RPC allowlist; no chain state was mutated.
- The SDK harness still uses only pinned SDK dependencies outside the root browser dependency graph. The test uses the existing public Devnet CI payer address `EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV`; it does not read the corresponding private key.
- Exact-head ordinary Pay workflows: Database Security run `41091597395` **SUCCESS**; Mainnet read-only run `41091597291` **SUCCESS**; existing funded ordinary Pay Devnet E2E run `41091597242` **SUCCESS**. The existing Devnet E2E performed its ordinary Pay SOL, hosted transaction-builder, Bulk Pay and Payment Intent tests and is a separate mutating CI workflow. It is not Subscription E2E.
- CI root `quality` job: **SUCCESS**. It completed root dependency install, typecheck, production build, unit tests and clean source-tree check. Root tests are not Subscription lifecycle tests.
- Production Build workflow run `41091597307` ended with overall conclusion **CANCELLED**. Its individual build, typecheck, Pages preview route (expected HTTP 404 for an invalid referral code) and source-tree-clean steps all completed successfully; because the workflow conclusion is cancelled, the overall Production Build workflow is not marked PASS.
- The lockfile remains stable at 216 package records, lockfileVersion 3, 124,485 bytes, Git blob SHA `844434dd07da7f075279dad86db7115bef18a0b3`; CI clean lock generation did not alter it and `npm ci` passed.
- Runtime SDK compatibility scope: **PASS** for exact pinned SDK imports, TypeScript adapter, tested PDA/IDL/instruction fixtures, local Pages/Workerd execution and non-mutating Devnet CreatePlan simulation. The golden fixtures cover InitSubscriptionAuthority, CreatePlan and Subscribe; the PDA tests cover Plan, SubscriptionAuthority and Subscription derivations. This does not certify all instructions, all PDA types, the deployed Mainnet ELF or live on-chain IDL.
- Still **NOT IMPLEMENTED**: production Subscription API/domain/schema, backend billing lifecycle, Collector signing boundary, dedicated Subscription verifier/accounting, Subscription adversarial lifecycle and Subscription Devnet transaction E2E. No API/table/state/fee was invented and the ordinary Pay verifier/accounting were not changed.
- Still **UNKNOWN**: Mainnet ProgramData address/slot, upgrade authority, deployed binary hash and verified-source match, and live Mainnet on-chain IDL identity. The existing Mainnet read-only workflow is only the ordinary Pay transaction parsing smoke, not ProgramData assurance.
- No Production DDL/configuration, secret/key/Collector signer, customer consent or Mainnet transaction was changed. The only observed chain mutations were the separate existing ordinary Pay Devnet E2E scenarios above; the Subscription simulation was non-mutating.
- Local Working Tree remains **UNKNOWN** because no local clone is available through the GitHub connector.
- Next gate: perform approved read-only Mainnet Program/ProgramData and deployed IDL evidence using the configured Mainnet environment; separately resolve the Subscription backend contract and signer trust boundary before implementing actual backend integration. Do not begin Subscription schema/API/Collector/UI or any Part 2.2 work until the applicable Stage 2 gates are reviewed and approved.


## 2026-10-30 — Part 2.1 PASS; Mainnet ProgramData probe added, access blocked

Status: **Part 2.1 PASS — Stage 2 overall BLOCKED pending approved Mainnet ProgramData evidence and contract freeze.**

- Repository baseline: main `7b975d56860b6d937ad76ab2983c71937644dfa3`; feature code tested at `602c1f4a1c0b892274507645065208346b3a387a`; latest documentation head before this entry `f06ac6c3dc0e7d7e8f275ecde21f0b3fd0f361f7`; PR #366 remains OPEN / DRAFT / NOT MERGED.
- Exact-head CI run `41094085655`, job `subscription-sdk-compat (24)`: **SUCCESS**. Node `24.22.1`, npm `11.19.1`, `engine-strict=true`; committed lockfile regenerated without diff; `npm ci` passed; typed Kit→web3 adapter compile passed; SDK/PDA/IDL/Upgradeable Loader parser tests passed **15/15** (6 SDK, 4 IDL golden, 5 Program/ProgramData parser); local Pages/Workerd passed **1/1**; dedicated Devnet CreatePlan simulation passed **1/1** with no signature or submission.
- Root CI quality job passed. Database Security run `41094085340`, ordinary Pay Mainnet-read-only smoke `41094086100`, ordinary funded Pay Devnet E2E `41094085652`, and Production Build `41094085337` all completed **SUCCESS** on the tested SHA. The ordinary Pay Devnet E2E is a separate funded/mutating workflow for existing Pay flows; it is not Subscription E2E. Mainnet Pay smoke still uses the public endpoint and is not ProgramData proof.
- Added a read-only Upgradeable Loader parser and tests. Parser layout was cross-checked against Solana v1.18.26 source: Program state is 36 bytes; ProgramData metadata is 45 bytes with an upgrade authority and 13 bytes without one. Added a separate Mainnet ProgramData probe that allows only `getGenesisHash` and `getAccountInfo`, derives the ProgramData PDA, reads deployment slot/upgrade authority and hashes ELF bytes. It emits only sanitized metadata; it never logs the RPC URL/API key or raw ProgramData bytes.
- Added CI job `subscription-mainnet-programdata` using only GitHub Actions secret `SOLANA_RPC_URL`, with no public fallback. In run `41094085655`, this job **FAILED AT PREFLIGHT** because GitHub Actions did not provide `secrets.SOLANA_RPC_URL`. The dependency install and Mainnet RPC steps were skipped. **No Mainnet RPC request occurred; no ProgramData was read.**
- Read-only Cloudflare Pages metadata confirms project `solsite` Production has a `SOLANA_RPC_URL` variable of type `secret_text`. Only the variable name/type were read; its value was not retrieved, displayed or changed. This does not establish the endpoint's host or cluster. The same approved endpoint must be made available to the GitHub Actions job as repository secret `SOLANA_RPC_URL`, or another approved execution path must be supplied. Do not send the secret in chat.
- Upstream Program source declares Pinocchio and Codama. The inspected `runbooks/deployment/main.tx` deploys the binary; `.github/workflows/idl-check.yml` checks generated files. No explicit on-chain IDL publication step was found in those inspected paths; actual on-chain IDL presence/identity remains **UNKNOWN**. Do not assume Anchor IDL storage.
- **Part 2.1: PASS** for the bounded SDK/runtime scope: dependency lock, Node 24, TypeScript adapter, SDK/PDA/IDL fixtures, Kit→web3 conversion, Workerd, Devnet simulation, exact-head CI, browser dependency isolation, and unchanged ordinary Pay verifier.
- **Stage 2 overall: BLOCKED** until approved Mainnet Program/ProgramData/ELF hash/upgrade authority/source-match evidence and a documented on-chain IDL determination are complete, then API/DB/RBAC/Consent/Accounting contract freeze can proceed.
- Still **NOT IMPLEMENTED**: production Subscription API/domain/schema/migrations, billing lifecycle, Collector signer boundary, dedicated Subscription verifier/accounting, adversarial lifecycle suite and Subscription transaction E2E. Part 2.2 implementation has not started.
- No Production DDL/configuration, Cloudflare environment variable, secret value, private key, Collector signer, Mainnet transaction, Devnet Subscription state or customer consent was changed. The only chain mutations were the separate existing ordinary Pay Devnet E2E scenarios; Subscription simulation was non-mutating.
- Local Working Tree remains **UNKNOWN** because no local clone is available through the GitHub connector.
- Next action: make the existing approved Mainnet endpoint available to the read-only CI job through repository secret `SOLANA_RPC_URL` without disclosing it in chat, then rerun the exact-head ProgramData evidence job. Do not begin Subscription API/schema/Collector/UI implementation until Stage 2 gates are closed.


## 2026-10-30 — Mainnet ProgramData probe hardened; GitHub secret remains unavailable

Status: **Part 2.1 PASS; Mainnet ProgramData gate BLOCKED at credential preflight.**

- Tested code HEAD: `41fa343d5cd1dd86419b3f16534b2b3535e9034a`; latest docs-only HEAD before this entry: `686a5b523dc36a03ba6a3ed79654054d95efff53`; main `7b975d56860b6d937ad76ab2983c71937644dfa3`; PR #366 OPEN / DRAFT / NOT MERGED.
- Exact-head CI run `41095081493`: `subscription-sdk-compat (24)` **SUCCESS**. The job verified exact checkout SHA, committed lockfile consistency, `npm ci`, TypeScript adapter compile, SDK/PDA/IDL/Upgradeable Loader tests **16/16**, local Pages/Workerd **1/1**, and non-mutating Devnet CreatePlan simulation **1/1**. The Mainnet test source is also syntax-checked in the offline suite.
- The ProgramData parser was checked against Solana v1.18.26 `UpgradeableLoaderState`: Program account state size 36 bytes; ProgramData metadata 45 bytes with an authority and 13 bytes without one. Unit tests cover state discriminators, offsets, authority-present/absent, malformed option and truncated data.
- The Mainnet RPC URL validator now requires HTTPS and a Helius RPC hostname; known public Solana fallback is rejected by allowlist policy. The Mainnet probe permits only `getGenesisHash` and `getAccountInfo`, validates Mainnet genesis and Program/ProgramData loader state, derives the ProgramData PDA, parses deployment slot/upgrade authority and computes ELF SHA-256. Artifact output excludes endpoint/API key and raw executable bytes.
- CI run `41095081493`, job `subscription-mainnet-programdata`: **BLOCKED / FAILED AT PREFLIGHT** because `SOLANA_RPC_URL` was empty in the GitHub Actions job. Dependency installation and RPC probe were skipped; no Mainnet RPC request occurred. Cloudflare Pages metadata separately confirms `solsite` Production has a `SOLANA_RPC_URL` `secret_text` variable; its value was not accessed, logged or changed. The GitHub Actions job cannot read a Cloudflare Pages secret automatically.
- Same exact code HEAD: root CI quality **SUCCESS**; Database Security `41095081537` **SUCCESS**; ordinary Pay Mainnet-read-only smoke `41095081437` **SUCCESS**; ordinary Pay Devnet E2E `41095081457` **SUCCESS**. Production Build `41095081411` was still in progress at this checkpoint. Ordinary Pay Devnet E2E is the existing funded/mutating Pay test suite, not Subscription E2E. Subscription Devnet simulation itself is non-mutating.
- The Mainnet workflow failure makes the overall CI workflow **FAIL** even though the SDK compatibility job passes. This is intentional fail-closed behavior; do not mark ProgramData PASS or use the public-RPC Pay smoke as a substitute.
- The official Program is Pinocchio/Codama-based. The inspected upstream deployment runbook deploys the binary; the IDL workflow checks generated files. No on-chain IDL publication operation was found in those inspected paths; on-chain IDL presence remains **UNKNOWN** pending evidence.
- **Part 2.1: PASS** for bounded SDK/runtime compatibility. **Stage 2 overall: BLOCKED** pending Mainnet ProgramData/deployed ELF/source match and IDL determination, followed by contract freeze.
- No Production DDL/configuration, Cloudflare environment variable, secret value, private key, Mainnet RPC call, Mainnet transaction, Subscription Devnet state or customer consent was changed. No secret was copied into GitHub or chat.
- Local Working Tree remains **UNKNOWN** because no local clone is available through the GitHub connector.
- Next action: add the already-approved Mainnet endpoint to GitHub Actions repository secrets as `SOLANA_RPC_URL` (without sharing the value in chat), then rerun the read-only ProgramData job. Do not proceed to API/schema/Collector/UI implementation before Stage 2 gates close.


## 2026-10-30 — Reproducible upstream Program build PASS; Mainnet RPC secret preflight BLOCKED

Status: **Part 2.1 SDK/runtime compatibility PASS. Reproducible upstream source build PASS. Mainnet ProgramData/source-match gate BLOCKED because the GitHub Actions Mainnet RPC secret is unavailable. Stage 2 overall remains BLOCKED.**

- Current feature branch HEAD: `b464efef66c394adae6249032f9b45d1d71dd5e8`; main HEAD: `7b975d56860b6d937ad76ab2983c71937644dfa3`; PR #366 is OPEN / DRAFT / NOT MERGED. The commits are confined to `feat/pay-subscription-billing`; no main-branch write was made.
- Exact-head CI run `41096334615` completed:
  - `subscription-sdk-compat (24)`: **SUCCESS** — exact-head checkout, lockfile consistency, `npm ci`, TypeScript adapter compilation, 16 SDK/PDA/IDL/Upgradeable Loader tests, local Pages/Workerd test (1/1), and non-mutating Devnet CreatePlan simulation (1/1).
  - `quality`: **SUCCESS** — root install, typecheck, production build, unit tests and source-tree cleanliness.
  - `subscription-reproducible-build`: **SUCCESS** — checked out upstream `solana-foundation/subscriptions` commit `364a41976c33347d092902443bbec2def9227e75`; verified source/toolchain pins; downloaded `solana-verify 0.5.2` and verified its published Linux binary SHA-256; built using the pinned Docker image digest `sha256:f71be5ca7620b7e40933b7f1294fa44e01d08c1fc5ba1f375a2478f5a01580d3`; calculated the executable hash and uploaded artifact `solmint-subscription-reproducible-build` (artifact ID `12995278872`). The actual build-container Rust toolchain is emitted into the artifact; the source repository's `rust-toolchain.toml` says 1.92, so these two values must not be conflated.
  - `subscription-mainnet-programdata`: **FAIL / BLOCKED AT PREFLIGHT** — GitHub Actions did not receive `secrets.SOLANA_RPC_URL`. The dependency install and RPC probe were skipped; no ProgramData account or Mainnet RPC response was retrieved.
- The reproducible build workflow originally failed because `solana-verify build` received a relative mount path and transformed the Program manifest path incorrectly (`Cargotoml`). It was corrected to use absolute workspace paths. The rerun on the current code head passed the complete source build and hash extraction steps.
- The ProgramData probe compares the deployed executable hash to the output of this pinned source build. It requires an HTTPS Helius endpoint, validates the canonical Mainnet genesis hash, checks Program/ProgramData Upgradeable Loader account states, derives the ProgramData PDA, reads deployment slot and upgrade authority, trims zero padding according to `solana-verify v0.5.2` hash semantics, and compares the executable hash. Only `getGenesisHash` and `getAccountInfo` are allowed; no public RPC fallback exists.
- Cloudflare Pages metadata had previously confirmed that the `solsite` Production environment defines `SOLANA_RPC_URL` as `secret_text`. Its value was not read, logged or changed. Cloudflare Pages secrets are not automatically exposed to GitHub Actions. A same-name GitHub Actions repository secret must be configured separately by an authorized repository maintainer, using the approved existing Helius Mainnet endpoint. The secret must never be pasted into chat or committed.
- The GitHub Actions CI workflow is marked **FAIL** because the dedicated Mainnet ProgramData job fails closed at preflight; this does not negate the successful SDK compatibility and source reproducible-build jobs. It does mean the Mainnet assurance gate is still not passed.
- The separate workflows on this tested HEAD completed **SUCCESS**: Production Build `41096334572`, existing ordinary Pay Devnet E2E `41096334550`, ordinary Pay Mainnet-read-only provider smoke `41096334567`, and Database Security `41096334646`. The ordinary Pay Devnet E2E is the pre-existing funded/mutating Pay suite, not Subscription E2E. The ordinary Pay Mainnet smoke is not ProgramData evidence.
- **PASS:** bounded SDK/runtime compatibility; lockfile, typecheck, golden fixtures, local Workerd, non-mutating Devnet simulation, exact-head CI for these jobs; pinned upstream Program source build and executable hash generation.
- **BLOCKED:** deployed Mainnet ProgramData evidence and comparison of its executable hash to the reproducible build; live upgrade authority/deployment slot confirmation; deployed IDL presence/identity; then typed API/DB/RBAC/Consent/Accounting contract freeze.
- **NOT IMPLEMENTED:** production Subscription API/domain/schema/migrations, billing lifecycle, Collector signer boundary, dedicated Subscription verifier/accounting, adversarial lifecycle suite, Subscription transaction E2E and UI. Part 2.2 has not started.
- No Production DDL/configuration, Cloudflare variable, secret value, private key, Collector signer, Mainnet transaction, Subscription Devnet state or customer consent was changed. The source build is local CI build work only; the Subscription Devnet simulation is non-mutating. Existing ordinary Pay Devnet E2E remains separately mutating.
- Local Working Tree is **UNKNOWN** because only GitHub-hosted repository state was accessible; no local clone status was available.
- Next action: an authorized maintainer adds the approved Helius Mainnet endpoint to GitHub Actions repository secrets as `SOLANA_RPC_URL` (Settings → Secrets and variables → Actions) without sharing its value; then rerun the exact-head ProgramData job. Do not begin Subscription API/schema/Collector/UI implementation until the Mainnet deployment identity and remaining Stage 2 contract gates are resolved.


## 2026-10-30 — Mainnet Subscription ProgramData matched pinned source build; canonical IDL probe added

Status: **Mainnet ProgramData / deployed ELF identity PASS on the exact tested checkpoint below. Canonical on-chain IDL presence/content check has been added to the feature branch but is PENDING exact-head CI. Overall Stage 2 remains BLOCKED; Part 2.2 has not started.**

### Repository and scope
- Repository: `azad2022/solsite`.
- `main` and PR base remain `7b975d56860b6d937ad76ab2983c71937644dfa3`; no main-branch change was made by this checkpoint.
- Feature branch: `feat/pay-subscription-billing`.
- PR #366 remains OPEN / DRAFT / NOT MERGED.
- Earlier Mainnet ProgramData evidence was produced by CI run `41110119177` on feature HEAD `b9c11131f5905db644b7535502ed2813ce7aa885`. All four CI jobs in that run completed SUCCESS: `quality`, `subscription-reproducible-build`, `subscription-sdk-compat (24)`, and `subscription-mainnet-programdata`.
- ProgramData evidence artifact ID `13008026068`, SHA-256 digest `2a7da19ca74594ff02f56bbb49a00a23f25c812a75c3ce26cd9dfafd1f5d3eeb`. Reproducible-build evidence artifact ID `13002598916`, digest `2a5b6534ceaa18ed90ede22cad954d4eda05fc00cce22cf62203f50af40da807`.

### Finalized Mainnet read-only evidence
- RPC endpoint passed the required Helius HTTPS allowlist and returned the canonical Solana Mainnet genesis hash `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
- Subscription Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- Program and ProgramData are owned by Upgradeable BPF Loader `BPFLoaderUpgradeab1e11111111111111111111111`; Program is executable and ProgramData is non-executable.
- Derived and observed ProgramData PDA: `HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg`.
- Deployment slot: `438440823`.
- Recorded ProgramData upgrade authority: `DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv`.
- Deployed ELF SHA-256: `056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318`.
- Reproducible executable SHA-256 from pinned upstream source commit `364a41976c33347d092902443bbec2def9227e75): the exact same hash. The Mainnet assertion passed at `finalized` commitment.
- Probe allows only `getGenesisHash` and `getAccountInfo`; no public RPC fallback. It did not submit a transaction or mutate Mainnet state.
- The observed upgrade-authority public key is recorded, but its actual controlling multisig/vault, signer set, custody policy and relationship to the upstream Foundation release process have not been established: **UNKNOWN**.

### Build toolchain qualification
- Upstream source `rust-toolchain.toml` requests Rust `1.92`.
- The pinned `solana-verify 0.5.2` build container reported `1.86.0-x86_64-unknown-linux-gnu`.
- The resulting executable hash nevertheless matched the deployed ProgramData ELF exactly. This is positive binary-identity evidence, but does not reconcile why the container toolchain differs from the source toolchain pin. Toolchain provenance/reproducibility qualification remains **BLOCKED** pending explanation from the pinned builder configuration.

### Canonical on-chain IDL verification added — exact-head result pending
- The pinned source IDL is `solana-foundation/subscriptions/idl/subscriptions.json` at commit `364a41976c33347d092902443bbec2def9227e75`, Git blob `208718e90bf9f8e7f42271b6e93284109b118172`; the IDL identifies Program `De1eg...`, name `subscriptions`, version `0.5.0-beta.1`.
- Reviewed the pinned Program Metadata JS/Rust account encoding and CLI defaults. Added a fail-closed parser and unit tests for the canonical Metadata PDA/account format. The Mainnet probe now derives the canonical `idl` metadata PDA, checks account owner/discriminator/program/seed/canonical flag/encoding/compression/format/data source, inflates the direct zlib payload and compares its SHA-256 against the exact pinned source IDL bytes.
- This new IDL check uses only finalized `getAccountInfo`; it performs no instruction, signing, proposal, transaction or account mutation.
- Added/updated:
  - `tools/subscription-sdk-compat/src/program-metadata.mjs`
  - `tools/subscription-sdk-compat/test/program-metadata.test.mjs`
  - `tools/subscription-sdk-compat/test/mainnet-programdata.test.mjs`
  - `tools/subscription-sdk-compat/package.json`
  - `.github/workflows/ci.yml` (source IDL hash output and Mainnet comparison input).
- These changes were committed only on the feature branch. Current feature HEAD at this ledger update: `30be0befd8865736d69d0a857f49a0c1045ce0a0`. The exact-head CI run `41120662724` and independent Mainnet Read-only `41120662746`, Production Build `41120662748`, Database Security `41120662835` and ordinary Pay Devnet E2E `41120663008` were still queued/in progress when checked. Therefore the newly added parser and on-chain IDL assertions are **NOT YET PASS**; exact-head validation is pending. Ordinary Pay Devnet E2E is not Subscription E2E.
- Do not infer that on-chain IDL exists merely because the release workflow can prepare/export a Squads transaction. Its actual finalized account and content must pass this new read-only assertion first.

### Cantina audit and upstream release delta
- Reviewed the supplied Cantina report dated 2026-07-30 and the pinned upstream source at the report's reviewed/remediation commits and release commit `364a41976c33347d092902443bbec2def9227e75`.
- Report summary: 0 Critical; 1 High (acknowledged); 5 Medium (2 fixed, 3 acknowledged); 2 Low (1 fixed, 1 acknowledged); 1 Informational (fixed). This is the auditor's report status, not proof that all residual risk is eliminated.
- The release delta from remediation commit `debb4f75ff7571218b39de3b633074dd843e70db` to release commit `364a419...` contains eight commits and no `program/src/**` changes in that range. The client, IDL and release workflow changed. Keep source/audit findings, generated IDL and deployment state as separate evidence.
- Key residual risks remain in the threat model: delayed execution of held init/subscribe transactions (including `UNKNOWN_INIT_ID`), stale cancellation/resume/control transactions and same-second replay edges, Plan Owner/external Puller authority, finite-Plan near-expiry full-period pulls, rent sponsorship and shared-authority scope. The project v1 profile must continue to reject the sentinel and held init+subscribe bundles, exclude unresolved durable-nonce/program-controlled proposals, reconcile every authorized Puller, and keep Collector/verification/accounting separate.

### Release-control and implementation status
- Issue #355 remains OPEN. The historical Supabase-linked runner applying main-branch migrations is evidenced in the issue, but the exact actor/trigger and current provider integration setting remain UNKNOWN. A successful controlled Session Pooler DRY_RUN does not prove the provider-side auto-deploy setting is disabled. Production DDL remains **BLOCKED** until migration-runner provenance is resolved and the prescribed owner-approved migration flow is established.
- Production Subscription API/domain/schema/migrations, Consent lifecycle, Billing/Cycle/Attempt processing, isolated Collector signing, dedicated Subscription verifier/accounting, adversarial lifecycle tests, Subscription transaction E2E and UI remain **NOT IMPLEMENTED**.
- Typed API/DB/RBAC/Consent/Accounting contract freeze remains **BLOCKED**. Ordinary Pay verifier/accounting were not changed.
- Local Working Tree remains **UNKNOWN**; GitHub connector evidence does not expose a local clone.
- No Production DDL, Cloudflare setting, secret value, private key, Collector signer, Mainnet transfer, Mainnet Program mutation or live customer consent was changed by this work. GitHub Actions consumed the configured RPC secret, but its value was not read or logged. The separate existing ordinary Pay Devnet E2E uses its configured Devnet fixture and is not Subscription transaction coverage.

### Gate summary and next step
- **PASS:** previous exact-head SDK compatibility/build checks; Mainnet Program/ProgramData ownership and PDA validation; finalized deployment slot/upgrade-authority observation; deployed ELF hash equals pinned source-build executable hash; Cantina report and upstream source delta review.
- **PENDING / NOT YET PASS:** new canonical on-chain IDL existence, metadata format and exact source-content SHA comparison; exact-head CI for the new parser/test/workflow code; Rust 1.92 vs build-container 1.86 toolchain reconciliation; upgrade-authority controller/multisig identity.
- **BLOCKED:** Stage 2 contract freeze and Production DDL/migration control.
- **NOT IMPLEMENTED:** all production Subscription lifecycle/backend/Collector/verifier/accounting/UI capability listed above.
- Part 2.2 remains prohibited until every Stage 2 gate closes with evidence. Next action is to finish the current exact-head CI/Mainnet read-only run, investigate any IDL assertion failure without weakening it, then address the remaining controller/toolchain/contract and migration-provenance blockers.


## 2026-10-31 — Exact-head Mainnet ELF + canonical IDL verification; Cantina and build-toolchain re-audit

Status: **PASS — deployed Mainnet ELF and canonical on-chain IDL both match the pinned upstream release source on exact feature HEAD `33fd4f066f6f4653851e7a2389e742febe25ee78`. SDK/CI/Production Build/DB Security/ordinary Pay Mainnet and Devnet workflows passed. Stage 2 overall remains BLOCKED by accepted upstream security residuals, upgrade-authority controller identity, backend contract freeze and Issue #355. Part 2.2 has not started.**

### Repository / PR / required instructions
- Repository: `azad2022/solsite`.
- Feature branch: `feat/pay-subscription-billing`, exact PR HEAD `33fd4f066f6f4653851e7a2389e742febe25ee78`.
- PR #366: OPEN / DRAFT / NOT MERGED; base `main` SHA `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- Main remains `7b975d56860b6d937ad76ab2983c71937644dfa3`; no direct main change.
- Re-read from this current branch the project instructions, Frontend Master Specification, Subscription Skill, Build Web Apps Skill and Release Audit Skill. The relevant file blobs were unchanged at this HEAD.
- The Cantina PDF supplied by the project owner was reviewed page-by-page (12 pages; rendered and visually inspected). Report scope is commit `d6b3a5dc7ab18c4168441af733c81ab0a599d414`; the report itself is dated 2026-07-30.

### Exact-head CI and independent workflow evidence
- CI run `41121500802` on exact head `33fd4f0...`: **SUCCESS**.
  - `subscription-sdk-compat (24)`: **SUCCESS**; exact PR-head checkout verified; committed package lockfile check and `npm ci` passed; TypeScript adapter/SDK call-site typecheck passed; 22 Node tests passed (22 pass / 0 fail); local Pages/Workerd test passed 1/1; dedicated Subscription CreatePlan Devnet simulation passed 1/1 and did not submit a transaction.
  - `quality`: **SUCCESS**; root production typecheck, Production build, unit tests and clean-source assertion passed.
  - `subscription-reproducible-build`: **SUCCESS**; upstream source commit/toolchain/image pins verified; pinned `solana-verify 0.5.2` binary checksum verified; source build and executable hash generation passed.
  - `subscription-mainnet-programdata`: **SUCCESS**; exact PR-head checkout, secret preflight, isolated install, finalized Mainnet Program/ProgramData/IDL read and sanitized evidence upload all passed.
- Separate exact-head workflows:
  - Production Build run `41121500465`: **SUCCESS**.
  - Database Security run `41121500564`: **SUCCESS**. This is the existing ordinary Pay/database security suite; no Subscription schema/RLS was added or proved by it.
  - ordinary Pay Mainnet Read-only run `41121500507`: **SUCCESS**. This is provider/transaction smoke and is separate from the Subscription ProgramData/IDL evidence.
  - ordinary Pay funded/mutating Devnet E2E run `41121500440`: **SUCCESS**. It exercises existing Pay transactions and reconciliation, not Subscription transaction E2E.
  - Cloudflare Pages feature-branch Preview check: **SUCCESS**. This was a preview deployment/check, not Production deployment.
  - Supabase Preview: SKIPPED (as expected for the current configured workflow); no Production migration was applied.
- Mainnet probe is fail-closed and permits only `getGenesisHash` and `getAccountInfo`; it has no public RPC fallback. The Subscription Devnet simulation permits only read/simulation RPC methods and does not sign or submit.

### Finalized Mainnet Program / ProgramData / binary identity
- Cluster: Mainnet Beta; genesis hash `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
- Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- Program and ProgramData owner: Upgradeable BPF Loader `BPFLoaderUpgradeab1e11111111111111111111111`; Program executable = true; ProgramData executable = false.
- ProgramData PDA: `HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg`.
- Deployment slot: `438440823`.
- ProgramData upgrade authority: `DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv`.
- Deployed executable ELF SHA-256: `056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318`.
- Reproducible source-build ELF SHA-256 from upstream commit `364a41976c33347d092902443bbec2def9227e75`: the exact same value. The assertion passed at `finalized` commitment.
- The sanitized Mainnet evidence shows the same ProgramData account, deployment slot and upgrade authority as the prior successful checkpoint; no Mainnet state changed.

### Canonical on-chain IDL — exact source content PASS
- Canonical Program Metadata PDA for seed `idl`: `CCG1hwKFk32h11yE2PRZeEmNAdZsMQrSuiEmqx5eEhWE`.
- Metadata account owner: Program Metadata Program `ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S`; account executable = false.
- Metadata references the deployed Subscription Program ID; discriminator and canonical metadata fields are valid; `authority = null`, `canonical = true`, seed `idl`, source `direct`, encoding UTF-8, compression zlib, format JSON.
- On-chain IDL content SHA-256: `1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa`.
- Exact pinned upstream source IDL SHA-256: same value. Decoded IDL declares name `subscriptions`, Program key matching the deployed Program ID, version `0.5.0-beta.1`.
- Pinned IDL source: `solana-foundation/subscriptions/idl/subscriptions.json`, commit `364a41976c33347d092902443bbec2def9227e75`, Git blob `208718e90bf9f8e7f42271b6e93284109b118172`.
- The initial IDL probe at older commit `30be0be` failed because the local PDA derivation incorrectly included a 32-byte zero-authority seed. The upstream Rust initializer and generated Codama PDA source were inspected. Canonical metadata uses exactly `[program, fixed_16_byte_seed]`; only non-canonical metadata includes an authority seed. This derivation was corrected, the parser/unit tests were updated and exact-head CI/Mainnet then passed. Do not reuse the failed derived address/result.
- Sanitized ProgramData/IDL evidence artifact from run `41121500802`: ID `13008866738`, digest `ea0e8b5b4699cb007fb1c896418daf02b4945b5b8290cd51e18f40a5b38aed3f`. Reproducible build artifact ID `13007898762`, digest `4f6022cc37ca51434f7b4adc5b75f29d5bc6d14b8aeaf49f9896757a53cc8337`.

### Build-toolchain discrepancy resolved
- Subscription source `rust-toolchain.toml` says Rust `1.92`; the actual verified build log reports `1.86.0-x86_64-unknown-linux-gnu`.
- This is explained by the pinned builder, not an arbitrary runner drift: upstream `solana-verify v0.5.2` source explicitly reads the active Rust toolchain in the selected Docker container and passes it as `RUSTUP_TOOLCHAIN` to the cargo build. The v0.5.2 image map pins Solana/Agave `3.1.10` to Docker digest `sha256:f71be5ca7620b7e40933b7f1294fa44e01d08c1fc5ba1f375a2478f5a01580d3`; its `docker/v3.1.10.Dockerfile` installs Agave `v3.1.10`. The upstream `anza-xyz/agave` tag `v3.1.10` itself pins Rust `1.86.0`. Thus the verified SBF build uses the selected Agave image/toolchain rather than the checkout's Rust 1.92 toolchain file.
- The actual executable produced by that pinned container still hash-matches the deployed Mainnet ELF. Treat the builder's Docker digest and Agave v3.1.10 toolchain as the SBF build reproducibility pins. Do not state that Rust 1.92 compiled the deployed artifact.
- Toolchain mismatch classification: **RESOLVED / PASS for the pinned verified-build path**. This does not certify unrelated local Rust builds with toolchain 1.92.

### Cantina report matrix and source delta
- Visually reviewed the full 12-page Cantina report. Its summary table records 9 issues: 0 Critical; 1 High (0 fixed, 1 acknowledged); 5 Medium (2 fixed, 3 acknowledged); 2 Low (1 fixed, 1 acknowledged); 1 Informational (fixed).
- Finding status from report:
  - High: `Old signed creates restore revoked permissions` — acknowledged, not fixed in Program code. The retained signed init+create/Subscribe path using `UNKNOWN_INIT_ID` can re-create the shared authority and restore the `u64::MAX` Token Delegate after revoke. The upstream release README continues to document this class of risk.
  - Medium: stale `CancelSubscriptionNow` approval — mitigated by `expected_current_period_start_ts`; same-second recreation remains a documented replay edge.
  - Medium: stale `update_plan` can restore removed pullers — fixed and Cantina-verified in commit `653dec58`.
  - Medium: stale `ResumeSubscription` can undo a later cancellation — acknowledged/documented; it now binds expected expiry but remains in the report's acknowledged category.
  - Medium: stale authority-control approvals can restore/destroy a later authority state — acknowledged/documented; no persistent epoch/nonce/deadline mechanism was added to Program by the remediation delta.
  - Medium: a finite Plan near expiry can still be charged a full period — acknowledged/documented.
  - Low: optional `CreatePlan` payer missing from IDL/generated clients — fixed and verified in commit `11173179`.
  - Low: automatic rent sponsorship can lock relayer funds indefinitely — acknowledged/documented.
  - Informational: IDL generation errors do not fail release/client-generation steps — fixed and verified in commit `1b6e98e`.
- Upstream audit tracking file `audits/AUDIT_STATUS.md` records the audit baseline `d6b3a5dc...` and code-fix verification point `debb4f75ff7571218b39de3b633074dd843e70db`.
- Exact source compare `d6b3a5dc...` → `debb4f75...` shows seven remediation commits, including Program instruction changes, integration tests, IDL/client fixes and a fuzz harness. The release delta `debb4f75...` → `364a419...` is eight commits and contains no `program/src/**` changes; it changes release workflow, client packages/lockfiles, IDL version/metadata and supporting docs. The same deployed Mainnet binary is exactly the Build hash from source commit `364a419...`.
- Therefore the 0.5.0 release does not introduce additional Program Rust changes after the declared Cantina fix point, but the report's acknowledged findings remain real residual risk. An audited/fixed label is not equivalent to eliminating all accepted risks.

### Upgrade authority and governance boundary
- Mainnet ProgramData proves the upgrade authority address as `DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv`.
- This only identifies the on-chain authority public key. The controlling multisig/vault account, members/threshold, custody and release authorization procedure have not been proven by the retrieved ProgramData or repository runbook: **UNKNOWN**.
- Do not label this key as Foundation-controlled or multisig-controlled without evidence. No authority ownership inference is made from the public key alone.

### Open project blockers / implementation state
- Issue #355 remains OPEN. Historical evidence establishes the Supabase-linked main-branch runner applied production migrations outside the documented manual path, but its exact actor/trigger and current provider integration toggle remain UNKNOWN. Keep Production DDL blocked; do not alter integration settings without explicit owner approval.
- Typed API/DB/RBAC/Consent/Accounting contract freeze remains **BLOCKED** pending backend/data contract review.
- Production Subscription API/domain/schema/migrations, billing lifecycle/worker, isolated Collector signer, dedicated Subscription verifier and atomic accounting, lifecycle adversarial tests, real Subscription Devnet transaction E2E and UI remain **NOT IMPLEMENTED**. Existing Pay CI and the non-mutating Subscription CreatePlan simulation are not substitutes.
- Existing ordinary Pay verifier/accounting were not changed.
- Local Working Tree: **UNKNOWN** (GitHub remote connector only; no local clone state was available).

### Gate decision
- **PASS:** exact-head SDK/runtime compatibility; committed lockfile and `npm ci`; TypeScript adapter typecheck; 22 SDK/PDA/IDL/metadata tests; local Workerd; non-mutating Subscription Devnet CreatePlan simulation; root quality; reproducible source build; Mainnet ProgramData ownership/PDA/deployment slot; deployed ELF/source build hash equality; canonical on-chain IDL account and content hash equality; separate Production Build, Database Security, ordinary Pay Mainnet Read-only and ordinary Pay Devnet E2E workflows.
- **BLOCKED:** overall Stage 2 contract freeze; Production DDL/migration control due Issue #355; risk acceptance/mitigation design for acknowledged Cantina High/Medium findings before any Production Subscription release.
- **UNKNOWN:** authority controller/multisig membership and custody; local Working Tree.
- **NOT IMPLEMENTED:** production Subscription API/schema/Billing/Collector/verification/accounting/adversarial E2E/UI lifecycle.
- Part 2.2 remains **NOT STARTED**. Do not start it until the remaining Stage 2 gates are closed with positive evidence and acknowledged upstream residual risks have an explicit, enforceable v1 threat model.
- No Production DDL, Cloudflare/Supabase settings, secret values, private keys, Collector signer, Mainnet transfer, Mainnet Program mutation or real customer consent changed. The Mainnet probe was read-only. The separate existing ordinary Pay Devnet E2E performed its already-configured Pay test scenarios; the Subscription Devnet probe only simulated and did not submit.


## 2026-10-31 — Exact-head Mainnet Squads v4 upgrade-authority governance verification

Status: **PASS — Mainnet ProgramData, deployed ELF/source hash, canonical IDL/source hash and controlling Squads v4 vault/state relationship all verified read-only on exact feature code HEAD `40456d8cf3be34f3d9ecb30ec17d95111ee13be8`. CI, SDK compatibility, source build, Mainnet probe, Production Build and Database Security passed. The ordinary Pay Devnet E2E workflow was still in progress at the last check. Overall Stage 2 remains BLOCKED; Part 2.2 remains NOT STARTED.**

### Repository and PR
- Repository: `azad2022/solsite`.
- Tested feature branch: `feat/pay-subscription-billing`, code HEAD `40456d8cf3be34f3d9ecb30ec17d95111ee13be8`.
- PR #366: OPEN / DRAFT / NOT MERGED; base displayed by the PR API remains `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- The feature branch contains the Squads v4 verifier implementation and tests only in the isolated SDK compatibility harness; no existing Pay API, runtime production route, migration, ordinary Pay verifier or accounting implementation was altered by this checkpoint.
- Required project instructions, Master Specification and Subscription / Build Web Apps / Release Audit Skills had been re-read from the same feature branch before the relevant code changes.

### Exact-head CI / workflows
- CI run `41172047279` on exact PR head `40456d8...`: **SUCCESS**. All jobs completed:
  - `subscription-sdk-compat (24)`: **SUCCESS**. Committed lockfile check, `npm ci`, TypeScript adapter/SDK call-site typecheck, **27 Node tests (27 pass / 0 fail)**, local Pages/Workerd runtime test **1/1**, non-mutating Subscription CreatePlan Devnet simulation **1/1**.
  - `quality`: **SUCCESS** (root production typecheck, build, unit tests and clean-source assertion).
  - `subscription-reproducible-build`: **SUCCESS** (pinned upstream source/toolchain/image verification, pinned `solana-verify 0.5.2` checksum, reproducible source build and executable hash generation).
  - `subscription-mainnet-programdata`: **SUCCESS** (exact PR-head checkout, Mainnet RPC secret presence preflight, finalized Program/ProgramData/IDL/Squads state read, all assertions and evidence upload).
- Separate workflows on the same HEAD:
  - Production Build run `41172047259`: **SUCCESS**.
  - Database Security run `41172047377`: **SUCCESS**. This remains ordinary Pay and existing database security coverage; no Subscription schema/RLS was implemented or verified by this workflow.
  - ordinary Pay Mainnet Read-only run `41172047271`: **SUCCESS**; not a substitute for the dedicated ProgramData/IDL/Squads probe.
  - ordinary Pay funded/mutating Devnet E2E run `41172047275`: **IN_PROGRESS** at last observation. This is ordinary Pay test coverage, not Subscription E2E.
  - Cloudflare Pages feature Preview for exact feature HEAD: **SUCCESS**, Preview environment only.
  - Supabase Preview: **SKIPPED**.
- Subscription Devnet test remains a non-mutating `simulateTransaction` probe. It did not sign or submit a Subscription transaction.
- Mainnet probe method allowlist remains only `getGenesisHash` and `getAccountInfo`, at finalized commitment. No public RPC fallback is present.

### Mainnet ProgramData / ELF / IDL (reconfirmed on 40456d8)
- Cluster: Mainnet Beta; genesis hash `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
- Subscription Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- ProgramData PDA: `HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg`.
- Deployment slot: `438440823`.
- ProgramData Upgrade Authority: `DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv`.
- Deployed ELF SHA-256 and pinned reproducible source-build SHA-256 both equal `056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318`.
- Canonical IDL Metadata PDA: `CCG1hwKFk32h11yE2PRZeEmNAdZsMQrSuiEmqx5eEhWE`; on-chain IDL SHA-256 and pinned source IDL SHA-256 both equal `1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa`. Canonical IDL account, owner, authority=null, seed, compression, encoding, format, source, Program key and name all pass.
- No Mainnet write, signing, transfer or Subscription Program mutation was performed.

### Squads v4 governance: controlling Vault/State pair verified on Mainnet
- The ProgramData upgrade-authority key is the canonical Squads v4 vault PDA, not an unidentified standalone key.
- Squads v4 Program ID: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`.
- Mainnet Multisig State Account: `4CxQs26DewQ1KaCHfyyjktkYjndNdUqCJvVdygtJFwcJ`.
- State account owner equals the Squads v4 Program ID; executable=false; finalized RPC context slot `463568515`.
- Stored `create_key`: `9RSjrNGVWxPaiAr6JZ5oiNjLyWJenC5DTSpGVqRytPVw`.
- State PDA independently re-derives from the stored create_key and the pinned Squads v4 seeds; stored bump = derived bump = `252`.
- Vault PDA independently re-derives from the State Account using the Squads v4 v4 derivation and equals the deployed ProgramData Upgrade Authority exactly; vault bump = `254`.
- Parsed live governance parameters:
  - Threshold: **3 of 5**.
  - Members: **5**.
  - Voters / Initiators / Executors: **5 / 5 / 5**.
  - Each of the five current member entries has permission mask `7` (Initiate + Vote + Execute).
  - `config_authority`: default/zero key. In the pinned Squads v4 source, this means autonomous configuration; member/threshold changes use the normal multisig process rather than a separate config authority.
  - Time lock: **0 seconds**; there is no enforced delay between proposal approval settlement and execution for this multisig state.
  - transaction_index `11`, stale_transaction_index `0`, rent_collector `null`.
- The five currently configured member public keys are preserved in the sanitized CI evidence artifact and can be read there; they are not asserted to be identifiable people or entities.
- Governance conclusion: **PASS** for the on-chain ownership/authority chain and the parsed 3-of-5 current threshold/permission configuration. **UNKNOWN** for real-world identity, custody and operational security of the five member key holders. Do not attribute the keys to Foundation staff, a named company or individuals without independent proof.
- Security note: zero-second timelock is a real configuration fact and should be included in the operational threat model; it is not a parser or CI failure.

### Source basis for Squads v4 derivation/layout
- Squads source reviewed at commit `af94153ff77a28b6effe46b9c94baaa93742b48c`, Program ID `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`.
- Main source evidence:
  - `programs/squads_multisig_program/src/instructions/multisig_create.rs`: state PDA seeds `[b"multisig", b"multisig", create_key]`; default `config_authority` is the autonomous setting.
  - `programs/squads_multisig_program/src/state/multisig.rs`: Borsh fields, member encoding, permission bits, quorum/invariant checks and three-month maximum timelock.
  - `programs/squads_multisig_program/src/state/seeds.rs`: seed constants.
- Independent corroborating reference is Solana Foundation Microscope commit `20a516b2066ec4f13e0b76926b11f666ffd0f49a`, which contains a known v4 state/vault pair test for these exact addresses and a v4 vault PDA derivation.

### Squads v4 checker changes on the feature branch
- Added isolated parser `tools/subscription-sdk-compat/src/squads-v4.mjs`.
- Added unit tests `tools/subscription-sdk-compat/test/squads-v4.test.mjs`.
- Updated `tools/subscription-sdk-compat/test/mainnet-programdata.test.mjs` to read the exact State Account using finalized `getAccountInfo`, validate owner/executable/discriminator/Borsh data, derive state and vault PDAs, compare with the ProgramData upgrade authority, and emit sanitized threshold/member/permission/timelock evidence.
- Updated the compatibility test script in `tools/subscription-sdk-compat/package.json`.
- Squads parser tests specifically cover known v4 vault derivation, state PDA derivation, Borsh member/config parsing, optional rent collector, invalid discriminator, malformed permission, invalid threshold and truncated data.
- These are read-only/on-host parser and Mainnet account-read changes only. No Squads proposal was created, approved, signed, executed or altered.

### Main-branch history incident — transparent record
- During this checkpoint two isolated tooling files were unintentionally created on the repository default branch because the GitHub `create_file` action ignored its optional Branch argument:
  1. Commit `88fff972940c4bc53527f8a2c2e5d1a95e6379f4` added only `tools/subscription-sdk-compat/src/squads-v4.mjs`.
  2. Commit `6590dfdb72166cf1e6e7d82cd3cd90602f0a348a` added only `tools/subscription-sdk-compat/test/squads-v4.test.mjs`.
- Both files were immediately removed from `main`:
  3. `5d925adb555b7ceab99568b8199227042d46a4b9` deleted the parser file.
  4. `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f` deleted the test file.
- Current `main` HEAD: `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f`.
- GitHub compare of current main against original baseline `7b975d56860b6d937ad76ab2983c71937644dfa3` reports **zero changed files**. The main tree is therefore restored to the same tracked file content as the baseline, but its history contains four extra add/delete commits. Never state that the main branch history was unchanged.
- Cloudflare Pages API read-only deployment inventory confirms that commits `88fff972...`, `6590dfdb...`, `5d925adb...` and `4d9fa4c...` each produced deployments classified as environment `production` with successful deployment stage. The first three transient deployments had no custom-domain alias in the returned deployment records; the final recovered commit `4d9fa4c...` is the one whose deployment record carries alias `https://solmint.ir`. The latest `solmint.ir` alias therefore points to the restored file tree, not either transient helper commit.
- These commits changed only the two isolated parser/test files and their deletes; no frontend/API/Pages Function/SQL/migration/runtime configuration/secret files were changed. The transient deployments were still real Pages production-environment build/deploy events and are recorded as such; do not describe the incident as "no production deployment."
- Supabase Preview checks were also triggered on the temporary main commits; the successful checks observed were Preview checks only. No SQL migration file was present in any of the four commits. No Production DDL, Supabase runtime setting, secret, Key, on-chain state or customer data was changed by the incident.
- Feature branch `feat/pay-subscription-billing` remained isolated from those temporary main commits. The code under test is committed to the feature branch using the Git Data tree/commit API and an expected-head ref lease. PR #366 continues to point at feature HEAD `40456d8...`, OPEN/DRAFT/NOT MERGED.

### Remaining blockers and release decision
- Issue #355 remains OPEN. Historical Supabase-linked main-branch migration runner activity is established, but exact actor/trigger and current provider integration deployment toggle remain UNKNOWN. Production DDL remains **BLOCKED**.
- Cantina acknowledged residual High/Medium findings remain a release blocker until explicit, enforceable v1 controls and adversarial tests are approved and demonstrated. In particular `UNKNOWN_INIT_ID` and held init+Subscribe bundles must remain excluded; Durable Nonce and unresolved program-controlled-wallet proposals are out of v1; stale Resume/authority-control approvals and same-second cancellation replay require specific mitigations.
- Backend/API/DB/RBAC/Consent/Accounting contract freeze remains **BLOCKED**.
- Production Subscription API/domain/schema/migrations, Billing worker/lifecycle, isolated Collector signer, dedicated Subscription verifier/atomic accounting, adversarial lifecycle suite, real Subscription transaction E2E and UI remain **NOT IMPLEMENTED**.
- Existing normal Pay verifier/accounting are unchanged.
- Local Working Tree: **UNKNOWN** (remote GitHub connector only).
- **Part 2.2 remains NOT STARTED.**

### Safety / mutations
- Mainnet: only `getGenesisHash` and `getAccountInfo` reads; no transactions, signatures, transfers or Program/Multisig writes.
- Devnet Subscription test: simulation only, no signing/submission. Separate ordinary Pay Devnet E2E workflow run `41172047275` was still in progress at the last check and remains distinct from Subscription testing.
- Production database: no DDL or data mutations.
- Secrets: GitHub Action used existing Mainnet RPC Secret; its value was not read, copied or printed.
- Cloudflare: Pages deployments occurred on temporary main commits and the recovery commit as described above; no Pages configuration, environment binding or Secret was changed.


## 2026-10-31 — Exact-head evidence reconciliation after Squads v4 governance verification

Status: **PASS** for exact-head repository/CI checks, Mainnet ProgramData ↔ reproducible ELF identity, canonical on-chain IDL ↔ pinned source IDL identity, Squads v4 Vault/State relationship and Cantina report/delta review. **Overall Stage 2 remains BLOCKED. Part 2.2 remains NOT STARTED.**

### Repository, branch and PR
- Repository: azad2022/solsite; default branch: main.
- Feature branch: feat/pay-subscription-billing.
- Feature HEAD at this checkpoint: 3960b95e53a2257cf348cd75c1f5238860dcf8e4.
- Tested executable-code commit: 40456d8cf3be34f3d9ecb30ec17d95111ee13be8. Compare 40456d8 → 3960b95 is exactly one commit and one changed path: docs/solmint-pay-progress.md (104 additions, zero deletions). No executable code changed after the tested code commit.
- Current main HEAD: 4d9fa4c356f4619c5d7998e73a196a4a85d24c6f. Compare against the previous baseline 7b975d56860b6d937ad76ab2983c71937644dfa3: four commits ahead, zero changed files. The tracked file tree is restored to baseline, but main history contains the four recorded add/delete commits; do not state that its history was unchanged.
- PR #366: OPEN / DRAFT / NOT MERGED; mergeable=true; base branch main; current head 3960b95. The PR API still reports base SHA 7b975d56860b6d937ad76ab2983c71937644dfa3, while the live main ref is 4d9fa4c356f4619c5d7998e73a196a4a85d24c6f. The PR description was stale at this checkpoint and required synchronization with the new evidence.
- The remote GitHub connector does not expose a local checkout or local status. Working Tree remains UNKNOWN.

### Exact-head CI and workflow evidence
All five latest workflow runs below are completed successfully on exact HEAD 3960b95e53a2257cf348cd75c1f5238860dcf8e4:

| Workflow | Run ID | Result |
|---|---:|---|
| CI | 41172466490 | PASS |
| Production Build | 41172466495 | PASS |
| Database Security | 41172466516 | PASS |
| Mainnet Read-only | 41172466551 | PASS |
| Devnet E2E | 41172466561 | PASS |

CI run 41172466490 contains four successful jobs: quality; subscription-reproducible-build; subscription-sdk-compat (24); subscription-mainnet-programdata. The tested code commit 40456d8 had 27/27 Node tests PASS, TypeScript adapter typecheck PASS, Workerd/Pages runtime 1/1 PASS, and non-mutating Subscription CreatePlan Devnet simulation 1/1 PASS. The exact-head Mainnet ProgramData job then succeeded on 3960b95.

Interpretation limits:
- Database Security PASS covers the existing Pay/database security workflow; it does not prove Subscription schema/RLS exists or was tested.
- Devnet E2E PASS is ordinary Pay's existing funded/mutating Devnet flow, not a Subscription transaction E2E.
- Subscription CreatePlan is simulation-only: it did not sign or submit a Subscription transaction.
- Mainnet Read-only is not a Mainnet write or a Program mutation.

### Mainnet ProgramData and reproducible binary identity
Read-only evidence was collected on Mainnet Beta at finalized commitment. The allowed RPC methods were getGenesisHash and getAccountInfo.

- Genesis hash: 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d.
- Subscription Program ID: De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44.
- ProgramData PDA: HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg.
- Deployment slot: 438440823.
- ProgramData Upgrade Authority: DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv.
- Deployed Mainnet ELF SHA-256: 056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318.
- Reproducible build SHA-256 from pinned source: exactly the same value.
- Result: **PASS — deployed Mainnet ELF ↔ pinned reproducible source build**. This establishes byte/source correspondence only, not absence of vulnerabilities or completion of a security audit.

### Canonical on-chain IDL verification
- Canonical Program Metadata PDA: CCG1hwKFk32h11yE2PRZeEmNAdZsMQrSuiEmqx5eEhWE.
- Program Metadata Program: ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S.
- On-chain IDL SHA-256 and pinned source IDL SHA-256: 1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa.
- Canonical account, owner, authority=null, derivation seed, compression, encoding, format, source, Program key and name were checked.
- Result: **PASS — canonical on-chain IDL ↔ pinned source IDL**. Preserve the version distinction among Program tag program-v0.5.0, Workspace/IDL 0.5.0-beta.1 and TypeScript SDK 0.5.0-beta.2.

### Squads v4 authority governance
- ProgramData Upgrade Authority is the canonical Squads v4 Vault PDA.
- Squads v4 Program ID: SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf.
- Multisig State Account: 4CxQs26DewQ1KaCHfyyjktkYjndNdUqCJvVdygtJFwcJ.
- State owner, discriminator, Borsh layout, State PDA and Vault PDA derivations were validated against pinned Squads v4 source.
- Current configuration: threshold 3 of 5; five members; all five have Initiate/Vote/Execute permission mask 7; config_authority default/zero; timelock 0 seconds.
- Result: **PASS** for the on-chain ProgramData → Squads State/Vault authority relationship and parsed threshold/permissions.
- **UNKNOWN** for real-world identity and custody of the five member keys. Do not attribute them to Solana Foundation, staff or named entities without independent evidence.
- Zero-second timelock is an operational security fact for the threat model. No Proposal was created, signed, approved or executed.

### Cantina report and release delta
- The attached official Cantina report dated 2026-07-30 was reviewed in full on 2026-10-31 (12 pages; text and visual page review).
- Finding matrix: Critical 0; High 1 (Acknowledged); Medium 5 (2 Fixed, 3 Acknowledged); Low 2 (1 Fixed, 1 Acknowledged); Informational 1 (Fixed). Total 9: four Fixed and five Acknowledged.
- Audit baseline: d6b3a5dc7ab18c4168441af733c81ab0a599d414. Remediation marker: debb4f75ff7571218b39de3b633074dd843e70db. Release commit: 364a41976c33347d092902443bbec2def9227e75.
- The eight-commit post-remediation release delta contains no program/src/** changes. It does contain release/workflow/toolchain, IDL, package/dependency/lockfile, SDK/client/test, demo and documentation changes. The absence of Program Rust source paths in this delta does not prove all release/client behavior was covered by the original audit.
- Residual acknowledged risks remain release blockers until explicit enforceable v1 controls and adversarial tests exist. High risk includes old signed Init+Subscribe creates using UNKNOWN_INIT_ID restoring authority after revoke. Other acknowledged risks include same-second CancelSubscriptionNow replay, stale Resume approvals, stale Authority-Control approvals, full-period charging near Plan expiry and automatic rent sponsorship. The Low-risk CreatePlan payer and IDL generation items are recorded as Fixed; do not mislabel acknowledged findings as fixed.
- The zero-second Squads timelock must also be included in the operational threat model.

### Current gate assessment
- **PASS:** exact-head CI/workflows; SDK/runtime compatibility; reproducible Program build; Mainnet ProgramData/ELF/source hash; canonical on-chain IDL/source hash; Squads v4 authority-chain parsing; complete Cantina report review and post-remediation release delta review.
- **BLOCKED:** Stage 2 typed API/domain/DB/RLS/grants/RBAC/Consent/Billing/Collector/Verification/Accounting contract freeze; implementation and adversarial proof of the Cantina residual-risk controls; Issue #355 migration-runner provenance and controlled Production DDL policy; split principal + gateway-fee Subscription charging.
- **UNKNOWN:** local Working Tree; identity/custody of Squads member key holders; exact actor/trigger for Issue #355 and current Supabase GitHub Integration production-deploy toggle.
- **NOT IMPLEMENTED:** production Subscription API/domain/schema/migrations, customer Consent lifecycle, billing worker/cycle processing, atomic billing claim/recovery, isolated Collector signer, dedicated Subscription Verifier/Accounting, lifecycle adversarial tests, real Subscription transaction E2E and Subscription UI.
- Issue #355 is still OPEN. Historical runner activity is established; the exact initiating actor and current integration setting are not established. Production DDL remains prohibited.
- Overall Stage 2 remains **BLOCKED**. Part 2.2 remains **NOT STARTED**.

### Mutation and environment boundary
- Production DDL: none. Production database data mutation: none.
- Cloudflare/Supabase configuration: none changed in this checkpoint.
- Secret/Key values: not read, copied, printed, rotated or changed.
- Collector signer: not created.
- Mainnet Transfer, Program write or Squads proposal: none.
- Subscription Devnet: simulation only, no signing/submission.
- Ordinary Pay Devnet E2E run 41172466561 is a separate existing Pay test and must not be represented as Subscription E2E.
- The earlier main-branch history/Cloudflare Production-environment deployment incident remains fully recorded in the preceding checkpoint; this checkpoint does not erase or minimize those deployment events.


## 2026-10-31 — Subscription v1 Threat Model and Cantina finding reconciliation

Status: **PASS** for creation and cross-linking of a design-level Threat Model on the Subscription feature branch. **BLOCKED** for Stage 2, protocol residual-risk closure, Contract Freeze and Production DDL. **Part 2.2 remains NOT STARTED.**

### Repository and change boundary
- Repository: `azad2022/solsite`.
- Branch: `feat/pay-subscription-billing`.
- Parent baseline for this documentation checkpoint: `5b8d24b3e2a63531313dddb591bd353aa80e98f0`.
- Threat Model creation commit: `2e33f9b39801a0409722d73eee38c57a4d14cfa4`.
- Subsequent documentation commits:
  - `3707ad52dcb10776e11839d20fd6c6fdd3866048` — project instructions link and Cantina count caveat.
  - `9649044bccc305197647e43d07b93d83785fb578` — Subscription Skill link and residual-risk caveat.
  - `4ad153889208a154db66147ff6d9a2b22a97c091` — Release Audit Skill link and release gate.
  - `fd5844862bee8ea59241b0d9218abb823c12cdac` — implementation plan link and protocol-fix caveat.
- Current branch HEAD at time of this checkpoint: `fd5844862bee8ea59241b0d9218abb823c12cdac`.
- PR #366 remains the target PR; its latest head and CI for this new documentation sequence must be re-read after this checkpoint. Earlier exact-head CI on `5b8d24b` was 5/5 successful; those results do not automatically certify these later commits.
- Local Working Tree remains **UNKNOWN**; only remote GitHub operations were available.

### New design artifact
- Added `docs/solmint-pay-subscription-v1-threat-model.md` (design-only; not implementation).
- It maps each detailed Cantina finding to attack path, trust boundary, protocol-level control, SolMint defense-in-depth, backend/database invariant, recovery, adversarial tests, PASS evidence and v1 gate.
- Added cross-cutting controls for Plan Owner and all Pullers, shared Authority/delegate blast radius, Collector compromise, Billing Cycle concurrency and timeout recovery, independent Subscription verification/atomic accounting, Supabase RLS/Grants/Auth, and Squads v4 zero-second timelock monitoring.
- Added a proposed v1 capability matrix. Immediate CancelNow, Resume, finite Plans, authority reauthorization, Durable Nonce, unresolved smart-wallet proposals, rent sponsorship, Collector, split principal+fee and entitlement remain excluded/restricted until their gates are evidenced.
- The matrix is explicitly a proposal; it does not declare any API, DB object, state, instruction or control implemented.

### Material Cantina PDF inconsistency discovered
The full PDF's page-3 summary table reports five Acknowledged findings (High 1, Medium 3, Low 1), four Fixed overall. The detailed finding pages explicitly mark:
- High old signed creates — Acknowledged.
- Medium CancelSubscriptionNow — Acknowledged.
- Medium update_plan — Fixed.
- Medium ResumeSubscription — Acknowledged.
- Medium authority-control — Acknowledged.
- Medium Plan-expiry full-period charge — Acknowledged.
- Low CreatePlan payer/IDL — Fixed.
- Low rent sponsorship — Acknowledged.
- Informational IDL generation — Fixed.

Thus the detailed pages identify six Acknowledged findings (one High, four Medium, one Low) and three Fixed findings, conflicting with the summary's five Acknowledged/four Fixed. This is **UNKNOWN / BLOCKED pending written Cantina/Solana Foundation clarification or a corrected report**. The Threat Model conservatively tracks all six detailed Acknowledged findings. Historical summary counts are preserved; no silent reconciliation is made.

### Critical security conclusion
The High old-signed-create issue cannot be fully fixed by SolMint Backend or transaction-builder policy. Rejecting `UNKNOWN_INIT_ID`, avoiding Init+Subscribe bundles and excluding Durable Nonce/pending proposals are defense-in-depth only. A previously signed transaction created outside SolMint may remain executable. Strong revocation requires upstream protocol-enforced persistent consent epoch/action nonce/deadline state, tombstones/generations as appropriate, and rejection of legacy unbound instruction paths. No such fix is evidenced in the pinned deployed Program. Therefore reliable revocation remains **BLOCKED** for production claims.

### Evidence and test status
- Cantina source: attached 12-page report dated 2026-07-30; full text was re-read from the uploaded PDF for this checkpoint.
- Repository source: project instructions, master frontend specification, Subscription Skill, Build Web Apps Skill, Release Audit Skill, implementation plan and Progress Ledger were read at the prior verified branch HEAD `5b8d24b`; relevant Subscription/Release instructions were linked/updated in this checkpoint.
- Tests executed for this documentation-only checkpoint: **none**.
- CI on the new HEAD `fd5844862bee8ea59241b0d9218abb823c12cdac`: **PENDING / UNKNOWN** until fresh workflow runs complete.
- No code, API, migration, database schema, RLS policy, grant, Secret, key, signer, Cloudflare/Supabase configuration or UI was changed.

### Current gate status
- Threat Model document and cross-links: **PASS** (documentation artifact only).
- Cantina summary/detail finding count: **UNKNOWN / BLOCKED** pending written clarification.
- TM-01 strong revocation: **BLOCKED** pending upstream protocol fix or explicitly approved residual-risk decision; off-chain policy is insufficient.
- TM-02 stale same-second CancelNow: **BLOCKED** for immediate cancellation v1.
- TM-03 stale Resume: **BLOCKED**; Resume excluded from proposed v1.
- TM-04 stale Authority Init/Close/Revoke: **BLOCKED** for reliable lifecycle guarantees.
- TM-05 finite Plan expiry: **BLOCKED**; finite Plans excluded from proposed v1 pending protocol-safe binding.
- TM-06 rent sponsorship: **NOT IMPLEMENTED / disabled by proposed v1 policy**.
- Plan Owner/other Puller reconciliation, isolated Collector, dedicated verifier/accounting and DB/RLS controls: **NOT IMPLEMENTED**.
- Issue #355: **OPEN**; actor/trigger and current Supabase integration state remain **UNKNOWN**; Production DDL remains **BLOCKED**.
- Stage 2: **BLOCKED**. Part 2.2: **NOT STARTED**.

### Production / blockchain mutation statement
No Production DDL or data mutation; no Cloudflare/Supabase configuration change; no Secret/Key read, copy, rotation or mutation; no Collector signer creation; no Mainnet transaction or Program mutation; no Squads proposal; no live customer consent. No Devnet mutation was performed in this checkpoint.


## 2026-10-31 — TM-01 pinned Program source verification

- Branch: `feat/pay-subscription-billing`; reviewed code-evidence HEAD: `683f77080fb315fdbfde690ea91796d9dbd2e1a1`. Main latest commit rechecked as `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f`. PR #366 OPEN / DRAFT / NOT MERGED.
- Exact-head CI evidence on `683f77080fb315fdbfde690ea91796d9dbd2e1a1`: CI 41185754249, Production Build 41185754239, Database Security 41185754248, Mainnet Read-only 41185754256, ordinary Pay Devnet E2E 41185754225 — all completed SUCCESS. These are existing workflow results, not Subscription billing E2E.
- Pinned Program source inspected at `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`: `program/src/instructions/subscribe.rs`, `program/src/instructions/initialize_subscription_authority.rs`, `program/src/state/subscription_authority.rs`, and upstream README Security Considerations.
- Verified mechanics: Subscribe calls `check_init_id`; `UNKNOWN_INIT_ID` is resolved to the current `Clock::slot`. A fresh Authority initialization stores current slot as `init_id` when the PDA is newly created and invokes Token Approve for `u64::MAX`. Therefore an old signed Init+Subscribe transaction using the sentinel can execute after a prior authority close/revoke, recreate the Authority/delegate and pass Subscribe in the same landing slot. The Program has no transaction-signed-at deadline or durable monotonic revocation epoch in this path.
- Deployed Mainnet ELF was previously verified byte-identical to the reproducible build of this pinned source. Thus the source-level behavior applies to the inspected deployed binary. This is a protocol finding, not a speculative backend bug.
- SolMint tree at `683f77080fb315fdbfde690ea91796d9dbd2e1a1` contains the pure Plan validator `src/pay/services/subscriptionPlanPolicy.ts`, its unit tests and an SDK compatibility harness. No actual Subscription API route, customer Consent/Authority lifecycle, Subscribe signing/submission flow, Collector or Subscription verifier/accounting path exists. The current SolMint product therefore has no implemented Subscription flow exposing this attack surface.
- Decision: **BLOCKED** for a claim of strong/instant revocation with the pinned Program. Off-chain defense-in-depth for a future restricted v1: reject `UNKNOWN_INIT_ID`, separate Init and Subscribe, read the finalized actual `init_id`, use recent blockhash only, and exclude Durable Nonce/pending smart-wallet proposals. These controls reduce SolMint-created stale approvals but cannot invalidate externally created/held instructions. True protocol closure requires persistent, non-closable monotonic authority epoch/action nonce/deadline checks and rejection of legacy unbound instruction formats in an approved Program upgrade.
- No runtime code or tests changed/run in this checkpoint. Exact-head workflows listed above were revalidated as completed SUCCESS.
- Scope decision per owner: Issue #355 is deferred from the active Subscription work sequence; it is not declared closed/resolved. No Production migration/DDL is part of this checkpoint.
- Mutation boundary: no database or provider configuration change, no Secret/Key/signer change, no Devnet/Mainnet transaction, no Program upgrade, no customer consent. Only this Progress Ledger entry is being committed on the feature branch.


## 2026-10-31 — TM-03 Resume replay and TM-04 Authority lifecycle review

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; parent HEAD: `4266760fcb854bb9a204a8b7f4f329cb984ac815`; PR #366 remains OPEN / DRAFT / NOT MERGED. Working Tree remains UNKNOWN through remote connector.
- Pinned upstream source: `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`. Read `resume_subscription.rs`, `cancel_subscription.rs`, `initialize_subscription_authority.rs`, `close_subscription_authority.rs`, `revoke_subscription_authority.rs` and the associated LiteSVM integration tests.

### TM-03 — Resume replay
- **Confirmed mechanism:** `ResumeData` carries only `expected_expires_at_ts`; Program verifies equality with current `expires_at_ts`, plan terms and shared Authority `init_id`, then clears expiry to zero. Cancel recomputes expiry from the current period start and fixed period length. Two cancellations within the same period can therefore produce the same expiry E.
- **Attack sequence:** sign/withhold Resume for E; another action clears the first cancellation; cancel again in the same period (expiry remains E); submit old Resume while still executable. It can satisfy the equality and clear the newer cancellation, re-enabling future collection. Cantina's report records a Durable Nonce reproduction. Recent blockhash policy narrows but does not eliminate the Program-level replay condition.
- Existing upstream `test_resume_subscription.rs` checks stale expiry after advancing beyond the prior period (e.g. two hours); it does not cover the same-period repeated-expiry replay. The source test was inspected, not executed in this checkpoint.
- SolMint source search found no `resumeSubscription`, `ResumeSubscription`, `getResumeSubscriptionOverlayInstruction` or `resume_subscription` product API/builder surface on the default code branch; current feature code is documentation-only after the tested code baseline. No actual Resume UI/API/job exists in SolMint.
- **Decision:** Resume is excluded entirely from SolMint v1 (no route/API/UI/job/builder; no reversible cancellation promise). This does not disable the upstream instruction for external clients. Strong protocol closure requires a monotonic cancellation/action revision plus persistent incarnation that survives Subscription PDA close/recreate, with legacy revision-less Resume disabled.

### TM-04 — Authority Init/Close/Revoke replay
- `InitSubscriptionAuthority` invokes Token `Approve(u64::MAX)` even if the Authority PDA already exists; a held old Init can therefore re-approve a delegate after manual SPL revoke.
- Close/Revoke instructions do not carry or verify an expected authority generation. The shared helper checks owner and deterministic PDA, not a signed generation. An old Close/Revoke may therefore act on the same PDA after close/recreate and damage the newer Authority lifecycle.
- Existing upstream Close/Revoke tests cover ordinary close, owner/payer checks, token delegate clearing and idempotent Init; they do not evidence replay rejection for held signed actions across generations. Source tests were inspected, not executed here.
- **Decision:** no automatic Init retry/reapproval, no reauthorization repair when an existing Authority lacks its delegate, and no v1 self-service guarantee of permanent shared-authority revocation/re-authorization. Reconcile exact signatures and finalized Authority/ATA state. Protocol closure requires a persistent non-closable authority epoch/action nonce plus expected delegate-state checks and disabling all legacy unbound Init/Close/Revoke formats.

### Documentation changes
- Updated `docs/solmint-pay-subscription-v1-threat-model.md` with source-level mechanics, attack sequences, current test-coverage limitations, v1 exclusions, recovery and future protocol fix requirements.
- Updated `docs/skills/solmint-pay-subscriptions/SKILL.md` with mandatory Resume and Authority lifecycle restrictions.
- Threat Model commit: `4d2ba9797849dcd1c1ffe59b133af58c31bee463`.
- Subscription Skill commit: `4266760fcb854bb9a204a8b7f4f329cb984ac815`.
- No runtime code, API contract, database schema, migration, RLS/grant, signer or UI was changed. No test commands executed; upstream source/tests were read only.
- Previous exact-head CI on parent `14e07352a67bfdce24afde1165c354785eb9cd54` passed all five workflows; this is not exact-head CI for the documentation commits in this checkpoint. Fresh CI must be checked on the final ledger commit.
- Issue #355 remains deferred from the active Subscription task sequence per owner direction; not declared closed or resolved.
- Stage 2 remains **BLOCKED**. Part 2.2 remains **NOT STARTED**. TM-03 and TM-04 have design-level v1 exclusions recorded, not protocol fixes.

### Mutation boundary
No Production DDL/data mutation, no provider/configuration change, no Secret/Key/signer change, no Devnet/Mainnet transaction, no Program upgrade or customer consent. Only Threat Model, Subscription Skill and Progress Ledger documentation were changed on `feat/pay-subscription-billing`.


## 2026-10-31 — TM-05 finite Plan near-expiry full-period charge review

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; parent review HEAD: `5149057f0ac2c11305d2e884d078a61b1b493c92`; PR #366 remains OPEN / DRAFT / NOT MERGED. Main HEAD was rechecked as `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f`. The branch was re-resolved before this checkpoint; all documentation changes were kept on the feature branch.
- Pinned source reviewed: `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`: `subscribe.rs`, `update_plan.rs`, `transfer_subscription.rs`, `helpers/transfer_validation.rs`, `state/common.rs`, `test_subscribe.rs`, `test_update_plan.rs` and upstream README Security Considerations.

### TM-05 — confirmed mechanics

- `SubscribeData` binds mint, amount, period, Plan `created_at` and Authority `init_id`; it does not bind `end_ts`. Subscribe rejects only when `current_ts > end_ts`, so equality is accepted; it does not require one complete period remaining.
- UpdatePlan validates a changed finite end against `current_ts + period_seconds` at update execution. Exact one-period equality passes. A finite end may be shortened, so elapsed time after that update can leave less than one full period by the time a delayed Subscribe lands.
- TransferSubscription rejects only after `plan_end_ts`, applies a per-period amount ceiling, and caps the emitted `period_end_ts` at Plan end. The transfer validator does not prorate by remaining seconds. An authorized Puller may request the full period amount for a partial/zero-length window at the boundary; this is not an automatic debit on Subscribe.
- The pinned README explicitly documents full amount for a partial or zero-length first window and the missing expected-end binding. Upstream `test_subscribe.rs` covers normal and already-expired Plans, not the inclusive boundary or post-consent shortening race. `test_update_plan.rs` allows shortening 30 days to 10 days for a 24-hour period. `transfer_validation.rs` includes a full-amount transfer at exact expiry. Sources/tests were inspected, not executed.

### SolMint code boundary and decision

- `src/pay/services/subscriptionPlanPolicy.ts` uses `bigint` and cluster time and rejects finite `endTs` below `chainTime + periodHours * 3600`; exact equality is accepted. It is Plan-input validation only and cannot bind a later Subscribe to the same end time or close a Plan-update/transaction race.
- At this HEAD no production Subscription API, customer consent flow, Subscribe builder/submission path, Collector, or Subscription verifier/accounting exists. Therefore the helper does not constitute an enforced enrollment control.
- **Decision:** exclude all finite Plans from SolMint Subscription v1; the intended design profile is the verified perpetual representation (`end_ts = 0`). Do not treat a one-period preflight or consent display as a protocol fix. Finite support requires an approved Program change to bind expected `end_ts`, enforce a full first period atomically, and define/enforce final-period rejection or an approved integer proration rule.
- Updated the Threat Model, Subscription Skill, Build Web Apps Skill, Release Audit Skill, project instructions and implementation plan with the exact source behavior, the test-coverage gaps and the hard v1 restriction. No runtime code or API/DB/UI was changed.

### Verification and status

- Source review/documentation checkpoint: **PASS**.
- Finite Plan full-period guarantee in pinned Program: **BLOCKED** pending protocol-level expected-end binding and first/final period rules.
- Enforced v1 finite-Plan exclusion in a live product/API: **NOT IMPLEMENTED**; no production Subscription enrollment path currently exists.
- Upstream tests reviewed but not executed. No new tests were added or run in this checkpoint.
- Exact-head CI on parent `5149057f0ac2c11305d2e884d078a61b1b493c92`: CI `41218686082`, Production Build `41218685997`, Database Security `41218685992`, Mainnet Read-only `41218686071`, ordinary Pay Devnet E2E `41218686262` — all completed SUCCESS. These are parent-HEAD checks; fresh workflows for the documentation commits below must be checked and must not be inferred PASS.
- Documentation commits preceding this ledger update: `fdf700aea591a36ed796b9b4d98cc45b32f3b081` (`docs/solmint-pay-subscription-v1-threat-model.md`); `3034b8cfb8a2ac98498babe5a796c4bf790e44fb` (`docs/skills/solmint-pay-subscriptions/SKILL.md`); `caceb84a57dbc3907df4590d74b22d101de1b081` (`docs/skills/solmint-pay-build-web-apps/SKILL.md`); `7f9f127e1159e80b25d3a876cf08fc2f6b98228a` (`docs/skills/solmint-pay-release-audit/SKILL.md`); `8ad7eb8872e5d57d4e681fd7cc1b37cfae0b3810` (`docs/solmint-pay-project-instructions.md`); `b61b454c07329dc1fe0aeb7c5db6d52f02052263` (`docs/solmint-pay-subscription-implementation-plan.md`). This ledger entry is included in the final commit containing this checkpoint.
- Issue #355 remains deferred from the active sequence per owner direction; it is not closed/resolved. No Production DDL or data mutation occurred.

### Mutation boundary

No runtime code, API contract, database schema, migration, RLS/grant, Cloudflare/Supabase configuration, Secret/Key, Collector signer, Mainnet/Devnet transaction, Program upgrade, Squads proposal or customer consent was changed or created. Documentation-only changes were committed to `feat/pay-subscription-billing`.

## 2026-10-31 — TM-06 rent sponsorship and indefinite relayer capital lock review

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; parent checkpoint HEAD before the final ledger entry: `1bfdf698d3c542b91c80cb39d1836bb0e50651b2`. Main HEAD rechecked as `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f`. PR #366 remains OPEN / DRAFT / NOT MERGED; its branch HEAD was updated through documentation-only commits. Working Tree is UNKNOWN through the remote GitHub connector.
- Read the current Project Instructions, Master Specification, Subscription Skill, Build Web Apps Skill, Release Audit Skill, Implementation Plan, Threat Model and Progress Ledger from `feat/pay-subscription-billing`. Current feature HEAD before ledger update contained only documentation changes after tested executable-code commit `40456d8cf3be34f3d9ecb30ec17d95111ee13be8`.

### Cantina finding and pinned SDK behavior

- The attached Cantina report (2026-07-30), detailed finding 3.3.2, classifies automatic rent sponsorship as **Low Risk / Acknowledged**. It says the TypeScript plugin defaults a distinct `client.payer` into optional payer accounts for Authority, delegation, Subscription and Plan creation. The report says this turns a fee payer into a long-lived capital provider, permits many sponsored PDAs, and has no explicit sponsor acknowledgment in the convenience path.
- Pinned source reviewed at `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`: `clients/typescript/src/plugin.ts`, `clients/typescript/README.md`, `program/src/instructions/create_plan.rs`, `helpers/plan.rs`, `helpers/system.rs`, `initialize_subscription_authority.rs`, `close_subscription_authority.rs`, `helpers/authority.rs`, `revoke_subscription_authority.rs`, `revoke_delegation.rs`, `revoke_abandoned_delegation.rs`, `revoke_abandoned_subscription.rs`, `delete_plan.rs`, `state/header.rs`, `state/plan.rs`, `state/subscription_authority.rs`, `state/fixed_delegation.rs`, `state/recurring_delegation.rs` and `state/subscription_delegation.rs`.
- `plugin.ts` automatically sets optional instruction `payer` to `client.payer` for `createFixedDelegation`, `createPlan`, `createRecurringDelegation`, `initSubscriptionAuthority` and `subscribe` whenever `client.payer !== client.identity`, unless an explicit instruction payer is supplied. The TypeScript README explains that the distinct signer sponsors rent, and that the caller can avoid rent sponsorship by setting the instruction payer to the user while leaving `client.payer` as transaction fee payer. The README clarification does not remove the plugin's runtime default.
- No exact rent-exempt SOL/lamport amount was calculated. No live rent quote or sponsored transaction was performed.

### Confirmed recovery behavior by account type

- **SubscriptionAuthority:** The original payer is stored only at first creation; idempotent Init preserves it. Only the user can close/revoke the shared Authority. When it was sponsor-funded, the user must provide the recorded payer as the matching rent receiver. Sponsor receives rent only if/when the user initiates close/revoke; sponsor cannot force-close a healthy Authority without risking live subscriptions.
- **Fixed delegation:** The delegator can close at any time. Sponsor can close only after a non-zero expiry has elapsed or the fixed amount is fully spent (`amount == 0`). A non-expiring fixed delegation with remaining allowance cannot be closed by sponsor through ordinary revoke.
- **Recurring delegation:** Sponsor can close through ordinary revoke only after a non-zero expiry elapsed. A non-expiring recurring delegation requires a terminal/rotated Authority and the `RevokeAbandonedDelegation` path.
- **Subscription delegation:** Sponsor can close after cancellation expiry, Plan closure, natural finite Plan end or Plan recreation with incompatible terms. An active Subscription on a perpetual Plan has no natural end-time recovery. `RevokeAbandonedSubscription` requires the matching Authority to be closed past its recorded slot or a changed `init_id`; if the Plan itself is closed, ordinary `RevokeDelegation` is the applicable path.
- **Plan PDA:** CreatePlan can accept optional sponsor payer, but the Plan owner remains the Merchant. `DeletePlan` returns lamports to the Plan owner, not the sponsor, and only works for non-zero `end_ts` after expiry. A perpetual `end_ts = 0` Plan cannot be deleted by the v0.5.0 DeletePlan instruction. Plan sponsorship is therefore a merchant subsidy/transfer, not refundable sponsor capital.
- These are lifecycle-gated recovery paths, not a universal refund mechanism, time-bound sponsor claim or quota. Healthy customer-controlled Authority/subscription state can keep sponsor capital unavailable indefinitely. Plan rent has a different destination.

### Existing upstream test source coverage — inspected only

- `test_initialize_subscription_authority.rs`: sponsor payer recorded; idempotent Init preserves original payer.
- `test_close_subscription_authority.rs`: user closes sponsor-funded Authority with matching receiver; missing/wrong receiver fails; second sponsor cannot replace the original payer.
- `test_revoke_delegation.rs`: sponsor reclaim for expired fixed/recurring, fully-spent fixed, cancelled+expired subscriptions and terminal Plans; sponsor rejected for non-expired/no-expiry delegations and active subscriptions.
- `test_revoke_abandoned_delegation.rs`: no-expiry fixed/recurring reclaim after Authority close or `init_id` rotation; same-slot, live-authority, wrong-authority and non-sponsor cases rejected.
- `test_revoke_abandoned_subscription.rs`: subscription rent reclaimed after Authority close/rotation; same-slot, live-authority and non-sponsor cases rejected.
- `test_create_plan.rs`: sponsor pays Plan rent while Merchant remains owner. `test_delete_plan.rs`: owner receives rent on deletion. These separate tests plus source behavior establish the refund destination; the inspected tests do not constitute a single end-to-end sponsored-create→delete refund-destination test.
- These upstream integration tests were read only. They were **not executed** in this checkpoint.

### SolMint boundary and v1 decision

- Root SolMint `package.json` does not depend on `@solana/subscriptions`; pinned SDK v0.5.0 is isolated in `tools/subscription-sdk-compat`. Existing feature branch code includes a Plan-input policy helper and SDK compatibility harness, but no production Subscription transaction builder/API, Collector sponsorship path, sponsor ledger, per-user/aggregate quota, exposure monitor or sponsor recovery worker.
- This is a confirmed upstream SDK/Program risk, not evidence that SolMint currently sponsors customer rent.
- **V1 policy:** no SolMint-funded customer or Plan rent. Customer funds their own Authority/Subscription/delegation PDAs; Merchant funds its Plan PDA; Collector/Relayer pays network transaction fees only. Explicitly set instruction-level payer to the account owner; do not infer it from `client.payer`.
- A future sponsorship proposal requires separate approval, explicit opt-in per created account, per-account cap, atomically enforced per-user and aggregate exposure quotas, payer→PDA/refund ledger, monitoring/kill switch and an enforceable recovery path before any sponsor funds are committed. Plan sponsorship remains prohibited unless refund destination is redesigned/approved.

### Status and mutation boundary

- Pinned plugin/Program sponsorship and per-account recovery behavior: **PASS — source reviewed**.
- Cantina finding closure / removal of SDK auto-sponsor behavior: **BLOCKED**; the README clarification is not a runtime opt-in or enforceable universal recovery.
- SolMint production rent-sponsorship path: **NOT IMPLEMENTED**.
- SolMint v1 rent sponsorship: **NOT IMPLEMENTED / DISABLED BY POLICY**; no live Subscription path exists yet, so this is not an enforced runtime gate.
- No tests were executed and no tests were changed in this checkpoint. No runtime code, API contract, DB schema/migration, RLS/grant, provider configuration, Secret/Key, Collector signer, Mainnet/Devnet transaction, Program upgrade, Squads proposal or customer consent was changed. Documentation-only changes were committed on `feat/pay-subscription-billing`.


## 2026-10-31 — TM-06 upstream Rent Sponsor tests: exact-pinned-commit execution evidence

- Follow-up to the preceding TM-06 checkpoint, which recorded the Rust/LiteSVM source tests as inspected but not executed. The exact pinned upstream source commit was checked against public GitHub Actions history: `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`.
- Upstream workflow `Test`: run `30919854748`, event `push`, completed **SUCCESS** on 2026-08-04 at the same exact commit. URL: https://github.com/solana-foundation/subscriptions/actions/runs/30919854748.
- Workflow jobs:
  - `unit-test`: job `92027298744`, SUCCESS; logs report **59 passed, 0 failed**.
  - `rust-integration-test`: job `92027298793`, SUCCESS. At the pinned `.github/workflows/test.yml`, it runs `just integration-test`; the pinned `justfile` builds the SBF Program/test-hook and executes `cargo test -p tests-subscriptions`. Job log reports **274 passed, 0 failed, 0 ignored** in 15.98s.
  - `typescript-integration-test`: job `92027298813`, SUCCESS.
- The integration test crate's `src/lib.rs` includes all seven Rent-relevant modules: `test_close_subscription_authority`, `test_create_plan`, `test_delete_plan`, `test_initialize_subscription_authority`, `test_revoke_abandoned_delegation`, `test_revoke_abandoned_subscription`, and `test_revoke_delegation`. The Rust job logs include 86 individual successful test output lines across these seven modules. Specific observed coverage includes sponsor-funded Authority/Plan creation, original payer preservation, exact receiver validation, sponsor recovery after fixed/recurring expiry or full-spent fixed allowance, rejection of live/non-expired/no-expiry cases, abandoned delegation/subscription recovery after Authority close/rotation, same-slot and live-authority rejection, cancellation/Plan terminality, wrong Plan/non-sponsor rejection and subscriber rent routing.
- This is official upstream exact-commit CI execution evidence, not a test run newly launched from this ChatGPT container. A local clone attempt was blocked by DNS/network access; no Rust toolchain/Cargo is installed in this container. We therefore do not claim a local rerun. The exact upstream CI job proves these files have been executed and passed at the pinned source SHA.
- **Remaining narrow upstream coverage gap:** `create_plan_gasless_sponsor_funds_rent` and `delete_plan_happy_path` pass independently, but there is no single combined test asserting that after a sponsor-funded Plan is expired/deleted, rent is credited to Merchant rather than sponsor. The Program source `delete_plan.rs` closes to the Plan owner. This is not implemented in upstream by us. SolMint v1 explicitly prohibits Plan rent sponsorship, so this gap does not block v1; the restriction must remain in place.
- Threat Model TM-06 updated to distinguish actual executed evidence from prior source-only review and to record this precise limitation. No code/test files were edited; no test workflow was triggered or rerun by us.
- SolMint repository remains `azad2022/solsite`, `feat/pay-subscription-billing`; PR #366 OPEN / DRAFT / NOT MERGED. No Production DDL/data, provider configuration, Secret/Key, signer, Mainnet/Devnet transaction, Program upgrade, customer consent or cost-bearing external service was used in this follow-up.
- Status: upstream Rent Sponsor Rust integration tests at the pinned source commit **PASS**; local rerun in this container **BLOCKED** by unavailable Rust toolchain/network; direct combined sponsored-Plan-create→delete refund test upstream **NOT IMPLEMENTED**; SolMint v1 rent sponsorship remains prohibited by policy.


## 2026-10-31 — TM-06 cost-responsibility correction: no platform-funded Rent or network fees

- Owner decision: SolMint is an intermediary gateway; all on-chain Rent and transaction network fees attributable to Subscription operations must be paid by the Customer or Merchant. SolMint revenue is limited to the already-approved gateway commission. No new commission rate, fee formula, pass-through markup, API field or accounting rule is invented here.
- Corrected the earlier TM-06 wording that allowed Collector/Relayer to pay network fees. That would have left a cost on SolMint and conflicted with the owner decision.
- V1 cost allocation recorded:
  - Customer funds their own `SubscriptionAuthority` and Subscription/delegation Rent, and pays network fees for customer-initiated setup/control operations.
  - Merchant funds Plan Rent and network fees for Plan operations.
  - Recurring `TransferSubscription` pulls are Merchant billing operations; their transaction fee payer must be a Merchant-owned or explicitly Merchant-funded signer.
  - Collector may sign as a separately authorized Plan Puller but must not be the fee payer from SolMint-funded SOL. If the Merchant-funded fee payer is unavailable, do not submit the pull.
- Rent payer, network fee payer, Puller and token source authority remain distinct principals. Never infer Rent sponsorship from `client.payer`; do not use a SolMint treasury/gas tank or platform-funded Collector balance. Any fee source must be demonstrably Customer/Merchant funded before submission.
- Updated Threat Model, Subscription Skill, Build Web Apps Skill, Release Audit Skill, Project Instructions and Implementation Plan. This reconciles the TM-06 policy with the owner decision and replaces the earlier “Collector pays network fee” wording.
- No runtime code, API, DB schema/migration, RLS/grants, signer, blockchain transaction or accounting implementation changed. Fee-payer enforcement remains **NOT IMPLEMENTED** because the production Subscription transaction/billing path does not exist; this is a mandatory v1 implementation gate, not a delivered capability.
- Parent docs HEAD before this ledger entry: `c92de3aa1436a514e4eb6fdd18f2d719fa8c536b`. PR #366 remains OPEN / DRAFT / NOT MERGED; no merge or release action.

## TM-06 TypeScript SDK payer layout test execution evidence

- Expanded inspection of the exact upstream `Test` run `30919854748` / TypeScript integration job `92027298813` at Program/SDK commit `364a41976c33347d092902443bbec2def9227e75`.
- Pinned `.github/workflows/test.yml` calls `just test-client`; pinned `justfile` runs the TypeScript suite against a local Surfpool fork, then an offline local pass. The job log reports 12 test files / 66 tests passed; the offline pass reports 1 test passed.
- `clients/typescript/test/create-plan-payer.test.ts` is included and reports 2 tests passed. It verifies that an explicit CreatePlan payer is appended as the sixth account meta with `WRITABLE_SIGNER` role and that the optional payer is omitted when not provided.
- This is instruction-builder account-layout coverage. It does **not** directly test the plugin's convenience default that injects `client.payer` when it differs from `client.identity`; that behavior was verified in the pinned `clients/typescript/src/plugin.ts` source. No dedicated test for that auto-default path was found in the files reviewed.
- These were historical successful upstream Actions logs at the exact pinned commit; no job was triggered or rerun in this session. The local Surfpool fork/offline run is not a Mainnet/Devnet transaction and did not charge SolMint an on-chain fee.
- Threat Model TM-06 now records Rust and TypeScript test execution evidence separately and preserves the plugin-default coverage limitation. No runtime or test code was modified.

## TM-06 combined sponsored-Plan refund regression — implementation checkpoint

- Revalidated base PR head: `285cab0ecd1f9e39b6fd67c29afc1d4dfee099e8`; branch: `feat/pay-subscription-billing`; PR #366 remains OPEN / DRAFT / NOT MERGED. The local Working Tree cannot be observed through the remote GitHub connector and remains UNKNOWN.
- Canonical upstream permission check: `solana-foundation/subscriptions` is readable but the active GitHub connection reports `push: false`. No upstream branch, commit, PR or canonical source modification is claimed.
- Added `tools/subscription-upstream-tests/tm06-sponsored-plan-refund.patch`. It overlays one new LiteSVM regression test and its module registration onto exact upstream source SHA `364a41976c33347d092902443bbec2def9227e75`; no upstream Program instruction/source/IDL/dependency is patched.
- Regression test name: `sponsored_plan_rent_is_refunded_to_merchant_on_delete_not_sponsor`. It uses Merchant as transaction fee payer for both transactions and Sponsor only as the CreatePlan instruction-level Rent payer. It asserts the Plan's owner, exact sponsor Rent debit, Merchant's signature-fee-only creation debit, Merchant's Rent refund on delete (net of its own deletion signature fee), and no refund to Sponsor.
- Added dedicated CI job `subscription-tm06-sponsored-plan-refund`: exact SolMint PR checkout + exact pinned upstream checkout, SHA assertions, `git apply --check`, two-file-only overlay scope assertion, pinned Rust 1.92 / Solana 4.0.0 setup, and execution via `just integration-test sponsored_plan_rent_is_refunded_to_merchant_on_delete_not_sponsor`. No secrets or RPC endpoints are used.
- Threat Model TM-06 now distinguishes the still-missing canonical upstream test from the SolMint-maintained pinned-source regression overlay.
- **Regression execution — PASS:** On SolMint PR HEAD `e65f0b9439de7ab61597ebbf13bb60a5109fb365`, GitHub Actions CI run [41222450825](https://github.com/azad2022/solsite/actions/runs/41222450825), job `124599658588`, completed SUCCESS. The log contains `test test_tm06_sponsored_plan_rent_refund::sponsored_plan_rent_is_refunded_to_merchant_on_delete_not_sponsor ... ok` and `test result: ok. 275 passed; 0 failed; 0 ignored`. This is the exact pinned Program + test-only overlay; the previous upstream baseline at the same source SHA had 274 passing Rust integration tests.
- The dedicated job's exact-SHA checkout, patch apply check, two-file-only overlay scope check, pinned Rust 1.92 / Solana 4.0.0 setup, test command, and cleanup all completed successfully. The first attempt on parent commit `f88aa01a31a1628a15ccc32b748e300ab90a5cf7` stopped at the overlay file-list comparison due to an incorrectly escaped printf newline; no Rust test ran in that attempt. The CI shell comparison was corrected in `e65f0b9439de7ab61597ebbf13bb60a5109fb365`, after which the entire integration crate passed.
- All five SolMint workflows on exact HEAD `e65f0b9439de7ab61597ebbf13bb60a5109fb365` completed SUCCESS: CI [41222450825], Production Build [41222450775], Database Security [41222450910], Mainnet Read-only [41222450822], and existing ordinary Pay Devnet E2E [41222450794]. CI's other jobs also passed: `quality`, `subscription-sdk-compat (24)`, `subscription-reproducible-build`, and `subscription-mainnet-programdata`.
- The regression itself is LiteSVM-only and made no RPC/Devnet/Mainnet call. The ordinary Pay Devnet E2E is a separate existing workflow.
- Canonical upstream remains unchanged; the combined test remains **NOT IMPLEMENTED upstream** pending upstream maintainer acceptance. The SolMint-maintained exact-pinned-source regression gate is **PASS**.
- No Production DDL/data, Supabase/Cloudflare config, Secret/Key, signer, Devnet/Mainnet transaction, Program upgrade, or customer consent was changed. No runtime Pay code/API/DB/UI was changed.



## 2026-11-03 — Subscription domain/lifecycle contract design draft (G2 partial)

- Revalidated exact feature HEAD `8109532f8402bdb72dd3e0ab5ea8572dedd66481`, PR #366 OPEN / DRAFT / NOT MERGED, and current exact-HEAD CI. All five workflows were SUCCESS on `8109532f8402bdb72dd3e0ab5ea8572dedd66481`: CI, Production Build, Database Security, ordinary Pay Devnet E2E and Mainnet Read-only. CI included `subscription-tm06-sponsored-plan-refund`, `subscription-sdk-compat`, reproducible Program build and Mainnet ProgramData verification.
- Completed a focused read-only inventory of the current Pay authorization policy, identity/RLS bridge, Payment Intent route, verification/reconciliation code, existing ledger foreign keys and live Production function/policy/grant definitions.
- Production read-only inventory on 2026-11-03: project ACTIVE_HEALTHY; 106 migration records with latest `20261029140401`; 52 public base tables, 33 `pay_*` base tables, no Subscription-named public base table. No DDL or data mutation was made.
- Confirmed that current Payment Intent transaction/transfer/merchant/revenue/referral/gas accounting is linked to Payment Intent IDs. The live `pay_apply_verified_observation` is service-role-only, PaymentIntent-bound and requires the Merchant/fee source authorities to match each other and the transaction fee payer. It is structurally incompatible with the Subscription PDA source authority and distinct Customer/Merchant-funded transaction fee payer. Existing Pay verifier remains unchanged.
- Inspected exact upstream source `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`: PlanStatus is Active/Sunset; Plan Owner is always a Puller; SubscriptionAuthority is shared per Customer+Mint and approves `u64::MAX`; SubscriptionDelegation stores an on-chain terms snapshot, current period start, cumulative pulled amount and cancellation expiry. Ordinary Cancel is period-boundary cancellation; Sunset blocks new Subscribe but does not itself stop existing pulls; perpetual Plans cannot be deleted by v0.5.0 DeletePlan.
- Added `docs/solmint-pay-subscription-contract-design.md` as a design-only domain/lifecycle draft. It separates Plan, Consent, Authority, Subscription, Cycle, Attempt, pull observations, accounting, entitlement and outbox; sets out principal/cost, verification/accounting and authorization boundaries; records open product/security decisions and G2 exit criteria. It intentionally defines no SQL object names, API routes/payloads, migration or runtime enum.
- G0 read-only Contract Inventory segment: PASS. Overall G0 remains BLOCKED by the unresolved G0 evidence tasks in the Threat Model (including authoritative Cantina discrepancy clarification and migration-runner provenance). G1 residual-risk approval: NOT RECORDED. G2 Contract Freeze: PARTIAL / BLOCKED. Subscription runtime/API/DB/Collector/Verifier/Accounting/Entitlement/UI remain NOT IMPLEMENTED.
- No tests or new CI run are claimed for this design draft. A new exact-head CI run is required after the documentation commit. No Production DDL/data, Supabase/Cloudflare config, Secret/Key, signer, Devnet transaction, Mainnet transaction, Program upgrade, customer Consent or funds were changed.


## 2026-11-03 — Contract draft exact-HEAD CI validation

- The design-only commit `994eaf14aabd948aa5bb5312082beb635f68a187` was checked by GitHub Actions after the document commit. Exact-head CI run [41705111324](https://github.com/azad2022/solsite/actions/runs/41705111324) completed SUCCESS.
- The exact-head CI jobs all completed SUCCESS:
  - `quality` — job `126158227589`
  - `subscription-sdk-compat (24)` — job `126158227662`
  - `subscription-reproducible-build` — job `126158227210`
  - `subscription-tm06-sponsored-plan-refund` — job `126158227949`
  - `subscription-mainnet-programdata` — job `126158983595`
- The TM-06 job reapplied the two-file test-only overlay to exact upstream Program SHA `364a41976c33347d092902443bbec2def9227e75`, checked the overlay scope, and ran the Rust integration crate. Log: `running 275 tests`; the regression `test_tm06_sponsored_plan_rent_refund::sponsored_plan_rent_is_refunded_to_merchant_on_delete_not_sponsor ... ok`; final result **275 passed, 0 failed, 0 ignored** (14.43s).
- Exact-head external workflows also completed SUCCESS: Production Build [41705111568], Database Security [41705111546], ordinary Pay Devnet E2E [41705111411], and Mainnet Read-only [41705111409]. Devnet E2E is the existing ordinary Pay flow, not a Subscription transaction. Mainnet checks are read-only. Cloudflare Pages check SUCCESS; Supabase Preview was SKIPPED as expected.
- These runs validate the design/document commit and existing code. They do not implement a Subscription route, schema, worker, signer, verifier, accounting, or UI.
- No Production DDL/data, Supabase/Cloudflare provider configuration, Secret/Key, signer, Mainnet or Devnet transaction, Program upgrade, customer Consent or funds were changed. No application runtime code was changed.
- Contract status remains: G0 inventory segment PASS; overall G0 BLOCKED; G1 approval NOT RECORDED; G2 PARTIAL / BLOCKED. Subscription production functionality remains NOT IMPLEMENTED.


## 2026-11-04 — TM-07 same-transaction multi-pull allowance and rollback — PASS

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; PR #366 remains OPEN / DRAFT / NOT MERGED. Exact tested PR HEAD: `63a30f09d28ac069edef161fc6ce8ec67b1294e3`; PR base snapshot: `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- Regression target: exact pinned upstream Program `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`. SolMint maintains a test-only patch overlay at `tools/subscription-upstream-tests/tm07-atomic-split-transfer.patch`; the canonical upstream repository and Program source remain unmodified.
- Added two LiteSVM integration regressions to the pinned upstream `tests/integration-tests/src/test_transfer_subscription.rs` in the ephemeral CI checkout:
  - `two_subscription_pulls_in_one_transaction_share_period_allowance`: two 20,000,000 atomic-unit pulls in one transaction succeed against a 50,000,000 period allowance; balances and cumulative on-chain usage equal the combined 40,000,000.
  - `failed_second_subscription_pull_rolls_back_first_pull_atomically`: two 30,000,000 pulls exceed the 50,000,000 period allowance on instruction index 1; the transaction fails with `AmountExceedsPeriodLimit`, and the test verifies that source/receiver token balances and Subscription period usage/start fields remain unchanged.
- The first runnable attempt exposed Rust correctness issues in the test harness, not Program behavior: references to packed fields and an account-data lifetime leak. The patch was corrected to copy scalar values while the account data is alive. The following run showed that the Program returned custom code 400 (`AmountExceedsPeriodLimit`) at the second instruction; the shared `assert_err` helper expected instruction index 0. The test was corrected to use `assert_err_at(1, ...)`, matching the upstream two-instruction transaction helper. No assertion was weakened or removed.
- Exact-head CI run [41780022903](https://github.com/azad2022/solsite/actions/runs/41780022903) completed SUCCESS on `63a30f09d28ac069edef161fc6ce8ec67b1294e3`. Dedicated job [126409204923](https://github.com/azad2022/solsite/actions/runs/41780022903/job/126409204923) applied the patch to the exact pinned source, asserted that only `test_transfer_subscription.rs` was overlaid, installed pinned Rust 1.92 / Solana 4.0.0, and ran the full Rust integration crate: **276 passed, 0 failed, 0 ignored**. Both new regression names are present as `... ok` in the job log.
- All other exact-head CI jobs completed SUCCESS: `quality`, `subscription-sdk-compat (24)`, `subscription-reproducible-build`, `subscription-tm06-sponsored-plan-refund`, and `subscription-mainnet-programdata`.
- All applicable external checks on the same SHA completed SUCCESS: Production Build [41780022864], Database Security [41780022981], ordinary Pay Devnet E2E [41780022953], Mainnet Read-only [41780022857], and Cloudflare Pages. Supabase Preview was SKIPPED under the current preview-free policy. The existing Pay Devnet E2E is not a Subscription billing transaction; Mainnet checks were read-only. TM-07 itself ran in LiteSVM and did not submit a Devnet or Mainnet transaction.
- **Scope limit:** this proves same-transaction cumulative allowance and rollback for two TransferSubscription instructions using the current test destination setup. It does not yet prove a principal/fee split to two different destination owners under a non-empty Plan allowlist; it does not prove the Subscription verifier/accounting design, Devnet Subscription E2E, or a fee model. Those remain separate gates.
- Status: TM-07 same-transaction cumulative allowance and rollback **PASS**; different-destination split transfer **NOT IMPLEMENTED / NOT YET TESTED**; G0 overall **BLOCKED**; G1 residual-risk approval **NOT RECORDED**; G2 Contract Freeze **PARTIAL / BLOCKED**. Subscription production API/domain/schema/Billing worker/Collector/verifier/accounting/entitlement/UI remain **NOT IMPLEMENTED**.
- Mutation boundary: no Product runtime code, canonical upstream Program, Production DDL/data, Cloudflare/Supabase configuration, Secret/Key, signer, customer Consent, Mainnet/Devnet Subscription transaction, Program upgrade or Squads proposal was changed. No customer or merchant funds were moved. Local Working Tree remains UNKNOWN through the remote GitHub connection.


## 2026-11-04 — TM-07 two distinct whitelisted destinations in one transaction — PASS

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; PR #366 OPEN / DRAFT / NOT MERGED. Exact tested source HEAD: `afac7a6594da6105b395dd6b983df43617662b72`; PR base snapshot: `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- Regression target: exact pinned upstream Program `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`. SolMint applies a test-only patch to an ephemeral CI checkout; canonical upstream source/repository and Program binary remain unchanged.
- Expanded the TM-07 test-only overlay to exercise the actual two-destination case, using a non-empty Plan allowlist containing two distinct receiver owners and a separate ATA for each:
  - `two_subscription_pulls_to_two_whitelisted_destinations_share_period_allowance`: two 20,000,000 atomic-unit TransferSubscription instructions in one transaction send to two different whitelisted ATA owners. The source decreases by 40,000,000; each destination receives exactly 20,000,000; on-chain cumulative period usage is 40,000,000 against a 50,000,000 limit.
  - `failed_second_split_pull_rolls_back_first_destination_and_subscription_state`: first 30,000,000 leg targets destination A, second 30,000,000 leg targets destination B. The second instruction fails with `AmountExceedsPeriodLimit` at instruction index 1. The source, both destination ATAs, cumulative period amount and current period start remain unchanged.
- Exact-head CI run [41780570997](https://github.com/azad2022/solsite/actions/runs/41780570997) completed SUCCESS on `afac7a6594da6105b395dd6b983df43617662b72`. Dedicated job [126411161177](https://github.com/azad2022/solsite/actions/runs/41780570997/job/126411161177) checked out the exact pinned source, applied the patch, asserted the overlay only touched `tests/integration-tests/src/test_transfer_subscription.rs`, installed pinned Rust 1.92 / Solana 4.0.0, and ran the full integration suite: **276 passed, 0 failed, 0 ignored**. Both new test names appear in the job log with `... ok`.
- All six CI jobs passed: `quality`, `subscription-sdk-compat (24)`, `subscription-reproducible-build`, `subscription-tm06-sponsored-plan-refund`, `subscription-atomic-split-transfer`, and `subscription-mainnet-programdata`.
- All external exact-head workflows passed: Production Build [41780571102], Database Security [41780571154], ordinary Pay Devnet E2E [41780571042], Mainnet Read-only [41780572652], and Cloudflare Pages. Supabase Preview was SKIPPED under the preview-free policy. The two-destination regression itself ran in LiteSVM and did not submit a Devnet/Mainnet Subscription transaction; ordinary Pay Devnet E2E is not Subscription E2E.
- **Interpretation boundary:** this proves the pinned Program accepts two TransferSubscription instructions to two distinct Plan-allowlisted destination owners in the same transaction, enforces a single cumulative allowance, and atomically rolls back all token/account state when the second leg exceeds it. The destination labelled as the fee leg is only a test receiver; no gateway fee percentage, formula, commercial allocation, real merchant settlement, fee payer custody, accounting mapping or production billing rule is approved by this test.
- Status: two-distinct-destination LiteSVM atomic split regression **PASS**; production split-fee billing **BLOCKED** pending explicit fee-model decision, dedicated finalized Subscription verifier/accounting/outbox, Merchant-funded fee-payer custody, and Devnet Subscription E2E. G0 overall **BLOCKED**; G1 residual-risk approval **NOT RECORDED**; G2 Contract Freeze **PARTIAL / BLOCKED**. Production Subscription APIs/domain/schema/Billing worker/Collector/verifier/accounting/entitlement/UI remain **NOT IMPLEMENTED**.
- Mutation boundary: no production runtime code, canonical upstream Program, Production DDL/data, provider configuration, Secret/Key, signer, customer Consent, Devnet/Mainnet Subscription transaction, Program upgrade, Squads proposal or merchant/customer funds were changed. Local Working Tree remains UNKNOWN through remote GitHub access.


## 2026-11-04 — Production migration lineage inventory and Issue #355 forensic refresh

- Repository: `azad2022/solsite`; feature branch HEAD before this documentation checkpoint: `c96a5fe3f3090ddc9d01410f6da55df768c88456`; current `main` HEAD inspected: `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f`; PR #366 OPEN / DRAFT / NOT MERGED.
- Live Supabase project `nvopkbiedorfshwbmyhn`: `ACTIVE_HEALTHY`, PostgreSQL 17.6.1, `eu-central-1`. The Supabase Branches API returned only the default Production `main` branch; no Preview branch was listed.
- **Migration lineage inventory — PASS (bounded):** read-only comparison of `supabase/migrations` on `main`, the Subscription feature branch and the live Supabase migration ledger found exactly 106 entries/files in each. All 14-digit versions and normalized migration names match one-to-one; zero missing, extra, mismatched or duplicate versions; all 106 repository migration blob SHAs are identical between `main` and `feat/pay-subscription-billing`. Latest common version/name: `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- This proves current filename/version/name lineage alignment only. Supabase's migration ledger does not provide the repository blob SHA in this comparison; no claim is made that live stored SQL bytes were hash-compared to the repository files.
- **Runner log refresh — no recent matching evidence returned:** one read-only query over the connector's default last-24-hour window searched available `function_logs`, `function_edge_logs`, and `postgres_logs` for migration/workflow/git-ref messages. It returned zero matching rows. The query does not show that the historical runner is disabled or identify its trigger/actor.
- Supabase Branches metadata and the available connector do not expose the project's GitHub Integration settings or the `Deploy to production` toggle. The exact current toggle state therefore remains **UNKNOWN**. Official Supabase documentation states that when this option is enabled, pushes/merges to the configured production branch automatically deploy new migrations; GitHub integration is available on all plans, while preview branching is separate. References: https://supabase.com/docs/guides/deployment/branching/github-integration and https://supabase.com/docs/guides/deployment.
- The source-controlled `.github/workflows/solmint-pay-production-migration.yml` was re-read at the exact feature HEAD. It remains `workflow_dispatch` only, with explicit `DRY_RUN` / `APPLY`; `APPLY` runs `supabase db push` and therefore applies every pending repository migration. No workflow was dispatched. No Supabase integration setting was changed.
- Added a forensic update to Issue #355 as comment [6623827656](https://github.com/azad2022/solsite/issues/355#issuecomment-6623827656). Issue #355 remains OPEN. Historical independent Supabase-linked runner execution is **PASS (historically observed)**; current migration lineage is **PASS**; current toggle and historical initiating actor remain **UNKNOWN**; issue closure remains **BLOCKED** pending direct owner inspection of the integration setting and deployment history.
- Overall gates remain: G0 inventory segment for migration lineage **PASS**, G0 overall **BLOCKED** on runner provenance/setting evidence; G1 residual-risk approval **NOT RECORDED**; G2 Contract Freeze **PARTIAL / BLOCKED**. Subscription API/domain/schema/Billing worker/Collector/verifier/accounting/entitlement/UI remain **NOT IMPLEMENTED**.
- Mutation boundary: no Production DDL/data, migration history, Supabase Integration setting, Cloudflare setting, Secret/Key, credential, signer, customer Consent, Devnet/Mainnet transaction, Program upgrade or funds were changed. Local Working Tree remains UNKNOWN through remote GitHub access.


## 2026-11-04 — TM-07 evidence synchronization and G1 pre-approval review

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; pre-checkpoint HEAD: `0f4a5d5eb8ee7fb2fa47e855ffc9b5f6c467f3e2`; PR #366 remains OPEN / DRAFT / NOT MERGED; PR base snapshot remains `7b975d56860b6d937ad76ab2983c71937644dfa3`. `main` was not modified. Local Working Tree remains UNKNOWN because this review used the remote GitHub connection.
- Revalidated exact-head CI run [41782727597](https://github.com/azad2022/solsite/actions/runs/41782727597): SUCCESS. All six jobs passed: `quality`, `subscription-sdk-compat (24)`, `subscription-tm06-sponsored-plan-refund`, `subscription-reproducible-build`, `subscription-atomic-split-transfer`, and `subscription-mainnet-programdata`.
- Exact-head external workflows on the same SHA passed: Production Build [41782727461], Database Security [41782727515], ordinary Pay Devnet E2E [41782727559], Mainnet Read-only [41782727839], and Cloudflare Pages. Supabase Preview was skipped under the preview-free policy. Ordinary Pay Devnet E2E is not a Subscription billing transaction; Mainnet checks were read-only.
- Re-read the project instructions, Master Specification's relevant architecture boundary, Subscription/Build Web Apps/Release Audit Skills, Subscription implementation plan, v1 threat model and contract design at the exact pre-checkpoint HEAD. Inspected the TM-07 patch and its CI job definition.
- **TM-07 pinned-source LiteSVM sub-gate — PASS:** exact Program source `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`; test overlay `tools/subscription-upstream-tests/tm07-atomic-split-transfer.patch` (blob `82dfff30504c9e814233662a951ea865f8375906`). `two_subscription_pulls_to_two_whitelisted_destinations_share_period_allowance` sends two 20,000,000 atomic-unit transfers in one transaction to two distinct Plan-allowlisted destination owners under a 50,000,000 period limit; each destination receives 20,000,000, the source decreases by 40,000,000, and on-chain cumulative usage is 40,000,000. `failed_second_split_pull_rolls_back_first_destination_and_subscription_state` submits 30,000,000 to each destination; instruction index 1 fails with `AmountExceedsPeriodLimit`, and source/destination balances plus cumulative usage and period start remain unchanged. The exact-head CI job passed on the current source SHA. The tests run in the ephemeral pinned-source LiteSVM checkout; no Devnet or Mainnet Subscription transaction was sent.
- **Interpretation boundary:** this closes only the two-destination shared allowance and atomic rollback test requirements. It does not approve any gateway-fee rate, principal/fee allocation, fee recipient, commercial rule, merchant settlement, extra/duplicate-instruction verifier policy, accounting mapping, fee-payer custody or live billing behavior. Split-fee charging remains BLOCKED pending dedicated Subscription verifier/accounting, explicit approved fee model, Merchant-funded fee-payer signing/custody and Devnet Subscription E2E.
- **G0 — BLOCKED overall:** migration filename/version lineage is PASS (bounded), but Issue #355 remains OPEN. Historical Supabase-linked Production migration execution is evidenced; current initiating actor/control and current GitHub Integration `Deploy to production` setting remain UNKNOWN. The latest documented 24-hour query returned no matching runner rows, which is not proof that the integration is disabled. No Supabase dashboard setting was readable or changed.
- **Cantina accounting — UNKNOWN / BLOCKED:** page-3 summary says five Acknowledged findings, while detailed finding pages enumerate six (one High, four Medium, one Low) and three Fixed rather than the summary's four. No written correction/clarification is recorded. Continue using all six detailed Acknowledged findings as residual risks.
- **G1 Threat-model approval — BLOCKED / NOT RECORDED:** this checkpoint reviews the risk register and confirms the required owner decisions, but it is not the product/security owner's explicit acceptance. No residual risk is silently accepted. G1 requires an explicit owner decision on the High old-signed-create/strong-revocation risk and whether an upstream protocol fix is a launch prerequisite; acceptance/rejection of the six detailed Acknowledged findings; and confirmation of v1 exclusions: Resume, immediate CancelNow, finite Plans, Authority reauthorization/strong revoke guarantees, rent sponsorship, Durable Nonce and unresolved smart-wallet proposals.
- **G2 Contract Freeze — PARTIAL / BLOCKED:** fee model, Merchant-funded recurring fee-payer custody, entitlement/retry/catch-up/termination rules, Plan retirement, role/capability matrix, wallet/identity scope, finality/discovery policy, typed accounting origin and outbox/atomic settlement remain open. Existing ordinary Pay verifier stays unchanged.
- **Implementation status:** Subscription API/domain runtime/schema/migrations, consent lifecycle, billing worker/atomic claim/recovery, isolated Collector signer, dedicated verifier/accounting, real Subscription Devnet E2E and UI remain NOT IMPLEMENTED.
- **Documentation corrections prepared in this checkpoint:** synchronize the Skills/design documents to record the six-item Cantina discrepancy and the completed TM-07 LiteSVM sub-gate without promoting the remaining split-fee capability to PASS.
- Mutation boundary: no Production DDL/data, Supabase/Cloudflare setting, Secret/Key, signer, customer Consent, Devnet/Mainnet transaction, Program upgrade, Squads proposal or customer/merchant funds were changed. No application runtime code was changed.

- Documentation follow-up on `d82e945f`: clarified the contract-design summary sentence so the completed LiteSVM sub-gate and still-blocked split-fee conditions are expressed as distinct requirements; no policy or runtime behavior changed.


## 2026-11-05 — Owner rejection of TM-01 residual risk and upstream protocol remediation design

- Repository state revalidated before this checkpoint: `azad2022/solsite`, branch `feat/pay-subscription-billing`, HEAD `91e7c8339467c8bf4ec69cbc05955f678dff00fa`; `main` HEAD `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f`; PR #366 OPEN / DRAFT / NOT MERGED, base snapshot `7b975d56860b6d937ad76ab2983c71937644dfa3`. Local Working Tree remains UNKNOWN through remote GitHub access.
- Exact-head CI on `91e7c8339467c8bf4ec69cbc05955f678dff00fa`: [41784788008](https://github.com/azad2022/solsite/actions/runs/41784788008) completed SUCCESS. All six jobs passed: `quality`, `subscription-sdk-compat (24)`, `subscription-tm06-sponsored-plan-refund`, `subscription-reproducible-build`, `subscription-atomic-split-transfer` and `subscription-mainnet-programdata`.
- Same-SHA external workflows passed: Production Build [41784787985], Database Security [41784787977], ordinary Pay Devnet E2E [41784788005], Mainnet Read-only [41784787990], and Cloudflare Pages. Supabase Preview was SKIPPED under the preview-free policy. Ordinary Pay Devnet E2E is not Subscription E2E; Mainnet checks were read-only.
- **Owner security decision — RECORDED:** on 2026-11-05 the owner explicitly rejected acceptance of the Cantina High TM-01 old-signed-create/revocation residual risk. Strong revocation and Production Subscription launch are blocked until the upstream Program correction is implemented, independently reviewed, deployed and verified against finalized Mainnet ProgramData/ELF/IDL. This is a narrow TM-01 decision; it does not accept the remaining five detailed Cantina Acknowledged findings and does not complete G1.
- Rechecked upstream repository main at `abecf131886bec421e38544ec0c312c0325f6a8b`. The current-main `initialize_subscription_authority.rs`, `close_subscription_authority.rs`, `revoke_subscription_authority.rs`, `subscribe.rs` and `subscription_authority.rs` still show the slot-based `init_id`, idempotent approval of `u64::MAX`, sentinel-to-current-slot matching and Authority close/revoke semantics. No TM-01 protocol remediation was found in these inspected paths. This is source evidence only, not a claim about a new Mainnet deployment.
- Confirmed in the current Program source that `transfer_with_delegate` compares the live Authority `init_id` with the delegation header `init_id`. This is a possible compatibility seam for a persistent generation value, but it does not supply persistence across Authority closure by itself.
- Added `docs/solmint-pay-subscription-tm01-protocol-fix-proposal.md`: conceptual persistent per-customer+mint generation registry, exact expected-generation/nonce/deadline checks, invalidation when Authority does not exist, atomic revoke/generation advance, legacy discriminator closure, legacy active-account bootstrap candidate, rent tradeoffs, external raw SPL Revoke limitation, adversarial test matrix and independent release gates. Registry name/layout/discriminator and architecture option are not frozen; no Program code or upstream PR is claimed.
- Gate status: TM-01 owner disposition DECIDED / NOT ACCEPTED; TM-01 technical closure **BLOCKED**; G1 overall **BLOCKED** until remaining residual risks and v1 exclusions receive separate review; G0 **BLOCKED** on Issue #355 runner provenance/current integration setting; G2 **PARTIAL / BLOCKED**.
- Subscription API/domain runtime/schema/migrations, customer consent runtime, billing worker/claim/recovery, Collector signer, dedicated verifier/accounting, real Subscription Devnet E2E and UI remain **NOT IMPLEMENTED**.
- No Production DDL/data, Supabase/Cloudflare settings, Secret/Key, credential, signer, customer Consent, Devnet/Mainnet transaction, Program upgrade, Squads proposal or customer/merchant funds were changed. No upstream commit/PR was created. No tests are claimed for the design proposal; the cited CI runs validate the preceding documentation-only HEAD `91e7c8339467c8bf4ec69cbc05955f678dff00fa`.


- **Disclosure-procedure note:** upstream `SECURITY.md` explicitly prohibits public GitHub Issues for security reports and directs reporters to its private [Report a Vulnerability](https://github.com/solana-foundation/subscriptions/security/advisories/new) intake. No public issue was created. The current connected GitHub actions do not expose private security-advisory creation, so no upstream advisory has been submitted in this checkpoint.
- **Protocol-account rent precision:** current upstream `ReclaimExcessRent` returns only lamports above the rent-exempt floor to the recorded funder and leaves account data open/unchanged. The TM-01 proposal now preserves that exact boundary for any future Registry account; a future implementation must explicitly include its owner/discriminator/funder behavior in the reclaim path.

## 2026-11-06 — TM-01 private disclosure and exact-head CI checkpoint

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; checkpoint source HEAD: `ce74bd5491c0f6ce81a8d04fd7cdb59ad5c89e74`; PR #366 OPEN / DRAFT / NOT MERGED; base branch `main` remains at `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f` (PR base snapshot is `7b975d56860b6d937ad76ab2983c71937644dfa3`). No change was made to `main`. Local Working Tree remains UNKNOWN through the remote GitHub connection.
- Exact-head Actions on `ce74bd5491c0f6ce81a8d04fd7cdb59ad5c89e74`: CI [42056454559] SUCCESS; Production Build [42056454287] SUCCESS; Database Security [42056454536] SUCCESS; ordinary Pay Devnet E2E [42056454513] SUCCESS; Mainnet Read-only [42056454312] SUCCESS.
- CI jobs all completed SUCCESS: `quality`, `subscription-sdk-compat (24)`, `subscription-reproducible-build`, `subscription-tm06-sponsored-plan-refund`, `subscription-atomic-split-transfer`, `subscription-mainnet-programdata`. Cloudflare Pages Preview passed; Supabase Preview was SKIPPED because this branch is not associated with a Supabase Preview branch.
- Interpretation boundary: ordinary Pay Devnet E2E is not a Subscription charge E2E; Mainnet workflow is read-only; Cloudflare result is Preview, not Production deployment evidence. This documentation-only HEAD's green checks do not close Subscription runtime gates.
- Revalidated upstream `solana-foundation/subscriptions` current `main` at `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`. Compared with the previously inspected `abecf131886bec421e38544ec0c312c0325f6a8b`, only README changed; relevant Program instruction/state files are unchanged. Current source still has slot-based `init_id`, `UNKNOWN_INIT_ID` → current-slot acceptance, `Approve(u64::MAX)` on Init, and Authority close on Revoke. The risk remains the previously acknowledged Cantina TM-01 / Finding 3.1.1; it is not represented as a new discovery.
- A private vulnerability report was submitted through the upstream repository's private reporting channel. It is currently awaiting maintainer triage; acceptance, acknowledgement, remediation direction and response are NOT RECORDED at this checkpoint. No public Issue or PR was created. The public progress ledger intentionally excludes the private advisory identifier and URL.
- TM-01 owner disposition remains NOT ACCEPTED. Strong revocation and real Subscription activation remain BLOCKED pending maintainer feedback, agreed protocol design, upstream Program/IDL/SDK/account migration changes, full adversarial and compatibility tests, independent review, deployment and finalized Mainnet ProgramData/ELF/IDL re-verification.
- Subscription API/domain runtime/schema/migrations, customer Consent runtime, billing worker/claim/recovery, isolated Collector signer, dedicated verifier/accounting, real Subscription Devnet E2E and UI remain NOT IMPLEMENTED.
- No Product runtime/API/DB/RLS/migration/IDL/SDK changes; no Production DDL/data or settings changes; no Secret/Key/credential/signer changes; no customer Consent; no Devnet/Mainnet Subscription transaction; no Program upgrade/Squads proposal; and no customer or merchant funds were changed.


## 2026-11-06 — Subscription v1 finite-Plan policy enforcement

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; resulting code/test HEAD: `2af627befabd066def1c1999ed3ae147cc981392`; PR #366 remains OPEN / DRAFT / NOT MERGED; base branch `main` remains `4d9fa4c356f4619c5d7998e73a196a4a85d24c6f`, and the PR base snapshot remains `7b975d56860b6d937ad76ab2983c71937644dfa3`. No changes were made to `main`. Local Working Tree remains UNKNOWN through the remote GitHub connector.
- **Verified mismatch:** the Subscription v1 Skill prohibits every finite Plan because Program v0.5.0 does not bind `end_ts` into the signed Subscribe terms and does not atomically enforce a full remaining period. The existing server-side `validateSubscriptionPlanPolicy` helper previously accepted a finite Plan if its end was at least one period after the supplied cluster time. Such a preflight cannot prevent a delayed signed Subscribe from landing after Plan terms change.
- **Implementation:** `src/pay/services/subscriptionPlanPolicy.ts` now rejects every non-zero `endTs` with the existing `INVALID_END_TS` policy error. It still validates `chainTimeUnixSeconds` as a canonical bounded integer. `tests/pay-subscription-plan-policy.test.ts` replaces the prior finite-boundary acceptance test with regression coverage that rejects both an exact one-period finite end and a one-year finite end. Perpetual `endTs = 0` remains the only accepted v1 representation.
- **Exact-head CI — PASS:** commit `2af627befabd066def1c1999ed3ae147cc981392`, CI run [42180412296](https://github.com/azad2022/solsite/actions/runs/42180412296) completed SUCCESS. All six jobs passed: `quality` (TypeScript typecheck, production build, unit tests and source-tree assertion), `subscription-sdk-compat (24)` (adapter typecheck, SDK/PDA/web3 tests, Workerd runtime and non-submitting Devnet simulation), `subscription-tm06-sponsored-plan-refund`, `subscription-atomic-split-transfer`, `subscription-reproducible-build`, and `subscription-mainnet-programdata`.
- Same-SHA external checks: Production Build [42180412248] SUCCESS; Database Security [42180412218] SUCCESS; ordinary Pay Devnet E2E [42180412232] SUCCESS; Mainnet Read-only [42180412362] SUCCESS; Cloudflare Pages Preview [127768815121] SUCCESS. Supabase Preview remains skipped under the preview-free policy. The ordinary Pay Devnet E2E is not a Subscription billing E2E; the Mainnet workflow is read-only; Cloudflare is a branch Preview, not a Production deployment.
- **Scope of PASS:** the finite-Plan validator mismatch and its regression tests are corrected and exact-head CI passed. This is a policy/helper checkpoint only. It does not implement an authenticated Plan-creation route, on-chain Plan transaction flow, customer Consent, Subscription lifecycle, Billing Cycle/Attempt, Collector, dedicated Subscription verifier/accounting, or customer entitlement.
- Remaining gates are unchanged: G0 overall BLOCKED on unresolved Issue #355 runner provenance/current Supabase integration setting; G1 overall BLOCKED (TM-01 owner decision remains NOT ACCEPTED and other detailed Cantina residuals remain outstanding); G2 contract freeze PARTIAL / BLOCKED. TM-01 upstream technical fix remains BLOCKED pending maintainers' response, approved design, Program/IDL/SDK/account compatibility work, independent review, deployment and finalized Mainnet verification. Production Subscription activation remains BLOCKED.
- Mutation boundary: only the two feature-branch source/test files above were changed. No Production DDL/data, Production deployment, Supabase/Cloudflare setting, Secret/Key/credential, signer, customer Consent, Mainnet transaction, Program upgrade, Squads proposal or customer/merchant funds were changed. The automated existing ordinary Pay Devnet E2E ran successfully; no Subscription transaction was submitted to Devnet or Mainnet.


## 2026-11-06 — Dedicated Subscription verification/accounting contract draft

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; design commit: `60261b03d804600569664c9a93ac4ae4bfac0cb6`; PR #366 remains OPEN / DRAFT / NOT MERGED at the time of this checkpoint. No change to `main`. Local Working Tree remains UNKNOWN through the remote GitHub connector.
- Re-read the current branch Master Specification, Subscription Skill, Build Web Apps Skill, Release Audit Skill, current Subscription domain contract and implementation plan. Re-inspected the isolated account-state validator/tests and the exact pinned upstream Program/IDL at `364a41976c33347d092902443bbec2def9227e75`.
- Added `docs/solmint-pay-subscription-verification-accounting-contract.md`. It records the exact `TransferSubscription` discriminator/data/account order from the pinned IDL and Program source; separates account-state consistency from transaction verification and atomic accounting; defines provenance/finality, signature/Cycle/Attempt binding, instruction/CPI, token movement, period/Puller, fee-payer and ledger requirements; and maps adversarial tests and implementation order.
- Important evidence boundary: the current account-state helper is not a transaction verifier. Pinned Program source shows the transfer path emits an event only after delegated token movement, but the event remains corroborating evidence. The Rust account parser accepts trailing remaining accounts; their safe v1 shape cannot yet be frozen until the exact pinned `transfer_with_delegate` helper/CPI behavior is source-pinned and covered by golden fixtures. The contract therefore rejects unknown remaining accounts and explicitly marks this sub-gate NOT IMPLEMENTED.
- No runtime source or tests were changed in this design checkpoint. No tests were executed for the new design document; no CI result is claimed for this documentation-only commit.
- Dedicated transaction verifier, finalized RPC adapter, typed Subscription accounting origin/atomic DB operation, fee/referral/network-cost/refund decisions and entitlement policy remain NOT IMPLEMENTED or BLOCKED as detailed in the new contract. Existing one-off Pay verifier remains unchanged.
- Mutation boundary: only the new design document and this progress ledger are changed on the feature branch. No Production DDL/data, Supabase/Cloudflare settings, Secret/Key/credential, signer, Devnet/Mainnet transaction, Program upgrade, customer Consent, ledger posting or customer/merchant funds were changed.


## 2026-11-06 — Pinned delegated-token CPI verification detail

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; source design commit: `c9d88d71fd853c70a94e99524d32bd46aca40c26`; PR #366 remains OPEN / DRAFT / NOT MERGED at this checkpoint.
- Follow-up source inspection resolved an important unknown from the prior verifier draft. Exact upstream helper `program/src/instructions/helpers/transfer_utils.rs` at pinned Program commit `364a41976c33347d092902443bbec2def9227e75` (blob `241937f6ad46877c3d29f01f62109f5c33bf781e`) shows the non-hook path invokes SPL `TransferChecked` signed by SubscriptionAuthority PDA. Remaining accounts are forwarded only when a mint has an active Transfer Hook. Since v1 excludes Token-2022/TransferHook and retains original SPL Token, the supported path requires zero remaining accounts; verifier must reject non-empty trailing accounts.
- Updated `docs/solmint-pay-subscription-verification-accounting-contract.md` to record the exact CPI and source evidence. This narrows the transaction-verifier contract but does not implement the verifier or prove an actual transaction.
- No runtime code, tests, schema, routes or migrations changed. No tests were run for this documentation-only refinement. CI for the documentation checkpoint is not claimed PASS; the exact-head Actions run for the previous ledger commit was cancelled by GitHub and must be rechecked on the current head.
- Mutation boundary unchanged: no Production/DB/RLS/Secret/Key/signer/Devnet/Mainnet/Program/customer Consent/accounting/funds mutation.


## 2026-11-06 — Strict TransferSubscription structural decoder

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; code commit: `f21719c7fc23c40d55d9cf68ccd81c3d13b63a08`; design clarification commit: `2aa1644a2e6988d377da162e5ef2bb5e9f04f6a3`; PR #366 remains OPEN / DRAFT / NOT MERGED. No changes to `main`.
- Implemented isolated, pure structural decoder `tools/subscription-sdk-compat/src/transfer-subscription-instruction.ts` for the pinned v0.5.0 `TransferSubscription` instruction. It checks exact Program ID, discriminator 10, exact 73-byte data layout, little-endian u64 amount as `bigint`, delegator/Mint decoding, Mint account consistency, exact ten fixed account positions, original SPL Token Program, self-Program account, and rejects any trailing/remaining accounts.
- Added `tools/subscription-sdk-compat/test/transfer-subscription-instruction.test.mjs` and wired it into the isolated harness `npm test` command. Test cases cover u64 precision above JavaScript safe integer range, wrong Program/discriminator, malformed/trailing data, zero amount, missing/extra accounts, Token-2022 substitution, self-Program mismatch and Mint mismatch.
- Updated `docs/solmint-pay-subscription-verification-accounting-contract.md` to state exactly what the parser does and, importantly, what it does not prove. This parser is not a transaction verifier: it does not inspect compiled signer/writable privileges, lookup tables, CPI metadata, actual token deltas, finality, Puller authorization, duplicate signatures, Cycle/Attempt correlation or accounting.
- No local test runner was available through the GitHub connector; tests have been added but were not executed locally in this session. Exact-head CI is required before marking this implementation PASS. Prior exact-head doc-only Actions were cancelled; do not inherit their status.
- Dedicated finalized transaction verifier, RPC evidence adapter, typed financial origin, atomic accounting DB operation, fee/entitlement decisions, Collector and billing lifecycle remain NOT IMPLEMENTED/BLOCKED. Existing normal Pay verifier remains unchanged.
- Mutation boundary: only isolated harness source/test/package script and related feature-branch documentation changed. No Production DDL/data, Supabase/Cloudflare settings, Secret/Key/credential, signer, Devnet/Mainnet transaction, Program upgrade, customer Consent, financial posting or customer/merchant funds changed.


## 2026-11-06 — Isolated Subscription account-state validation and transfer instruction evidence

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; code/test HEAD: `3fda2de1d08b910934d6431723b78197e45901ce`; PR #366 OPEN / DRAFT / NOT MERGED; PR base snapshot `7b975d56860b6d937ad76ab2983c71937644dfa3`. No `main` changes. Local Working Tree remains UNKNOWN via remote GitHub connector.
- Added isolated `tools/subscription-sdk-compat/src/subscription-account-state.ts` policy and `test/subscription-account-state.test.mjs`. It validates a server-normalized, same-slot finalized snapshot of the pinned upstream Plan, SubscriptionDelegation and SubscriptionAuthority accounts plus original SPL Token mint/source token-account identity, ownership, PDA relationships, terms, initId, delegate, balance and allowance. It reports account-state consistency only; it does not fetch RPC data, parse a transaction, prove a token transfer, create a Billing Attempt, post accounting or grant entitlement.
- Added strict boundary regression coverage: the pinned `TransferSubscription` cancellation check is a hard stop at `current_ts >= SubscriptionDelegation.expires_at_ts`; the separate finite Plan `plan_end_ts` check uses `current_ts > plan_end_ts` and is not interchangeable. Recurring period accounting, exact Plan terms and Authority generation are checked independently; `UNKNOWN_INIT_ID`, finite Plans, wrong cluster/owner/delegate/mint and malformed cumulative state fail closed. The snapshot transfer capacity is zero whenever any consistency failure exists.
- Existing isolated `transfer-subscription-instruction.ts` decoder remains structural-only and is included in the SDK harness test command. It validates the pinned v0.5.0 `TransferSubscription` instruction layout/accounts; it does not establish signer/writable privileges, lookup-table resolution, CPI effects, token-balance changes, finality or accounting.
- **Exact code-head CI subset — PASS:** on `3fda2de1d08b910934d6431723b78197e45901ce`, CI run [42188792007](https://github.com/azad2022/solsite/actions/runs/42188792007): `quality` PASS (production typecheck/build, root unit tests and source-tree assertion); `subscription-sdk-compat (24)` PASS (adapter typecheck, SDK/PDA/web3.js tests, Workerd integration and no-submission Devnet CreatePlan simulation). The SDK `npm test` command includes both the 10 account-state tests and 7 structural TransferSubscription decoder tests.
- Same-SHA external workflows — PASS: Production Build [42188792094], Database Security [42188792107], ordinary Pay Devnet E2E [42188792232], Mainnet Read-only [42188792015]. Cloudflare Pages preview deployment was included in the successful Production Build workflow. The normal Pay Devnet E2E exercises Payment Intent/Bulk Pay, not Subscription transfer E2E; Mainnet workflow is non-mutating/read-only.
- **Remaining CI — UNKNOWN / IN PROGRESS at checkpoint:** `subscription-reproducible-build`, `subscription-atomic-split-transfer`, and `subscription-tm06-sponsored-plan-refund` were still running on the exact code SHA. The dependent `subscription-mainnet-programdata` check had not yet produced a result. Do not call the full six-job CI suite PASS until all applicable jobs are terminal-success on the exact current HEAD.
- Product gates unchanged: independent Subscription transaction verifier and finalized RPC evidence adapter **NOT IMPLEMENTED**; typed financial origin and atomic Subscription accounting **NOT IMPLEMENTED / BLOCKED** on contract decisions; fee/referral/network-cost/refund/entitlement semantics remain open; Collector, Billing Cycle/Attempt lifecycle, recovery worker and real Subscription Devnet E2E **NOT IMPLEMENTED**. TM-01 owner disposition remains NOT ACCEPTED and upstream remediation remains **BLOCKED**. Production Subscription activation remains **BLOCKED**.
- Mutation boundary: feature-branch isolated SDK harness source/tests/package script and project documentation only. No Production DDL/data, Supabase state, Secret/Key/credential, signer, customer Consent, Production deployment, Program upgrade, Devnet Subscription transfer, Mainnet transaction, accounting posting, or customer/merchant funds were changed. The Devnet CreatePlan step was simulation-only and did not submit.


## 2026-11-06 — G0 Cantina tally correction and fresh Production migration-runner recheck

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; this checkpoint follows documentation commits `7bae2b103f12a425184cd07ea9537597200f7f85`, `1737f76db6b9294efb547b8c249ce55ae0f454e6`, and `928f414887b49a4efd63c258f3425f9cb7c25491`. PR #366 remains OPEN / DRAFT / NOT MERGED. No changes to `main`.
- Re-read the actual uploaded 12-page Cantina PDF, including the page-3 aggregate tally and detailed finding disposition paragraphs. **The supposed summary/detail count discrepancy was a project-document interpretation error, not a Cantina PDF inconsistency.** The four Fixed/Mitigated items are: Medium CancelNow timestamp binding (partial mitigation only), Medium UpdatePlan, Low CreatePlan payer/IDL, and Informational IDL generation. The five Acknowledged items are: High old-signed-create, Medium Resume, Medium authority-control, Medium full-period-at-Plan-expiry, and Low rent sponsorship. This matches the report's aggregate 4 Fixed / 5 Acknowledged. Cantina explicitly retains the same-second CancelNow residual; TM-02 is not fully closed. Updated the Threat Model, Release Audit Skill and implementation plan accordingly. The report-count reconciliation sub-gate is now **PASS**; no external clarification is needed for the arithmetic.
- Fresh read-only Production Supabase evidence: project `nvopkbiedorfshwbmyhn` remains `ACTIVE_HEALTHY`, PostgreSQL 17.6.1, `eu-central-1`. Live migration ledger returns 106 entries and still ends at `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`. A fresh unified-log query over the available default 24-hour window returned no matching migration/workflow/git-ref rows. This is only an absence of matching rows in that query window; it does not prove the integration is disabled or identify the historical actor.
- Repository evidence: `supabase/config.toml` is absent on both `main` and the feature branch. The controlled `.github/workflows/solmint-pay-production-migration.yml` remains `workflow_dispatch` with explicit `NO`, `AUTH_PROBE`, `DRY_RUN`, and `APPLY` inputs. Current official Supabase documentation confirms the separate Dashboard GitHub Integration option `Deploy to production` automatically applies new migrations on pushes/merges to the configured production branch when enabled. The connected Supabase tools do not expose that project-level toggle or its deployment history.
- **G0 overall remains BLOCKED:** historical runner execution and its initiating actor/control remain unresolved; current `Deploy to production` setting remains UNKNOWN. No repository-only configuration or CI change can honestly prove that external dashboard toggle is off. Issue #355 remains OPEN. No attempt was made to disable integration or alter Production migration behavior without owner approval.
- **G1 remains BLOCKED:** the owner decision on TM-01 remains NOT ACCEPTED and requires an upstream protocol-level persistent generation/nonce/deadline fix plus legacy instruction closure, independent review, deployment and finalized Mainnet verification. No upstream private security advisory was submitted: the available GitHub connector exposes no private vulnerability-report/advisory creation action, and the upstream repository's disclosure policy requires private reporting rather than a public issue. The remaining four acknowledged findings and the TM-02 residual remain subject to the existing v1 exclusions and explicit owner/security disposition; no residual risk is silently accepted.
- Exact feature-branch CI for this documentation checkpoint must be read from the resulting commit after the progress update; no test/build result is inferred from earlier commits.
- Mutation boundary: only feature-branch documentation files were changed. No Production DDL/data, Supabase/Cloudflare setting, Secret/Key/credential, signer, customer Consent, Mainnet/Devnet transaction, Program upgrade, Squads proposal, accounting posting or customer/merchant funds were changed. No Production workflow was dispatched.


## 2026-11-06 — Owner decision: preserve Subscription scope; private TM-01 disclosure submitted

- Owner clarified that the complete intended Subscription feature set must be preserved; permanent de-scoping is not acceptable. This supersedes provisional `Exclude` / `Disabled` entries as product-scope decisions. They are temporary launch guards only. Added `docs/solmint-pay-subscription-upstream-v06-capability-preserving-remediation.md` covering TM-01 through TM-06, persistent authority/subscription/plan revisions, finite-plan and final-period semantics, explicit rent sponsorship, migration compatibility and adversarial test gates. Updated Threat Model, project instructions, Subscription Skill, Build Web Apps Skill, Release Audit Skill, Master Spec and Implementation Plan to align.
- Private disclosure: confirmed GitHub private vulnerability reporting is enabled for upstream `solana-foundation/subscriptions`; submitted TM-01 as `GHSA-hvvh-pvqw-g3gx` with severity HIGH. The advisory's current state is **TRIAGE** and `submission.accepted=false`; this proves submission/triage creation, not maintainer acceptance or a fix. No public Issue/PR was created.
- Attempted to create the temporary private fork associated with the advisory. GitHub returned HTTP 403 because the `solana-foundation` organization restricts third-party OAuth App access. Therefore no private fork or upstream code patch is available through this connection. No workaround through a public fork/branch was attempted.
- Upstream source was re-read at the current-main snapshot returned by repository commit search: `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`. The live `initialize_subscription_authority.rs` still initializes slot-based `init_id` and invokes SPL `Approve(u64::MAX)` on the idempotent path; current Resume, CancelNow, Close/Revoke and Subscribe implementations still use the previously documented timestamp/slot/value-based freshness. No protocol fix for TM-01 through TM-05 was observed in the inspected handlers. Current upstream `CHANGELOG.md` shows only a new `ReclaimExcessRent` entry under Unreleased; it does not claim replay-generation remediation.
- **G1 remains BLOCKED:** the private report is pending maintainer triage/response; no approved v0.6 implementation, private collaboration fork, independent audit, Devnet migration/E2E or deployed Mainnet verification exists. All planned features remain required scope.
- **G0 remains BLOCKED / UNKNOWN:** Production Supabase project remains ACTIVE_HEALTHY; 106 live migrations still end at `20261029140401`; the latest available log query returned no matching migration-runner rows in its window, but the GitHub Integration `Deploy to production` toggle remains inaccessible to the connected Supabase API. Issue #355 remains OPEN. The dashboard toggle and historical runner actor/control have not been verified. No provider setting, Production DDL, migration or workflow APPLY was performed.
- Mutation boundary: only feature-branch documentation was updated. No Production database/settings, Secrets/Keys/credentials, signer, customer Consent, Devnet/Mainnet transaction, Program upgrade, Squads proposal, accounting posting or funds changed. No upstream source was changed; no tests/CI are claimed for these documentation changes until exact-head workflows are rechecked.
- Correction to earlier note in this ledger stating no private advisory was submitted: that statement described the pre-submission checkpoint and is superseded by the successful private submission above.


## 2026-11-06 — Fail-closed Production migration workflow hardening (partial CI checkpoint)

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; code checkpoint SHA: `dc430f93a7504a1756662e4cd75a7bc11ecaf792`; PR #366 remains OPEN / DRAFT / NOT MERGED. `main` was not changed. Local Working Tree remains UNKNOWN because this session had no local Git clone/network path; all repository writes used the feature-branch Git data API with an expected-parent SHA.
- Inspected the current workflow, the exact existing regression tests, the controlled migration policy, Supabase live migration ledger, and the latest upstream Subscriptions repository state.
- Hardened `.github/workflows/solmint-pay-production-migration.yml`:
  - APPLY is accepted only for `workflow_dispatch` on exactly `refs/heads/main`, with a full 40-character `expected_main_sha` equal to the event's `GITHUB_SHA`; checkout pins that exact event SHA.
  - DRY_RUN/APPLY accepts only a Supabase Session Pooler PostgreSQL URL bound to the exact SolMint project user `postgres.nvopkbiedorfshwbmyhn`, port 5432, database `postgres`, TLS-required mode and the exact `sslmode` query key. Wrong host family, project user, port/database, duplicate/case-variant/unsupported URI parameters, fragments and disabled/permissive TLS fail closed.
  - If a password is embedded in the connection URI, it must match the separate `SUPABASE_DB_PASSWORD`; the URI password is stripped and only `PGPASSWORD` supplies the credential. Raw URI/password values are not logged.
  - AUTH_PROBE stays read-only and no longer requires the Session Pooler URL. DRY_RUN remains non-mutating; APPLY still executes all pending repository migrations and is not run by CI.
- Added `scripts/solmint-pay-production-migration-guard.mjs` and `tests/pay-production-migration-guard.test.mjs`, and wired the latter into CI. Updated existing `tests/pay-production-migration-workflow.test.ts` to assert the new guard contract rather than old inline implementation details. Added exact Supabase CLI v2.122.1 install/version verification to CI and pinned the controlled migration workflow to 2.122.1; `latest` is deliberately not used because CLI v3 changes hosted command targeting/confirmation semantics. A later CLI v3 upgrade must be an independent tested task.
- Exact code SHA evidence (not a full-CI PASS yet):
  - CI run [42204712094](https://github.com/azad2022/solsite/actions/runs/42204712094): `quality` SUCCESS (423 passed, 0 failed, 2 skipped; new guard suite 30 passed, 0 failed); `subscription-sdk-compat (24)` SUCCESS; `subscription-reproducible-build` SUCCESS; `subscription-production-migration-cli` SUCCESS (log reports exact CLI 2.122.1); `subscription-mainnet-programdata` SUCCESS.
  - `subscription-tm06-sponsored-plan-refund` and `subscription-atomic-split-transfer` were still IN_PROGRESS when this checkpoint was recorded. Overall CI therefore remains IN_PROGRESS / not PASS.
  - Production Build [42204711578](https://github.com/azad2022/solsite/actions/runs/42204711578): SUCCESS.
  - Database Security [42204712048](https://github.com/azad2022/solsite/actions/runs/42204712048): SUCCESS.
  - Ordinary Pay Devnet E2E [42204711779](https://github.com/azad2022/solsite/actions/runs/42204711779): SUCCESS; this is not a Subscription transfer/charge E2E.
  - Mainnet Read-only [42204711643](https://github.com/azad2022/solsite/actions/runs/42204711643): SUCCESS; read-only only.
- Read-only Production Supabase recheck: project `nvopkbiedorfshwbmyhn` / `solmint.ir` remains `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.147`, `eu-central-1`; migration ledger remains 106 entries, latest `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`. No Production migration/DDL/data/settings/secrets/keys changed.
- G0 remains BLOCKED / UNKNOWN: Issue #355 remains OPEN. The repository workflow is now hardened, but this does not disable the separate Supabase Dashboard GitHub Integration `Deploy to production` or identify the historical migration runner's triggering actor. The connected Supabase API does not expose a verified operation for reading/changing that provider-level toggle. No Production provider setting was changed.
- G1 remains BLOCKED: upstream `solana-foundation/subscriptions` is still at main SHA `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`; official Program v0.5.0 remains the latest Program release observed, with no v0.6 replay-generation fix in the inspected handlers/release list. Private report `GHSA-hvvh-pvqw-g3gx` remains TRIAGE / not accepted. The temporary private fork request was denied (HTTP 403); upstream source was not changed.
- Product scope is unchanged: all requested Subscription capabilities remain required. Protocol/security gates are temporary BLOCKED launch gates, not product de-scope. Subscription API/schema/worker/Collector/verifier/ledger/entitlement and real Subscription Devnet E2E remain NOT IMPLEMENTED.
- Mutation boundary: only feature-branch source/test/documentation files were changed. No Production DDL/data, provider setting, GitHub secret, key/signer, Mainnet/Devnet transaction, Program upgrade, Squads proposal, customer consent or accounting/funds were changed.
- Next: poll the two remaining exact-SHA CI integration jobs, fix any source/test failure without weakening gates, then record the terminal exact-head result. Issue #355 and upstream TM-01 remain independently blocked and must not be hidden by green CI.


## 2026-11-06 — Terminal exact-code CI result for migration guard checkpoint

- Follow-up to the partial checkpoint above: CI run [42204712094](https://github.com/azad2022/solsite/actions/runs/42204712094) completed **SUCCESS** on exact code SHA `dc430f93a7504a1756662e4cd75a7bc11ecaf792`; all seven jobs completed SUCCESS:
  - `quality`: 423 passed, 0 failed, 2 skipped in the repository test batch; additional migration-guard suite 30 passed, 0 failed.
  - `subscription-production-migration-cli`: SUCCESS; the log confirms installed CLI version exactly `2.122.1`.
  - `subscription-sdk-compat (24)`: SUCCESS.
  - `subscription-reproducible-build`: SUCCESS.
  - `subscription-mainnet-programdata`: SUCCESS (read-only).
  - `subscription-tm06-sponsored-plan-refund`: SUCCESS; exact pinned upstream integration test `sponsored_plan_rent_is_refunded_to_merchant_on_delete_not_sponsor` passed; full Rust integration suite reported 275 passed, 0 failed, 0 ignored.
  - `subscription-atomic-split-transfer`: SUCCESS; the adversarial test `failed_second_split_pull_rolls_back_first_destination_and_subscription_state` passed, and `two_subscription_pulls_to_two_whitelisted_destinations_share_period_allowance` passed; full Rust integration suite reported 276 passed, 0 failed, 0 ignored.
- The other four exact-code workflows also completed SUCCESS: Production Build [42204711578], Database Security [42204712048], ordinary Pay Devnet E2E [42204711779], and Mainnet Read-only [42204711643]. Devnet workflow is ordinary Pay, not Subscription customer billing. Mainnet job is read-only.
- CI PASS applies to the tested code SHA `dc430f93a7504a1756662e4cd75a7bc11ecaf792`. The subsequent documentation-only Progress commit is `3630b26494e3a591ed0e54adf1cc8107c2ff95aa`; its exact-head CI was queued at this update and must be checked separately before claiming latest-HEAD CI PASS.
- These Rust integration tests run against the pinned upstream source in an ephemeral CI checkout with SolMint-maintained test overlays. They do not mean the upstream canonical repository accepted the fixes, do not change the deployed Mainnet Program, and do not close TM-01/other protocol release blockers.


## 2026-11-06 — Three Subscription validation defects corrected (exact code CI PASS)

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; tested code SHA: `64a6b3edcecc827dfafd7ff95e258cbd181748b5`; PR #366 remains OPEN / DRAFT / NOT MERGED. `main` remains unchanged. Feature branch was updated through fast-forward commits only.
- Pinned source checked at `solana-foundation/subscriptions@364a41976c33347d092902443bbec2def9227e75`:
  - `program/src/instructions/transfer_subscription.rs` rejects scheduled Subscription cancellation when `current_ts >= subscription.expires_at_ts`.
  - The same instruction separately checks finite Plan expiration using `current_ts > plan_end_ts`, then passes `plan_end_ts` into the recurring-period validator. These two timestamps and comparators must never be conflated.
  - `program/src/instructions/helpers/transfer_utils.rs` independently derives the delegator's canonical ATA from subscriber + token program + mint before the delegated transfer CPI.
- Fixed defect 1 — exact scheduled-cancellation boundary:
  - `validateSubscriptionAccountState` previously allowed `blockTimeUnixSeconds === expiresAtTs` because it used `>`. It now fails closed on `>=`, matching the actual TransferSubscription cancellation check.
  - Rewrote the regression to prove one second before expiry remains eligible, equality is rejected, and post-expiry is rejected with zero snapshot transfer capacity.
  - Kept Plan `end_ts` distinct: v0.5.0's finite Plan end gate remains `current_ts > plan_end_ts`; finite Plans are already blocked by SolMint v1 policy.
- Fixed defect 2 — canonical source ATA:
  - The account-state policy previously trusted the server-bound token-account address after checking owner/mint. It now independently derives the original-SPL ATA using the pinned `@solana-program/token` helper and rejects a consent-bound or observed account that is not that exact ATA.
  - Test fixtures now derive their canonical ATA. Added a negative case for a different token account.
- Fixed defect 3 — structural TransferSubscription account binding:
  - The decoder previously accepted any non-empty account-address string and did not bind the source-side accounts to the decoded instruction identities.
  - It now requires canonical 32-byte Base58 addresses, derives the Subscription PDA from `subscription + planPda + delegator`, derives the shared Authority PDA from `SubscriptionAuthority + delegator + mint`, derives the subscriber original-SPL ATA, and rejects mismatched account positions.
  - Added negative tests for malformed Base58, wrong Subscription PDA, wrong Authority PDA and wrong source ATA. The decoder remains a **structural instruction decoder only**; it does not prove signatures, signer/writable privileges, transaction/CPI effects, token-balance movement, finality, accounting or entitlement.
- Additional defensive range check: normalized `initId` values must fit the non-negative signed i64 range on-chain; the UNKNOWN sentinel and values above i64 max are rejected.
- Exact-head CI on `64a6b3edcecc827dfafd7ff95e258cbd181748b5`: [CI run 42206691715](https://github.com/azad2022/solsite/actions/runs/42206691715) **SUCCESS**, all seven jobs SUCCESS:
  - `quality`: 423 passed, 0 failed, 2 skipped; migration-guard suite 30 passed, 0 failed.
  - `subscription-sdk-compat (24)`: TypeScript typecheck passed; SDK/account-state/decoder suites: 47 passed, 0 failed; local Pages Workerd test 1 passed; Devnet CreatePlan simulation 1 passed, no transaction submitted.
  - `subscription-production-migration-cli`: SUCCESS, exact pinned CLI v2.122.1.
  - `subscription-reproducible-build`: SUCCESS.
  - `subscription-mainnet-programdata`: SUCCESS, read-only.
  - `subscription-tm06-sponsored-plan-refund`: 275 passed, 0 failed; `sponsored_plan_rent_is_refunded_to_merchant_on_delete_not_sponsor` passed.
  - `subscription-atomic-split-transfer`: 276 passed, 0 failed; `failed_second_split_pull_rolls_back_first_destination_and_subscription_state` and `two_subscription_pulls_to_two_whitelisted_destinations_share_period_allowance` passed.
- Same-SHA companion workflows: Production Build [42206691339], Database Security [42206691322], ordinary Pay Devnet E2E [42206691637], and Mainnet Read-only [42206691352] all **SUCCESS**. Devnet E2E is existing ordinary Pay, not a real Subscription charge. Mainnet runs were read-only.
- G0 still **BLOCKED / UNKNOWN**: Issue #355 remains OPEN; dashboard GitHub Integration toggle and historical migration-runner actor remain unverified. No Production migration/provider setting was changed.
- G1 still **BLOCKED**: TM-01 private GHSA remains TRIAGE/not accepted; pinned Program v0.5.0 remains deployed. These SDK/policy fixes do not fix the on-chain stale-signed-approval vulnerability or upgrade Mainnet.
- Subscription API/schema/Billing Cycle/Attempt/Collector/independent transaction verifier/atomic Subscription accounting/entitlement/real Subscription Devnet E2E remain **NOT IMPLEMENTED**. No feature scope was removed.
- Mutation boundary: changed feature-branch code/tests/docs only. No Production DDL/data/configuration/Secrets/Keys, signer, customer consent, Program upgrade, Mainnet/Devnet transfer or accounting posting was changed. Devnet CreatePlan remained simulation-only.


## 2026-11-06 — Three additional Subscription validation defects corrected

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; code SHA: `641062bf058e004251323608f14669cc27c344df`; PR #366 remains OPEN / DRAFT / NOT MERGED. All changes are feature-branch-only.
- Defect 1 — chain slot range was under-validated: the account-state policy rejected negative slots but accepted values above the Solana u64 domain (and runtime values that were not BigInt). The shared u64 guard now enforces BigInt + `0..=u64::MAX`; invalid slot values fail the chain-context gate and force snapshot transfer capacity to zero.
- Defect 2 — cancellation-pending result was semantically stale after expiry: the helper returned `cancellationPending=true` for every nonzero expiry, including exact-expiry and already-expired snapshots. It now returns true only while `blockTime < expiresAtTs`; at equality and after expiry it is false. The existing hard stop at `blockTime >= expiresAtTs` remains unchanged.
- Defect 3 — structural TransferSubscription decoder did not bind the event-authority account: it checked the self-program and source-side PDAs but accepted any canonical address in the event-authority position. It now derives the pinned Program PDA using seed `event_authority` and rejects any mismatch, matching upstream `program/src/event_engine.rs::verify_event_authority`.
- Added regression tests: slot negative/u64 overflow/non-BigInt; cancellation exact/after-expiry result semantics; wrong event-authority PDA. Existing decoder remains structural-only and does not claim signer privilege, CPI, token movement, finality, accounting or paid state.
- Exact-head workflows for this SHA have started: CI [42209757357], Database Security [42209757394], Mainnet Read-only [42209757359], Devnet E2E [42209757372], Production Build [42209757361]. They were IN_PROGRESS when this checkpoint was written; no test result is claimed yet.
- Prior exact-head baseline SHA `671fd8ae5828193ccca27305ae985c4f9e63c4e8` had all five workflows SUCCESS, including all seven CI jobs. This does not substitute for the current SHA.
- G0 remains BLOCKED/UNKNOWN (Issue #355 provider-side integration toggle and runner provenance). G1 remains BLOCKED (TM-01 private report still not accepted; no capability-preserving Program implementation or migration). G2 and Subscription runtime remain BLOCKED / NOT IMPLEMENTED as previously recorded. Full Subscription product scope remains retained.
- No Production DDL/data, Supabase provider setting, Secret/Key, signer, customer consent, Mainnet/Devnet transaction, Program upgrade, Squads proposal, ledger posting or customer funds were changed. Devnet workflow, if successful, remains the existing Pay E2E and is not Subscription billing E2E.


## 2026-11-06 — Subscription transaction verifier policy scaffold (CI pending)

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; code checkpoint before this documentation update: `c78371ee4ad45f5ded59dc210a087c9e9b051a2d`; PR #366 remains OPEN / DRAFT / NOT MERGED. All writes are fast-forward feature-branch commits; `main` was not changed.
- Re-read the current-branch Master Specification, project instructions, Subscription Skill, Release Audit Skill, Threat Model, capability-preserving upstream v0.6 remediation plan and the dedicated verification/accounting contract. Re-read the pinned upstream v0.5.0 TransferSubscription handler, event engine, SubscriptionTransfer event serialization, and delegated TransferChecked CPI helper.
- Added `tools/subscription-sdk-compat/src/subscription-transaction-verifier.ts`, a pure/no-I/O policy module. It checks finalized/cluster/error/fee-payer gates; requires exact-slot Program deployment attestation; binds the top-level TransferSubscription instruction and fixed account positions; checks signer/writable privileges and Puller policy; validates one original-SPL TransferChecked CPI, one SubscriptionTransfer self-CPI/event, period/Attempt expectations, and exact raw integer source/destination token balance deltas.
- Added `tools/subscription-sdk-compat/test/subscription-transaction-verifier.test.mjs` with synthetic normalized-evidence policy vectors for successful observation shape, non-finality, token delta mismatch, absent deployment attestation, unauthorized Puller, fee-payer mismatch, extra CPI and missing caller signer. Wired the test into the isolated compatibility harness `npm test`.
- The module returns only `verified_observation`, `rejected` or `unknown`; it never returns paid/accounted/entitled. The one-off Pay verifier and its accounting path were not modified.
- **Important evidence limits:** these tests are synthetic policy tests, not real transaction golden fixtures. No real serialized transaction/metadata fixture has been generated. RPC normalization, historical ProgramData/ELF attestation at the transaction slot, historical Plan/Subscription account-state evidence, message-hash/Cycle/Attempt uniqueness and atomic accounting remain NOT IMPLEMENTED. A successful policy result is not a payment/accounting commit.
- Exact-head CI has not yet been checked for this code/documentation checkpoint; no test or build result is claimed here. Next: inspect and repair exact-head CI, then only claim the checks that actually pass.
- G0 Production migration governance remains BLOCKED/UNKNOWN under Issue #355. G1 upstream TM-01 and capability-preserving v0.6 protocol remediation remain BLOCKED. G2 contract freeze remains PARTIAL/BLOCKED.
- Mutation boundary: only files on `feat/pay-subscription-billing` were changed. No Production DDL/data/provider setting, Secret/Key/credential, signer, customer Consent, Devnet/Mainnet transaction, Program upgrade, Squads proposal, accounting posting or funds were changed.


## 2026-11-06 — Verifier correlation hardening (exact-head CI pending)

- Follow-up code SHA: `253a1b39099fd463ef047b35e3d2f86dc10ba51c`; branch `feat/pay-subscription-billing`; PR #366 remains OPEN / DRAFT / NOT MERGED. No `main` change.
- Bound the observation to the trusted Attempt's exact signature, serialized-message SHA-256, Cycle ID and Attempt ID. Added exact resolved program/account index checks for top-level and inner instructions; bound fee payer to the first message key and signer+writable privileges.
- Corrected fail-closed semantics: non-finalized commitment, missing block time/execution metadata and absent historical deployment attestation now return UNKNOWN; positive signature/message/Program identity mismatch returns REJECTED. Extra CPI effects are rejected, while absent CPI metadata remains UNKNOWN.
- Added synthetic regression vectors for message-hash mismatch and wrong Program ELF identity. These remain synthetic policy tests, not real serialized transaction golden fixtures.
- CI/check evidence for this exact SHA was not available through the current GitHub workflow-run/status reads at the time of this note; no test/build result is claimed. The latest PR head must be checked again after the documentation commit.
- Full RPC normalizer, historical Program deployment attestation producer, same-slot Plan/Subscription account proof, all-Puller reconciliation, real transaction fixtures and atomic accounting remain NOT IMPLEMENTED.
- No Production DDL/data/provider settings, Secrets/Keys, signer, consent, Devnet/Mainnet transaction, Program upgrade, Squads proposal, accounting posting or funds changed.


## 2026-11-06 — RPC normalization, historical account evidence and decoder checkpoint

- Repository: `azad2022/solsite`; branch: `feat/pay-subscription-billing`; PR #366 remains OPEN / DRAFT / NOT MERGED. No `main` changes. PR head before this documentation checkpoint: `b9c4493138e2afab1629aa81b244835d57a6cfb3`; branch is 308 commits ahead and 4 behind current `main` at the time of review; mergeability was true, but no rebase/merge was attempted. Local Working Tree remains UNKNOWN because this was remote GitHub inspection/editing only.
- At exact code SHA `48274e1f5395687cb60ea41cfb368415156c451e`, the isolated SDK job passed TypeScript typecheck, 101 Node tests, 1 Workerd test and 1 Devnet CreatePlan simulation (no submission). At that same SHA, Production Build, Database Security, Devnet E2E and Mainnet Read-only workflows passed. The aggregate CI run was superseded before the pinned upstream TM-06/TM-07 and reproducible-build jobs produced a final conclusion; those are not claimed PASS for that SHA.
- Added finalized RPC evidence normalization for legacy/v0/v1 wire formats, exact serialized-message hashing and Ed25519 signature checks. The complete mocked RPC + ProgramData attestation + pure transaction-verifier path has a positive regression test.
- Added historical account archive evidence retrieval: account state at slot S-1, finalized full-block scan for earlier writable conflicts, and exact-slot Clock sysvar evidence. Added owner/executable checks for Clock. Historical account reads require Alchemy's paid Account Archive plan; no credentials, plan, endpoint or production configuration were added.
- Added pinned-SDK decoding for Plan, SubscriptionDelegation, SubscriptionAuthority, Mint and original SPL Token account data; Token-2022 and extension-bearing layouts fail closed. The decoder binds historical archive signature/slot/cluster to normalized transaction evidence and retains archive provenance. These newest decoder/correlation changes are **CI pending** at the time of this note.
- No real Subscription transfer/charge was submitted. No Production DDL/data/provider setting, Secret/Key, signer, Consent, Mainnet/Devnet write, Program upgrade, Squads proposal, accounting posting or customer funds changed.
- G0 Production migration governance remains BLOCKED/UNKNOWN under Issue #355. G1 upstream TM-01 remediation remains BLOCKED; upstream repository has no accepted Program fix/PR for the stale-authority lifecycle. G2 business-contract freeze and production Subscription backend/accounting remain PARTIAL/BLOCKED / NOT IMPLEMENTED.


## 2026-11-06 — G0 post-merge repository checkpoint

Status: **REPOSITORY GOVERNANCE MERGED / PROVIDER VERIFICATION BLOCKED**

### Repository and merge
- Dedicated governance PR [#367](https://github.com/azad2022/solsite/pull/367) was squash-merged to `main`.
- Merge commit: `d06c0546b9813c8cd461d3d7ec7b1ff44be32d4e`.
- The change set is limited to the controlled Production migration workflow, its target/ref guard, negative regression tests, CI CLI-version check, migration policy and this Progress Ledger. It contains no SQL migration file.
- The large Subscription PR #366 and its branch were not modified.

### Exact-main-push validation
All workflows triggered by the exact merge SHA on `main` completed successfully:
- CI [42228310301](https://github.com/azad2022/solsite/actions/runs/42228310301): **PASS**. The quality job passed TypeScript typecheck, Production build, unit tests, fail-closed Production migration guard tests and source-tree cleanliness. The separate production-migration-cli job installed and verified Supabase CLI 2.122.1.
- Production Build [42228310183](https://github.com/azad2022/solsite/actions/runs/42228310183): **PASS**.
- Authentication Build Verification [42228310188](https://github.com/azad2022/solsite/actions/runs/42228310188): **PASS**.
- Cloudflare Pages Production deployment [4a24ddc3-50bf-431a-82a3-f7cc0882fac0](https://4a24ddc3.solsite-9uh.pages.dev): **PASS**. It was triggered by `github:push` on `main` for the exact merge SHA; the final `deploy` stage succeeded and the `solmint.ir` alias remained attached.

### Production database read-back
- Supabase project `nvopkbiedorfshwbmyhn` remained `ACTIVE_HEALTHY`.
- Read-only migration ledger contained 106 entries; latest remained `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- No Production `APPLY`, SQL mutation, DDL, migration, data mutation, credential/Secret/Key change, or blockchain transaction was performed during this checkpoint.

### Independent Supabase runner — unresolved provider-side evidence
- The project owner reports that Supabase Project Settings → Integrations → GitHub Integration → `Deploy to production` is OFF. Record this as **OWNER-REPORTED OFF**, not as an independent API read-back.
- The connected Supabase API does not expose that provider-level toggle for direct read-back. Its saved state remains **UNKNOWN by independent read-back** (owner-reported OFF).
- A fresh read-only query after log ingestion caught up found ordinary timestamped rows across all four unified-log sources for the interval after merge: `edge_logs` (3), `function_edge_logs` (1), `function_logs` (2), and `postgres_logs` (4), from 2026-11-06 13:50:00 through 13:51:48 UTC. In the post-merge query window, matching `Cloning git repo`, `Applying migration`, `workflow_run`, or `git_ref` markers = **0**; PostgreSQL DDL/migration-apply matches = **0**. This is **PASS for the observed post-merge main push only**: no independent Supabase migration runner execution was observed while normal logs were flowing. It is not a guarantee against future setting changes or every possible external path.
- The historical initiating human/actor for the 2026-10-27 and 2026-10-28 runner executions remains **UNKNOWN**.
- Issue [#355](https://github.com/azad2022/solsite/issues/355) remains **OPEN / BLOCKED** pending direct provider-setting read-back or a sufficiently populated post-change log/deployment-history window that proves the independent migration-apply path is inactive.

### Effective control now merged
- Production migration mutation is repository-controlled and fail-closed: explicit `workflow_dispatch`, `refs/heads/main`, full exact expected SHA matching `GITHUB_SHA`, checkout of that same SHA, project-specific Session Pooler/user/database/TLS validation, standalone password via `PGPASSWORD`, immediate dry-run, explicit `APPLY`, and migration-list read-back.
- Supabase CLI is pinned to 2.122.1. Changes to the CLI major or pin require a separately reviewed change.
- Future main merges alone cannot invoke the repository workflow's Production `APPLY` step; that step is only in the explicitly dispatched, guarded workflow. The separate Supabase provider toggle remains a distinct external control and must remain OFF for the approved manual-only policy.

No Production schema/data, integration setting, credential, Secret, key, signer, customer consent, accounting record, Mainnet/Devnet transaction, or customer/merchant funds were changed in this checkpoint. Local Working Tree state was not available through the connected GitHub API and remains **UNKNOWN**.


## 2026-11-06 — G0 post-toggle repeated main-push verification

### Test conditions
- The project owner reported that Supabase Project Settings → Integrations → GitHub Integration → `Deploy to production` was switched OFF before these pushes.
- The connected Supabase API still does not expose that provider setting for independent read-back; state remains **OWNER-REPORTED OFF / API READ-BACK UNKNOWN**.
- Two ordinary, reviewed PR merges then produced main-branch push events. Neither PR added a Supabase SQL migration file; the Production migration ledger was unchanged before and after.

### Push 1 — PR #367 repository governance
- Main commit: `d06c0546b9813c8cd461d3d7ec7b1ff44be32d4e`, created 2026-11-06 13:47:10 UTC.
- GitHub main-push checks: CI [42228310301](https://github.com/azad2022/solsite/actions/runs/42228310301), Production Build [42228310183](https://github.com/azad2022/solsite/actions/runs/42228310183), and Authentication Build Verification [42228310188](https://github.com/azad2022/solsite/actions/runs/42228310188) all **SUCCESS**.
- Cloudflare Pages Production deployed this exact SHA; deployment `4a24ddc3-50bf-431a-82a3-f7cc0882fac0` completed the deploy stage successfully.
- After Supabase log ingestion caught up, the available post-merge window had normal records across all four sources: edge_logs (3), function_edge_logs (1), function_logs (2), postgres_logs (4).
- Matching internal migration-runner markers (`Cloning git repo`, `Applying migration`, `workflow_run`, `git_ref`) = **0**; PostgreSQL DDL/migration-apply matches = **0**.

### Push 2 — PR #368 Progress Ledger checkpoint
- Main commit: `a39e1e0ce3a697802ac081e7e139201e6a0c5e76`, created 2026-11-06 13:54:16 UTC.
- GitHub main-push checks: CI [42229272509](https://github.com/azad2022/solsite/actions/runs/42229272509), Production Build [42229272508](https://github.com/azad2022/solsite/actions/runs/42229272508), and Authentication Build Verification [42229272541](https://github.com/azad2022/solsite/actions/runs/42229272541) all **SUCCESS**.
- Cloudflare Pages Production deployment `c6fbcb87-088c-464b-90f1-bcfae98ff9ea` was triggered by this exact `main` SHA and completed its deploy stage with status **success**.
- Supabase log coverage after this push was present in all four sources: edge_logs (6), function_edge_logs (1), function_logs (2), postgres_logs (2), from 2026-11-06 13:55:00–13:55:03 UTC.
- Matching internal migration-runner markers = **0**; PostgreSQL DDL/migration-apply matches = **0**.

### Production database read-back
- Supabase Production project `nvopkbiedorfshwbmyhn` remains `ACTIVE_HEALTHY`.
- Migration ledger remains 106 entries; latest remains `20261029140401_solmint_pay_payment_link_rpc_service_role_revoke`.
- No Production Migration `APPLY`, DDL, table/schema/data mutation, provider setting mutation, credential/Secret/Key mutation, or blockchain transaction was performed during these checks.
- Historical 2026-10-27 / 2026-10-28 runner records remain confirmed; historical initiating human/actor remains **UNKNOWN**.

### G0 disposition
- Repository controlled Production migration workflow and fail-closed guard: **PASS** (merged in PR #367; exact main-push CI passed).
- Two post-owner-reported-OFF main pushes with usable Supabase logs and no independent runner/DDL evidence: **PASS for both observed pushes**.
- Production database health and unchanged migration ledger: **PASS**.
- Provider toggle direct API read-back: **UNKNOWN**; dashboard state remains owner-reported OFF.
- The tested effective path shows no recurrence of the independent runner on either post-change main push. Preserve the provider read-back limitation; do not claim the historical actor is identified or that all future configurations are immutable.


## 2026-11-06 — G0 closed; G1 local Program-fork execution plan checkpoint

### G0 — PASS / COMPLETE
- The project owner explicitly confirmed Supabase GitHub Integration → `Deploy to production` is OFF. This is recorded as owner-confirmed (the connected Supabase API cannot independently read the provider toggle).
- Three separate post-change pushes to `main` were observed with normal log coverage in all four Supabase sources and zero independent migration-runner markers / zero PostgreSQL DDL or migration-apply matches: `d06c0546...`, `a39e1e0c...`, and `514d3401...`.
- All exact-main-push CI, Production Build and Authentication Build Verification checks passed; Cloudflare Production deployments for those exact SHAs succeeded.
- Production Supabase remained `ACTIVE_HEALTHY`; migration ledger remained 106 entries, latest `20261029140401`.
- Issue [#355](https://github.com/azad2022/solsite/issues/355) was closed as completed on 2026-11-06 after recording the owner confirmation and three observed test windows. Historical October 2026 runner initiating actor remains **UNKNOWN**; that historical provenance fact is retained and not falsely attributed.

### G1 — local, capability-preserving Program remediation
- Opened tracking issue [#370](https://github.com/azad2022/solsite/issues/370).
- Added `docs/solmint-pay-g1-local-program-remediation-plan.md` in commit `c0aac601188694447f18847562e7ca70eb69efe1` on `feat/pay-subscription-billing`.
- Latest upstream `solana-foundation/subscriptions` read on 2026-11-06 is `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`; Init/Subscribe/Revoke source paths still do not contain the required persistent-generation remediation. Upstream GitHub access is read-only (`push=false`); the local fork plan uses the exact MIT release baseline `364a41976c33347d092902443bbec2def9227e75` and requires retaining its LICENSE/copyright notices.
- The current repository contains a pinned compatibility/attestation/verifier harness and upstream test overlays, but no SolMint-owned Rust Program VNext source or VNext IDL. Test overlays are not treated as a Program fix.
- The capability-preserving decision is reaffirmed: no permanent removal of Resume, immediate cancel, finite Plans, reauthorization, Durable Nonce/smart-wallet flows, sponsorship, Plan edits, all Pullers, split or multi-destination transfers. Each remains blocked from release until protocol enforcement, migration, adversarial tests, independent review and deployed verification pass.
- Mainnet Program ID upgrade is not assumed. Existing ProgramData records a Squads v4 3-of-5 authority with zero-second timelock; member identity/custody and direct SolMint authority to upgrade that Program are not established. The plan therefore uses a SolMint-owned new Program ID as the default independent route unless the existing authorized path is separately proven.
- A new Program ID is a new PDA namespace; existing account state and customer consent do not automatically migrate. The migration design must isolate VNext token authority from old delayed v0.5.0 operations. In particular, reusing a legacy Token Account with its single delegate slot is unsafe until exact old Program account checks and stale-signature interactions are proven; a dedicated customer-owned source account or other independently proven isolation strategy is required.
- Current Subscription branch state: `feat/pay-subscription-billing` HEAD `7340ec8eb27897c814a9feb55215d5e7c2d5e8c3`; main HEAD `514d3401d8d725be106ab0c83557f8e43cdff13e`; merge base `7b975d56860b6d937ad76ab2983c71937644dfa3`. Feature branch is 310 commits ahead / 7 behind; seven overlapping governance paths require reviewed reconciliation. PR #366 remains OPEN / DRAFT / NOT MERGED and GitHub currently reports `mergeable=false`. No reset/force-push/rebase was performed.
- G1 stage status: **G1-0 IN PROGRESS** (baseline/branch recovery). G1-1 to G1-8 **NOT STARTED**. Overall G1 **BLOCKED**; G2 remains PARTIAL / BLOCKED; Subscription runtime/API/schema/Collector/verifier/accounting/billing worker and real Subscription E2E remain NOT IMPLEMENTED.
- No Program source implementation, IDL, migration, runtime/API/DB change, Production DDL/data/provider change, Secret/Key/signer, customer consent, Mainnet/Devnet transaction, Program deployment/upgrade, Squads proposal, accounting posting or fund movement occurred in this planning checkpoint.


## 2026-11-06 — G1-0 source and branch-recovery audit checkpoint

### G0 closure
- G0 is **PASS / COMPLETE** by explicit owner confirmation that Supabase GitHub Integration → `Deploy to production` is OFF, supported by three post-change main-push windows with normal log coverage and zero independent migration-runner markers / PostgreSQL DDL matches.
- Issue [#355](https://github.com/azad2022/solsite/issues/355) is CLOSED / COMPLETED. Historical October runner actor remains UNKNOWN and is retained as historical provenance, not a current G0 blocker.

### Exact source and Program recheck
- Current upstream `solana-foundation/subscriptions` main: `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899` (2026-11-05 18:57:46 UTC).
- The exact current-main source was re-read for `initialize_subscription_authority.rs`, `close_subscription_authority.rs`, `revoke_subscription_authority.rs`, `subscription_authority.rs`, and `subscribe.rs`.
- TM-01 remains uncorrected: Init still approves the derived Authority PDA with `u64::MAX` after the optional account creation branch, including when the PDA already exists; `init_id` remains `Clock::slot as i64`; `UNKNOWN_INIT_ID` still resolves to the landing slot; legacy Init/Close/Revoke discriminators 0/6/14 remain callable and are not generation-bound. Subscribe discriminator 11 still binds the slot-derived `init_id`, not a persistent generation.
- Current v0.5.0 source also confirms the old path requires the subscriber's canonical Associated Token Account in Authority initialization and derives/checks that canonical ATA in transfer helpers. A non-ATA VNext source account may therefore be an isolation candidate, but this is **NOT PROVEN** until exact pinned-source LiteSVM tests demonstrate that every legacy Init/Subscribe/Transfer path rejects it and cannot alter its delegate/balance.
- The official upstream upgrade document says Mainnet Program upgrades are governed by Squads; CI writes the buffer and transfers buffer authority to the Squads vault, then a Squads proposal is approved/executed by the multisig. The previously recorded ProgramData authority is 3-of-5, with member identity/custody UNKNOWN. SolMint must not assume it can upgrade the existing Program ID.
- Upstream GitHub connection is read-only for the upstream repository. Local implementation is therefore the intended route; upstream maintainer acceptance is not a prerequisite for local source work.

### Repository / PR exact state before this documentation checkpoint
- `main`: `514d3401d8d725be106ab0c83557f8e43cdff13e`.
- `feat/pay-subscription-billing`: `7340ec8eb27897c814a9feb55215d5e7c2d5e8c3`.
- Merge base: `7b975d56860b6d937ad76ab2983c71937644dfa3`.
- Branch divergence: 310 commits ahead / 7 behind; PR [#366](https://github.com/azad2022/solsite/pull/366) remains OPEN / DRAFT / NOT MERGED, `mergeable=false`.
- The seven main-side changed paths since the merge base were compared at all three refs. Four are byte-identical between main and the feature branch: Production migration workflow, migration guard, migration guard tests, and workflow test.
- Three paths need manual reconciliation: CI workflow (preserve Subscription jobs and add the main Production CLI job), Production migration policy (retain strict target/CLI guard and update stale G0 wording), and Progress Ledger (retain all feature history and G0 completion evidence).
- A GitHub API attempt to merge `main` into the Subscription feature branch returned HTTP 409 Merge conflict. This failed operation changed no branch ref or file. No force-push, reset, rebase or history deletion was attempted.
- The current exact feature SHA `7340ec8...` has successful quality, SDK compatibility, reproducible build, Mainnet ProgramData, TM-06 rent-refund, TM-07 atomic split-transfer, Production Build, Database Security, Mainnet Read-only and Devnet E2E checks. One Cloudflare Pages check was still IN_PROGRESS at the time of the check; Supabase Preview was SKIPPED by policy. These are checks on `7340ec8...`, not on later documentation commits.

### G1 disposition
- G1-0: **IN PROGRESS / BLOCKED on safe branch reconciliation**.
- G1-1 source vendoring and reproducible baseline build: **NOT STARTED**.
- G1-2 protocol/ABI and migration contract freeze: **NOT STARTED**.
- G1-3 Program VNext implementation: **NOT STARTED**.
- G1-4 legacy migration, G1-5 adversarial proof, G1-6 independent audit, G1-7 Devnet release and G1-8 Mainnet release: **NOT STARTED**.
- Full product capability scope remains retained; no capability is permanently de-scoped. Each capability remains release-blocked until protocol enforcement and its specific migration/test/audit/deployment evidence pass.
- A new Program ID creates a new PDA namespace and does not invalidate old v0.5.0 signed transactions. The preferred independent route is a SolMint-controlled VNext Program ID plus a dedicated customer-owned non-ATA source token account, but this remains a design hypothesis until old-program isolation tests pass. Existing customer funds/consent must never be silently moved or reinterpreted.
- Existing v0.5.0 Plans/Authorities/Subscriptions do not auto-migrate. A new Program ID requires explicit customer-owned asset migration, Merchant Plan recreation and fresh customer consent. If safe token-account isolation cannot be proven, the migration path remains BLOCKED; do not use the legacy ATA for VNext funds.

### Mutation boundary
- This checkpoint is documentation-only on `feat/pay-subscription-billing`.
- No Program source/IDL, SDK, API/runtime, database schema/migration/data, production setting, Secret/Key/signer, customer consent, Mainnet/Devnet transaction, Program deployment/upgrade, Squads proposal, accounting posting or customer funds were changed.
- Local Working Tree remains **UNKNOWN** because the connected GitHub interface does not expose the local filesystem state.
- Next: resolve the three divergent branch files without force-push/rebase, re-run exact-head CI, then begin G1-1 by importing the exact MIT-pinned source and reproducing the unmodified v0.5.0 build before patching it.


## 2026-11-06 — G1-0 branch reconciliation completed; final exact-head CI pending

### Reconciled branch graph
- Main remains `514d3401d8d725be106ab0c83557f8e43cdff13e`; it was not modified.
- Previous Subscription branch HEAD: `298f3a79a357cb28438d70cb953b1ecfcafb4b83`.
- Created a true two-parent merge commit: `4d7fc8a297ff49a5162de8f4fe807a85346b1785`, with the previous feature HEAD as first parent and current main as second parent.
- Advanced `refs/heads/feat/pay-subscription-billing` to the merge commit using a non-force fast-forward update. No history was rewritten or deleted.
- Current comparison: feature branch is 315 commits ahead / 0 behind; merge base is current main `514d3401...`.
- PR [#366](https://github.com/azad2022/solsite/pull/366) remains OPEN / DRAFT / NOT MERGED; GitHub now reports `mergeable=true`.

### Three-file merge resolution
1. `.github/workflows/ci.yml`: preserved all Subscription-specific CI jobs and added the generic `production-migration-cli` job from main, pinned to Supabase CLI 2.122.1.
2. `docs/solmint-pay-production-migration-policy.md`: retained strict Production target/expected-SHA/TLS/CLI controls and added an explicit G0 PASS/COMPLETE disposition based on owner confirmation plus three populated post-change log windows. Earlier interim BLOCKED wording is explicitly superseded.
3. `docs/solmint-pay-progress.md`: retained the full Subscription feature history, incorporated the detailed main-branch G0 post-merge checkpoints, and retained the owner-confirmed G0 closure and G1 plan.

The other four main-side changed paths (Production migration workflow, guard script, guard tests and workflow test) were byte-identical before merge and were preserved unchanged.

### Verification state
- PR mergeability: **PASS** (`mergeable=true`, behind_by=0).
- Branch history preservation: **PASS** (two-parent commit; feature branch is first parent; fast-forward ref update with force=false).
- Exact-head GitHub Actions for merge commit `4d7fc8a...` were triggered. At the first read-back, Devnet E2E, atomic split-transfer, SDK compatibility, pinned CLI, reproducible build, Production Build, Database Security, quality, Mainnet Read-only and Cloudflare Pages were still in progress/queued; Supabase Preview was skipped by policy.
- The plan and Progress Ledger were then updated in documentation-only commit `69ebaf3233d69d9cd99a02ac1c9d30cf648cf060`; therefore only checks on the new exact branch HEAD may be used for final G1-0 CI status.

### G1 status
- G1-0 branch reconciliation: **PASS** for graph reconciliation and PR mergeability; final exact-head CI is **PENDING**.
- G1-1 local MIT source intake / reproducible baseline build: **NOT STARTED**.
- G1-2 protocol and ABI freeze: **NOT STARTED**.
- G1-3 VNext Program implementation: **NOT STARTED**.
- G1-4 legacy migration, G1-5 adversarial proof, G1-6 independent audit, G1-7 Devnet release, G1-8 Mainnet release: **NOT STARTED**.

### Mutation boundary
- Repository changes are confined to `feat/pay-subscription-billing`; `main` is unchanged.
- No Program source/IDL, application runtime, database schema/data, Production configuration, Secret/Key/signer, customer consent, Mainnet/Devnet transaction, Program deployment/upgrade, Squads proposal, accounting entry or customer funds changed.
- Local Working Tree remains **UNKNOWN** through the remote GitHub connector.


## 2026-11-06 — G1-0 complete: branch reconciliation and exact-head CI PASS

- Current `main` remains `514d3401d8d725be106ab0c83557f8e43cdff13e`; no main changes were made.
- Subscription branch `feat/pay-subscription-billing` now includes a true two-parent merge commit `4d7fc8a297ff49a5162de8f4fe807a85346b1785` (feature first parent, main second parent), plus the reviewed documentation/checkpoint commits. No force push, reset, blind rebase or history deletion occurred.
- Current code/test checkpoint SHA tested by GitHub workflows: `f908440cf75b28299b1322e39f1148176e3c7c8c`; compare to main: 317 ahead / 0 behind; merge base equals current main.
- PR #366 remains OPEN / DRAFT / NOT MERGED; exact PR head is mergeable and GitHub reports `mergeable_state=clean`.

### Exact-head evidence for `f908440...`
- CI [42233967558](https://github.com/azad2022/solsite/actions/runs/42233967558): **SUCCESS**, all jobs green. Includes quality (typecheck/build/unit/fail-closed Production migration Guard), SDK compatibility/Workerd/Devnet simulation, reproducible pinned upstream Program build, TM-06 sponsored Plan refund regression, TM-07 atomic split-transfer regression, Mainnet ProgramData read-only, and both CLI 2.122.1 checks.
- Production Build [42233967582](https://github.com/azad2022/solsite/actions/runs/42233967582): **SUCCESS**.
- Ordinary Pay Devnet E2E [42233967417](https://github.com/azad2022/solsite/actions/runs/42233967417): **SUCCESS**; not a real Subscription charge.
- Database Security [42233967519](https://github.com/azad2022/solsite/actions/runs/42233967519): **SUCCESS**.
- Mainnet Read-only [42233967433](https://github.com/azad2022/solsite/actions/runs/42233967433): **SUCCESS**.
- Cloudflare Pages PR check [127947226759](https://github.com/azad2022/solsite/runs/127947226759): **SUCCESS**; this is a preview check, not Production deployment.
- Supabase Preview: **SKIPPED** under the preview-free policy.

### Limits of this checkpoint
- TM-06 and TM-07 regression overlays ran against an ephemeral checkout of pinned upstream v0.5.0. They do not patch the upstream repo or deployed Program.
- Reproducible Program build/Mainnet ProgramData job identify the existing pinned upstream Program, not a VNext Program.
- CreatePlan Devnet validation is simulation-only; no transaction submitted.
- No SolMint-owned Program source/IDL, protocol patch, migration, production subscription runtime, customer consent, signer, Program deploy/upgrade or Mainnet/Devnet transaction was created.
- Local Working Tree remains **UNKNOWN** through the remote GitHub interface.

### G1 status
- G0: **PASS / COMPLETE**; Issue #355 closed following owner confirmation and three post-change populated log windows. Historical runner initiating actor remains UNKNOWN.
- G1-0: **PASS / COMPLETE** (branch graph reconciled, main preserved, PR mergeability restored, exact-head CI and all companion checks succeeded).
- G1-1 local MIT source intake/reproducible baseline: **NOT STARTED**.
- G1-2 protocol/ABI freeze: **NOT STARTED**.
- G1-3 VNext Program implementation: **NOT STARTED**.
- G1-4 legacy migration: **NOT STARTED**.
- G1-5 VNext adversarial proof: **NOT STARTED**.
- G1-6 independent audit: **NOT STARTED**.
- G1-7 Devnet release/migration rehearsal: **NOT STARTED**.
- G1-8 separately authorized Mainnet deployment/migration: **NOT STARTED**.
- G1 overall: **BLOCKED**. The required local Program code, VNext IDL, legacy migration, full adversarial proof, independent audit and deployed verification do not yet exist.
- All product capabilities remain in scope; none has been permanently de-scoped.

No Production DDL/data/provider setting, Secret/Key, signer, customer consent, accounting post, Program upgrade/deployment, Squads proposal, Mainnet/Devnet write or customer fund movement occurred during G1-0.


## 2026-11-06 — G1-1 independent source repository and Cantina residual baseline

### G1-0 exact completion
- Reconciled Subscription branch exact HEAD `f908440cf75b28299b1322e39f1148176e3c7c8c`: all 13 applicable check runs **SUCCESS**; Supabase Preview was **SKIPPED** under policy.
- CI [42233967558](https://github.com/azad2022/solsite/actions/runs/42233967558), Production Build [42233967582](https://github.com/azad2022/solsite/actions/runs/42233967582), Devnet E2E [42233967417](https://github.com/azad2022/solsite/actions/runs/42233967417), Database Security [42233967519](https://github.com/azad2022/solsite/actions/runs/42233967519), Mainnet Read-only [42233967433](https://github.com/azad2022/solsite/actions/runs/42233967433), and Cloudflare Pages PR preview [127947226759](https://github.com/azad2022/solsite/runs/127947226759) all **SUCCESS**.
- PR #366 is OPEN / DRAFT / NOT MERGED, `mergeable=true`, `mergeable_state=clean`; feature branch is 317 commits ahead / 0 behind main.
- G1-0: **PASS / COMPLETE**.

### Independent source repository created
- Created SolMint-controlled public fork: [azad2022/solmint-subscriptions-program](https://github.com/azad2022/solmint-subscriptions-program).
- Fork default `main` tracks upstream latest `4e8cdb4e84d8ac9e2f0fac6ab2ab3510b7254899`; no write was made to upstream.
- Created pristine `solmint/v0.5.0-baseline` and work branch `feat/solmint-g1-authority-vnext`, both at exact immutable `program-v0.5.0` tag commit `364a41976c33347d092902443bbec2def9227e75`.
- Upstream MIT `LICENSE` and copyright notice are retained. Workspace version is `0.5.0-beta.1`; Rust toolchain pin 1.92; Solana CLI pin 3.1.10.
- Documentation-only provenance commit in fork: `d9e18eb3d7a494209aba04efd7c0562f2c942aa4`, file `docs/solmint-security-remediation-baseline.md`.
- Fork PR [#1](https://github.com/azad2022/solmint-subscriptions-program/pull/1) is OPEN / DRAFT, head `d9e18eb...`, base `solmint/v0.5.0-baseline`. Fork PR CI is pending at this checkpoint.
- No Program source, IDL, Program ID, keypair, signer, deployment, upgrade or transaction was changed/created.

### Pinned baseline reproducible build
- SolMint CI run [42233967558](https://github.com/azad2022/solsite/actions/runs/42233967558), job `subscription-reproducible-build`: **SUCCESS** for exact source commit `364a419...`.
- Sanitized artifact: `solmint-subscription-reproducible-build`, artifact ID `13510673502`.
- `solana-verify` 0.5.2; Solana CLI 3.1.10; repository rust-toolchain 1.92; SBF build-container Rust 1.86.0.
- Docker digest: `sha256:f71be5ca7620b7e40933b7f1294fa44e01d08c1fc5ba1f375a2478f5a01580d3`.
- Baseline ELF SHA-256: `056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318`.
- Baseline IDL SHA-256: `1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa`.
- These identify the unmodified upstream v0.5.0 baseline only; they are not VNext build or deployment evidence.

### Cantina report residuals to close
The attached Cantina Managed report dated 2026-07-30 records 9 findings: 4 Fixed and 5 Acknowledged. G1 must close the acknowledged residuals rather than treating acknowledgement as a fix:
- High old signed create bundle restores revoked Authority / `u64::MAX` approval — acknowledged, not fixed.
- Medium stale Authority Init/Close/Revoke approvals are not generation-bound — acknowledged, not fixed.
- Medium CancelSubscriptionNow uses timestamp binding, not a unique incarnation; same-second replay remains a required test.
- Medium Resume uses expected expiry timestamp but lacks persistent monotonic cancellation revision; collision/replay remains a required test.
- Medium Subscribe can accept a finite Plan without a complete first period remaining; must be fixed without changing agreed billing semantics.
- Low automatic rent sponsorship remains a product feature but must become explicit/bounded with recoverable sponsor terms and quotas.
- UpdatePlan stale approvals, optional CreatePlan payer/IDL and IDL generation failure were previously verified fixed; their regression tests must remain.

### Isolation hypothesis
- Leading VNext route: new Program ID + customer-owned dedicated non-ATA source token account, with VNext Authority bound to that exact source account.
- **NOT PROVEN**: G1-5 must demonstrate using exact v0.5.0 source/binary in LiteSVM that every old Init/Subscribe/Fixed/Recurring/Transfer path rejects or cannot mutate/debit the VNext non-ATA account.
- A new Program ID does not invalidate old signed transactions against legacy ATAs. Legacy Plans, Subscriptions and funds require explicit user/merchant migration and fresh consent. The old Program remains active for legacy accounts.
- Reusing the existing Program ID requires its existing Squads upgrade authority; no governance bypass is permitted.

### Current G1 state
- G1-0: **PASS / COMPLETE**.
- G1-1: **IN PROGRESS** — independent fork, immutable source baseline, MIT provenance and reproducible baseline build established; fork PR CI and source-level VNext implementation are pending.
- G1-2 protocol/ABI freeze; G1-3 Program implementation; G1-4 legacy migration; G1-5 adversarial proof; G1-6 independent audit; G1-7 Devnet release; G1-8 separately authorized Mainnet deployment/migration: **NOT STARTED**.
- G1 overall: **BLOCKED** until VNext source/IDL, explicit migration, adversarial proof, independent audit and deployment evidence are complete.

No Production database/configuration, Secret/Key/signer, customer consent, accounting entry, Mainnet/Devnet write, Program deployment/upgrade, Squads proposal or customer funds changed in this checkpoint. Local Working Tree remains UNKNOWN through the GitHub connector.


## 2026-11-06 — G1 source ownership / Mainnet governance evidence finalized

### Exact latest SolMint branch checks
- Current Subscription branch checkpoint before this ledger append: `bb0bf34ded4bd60778cc066fae695e640e6ae234`.
- Compare to main: 321 commits ahead / 0 behind; PR #366 remains OPEN / DRAFT / NOT MERGED / `mergeable=true` / `mergeable_state=clean`.
- Exact-head check runs on `bb0bf34...`: CI [42234908113](https://github.com/azad2022/solsite/actions/runs/42234908113), Production Build [42234908355](https://github.com/azad2022/solsite/actions/runs/42234908355), Database Security [42234908078](https://github.com/azad2022/solsite/actions/runs/42234908078), Mainnet Read-only [42234908260](https://github.com/azad2022/solsite/actions/runs/42234908260), Devnet E2E [42234908087](https://github.com/azad2022/solsite/actions/runs/42234908087), and Cloudflare Pages preview [127950577448](https://github.com/azad2022/solsite/runs/127950577448) all **SUCCESS**.
- CI included quality, SDK compatibility, pinned reproducible Program build, TM-06 sponsored Plan refund, TM-07 atomic split-transfer, Mainnet ProgramData and both pinned CLI checks. Supabase Preview was **SKIPPED** under policy.
- This is the latest fully checked code/docs checkpoint; the following Progress Ledger append is documentation-only and will receive its own exact-head checks.

### Mainnet ProgramData / governance read-only evidence
The successful ProgramData artifact `solmint-subscription-mainnet-programdata` (run `42233967558`, observed at `2026-11-06T14:28:55.800Z`, finalized mainnet-beta) recorded:
- Existing Program ID: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`.
- ProgramData address: `HaYb5J9eXooZuNzN3z6TfuzVDcaTfiDdDPWCFtexFfMg`.
- Upgrade authority is the Squads V4 vault `DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv`.
- Squads state `4CxQs26DewQ1KaCHfyyjktkYjndNdUqCJvVdygtJFwcJ`: threshold **3-of-5**, five members, read-only finalized state.
- Mainnet ELF SHA-256 matches pinned build: `056ca97cf3ee6586650275ce819d026f7369de0172dc54010fa6dc58180e0318`.
- On-chain IDL SHA-256 matches pinned IDL: `1522580389fe155633e37682b91488df7cf6c7b3ba5a6cb3ba0e5ae00ffe89aa`.

This confirms an upgrade of the old Program ID requires Squads governance and cannot be done unilaterally by SolMint. No proposal or vote was created. A new Program ID is the independent path, subject to separate key custody and deployment approval.

### Fork-native CI limitation
- Fork Actions permissions read returned `enabled=true`, `allowed_actions=all`.
- The workflow-list API returned zero workflows even though workflow files exist in the fork's default `main` and work branch; workflow enable/dispatch calls returned 404; no fork PR checks were observed.
- Status: **UNKNOWN / CONNECTOR OR GITHUB WORKFLOW DISCOVERY BLOCKED**. Do not infer Actions are disabled. The exact baseline build is already verified by SolMint's active CI; extend that CI to checkout the fork's exact VNext SHA for subsequent builds/tests until fork-native Actions is demonstrably available.

### G1 disposition
- G0: **PASS / COMPLETE**.
- G1-0: **PASS / COMPLETE**.
- G1-1: **IN PROGRESS** — independent MIT fork, immutable source baseline and reproducible baseline build established; fork-native CI visibility remains UNKNOWN.
- G1-2 through G1-8: **NOT STARTED**.
- No VNext Program source/IDL patch, Program ID/keypair, signer, deployment, upgrade, Squads proposal, Devnet/Mainnet transaction, Production DB/configuration, customer consent, accounting posting or customer funds were changed.


## 2026-11-06 — G1-2 initial protocol/ABI design draft

### Repository and CI evidence at this checkpoint
- SolMint Pay branch: `feat/pay-subscription-billing`, live branch ref observed at `275b6de52220a65e8ac964825d90a5d6bd95d9ce`.
- GitHub compare against `main` reports the feature branch 323 commits ahead and 0 behind at this observation. PR #366 remains OPEN according to the current issue/PR record; local Working Tree remains UNKNOWN through the remote connector.
- Five workflow runs associated with the exact SolMint branch SHA `275b6de...` were observed completed SUCCESS: CI `42235588237`, Production Build `42235588281`, Database Security `42235588307`, ordinary Pay Devnet E2E `42235588185`, and Mainnet Read-only `42235588197`. These are SolMint repository checks; the ordinary Pay Devnet flow is not a VNext Subscription E2E test.
- Fork work branch: `feat/solmint-g1-authority-vnext`, prior HEAD `d9e18eb3d7a494209aba04efd7c0562f2c942aa4`. The baseline branch remains pinned to `364a41976c33347d092902443bbec2def9227e75`.
- Added `docs/solmint-vnext-protocol-design.md` on the Fork work branch. Commit: `7d7efe9914cde403e1a851e3a39fb5d8a004df95`. The created file was fetched back and verified. It records source-verified v0.5.0 behavior, the supplied Authority Consent Registry identity tuple `(subscriber, mint, source_token_account)`, lifecycle invariants, source-account isolation hypothesis, ABI compatibility constraints, migration/test gates, and unresolved decisions.
- The design file is explicitly **DRAFT — NOT FROZEN**. The supplied G1 prompt available in this session ends after the word “حداقل” in §7.1; required Registry fields and subsequent sections are absent. No missing field, seed prefix, discriminator, counter width, deadline limit or ABI byte offset was invented.
- Fork workflow-run discovery for the new commit `7d7efe9...` returned no runs; combined status also returned no status contexts. Fork CI is therefore **UNKNOWN**, not PASS. Existing progress-documented fork-native workflow visibility limitation remains.
- No runtime Rust source, account layout, instruction data, discriminator, IDL or client code changed. No tests were executed for this document-only checkpoint.

### G1 disposition
- G1-0: **PASS / COMPLETE** (per latest recorded baseline checkpoint).
- G1-1: **IN PROGRESS** — independent MIT source fork and reproducible v0.5.0 baseline remain established; fork-native CI visibility is UNKNOWN.
- G1-2: **IN PROGRESS — DRAFT ONLY**. Protocol design document exists but ABI is not frozen; the prompt continuation and open design decisions are required before assigning byte-level ABI.
- G1-3 Program implementation: **NOT STARTED**.
- G1-4 migration: **NOT STARTED**.
- G1-5 adversarial proof: **NOT STARTED**.
- G1-6 independent audit: **NOT STARTED**.
- G1-7 Devnet release/rehearsal: **NOT STARTED**.
- G1-8 Mainnet deployment/migration: **NOT STARTED**.
- G1 overall: **BLOCKED**.

No Production DDL/data/provider setting, Secret/Key/signer, customer consent, accounting post, Program ID, keypair, deployment/upgrade, Squads proposal, Devnet/Mainnet write or customer funds were changed. Local Working Tree remains UNKNOWN through the remote GitHub connector.


## 2026-11-06 — G1-3 initial Authority lifecycle implementation checkpoint

### Exact repository state
- SolMint Pay repository: `azad2022/solsite`, branch `feat/pay-subscription-billing`.
- Current branch commit at this append: `d3569a7116deae9fede54cda1032cc180f39e006`.
- PR #366 remains OPEN / DRAFT / NOT MERGED. Local Working Tree remains UNKNOWN through the remote connector.
- Independent Program fork: `azad2022/solmint-subscriptions-program`.
- Work branch: `feat/solmint-g1-authority-vnext`, exact HEAD `6f2379ddca4f7bbd5332fbe4df0a2eaba50a2d64`.
- Pristine baseline branch remains at `364a41976c33347d092902443bbec2def9227e75`. Compare reports the work branch 46 commits ahead and 0 behind at this checkpoint. Baseline source branch was not changed.
- Fork PR #1 remains OPEN / DRAFT / NOT MERGED; current PR changed-file list contains 17 files. The PR description was updated to describe the actual runtime/state changes and blockers.

### Implemented source slice — not yet verified by execution
Added or modified:
- `program/src/state/authority_consent_registry.rs`: persistent Registry keyed by exact `(subscriber, mint, source_token_account)`, version 1, 188 bytes, discriminator 5, authority generation, independent authorize/revoke nonces and checked 24-hour action deadline.
- `program/src/state/vnext_subscription_authority.rs`: 204-byte, tuple-bound VNext delegate Authority, discriminator 8.
- `program/src/state/subscription_lifecycle_registry.rs`: 116-byte persistent Subscription revision state, discriminator 6.
- `program/src/state/plan_revision_registry.rs`: 116-byte persistent Plan revision state, discriminator 7.
- `program/src/instructions/authorize_subscription_authority_vnext.rs` and `revoke_subscription_authority_vnext.rs`: instruction handlers for explicit authorize/revoke, tombstone invalidation, exact non-ATA source validation, token-program/mint checks, foreign-delegate rejection, and Authority rent return to its recorded payer.
- `program/src/instructions/authority_consent.rs`: 24-byte action payload.
- `program/src/instructions/mod.rs`, `program/src/entrypoint.rs`, `program/src/errors.rs`, `program/src/state/common.rs`, `program/src/state/mod.rs`: new instruction discriminators 18/19, account discriminators 5–8, error codes 138–154, exports and dispatch.
- `idl/subscriptions.json`: initial account, PDA, instruction, payload and error definitions.
- `tests/integration-tests/src/test_vnext_authority_consent.rs`: three LiteSVM cases authored and registered: authorize→revoke, revoke tombstone before stale authorize, and ATA rejection.
- `docs/solmint-vnext-protocol-design.md`: updated with selected Registry/Authority account layouts and authorize/revoke instruction payload/account order.

### Important boundaries and unimplemented integration
- Subscription lifecycle and Plan revision Registry structs are state foundations only; current Subscribe, Cancel, CancelNow, Resume, UpdatePlan, DeletePlan and related close/recreate paths do not yet allocate or consume them.
- No VNext Subscription transfer instruction exists. The future transfer path must validate Registry status/generation, Authority identity and source token account on every transfer path before the approved `u64::MAX` delegate can be used safely.
- The non-ATA boundary remains **unproven** until exact old v0.5.0 Program/binary LiteSVM adversarial tests prove the legacy Program cannot approve, mutate or debit a VNext source account.
- No legacy migration or v0.5.0 account fixture migration exists.
- `program/src/lib.rs` still declares the legacy Program ID. No new Program ID/keypair has been created; no Program deployment/upgrade or chain write was performed.
- No independent security audit has reviewed these new source changes.

### Test and CI evidence
- Existing SolMint workflows on the previous SolMint branch head `040ee468f4874c1bf4d6e364b23fe4a7768a06f9` completed SUCCESS: Production Build `42256848064`, Database Security `42256847930`, Mainnet Read-only `42256848088`, and ordinary Pay Devnet E2E `42256848035`. These are not VNext Program tests; the ordinary Pay Devnet E2E is not a Subscription transaction.
- Earlier VNext CI attempts on older Fork SHAs stopped at Rust formatting and skipped all tests. Formatting corrections were subsequently committed, but a successful exact-SHA VNext CI result is not yet available.
- The current `subscription-vnext-authority-registry` job is configured to checkout exact Fork SHA `6f2379ddca4f7bbd5332fbe4df0a2eaba50a2d64`, check Rust formatting, run Program unit tests, build SBF with checksum-pinned `solana-verify 0.5.2`, execute the full LiteSVM suite, regenerate Codama IDL, and compare the generated IDL. GitHub Actions has not returned a run/check for this latest SolMint commit at the time of this ledger append. Thus formatting, Rust compile/tests, SBF build, LiteSVM execution and generated-IDL match are **UNKNOWN**, not PASS.
- Fork-native Actions workflow discovery continues to return no runs/status contexts. It remains UNKNOWN; the Solsite workflow is the current cross-repository verification path.

### G1 disposition
- G1-0: **PASS** (per the verified baseline-recovery checkpoint).
- G1-1: **BLOCKED** — immutable MIT fork and original baseline build are established; latest VNext source CI evidence is still UNKNOWN.
- G1-2: **BLOCKED** — Authority Registry/Authority and authorize/revoke ABI slices are specified; complete Subscription, Plan, transfer and migration ABI is not frozen.
- G1-3: **BLOCKED** — initial Authority state/handlers/dispatch and test source exist, but exact-source compile, SBF and LiteSVM execution have not passed.
- G1-4: **NOT IMPLEMENTED** — legacy migration/recovery.
- G1-5: **NOT IMPLEMENTED** — complete adversarial proof and exact old-program isolation suite.
- G1-6: **NOT IMPLEMENTED** — independent audit.
- G1-7: **NOT IMPLEMENTED** — Devnet deployment/rehearsal.
- G1-8: **NOT IMPLEMENTED** — separately authorized Mainnet deployment/migration.
- G1 overall: **BLOCKED**.

No Production DDL/data/provider setting, secret/key/signer, customer consent, accounting posting, Program ID/keypair, deployment/upgrade, Squads proposal, Devnet/Mainnet transaction or customer funds were changed.
## 2026-11-06 — G1-3 CI failure analysis and test-fixture remediation

### Live repository state
- SolMint repository: azad2022/solsite, branch feat/pay-subscription-billing, PR #366 OPEN / DRAFT / NOT MERGED.
- Exact latest SolMint PR head after CI workflow remediation: 30dbfbd47a287bc9081716e93c5fa0c8803187aa.
- Compare against current main: 347 commits ahead / 0 behind at this observation; GitHub reports mergeable=true. Local Working Tree remains UNKNOWN through the remote connector.
- Fork: azad2022/solmint-subscriptions-program, branch feat/solmint-g1-authority-vnext, exact PR #1 head 628a5c3a829eb43a95eb7f99bdf9844522f9115a, 64 commits ahead / 0 behind immutable baseline 364a41976c33347d092902443bbec2def9227e75. PR #1 OPEN / DRAFT / NOT MERGED.

### Actual code and CI findings
- The fork already contains the first Authority lifecycle implementation: persistent 188-byte Authority Consent Registry, 204-byte tuple-bound VNext Authority, authorize/revoke handlers (instruction discriminators 18/19), dispatch and IDL entries, and three LiteSVM integration cases. This is an existing source checkpoint, not newly created in this append.
- Exact Fork source commit bc6f7d17b588318f29f76a47324d0cd1dfb796f0 passed Rust formatting, Program unit tests and deterministic SBF build in SolMint CI run 42258807894. Its LiteSVM integration suite failed: 271 tests passed and six existing Token-2022 TransferHook tests failed because tests/transfer-hook-example/target/deploy/transfer_hook_example.so was absent. The six failures occurred in tests/integration-tests/src/utils/test_helpers.rs when loading the fixture; they were not failures in the three VNext Authority tests.
- That same run exposed one Rust test compile error at test_vnext_authority_consent.rs:202 (COption<Address> compared to Option). Fixed by using source_state.delegate.is_none(); Fork commit 628a5c3a829eb43a95eb7f99bdf9844522f9115a.
- SolMint CI workflow was updated to build the isolated tests/transfer-hook-example fixture with the pinned solana-verify tool before running the full LiteSVM suite. Workflow change commit: 30dbfbd47a287bc9081716e93c5fa0c8803187aa.
- Exact-head CI for 30dbfbd... is currently running as 42260169672. At this ledger update, quality, SDK compatibility, and migration CLI jobs were SUCCESS; VNext SBF/test job and other full-CI jobs were still IN PROGRESS. No exact-head VNext LiteSVM PASS is claimed yet.
- Local clone/test execution was unavailable in this environment because outbound DNS/network access to GitHub was unavailable; verification is being performed through the repository's pinned GitHub Actions workflow.
- The fork's native Actions discovery remains UNKNOWN; SolMint CI is the cross-repository verification path.

### Scope gaps found by source inspection
- Subscription lifecycle Registry (148-byte v1 account) and Plan revision Registry (116-byte v1 account) currently exist as state foundations and have unit tests, but are not yet wired into actual Subscribe, Cancel, CancelNow, Resume, UpdatePlan, DeletePlan or re-subscribe runtime transitions.
- No VNext subscription transfer path currently consumes Registry status/generation and tuple-bound Authority on every token movement. The approved delegate amount remains u64::MAX; it must not be treated as product-ready or used by a merchant billing flow until every transfer path enforces the live Registry/Authority lineage.
- The old Program ID is still declared in program/src/lib.rs. No new Program ID/keypair was created. The existing Mainnet Program ID is governed by the recorded Squads V4 3-of-5 path; no deployment or upgrade is authorized.
- The non-ATA isolation hypothesis, legacy migration, exact old-program adversarial tests and independent audit remain unproven/not implemented.

### G1 disposition
- G1-0: PASS / COMPLETE (per prior verified baseline checkpoint).
- G1-1: IN PROGRESS — independent MIT fork and pinned baseline established; native Fork CI visibility UNKNOWN.
- G1-2: BLOCKED / PARTIAL — Authority account/instruction slice specified; complete Plan/Subscription/transfer/migration ABI is not frozen.
- G1-3: BLOCKED / IN PROGRESS — Authority runtime slice exists; exact build and unit tests pass on prior Fork SHA, but full LiteSVM suite has not passed. CI fixture remediation is running on exact current SolMint PR head.
- G1-4 legacy migration: NOT IMPLEMENTED.
- G1-5 adversarial isolation/regression proof: NOT IMPLEMENTED.
- G1-6 independent audit: NOT IMPLEMENTED.
- G1-7 Devnet deployment/rehearsal: NOT IMPLEMENTED.
- G1-8 Mainnet deployment/migration: NOT IMPLEMENTED.
- Overall G1: BLOCKED.

No Production DDL/data/provider setting, secret/key/signer, customer consent, accounting posting, Program ID/keypair, Program deployment/upgrade, Squads proposal, Devnet/Mainnet transaction or customer funds were changed. Local Working Tree remains UNKNOWN.