# SolMint Pay — Gateway Fee Recipient

## Production configuration

The SolMint Pay gateway-fee recipient is the public Solana address configured in `wrangler.toml` under `PAY_FEE_RECIPIENT`:

`C9Cas87cue2YaHHTugTsQp6XP1Ho5CsbQNHCNi2rqSxz`

This is a public address. No private key, seed phrase, or signing material belongs in this document or in the repository.

## Financial boundary

This address is the configured destination for **SolMint Pay gateway revenue**. It must remain separate from:

- merchant receiving wallets / merchant principal;
- referral liabilities and affiliate payouts;
- Solana network fee payer accounts and network costs;
- refund or reversal flows.

Payment Intent creation must obtain this value from server-side configuration. Customers and merchants must not be able to supply or override the gateway fee recipient in a payment request.

## Authoritative snapshot

The backend passes the configured fee recipient into the authoritative `pay_create_payment_intent` routine, and the Payment Intent stores it in `fee_recipient`. The public Payment Intent read contract exposes it as `feeRecipient`.

This allows a later transaction-verification/reconciliation flow to correlate the gateway-fee destination with the authoritative Payment Intent snapshot without treating a frontend value as financial truth.

## Change-control rule

Do not replace this address in code, tests, fixtures, or documentation by assumption. A change requires an explicit production configuration decision, synchronized backend/runtime configuration, updated contract tests, and a recorded checkpoint entry. Never use a merchant receiving wallet as a substitute gateway-fee destination.

## Current evidence

- `wrangler.toml` contains `PAY_FEE_RECIPIENT` with the address above.
- Live `public.pay_payment_intents` contains the `fee_recipient` column.
- Live `public.pay_create_payment_intent` accepts `p_fee_recipient` and persists it as part of the authoritative Payment Intent.
- The controlled production merchant currently has exactly one active verified receiving wallet; that wallet is a merchant destination and is not the gateway fee recipient.
