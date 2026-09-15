# SolMint Pay — Engineering Progress Ledger

This file is the durable project checkpoint for Pay work. Update it when a major gate is completed so later work does not repeat an already-validated stage.

## 2026-09-14 — Devnet E2E blocker closed

Status: **COMPLETED**

Merged PR: `#79`

Merge commit on `main`: `4f261f3173ba3948fb2f607c9762edb9ef059d5d`

Scope: stabilize the real Solana Devnet payment E2E path and transaction observation.

Validated before merge:

- Dedicated Devnet CI funding wallet is configured through GitHub Secret `DEVNET_E2E_FUNDER_SECRET_KEY_B64`; the private-key value is not stored in this document.
- Funder key material validation and public-key consistency validation passed.
- Real Devnet payment submission reached the verification path.
- Memo/reference account is a signer in the real E2E transaction construction.
- Funding, submission, observation, discovery and verification use the dedicated Devnet RPC path rather than an unreliable public faucet/RPC fallback.
- RPC transaction observation now first requires finalized signature status, then may use confirmed transaction details only to tolerate provider-side transaction-detail indexing lag. Effective finality is not downgraded by this fallback.
- `SolMint Pay Devnet E2E` passed.
- CI passed.
- Production Build passed.
- Solmint Pay Mainnet Read-only passed.
- Solmint Pay Production API Smoke passed.

Conclusion: the long-running **Devnet E2E funding/transaction-observation blocker is closed and must not be re-investigated unless a new regression appears**.

## 2026-09-14 — Production API origin gate closed

Status: **COMPLETED**

Merged PR: `#81`

Validated:

- Production Pages configuration contains the real `PAY_APP_ORIGIN` value used by the authenticated Pay API origin check.
- Production API smoke was rerun after deployment and passed.
- The earlier `403 ORIGIN_FORBIDDEN` result was a pre-deployment/stale-environment observation and is not the current production blocker.

## 2026-09-14 — Repository migration history reconciliation

Status: **COMPLETED**

Merged PR: `#82`

Merge commit on `main`: `16e8dfaf51a948920e1375f04db969d0fc86a411`

Scope: reconcile the repository migration chain with the live Production migration ledger without mutating the live database, and establish a preview-free validation path.

Live database evidence used for reconciliation:

- Live Supabase project: `nvopkbiedorfshwbmyhn`.
- The earlier reconciliation recorded 69 applied migration versions through `20260911061000`.
- Repository migration history was reconstructed from the live ledger and verified historical Git sources.
- The live database was not migration-repaired or otherwise mutated by this repository-only reconciliation.
- The incorrect local `20260905000100` mapping was corrected; `20260905000200` and `20260905000300` were restored.
- The seven Better Auth migrations were restored under the exact production-recorded timestamp/name mapping.
- The non-live root migration `20260906000001` was removed from the active chain in favor of the live `20260906135730` migration.

### Preview-free decision

Status: **COMMITTED PROJECT CONSTRAINT**

The project will not depend on Supabase Preview Branching/Preview Database for Pay delivery.

The maintainer does not have access to a credit card and cannot use a paid Supabase Pro/Branching environment. This is a delivery constraint, not a security exception. Production database/RLS remains authoritative.

### Preview-free validation path

1. Keep the production migration ledger as the source of truth for the applied migration history.
2. Validate the repository migration chain in GitHub CI.
3. Run Pay database security/adversarial SQL against isolated disposable PostgreSQL in CI.
4. Run CI/typecheck/unit tests and Production Build.
5. Reuse the already-validated dedicated Devnet E2E and Mainnet read-only/runtime smoke paths for blockchain behavior.
6. Never use a public RPC/faucet fallback as a production test assumption.
7. Do not run `supabase migration repair` against production unless a later explicit, evidence-backed reconciliation requires it.

The preview-free migration gate is an integrity/reproducibility check. It does not claim plain PostgreSQL is equivalent to Supabase Preview.

### Migration-chain gate repair

The first CI implementation failed correctly by detecting six stale/duplicate Better Auth/identity filenames in the branch while the canonical production names were missing. The test was not weakened.

A second issue in the new gate was also corrected: version-boundary comparison now uses numeric 14-digit migration timestamps so newer pending migrations are not rejected accidentally.

The migration lineage was then corrected using verified historical blobs: the exact production names are restored, redundant unsuffixed files are removed, and the newer repository migration `20260911103000_pay_webhook_read_projection.sql` remains an explicit pending migration until the live migration boundary advances beyond it.

### Final validation evidence

- `SolMint Pay Database Security` passed: migration-chain integrity, identity/RLS security, and API-key lifecycle security.
- `CI` passed: typecheck, production build, unit tests, and source-tree invariant.
- `Production Build` passed.
- Cloudflare Pages preview deployment for the final PR head succeeded.
- Repository code search found no remaining references to the removed legacy identity migration filename.

