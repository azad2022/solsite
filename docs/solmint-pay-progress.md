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

## Current Pay next gate

The next gate is the **Wallet Ownership Lifecycle** validation followed by the funded Devnet Payment Intent reconciliation lifecycle.

The Wallet Ownership gate must validate:

- unauthenticated access rejection;
- trusted-origin enforcement;
- cross-merchant isolation;
- wallet mismatch;
- signature tampering;
- successful Ed25519 verification;
- replay rejection;
- concurrent double-consume atomicity;
- expiry enforcement;
- error redaction.

After Wallet Ownership is green, proceed to the **funded Devnet Payment Intent reconciliation lifecycle** around the existing verification/reconciliation engine.

The intended reconciliation gate will validate real finalized Devnet blockchain data through the existing provider and reconciliation code, without inserting synthetic financial state into Production.

Target evidence:

`real Devnet transaction → finalized observation → reference discovery → deterministic verification → reconciliation confirmed → duplicate/replay rejected`

After that gate is green, proceed to adversarial verification evidence:

- underpayment
- overpayment
- wrong token
- wrong recipient
- wrong reference
- duplicate/replay
- ambiguous discovery
- expired intent
- RPC failure
- incomplete transaction discovery

The frontend must continue to consume backend-authoritative state and must never infer payment success from a submitted signature, reference, webhook, or browser state.

The obsolete Cloudflare `Workers Builds: solsite` check remains an external dashboard issue. The Supabase Preview check remains skipped by project configuration and is not a delivery prerequisite under the committed preview-free constraint.

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
