# SolMint Pay — Internal JWT Identity Bridge

## Purpose

This bridge preserves the existing server-side `__Host-solmint_session` as the application authentication source of truth while giving the trusted backend-to-PostgREST hop a short-lived Supabase-trusted identity.

The browser never receives this JWT and never receives the signing private key.

## Flow

```text
Browser
  -> __Host-solmint_session
  -> Pay backend validates session and active user
  -> backend resolves the canonical public.users.id
  -> mint short-lived internal JWT
  -> PostgREST request with Authorization: Bearer <JWT>
  -> table-specific RLS
```

## Credential contract

The implementation requires all of the following server-only variables:

- `SUPABASE_INTERNAL_JWT_PRIVATE_KEY`: PKCS#8 PEM private key. Never commit or expose it to browser code.
- `SUPABASE_INTERNAL_JWT_ALGORITHM`: explicitly `ES256` or `RS256`.
- `SUPABASE_INTERNAL_JWT_KEY_ID`: the key identifier trusted by the live Supabase signing-key configuration.
- `SUPABASE_INTERNAL_JWT_ISSUER`: the exact issuer configured/accepted by the live Supabase JWT verifier.
- `SUPABASE_INTERNAL_JWT_AUDIENCE`: the exact audience configured/accepted by the live Supabase JWT verifier.
- `SUPABASE_INTERNAL_JWT_TTL_SECONDS`: optional; defaults to 60 seconds and is restricted to 30–300 seconds.

No legacy `SUPABASE_JWT_SECRET` is introduced by this bridge.

## Claims

The JWT intentionally carries a minimal set of claims:

- `iss`
- `aud`
- `iat`
- `exp`
- `role=authenticated`
- `solmint_user_id`: canonical application `users.id` as text

The claim name is an application-level contract used by the forthcoming `pay_request_user_id()` database helper. Do not substitute `auth.uid()` for this identity resolver because Pay user identifiers are stored as text.

## Fail-closed behavior

Signing is not wired into a Pay HTTP endpoint yet. Configuration is rejected when any required value is missing, the algorithm is outside the supported asymmetric set, the private key is not PKCS#8 PEM, the user id is empty/oversized/non-printable, or the TTL is outside the allowed range.

This is deliberate: the bridge must not silently fall back to `service_role`, a legacy JWT secret, a guessed issuer/audience, or an unsigned token.

## Activation gate

Before production activation, the exact live Supabase signing-key configuration must be recorded separately from source control:

1. key algorithm
2. key identifier
3. accepted issuer
4. accepted audience
5. backend secret-manager location for the private key

Only after those values are confirmed should the database identity helper, table-specific RLS policies, explicit grants, adversarial DB tests, and merchant-scoped API paths be introduced.

## Security invariants

- The browser cannot mint or observe this JWT.
- The private key is server-only.
- The JWT is short-lived.
- The application session remains the authentication source of truth.
- RLS remains the database authorization boundary.
- No payment success, verification, settlement, or accounting decision is encoded in this credential.
