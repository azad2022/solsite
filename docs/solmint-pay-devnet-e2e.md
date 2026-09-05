# SolMint Pay Devnet E2E

The Devnet E2E uses a pre-funded **Devnet-only** signer supplied through the GitHub Actions secret `DEVNET_E2E_SENDER_SECRET_KEY`.

## Secret format

The secret must be a JSON array containing exactly 64 byte values (`0..255`), compatible with `Keypair.fromSecretKey()` from `@solana/web3.js` 1.x.

Do not use a mainnet key, a production signer, or a wallet containing real assets.

## Why the E2E does not depend on `requestAirdrop`

The public Devnet RPC/faucet is rate-limited and may reject automated CI airdrops. A pre-funded disposable Devnet signer makes the test deterministic and does not change production runtime behavior.

## What the E2E proves

1. A real Solana Devnet transaction can be created and finalized.
2. The transaction contains the generated SolMint Pay reference in its message account keys.
3. The Solana RPC provider discovers the transaction using the reference and a bounded time window.
4. The provider observes the expected fee payer and SOL transfer legs.
5. The deterministic payment verifier accepts the complete observation only when all expected invariants match.

Database persistence and PostgreSQL race behavior are deliberately tested separately; this E2E does not write to the production database.
