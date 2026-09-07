# Better Auth server-to-server handoff

## Purpose

A protected Pages Function may call a Supabase Edge Function after authenticating the browser request through Better Auth. The Edge Function must not receive or validate the legacy `public.auth_sessions` bearer.

## Current contract

The Pages Function resolves the Better Auth session first and sends the Better Auth session token only over the server-to-server HTTPS hop:

- `x-solmint-auth-source: better-auth`
- `x-solmint-better-auth-session: <Better Auth session token>`
- `x-media-gateway-version: 5` for the media gateway

The Better Auth token is never stored in localStorage/sessionStorage and must never be logged.

## Edge Function validation

The receiving Edge Function must resolve the token using the server-only SQL function:

`public.solmint_resolve_better_auth_session(text)`

That resolver joins:

`better_auth.session`
→ `better_auth.user`
→ `public.auth_identity_links`
→ `public.users`

and rejects expired or inactive application identities. The resolver is `SECURITY DEFINER`, its execute privilege is revoked from `public`, `anon`, and `authenticated`, and only `service_role` receives execute permission.

The receiving Edge Function must not fall back to `public.auth_sessions`, `x-solmint-session`, `x-solmint-session-token`, `x-admin-passcode`, or a browser-supplied admin secret.

## Publishing

`article-publish-api` is currently a separately deployed Supabase Edge Function and was observed in production as version 17 with legacy session/passcode authorization. The repository branch now emits the Better Auth handoff headers, but the deployed Edge Function must be upgraded before this branch is deployed to production.

That upgrade must preserve the current publishing validation and database behavior and change only the authentication boundary plus any required internal identity lookup. It must be validated in a disposable/non-production environment first; production deployment is a cutover step, not part of this repository change.

## Media

The same boundary applies to `github-media`. The Pages media gateway has been migrated to emit the Better Auth handoff, but the separately deployed Edge Function must be upgraded from its current legacy `x-solmint-session` validator before the media admin path is enabled in production.

## Security properties

A successful browser request is authorized twice at distinct boundaries:

1. Pages Functions authenticate the Better Auth session and authorize the application role/permission from `public.users`.
2. The receiving Edge Function independently resolves the same Better Auth session and application identity from PostgreSQL.

This prevents a caller from bypassing the Pages Function by calling the Edge Function directly with the old Solmint session protocol.
