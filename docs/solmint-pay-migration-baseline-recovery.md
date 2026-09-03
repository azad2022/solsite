# SolMint Pay — Supabase Migration Baseline Recovery

**Status:** ACTIVE RECOVERY / NOT PRODUCTION-PASS
**Date:** 2026-09-03
**Scope:** Supabase migration history, repository migration ledger, and the boundary required before Pay migrations can reach production.

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

The live `supabase_migrations.schema_migrations` table contains **55 applied versions**. The newest applied version is:

`20260826190853 / category_default_media_gallery_rpc`

No `solmint_pay` migration version is present in production.

The production database also has no Pay tables/functions from the Pay schema audit performed before this recovery.

## 3. Verified repository state

The current Pay audit branch is `audit/solmint-pay-next`.

The branch contains two different migration generations:

### A. Legacy site migrations

The repository currently contains a small set of site migrations whose filenames use short date prefixes, for example:

- `20260805_harden_rls_and_article_timestamps.sql`
- `20260807_comments_production_interactions.sql`
- `20260807_comments_security_hardening.sql`
- `20260807_harden_article_seo_fields.sql`
- `20260807_harden_blog_comments.sql`
- `20260807_production_comments.sql`
- `20260810_add_server_auth_sessions.sql`
- `20260812_comments_final_production_hardening.sql`
- `20260812_harden_comment_votes_and_rate_limits.sql`
- `20260812_registration_rate_limit_production.sql`
- `20260813_fix_comment_rate_limit_operation_key.sql`
- `20260826_allow_public_active_category_reads.sql`
- `20260826_category_default_media_atomic_assignment.sql`
- `20260829_reconcile_category_media_gallery.sql`

These filenames do **not** correspond one-to-one with the 14-digit migration versions registered in production.

### B. Pay migrations

Pay migrations use proper 14-digit versioned names beginning at `20260830000050` and continuing through the latest Pay hardening migration.

These migrations are repository-only and must not be treated as deployed production history.

## 4. Root cause

The Supabase remote migration ledger and the Git repository migration directory represent the same broad application history using different migration artifacts.

The remote ledger contains 55 applied versions such as:

- `20260804212636 / harden_public_rls_and_function_permissions`
- `20260804212725 / revoke_public_table_mutations`
- `20260804215020 / harden_public_rls_and_article_timestamps`
- `20260810160711 / add_server_auth_sessions`
- `20260813120812 / harden_security_definer_and_search_paths`
- `20260826190853 / category_default_media_gallery_rpc`

The repository does not currently contain these exact versioned migration files.

Supabase's connected Git workflow has consequently reported:

`Remote migration versions not found in local migrations directory.`

The associated Supabase branch is currently reported as `MIGRATIONS_FAILED`.

## 5. Forensic conclusion

The missing historical SQL cannot be safely reconstructed by renaming current files.

A filename match or semantic similarity is insufficient evidence that a repository file contains exactly the SQL that was executed for a given production migration version.

Therefore the following actions are explicitly prohibited during recovery:

- blind renaming of legacy migration files to remote version numbers;
- creation of empty historical migration stubs merely to silence the Git integration;
- marking remote migrations `reverted` or `applied` solely to repair metadata;
- deleting remote migration history;
- running the Pay migration chain directly against production before the site baseline is reconciled;
- accepting a green migration-history check without a schema equivalence test.

## 6. Recovery architecture

The correct recovery sequence is:

```text
Remote migration ledger
        +
Actual production schema
        +
Git repository history
        |
        v
Provenance / equivalence analysis
        |
        v
Canonical production schema snapshot
        |
        v
Controlled repository baseline
        |
        v
Fresh-database replay test
        |
        v
Production dry-run / isolated validation
        |
        v
Migration-history reconciliation
        |
        v
Only then: Pay migrations
```

The baseline must represent the **actual deployed schema**, not an inferred schema assembled from documentation or current source code.

## 7. Required baseline artifact

The recovery requires a canonical schema snapshot generated from the live production database using a trusted schema-dump/diff mechanism.

The snapshot must cover, at minimum:

- tables and columns;
- data types and generated/default expressions;
- primary/foreign/unique/check constraints;
- indexes;
- sequences/identity state where applicable;
- views/materialized views where applicable;
- functions and their security configuration;
- triggers;
- RLS enablement and policies;
- grants/revokes;
- extensions required by the application;
- relevant comments and security-definer configuration.

The snapshot must exclude production data and secrets.

### 7.1 Verified Production Capture

On 2026-09-03, the audited branch successfully executed the read-only production schema capture workflow against Supabase production.

Verified capture details:

- branch: `audit/solmint-pay-next`
- checked-out HEAD at capture: `ca7cbe6945d169e2f42a6d014190816149ef5eee`
- GitHub Actions run: `33781797071`
- job: `Read-only production schema capture`
- Supabase CLI: `2.116.0`
- schema SHA-256: `553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5`
- artifact from the verified run: `9907361271`

The captured SQL is 65,610 bytes / 1,991 lines. It contains no `INSERT INTO` statements, no `COPY ... FROM stdin` data blocks, and no PostgreSQL connection-string pattern. The SHA-256 manifest generated by the workflow matches the captured SQL byte-for-byte.

The capture is evidence of the live production schema at that point in time. It is **not** itself proof that the repository migration ledger and production schema are equivalent, and it does not authorize production Pay migrations.

The capture artifact is retained by GitHub Actions for a limited period. The SHA-256 value above is retained in this document so the evidence can be identified independently of artifact retention.

## 8. Why this is not yet a production migration

The repository now has a verified production schema snapshot suitable for the next recovery stage, but it still lacks a proven canonical replay baseline that reconciles the historical migration ledger with the repository migration directory.

The snapshot must therefore be used for equivalence analysis and controlled baseline construction, not as a reason to rewrite or mark historical migration metadata.

Hand-building a large historical migration chain from inferred SQL would introduce exactly the kind of silent omission risk this recovery is intended to remove.

Therefore this stage remains **blocked for production Pay application** until the baseline is proven through replay and equivalence tests.

## 9. Pay boundary

The Pay migration chain starts only after the recovered site baseline.

The following remains true:

- Helius/Cloudflare RPC setup is already established and is not part of this recovery;
- `/pay` remains disabled;
- Pay migrations remain repository-only;
- no production Pay DDL is to be executed until the baseline is proven;
- focused Pay CI remains an isolated validation environment, not production evidence.

## 10. Definition of Done

Migration baseline recovery is complete only when all of the following are independently proven:

1. every remote applied migration version is represented by an intentional repository artifact or by an explicitly documented baseline strategy;
2. no local migration will accidentally replay an already-applied historical change;
3. a clean database can be built from the repository and reaches a schema-equivalent state;
4. the migration ledger and repository are accepted by Supabase without the `Remote migration versions not found in local migrations directory` failure;
5. a controlled validation against a disposable database/branch succeeds;
6. only after the preceding gates pass is the first Pay migration eligible for production application.

**No PASS is granted by this document.** It is the recovery contract and the audit record for the blocker.
