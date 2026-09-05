# SolMint Pay — Persistent Project Status

**Status date:** 2026-09-03  
**Repository:** `azad2022/solsite`  
**Working branch:** `audit/solmint-pay-next`  
**Current audited HEAD:** `c86133d6573233cc343ea90b75daea34c1633813`  
**Production route:** `/pay` remains disabled until all release gates pass.

## Purpose of this file

This document is a navigation aid and audit checkpoint for future development sessions. It is **not** the source of truth. It must never be treated as proof that a gate is currently passing.

At the start of every new session, the engineer/assistant MUST independently re-verify the repository state, current HEAD, PR/diff, migration history, workflow definitions, latest relevant GitHub Actions runs, artifacts, test results, and Supabase production state before deciding what has or has not been completed.

A previous assistant/session statement, this file, PR descriptions, commit messages, or a remembered status are not sufficient evidence by themselves.

## Verified facts as of 2026-09-03

### Repository / PR

- Working branch: `audit/solmint-pay-next`.
- PR #37: open, draft, base `main`.
- Current HEAD: `c86133d6573233cc343ea90b75daea34c1633813`.
- The immediately preceding functional commit is `0a496ec6adc2473ee3dba57e0100c6a8903ea19f`; `c861...` is documentation/status-only and did not change Pay code, migrations, or workflows.
- Therefore functional validation performed on `0a496...` remains relevant to the current tree, but fresh aggregate CI has not yet been collected for `c861...`.

### Production database

- Supabase Production project ref: `nvopkbiedorfshwbmyhn`
- Region: `eu-central-1`
- PostgreSQL observed: `17.6.1.147`
- Production project status observed: `ACTIVE_HEALTHY`.
- Production migration ledger currently contains **56 distinct applied versions**.
- Newest observed Production migration: `20260826190853 / category_default_media_gallery_rpc`.
- No Pay migration/version is present in the Production migration ledger.
- Direct inspection of the live `public` schema reports **0 `pay_%` relations**. Pay schema is therefore not deployed to Production.
- The Supabase development branch named `main` is currently `MIGRATIONS_FAILED`; it is not treated as a clean validation baseline.

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
- This proves migration-chain replayability against the captured baseline; it is not permission to execute Pay DDL in Production.

### Baseline definition preservation audit

- Workflow: `.github/workflows/solmint-pay-baseline-definition-audit.yml`
- Successful run: `33796828088`
- Successful run HEAD: `0a496ec6adc2473ee3dba57e0100c6a8903ea19f`.
- The current HEAD `c861...` differs from that run only by the project-status documentation update.
- Snapshot SHA was independently verified before replay.
- All 47 Pay migrations applied successfully.
- Non-Pay relations, columns, constraints, indexes, functions/security configuration, triggers, policies, table grants, routine grants, and extensions were compared before/after.
- Result: **PASS** for functional tree `0a496...` — no non-Pay definition changes detected under the comparator.

### Current security / real E2E evidence

#### RLS / client isolation

Existing test: `supabase/tests/database/pay_client_isolation.sql`.

It has 18 assertions covering RLS on Pay tables, denial of direct `anon`/`authenticated` table privileges, security-definer restrictions, webhook enqueueing, global blockchain signature uniqueness, Payment Intent fee/invariant checks and required-field rejection.

Existing workflow: `.github/workflows/solmint-pay-database-security.yml`.

This gate is implemented and has prior execution evidence. Do not recreate equivalent tests merely because new baseline tooling was added.

#### SECURITY DEFINER / rate limit / reconciliation guards

Existing test: `supabase/tests/database/pay_rate_limit_and_reconciliation_guards.sql`.

It covers SECURITY DEFINER + empty search path, client execute restrictions, atomic rate limiting, reconciliation fee-payer binding and fail-closed sponsored-payment behavior.

This coverage already exists and should not be duplicated without a real coverage gap.

#### Real Devnet E2E

Existing workflow: `.github/workflows/solmint-pay-devnet-e2e.yml`  
Existing harness: `tests/e2e/solmint-pay-devnet.e2e.ts`.

Concrete successful historical run:

- Run: `33767614630`
- Job: `devnet-e2e`
- Conclusion: `success`
- The successful job included funding an ephemeral sender, executing the real Devnet payment verification, and securely removing the temporary keypair.

The harness uses real Devnet transactions, finalized commitment, reference discovery and `verifyPaymentTransaction()`.

This is valid evidence that the real Devnet E2E path has been exercised. Because the user has already performed the wallet/funding/payment test, do not rerun it now merely to repeat development work. A single fresh current-HEAD E2E run remains intentionally deferred until the final release candidate.

## Current blockers / audit findings

1. **Migration baseline reconciliation** remains the principal Production blocker. The actual live schema is captured and the 47 Pay migrations preserve all compared non-Pay definitions on disposable replay, but the historical remote migration versions do not have one-to-one repository artifacts. An explicit baseline strategy must be validated before remote migration-history repair or Production Pay DDL.
2. **Current aggregate CI for HEAD `c861...` is not yet available.** The commit has no ordinary GitHub status entries and no completed PR validation attached to that exact SHA at this checkpoint. Therefore no current-HEAD CI PASS is reported.
3. **Operational backend adversarial audit** still needs final review for webhook races/replay/SSRF/retry/DLQ and reconciliation/accounting concurrency. Existing tests are inspected first; only real gaps should be added.
4. **Current-HEAD real Devnet E2E** is deferred to the final release candidate. Historical Devnet E2E success is already proven.
5. **Production Pay DDL** remains blocked until baseline reconciliation and final release gates pass.

### Separate Production advisor findings — not yet treated as Pay blockers

The current Supabase Security Advisor reports pre-existing non-Pay warnings, including several public `SECURITY DEFINER` functions executable by `anon`/`authenticated` and `pg_net` installed in `public`. These findings were observed directly in Production on 2026-09-03. They are recorded as separate site-security debt and should not be silently mixed into the Pay migration baseline work without a dedicated remediation decision.

The Performance Advisor also reports pre-existing non-Pay items such as an unindexed foreign key, duplicate indexes, unused indexes, and multiple permissive policies. No unrelated Production DDL is being introduced during Pay baseline recovery.

## Migration recovery evidence and safe direction

Official Supabase documentation confirms that:

- `supabase db pull` can create a current-schema baseline migration;
- `supabase migration repair` changes migration tracking only and does not run/revert the SQL itself;
- `supabase migration list` compares local migration files against remote migration history;
- `supabase db push --dry-run` previews pending migrations;
- `supabase migration squash` can create a schema-only squashed migration for a controlled new baseline.

The safe Pay recovery direction is therefore a **documented canonical baseline strategy**, validated on disposable infrastructure first, with the original 56-entry Production history preserved as forensic evidence before any production history repair. No manual INSERT/DELETE against `supabase_migrations.schema_migrations` is authorized as a shortcut.

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
