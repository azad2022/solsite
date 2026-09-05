# SolMint Pay — Continuation & Engineering Handoff

> **Purpose:** Operational handoff for any future SolMint Pay engineering, audit, implementation, or verification session.
>
> **Authority:** Product/economic requirements come from `docs/solmint-pay-v1-product-contract.md`. This document records verified repository/runtime facts and session procedure so another engineer or ChatGPT instance does not infer the wrong architecture from historical work.
>
> **Critical rule:** Revalidate all current state before relying on this document. The branch/HEAD, CI status, database state, and deployment state can change. This document is a navigation and continuity contract, not proof of PASS.

## 1. Authoritative document hierarchy

Use exactly this hierarchy:

1. `docs/solmint-pay-v1-product-contract.md` — authoritative V1 product and engineering contract.
2. This file — authoritative operational handoff for how to continue work safely.
3. Lower-level Pay documents — implementation detail only; conflicts must be reported.
4. Source code, migrations, tests, CI, runtime/database observations — implementation evidence.

`docs/solmint-pay-project-spec.md` is superseded historical material and is not an independent source of truth.

## 2. Product/runtime boundary already established

SolMint Pay is a separate payment product inside the `solsite` repository and under `/pay`.

Production deployment uses Cloudflare Pages Functions for the edge/serverless runtime. The repository's `wrangler.toml` identifies Cloudflare Pages Functions as the production edge runtime. The Node/Express server remains a separate runtime and is not the Pay Worker runtime.

The Solana blockchain boundary is provider-neutral:

```text
Cloudflare/server runtime
        |
        | server-only SOLANA_RPC_URL
        v
createSolanaRpcProvider()
        |
        v
SolanaRpcProvider
        |
        v
SolanaPaymentProvider
        |
   +----+-------------------+
   |                        |
   v                        v
Verifier               Reconciliation
```

The current production provider decision is **Helius Solana Mainnet RPC**. The Helius API credential is a deployment secret and must never enter Git, client code, logs, database records, or API responses.

**Do not re-provision Helius or modify the existing Cloudflare RPC secret unless a fresh runtime audit proves that it is missing, wrong, exposed, or broken.** Configuration work is not a default next step.

## 3. Current RPC implementation facts

The current repository contains both:

- `SolanaRpcProvider`: the concrete JSON-RPC implementation;
- `ResilientSolanaPaymentProvider`: the provider wrapper.

The concrete provider currently performs authoritative transaction reads with `getTransaction`, discovery with paginated `getSignaturesForAddress`, token-account enrichment with `getAccountInfo`, and health checks with `getSlot`.

The concrete RPC provider uses an 8-second request timeout, bounded reference discovery, and fail-closed errors. Reference discovery exhaustion is represented as `REFERENCE_DISCOVERY_INCOMPLETE` rather than `no_match`.

The resilience wrapper supports up to three configured HTTPS RPC URLs, two attempts per provider, and bounded backoff. The primary environment variable is `SOLANA_RPC_URL`; optional fallback URLs are supplied separately through `SOLANA_RPC_FALLBACK_URLS`.

**Production currently does not require additional fallback provisioning merely because the abstraction supports it.** Never invent fallback credentials or change Cloudflare configuration without evidence that this is required by the current production reliability objective.

A subtle provider rule is important for future hardening: a null/empty result is not equivalent to a successful authoritative read when deciding whether a later provider should be tried. Any change to provider fallback behavior must preserve this distinction and must be tested before being considered complete.

## 4. Payment verification boundary

Payment creation creates an immutable Payment Intent snapshot. Blockchain observations are evaluated against that snapshot. A reference is discovery/correlation data, not proof.

The current verifier rejects or classifies based on, where applicable:

- signature presence and uniqueness;
- successful execution;
- required commitment;
- reference presence;
- exact merchant settlement;
- exact gateway fee transfer;
- asset/mint/token-program/decimals;
- token-account authority;
- source/transfer authority consistency;
- fee payer/sponsor invariants;
- ambiguous candidates/transfers;
- underpayment/overpayment;
- wrong destination/asset;
- replay/duplicate signature.

