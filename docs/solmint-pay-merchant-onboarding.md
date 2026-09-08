# SolMint Pay Merchant Onboarding

The Pay dashboard now exposes the existing production merchant onboarding contract through the Pay frontend.

## Flow

1. An authenticated SolMint user creates or loads their own merchant through `GET/POST /api/pay/v1/merchants`.
2. The frontend connects a browser Solana wallet and sends its public address to `POST /api/pay/v1/merchants/:merchantId/wallet-challenges`.
3. The backend issues a short-lived ownership challenge.
4. The wallet signs the challenge message locally; no private key or seed phrase is sent to SolMint.
5. The signature is encoded as Base58 and submitted to the existing challenge verification endpoint.
6. The backend verifies the signature and atomically consumes the one-time challenge.

The UI does not treat connection or signature submission as payment success. This flow only establishes merchant wallet ownership.

## Browser wallet boundary

The implementation uses the standard browser `window.solana` provider shape already used by Solana wallets. The Pay frontend never receives, stores, logs, or transmits private key material.

## Production data policy

No merchant, wallet, Payment Intent, or other financial fixture is inserted into the production database by the frontend onboarding feature. Production rows are created only through the authenticated backend contracts after explicit user action and wallet proof.
