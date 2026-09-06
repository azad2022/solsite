# Better Auth Foundation

This branch establishes the first additive layer of the global Solmint Identity/Auth migration.

## Current boundary

- Better Auth is pinned to `1.7.2`.
- The production authentication runtime remains under `functions/api/*` on Cloudflare Pages Functions.
- `server.ts` is not used as the production Better Auth mount point.
- `BETTER_AUTH_SECRET` is server-only and must be at least 32 characters.
- `BETTER_AUTH_URL` is explicit and HTTPS-only outside development/test.
- Trusted origins are an explicit allowlist; production configuration rejects localhost/HTTP origins.
- The module intentionally does not initialize a database adapter or `/api/auth/*` handler yet.

## Deliberate non-changes

This foundation does not:

- replace `/api/users/login`;
- create Better Auth users/accounts/sessions;
- modify `public.users` or `public.auth_sessions`;
- add a database migration;
- change Pay authorization, merchant membership, or RLS;
- migrate passwords or existing sessions;
- enable Google OAuth;
- modify the legacy admin trust path.

## Next blocking validation

The next implementation stage requires a verified Cloudflare Pages Functions -> PostgreSQL connectivity path. The current repository does not establish a Hyperdrive binding or another direct PostgreSQL transport for the Functions runtime, so an adapter must not be invented in this branch.

Once connectivity is verified, the next branch can add the Better Auth instance and `/api/auth/*` handler, followed by the additive `auth` schema and application identity bridge. Database schema changes must be represented by repository migrations and applied only through the normal reviewed deployment process.
