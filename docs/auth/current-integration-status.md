# Better Auth Integration — Current Status

Updated: 2026-09-07

## Implemented

- Better Auth is mounted at `/api/auth/*` through Cloudflare Pages Functions.
- PostgreSQL transport is isolated behind the `better_auth` schema.
- Production database access fails closed unless a real Hyperdrive binding is supplied.
- Better Auth owns identity and session state; `public.users` remains authoritative for application profile, role, permissions, and active status.
- `public.auth_identity_links` maps Better Auth identities to existing Solmint application users.
- Controlled legacy-user migration is implemented; it does not perform an automatic production bulk migration.
- Password reset revokes sessions in the Better Auth flow.
- Email/password, immutable username support, Google OAuth configuration, trusted origins, Cloudflare client-IP handling, and database-backed rate limiting are implemented.
- Protected user-management routes (`users/index`, `users/update`, `users/delete`) now authenticate through the Better Auth application-session boundary.
- The legacy `/api/users/register` and `/api/users/login` endpoints are retired and return `410`; they no longer mint legacy sessions.
- Authentication PostgreSQL integration and security E2E suites exist on the branch; each new HEAD must still pass its own workflow run.

## Remaining integration blockers

### 1. Legacy compatibility window

`getAuthenticatedUser()` still contains a deliberate legacy-session fallback for the controlled migration window. No new login or registration endpoint may create legacy sessions, and protected routes should be migrated away from the fallback before the final cutover.

### 2. Article publishing handoff

The Pages article-management routes authenticate with Better Auth and forward a Better Auth session token over the server-to-server hop using:

- `x-solmint-auth-source: better-auth`
- `x-solmint-better-auth-session: <Better Auth session token>`

No synthetic legacy-token bridge should be introduced. The separately deployed `article-publish-api` must be upgraded to resolve that Better Auth token with `public.solmint_resolve_better_auth_session(text)` before production activation.

### 3. Media handoff

The Pages media gateway also emits the Better Auth server-to-server handoff. The separately deployed `github-media` Edge Function must be upgraded from its legacy session validator before the media admin path is enabled in production.

### 4. Production infrastructure validation

A real non-production Cloudflare Pages + Hyperdrive deployment must validate Pages Function → PostgreSQL connectivity using the intended secrets and binding. No fabricated Hyperdrive ID is permitted in source control.

### 5. User/session cutover

Before production activation:

1. Back up the database and verify rollback procedures.
2. Validate the Better Auth schema and identity bridge on a non-production database.
3. Migrate existing users through the controlled migration path.
4. Decide and document legacy-session invalidation; invalidate legacy sessions at cutover if safe session conversion cannot be guaranteed.
5. Activate Better Auth email delivery and Google OAuth with real server-side credentials.
6. Run authentication, authorization, and Pay isolation E2E tests.
7. Retire the legacy session fallback only after all protected routes and downstream Edge Functions have migrated.

## Non-goals

- Do not move business authorization, merchant isolation, financial authorization, or RLS into Better Auth.
- Do not modify Pay financial security rules as part of the auth migration.
- Do not apply the auth migration directly to production without rehearsal and backup.
