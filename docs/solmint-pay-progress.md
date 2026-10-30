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
- Compare confirms release commit `364a41976c33347d092902443bbec2def9227e75e` is 8 commits after the remediation commit. The release delta includes Rust program instructions/state/transfer helper changes, IDL changes, SDK changes and integration tests. The release binary's full audit coverage is therefore not established by the remediation marker alone.
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

