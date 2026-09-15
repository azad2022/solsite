# SolMint Pay — Devnet Payment Intent Reconciliation E2E

## Purpose

This gate validates the real SolMint Pay blockchain verification/reconciliation path against a finalized Solana Devnet transaction.

It is intentionally separate from the controlled Production Payment Intent creation E2E. Production verification uses the Production Mainnet RPC and must not be redirected to Devnet for CI convenience.

## Real execution covered

- CI provisions a generated payer with the existing dedicated Devnet funding wallet.
- A real finalized SOL transaction contains the exact merchant settlement leg, gateway-fee leg, and signed Pay reference.
- The existing Solana RPC provider observes and discovers the transaction at `finalized` commitment.
- The existing `reconcilePayment` engine validates the observation against an immutable Payment Intent snapshot.
- The reconciliation repository records the authoritative `confirmed` application.
- A second verification attempt with the same signature is classified as `duplicate` and cannot apply a second authoritative record.

## Boundary

This is real blockchain evidence for the shared verification/reconciliation engine. It is not a Production payment and it does not insert synthetic financial state into Production.

The Production endpoint `POST /api/pay/v1/payment-intents/:id/verify` remains the authoritative server boundary for live payments.

## Security constraints

- No private key is committed to the repository.
- The Devnet funding key is supplied only as a GitHub Actions Secret.
- Production Mainnet RPC configuration is never replaced by Devnet configuration.
- No browser state, submitted signature, reference, or webhook is treated as payment proof by itself.
