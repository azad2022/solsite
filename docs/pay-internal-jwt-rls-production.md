# SolMint Pay — Better Auth to RLS production bridge

## Security flow

```text
Browser
  -> Better Auth session cookie
  -> Pay backend resolves Better Auth session
  -> application identity link resolves public.users.id
  -> backend mints short-lived internal JWT
  -> PostgREST Authorization: Bearer <internal JWT>
  -> PostgreSQL role=authenticated
  -> pay_request_user_id() reads solmint_user_id claim
  -> table-specific merchant/affiliate RLS
```

The browser never receives the internal JWT or its private signing key.

## Required server-only environment

- `SUPABASE_INTERNAL_JWT_PRIVATE_KEY`: PKCS#8 PEM private key corresponding to a signing key trusted by the live Supabase project.
- `SUPABASE_INTERNAL_JWT_ALGORITHM`: exact asymmetric algorithm, `ES256` or `RS256`.
- `SUPABASE_INTERNAL_JWT_KEY_ID`: exact `kid` returned by the live project's JWKS endpoint.
- `SUPABASE_INTERNAL_JWT_ISSUER`: exact issuer accepted by the live project's JWT verifier. The standard Supabase issuer is the project Auth URL ending in `/auth/v1`.
- `SUPABASE_INTERNAL_JWT_AUDIENCE`: exact accepted audience. The standard Supabase authenticated role uses `authenticated`, but the live configuration is authoritative.
- `SUPABASE_INTERNAL_JWT_TTL_SECONDS`: 30..300 seconds; default 60.

The project JWKS endpoint is:

`https://nvopkbiedorfshwbmyhn.supabase.co/auth/v1/.well-known/jwks.json`

Do not guess the `kid` or algorithm. They must match the currently trusted key.

## PostgREST API key

The internal request sends the short-lived JWT in `Authorization`. It also sends a project API key in `apikey`. The implementation prefers `SUPABASE_PUBLISHABLE_KEY` when present and otherwise uses the existing server-only `SUPABASE_SECRET_KEY`.

## Fail-closed rules

The signer rejects missing configuration, unsupported algorithms, non-PKCS#8 private keys, unsafe identity values, and TTL values outside 30..300 seconds.

The identity resolver rejects missing/invalid Better Auth sessions and inactive application users.

RLS helpers return no identity unless the database role is exactly `authenticated` and the JWT contains a valid `solmint_user_id` claim.

Sensitive tables remain server-mediated: API keys, webhook secrets/snapshots, idempotency internals, revenue-recognition data, rate-limit buckets, and audit logs are not granted direct authenticated SELECT access by this migration.

## Production cutover checklist

1. Confirm live Supabase JWKS contains the selected key and record its `kid` and `alg`.
2. Store the corresponding private PKCS#8 key only in the Cloudflare server-side secret store.
3. Set the five required internal JWT variables above plus optional TTL.
4. Deploy the Pay backend and verify `GET /api/pay/v1/merchants` uses the identity-aware PostgREST path.
5. Run authenticated cross-tenant tests with two isolated users and merchants.
6. Confirm unauthenticated and inactive users cannot read merchant-scoped data.
7. Confirm authenticated users cannot INSERT/UPDATE/DELETE merchant-scoped Pay tables directly.
8. Only after these checks should additional merchant-scoped Pay HTTP contracts be enabled.
