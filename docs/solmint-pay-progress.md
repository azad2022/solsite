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
- Production migration ledger reports **69 applied migration versions**, from `20260829090000` through `20260911061000`.
- Repository migration history was reconstructed from the live ledger and verified historical Git sources.
- The live database was **not** migration-repaired or otherwise mutated by this repository-only reconciliation.
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

The first CI implementation **failed correctly** by detecting six stale/duplicate Better Auth/identity filenames in the branch while the canonical production names were missing. The test was not weakened.

A second issue in the new gate was also corrected: version-boundary comparison now uses numeric 14-digit migration timestamps so newer pending migrations are not rejected accidentally.

The migration lineage was then corrected using verified historical blobs: the exact production names are restored, redundant unsuffixed files are removed, and the strictly newer repository migration `20260911103000_pay_webhook_read_projection.sql` remains as an explicit pending migration because it is newer than the current Production ledger boundary.

### Final validation evidence

- `SolMint Pay Database Security` #283 — **GREEN**: migration-chain integrity, identity/RLS security, and API-key lifecycle security all passed.
- `CI` #2100 — **GREEN**: typecheck, production build, unit tests, and source-tree invariant all passed.
- `Production Build` #1778 — **GREEN**.
- Cloudflare Pages preview deployment for the final PR head — **successful**.
- Repository code search found no remaining references to the removed legacy identity migration filename.
- PR #82 was merged successfully as `16e8dfaf51a948920e1375f04db969d0fc86a411`.

This checkpoint is now **completed**. The live Production database remains unchanged by this PR.

## 2026-09-14 — API credential security gate hardening

Status: **COMPLETED**

Merged PR: `#83`

Merge commit on `main`: `6b5cc0f2e31a461f739ab5aa13a40444cb8c3751`

Scope: close the repository/runtime security gaps found during Issue #68 acceptance work without inventing a new API contract or changing financial rules.

Validated before merge:

- Pay runtime no longer logs upstream Supabase response bodies on error. Only non-sensitive scope/status context is retained, preventing an accidental upstream payload from exposing API-key material to logs.
- A dedicated regression test proves secret-looking upstream error payloads are not emitted through the Pay database error logger.
- Production API smoke now explicitly verifies that API-key list/create endpoints fail closed on an untrusted `Origin` before authentication is attempted.
- `CI` #2103 — **GREEN**.
- `Production Build` #1781 — **GREEN**.
- `SolMint Pay Production API Smoke` #59 — **GREEN**.
- `SolMint Pay Devnet E2E` #287 — **GREEN**.

Conclusion: the **API credential runtime-redaction and origin-gate hardening stage is fully passed** and must not be repeated unless a regression appears.

## Cloudflare Workers Builds — identified external deployment integration

Status: **EXTERNAL / NOT A REPOSITORY FAILURE**

Evidence on the relevant commits shows two separate Cloudflare check runs from the same Cloudflare GitHub App:

- `Cloudflare Pages` deploy — **success**.
- `Workers Builds: solsite` — **failure**, pointing to a separate Cloudflare Worker service named `solsite`.

The repository is configured for Cloudflare Pages, not for that separate Worker service. No GitHub Actions workflow in the repository owns the `Workers Builds: solsite` check.

Required remediation is therefore a Cloudflare Dashboard integration action: disconnect the obsolete `Workers Builds` integration for that Worker service. Repository code must not be changed or a fake Worker created merely to make this unrelated check green.

## 2026-09-14 — Better Auth production session-boundary correction

Status: **COMPLETED**

Scope: align the shared application authentication boundary with the actual Better Auth cookie emitted by the deployed production runtime.

Evidence:

- Production sign-in for the controlled E2E account returns HTTP 200 and a Better Auth session cookie.
- The production cookie name observed in the authenticated smoke path is `__Secure-__Host-solmint_auth_session`.
- The shared auth boundary was corrected to recognize the deployed prefixed cookie form at the Better Auth session boundary.
- Authenticated production E2E subsequently passed on `main`, confirming the deployed runtime serves the corrected boundary.

## 2026-09-15 — Authenticated API credential lifecycle gate closed

Status: **COMPLETED**

Merged PR: `#85`

Merge commit on `main`: `ab6d4713c543338b51aeaf8b62b99ccb5d755636`

Final production evidence:

- `SolMint Pay Authenticated API-Key E2E` run **#9** succeeded on `main` at the merge commit.
- Workflow event was `workflow_dispatch`; no push-triggered production test was introduced.
- Controlled production E2E covered authentication/session establishment, merchant authorization, create/list, idempotent replay, concurrency, wrong-scope rejection, cross-merchant IDOR rejection, rotation, old-secret rejection, rotation replay, revoke, post-revoke rejection, expiry, and plaintext-secret handling.
- The source-tree invariant passed after the E2E run.
- The runtime API-key redaction/origin hardening gate had already passed separately.
- Issue **#68** is now closed as completed.
- Superseded PR **#84** is closed; its rotation-replay fix is included in the integrated lifecycle gate.

Conclusion: the **production API credential lifecycle acceptance gate is closed**. This does not mark SolMint Pay production-ready.

## Current Pay next gate

The next unreleased engineering gate is **wallet ownership lifecycle evidence**, followed by the controlled non-production Payment Intent lifecycle and the final release audit/security gate.

The remaining broader release requirements are:

- wallet ownership challenge/verification lifecycle against the real backend contract
- controlled non-production Payment Intent lifecycle
- adversarial payment verification cases
- reconciliation/accounting/webhook/idempotency/rate-limit final evidence where applicable
- runtime smoke and rollback readiness
- branch-protection enforcement
- final SolMint Pay production release audit

The obsolete Cloudflare `Workers Builds: solsite` integration remains an **external dashboard issue**, not a repository implementation blocker.

## Explicitly not complete yet

Do not mark Pay production-ready. The API credential lifecycle gate is complete, but the broader Pay release gate is still open until the remaining wallet, Payment Intent, verification, security/audit, deployment, runtime and branch-protection evidence is green.

## Working rule

Before starting a new Pay task:

1. Read this ledger and the master specification.
2. Check the current `main` HEAD and relevant CI evidence.
3. Revalidate the real backend/database contract for the requested capability.
4. Never repeat the Devnet funding/observation work unless CI demonstrates a regression.
5. Do not add Supabase Preview Branching as a prerequisite for Pay delivery.
6. Record a gate as **COMPLETED** only after the relevant implementation, validation, and release evidence are actually green.
