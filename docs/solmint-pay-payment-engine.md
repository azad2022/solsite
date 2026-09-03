# SolMint Pay — Payment Engine v2

## Objective

This document defines the second engineering stage of SolMint Pay: deterministic
settlement planning, merchant receiving-wallet ownership, blockchain observation,
verification, gas sponsorship and revenue recognition.

## Settlement model

SolMint Pay is non-custodial for merchant settlement funds. The merchant's
registered receiving wallet is the destination for the merchant settlement leg.
The merchant does not need to be online when a customer pays.

Every payment has two business amounts:

- `amount`: the merchant's advertised principal.
- `gatewayFee`: the SolMint Pay fee, currently 1% (100 bps).

Two fee-payer modes are supported:

### Merchant pays

The customer pays exactly `amount`. The signed transaction transfers:

```text
merchant = amount - gatewayFee
gateway  = gatewayFee
```

The merchant bears the gateway fee while the customer sees the advertised total.

### Customer pays

The customer pays `amount + gatewayFee`. The signed transaction transfers:

```text
merchant = amount
gateway  = gatewayFee
```

The merchant receives the full advertised principal.

The gateway fee and merchant settlement are separate transfer legs in the same
transaction whenever the transaction builder can include both legs. This keeps
the accounting atomic and makes backend reconciliation deterministic.

## Receiving-wallet policy

A merchant registers a Solana wallet address and proves control by signing an
expiring, merchant-scoped challenge. SolMint Pay does not receive or store the
merchant's private key.

The receiving wallet is not a token account. For Solana Pay/SPL requests the
wallet address is the native owner address; the sender derives the appropriate
Associated Token Account. This matches Solana's receiving-address convention.

## Payment correlation

Every payment intent receives a unique reference. Hosted checkout and Solana Pay
requests should include that reference so the verifier can correlate the inbound
transfer to exactly one payment. A direct-address integration without a reference
must not silently fall back to amount-only matching.

## Verification policy

A candidate on-chain transaction becomes financially eligible only if:

1. The transaction signature is present and not already recognized.
2. The transaction executed successfully.
3. The configured commitment requirement is satisfied. Production default is
   `finalized`; `confirmed` can be used only where an explicit product policy
   accepts the additional reorg risk/latency trade-off.
4. The payment reference matches.
5. The merchant settlement transfer matches destination, asset, mint and exact
   atomic amount.
6. The gateway-fee transfer matches destination, asset, mint and exact atomic
   amount.
7. The authoritative observation is stored once; repeated provider observations
   never create a second revenue record.

The production blockchain provider is Helius RPC on Solana Mainnet. Provider
credentials are server-only deployment secrets and are not committed to source
control. The provider remains behind the repository's `SolanaPaymentProvider`
interface so the verification and accounting layers remain provider-neutral.

## Gas sponsorship

Network fee sponsorship is a separate cost center.

A sponsored transaction has:

```text
Customer signs → token/value transfer
Sponsor signs  → Solana network fee
```

The sponsor must have SOL but does not need to own the merchant's tokens.

There are two funding policies:

- `merchant_funded`: merchant prepays SOL credits to a sponsor account dedicated
  to that merchant. The private key belongs to the sponsor infrastructure, not the
  merchant wallet.
- `solmint_funded`: SolMint pays from its sponsorship treasury, subject to hard
  per-payment and daily limits.

Private keys are outside the application and database boundary. The future
provider may be a Kora-backed signer or another controlled signing service.

## Accounting

The system keeps separate records for:

1. Merchant payment principal.
2. SolMint gateway revenue.
3. Referral commission liability.
4. Gas sponsorship credit/spend.
5. Refunds.

Revenue is recognized only after verification. Referral commission is calculated
from the exact recognized gateway fee. Corrections use compensating entries;
financial/event ledgers are append-only.

## Operational sequence

```text
Create Payment Intent
      ↓
Create Checkout / Solana Pay request
      ↓
Customer signs
      ↓
Transaction submitted
      ↓
Indexer/RPC observes candidate
      ↓
Verifier validates invariants
      ↓
Record authoritative observation
      ↓
Recognize gateway revenue
      ↓
Create referral liability (if eligible)
      ↓
Emit signed webhook
      ↓
Merchant fulfills order
```

## Explicit non-goals of this stage

- No public payment endpoints are enabled.
- No production RPC secret is committed to the repository. Production injection is a deployment concern documented separately in `docs/solmint-pay-rpc-configuration.md`.
- No merchant private keys are stored.
- No real gas sponsorship signer is deployed.
- No Supabase production migration is applied automatically.
