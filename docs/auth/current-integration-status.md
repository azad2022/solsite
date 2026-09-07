# Better Auth Integration — Current Status

Updated: 2026-09-07

## Implemented

- Better Auth is mounted at `/api/auth/*` through Cloudflare Pages Functions.
- PostgreSQL transport is isolated behind the `better_auth` schema.
- Production database access fails closed unless real server-side Supabase credentials are supplied.
- Better Auth owns identity and session state; `public.users` remains authoritative for application profile, role, permissions, and active status.
- `public.auth_identity_links` maps Better Auth identities to existing Solmint application users.
- Controlled legacy-user migration is implemented; it does not perform an automatic production bulk migration.
- Password reset revokes sessions in the Better Auth flow.
- Email/password, immutable username support, Google OAuth configuration, trusted origins, Cloudflare client-IP handling, and database-backed rate limiting are implemented.
- Protected user-management routes (`users/index`, `users/update`, `users/delete`) authenticate through the Better Auth application-session boundary.
- The legacy `/api/users/register` and `/api/users/login` endpoints are retired and return `410`; they no longer mint legacy sessions.
- The Supabase HTTPS adapter implements the full Better Auth database contract, including guarded `incrementOne` and single-row atomic `consumeOne` operations.
- Authentication PostgreSQL integration and security E2E suites exist on the branch; the latest workflow is running against the current HEAD.

## Remaining integration blockers

### 1. Legacy compatibility window

`getAuthenticatedUser()` still contains a deliberate legacy-session fallback for the controlled migration window. No new login or registration endpoint may create legacy sessions, and protected routes should be migrated away from the fallback before final cutover.

### 2. Downstream service handoff

The Pages article/media management paths can forward the Better Auth session token through the established server-to-server handoff. Separately deployed downstream services must resolve that token through the documented Better Auth session resolver before their production auth gates are switched off from the legacy validator.

### 3. Production infrastructure validation

A real non-production Cloudflare Pages deployment must validate the Pages Function → Supabase HTTPS → Better Auth path using the intended server-only credentials. No Hyperdrive binding is required for this auth request path.

### 4. User/session cutover

Before production activation:

1. Capture a fresh production schema snapshot/backup and migration ledger.
2. Rehearse the complete Better Auth schema + identity bridge migration on the disposable test database.
3. Migrate existing users through the controlled migration path; the current production database contains existing users and legacy sessions, so this is not a zero-data cutover.
4. Decide and document legacy-session invalidation; the safe default is invalidation and controlled re-authentication.
5. Activate Better Auth email delivery and Google OAuth with real server-side credentials.
6. Run authentication, authorization, and Pay isolation E2E tests against the deployed non-production environment.
7. Apply the reviewed production migration only after the above gates are green.
8. Retire the legacy session fallback only after all protected routes and downstream services have migrated.

## Non-goals

- Do not move business authorization, merchant isolation, financial authorization, or RLS into Better Auth.
- Do not modify Pay financial security rules as part of the auth migration.
- Do not apply the auth migration directly to production without rehearsal and backup.
