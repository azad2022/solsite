# SolMint Pay — Payment Intent Production Configuration

Payment Intent creation requires a server-side gateway fee recipient. The recipient is a Solana public address owned by the SolMint gateway and must remain separate from each merchant's receiving wallet.

## Required production binding

`PAY_FEE_RECIPIENT`

The Cloudflare Pages **Production** environment must provide `PAY_FEE_RECIPIENT` as a valid Solana public address before Payment Intent creation can be enabled for external use.

This value is not supplied by the customer and must never be taken from a merchant request. The backend passes the configured address into the authoritative database routine, which snapshots it on the Payment Intent.

Do not use a merchant receiving wallet as the gateway fee recipient. Merchant principal and gateway revenue must remain separate accounting destinations.

## Verification gate

The controlled Payment Intent E2E intentionally uses the production API and will return HTTP 503 when this server-side configuration is absent. That is a configuration blocker, not a reason to bypass the backend requirement or introduce a frontend default.
