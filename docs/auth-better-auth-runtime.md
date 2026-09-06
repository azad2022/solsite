# SolMint Global Auth — Better Auth Runtime

## Current implementation boundary

The Better Auth runtime is mounted only under Cloudflare Pages Functions at `/api/auth/*`.
The existing `server.ts` Express runtime is not the production Better Auth boundary.

Current structure:

```text
functions/api/auth/
├── _foundation.ts       # fail-closed auth URL/origin/secret validation
├── _database.ts         # PostgreSQL transport boundary
├── _instance.ts         # Better Auth instance factory
├── [[path]].ts          # /api/auth/* catch-all handler
├── _shared.ts           # legacy Solmint auth/session boundary (unchanged)
├── me.ts                # legacy compatibility endpoint
└── logout.ts            # legacy compatibility endpoint
```

## PostgreSQL transport

Production Cloudflare Pages Functions require the `HYPERDRIVE` binding. The repository deliberately does not contain a fabricated Hyperdrive ID.

Local development/test may use `BETTER_AUTH_DATABASE_URL`; production must not use a direct database URL from environment variables.

The runtime uses `pg` and a PostgreSQL `Pool`, with the connection configured to use `search_path=better_auth,public`.

The isolated `better_auth` schema is required because Supabase already owns the managed `auth` schema and the legacy application uses `public.users`, `public.auth_sessions`, and `public.auth_login_attempts`.

## Better Auth schema

Migration file:

`supabase/migrations/20260906_better_auth_identity_schema.sql`

Tables:

- `better_auth.user`
- `better_auth.session`
- `better_auth.account`
- `better_auth.verification`
- `better_auth.rate_limit`

Core Better Auth field names are mapped to the repository's snake_case database convention without modifying existing Solmint tables.

The migration is additive. It does not alter, rename, or delete `public.users` or `public.auth_sessions`.

## Authentication configuration

Implemented in the instance factory:

- Email/password enabled.
- Username plugin enabled as a supplemental identity.
- Username is immutable after it is set.
- Google OAuth is enabled only when both server-only Google credentials are present.
- OAuth provider credentials never enter frontend code.
- Better Auth database rate limiting is enabled.
- IP detection uses the Cloudflare `CF-Connecting-IP` header.
- Password reset revokes existing sessions.
- Trusted origins are explicit and HTTPS-only outside development/test.
- Better Auth base URL is explicit and never inferred from proxy headers.

Email delivery is intentionally not wired in this stage. Email verification and password-reset delivery require a real server-side mail transport before those flows are enabled for users.

## Rollout gate

The `/api/auth/*` handler is additive but cannot become operational until all of the following are true:

1. The migration has been reviewed and applied to a non-production database first.
2. A real Cloudflare Hyperdrive configuration targets the Solmint PostgreSQL project.
3. The Pages project has the `HYPERDRIVE` binding in the deployment environment.
4. `BETTER_AUTH_SECRET` is provisioned as a server-only secret.
5. `BETTER_AUTH_URL=https://solmint.ir` and the exact production trusted-origin allowlist are provisioned.
6. Google credentials are provisioned only when Google OAuth is being activated.
7. Production connectivity is proven with an authenticated `/api/auth/*` request and database-level evidence.
8. Legacy login/session cutover is completed only after user/password/session migration tests pass.

## Migration strategy

The existing identity system remains authoritative for legacy accounts until the migration bridge is complete.

The target mapping is:

```text
public.users
    │
    ├── legacy identity / application profile
    │
    └── Better Auth user + credential account
                 │
                 └── Better Auth session

public.pay_merchant_members.user_id
public.pay_merchants.owner_user_id
                 │
                 └── continue referencing the Solmint application user ID
```

Better Auth is not an authorization source. Pay membership, merchant isolation, roles, permissions, and RLS remain application/database responsibilities.

## Security notes

No session token is placed in localStorage.
No password is logged.
No Google client secret is shipped to the client.
No production database migration is executed from this code path.
No Pay table or RLS policy is changed by this stage.
