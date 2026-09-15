# SolMint Pay — Devnet Payment Intent Reconciliation E2E

## Purpose

This gate validates the real blockchain verification/reconciliation path used by SolMint Pay against a finalized Solana Devnet transaction.

It is intentionally separate from the controlled production Payment Intent creation E2E. Production payment verification uses the production `SOLANA_RPC_URL` and must not be redirected to Devnet merely to satisfy CI.

## What is real

- A payer, merchant destination, gateway-fee destination, and payment reference are generated as real Solana accounts.
- The existing CI-only Devnet funder provisions the payer through the dedicated Devnet RPC.
- A real Devnet transaction transfers the exact merchant settlement and gateway fee amounts and signs the reference memo account.
- The existing Solana RPC provider discovers the finalized transaction by reference.
- The existing `verifyPayment` and `reconcilePayment` services process the real observation.
- The reconciliation repository records the authoritative transition to `confirmed` and binds the transaction signature.
- A second reconciliation attempt with the same signature is rejected as `duplicate` and does not apply a second authoritative record.

## What is intentionally not claimed

This gate does not insert synthetic payments into Production and does not claim that a Devnet transaction is a Production payment. It validates the shared verification/reconciliation execution path with real on-chain data while keeping Production RPC and financial state isolated.

Production `POST /api/pay/v1/payment-intents/:id/verify` remains the authoritative server boundary for live payments.

## Security constraints

- No private key is committed to the repository.
- The existing Devnet-only funding secret is provided only through GitHub Actions Secrets.
- The Production Mainnet RPC is never replaced by Devnet configuration.
- No browser or frontend state is used as payment proof.
- No successful status is inferred from a submitted signature alone; the verifier requires the authoritative on-chain observation and commitment.
