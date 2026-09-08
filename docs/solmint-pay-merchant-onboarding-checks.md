# Merchant onboarding release checks

Before using the Pay gateway with real customers, verify:

- Better Auth session exists and `/api/users/me` resolves the application user.
- Merchant creation succeeds through the production Pay API.
- Receiving wallet address is classified server-side as a valid Solana wallet.
- Wallet ownership challenge is issued by the server and has a short expiration window.
- Wallet signs the exact challenge message locally.
- Backend verifies the signature and consumes the challenge once.
- Receiving wallet is present and verified in `pay_merchant_wallets`.
- Merchant reaches the backend-defined active state before creating payment intents.
- Payment Intent creation, verification/reconciliation, webhook delivery, idempotency and adversarial payment cases have green release evidence.
