# SolMint Pay — Supabase Migration Baseline Recovery

**Status:** ACTIVE RECOVERY / NOT PRODUCTION-PASS
**Date:** 2026-09-03
**Scope:** Supabase migration history, repository migration ledger, production-schema baseline, and the boundary required before Pay migrations can reach production.

## 1. Purpose

This document records the verified migration-baseline problem discovered while preparing SolMint Pay for production integration.

The objective is not to make the Supabase Git integration appear green by renaming files, fabricating historical migrations, or changing migration metadata without proving the underlying schema state.

The recovery must preserve three properties:

1. production schema remains authoritative for what is actually deployed;
2. repository migrations become deterministic and replayable;
3. future Pay migrations can be applied only after the site schema baseline is proven.

## 2. Verified production state

Supabase project:

- project/ref: `nvopkbiedorfshwbmyhn`
- region: `eu-central-1`
- status: `ACTIVE_HEALTHY`
- PostgreSQL: 17.6.1.147

The live `supabase_migrations.schema_migrations` table contains **56 applied versions**. The newest applied version is:

`20260826190853 / category_default_media_gallery_rpc`

No SolMint Pay migration version is present in production.

The production database also has no Pay tables/functions from the Pay schema audit performed before this recovery.

## 3. Verified repository state

The current Pay audit branch is `audit/solmint-pay-next`.

The branch contains two different migration generations:

### A. Legacy site migrations

The repository currently contains 14 site migrations whose filenames use short date prefixes rather than the exact remote migration timestamps. These files are retained as historical Git evidence but are not considered one-to-one representations of the 56 remote versions.

### B. Pay migrations

Pay migrations use proper 14-digit versioned names beginning at `20260830000050` and continuing through the latest Pay hardening migration.

These migrations are repository-only and must not be treated as deployed production history.

## 4. Root cause

The Supabase remote migration ledger and the Git repository migration directory represent the same broad application history using different migration artifacts.

The remote ledger contains 56 applied versions, while the repository's legacy site migration filenames do not correspond one-to-one to those remote version identifiers.

Supabase's connected Git workflow can therefore report:

`Remote migration versions not found in local migrations directory.`

The associated Supabase branch is currently reported as `MIGRATIONS_FAILED` and is not treated as a clean validation baseline.

## 5. Forensic conclusion

The missing historical SQL cannot be safely reconstructed by renaming current files.

A filename match or semantic similarity is insufficient evidence that a repository file contains exactly the SQL that was executed for a given production migration version.

Therefore the following actions are explicitly prohibited during recovery:

- blind renaming of legacy migration files to remote version numbers;
- creation of empty historical migration stubs merely to silence the Git integration;
- marking remote migrations `reverted` or `applied` solely to repair metadata without proving the baseline;
- deleting remote migration history as a shortcut;
- running the Pay migration chain directly against production before the site baseline is reconciled;
- accepting a green migration-history check without a schema equivalence test.

## 6. Canonical recovery architecture

The recovery is now defined as a concrete, reversible sequence:

```text
Frozen Production ledger (56 versions)
          +
Frozen Production schema snapshot
          +
Repository migration history
          |
          v
Generate canonical baseline 20260829090000
          |
          v
Validate exact snapshot hash / no data imports
          |
          v
Disposable baseline + 47 Pay migration replay
          |
          v
Definition-preservation audit
          |
          v
Repository archive of 14 legacy short-name files
          |
          v
Supabase migration list / db push --dry-run validation
          |
          v
Guarded metadata-only migration repair
          |
          v
Post-repair Production schema/history revalidation
          |
          v
Only then: controlled Pay migration application
```

The baseline represents the **actual deployed PostgreSQL schema**, not an inferred schema assembled from source code.

## 7. Canonical baseline artifact

The recovery now has a deterministic generator and validator:

```bash
node scripts/solmint-pay/baseline-prepare.mjs /path/to/production-schema.sql
node scripts/solmint-pay/baseline-validate.mjs supabase/migrations/20260829090000_solmint_production_baseline.sql
```

The generator is pinned to the audited Production snapshot SHA-256:

`553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5`

It refuses an unexpected snapshot hash, existing-baseline overwrite, top-level data-import statements, or obvious credential material. The resulting migration is bounded by explicit baseline markers.

The resulting file is intentionally positioned between the last observed Production migration and the first Pay migration:

- Production last observed: `20260826190853`
- Canonical baseline: `20260829090000`
- First Pay migration: `20260830000050`

The canonical baseline MUST be committed and validated before the Production migration-history repair command is ever run.

