# SolMint Pay — API Key Lifecycle Contract

This document defines the first released server-mediated API credential lifecycle for SolMint Pay. It deliberately exposes only the capability that the current Merchant API consumes today.

## Security boundary

API keys are bearer credentials. Browser code never writes `pay_api_keys` directly and never receives `key_hash`.

The server generates the plaintext secret, stores only its SHA-256 digest, and returns the plaintext secret only in the initial successful create/rotate response. The plaintext secret is never written to `pay_api_keys`, `pay_idempotency_keys`, `pay_audit_logs`, logs, URLs, analytics, or telemetry.

## Key format

The existing runtime contract uses the prefix `sk_pay_` followed by at least 64 URL-safe characters. The current server generates 48 random bytes and encodes them as unpadded base64url, producing a credential of the form:

`sk_pay_<random-base64url>`

The database stores the first 16 characters as `key_prefix` for safe identification without exposing the secret.

## Current scope

Only `payment.create` is enabled because this is the scope consumed by the current Payment Intent API. Unknown or future scopes are rejected rather than silently accepted.

## Authorization

API-key management is currently restricted to an authenticated, active SolMint user who is the active owner member of the target merchant.

Merchant status must be `active` for creation and rotation. Revoke remains available while the merchant is suspended so a credential can always be disabled. A closed merchant does not expose management operations.

## Endpoints

### List keys

`GET /api/pay/v1/merchants/:merchantId/api-keys`

Returns metadata only: id, merchant, name, safe prefix, scopes, status, expiry, revoke time, last-used time, and creation time.

### Create key

`POST /api/pay/v1/merchants/:merchantId/api-keys`

Request body:

```json
{
  "name": "production",
  "scopes": ["payment.create"],
  "expiresAt": null
}
```

`scopes` may be omitted and defaults to `payment.create`. `expiresAt` may be `null` or a future ISO timestamp.

The request requires `Idempotency-Key`.

The initial successful response contains `apiKey` metadata plus `secret`. A replay of the same idempotency key returns metadata without the secret because the secret is intentionally non-recoverable.

### Revoke key

`DELETE /api/pay/v1/merchants/:merchantId/api-keys/:keyId`

Revoke is idempotent. Repeating the operation returns the already-revoked metadata.

### Rotate key

`POST /api/pay/v1/merchants/:merchantId/api-keys/:keyId`

Request body follows the create body. The request requires `Idempotency-Key`.

Rotation atomically revokes the old key and creates a new key. The old key is no longer accepted before the response is committed. The first successful response includes the new plaintext `secret`; an idempotent replay does not.

## Error contract

The lifecycle uses the existing Pay JSON error envelope and request correlation headers.

Canonical errors include:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `ORIGIN_FORBIDDEN`
- `INVALID_MERCHANT_ID`
- `INVALID_IDENTIFIER`
- `INVALID_API_KEY_NAME`
- `INVALID_API_KEY_SCOPES`
- `INVALID_API_KEY_EXPIRY`
- `API_KEY_NOT_FOUND`
- `API_KEY_REVOKED`
- `MERCHANT_NOT_ACTIVE`
- `IDEMPOTENCY_CONFLICT`
- `REQUEST_IN_PROGRESS`
- `API_KEY_CONFLICT`

## Idempotency and secret disclosure

The idempotency record stores request hash and response metadata, never the plaintext credential. Therefore retrying an already-completed mutation cannot recover the secret. Clients that did not capture the first successful secret must create or rotate a new credential using a new idempotency key.

## Audit

Create, revoke, and rotate write `api_key.*` audit events with merchant, actor, entity, safe key prefix, scopes, expiry, and replacement-key identifiers where applicable. Secret material is excluded from all audit metadata.

## Deliberately not included yet

`payment.read`, webhook-management scopes, key restrictions, IP allowlists, per-key environment separation, and sandbox credentials are not enabled because the current runtime does not consume a released contract for them. They must not be presented by the UI until backend contracts exist.
