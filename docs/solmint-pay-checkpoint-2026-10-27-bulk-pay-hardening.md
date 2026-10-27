# SolMint Pay — Bulk Pay Duplicate and Replay Safety Checkpoint

Date: 2026-10-27

## Status

**VALIDATED IN DRAFT PR — NOT MERGED — NOT RELEASED TO PRODUCTION**

- PR: [#348 — Bulk Pay duplicate and replay safety](https://github.com/azad2022/solsite/pull/348)
- Branch: `fix/bulk-pay-duplicate-and-replay-safety`
- Functional source commit validated: `a5956081e983350603858c79dacb3480a5551ee4`

## Scope

- Reject duplicate canonical Solana recipient addresses in the UI and API before a payout batch is created.
- Apply the same duplicate rule in the database create function and add a unique index on `(batch_id, recipient)`.
- Persist one exact unsigned transaction per batch in a table that is not directly selectable by `anon` or `authenticated`.
- Atomically claim transaction preparation so concurrent requests do not build different payout transactions for the same batch; retries return the saved transaction bytes.
- Fail closed for an expired prepared transaction instead of automatically generating a replacement that could duplicate a previously broadcast payment.
- Validate the submitted Ed25519 signature against the exact server-prepared transaction message.
- Restrict transaction reservation/read/store/release and the prepared submit path to the explicit server-only internal JWT capability.
- Preserve a returned wallet signature and idempotency key in the current UI state when submit registration fails, allowing registration retry without asking the wallet to create a different transaction.

## Validation Evidence

The following GitHub Actions runs passed for functional source commit `a5956081e983350603858c79dacb3480a5551ee4`:

- CI / typecheck / production build / unit tests: [run 40499850986](https://github.com/azad2022/solsite/actions/runs/40499850986)
- Production Build: [run 40499851031](https://github.com/azad2022/solsite/actions/runs/40499851031)
- Pay Database Security: [run 40499850883](https://github.com/azad2022/solsite/actions/runs/40499850883)
- Pay Devnet E2E: [run 40499851161](https://github.com/azad2022/solsite/actions/runs/40499851161)
- Pay Mainnet Read-only: [run 40499851193](https://github.com/azad2022/solsite/actions/runs/40499851193)
- Cloudflare Pages preview check: **PASS**.

Production read-only preflight found **zero existing batches with duplicate recipient rows**, so the new unique index has no known duplicate-row cleanup prerequisite.

The separate legacy `Workers Builds: solsite` check still reports a failure for the unrelated Cloudflare Worker integration. It is not the repository's Cloudflare Pages deployment path and is not counted as a Pay release gate. Supabase Preview remains skipped under the project's preview-free delivery constraint.

## Production Release Gate — Still Open

The new migration is **not applied to Production**. The live migration ledger currently ends at `20261026091519`; migration `20261027143000_solmint_pay_bulk_payout_duplicate_and_transaction_request_safety.sql` remains pending.

Do not mark this feature production-ready and do not merge/release blindly. The migration changes a server-side submit RPC and the new API code depends on the new prepared-transaction functions/table. Release sequencing must be explicitly validated before production mutation. Use the controlled `SolMint Pay Production Migration` GitHub Actions workflow with its explicit `confirm=APPLY` input only after the deployment order is decided. No production database mutation was performed as part of this checkpoint.
