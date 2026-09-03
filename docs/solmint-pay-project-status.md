# SolMint Pay — Persistent Project Status

**Status date:** 2026-09-03  
**Repository:** `azad2022/solsite`  
**Working branch:** `audit/solmint-pay-next`  
**Current audited HEAD:** `0a496ec6adc2473ee3dba57e0100c6a8903ea19f`  
**Production route:** `/pay` remains disabled until all release gates pass.

## Purpose of this file

This document is a navigation aid and audit checkpoint for future development sessions. It is **not** the source of truth. It must never be treated as proof that a gate is currently passing.

At the start of every new session, the engineer/assistant MUST independently re-verify the repository state, current HEAD, PR/diff, migration history, workflow definitions, latest relevant GitHub Actions runs, artifacts, test results, and Supabase production state before deciding what has or has not been completed.

A previous assistant/session statement, this file, PR descriptions, commit messages, or a remembered status are not sufficient evidence by themselves.

## Verified facts as of 2026-09-03

### Production database

- Supabase Production project ref: `nvopkbiedorfshwbmyhn`
- Region: `eu-central-1`
- PostgreSQL observed: `17.6`
- Production migration ledger currently contains **56 distinct applied versions**.
- Newest observed Production migration: `20260826190853 / category_default_media_gallery_rpc`.
- The earlier checkpoint incorrectly recorded 55; the live ledger now has been independently counted and verified as 56. The newest migration version is unchanged.
- No Pay migration/version is present in the Production migration ledger.
- Direct inspection of the live `public` schema reports **0 `pay_%` relations**. Pay schema is therefore not deployed to Production.

### Production schema snapshot

- Verified read-only capture workflow: `SolMint Pay — Production Schema Capture`
- Verified run: `33781797071`
- Artifact ID: `9907361271`
- Snapshot SHA-256: `553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5`
- Capture contains schema only; no `INSERT INTO` or `COPY ... FROM stdin` data blocks were detected.
- Snapshot contains no Pay objects.
- Production was not modified by the capture.

### Snapshot replay / core schema equivalence

- Captured Production snapshot replayed on disposable PostgreSQL 17.
- DDL replay succeeded with `psql -v ON_ERROR_STOP=1`.
- Canonical snapshot/replay comparison passed.
- Canonical SHA-256 for both sides: `f52a2e9c1d49a42cad70aa9f59fa36aafc6e5b645898ef901153f39dc5f114c1`
- Canonicalized length on both sides: `43,550` bytes.
- Limitation: this proves core PostgreSQL schema replay/equivalence under the comparator's normalization; it does not prove byte-for-byte Supabase control-plane equivalence.

### Pay migration replay

- Workflow: `.github/workflows/solmint-pay-baseline-migration-replay.yml`
- Target: disposable PostgreSQL 17, never Production.
- Current Pay migration chain: **47 migrations**.
- All **47/47** Pay migrations applied successfully on top of the captured Production baseline.
- The replay checks legacy relation preservation and Pay object creation.
- This proves migration-chain replayability against the captured baseline; it is not by itself permission to execute Pay DDL in Production.

### Baseline definition preservation audit

- Workflow: `.github/workflows/solmint-pay-baseline-definition-audit.yml`
- Successful run: `33796828088`
- Head: `0a496ec6adc2473ee3dba57e0100c6a8903ea19f`
- Snapshot SHA was independently verified before replay.
- All 47 Pay migrations applied successfully.
- Non-Pay relations, columns, constraints, indexes, functions/security configuration, triggers, policies, table grants, routine grants, and extensions were compared before/after.
- Result: **PASS** — no non-Pay definition changes detected under the comparator.

## Existing Pay security and E2E coverage — do not repeat without evidence of invalidation

### RLS / client isolation

Existing test: `supabase/tests/database/pay_client_isolation.sql`

The test has 18 assertions covering RLS on Pay tables, denial of direct `anon`/`authenticated` table privileges, security-definer restrictions, webhook enqueueing, global blockchain signature uniqueness, Payment Intent fee/invariant checks and required-field rejection.

Existing workflow: `.github/workflows/solmint-pay-database-security.yml`.

This gate has already been implemented and tested. Do not recreate equivalent tests merely because new baseline tooling was added.

### SECURITY DEFINER / rate limit / reconciliation guards

Existing test: `supabase/tests/database/pay_rate_limit_and_reconciliation_guards.sql`.

