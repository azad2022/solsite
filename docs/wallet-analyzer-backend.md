# Solmint Wallet Analyzer Backend

## Endpoint

`GET /api/wallet/analyze?address=<public-solana-address>`

The endpoint is read-only. It never accepts, stores, or forwards Seed Phrases, private keys, passwords, or wallet connection credentials.

## Data sources

1. Solana JSON-RPC is the core source for SOL balance, SPL Token accounts, Token-2022 accounts, and recent transaction signatures.
2. SolanaFM Free is an enrichment source for token/NFT accounts, transfers, and classified transaction history when available.
3. DEX Screener public token-pairs data is used only for an observed SOL/USD price and is not a source of on-chain ownership data.

The API degrades gracefully when enrichment or market data is unavailable.

## Optional environment variables

- `SOLANA_RPC_URL`: optional dedicated RPC URL. If absent, the official public Solana mainnet RPC is used as a low-volume fallback.
- `SOLANAFM_API_KEY`: optional SolanaFM API key. The code keeps the key server-side; it is never exposed to the browser.

No paid provider is required for the base implementation.

## Returned sections

- wallet identity and network
- SOL balance in lamports and SOL
- observed SOL price and estimated SOL value when market data is available
- SPL/Token-2022 token accounts
- non-zero token summary
- recent transaction sample
- transfer sample
- first/last observed activity timestamps
- capability flags describing which sources answered
- explicit caveats for unavailable PnL/risk analysis

## Why PnL is not fabricated

Reliable PnL requires historical pricing, transaction classification, transfers between wallets, DEX swap interpretation, and cost-basis rules. The first backend release therefore returns `null` for PnL, trading statistics, and risk score until the data model is strong enough to support them.

## Production considerations

The official Solana public RPC is rate-limited and explicitly documented as unsuitable for high-traffic production applications. For larger traffic, set `SOLANA_RPC_URL` to a dedicated free-tier or paid RPC without changing the API contract.
