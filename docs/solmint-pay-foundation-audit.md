# SolMint Pay Foundation — Adversarial Audit

## Scope

Review of the initial Pay foundation before any public route, live API, or production database deployment.

## Findings fixed

1. Fee semantics were underspecified. The domain now snapshots fee amount, customer total, merchant net, and SolMint fee recipient at payment creation time.
2. One blockchain transaction was modeled as one transfer. A separate transfer-leg table now supports merchant settlement plus gateway fee in the same atomic transaction.
3. Webhook `event_id` was globally unique, which would prevent the same event from reaching more than one endpoint. Uniqueness is now `(webhook_id, event_id)`.
4. Idempotency was documented but had no persistence model. A merchant-scoped idempotency table is now part of the foundation.
5. Referral attribution referenced an untracked affiliate UUID. Affiliates are now first-class entities.
6. Referral commission was accidentally hard-coded to an unapproved 20% default. The default is now 0 until production economics are explicitly configured.
7. Gas balance was represented as one mutable number. A dedicated append-only gas ledger was added; the old balance field is explicitly non-authoritative.
8. Payment status rules were implicit. A pure transition state machine now rejects illegal transitions and permits controlled underpayment retry before expiry.
9. External order IDs were not unique per merchant. A partial unique index now prevents accidental duplicate merchant orders.
10. Payment-link and invoice relationships were absent from Payment Intent. Explicit foreign keys are now present.

## Remaining release gates

- Final receiving-address strategy and custody boundary.
- Merchant authentication/RBAC mapping to the existing SolMint identity system.
- Row Level Security policies verified against that identity model.
- Production fee recipient configuration.
- Minimum-fee and rounding policy for atomic units.
- Exact gas sponsorship funding/debit workflow and key-management boundary.
- Blockchain indexing/verification worker and reorg/confirmation policy.
- Refund semantics and merchant authorization.
- API rate limits, replay protection, and abuse controls.
- Webhook signing implementation and retry worker.
- Full integration/e2e tests against Solana testnet/devnet.
- SEO/public information architecture.
- Deployment, DNS, monitoring, rollback, and incident procedures.

## Current safety state

The `/pay` public route is intentionally not registered and no Pay production endpoints are enabled by this foundation branch.