Transfer roles are assigned by the verification/reconciliation layer from the immutable Payment Intent expectation. Provider-assigned roles are not trusted as financial truth.

The reconciliation engine follows the pattern:

```text
observe -> verify -> atomically persist -> append-only accounting -> notify
```

No financial recognition is valid before complete verification and atomic reconciliation.

## 5. Database and migration-baseline state

The Pay migration chain exists in Git, but repository migrations are not evidence that the live database has them.

The current connected Supabase project is `nvopkbiedorfshwbmyhn` in `eu-central-1`. The live production migration history currently contains **55 applied migration versions**, ending at `20260826190853`, with no SolMint Pay versions. Direct inspection of the production `public` schema confirms the existing site tables are present and no Pay schema layer has been deployed.

A verified production migration ledger is stored in:

`docs/solmint-pay-supabase-production-migration-ledger-2026-09-03.txt`

The recovery contract is stored in:

`docs/solmint-pay-migration-baseline-recovery.md`

The historical remote ledger uses 14-digit version identifiers such as `20260804215020`, while the repository still contains legacy site migration filenames such as `20260805_harden_rls_and_article_timestamps.sql`. These are not one-to-one historical artifacts, so they must not be renamed or fabricated into matches without provenance evidence.

The recovery remains fail-closed. Do not repair the drift by blind renaming, empty placeholders, remote-history manipulation, or by applying Pay migrations directly to production.

## 6. Required migration-baseline recovery

The safe sequence is:

```text
Remote migration ledger
        +
Actual production schema
        +
Git migration history
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
Fresh-database replay validation
        |
        v
Production/clone validation
        |
        v
Migration-history reconciliation
        |
        v
Only then: Pay migrations
```

The canonical baseline must contain the actual deployed schema without production data or secrets, including tables, columns, defaults/generated values, constraints, indexes, functions/security configuration, triggers, RLS/policies, grants/revokes, extensions, and relevant comments.

The repository now contains a read-only capture script:

`scripts/solmint-pay/capture-production-schema.sh`

It invokes Supabase's schema-only `db dump` using a deployment-time `SUPABASE_DB_URL`, writes a local SQL artifact plus SHA-256 manifest, refuses an empty artifact, and does not modify production.

A dedicated GitHub Actions workflow exists at:

`.github/workflows/solmint-pay-production-schema-capture.yml`

It validates the secret is present, performs the read-only dump, rejects obvious data-dump statements and connection strings, and uploads the artifact with a seven-day retention policy. It now also has a narrowly scoped push trigger for `audit/solmint-pay-next` changes to the capture workflow/script, in addition to manual dispatch.

**The canonical schema artifact is still not present in repository evidence and has not been accepted as a production baseline.** The current GitHub tool surface can inspect workflow state but cannot itself initiate `workflow_dispatch`, so absence of a newly uploaded artifact must not be interpreted as a successful capture.

## 7. Workflow contract and current evidence

The Pay workflows are deliberately separated by responsibility:

### `solmint-pay-security.yml`

Runs Node/Bun type checking plus Pay policy/security tests.

### `solmint-pay-database-security.yml`

Builds an isolated Supabase environment, runs Pay database tests, resets the isolated database, and runs the database tests again to prove replayability.

### `solmint-pay-devnet-e2e.yml`

Runs the real Devnet transaction harness with an ephemeral sender keypair funded by a dedicated Devnet funding wallet. It must never consume or print the production Helius credential.

### `solmint-pay-production-schema-capture.yml`

Runs only the read-only production schema capture described above. This workflow is evidence collection, not a migration operation.

All Pay workflows use the same trigger principle:

```text
Pull request -> main
Push         -> Pay working branches (`feat/solmint-pay-*`, `audit/solmint-pay-*`)
Manual       -> workflow_dispatch
```