It covers SECURITY DEFINER + empty search path, client execute restrictions, atomic rate limiting, reconciliation fee-payer binding and fail-closed sponsored-payment behavior.

This coverage already exists and should not be duplicated without a real coverage gap.

### Real Devnet E2E

Existing workflow: `.github/workflows/solmint-pay-devnet-e2e.yml`  
Existing harness: `tests/e2e/solmint-pay-devnet.e2e.ts`

Concrete successful historical run:

- Run: `33767614630`
- Job: `devnet-e2e`
- Conclusion: `success`
- The successful job included funding an ephemeral sender, executing the real Devnet payment verification, and securely removing the temporary keypair.

The harness itself uses real Devnet transactions, finalized commitment, reference discovery and `verifyPaymentTransaction()`.

**Important audit rule:** this is valid evidence that the real Devnet E2E path has been exercised successfully. Because the user has already performed the real wallet/funding test, do not rerun it now merely to repeat the exercise. A fresh current-HEAD E2E run is intentionally deferred until the final release candidate, after substantive backend/baseline changes are complete. That final run is one release-gate validation, not a duplicate development step.

## Current architectural blockers

1. **Migration baseline reconciliation** remains the principal Production blocker. The exact live schema is now captured and definition-preserving under Pay replay, but the historical remote migration versions still do not have one-to-one repository artifacts. The repository must adopt an explicit, proven baseline strategy before any remote migration-history repair or Production Pay DDL.
2. **Operational backend adversarial coverage** still needs a final audit for webhook races/replay/SSRF/retry/DLQ behavior and reconciliation/accounting concurrency. First inspect existing coverage; only add genuinely missing tests.
3. **Current final release candidate CI evidence** must be collected after substantive changes stop.
4. **Current-HEAD real Devnet E2E** is deferred to the final release candidate; historical success is already proven.
5. **Production Pay DDL** remains blocked until the baseline reconciliation strategy and final release gates pass.

## Required re-verification protocol for every new session

Before any substantive SolMint Pay change:

1. Resolve the real current branch and HEAD.
2. Inspect PR #37 and current diff against `main`.
3. Enumerate current Pay migrations and ordering.
4. Inspect all Pay workflows.
5. Inspect latest relevant run status for each gate.
6. Inspect evidence artifacts when a gate depends on them.
7. Re-check Production migration ledger and schema for database/deployment decisions.
8. Search existing tests, workflows, commits and evidence for the requested task before creating new work.
9. Reconcile observed facts against this document, correcting this document when stale.
10. Never infer PASS from a previous chat message, commit title, old run, or this document alone.

## Release-gate principle

Missing evidence, stale evidence, ambiguous CI state, cancelled jobs, failed jobs, incomplete discovery, RPC uncertainty, or migration-state ambiguity must never be reported as PASS.

The project is not Production-ready merely because Pay migrations replay successfully. `/pay` remains disabled until the complete release gate set is independently satisfied on the final release candidate.

## Canonical evidence references

- `docs/solmint-pay-production-baseline-manifest-2026-09-03.md` — Production snapshot/equivalence evidence.
- `docs/solmint-pay-migration-baseline-recovery.md` — migration-baseline recovery contract.
- `.github/workflows/solmint-pay-baseline-migration-replay.yml` — baseline + Pay migration replay.
- `.github/workflows/solmint-pay-baseline-definition-audit.yml` — non-Pay definition preservation gate.
- `.github/workflows/solmint-pay-database-security.yml` — existing database security gate.
- `.github/workflows/solmint-pay-devnet-e2e.yml` — real Devnet E2E gate.
- `supabase/tests/database/pay_client_isolation.sql` — RLS/client-isolation assertions.
- `supabase/tests/database/pay_rate_limit_and_reconciliation_guards.sql` — rate-limit/reconciliation assertions.
- `tests/e2e/solmint-pay-devnet.e2e.ts` — real Devnet verification harness.

## Next safe sequence

```text
Explicit migration baseline strategy
        ↓
Disposable Supabase/control-plane validation
        ↓
Only then: production migration-history reconciliation
        ↓
Controlled Pay migration application plan
        ↓
Webhook + reconciliation/accounting adversarial coverage
        ↓
Current-HEAD aggregate CI
        ↓
One final current-HEAD real Devnet E2E
        ↓
Independent adversarial release audit
        ↓
Frontend implementation
        ↓
Final production activation of /pay
```
