# SolMint Pay — Persistent Project Status

**Status date:** 2026-09-03  
**Repository:** `azad2022/solsite`  
**Working branch:** `audit/solmint-pay-next`  
**Production route:** `/pay` remains disabled until all release gates pass.

## Purpose of this file

This document is a navigation aid and audit checkpoint for future development sessions. It is **not** the source of truth. It must never be treated as proof that a gate is currently passing.

At the start of every new session, the engineer/assistant MUST independently re-verify the repository state, current HEAD, PR/diff, migration history, workflow definitions, latest relevant GitHub Actions runs, artifacts, test results, and Supabase production state before deciding what has or has not been completed.

A previous assistant/session statement, this file, PR descriptions, commit messages, or a remembered status are not sufficient evidence by themselves.

## Verified facts as of 2026-09-03

### Production baseline

- Supabase Production project ref: `nvopkbiedorfshwbmyhn`
- Region: `eu-central-1`
- PostgreSQL: `17.6.1.147`
- Project status observed: `ACTIVE_HEALTHY`
- Production migration ledger observed: **55 applied migrations**
- Newest observed Production migration: `20260826190853 / category_default_media_gallery_rpc`
- No Pay migration was present in the Production migration ledger at the time of capture.

### Production schema snapshot

- Verified read-only capture workflow: `SolMint Pay — Production Schema Capture`
- Verified run: `33781797071`
- Artifact ID: `9907361271`
- Snapshot SHA-256: `553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5`
- Capture contained schema only; no `INSERT INTO` or `COPY ... FROM stdin` data blocks were detected.
- The snapshot contained no Pay objects.
- Production was not modified by the snapshot capture.

### Snapshot replay / core schema equivalence

- The captured Production snapshot was replayed on disposable PostgreSQL 17.
- DDL replay succeeded with `psql -v ON_ERROR_STOP=1`.
- Final canonical comparison of snapshot vs replay passed.
- Canonical SHA-256 for both sides: `f52a2e9c1d49a42cad70aa9f59fa36aafc6e5b645898ef901153f39dc5f114c1`
- Canonicalized length on both sides: `43,550` bytes.
- Scope limitation: this proves core PostgreSQL schema replay/equivalence under the comparator's normalization. It does **not** prove byte-for-byte Supabase control-plane equivalence.

### Pay migration replay on the real Production baseline

- Workflow: `SolMint Pay — Production Baseline Migration Replay`
- Target: disposable PostgreSQL 17, never Production.
- The current Pay migration chain was discovered and applied on top of the captured Production baseline.
- Latest verified result at this checkpoint: **47/47 Pay migrations applied successfully**.
- The workflow also checked for removed legacy relations and unexpected non-Pay relation additions.
- This result proves migration-chain replayability against the captured baseline, but it is not by itself a full definition-level equivalence audit of every legacy object.

## Existing Pay security and E2E coverage — do not assume these are missing

### RLS / client isolation

Existing test file: `supabase/tests/database/pay_client_isolation.sql`

The test contains 18 assertions covering, among other things:

- Pay tables having RLS enabled.
- `anon` and `authenticated` lacking direct Pay table privileges.
- Sensitive webhook worker RPCs not executable by public/client roles.
- Security-sensitive RPCs using `SECURITY DEFINER` with `search_path=""`.
- Database guards for revenue recognition and webhook enqueueing.
- Global uniqueness of blockchain payment signatures.
- Payment Intent fee and required-field invariants.

Existing workflow: `.github/workflows/solmint-pay-database-security.yml`

The workflow runs the database tests and then performs a local migration reset and re-runs the tests. This is an existing security gate, not a missing feature.

### SECURITY DEFINER / rate-limit / reconciliation guards

Existing test file: `supabase/tests/database/pay_rate_limit_and_reconciliation_guards.sql`

It explicitly checks `SECURITY DEFINER`, empty search path, client execute restrictions, atomic rate-limit behavior, fee-payer binding, and fail-closed sponsored-payment behavior.

Do not create duplicate tests merely because the current baseline replay workflow was added.

### Devnet E2E

Existing workflow: `.github/workflows/solmint-pay-devnet-e2e.yml`  
Existing harness: `tests/e2e/solmint-pay-devnet.e2e.ts`

The harness is a real Devnet test, not a mock-only test. It:

- connects to `https://api.devnet.solana.com` with finalized commitment;
- generates an ephemeral sender keypair;
- funds it through the dedicated CI Devnet funding wallet;
- sends real SOL transfers;
- attaches a Solana Pay reference to the merchant transfer;
- discovers the finalized transaction by reference;
- asserts the expected signature/reference/success/finalization/fee payer/transfers;
- runs `verifyPaymentTransaction()` against the observed transaction and requires a valid confirmed result.

**Important evidence distinction:** existence and quality of the Devnet E2E harness are verified here. A future session must still inspect the GitHub Actions history and obtain concrete successful run evidence before declaring the current Devnet E2E gate PASS. Do not confuse “workflow exists” with “latest run passed.”

## Current architectural blockers / caution

- Production migration history is authoritative. Do not rewrite, rename, or reorder historical migrations.
- Do not apply Pay DDL to Production merely because disposable replay passed.
- Do not modify the remote migration ledger until the production baseline/reconciliation strategy is explicitly designed and validated.
- The Supabase `main` branch has previously been observed in `MIGRATIONS_FAILED`; do not treat that environment as a clean baseline unless independently re-verified.
- Existing baseline replay checks relation additions/removals, but a future release gate should also consider definition-level changes to legacy tables, columns, constraints, indexes, triggers, policies, grants, functions, and other security-relevant objects.

## Required re-verification protocol for every new session

Before making any substantive SolMint Pay change, perform a fresh repository-first audit:

1. Resolve the real current branch and HEAD.
2. Inspect PR #37 and current diff against `main`.
3. Enumerate the current Pay migration chain and migration ordering.
4. Inspect all Pay-related workflows under `.github/workflows/`.
5. Inspect the latest run status for each relevant workflow, not merely workflow existence.
6. Inspect uploaded evidence artifacts when a gate depends on them.
7. Re-check production migration ledger and production schema facts when the decision touches deployment/baseline.
8. Reconcile observed evidence against this document and update this file when the verified state changes.
9. Never infer PASS from a prior chat message, commit title, or this document alone.

## Release-gate principle

The release decision is fail-closed. Missing evidence, stale evidence, ambiguous CI state, cancelled jobs, failed jobs, incomplete discovery, RPC uncertainty, or migration-state ambiguity must not be reported as PASS.

The project is not production-ready merely because the Pay migrations replay successfully. `/pay` remains disabled until the complete release gate set is independently verified.

## Canonical evidence references

- `docs/solmint-pay-production-baseline-manifest-2026-09-03.md` — production snapshot and replay evidence.
- `.github/workflows/solmint-pay-baseline-migration-replay.yml` — baseline + Pay migration replay gate.
- `.github/workflows/solmint-pay-database-security.yml` — database security gate.
- `.github/workflows/solmint-pay-devnet-e2e.yml` — real Devnet E2E gate.
- `supabase/tests/database/pay_client_isolation.sql` — RLS/client isolation and security assertions.
- `supabase/tests/database/pay_rate_limit_and_reconciliation_guards.sql` — rate-limit/reconciliation/Security Definer assertions.
- `tests/e2e/solmint-pay-devnet.e2e.ts` — real Devnet verification harness.
