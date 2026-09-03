# SolMint Pay — Security Audit Baseline

This document records the pre-production security controls for the Pay subsystem. It does not certify the system as production secure; live integration, RLS, provider testing, and deployment review remain mandatory.

## Threat model

SolMint Pay must assume an attacker can:

- forge all browser/client payloads;
- replay API requests and webhooks;
- enumerate payment, invoice, merchant, and transaction identifiers;
- submit malformed or ambiguous Solana transactions;
- create conflicting transfer legs inside one transaction;
- attempt to register wallets they do not control;
- attempt to abuse Gas Sponsorship for denial-of-service or cost inflation;
- exploit merchant-controlled webhook URLs for SSRF;
- race payment detection, retries, refunds, and idempotent writes;
- submit stale, expired, or cross-merchant references;
- compromise an API key and act within its granted scope.

## Security invariants

1. Browser state is never authoritative for money or payment completion.
2. Merchant identity is derived from the authenticated server principal/API key, never from a client-supplied merchant ID.
3. Every object lookup is authorized for the authenticated merchant and action scope.
4. Financial amounts use atomic integer units; no floating-point arithmetic is permitted in accounting code.
5. Payment policy is snapshotted when the payment intent is created and is not recomputed from mutable merchant settings.
6. A transaction signature can become authoritative only once.
7. A valid payment requires exact network, mint, destination, amount, correlation reference, and configured commitment invariants.
8. Merchant and gateway fee legs in a customer-paid transaction must originate from the same payer authority.
9. Receiving-wallet ownership requires an expiring, merchant-scoped challenge and cryptographic signature verification.
10. Private keys never live in the frontend or normal Supabase application tables.
11. Gas sponsorship fails closed when limits, credit, or sponsor configuration are insufficient.
12. Financial/event ledgers are append-only; corrections use compensating entries.
13. Webhook deliveries are signed, retried, individually deduplicated per endpoint, and must not permit arbitrary internal-network fetches.
14. API mutations require persistent idempotency with request-hash equality.
15. Sensitive identifiers and webhook payloads must not be written to logs without explicit redaction policy.

## Release blockers

The Pay system must not be exposed publicly until the following are implemented and tested:

- authentication/RBAC integration with the existing SolMint identity system;
- server-side object/function/property authorization;
- production RLS policy where direct database access exists;
- API-key creation, hashing, rotation, revocation, expiry, and scope enforcement;
- wallet signature verification using a Solana-compatible signature verification implementation;
- challenge replay protection and one-time consumption;
- webhook URL SSRF protection including DNS-rebinding-safe egress controls;
- request body size and pagination limits;
- rate limits for authentication, payment creation, verification polling, refunds, and webhook management;
- provider timeout, retry, circuit-breaker, and failover policy;
- finalized/confirmed policy and explicit reorg handling;
- atomic database transaction for authoritative observation + accounting + event creation;
- refund authorization and double-refund prevention;
- gas sponsorship reservation/debit atomicity;
- secret management/HSM/KMS/signer review;
- testnet/devnet integration tests and adversarial fixtures;
- dependency, secret, and static-analysis checks in CI.

## OWASP alignment

The review explicitly covers BOLA/BFLA, broken authentication, property-level authorization, unrestricted resource consumption, sensitive business-flow abuse, SSRF, security misconfiguration, inventory gaps, and unsafe consumption of external APIs in line with the OWASP API Security Top 10. citeturn908485search0turn908485search6turn908485search12
