# SolMint Pay — Bulk Pay Duplicate and Replay Safety Checkpoint

Date: 2026-10-27

## Status

**APPLICATION DEPLOYED — PHASE A AND PHASE B MIGRATIONS CONFIRMED LIVE — POST-PHASE-B SMOKE AUTOMATION FIX OPEN**

- Phase A schema PR [#349](https://github.com/azad2022/solsite/pull/349), merged as `f028f8a7a05f8c240d5b79ac72d02d23935afa52`.
- Application PR [#348](https://github.com/azad2022/solsite/pull/348), merged as `39d4f0dd13199a05937af7c39d50588a989c21a3`.
- Pending-signature recovery PR [#351](https://github.com/azad2022/solsite/pull/351), merged as `0e228bb3553a20d8e345038ff9e71cb93604aea0`.
- Phase B submit-capability migration PR [#350](https://github.com/azad2022/solsite/pull/350), merged as `38223b14272aab57bf0d1c3ebfe993d9ec054dc0`.
- Smoke workflow hardening PR [#352](https://github.com/azad2022/solsite/pull/352), open Draft pending CI/build.

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

## Remaining verification

The smoke workflows did not automatically trigger on Bulk Pay SQL migrations. PR #352 adds the migration path filters and waits for positive Cloudflare Pages deployment evidence. Its merge should run Production API Smoke and Live Smoke after deployment. Both must pass to close the post-Phase-B verification gate.

The separate legacy `Workers Builds: solsite` integration is not the Cloudflare Pages production path. No payment completion is inferred from signature submission; backend/blockchain verification remains authoritative.
