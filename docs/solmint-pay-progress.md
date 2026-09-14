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
- SolMint Pay Mainnet Read-only passed.
- SolMint Pay Production API Smoke passed.

Conclusion: the long-running **Devnet E2E funding/transaction-observation blocker is closed and must not be re-investigated unless a new regression appears**.

## Current next stage

Move forward from infrastructure/E2E stabilization into the next unreleased Pay product gate: **authenticated merchant lifecycle and production-safe merchant credentials**.

The repository currently exposes the real server-mediated contracts for:

- merchant read/create
- wallet challenge/verification
- API-key list/create/revoke/rotate
- Payment Intent read

The next implementation/audit cycle must verify these contracts end-to-end against the real backend, authentication boundary, authorization/merchant isolation, idempotency, and deployment evidence before expanding the UI surface.

## Explicitly not complete yet

Do not mark Pay production-ready. Remaining release gates include the authenticated production merchant path with a controlled account, wallet ownership lifecycle evidence, API credential authorization E2E, controlled non-production Payment Intent lifecycle, adversarial verification cases, final release audit, and branch-protection enforcement.

## Working rule

Before starting a new Pay task:

1. Read this ledger and the master specification.
2. Check the current `main` HEAD and relevant CI evidence.
3. Revalidate the real backend/database contract for the requested capability.
4. Never repeat the Devnet funding/observation work unless CI demonstrates a regression.
