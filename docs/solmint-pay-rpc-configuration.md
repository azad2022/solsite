# SolMint Pay — RPC Provider Configuration Contract

**Status:** Configuration contract and architectural boundary.

## 1. Purpose

SolMint Pay uses a provider-neutral blockchain boundary. Payment verification and reconciliation do not depend on Helius-specific SDKs, response shapes, or credentials.

The current implementation is:

```text
server runtime
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
    +--> reconciliationEngine
```

The concrete RPC implementation uses Solana JSON-RPC and performs blockchain reads only from backend/server code.

## 2. Production provider decision

Production SolMint Pay uses **Helius RPC on Solana Mainnet**.

The Helius credential is a server-side deployment secret. It must never be:

- committed to Git;
- embedded in client code;
- prefixed with `VITE_`;
- stored in the Pay database;
- returned by APIs;
- written to logs.

The repository intentionally stores only the variable name and configuration contract.

**Important continuity rule:** Helius provisioning and the Cloudflare production secret are already-established infrastructure decisions. They are not a default engineering task. Reconfigure them only when current runtime evidence proves a problem.

## 3. Runtime configuration

Canonical primary variable:

```text
SOLANA_RPC_URL
```

The concrete provider rejects a missing or non-HTTPS URL before making a request.

Optional resilience configuration:

```text
SOLANA_RPC_FALLBACK_URLS
```

This is a comma-separated list of additional HTTPS RPC URLs and is optional. The resilience wrapper accepts at most three unique provider URLs in total.

Production does **not** require fallback URLs merely because the abstraction supports them. Do not invent or provision secondary credentials without an explicit reliability requirement and evidence.

## 4. Environment separation

### Production

```text
Network: Solana Mainnet
Provider: Helius RPC
Variable: SOLANA_RPC_URL
Runtime: Cloudflare Pages Functions / server-side Pay runtime
```

A Devnet endpoint must never silently become the production fallback.

### CI / Devnet E2E

Devnet E2E uses a dedicated public Devnet RPC and dedicated CI funding material. It must not require or expose the production Mainnet Helius credential.

### Local development

Developers may supply their own HTTPS RPC endpoint through `SOLANA_RPC_URL`. Production credentials do not belong in committed local configuration.

## 5. Provider responsibilities

`SolanaRpcProvider` currently supports:

- `getTransaction` for authoritative transaction retrieval;
- `getSignaturesForAddress` for paginated reference discovery;
- `getAccountInfo` for token-account metadata enrichment/validation;
- `getSlot` for provider health.

`getSignaturesForAddress` is discovery only. A discovered signature becomes financially meaningful only after complete verification against the immutable Payment Intent.

The provider uses an 8-second request timeout and bounded discovery pagination. Exhausting the discovery bound is treated as `REFERENCE_DISCOVERY_INCOMPLETE`, not as `no_match`.

## 6. Resilience layer

The repository contains `ResilientSolanaPaymentProvider` above the concrete provider.

Current behavior:

- up to 3 configured provider URLs;
- up to 2 attempts per provider;
- bounded backoff of 250 ms then 750 ms;
- sequential provider fallback after provider errors;
- health probing across configured providers;
- fail-closed outcome when all providers fail.

The resilience layer does not change financial verification rules. It only provides a more reliable provider boundary.

A future change to fallback semantics must preserve the distinction between:

- provider error/unavailability;
- a successful empty result;
- an incomplete discovery result;
- a transaction that was retrieved but failed financial verification.

Those cases must never be collapsed into one generic result.

## 7. Secret-management contract

The deployment environment is the source of the Helius credential. The repository is not a secret store.

No production Helius secret belongs in:

- GitHub source;
- `.env.example` with a real value;
- frontend bundles;
- database records;
- application logs;
- API responses.

## 8. Release implications

Adding or changing an RPC credential is not a substitute for Pay release evidence.

Before enabling live Pay processing, independently prove:

1. the current production runtime receives the intended Mainnet RPC endpoint server-side;
2. required transaction reads work at the configured commitment;
3. reference discovery is complete/retryable and never treated as payment proof;
4. token-account validation works for every supported asset policy;
5. RPC failures cannot create a successful financial state;
6. retry/fallback behavior cannot cause duplicate recognition;
7. observability distinguishes provider failure, stale/incomplete discovery, and verification failure;
8. no production secret is committed or exposed.

## 9. Current source-of-truth references

For continuation of the Pay workstream, use:

```text
docs/solmint-pay-v1-product-contract.md  <- product/economic/security authority
docs/solmint-pay-continuation.md        <- operational facts and safe continuation procedure
src/pay/services/blockchainProvider.ts   <- provider-neutral interface
src/pay/services/solanaRpcProvider.ts   <- concrete Solana JSON-RPC implementation
src/pay/services/resilientSolanaPaymentProvider.ts <- retry/fallback wrapper
```

This file documents the RPC boundary only. It does not override the V1 product contract or current runtime evidence.
