# SolMint Pay — RPC Failover Policy

SolMint Pay uses a primary server-side Solana RPC endpoint plus up to two optional fallback HTTPS endpoints.

The runtime applies a bounded retry to each provider operation and advances to the next provider only after the current provider operation fails. A normal RPC result is not treated as a failure merely because it is empty or returns no transaction.

All configured endpoints must serve the same Solana network. A production Mainnet request must never fail over to Devnet or another network.

The fallback list is configured with the server-only variable:

```text
SOLANA_RPC_FALLBACK_URLS
```

Values are comma-separated. Secrets remain in deployment configuration and are never stored in Git.

Failover is deliberately below the payment-verification policy. The verifier still decides whether a transaction proves payment. Provider failover can recover from transport/provider outages; it cannot turn a missing or ambiguous transaction into a successful payment.

The current implementation bounds the provider set to three endpoints and uses two attempts per provider with short backoff. If all providers fail, reconciliation returns an unavailable/stale outcome and performs no financial write.

For discovery, a provider that returns a successful result is treated as the authoritative result for that discovery operation. The provider itself remains responsible for bounded pagination and explicitly reports incomplete reference scans. This avoids silently combining partial scans from different providers.

Before Mainnet activation, operational monitoring must record provider failure rate, latency, retry/failover count, HTTP/rate-limit failures, and incomplete discovery events without logging RPC credentials.
