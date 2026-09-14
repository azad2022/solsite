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

## 2026-09-14 — Repository migration history reconciliation prepared

Status: **OPEN / VALIDATION IN PROGRESS**

PR: `#82` — `fix(pay): reconcile repository migration history with live Supabase`

Current head: `2b56369ce038060f3910da74c330af752b75b0d4`

Live database evidence used for reconciliation:

- Live Supabase project: `nvopkbiedorfshwbmyhn`.
- Production migration ledger reports **69 applied migration versions**, from `20260829090000` through `20260911061000`.
- Repository migration history was reconstructed from the live ledger and verified historical Git sources.
- The live database was **not** migration-repaired or otherwise mutated by this repository-only reconciliation.
- The incorrect local `20260905000100` mapping was corrected; `20260905000200` and `20260905000300` were restored.
- The three Better Auth migrations around `20260907171423` / `20260907171436` / `20260907171450` were corrected to the exact live timestamp/name mapping.
- Non-live root migration `20260906000001` is removed from the active chain in favor of the live `20260906135730` migration.

Validation already passed on the corrected PR head:

- GitHub `CI` — **GREEN**
- `Production Build` — **GREEN**
- `SolMint Pay Database Security` — **GREEN**

## Supabase Preview Branching decision

Status: **NOT USED / NOT A PROJECT PREREQUISITE**

The project will not depend on Supabase Preview Branching/Preview Database for migration validation.

Project constraint: the maintainer does not have access to a credit card and cannot pay for a Supabase Pro/Branching environment. Therefore Preview Branching must not be introduced as a required gate, and the team must not create a paid dependency merely to validate Pay changes.

This is a delivery constraint, not a security exception. Production database/RLS remains authoritative, and validation must stay fail-closed through repository evidence plus isolated CI environments.

## Preview-free validation path

The replacement path is:

1. Keep the production migration ledger as the source of truth for the expected migration history.
2. Validate repository migration filename/order integrity in GitHub CI.
3. Run Pay database security/adversarial SQL against an isolated disposable PostgreSQL instance in CI.
4. Run CI/typecheck/unit tests and Production Build on the same change.
5. For blockchain behavior, use the already-validated dedicated Devnet E2E path and the existing Mainnet read-only/runtime smoke checks.
6. Do not use public RPC/faucet fallback as a production test assumption.
7. Do not run `supabase migration repair` against production unless a later, explicit, evidence-backed reconciliation requires it.

This path intentionally does **not** claim that a plain disposable PostgreSQL instance is equivalent to Supabase Preview. It provides independent deterministic validation for the checks that can be reproduced safely without a paid Supabase branch.

## Current next stage

After PR #82 validation/merge, move to the next unreleased Pay product gate: **authenticated merchant lifecycle and production-safe merchant credentials**.

The repository currently exposes the real server-mediated contracts for:

- merchant read/create
- wallet challenge/verification
- API-key list/create/revoke/rotate
- Payment Intent read

The next implementation/audit cycle must verify these contracts end-to-end against the real backend, authentication boundary, authorization/merchant isolation, idempotency, and deployment evidence before expanding the UI surface.

## Explicitly not complete yet

Do not mark Pay production-ready. Remaining release gates include the authenticated production merchant path with a controlled account, wallet ownership lifecycle evidence, API credential authorization E2E, controlled non-production Payment Intent lifecycle, adversarial verification cases, final release audit, and branch-protection enforcement.

## Working rule

Before starting a new Pay task:

1. Read this ledger and the master specification.
2. Check the current `main` HEAD and relevant CI evidence.
3. Revalidate the real backend/database contract for the requested capability.
4. Never repeat the Devnet funding/observation work unless CI demonstrates a regression.
5. Do not add Supabase Preview Branching as a prerequisite for Pay delivery.
