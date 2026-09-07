# Solmint Better Auth — Production Cutover Checklist

**Scope:** Global Solmint Identity/Auth boundary only.

**Current branch:** `feat/auth-better-auth-postgres-runtime`

**Current PR:** `#44` (Draft / Open / Unmerged)

## 1. Preconditions

- [ ] Current branch CI is green.
- [ ] Better Auth PostgreSQL integration is green against disposable PostgreSQL.
- [ ] Better Auth security E2E is green.
- [ ] Production build is green.
- [ ] Cloudflare Pages non-production deployment is validated with the real Pages Functions runtime.
- [ ] A non-production Hyperdrive binding points to the intended PostgreSQL environment.
- [ ] `BETTER_AUTH_SECRET` is provisioned as a server-only secret and is at least 32 characters.
- [ ] `BETTER_AUTH_URL=https://solmint.ir` is configured.
- [ ] `BETTER_AUTH_TRUSTED_ORIGINS` contains only exact production origins.
- [ ] `RESEND_API_KEY` and `AUTH_EMAIL_FROM` are provisioned server-side before enabling registration or password reset in production.
- [ ] Google OAuth client ID/secret are provisioned server-side and the production redirect URI is registered at Google.

## 2. Database gate

Better Auth owns the identity/session schema under `better_auth`.

Solmint business authorization remains under the existing application schema. `public.auth_identity_links` is only the identity-to-application bridge.

Do not rename, delete, or repurpose `public.users`, `public.auth_sessions`, or Pay tables during this cutover.

Before migrating users:

1. Capture a fresh production schema snapshot and migration ledger.
2. Verify the current `public.users` population and dependencies.
3. Verify that each legacy user can map to exactly one application profile.
4. Resolve duplicate usernames before migration; do not silently merge unrelated accounts.
5. Decide whether legacy sessions will be invalidated. The default safe path is invalidation and controlled re-authentication.

## 3. Legacy password migration

Legacy passwords must never be copied into client storage or logs.

For each legacy account:

- authenticate against the existing password verifier;
- provision the Better Auth identity with the verified email supplied for migration;
- let Better Auth create the server-side session only through its normal sign-in/verification lifecycle;
- preserve the existing application user ID and business role/permissions through `auth_identity_links`;
- retain the old password hash only until the separately approved legacy-auth retirement window;
- after cutover validation, disable the legacy password/session path rather than leaving two independent authentication authorities active.

A migration must be idempotent. An already-linked application user must not receive a second identity.

## 4. Session cutover

The legacy `public.auth_sessions` session is not treated as a Better Auth session.

Safe default:

- invalidate existing legacy sessions at cutover;
- require affected users to authenticate through Better Auth;
- issue only Better Auth HttpOnly/Secure/SameSite cookies thereafter;
- do not place session tokens in localStorage or expose them to client JavaScript.

Concurrent Better Auth sessions remain independently revocable.

## 5. Authorization boundary

Authentication success must not grant Pay access by itself.

Every Pay backend request must still resolve:

`authenticated user -> application identity -> merchant membership -> role/permission -> resource ownership/isolation -> RLS`

A client-supplied `merchant_id`, `payment_id`, or equivalent identifier is never an authorization decision.

## 6. Google OAuth

- [ ] Exact trusted origin is configured.
- [ ] OAuth callback is server-side.
- [ ] Client secret never appears in frontend source or bundle.
- [ ] Forged OAuth state test passes.
- [ ] Account linking requires the Better Auth account-linking policy and must not perform implicit email-based merging.
- [ ] Google accounts are not used to bypass business authorization.

## 7. Email verification and password reset

- [ ] Verification email delivery works against the real server-side provider.
- [ ] Reset email delivery works against the real server-side provider.
- [ ] Unknown-email reset requests remain enumeration-safe.
- [ ] Reset invalidates existing sessions according to the configured policy.
- [ ] Verification links use the canonical Solmint origin.

## 8. Rate limiting and abuse controls

- [ ] Login limit remains 5 requests / 60 seconds per resolved client bucket for the configured sign-in routes.
- [ ] Registration and reset limits remain stricter than general authenticated traffic.
- [ ] Cloudflare client IP resolution is based on the configured trusted edge header.
- [ ] The system does not fall back to a single shared production bucket because the client IP is unresolved.
- [ ] `429` responses expose bounded retry metadata without revealing account existence.

## 9. Cloudflare activation

Cloudflare Pages must supply the `HYPERDRIVE` binding in the deployed environment. The repository intentionally contains no fabricated Hyperdrive ID.

The production deployment must be validated with the real Pages Functions handler at `/api/auth/*`, not only with Node.js tests.

`wrangler.toml` already enables Node compatibility for the Pages deployment. Cloudflare documents `pg` as the recommended driver for Hyperdrive-backed PostgreSQL and requires Node compatibility for database drivers.

## 10. Go / no-go

**GO** only when every precondition above is green and the live non-production deployment has successfully exercised registration, login, logout, session retrieval, revocation, verification, reset, Google OAuth, and abuse controls through the actual Cloudflare Pages Functions path.

**NO-GO** if email transport, Hyperdrive binding, OAuth credentials, migration mapping, or Pay authorization validation is incomplete.

A green authentication test suite is not permission to modify Pay authorization or RLS.
