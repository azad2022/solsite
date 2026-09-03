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

## 5. Database state rule

The Pay migration chain exists in Git, but repository migrations are not evidence that the live database has them.

The current connected Supabase project is `nvopkbiedorfshwbmyhn` in `eu-central-1`. As of **2026-09-03**, the production migration history ends at version `20260826190853` and contains **no SolMint Pay migration versions**. Direct inspection also finds no `pay_*` tables, `pay_*` routines, or Pay triggers in the production public schema. The Pay database layer is therefore **not production-validated and not deployed**.

There is a second, independent migration blocker: the Supabase project reports its protected `main` branch as `MIGRATIONS_FAILED`, and the branch-action log on **2026-09-03** recorded `Remote migration versions not found in local migrations directory` while cloning the repository's `main` ref. The repository's current `main` migration files do not use the same historical version identifiers recorded in the live Supabase migration history. This means the Git repository and Supabase migration baseline are already divergent before Pay is introduced.

**Do not interpret this as a Pay migration bug and do not repair it by adding arbitrary no-op migration placeholders or by blindly applying the full Pay chain to production.** The baseline must first be reconstructed/reconciled from authoritative production history and repository schema state.

Before any production migration action:

1. confirm the intended Supabase project/environment;
2. inspect its exact migration history and actual schema objects;
3. map every remote migration version to the repository migration that produced the corresponding schema change;
4. determine whether the repository is missing historical migrations, renamed migrations, or a generated baseline;
5. use an isolated database for Pay migration replay and destructive/security testing;
6. validate Pay tables, indexes, constraints, functions, triggers, RLS and grants;
7. only then prepare a controlled production migration plan that preserves the existing database history.

The database security workflow is intentionally isolated: it bootstraps only the minimal prerequisite `users` table and applies the Pay migration subset for replay/security testing. This CI database is not production evidence and does not repair the live migration baseline.

## 6. Workflow contract

The Pay workflows are deliberately separated by responsibility:

### `solmint-pay-security.yml`

Runs Node/Bun type checking plus Pay policy/security tests.

### `solmint-pay-database-security.yml`

Builds an isolated Supabase environment, runs Pay database tests, resets the isolated database, and runs the database tests again to prove replayability.

### `solmint-pay-devnet-e2e.yml`

Runs the real Devnet transaction harness with an ephemeral sender keypair funded by a dedicated Devnet funding wallet. It must never consume or print the production Helius credential.

All three Pay workflows must use the same trigger principle:

```text
Pull request -> main
Push         -> Pay working branches (`feat/solmint-pay-*`, `audit/solmint-pay-*`)
Manual       -> workflow_dispatch
```

Path filters remain enabled so unrelated site changes do not create unnecessary Pay runs.

Pay workflows are evidence collectors. A workflow that is skipped, cancelled, incomplete, stale, or tied to an old SHA is not a production PASS.

The generic repository CI remains separate from these focused Pay gates.

## 7. Session-start procedure for every future ChatGPT/engineer

Do not start by changing code.

Start by fetching:

1. `main` branch SHA;
2. current Pay working branch SHA;
3. open Pay PR metadata and merge-base/divergence;
4. relevant workflow definitions and latest current-HEAD runs;
5. authoritative V1 contract;
6. this continuation document;
7. relevant source files and migrations;
8. live Supabase schema/migration state when database questions are involved.

Then answer, internally and explicitly in the working notes:

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

## 8. Evidence discipline

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

## 9. Pay launch lock

`PAY_API_ENABLED=false` and the public `/pay` route remain intentionally disabled until every mandatory release gate in the V1 contract is independently satisfied.

No chat, workflow, or automation may flip the Pay launch flag as a shortcut around a failing or unknown gate.

## 10. Current workstream snapshot — 2026-09-03

- Main branch HEAD: `30a4de0df02b788d2eeedb88377115922805fffb`.
- Current Pay audit branch HEAD: `007bd045ed64466be8b04cf6691e303e0cccd525`.
- Pay audit work is being tracked in PR #37; the Pay foundation branch is tracked separately in PR #36.
- PR #37 remains open/draft and is explicitly audit-only; `/pay` remains disabled.
- The audit branch contains the Pay resilience wrapper, hardened verification/reconciliation/database logic, focused Pay tests, and focused Pay workflows.
- Production Supabase does not yet contain the Pay migration/schema layer.
- Production Supabase also has a pre-existing migration-baseline drift: its recorded historical versions are not present under the same identifiers in the repository's `main` migration directory, and its protected `main` branch currently reports `MIGRATIONS_FAILED`.
- The existing Helius/Cloudflare RPC arrangement is a completed infrastructure decision, not an open setup task.
- No current-HEAD CI PASS is claimed for `007bd045ed64466be8b04cf6691e303e0cccd525`; the latest verified state had no workflow run evidence for that exact docs-only HEAD.

This snapshot must be revalidated at the start of the next session rather than assumed current forever.

## 11. What to do next

Unless fresh evidence reveals a higher-severity blocker, the next logical stage is:

**Database Integration & Migration Baseline Audit**

The first objective is not to deploy Pay. It is to reconcile the existing Supabase migration history with the repository's actual schema history without losing or rewriting production history.

Then:

```text
Migration baseline reconciliation
      ↓
Isolated Pay migration replay/security
      ↓
Controlled production migration plan
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
