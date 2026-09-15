# SolMint Pay — Controlled Payment Intent E2E

This gate validates the existing production Payment Intent creation contract without performing an on-chain customer payment.

## Cost model

Creating a Payment Intent is a server-side operation. It does not spend SOL or require a customer transaction.

Merchant wallet ownership is proven by signing the existing wallet challenge message. `signMessage` is an off-chain signature operation and does not pay network gas.

The subsequent on-chain payment lifecycle remains a separate gate. It can use the existing dedicated Devnet E2E funding path in CI and does not require the maintainer to fund a real Mainnet payment.

## Controlled flow

1. Sign in through the real Better Auth production session.
2. Create a temporary `payment.create` API credential through the existing merchant API-key contract.
3. Reuse the existing CI-only Solana keypair to prove ownership of the controlled merchant receiving wallet through the existing challenge/verification endpoints.
4. Create a real Payment Intent through `/api/pay/v1/payment-intents` using atomic-unit strings.
5. Read the intent through the public authoritative snapshot endpoint.
6. Replay the same creation request with the same `Idempotency-Key` and require the same Payment Intent identity.
7. Reuse the same key with different request data and require `IDEMPOTENCY_CONFLICT`.
8. Revoke the temporary API credential.

No secret values, private keys, or plaintext credentials are committed to the repository or emitted by the workflow.

## Important boundary

Passing this gate proves Payment Intent creation and snapshot integrity. It does **not** prove that an on-chain payment is successful, verified, finalized, settled, reconciled, or refundable. Those states remain backend/blockchain authoritative release gates.
