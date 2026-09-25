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
