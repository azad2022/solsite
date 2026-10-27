# SolMint Pay — Bulk Pay Duplicate and Replay Safety Checkpoint

Date: 2026-10-27

## Status

**PHASE A/B RECORDED LIVE — POST-PHASE-B API/LIVE SMOKES PASS — PR #353 OPEN/DRAFT — DATABASE SECURITY + DEVNET + CI PASS — PAGES PREVIEW GATE IN PROGRESS — FULL LIFECYCLE NOT ACCEPTED**

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

### Remaining technical blockers

- **BLOCKED — Database input contract:** `pay_create_payout_batch` accepts recipient strings by Base58 alphabet/length rather than fully validating a canonical 32-byte Solana public key. It also accepts an arbitrary non-null `token_mint` for `USDC`/`USDT` when invoked directly via its `authenticated` EXECUTE grant; the public API applies stronger validation/asset configuration, but the RPC itself is independently callable. Add isolated PostgreSQL adversarial tests and harden the trusted boundary before calling this feature fully release-ready.
- **BLOCKED — SOL amount preparability:** creation accepts up to 78-digit atomic amounts while the transaction builder rejects SOL amounts above `Number.MAX_SAFE_INTEGER`; a batch can be created successfully but later cannot be built. Align create-time validation with the actual builder/asset contract without floating point.
- **NOT RUN — Authenticated production Bulk Pay lifecycle/browser E2E:** the existing production API Smoke and Live Smoke do not create/sign/verify a payout batch. Do not infer production payout acceptance from their passing results.
- **UNKNOWN — Phase B migration provenance:** Production ledger records `20261027143100`; the available Actions evidence does not establish which actor/workflow applied it. No migration was run by this audit.

The separate legacy `Workers Builds: solsite` check remains **FAILURE** while Cloudflare Pages is **PASS**; the repository is deployed through Pages and this old Worker integration is not the Pages deployment. No payment completion is inferred from a submitted signature; backend/database/finalized-blockchain verification remains authoritative.


## 2026-10-27 — PR #353 database-create boundary remediation

Status: **OPEN / DRAFT — CORE CI, DATABASE SECURITY, AND DEVNET PASS — PAGES PREVIEW/PRODUCTION BUILD UNKNOWN (IN PROGRESS)**

PR: [#353 — require internal capability for payout batch creation](https://github.com/azad2022/solsite/pull/353)
Branch: `fix/pay-bulk-payout-create-capability`
Tested PR head: `2e774240a2938f6354f9125a578bffc02a530fb8`

Changes on the branch only:
- Adds a distinct short-lived `solmint_pay_payout_creator` internal JWT capability. The Batch-create API mints it server-side after normal identity resolution and passes the trusted token to `pay_create_payout_batch`.
- Adds a new repository migration `20261027150000_solmint_pay_bulk_payout_create_capability_hardening.sql`; it is **not applied in Production**.
- Rejects SOL item amounts above `9007199254740991` atomic units before Batch creation in the API and SQL, matching the existing transaction builder’s safe integer limitation.
- Adds JWT-claim separation, direct-RPC denial/arbitrary-mint regression, database amount-boundary checks, and builder amount-boundary tests.

Observed gates on the tested PR head:
- CI/quality/unit tests: **PASS** — [40522451593](https://github.com/azad2022/solsite/actions/runs/40522451593).
- Database Security SQL fixture: **PASS** — [40522450599](https://github.com/azad2022/solsite/actions/runs/40522450599).
- Devnet E2E: **PASS** — [40522450792](https://github.com/azad2022/solsite/actions/runs/40522450792).
- Production Build: **IN PROGRESS** — [40522450728](https://github.com/azad2022/solsite/actions/runs/40522450728). The production bundle/typecheck succeeded; the job is waiting on the Cloudflare Pages preview routing assertion.
- Cloudflare Pages preview: **IN PROGRESS** — [check 122252655944](https://github.com/azad2022/solsite/runs/122252655944).
- Supabase Preview: **SKIPPED** under the project’s preview-free delivery policy.
- Legacy Workers Builds: **FAILURE**, separate from Pages — [check 122253430785](https://github.com/azad2022/solsite/runs/122253430785).

No merge has been performed for PR #353. No production migration was dispatched, no Mainnet transfer was sent, and Phase B migration provenance remains **UNKNOWN**. Do not merge while the Pages/Production Build gate is unresolved. After source release, the new migration must only be applied through the controlled Production Migration workflow and only after explicit approval.
