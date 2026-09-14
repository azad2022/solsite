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
- SolMint Pay Mainnet Read-only passed.
- SolMint Pay Production API Smoke passed.

Conclusion: the long-running **Devnet E2E funding/transaction-observation blocker is closed and must not be re-investigated unless a new regression appears**.

## 2026-09-14 — Production API origin gate closed

Status: **COMPLETED**

Merged PR: `#81`

Validated:

- Production Pages configuration contains the real `PAY_APP_ORIGIN` value used by the authenticated Pay API origin check.
- Production API smoke was rerun after deployment and passed.
- The earlier `403 ORIGIN_FORBIDDEN` result was a pre-deployment/stale-environment observation and is not the current production blocker.

## 2026-09-14 — Repository migration history reconciliation

Status: **VALIDATION IN PROGRESS**

PR: `#82` — `fix(pay): reconcile repository migration history with live Supabase`

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

The first CI implementation correctly detected that the branch contained six stale/duplicate Better Auth/identity filenames while the canonical production filenames were missing. This was a repository lineage issue, not a reason to weaken the gate.

The corrected branch now restores the exact production-recorded filenames using the verified historical blobs and removes the redundant unsuffixed duplicate. The repository may also contain strictly newer migrations that have not yet been applied to Production; these are treated as **pending repository migrations** and are allowed only after the recorded Production ledger boundary.

The current newer repository migration `20260911103000_pay_webhook_read_projection.sql` is therefore intentionally retained as pending and is not claimed as production-applied.

### Validation evidence

- Earlier `CI` — **GREEN** on the pre-fix reconciliation commit.
- Earlier `Production Build` — **GREEN** on the pre-fix reconciliation commit.
- Earlier `SolMint Pay Database Security` — **GREEN** on the pre-fix reconciliation commit.
- The first version of the new migration-chain gate **FAILED CORRECTLY** by detecting repository/ledger filename drift.
- The gate logic was repaired to distinguish exact Production history from newer pending repository migrations without weakening the historical boundary.
- Canonical migration filename restoration is committed on the PR branch; fresh CI validation of this final repair is required before marking this checkpoint completed.

## Next unreleased Pay gate

After PR #82 passes its final validation and is merged, move to **authenticated merchant lifecycle and production-safe merchant credentials** (Issue #68 acceptance path).

The repository currently exposes the real server-mediated contracts for:

- merchant read/create
- wallet challenge/verification
- API-key list/create/revoke/rotate
- Payment Intent read

Do not expand the Pay UI surface until these contracts are verified against authentication, authorization/merchant isolation, idempotency and deployment evidence.

## Explicitly not complete yet

Do not mark Pay production-ready. Remaining release gates include the authenticated production merchant path with a controlled account, wallet ownership lifecycle evidence, API credential authorization E2E, controlled non-production Payment Intent lifecycle, adversarial verification cases, final release audit, and branch-protection enforcement.

## Working rule

Before starting a new Pay task:

1. Read this ledger and the master specification.
2. Check the current `main` HEAD and relevant CI evidence.
3. Revalidate the real backend/database contract for the requested capability.
4. Never repeat the Devnet funding/observation work unless CI demonstrates a regression.
5. Do not add Supabase Preview Branching as a prerequisite for Pay delivery.