Path filters remain enabled so unrelated site changes do not create unnecessary Pay runs.

Pay workflows are evidence collectors. A workflow that is skipped, cancelled, incomplete, stale, or tied to an old SHA is not a production PASS.

For the current `audit/solmint-pay-next` HEAD, GitHub has not exposed a current workflow-run result through the connected workflow-run endpoint. Therefore no CI PASS is claimed.

Cloudflare evidence for the current HEAD `3de6c7c` recorded a successful Pages preview deployment and a separate failed Workers deployment. Neither is production-release evidence for SolMint Pay.

## 8. Session-start procedure for every future ChatGPT/engineer

Do not start by changing code.

Start by fetching:

1. `main` branch SHA;
2. current Pay working branch SHA;
3. open Pay PR metadata and merge-base/divergence;
4. relevant workflow definitions and latest current-HEAD runs;
5. authoritative V1 contract;
6. this continuation document;
7. migration-baseline recovery contract and production ledger manifest;
8. relevant source files and migrations;
9. live Supabase schema/migration state when database questions are involved.

Then answer:

```text
What is the current HEAD?
What is the intended base?
What changed since the previous verified state?
What is actually deployed?
What is only present in Git?
What is the highest-risk unresolved blocker?
What evidence exists for that blocker?
```

Only after that should implementation begin.

## 9. Evidence discipline

Never treat any of these as proof by themselves:

- file existence;
- migration existence;
- green historical CI;
- old Devnet success;
- mergeable PR;
- a configured-looking environment variable in `.env.example`;
- a frontend success message;
- a webhook notification;
- a reference hit;
- a mock/provider fixture.

Evidence must be tied to the current relevant HEAD and environment.

## 10. Pay launch lock

`PAY_API_ENABLED=false` and the public `/pay` route remain intentionally disabled until every mandatory release gate in the V1 contract is independently satisfied.

No chat, workflow, or automation may flip the Pay launch flag as a shortcut around a failing or unknown gate.

## 11. Current workstream snapshot — 2026-09-03

- Main branch HEAD: `30a4de0df02b788d2eeedb88377115922805fffb`.
- Current Pay audit branch HEAD at handoff update: `f23b0265907de1762d9d493cf24b21a80ed68325`.
- Prior audit branch HEAD was `3de6c7c2f189452e8aec25d38fde8c0489866508`.
- The latest audit branch change enabled the audited-branch schema-capture workflow trigger; the handoff update itself records the verified state.
- Pay audit work is tracked in PR #37; Pay foundation work is tracked separately in PR #36.
- PR #37 remains open/draft and audit-only; `/pay` remains disabled.
- Production Supabase currently has 55 applied historical migrations and no Pay migrations; direct schema inspection confirms no Pay schema layer in production.
- The migration baseline remains the highest-risk blocker before any Pay production migration.
- A read-only canonical schema-capture mechanism is now committed, but the captured artifact itself has not been obtained/verified through GitHub workflow evidence.
- No current-HEAD CI PASS is claimed for the latest audit branch HEAD.
- The existing Helius/Cloudflare RPC arrangement is a completed infrastructure decision, not an open setup task.

This snapshot must be revalidated at the start of the next session rather than assumed current forever.

## 12. What to do next

The immediate next gate is the canonical production schema capture and its independent validation. Once the artifact exists, compare it against the repository's historical migration intent and use that comparison to design a controlled baseline without fabricating migration provenance.

After the baseline is genuinely repaired:

```text
Migration baseline reconciliation
      ↓
Isolated Pay migration replay/security
      ↓
Controlled production Pay migration plan
      ↓
Reconciliation/accounting concurrency
      ↓
Webhook race/replay/SSRF E2E
      ↓
Current-HEAD CI verification
      ↓
Current-HEAD real Devnet E2E
      ↓
Independent adversarial release audit
      ↓
Only then consider enabling /pay
```

Do not skip the baseline stage because Pay migration files look internally complete.
