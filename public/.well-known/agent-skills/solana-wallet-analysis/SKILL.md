---
name: solana-wallet-analysis
description: Analyze a public Solana wallet address with Solmint's read-only wallet analyzer. Use for balances, token accounts, recent activity, transfers, and observable protocol interactions.
---
# Solana Wallet Analysis

Use the read-only endpoint:

`GET https://solmint.ir/api/wallet/analyze?address={ADDRESS}`

The analyzer accepts a public Solana address only. It does not require, accept, store, or forward seed phrases, private keys, passwords, or wallet credentials.

## Interpretation
- Treat token holdings, balances, and activity as observations.
- Respect partial-data and source-availability fields.
- Do not invent PnL, cost basis, risk scores, or ownership conclusions when the response marks them unavailable.