This checkpoint remains **completed**.

## 2026-09-14 — API credential security gate hardening

Status: **COMPLETED**

Merged PR: `#83`

Merge commit on `main`: `6b5cc0f2e31a461f739ab5aa13a40444cb8c3751`

Scope: close the repository/runtime security gaps found during Issue #68 acceptance work without inventing a new API contract or changing financial rules.

Validated before merge:

- Pay runtime no longer logs upstream Supabase response bodies on error. Only non-sensitive scope/status context is retained.
- A dedicated regression test proves secret-looking upstream error payloads are not emitted through the Pay database error logger.
- Production API smoke explicitly verifies API-key list/create endpoints fail closed on an untrusted `Origin` before authentication is attempted.
- `CI` passed.
- `Production Build` passed.
- `SolMint Pay Production API Smoke` passed.
- `SolMint Pay Devnet E2E` passed.

Conclusion: the **API credential runtime-redaction and origin-gate hardening stage is fully passed** and must not be repeated unless a regression appears.

## Cloudflare Workers Builds — identified external deployment integration

Status: **EXTERNAL / NOT A REPOSITORY FAILURE**

Evidence on relevant commits shows two separate Cloudflare check runs:

- `Cloudflare Pages` deploy — success.
- `Workers Builds: solsite` — failure, pointing to a separate Cloudflare Worker service named `solsite`.

The repository is configured for Cloudflare Pages, not for that separate Worker service. No GitHub Actions workflow in the repository owns the `Workers Builds: solsite` check.

Required remediation is a Cloudflare Dashboard integration action: disconnect the obsolete `Workers Builds` integration for that Worker service. Repository code must not be changed or a fake Worker created merely to make this unrelated check green.

## 2026-09-14 — Better Auth production session-boundary correction

Status: **COMPLETED**

Scope: align the shared application authentication boundary with the actual Better Auth cookie emitted by the deployed production runtime.

Evidence:

- Production sign-in for the controlled E2E account returns HTTP 200 and a Better Auth session cookie.
- The production cookie name observed in the authenticated smoke path is `__Secure-__Host-solmint_auth_session`.
- The shared auth boundary was corrected to recognize the deployed prefixed cookie form at the Better Auth session boundary.
- Authenticated production E2E subsequently passed on `main`.

## 2026-09-15 — Authenticated API credential lifecycle gate closed

Status: **COMPLETED**

Merged PR: `#85`

Final production evidence:

- `SolMint Pay Authenticated API-Key E2E` succeeded on `main`.
- Controlled production E2E covered authentication/session establishment, merchant authorization, create/list, idempotent replay, concurrency, wrong-scope rejection, cross-merchant IDOR rejection, rotation, old-secret rejection, rotation replay, revoke, post-revoke rejection, expiry, and plaintext-secret handling.
- Source-tree invariant passed after the E2E run.
- Issue `#68` is closed as completed.

Conclusion: the **production API credential lifecycle acceptance gate is closed**. This does not mark SolMint Pay production-ready.

## 2026-09-15 — Payment Intent implementation and backend contract hardening

Status: **IMPLEMENTED / VALIDATION IN PROGRESS**

Merged PRs: `#87`, `#88`, `#92`

Current `main` HEAD: `bbc4914094944d8c417abeceb4bb4e6b192c84f1`.

### Payment Intent creation gate

PR `#87` introduced the controlled production Payment Intent creation E2E. The flow uses the real Better Auth session, a temporary `payment.create` API key, the controlled merchant, an existing verified receiving wallet, and real server-side Payment Intent creation. It also verifies idempotent replay and conflict handling and revokes the temporary API credential afterward. No customer on-chain payment is performed by this gate.

PR `#88` fixed the E2E wallet-message signer by replacing the unsupported `Keypair.sign()` call with the supported detached Ed25519 signer. The fix is isolated to the manual E2E workflow and does not alter production financial logic.

A subsequent production run exposed a runtime compatibility problem in the E2E harness involving the Solana SDK and `@noble/hashes`; the harness was simplified to use the existing TweetNaCl signer and no longer imports the Solana SDK for the wallet-message-only setup path.

### Run evidence

Run `35003556859` reached the authenticated production E2E but failed with HTTP `500` versus the expected HTTP `200` during wallet verification. The failure led to the hardened persisted-challenge integrity check now deployed in PR `#92`.

PR `#92` also made the manual Payment Intent workflow wait for the successful Cloudflare Pages deployment of the exact `main` commit before mutating the controlled production fixture.

The earlier manual Payment Intent run is therefore **not evidence that the current deployed Payment Intent contract is broken**; it predates the current hardened deployment.

