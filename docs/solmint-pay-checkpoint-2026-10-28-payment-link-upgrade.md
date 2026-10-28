# SolMint Pay — Payment Link Upgrade Stages 2–3 Checkpoint

Date: 2026-10-28

## Current decision

**FEATURE IMPLEMENTATION PASSES; FINAL WORKFLOW-CORRECTION GATES ARE RUNNING — PRODUCTION RELEASE BLOCKED BY DATABASE AUTHENTICATION AND MIGRATION-RUNNER PROVENANCE**

- Pull request: [#363 — Payment Link upgrade stages 2–3](https://github.com/azad2022/solsite/pull/363)
- Original implementation SHA: `d0ef0830e71c191e6c83706b128d7da2d5e205fd`
- Latest workflow credential-source fix SHA: `2b11b495d4fa35a246b1a18848104093e7b3b25a` (final production-build check was still running when this checkpoint was prepared)
- Feature branch: `feat/pay-payment-link-upgrade-stages-2-3`
- PR is still Draft and not merged.
- No production DDL was applied by this work.

## Implemented scope

- Merchant-configured HTTPS success redirect is snapshotted onto the Payment Intent. Checkout redirects only after the fetched authoritative Payment Intent status is `completed`.
- Optional `max_payments` is enforced by the database creation routine while the Payment Link row is locked. The displayed remaining count is informative only; it does not authorize a payment.
- Up to five allowlisted custom Checkout fields have validated definitions and values. Values are stored on the Payment Intent and not returned by the public Payment Intent endpoint. The authenticated merchant transaction detail path exposes the supported values/definitions to the merchant.
- Merchant management UI, public Checkout form, service/domain contracts, four-locale copy and regression/security tests were added.
- A two-session PostgreSQL concurrency test submits two independent requests against a one-payment link and requires exactly one `created`, one `capacity_reached`, and one active/completed reservation.
- The Production Build preview smoke was fixed to select a successful Cloudflare Pages check with a valid Preview URL, rather than mistaking a Cloudflare dashboard log URL for the preview.
- The controlled migration workflow now has a `DRY_RUN` mode which executes the dry-run and migration-list steps but cannot execute the apply step. A test guards the `APPLY` condition.

## Validation evidence for SHA `d0ef0830e71c191e6c83706b128d7da2d5e205fd`

| Gate | Result | Evidence |
|---|---|---|
| CI / typecheck / unit tests | **PASS** | [Run 40709977425](https://github.com/azad2022/solsite/actions/runs/40709977425) |
| Production Build and Cloudflare Pages preview route smoke | **PASS** | [Run 40709977371](https://github.com/azad2022/solsite/actions/runs/40709977371) |
| Database Security, including concurrent capacity test | **PASS** | [Run 40709977423](https://github.com/azad2022/solsite/actions/runs/40709977423) |
| SolMint Pay Devnet E2E | **PASS** | [Run 40709977346](https://github.com/azad2022/solsite/actions/runs/40709977346) |
| SolMint Pay Mainnet read-only | **PASS** | [Run 40709977332](https://github.com/azad2022/solsite/actions/runs/40709977332) |
| Cloudflare Pages preview deployment | **PASS** | [Check 122893638894](https://github.com/azad2022/solsite/runs/122893638894) |
| Supabase Preview | **SKIPPED** | Project branching/preview DB is disabled; SQL security tests ran against a disposable PostgreSQL database. |
| Legacy `Workers Builds: solsite` | **FAIL — NON-GATING LEGACY CHECK** | [Check 122892998006](https://github.com/azad2022/solsite/runs/122892998006). Cloudflare Pages, the configured production release integration, passed. |

## Production database facts (read-only)

- Latest applied migration is `20261028064400` (`solmint_pay_webhook_payload_enrichment`).
- Repository contains 105 migration files; Production records 104 migration versions. The only repository migration not recorded in Production is `20261028101500_solmint_pay_payment_link_upgrade_stages_2_3.sql`.
- Production `public.pay_payment_links` does not contain `success_url`, `max_payments`, or `checkout_fields`.
- Production `public.pay_payment_intents` does not contain `payment_link_success_url`, `payment_link_checkout_fields`, or `customer_custom_fields`.
- Live Payment Link create/update RPCs still have the pre-upgrade signatures.
- RLS is enabled on the Payment Link, Payment Intent and idempotency tables. Authenticated clients have no direct INSERT grant on Payment Links/Intents, nor direct SELECT/INSERT on idempotency keys.
- The live Payment Intent table has its expiry guard as the only user-defined trigger.
- All of the above were queried read-only. The live migration ledger has not been edited.

## Migration preflight — BLOCKED (new evidence collected 2026-10-28)

### Connection history and root-cause evidence
- The workflow's older, controlled implementation successfully authenticated with its then-current database credential on 2026-09-16 in [run 35067223433](https://github.com/azad2022/solsite/actions/runs/35067223433); that run progressed to a migration-lineage error (`Remote migration versions not found in local migrations directory`). So a connection method using the Supavisor session pooler and the database password did work historically.
- The current workflow's explicit `PGPASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}` plumbing is intact. On 2026-10-28, both [main run 40647321161](https://github.com/azad2022/solsite/actions/runs/40647321161) and [feature run 40710242502](https://github.com/azad2022/solsite/actions/runs/40710242502) reached the correct Supavisor endpoint and were rejected by PostgreSQL with `SQLSTATE 28P01`.
- Read-only Supavisor logs independently recorded `password authentication failed for user "postgres"` for Production project `nvopkbiedorfshwbmyhn` in `eu-central-1`. The `postgres` database role is permitted to log in and has no role-expiry date.
- GitHub Actions secret metadata (values never accessed) reports `SUPABASE_DB_PASSWORD` last updated 2026-09-17T10:00:04Z and `SUPABASE_DB_URL` last updated 2026-09-17T16:38:29Z—both after the last demonstrated successful connection. These timestamps do not identify who made the update or why, and do not prove that the database password itself changed.
- The old workflow ignored the existing `SUPABASE_DB_URL` secret and synthesized its pooler endpoint from a hardcoded hostname. Inspection of the existing URL secret confirms it contains an embedded password; using that embedded credential was also rejected in [read-only run 40713657679](https://github.com/azad2022/solsite/actions/runs/40713657679).
- Workflow source has now been changed to read the existing `SUPABASE_DB_URL` secret for the host/username/database, strip its embedded password before invoking Supabase CLI, and use `SUPABASE_DB_PASSWORD` through `PGPASSWORD` as the only password source. The regression test also checks this invariant. This prevents a password embedded in the URI from overriding the standalone secret; it does not make an invalid standalone password valid.
- The most recent migration attempt was `DRY_RUN`; Apply was skipped, and no DDL was applied by these attempts.

### Current conclusion and next action
The evidence does **not** prove that the database password was changed by the owner. However, the current standalone secret and the URI-embedded password were both rejected; the exact cause/actor remains unknown. Stop further authentication attempts until the operator verifies `SUPABASE_DB_PASSWORD` against the current Production PostgreSQL password. Do not reset the Production password automatically, and do not send it in chat.


## Migration provenance — UNKNOWN

Issue [#355](https://github.com/azad2022/solsite/issues/355) records evidence that Supabase's linked GitHub runner applied earlier migrations from `main` while the repository's controlled GitHub migration workflow was failing. The initiating actor and exact integration setting remain unknown. Do not merge a new migration or change the Supabase integration based on inference; resolve this provenance path first, preserving the live security hardening already deployed.

## Required order to complete release

1. Verify/update GitHub Actions secret `SUPABASE_DB_PASSWORD` to the current Production PostgreSQL password, using a trusted password manager or existing deployment secret. Do not paste the password into chat. Then rerun `DRY_RUN` and verify it lists **only** `20261028101500_solmint_pay_payment_link_upgrade_stages_2_3.sql`.
2. Resolve the auto-migration provenance recorded in issue #355 and ensure the migration applies through the agreed, auditable path. The `APPLY` mode must not be used until the preflight and release audit pass.
3. Apply the intended migration through the controlled release path; then read-only verify columns, RPC overloads, grants/revokes, RLS, and the recorded version.
4. Update `docs/solmint-pay-live-migration-ledger.txt` only after positive evidence that Production has recorded the migration.
5. Re-run the release gates on the final source head, then make PR #363 ready, merge the application through the normal path, and perform Production Pages/API smoke checks.

The application must **not** be merged/deployed against the current Production schema, because its API selects columns that are not yet present. This checkpoint is a pre-merge validation record, not production-release acceptance.

## Audit rules

- `submitted` is not `paid`; redirect relies only on backend status `completed`.
- Capacity is database-authoritative and serialized under a Payment Link row lock.
- No direct sensitive Supabase/RPC call from frontend and no client-side secret exposure were introduced.
- No Production DDL or payment operation was performed by this checkpoint.
