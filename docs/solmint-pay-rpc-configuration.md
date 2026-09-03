# SolMint Pay — RPC Provider Configuration Contract

**Status:** Configuration contract recorded. No production RPC secret is stored in the repository.

## 1. Purpose

SolMint Pay uses a provider-neutral blockchain boundary. The payment verifier and reconciliation engine must not depend on Helius-specific SDKs, response shapes, or credentials. The production provider is selected through server-side runtime configuration.

The current implementation uses `SolanaPaymentProvider` as the domain boundary and `SolanaRpcProvider` as the JSON-RPC implementation. The provider requires a valid HTTPS `SOLANA_RPC_URL` and performs blockchain reads only from backend code.

## 2. Production provider decision

Production SolMint Pay will use **Helius RPC on Solana Mainnet**.

The Helius API key is a server credential. It must never be:

- committed to Git;
- placed in `.env.example` with a real value;
- prefixed with `VITE_`;
- embedded in React/client bundles;
- sent to browsers;
- stored in the Pay database;
- returned by any API response;
- written to logs.

The repository stores only the variable name and configuration contract. The secret value is injected by the production deployment environment.

## 3. Runtime configuration

The canonical server-side variable is:

```text
SOLANA_RPC_URL
```

Production value shape:

```text
https://mainnet.helius-rpc.com/?api-key=<SECRET>
```

The exact secret value is intentionally absent from source control and documentation.

`SOLANA_RPC_URL` is consumed by `createSolanaRpcProvider()` in `src/pay/services/solanaRpcProvider.ts`. The provider rejects missing or non-HTTPS URLs before making blockchain requests.

## 4. Environment separation

### Production

```text
Network: Solana Mainnet
Provider: Helius RPC
Variable: SOLANA_RPC_URL
Secret source: Cloudflare Pages/Functions production secret
```

Production must use the Mainnet Helius endpoint configured for SolMint Pay. A Devnet endpoint must never be silently used as a production fallback.

### CI / Devnet E2E

Devnet E2E uses the dedicated test environment and must remain isolated from the production Helius credential. Test workflows must not require, print, or expose the production Mainnet RPC secret.

### Local development

Local development may use a developer-supplied HTTPS Solana RPC endpoint through `SOLANA_RPC_URL`. No production API key belongs in a local committed file.

## 5. Current code boundary

```text
Cloudflare runtime environment
        |
        | SOLANA_RPC_URL
        v
createSolanaRpcProvider()
        |
        v
SolanaRpcProvider
        |
        v
SolanaPaymentProvider
        |
        +--> paymentVerifier
        |
        +--> reconciliationEngine
```

The verifier receives a provider instance instead of constructing Helius itself. This keeps Helius replaceable and prevents provider-specific logic from leaking into financial verification.

## 6. Allowed blockchain operations

The current provider performs the following RPC operations as required by the verification architecture:

- `getTransaction` for authoritative transaction retrieval;
- `getSignaturesForAddress` for paginated reference discovery;
- `getAccountInfo` for SPL/Token-2022 token-account metadata validation;
- `getSlot` for provider/network health.

`getSignaturesForAddress` is discovery only. A discovered signature becomes financially meaningful only after full transaction verification against the Payment Intent.

## 7. Reliability and failure policy

The provider currently applies:

- an 8-second RPC timeout;
- explicit HTTP/error/result validation;
- bounded discovery pagination;
- a fail-closed error path for unavailable provider responses;
- a health check that reports provider availability and finalized slot.

Provider outage or incomplete discovery must not create a successful payment state.

A future production hardening stage may add multiple-provider failover, circuit breaking, provider-specific backoff, stale-data detection, and indexer/streaming integration. These additions must preserve the provider-neutral interface.

## 8. Secret-management contract

The deployment environment is the source of the Helius credential. The repository is not a secret store.

Required production sequence:

```text
Create Helius API key
        ↓
Store it as production secret
        ↓
Construct SOLANA_RPC_URL in deployment environment
        ↓
Deploy backend Functions
        ↓
Run provider health verification
        ↓
Run real Mainnet-read verification tests
```

No secret is required to build the public frontend bundle.

## 9. Release gates before enabling Pay

Adding the Helius secret does **not** by itself make Pay production-ready. Before `/pay` or live financial processing is enabled, the following must be independently proven:

1. The production runtime receives `SOLANA_RPC_URL` without exposing it to client code.
2. Helius Mainnet `getTransaction` reads succeed with the required commitment policy.
3. Reference discovery is complete/retryable and never treated as proof by itself.
4. Token-account validation works for every supported production asset policy.
5. RPC failures fail closed.
6. Provider latency, errors, and rate limits are observable.
7. A provider outage/retry scenario cannot double-recognize a payment.
8. CI confirms no secret literal or production credential is committed.
9. `/pay` remains disabled until the remaining database, authorization, webhook, accounting, E2E, observability, and release gates pass.

## 10. Current state

At the time of this document:

- Helius production credentials are **not** stored in GitHub.
- Cloudflare production secrets are **not** configured by this document.
- `SOLANA_RPC_URL` is documented in `.env.example` as an empty server-only variable.
- The repository's blockchain layer is already structured so Helius can be introduced without changing payment-verification business logic.