### Live database/backend evidence

Current live Supabase project: `nvopkbiedorfshwbmyhn`.

The live `public.pay_payment_intents` table now contains the authoritative `fee_recipient`, `merchant_net_atomic`, `merchant_settlement_atomic`, `customer_total_atomic`, and `verification_commitment` fields.

The live `public.pay_create_payment_intent` routine accepts `p_fee_recipient`, enforces the canonical fee/customer-total/merchant-net invariants, and snapshots the supplied server-side fee recipient into the Payment Intent.

The live migration ledger now contains the later Payment Intent hardening migrations through `20260915175809`.

### Controlled merchant wallet evidence

The controlled production merchant currently has exactly one active, verified receiving wallet. This is the merchant's receiving destination and is intentionally distinct from the SolMint Pay gateway-fee recipient.

No private key or signing material for this wallet is stored in this ledger.

## 2026-09-15 — Gateway fee recipient recorded

Status: **CONFIGURED / RECORDED**

The public Solana address configured as `PAY_FEE_RECIPIENT` in `wrangler.toml` is:

`C9Cas87cue2YaHHTugTsQp6XP1Ho5CsbQNHCNi2rqSxz`

This is the configured **SolMint Pay gateway-fee destination**. It must not be confused with merchant principal, merchant receiving wallets, referral liabilities, Solana network-fee accounts, or refund destinations.

The durable reference is `docs/solmint-pay-gateway-fee-recipient.md` together with the runtime configuration in `wrangler.toml` and the authoritative Payment Intent `fee_recipient` field.

Important change-control rule: this address must not be replaced by assumption. Any future change requires an explicit production decision, synchronized runtime/backend configuration, contract-test updates, and a checkpoint entry.

No private key associated with this address belongs in repository code, documentation, client bundles, logs, URLs, or telemetry.

## 2026-09-15 — Payment Intent public read contract expanded

Status: **IMPLEMENTED / VALIDATED BY STATIC CONTRACT TESTS**

The public Payment Intent GET contract now exposes these authoritative financial snapshot fields in addition to the existing amount/fee/status information:

- `feeRecipient`
- `merchantNetAtomic`
- `merchantSettlementAtomic`

The frontend `PayPaymentIntent` domain type and parser consume these values as server-authoritative atomic strings. Contract tests cover the newly exposed values.

The POST creation response remains narrower because the live `pay_create_payment_intent` routine currently returns its existing creation response shape. The complete authoritative snapshot must therefore be read from `GET /api/pay/v1/payment-intents/:id` rather than assumed from the POST response.

## 2026-09-15 — Temporary QA artifacts removed

Status: **COMPLETED**

Removed from `main`:

- obsolete `.github/workflows/_temp-pay-authenticated-e2e.yml` workflow, which was a temporary production-triggered harness;
- obsolete `__temp_test.txt` artifact.

This cleanup prevents temporary validation machinery from remaining in the production repository.

## Current Pay next gate

The next gate is **controlled Payment Intent E2E on the current deployed `main`**, with the workflow already configured to wait for the exact Cloudflare Pages deployment.

Once that manual creation gate is green, proceed immediately to the funded **Devnet Payment Intent lifecycle** and verify the real state progression:

`created → pending → submitted → detected → verifying → confirmed/completed`

Then add adversarial verification evidence for:

- underpayment
- overpayment
- wrong token
- wrong recipient
- wrong reference
- duplicate/replay
- ambiguous discovery
- expired intent
- RPC failure
- incomplete transaction discovery

The frontend must continue to consume backend-authoritative state and must never infer payment success from a submitted signature, reference, webhook, or browser state.

The obsolete Cloudflare `Workers Builds: solsite` check remains an external dashboard issue. The Supabase Preview check remains skipped/failed by project configuration and is not a delivery prerequisite under the committed preview-free constraint.

## Explicitly not complete yet

Do not mark SolMint Pay production-ready. The API credential lifecycle is complete, the gateway fee recipient is configured and documented, the Payment Intent backend contract is hardened, and the controlled merchant has a verified receiving wallet. However, the current deployed Payment Intent creation E2E and the funded end-to-end verification lifecycle still require positive production/Devnet evidence, followed by final security/audit/reconciliation/runtime and branch-protection gates.

## Working rule

Before starting a new Pay task:

1. Read this ledger and the master specification.
2. Check the current `main` HEAD and relevant CI evidence.
3. Revalidate the real backend/database contract for the requested capability.
4. Never repeat the Devnet funding/observation work unless CI demonstrates a regression.
5. Do not add Supabase Preview Branching as a prerequisite for Pay delivery.
6. Record a gate as **COMPLETED** only after the relevant implementation, validation, and release evidence are actually green.
