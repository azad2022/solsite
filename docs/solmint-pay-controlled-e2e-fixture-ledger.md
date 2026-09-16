# SolMint Pay — Controlled E2E Fixture Ledger

This document records the non-secret identifiers and GitHub Actions secret names used by the controlled SolMint Pay production E2E account/merchant fixture. It exists so future work does not rediscover or accidentally replace the established fixture.

## Controlled production E2E account

The authenticated Pay E2E workflow consumes these GitHub Actions **Secrets**:

- `PAY_E2E_EMAIL` — controlled Better Auth production E2E account email. Secret value must never be documented here.
- `PAY_E2E_PASSWORD` — controlled Better Auth production E2E account password. Secret value must never be documented here.
- `PAY_E2E_MERCHANT_ID` — controlled production merchant identifier used by authenticated Pay E2E.
- `PAY_E2E_OTHER_MERCHANT_ID` — separate merchant identifier used to prove cross-merchant authorization/IDOR isolation.

Evidence:

- `.github/workflows/solmint-pay-authenticated-api-key-e2e.yml` requires all four values and passes them to `e2e/pay-authenticated-api-key-lifecycle.e2e.ts`.
- `.github/workflows/solmint-pay-payment-intent-e2e.yml` reuses `PAY_E2E_EMAIL`, `PAY_E2E_PASSWORD`, and `PAY_E2E_MERCHANT_ID` for the controlled production Payment Intent E2E.
- The authenticated API-key lifecycle E2E on `main` was previously accepted as a completed gate, covering sign-in/session establishment, merchant authorization, cross-merchant IDOR rejection, API-key lifecycle, and cleanup.

## Devnet funding fixture

The real funded Devnet E2E uses these GitHub Actions **Secrets**:

- `SOLANA_DEVNET_RPC_URL` — dedicated Devnet RPC endpoint; secret value must remain secret.
- `DEVNET_E2E_FUNDER_SECRET_KEY_B64` — dedicated Devnet funding wallet secret key material; never document the value or private key material here.

The repository workflow explicitly requires both secrets before running the real funded Devnet verification/reconciliation tests.

## What is and is not verified

GitHub's repository connection does not expose secret values or the repository Secrets/Variables inventory. Therefore this ledger records **names and repository usage**, not secret values.

The established fixture is considered previously validated because the corresponding authenticated production E2E and funded Devnet E2E gates have completed successfully. A future workflow must reuse these names unless a deliberate fixture migration is performed and recorded here.

Do not copy secret values into issues, PR comments, commits, documentation, URLs, logs, telemetry, or chat.

## Wallet verification note

The controlled production merchant currently has an existing verified receiving wallet. Wallet-ownership lifecycle E2E must therefore not assume that `PAY_E2E_MERCHANT_ID` can always issue a fresh wallet challenge. Any new wallet-verification fixture must use a deliberately controlled merchant/wallet state and separate signing secret, with explicit production-safety review before automation.

## Change-control rule

If the controlled E2E account or merchant fixture is rotated, add the new Secret names/identifiers and the validation evidence here before changing workflow references. Never record passwords, private keys, API secrets, or other secret material.
