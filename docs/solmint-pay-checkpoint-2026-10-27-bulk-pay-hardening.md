# SolMint Pay — Bulk Pay Duplicate and Replay Safety Checkpoint

Date: 2026-10-27

## Status

**SOURCE VALIDATED — RELEASE STAGED — NOT MERGED TO MAIN OR RELEASED TO PRODUCTION**

- Application PR: [#348 — Bulk Pay duplicate and replay safety](https://github.com/azad2022/solsite/pull/348)
- Phase A schema PR: being prepared separately for a backward-compatible migration.
- Phase B submit hardening migration: intentionally separate; do not apply before the new application deployment.

## What is fixed

- Duplicate canonical Solana recipients are rejected in the UI and API before batch creation. The SQL create function repeats the check and a unique index provides a database guard.
- One unsigned transaction is persisted privately per payout batch. Concurrent preparation is serialized and retry returns the identical prepared bytes.
- A prepared transaction is not silently replaced after expiry; its prior outcome must be reconciled first.
- Signature submission is validated against the exact server-prepared transaction message.
- Prepared transaction lifecycle functions use an explicit server-only internal JWT capability.
- If wallet submission returns a signature but API registration fails, the UI preserves the signature and idempotency key so registration can be retried without creating another transaction.

## Validation evidence

The functional implementation passed on source commit `a5956081e983350603858c79dacb3480a5551ee4`:

- CI / unit tests: [run 40499850986](https://github.com/azad2022/solsite/actions/runs/40499850986)
- Production Build: [run 40499851031](https://github.com/azad2022/solsite/actions/runs/40499851031)
- Database Security: [run 40499850883](https://github.com/azad2022/solsite/actions/runs/40499850883)
- Devnet E2E: [run 40499851161](https://github.com/azad2022/solsite/actions/runs/40499851161)
- Mainnet Read-only: [run 40499851193](https://github.com/azad2022/solsite/actions/runs/40499851193)

The checkpoint commit also passed all five gates:

- CI: [run 40500223243](https://github.com/azad2022/solsite/actions/runs/40500223243)
- Production Build: [run 40500223234](https://github.com/azad2022/solsite/actions/runs/40500223234)
- Database Security: [run 40500223250](https://github.com/azad2022/solsite/actions/runs/40500223250)
- Devnet E2E: [run 40500223324](https://github.com/azad2022/solsite/actions/runs/40500223324)
- Mainnet Read-only: [run 40500223235](https://github.com/azad2022/solsite/actions/runs/40500223235)

Cloudflare Pages preview passed. The separate legacy `Workers Builds: solsite` integration fails but is not the production Pages path. Supabase Preview remains skipped by the repository's preview-free constraint.

Production read-only preflight found zero existing batches with duplicate recipient rows.

## Mandatory staged release order

The original single migration was split because changing `pay_submit_payout_batch` in the same migration that introduces API dependencies creates a compatibility gap.

1. **Phase A — schema only:** merge the schema-only PR containing `20261027143000_solmint_pay_bulk_payout_duplicate_and_transaction_request_safety.sql`. It adds the duplicate guard, unique index, private prepared-transaction table and internal reservation RPCs, but deliberately leaves the current submit RPC unchanged. Run the controlled production migration workflow and verify the live migration ledger.
2. **Phase A production verification:** confirm the migration applied and existing Bulk Pay endpoints still work. Do not deploy the new application before this check.
3. **Phase B application:** merge application PR #348 only after Phase A is live. Cloudflare Pages must deploy the new API/UI code; then run production smoke checks. The application remains compatible because it uses the internal builder JWT when calling the existing submit RPC.
4. **Phase B — legacy submit hardening:** only after the new application is deployed and verified, merge the separate migration `20261027143100_solmint_pay_bulk_payout_submit_capability_hardening.sql` and apply it through the controlled workflow. This makes the legacy submit RPC reject ordinary user JWTs.
5. Re-run CI, database security and production API smoke; update this checkpoint with live production evidence.

Do not apply Phase B before the application deployment. Do not use manual SQL. Do not dispatch the production migration workflow with `confirm=APPLY` until the previous phase has positive evidence.

## Current production state

- The live migration ledger last observed is `20261026091519`.
- Neither Phase A nor Phase B has been applied to Production.
- No Production database mutation was performed during this task.
- PR #348 remains Draft; the production release is not complete.
