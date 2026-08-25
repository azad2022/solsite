---
name: solana-token-risk
description: Analyze a Solana token mint using Solmint's public on-chain and market-risk APIs. Use when an agent needs mint authorities, freeze authority, Token-2022 extensions, liquidity, volume, or explainable risk flags.
---
# Solana Token Risk

Use Solmint's read-only token analysis APIs.

## Workflow
1. Call `https://solmint.ir/api/tools/solana-token?mint={MINT}` to inspect the mint account, token program, authorities, supply, decimals, and Token-2022 extensions.
2. Call `https://solmint.ir/api/tools/market-context?mint={MINT}` for market pairs, liquidity, volume, buys/sells, and price observations.
3. Call `https://solmint.ir/api/tools/token-risk?mint={MINT}` for the combined explainable rule-based profile.
4. Treat all results as observed technical data, not a security audit or investment recommendation.

## Safety
Never request or transmit seed phrases, private keys, passwords, or wallet signing credentials.