## 8. Verified Production Capture

On 2026-09-03, the audited branch successfully executed the read-only production schema capture workflow against Supabase production.

Verified capture details:

- workflow run: `33781797071`
- artifact: `9907361271`
- Supabase CLI: `2.116.0`
- schema SHA-256: `553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5`
- captured SQL size: 65,610 bytes / 1,991 lines

The captured SQL was checked for the absence of data blocks and obvious credential material. The snapshot is evidence of Production state at capture time and is not itself permission to modify Production.

## 9. Disposable validation gate

Before any Production migration-history repair, the canonical baseline must be validated on disposable infrastructure.

The minimum gate is:

1. baseline generator reproduces the expected snapshot hash;
2. baseline validator passes;
3. baseline SQL executes successfully;
4. baseline schema is equivalent to the frozen Production snapshot under the established comparator;
5. all 47 Pay migrations apply after the baseline;
6. no non-Pay relation, column, constraint, index, function/security setting, trigger, policy, grant, or extension changes are introduced by the Pay chain;
7. local migration tooling shows deterministic ordering;
8. no historical placeholder migration is required.

The already successful replay/definition-preservation evidence remains valid for the functional Pay tree that produced it; new repository baseline tooling requires a fresh validation of the final baseline tree before Production repair.

## 10. Production migration-history repair

The repository now contains `scripts/solmint-pay/migration-repair.sh`.

The script supports:

```text
plan     -> no remote mutation
apply    -> mark all 56 historical versions reverted, then mark canonical baseline applied
rollback -> mark canonical baseline reverted, then restore all 56 historical versions applied
```

The script is fail-closed behind:

- exact Production project ref `nvopkbiedorfshwbmyhn`;
- `SUPABASE_ACCESS_TOKEN` presence;
- an explicit `I_UNDERSTAND_METADATA_ONLY` confirmation;
- exact frozen ledger count 56 and manifest SHA `23620cfd252215c972f7c8f295a913cf1cdaf77a`;
- existence and validation of the canonical baseline;
- a repair-state file that prevents accidental overlapping runs.

It invokes the supported `supabase migration repair` mechanism and never writes directly to `supabase_migrations.schema_migrations`.

Supabase documents `migration repair` as a migration-history tracking operation rather than a schema execution/reversion mechanism. citeturn442423search0turn442423search2

## 11. Rollback semantics

Before any Pay schema is applied, the `rollback` action can restore the captured 56-entry historical ledger state.

This rollback is deliberately **metadata-only**. It does not restore PostgreSQL schema because the repair operation never executes migration SQL.

After a future Pay migration changes Production schema, metadata rollback is no longer a schema rollback. Such recovery requires the normal database backup/restore process or a reviewed compensating migration. Never represent metadata repair as schema rollback.

## 12. Required post-repair checks

Immediately after a successful Production repair, independently run:

```bash
supabase migration list --project-ref nvopkbiedorfshwbmyhn
supabase db push --project-ref nvopkbiedorfshwbmyhn --dry-run
```

Then re-capture/revalidate the Production schema and verify:

- no Pay objects exist unless a separately approved Pay migration was intentionally applied;
- no unexpected non-Pay definition drift occurred;
- the migration list matches the intended canonical state;
- the dry-run proposes only the expected next migrations.

## 13. Pay boundary

The following remains true:

- `/pay` remains disabled;
- Pay migrations remain repository-only until the complete release gate passes;
- Production Pay DDL is not authorized by successful baseline replay alone;
- current-HEAD aggregate CI and final release E2E remain separate gates.

## 14. Definition of Done

Migration baseline recovery is complete only when all of the following are independently proven:

1. the 56-entry Production history is preserved as forensic evidence;
2. the canonical baseline is generated from the exact Production snapshot and committed without manual alteration;
3. the baseline plus 47 Pay migrations is replayable on disposable PostgreSQL;
4. non-Pay definitions remain equivalent under the established comparator;
5. active repository migration ordering contains the canonical baseline followed by Pay migrations, while the 14 legacy short-name files remain preserved outside active execution order;
6. disposable migration tooling validates the expected baseline state;
7. the guarded Production metadata repair is executed only in a controlled change window;
8. Production history and schema are independently revalidated after repair;
9. the first Pay migration is still subject to a separate production change approval and full release gates.

**Current status: NOT PASS.** The recovery mechanism is implemented, but the canonical baseline artifact has not yet been committed/validated as the final active migration tree and no Production migration-history repair has been executed.
