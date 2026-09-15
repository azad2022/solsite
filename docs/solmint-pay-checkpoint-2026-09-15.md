# SolMint Pay checkpoint — 2026-09-15

## Payment Intent replay contract

Status: **IMPLEMENTED / VALIDATION PENDING ON CURRENT DEPLOYMENT**

The controlled production Payment Intent E2E previously reached the idempotent replay assertion and observed HTTP 201 where the E2E contract requires HTTP 200. PR #95 isolates the fix to `functions/api/pay/v1/payment-intents.ts`: a newly created Payment Intent remains HTTP 201, while a completed idempotent replay returns HTTP 200 with the previously stored authoritative response body.

No financial state, database calculation, authentication boundary, or blockchain verification logic is changed by this fix.

Validation evidence on PR #95:
- CI quality passed.
- Production API smoke passed.
- Cloudflare Pages deployment passed.
- The manual Payment Intent E2E must still be rerun against the merged main deployment before this gate is marked COMPLETE.

## Current release direction

The next payment-engine gate after a green controlled Payment Intent creation/replay E2E is a funded Devnet Payment Intent lifecycle using the existing real Solana verification path. Required evidence remains backend-authoritative detection, verification, confirmation/completion, and rejection outcomes.

Do not label Pay production-ready until funded lifecycle, adversarial verification, security, reconciliation/accounting, runtime, and release gates have positive evidence.
