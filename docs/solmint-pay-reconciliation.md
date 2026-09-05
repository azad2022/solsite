# SolMint Pay — Blockchain Observer & Reconciliation

## Purpose

The reconciliation worker is the only backend component allowed to turn a Solana RPC observation into a financially eligible Pay state. Browser state, checkout callbacks, and provider labels are never authoritative.

## Flow

```text
Open payment intent
      ↓
Worker scans reference account
      ↓
getSignaturesForAddress(finalized)
      ↓
getTransaction(finalized, jsonParsed)
      ↓
Normalize transaction + transfer legs
      ↓
Verify immutable payment invariants
      ↓
Single atomic DB RPC
      ├─ persist on-chain observation
      ├─ persist transfer legs
      ├─ recognize gateway revenue
      ├─ append payment event
      └─ transition payment → confirmed
```

## Reference handling

`getSignaturesForAddress(reference)` is discovery only. The worker additionally verifies that the reference actually occurs in the transaction's `message.accountKeys` before the transaction can satisfy the payment's correlation requirement.

A direct-address payment without a reference is not silently accepted by this engine.

## Reconciliation invariants

The immutable payment snapshot controls:

- network and asset
- merchant destination
- gateway fee destination
- exact merchant settlement amount
- exact gateway fee amount
- token mint
- token program
- token decimals
- required commitment
- payment reference

For SPL transfers, source/destination token accounts are resolved and their mint/program/owner metadata is checked. The two value legs must have the same source authority.

The verifier rejects ambiguity when more than one transfer exactly matches either required semantic leg.

## Idempotency and concurrency

A blockchain signature is globally unique in the observed-transaction table. A payment may have only one authoritative verified transaction. The database RPC locks the payment row before financial state changes, preventing two workers from recognizing the same payment concurrently.

Repeated observations update the observation record but do not create a second revenue record.

## Failure behavior

RPC failure, database failure, malformed transactions, wrong reference, wrong token, wrong recipient, failed transaction, duplicate signature, or ambiguous value legs are fail-closed conditions. None can produce a `confirmed` payment.

Expired open payments are transitioned to `expired` by the same database transition function used by the worker.

## Operational boundary

The repository contains an authenticated internal HTTP endpoint at `/api/internal/pay/reconcile`. It is not a public merchant API. The endpoint requires a server-only `PAY_RECONCILE_SECRET`, performs a bounded batch scan, checks Solana RPC health first, and never exposes the secret to clients.

The current endpoint is intentionally transport-neutral. A scheduler (Cloudflare Worker Cron, external scheduler, or another trusted job runner) may invoke it later; no scheduler credential is hard-coded into the application.

## Production release gate

This stage is not production-ready until all of the following are demonstrated on an isolated Solana test environment:

1. A real Solana transaction containing the payment reference is discovered.
2. The transaction is finalized and normalized correctly.
3. SOL and stablecoin settlement legs are verified against an immutable payment snapshot.
4. Re-running the worker does not double-recognize revenue.
5. Concurrent worker executions cannot create two authoritative observations.
6. Expiry is race-safe.
7. Malformed, ambiguous, wrong-token and wrong-recipient transactions fail closed.
8. The RPC provider has explicit rate-limit/backoff and monitoring policy.
9. Production migration is reviewed and applied separately; this branch never auto-applies it.
10. A real scheduler and alerting path are provisioned outside the Pay application code.

Solana's current documentation recommends verifying received payments and directs high-volume applications toward indexing/production-grade monitoring. `getSignaturesForAddress` returns transactions whose `accountKeys` contain the queried address, which is why it is used here for candidate discovery followed by full transaction verification.
