# Better Auth Production Runbook — Solmint Global Identity

## Scope

Better Auth is the authentication/identity layer only. Solmint application authorization, Pay merchant membership, merchant isolation, financial rules, and PostgreSQL RLS remain authoritative outside Better Auth.

## Runtime boundary

Production Pages Functions use Cloudflare Hyperdrive for PostgreSQL connectivity. Direct PostgreSQL URLs are development/test-only. The Better Auth tables live in the dedicated `better_auth` schema and browser Supabase roles receive no grants on that schema.

The repository currently pins Better Auth to `1.7.2`. Better Auth `1.7.3` is a newer release; do not change the package version without regenerating and validating `bun.lock` in CI. The current `1.7.2` schema intentionally includes the `account.issuer` field required by the 1.7.0–1.7.2 schema contract.

Required production configuration:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL=https://solmint.ir`
- `BETTER_AUTH_TRUSTED_ORIGINS=https://solmint.ir`
- Cloudflare `HYPERDRIVE` binding
- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Do not expose any server-only value with a `VITE_` prefix.

## Cloudflare sequence

1. Provision Hyperdrive against the intended Supabase PostgreSQL endpoint.
2. Bind it to the Pages project using the binding name `HYPERDRIVE`.
3. Configure the Better Auth and email variables as encrypted server-side secrets/variables.
4. Configure Google OAuth authorized origin `https://solmint.ir` and the exact Better Auth callback endpoint used by the deployed release.
5. Deploy the branch to a non-production Pages preview environment.
6. Exercise the authentication E2E suite against that preview before enabling production traffic.

The repository deliberately does not contain or invent a Hyperdrive identifier.

## Database sequence

Never apply the Better Auth migration directly to production as the first validation step.

1. Take the normal Supabase backup/snapshot required by the deployment process.
2. Validate the repository's historical Supabase migration baseline on disposable PostgreSQL independently from this auth PR.
3. Apply `supabase/migrations/20260906_auth_identity_bridge.sql` to an isolated non-production database. This migration creates the bridge without an FK so its short historical filename cannot depend on a later Better Auth table.
4. Apply `supabase/migrations/20260906_better_auth_identity_schema.sql`; this creates the `better_auth` schema and core tables, then attaches the `auth_identity_links.better_auth_user_id` FK.
5. Verify schema ownership, indexes, triggers, RLS state, the bridge FK, and absence of browser grants.
6. Run authentication E2E and adversarial tests.
7. Only then schedule the production migration in a controlled deployment window.

The migration intentionally does not alter or rename `public.users`, `public.auth_sessions`, or Pay tables.

## Legacy users

Historical `public.users` records do not currently contain email addresses. A legacy account therefore cannot be silently converted into a Better Auth email identity without an additional trusted email value.

The controlled migration endpoint is `POST /api/auth/migrate-legacy` and accepts a legacy username/password plus the user's chosen email. It verifies the existing password hash using the current compatibility logic and asks Better Auth to create the new identity through a server-only migration header. The Better Auth user-create provisioning hook then resolves the existing application user and creates the identity bridge. Existing Pay identifiers remain unchanged.

The migration endpoint returns a generic `202` response for invalid, unknown, inactive, duplicate, or successful migration requests to avoid user enumeration.

Do not bulk-copy legacy password hashes into Better Auth. Do not migrate old session tokens. The safer cutover is controlled re-authentication; old sessions can be invalidated during the final cutover after the new identity path has passed E2E validation.

## Native application identity provisioning

Every new Better Auth user must have a Solmint application user before the identity is considered usable by domain code. Provisioning is performed server-side from the Better Auth user-create lifecycle.

For native email/OAuth sign-up, a new `public.users` row is created explicitly with role `user`, empty permissions, and an unusable legacy-password marker. The application does not copy the Better Auth password hash into `public.users`; Better Auth remains the password authority.

