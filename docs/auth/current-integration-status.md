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
- Authentication PostgreSQL integration and security E2E suites have previously completed successfully on this branch; each new HEAD must still pass its own workflow run.

## Remaining integration blockers

### 1. Protected legacy routes

Some existing management endpoints still authenticate using the legacy `__Host-solmint_session` / `public.auth_sessions` path through `getAuthenticatedUser()`.

They must be migrated to the shared Better Auth application-session boundary before legacy authentication can be retired.

### 2. Article publishing handoff

The article publishing proxy still forwards the legacy session token to the Supabase Edge Function using `x-solmint-session-token`.

No synthetic token bridge should be introduced. The publish path needs an explicit server-side authenticated handoff that preserves the existing authorization boundary.

### 3. Production infrastructure validation

A real non-production Cloudflare Pages + Hyperdrive deployment must validate Pages Function → PostgreSQL connectivity using the intended secrets and binding. No fabricated Hyperdrive ID is permitted in source control.

### 4. User/session cutover

Before production activation:

1. Back up the database and verify rollback procedures.
2. Validate the Better Auth schema and identity bridge on a non-production database.
3. Migrate existing users through the controlled migration path.
4. Decide and document legacy-session invalidation; invalidate legacy sessions at cutover if safe session conversion cannot be guaranteed.
5. Activate Better Auth email delivery and Google OAuth with real server-side credentials.
6. Run authentication, authorization, and Pay isolation E2E tests.
7. Retire legacy authentication only after all protected routes have migrated.

## Non-goals

- Do not move business authorization, merchant isolation, financial authorization, or RLS into Better Auth.
- Do not modify Pay financial security rules as part of the auth migration.
- Do not apply the auth migration directly to production without rehearsal and backup.
