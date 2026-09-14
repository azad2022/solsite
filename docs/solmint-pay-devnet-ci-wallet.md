# SolMint Pay — Devnet E2E CI Funding Wallet

## Purpose

The funded real-transaction Devnet E2E uses a dedicated CI-only Solana Devnet funding wallet. The wallet is consumed only through the GitHub Actions secret `DEVNET_E2E_FUNDER_SECRET_KEY_B64`.

## Public identifier

- Network: Solana Devnet
- Public address: `EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV`
- GitHub Actions secret: `DEVNET_E2E_FUNDER_SECRET_KEY_B64`

## Security rules

- Never commit or document the private key/secret value.
- Never place the private key in issues, pull requests, logs, URLs, telemetry, or client code.
- The repository must use the GitHub Actions secret only; the public address is recorded here solely as a non-secret operational identifier.
- This wallet is Devnet-only and must never be reused for production or mainnet funds.

## E2E contract

The Devnet E2E workflow passes the secret directly to the test harness. The harness decodes and validates the keypair, derives the funder public key, funds an ephemeral payer, and then performs the real payment submission, discovery, and verification path through the dedicated Devnet RPC.

## Current validation checkpoint

The secret was replaced in GitHub Actions with the key material for the wallet identified above. The subsequent E2E rerun passed the secret-presence and keypair-validation stage and advanced to the real payment execution stage.