For a controlled legacy migration, the existing `public.users` row is reused and the bridge records `source = 'legacy-migration'`. Native registration is blocked from reusing an existing legacy username before the Better Auth user is created.

If application-profile provisioning fails after Better Auth user creation, the runtime performs compensating deletion of the just-created Better Auth user so an orphan authentication identity is not silently left behind.

## Email verification and password reset

New email/password identities require email verification. Verification and reset URLs are generated by Better Auth and delivered server-side through the configured transactional mail transport.

If the email transport is not configured, production activation must stop. Do not deploy a system that accepts registrations while silently making verification impossible.

## Google OAuth and account linking

Client credentials stay server-side. The browser only requests the Better Auth social sign-in endpoint and follows the server-issued authorization URL.

Implicit OAuth account linking is deliberately disabled. A same-email Google sign-in against an existing account must be explicitly linked from an authenticated account-management flow rather than silently attached during login. This avoids treating a provider login as proof that the application should merge identities automatically.

Validate the production origin and exact callback URI in the Google console before the cutover. Test duplicate-account and explicit account-linking behavior.

## Session policy

The current Better Auth session target is 8 hours with a 1-hour update window. The primary session cookie is explicitly configured as `__Host-solmint_auth_session` in HTTPS deployments with `HttpOnly`, `Secure`, `SameSite=Strict`, and `Path=/`. This is intentionally different from the legacy `__Host-solmint_session` cookie so the dual-stack migration phase cannot accidentally overwrite the old session.

OAuth access/refresh/ID tokens are encrypted by Better Auth before database persistence. No bearer token is stored in localStorage or sessionStorage.

Cookie-cache session storage remains disabled; session validity therefore stays database-backed and revocation is not delayed by a browser cache.

Test logout, expiry, revocation, concurrent sessions, password-reset session revocation, cookie flags, and session fixation before cutover.

## Application session boundary

The legacy `/api/users/me` endpoint is retained only as a compatibility boundary during migration. It first resolves the legacy session and then resolves a Better Auth session plus the identity bridge, returning the application user/role projection. This keeps existing UI consumers functional while the identity backend changes underneath them.

The endpoint must not become an alternative authentication implementation. New authentication state is created and revoked through Better Auth; legacy session creation remains temporary and is retired only after cutover validation.

## Pay authorization invariant

A Better Auth user ID is not automatically a legacy Solmint application user ID.

For a migrated identity, `public.auth_identity_links` maps the Better Auth user ID to the historical application user ID. Pay authorization must resolve that relationship before evaluating merchant membership. Never use a client-provided `merchant_id` or a Better Auth session user ID as proof of merchant ownership by itself.

Required Pay invariants remain:

- unauthenticated request → `401`
- authenticated user without merchant membership → `403`
- authenticated member of correct merchant → allowed subject to role/permission checks
- modifying `merchant_id` → still forbidden
- modifying `payment_id` to another merchant's payment → unauthorized/forbidden
- direct RLS bypass attempt → denied

## Cutover

Recommended order:

1. repair and validate the repository's historical Supabase migration baseline separately from the auth PR;
2. non-production Better Auth bridge/schema migration;
3. Hyperdrive preview connectivity validation;
4. email transport validation;
5. Google OAuth validation;
6. auth and adversarial tests;
7. controlled legacy migration test with a disposable account;
8. production Better Auth bridge/schema migration;
9. production Hyperdrive binding verification;
10. enable the new registration/login path;
11. controlled legacy re-authentication/migration;
12. monitor authentication error rate, email delivery failures, OAuth failures, and session creation/revocation;
13. only after stable verification, retire legacy login/session endpoints.

## Rollback

Rollback must disable the Better Auth traffic path and restore the previous application authentication route without deleting the Better Auth schema. Do not drop Better Auth tables as a first rollback action; preserve them for forensic review and a subsequent controlled retry.

Pay data and merchant authorization tables must not be rolled back through authentication cutover SQL unless a separate Pay migration explicitly requires it.
