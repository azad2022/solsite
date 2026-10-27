# SolMint Pay — Bulk Pay Duplicate and Replay Safety Checkpoint

Date: 2026-10-27

## Status

**PR #353 MERGED/DEPLOYED — DATABASE CREATE CAPABILITY + SOL AMOUNT GUARDS VERIFIED LIVE — POST-DEPLOYMENT GATES PASS — MIGRATION PROVENANCE UNKNOWN — FULL BULK PAY LIFECYCLE NOT ACCEPTED**

- Phase A schema PR [#349](https://github.com/azad2022/solsite/pull/349), merged as `f028f8a7a05f8c240d5b79ac72d02d23935afa52`.
- Application PR [#348](https://github.com/azad2022/solsite/pull/348), merged as `39d4f0dd13199a05937af7c39d50588a989c21a3`.
- Pending-signature recovery PR [#351](https://github.com/azad2022/solsite/pull/351), merged as `0e228bb3553a20d8e345038ff9e71cb93604aea0`.
- Phase B submit-capability migration PR [#350](https://github.com/azad2022/solsite/pull/350), merged as `38223b14272aab57bf0d1c3ebfe993d9ec054dc0`.
- Smoke workflow hardening PR [#352](https://github.com/azad2022/solsite/pull/352), merged as `d8523ea01c4d4cb7e16f522587b322a300744242` on 2026-10-27.

## Implementation

- Duplicate canonical Solana recipients are rejected in UI, API and SQL before batch creation. A unique index on `(batch_id, recipient)` is the final database guard.
- One exact unsigned transaction is persisted privately per payout batch; retries return the same message and an expired transaction is not silently replaced.
- Submitted Signature is validated against the exact server-prepared transaction message.
- Transaction preparation and submit mutation require an explicit server-issued internal JWT capability.
- If wallet send returns a signature but API registration fails, the UI stores that public signature, batch ID and idempotency key per batch in tab-scoped `sessionStorage` before submission and offers retry after reload without sending another wallet transaction.
- Recovery strings are localized for `fa-IR`, `en-US`, `ar`, and `ru`.

## Live database evidence

Read-only Production queries observed:
- Latest ledger version is `20261027143100`.
- Private `pay_payout_transaction_requests` table exists.
- Authenticated users cannot SELECT that table.
- Duplicate-recipient unique index exists.
- `pay_create_payout_batch` contains the duplicate-recipient guard.
- `pay_submit_payout_batch` contains the `solmint_pay_payout_builder` capability check.
- Authenticated retains EXECUTE permission on the submit RPC, but a normal user JWT is denied by the function-level capability guard.

The live ledger change was observed during read-only verification. I did not dispatch the Production Migration workflow, and the available GitHub Actions history did not establish the execution origin. This provenance remains **UNKNOWN**; no direct SQL migration was issued by this work.

## Production application gates

For deployed application commit `0e228bb3553a20d8e345038ff9e71cb93604aea0`:
- CI / unit tests: **PASS** — [40504617076](https://github.com/azad2022/solsite/actions/runs/40504617076).
- Production Build: **PASS** — [40504617137](https://github.com/azad2022/solsite/actions/runs/40504617137).
- Database Security: **PASS** — [40504617162](https://github.com/azad2022/solsite/actions/runs/40504617162).
- Devnet E2E: **PASS** — [40504616977](https://github.com/azad2022/solsite/actions/runs/40504616977).
- Mainnet Read-only: **PASS** — [40504617067](https://github.com/azad2022/solsite/actions/runs/40504617067).
- Production API Smoke: **PASS** — [40504617133](https://github.com/azad2022/solsite/actions/runs/40504617133).
- Live Smoke: **PASS** — [40504617047](https://github.com/azad2022/solsite/actions/runs/40504617047).
- Live Browser Audit: **PASS**, including referral lifecycle + authenticated UI: [40504617088](https://github.com/azad2022/solsite/actions/runs/40504617088).
- Cloudflare Pages: **PASS**.
- Production Browser UI E2E: **PASS** — [run 40504617153](https://github.com/azad2022/solsite/actions/runs/40504617153), including the dedicated referral lifecycle and authenticated production UI flow.

## Post-merge verification — 2026-10-27

For current `main` commit `d8523ea01c4d4cb7e16f522587b322a300744242`:
- CI / Quality and unit tests: **PASS** — [40520417775](https://github.com/azad2022/solsite/actions/runs/40520417775).
- Production Build: **PASS** — [40520417755](https://github.com/azad2022/solsite/actions/runs/40520417755).
- Authentication Build Verification: **PASS** — [40520417756](https://github.com/azad2022/solsite/actions/runs/40520417756).
- Cloudflare Pages deployment: **PASS** — [check 122246331873](https://github.com/azad2022/solsite/runs/122246331873).
- Production API Smoke: **PASS** after the exact commit's successful Pages check — [40520417881](https://github.com/azad2022/solsite/actions/runs/40520417881).
- Live Smoke: **PASS** after the exact commit's successful Pages check — [40520417819](https://github.com/azad2022/solsite/actions/runs/40520417819).

Database Security and real Devnet Bulk Pay E2E remain **PASS on the unchanged application/Phase B source commit** `38223b14272aab57bf0d1c3ebfe993d9ec054dc0`: [Database Security 40505975783](https://github.com/azad2022/solsite/actions/runs/40505975783), [Devnet E2E 40505975665](https://github.com/azad2022/solsite/actions/runs/40505975665). They were not re-run on `d8523ea`; this merge changed workflows and documentation, not payout application code.

The post-Phase-B smoke automation gap is **CLOSED / PASS**. The full Bulk Pay production lifecycle is **NOT YET ACCEPTED**: current production API/Live Smoke are non-mutating contract checks and do not run an authenticated payout from batch creation through real submission and final verification. The actual Devnet transaction E2E exercises transaction building, submission and verification logic, but not the entire authenticated production API/database flow.

### Current state after PR #353 — 2026-10-27

This section supersedes the earlier input-contract and SOL amount blocker status above.

- **PASS — Database create-RPC boundary is live.** The live function requires `solmint_pay_payout_creator=true`; the ordinary authenticated caller test, executed inside a rollback transaction, returned `{"state":"unauthorized"}`.
- **PASS — SOL safe-amount boundary is live.** The SQL function rejects atomic amounts over `9007199254740991`; the API now validates with `BigInt` before batch creation.
- **PASS — current application release gates on code SHA `6972b0e7aa74e670245045720d332c24c604af27`:** Pages [122257148361](https://github.com/azad2022/solsite/runs/122257148361), CI [40523523302](https://github.com/azad2022/solsite/actions/runs/40523523302), Production Build [40523523154](https://github.com/azad2022/solsite/actions/runs/40523523154), Authentication Build Verification [40523523389](https://github.com/azad2022/solsite/actions/runs/40523523389), Database Security [40523523221](https://github.com/azad2022/solsite/actions/runs/40523523221), Devnet E2E [40523523771](https://github.com/azad2022/solsite/actions/runs/40523523771), Production API Smoke [40523523238](https://github.com/azad2022/solsite/actions/runs/40523523238), Live Smoke [40523522949](https://github.com/azad2022/solsite/actions/runs/40523522949), and Browser UI E2E [40523523299](https://github.com/azad2022/solsite/actions/runs/40523523299).
- **PASS — migration version recorded and live SQL matches.** Production ledger contains `20261027150000_solmint_pay_bulk_payout_create_capability_hardening`; live function body contains both the creator-capability guard and the SOL bound.
- **UNKNOWN — migration execution provenance / release-policy path.** Supabase logs at `2026-10-27T14:41:49.895Z` show a runner cloning `git_ref=main`; at `14:41:54.694Z` it logs that it is applying `20261027150000_solmint_pay_bulk_payout_create_capability_hardening.sql`, followed by PostgreSQL DDL at `14:41:54.831Z`. The `Supabase Preview` check for the merge SHA ran in the same 14:41:49–14:41:55 window, but the logs don't identify the initiating actor/control. No corresponding 2026-10-27 run was found for the repository's `workflow_dispatch` Production Migration workflow. Trace this via [issue #355](https://github.com/azad2022/solsite/issues/355); do not guess the actor or rollback the security hardening while provenance is being investigated.
- **NOT RUN — full authenticated Bulk Pay lifecycle E2E.** Production API Smoke and Live Smoke do not execute a Batch from authenticated creation through wallet submit/recovery and finalized verification. Track [issue #354](https://github.com/azad2022/solsite/issues/354). Do not call the feature fully production-accepted until this gate passes against an isolated database and Devnet without real Mainnet transfers.
- **FAIL — legacy `Workers Builds: solsite` integration** [122257789655](https://github.com/azad2022/solsite/runs/122257789655). This is a separate old Worker integration; Cloudflare Pages is the configured deployment and is **PASS**.
- **NOT RUN on this release SHA — Mainnet Read-only.** Most recent previously observed pass was on the older source SHA `0e228bb3553a20d8e345038ff9e71cb93604aea0` (run [40504617067](https://github.com/azad2022/solsite/actions/runs/40504617067)); do not present that as a fresh post-merge run.

No Mainnet transfer was sent by this audit. Payment completion remains dependent on backend verification of a finalized transaction matching the authoritative Batch snapshot.

## 2026-10-27 — PR #353 result and production verification

Status: **MERGED + DEPLOYED / CORE GATES PASS / FULL BULK PAY ACCEPTANCE BLOCKED ON LIFECYCLE E2E AND MIGRATION-PROVENANCE AUDIT**

PR [#353](https://github.com/azad2022/solsite/pull/353) merged as `6972b0e7aa74e670245045720d332c24c604af27`. The PR added the distinct server-issued `solmint_pay_payout_creator` capability, route/SQL validation of the current SOL safe-lamport ceiling, and regression tests for direct-RPC denial and JWT capability separation.

Post-merge evidence for code SHA `6972b0e7aa74e670245045720d332c24c604af27`:
- CI / Quality: **PASS** — [40523523302](https://github.com/azad2022/solsite/actions/runs/40523523302).
- Production Build: **PASS** — [40523523154](https://github.com/azad2022/solsite/actions/runs/40523523154).
- Authentication Build Verification: **PASS** — [40523523389](https://github.com/azad2022/solsite/actions/runs/40523523389).
- Cloudflare Pages deployment: **PASS** — [122257148361](https://github.com/azad2022/solsite/runs/122257148361).
- Database Security: **PASS** — [40523523221](https://github.com/azad2022/solsite/actions/runs/40523523221).
- Devnet E2E: **PASS** — [40523523771](https://github.com/azad2022/solsite/actions/runs/40523523771).
- Production API Smoke: **PASS** — [40523523238](https://github.com/azad2022/solsite/actions/runs/40523523238).
- Live Smoke: **PASS** — [40523522949](https://github.com/azad2022/solsite/actions/runs/40523522949).
- Production Browser UI E2E: **PASS** — [40523523299](https://github.com/azad2022/solsite/actions/runs/40523523299); this exercises merchant/wallet/invoice/payment-link/support/browser flows but not the Bulk Pay payout lifecycle.

Production read-only verification confirms Phase A `20261027143000`, Phase B `20261027143100`, and Phase C `20261027150000` are recorded in the migration ledger. The live `pay_create_payout_batch` definition includes `coalesce(auth.jwt()->>'solmint_pay_payout_creator','') <> 'true'` and the SOL atomic bound `9007199254740991`. A rollback-only production direct-RPC probe using an ordinary authenticated JWT returned `{"state":"unauthorized"}`.

### Migration execution provenance — UNKNOWN

The migration was not manually executed by this audit, and this audit did not call Supabase `apply_migration`/branch-merge tools or dispatch the controlled Production Migration GitHub workflow. Nevertheless, the Supabase live logs show an internal runner:
- branch ID `fabf1ac3-5428-45a1-a707-f466ee49eaed` (default project branch `main`);
- internal `workflow_run` ID `139e72e99c09443a9cc8d0ee1ef10e36`;
- at `2026-10-27T14:41:49.895Z`, “Cloning git repo... git_ref=main”;
- at `2026-10-27T14:41:54.694Z`, “Applying migration...” for `20261027150000_solmint_pay_bulk_payout_create_capability_hardening.sql`;
- PostgreSQL logs show the corresponding function DDL at `2026-10-27T14:41:54.831Z`.

The `Supabase Preview` app check on merge commit `6972b0e` started at `14:41:49Z` and completed successfully at `14:41:55Z`; timing correlates with the runner, but no actor/initiating control is present. The repository’s official `.github/workflows/solmint-pay-production-migration.yml` has only `workflow_dispatch` and requires `confirm=APPLY`; no 2026-10-27 run of that workflow was found. The source/trigger must remain **UNKNOWN** until [issue #355](https://github.com/azad2022/solsite/issues/355) resolves it. Do not claim that the official manual migration gate ran, and do not roll back this security hardening while provenance is being investigated.

### Remaining acceptance gates

- **BLOCKED — full authenticated Bulk Pay lifecycle E2E**, tracked in [issue #354](https://github.com/azad2022/solsite/issues/354). Current API/Live Smoke are non-mutating contract suites; Devnet E2E validates transaction build/send/finalized verification but does not run the whole authenticated HTTP API/database lifecycle.
- **UNKNOWN — production migration automation path**, tracked in issue #355.
- **FAIL — legacy `Workers Builds: solsite`** [122257789655](https://github.com/azad2022/solsite/runs/122257789655), separate from successful Cloudflare Pages.
- **NOT RUN on current release SHA — Mainnet Read-only**; previous historical PASS was on `0e228bb3553a20d8e345038ff9e71cb93604aea0`, not the current release.

No Mainnet payout/transfer was sent by this audit. The feature must not be labelled fully production-ready until the lifecycle and governance gates are closed.