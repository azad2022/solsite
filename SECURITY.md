# Security Policy

## Production security requirements

Before deploying SolMint, configure all server-side secrets through the hosting provider's secret manager or environment configuration.

Required secrets for the corresponding features:

- `ADMIN_PASSCODE`
- `GITHUB_MEDIA_TOKEN` or `GITHUB_TOKEN` for GitHub media storage
- `DEEPSEEK_API_KEY` for DeepSeek server features
- `GEMINI_API_KEY` for Gemini server features
- `AUTOPUBLISH_CRON_SECRET` when the scheduled publishing endpoint is enabled

Do not commit real credentials, tokens, passwords, or `.env` files.

## Authentication

Administrative APIs must fail closed when credentials are missing. A development/default password must never be used in production.

The browser-side admin credential mechanism is retained for compatibility with the existing CMS. Treat it as a temporary compatibility layer and plan migration to an HttpOnly, Secure, SameSite session cookie before exposing the admin panel to untrusted networks.

## Supabase

The frontend may use a publishable/anonymous Supabase key. The Supabase service-role/secret key must never be sent to the browser.

All exposed database tables must use RLS with policies matching the intended access model. Public write policies on administrative tables such as users, CMS settings, and media configuration are not acceptable for production.

The repository contains legacy SQL in `src/utils/supabaseClient.ts`; review and harden those policies in the Supabase project before treating the database as production-secure.

## Reporting a vulnerability

Do not publish exploitable credentials or sensitive implementation details in a public issue. Report security problems privately to the project owner and include:

1. Affected endpoint/file.
2. Reproduction steps.
3. Impact assessment.
4. Suggested mitigation, if known.
