# SolMint Web Platform

SolMint is a Persian-language web platform for the SolMint ecosystem, focused on Solana, non-custodial wallet education, token creation, meme-coin tooling, NFT content, downloads, and a technical/educational blog.

The repository contains a React/Vite frontend together with a custom Express server. The server provides server-side rendering-related routing behavior, SEO endpoints, CMS APIs, persistent data integrations, AI proxy functionality, media-library APIs, and production static-file handling.

**Production website:** https://solmint.ir/

**Repository:** https://github.com/azad2022/solsite

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Production Build](#production-build)
- [Production Start](#production-start)
- [Application Features](#application-features)
- [CMS and Content Management](#cms-and-content-management)
- [Article Data Flow](#article-data-flow)
- [SEO Architecture](#seo-architecture)
- [Sitemap and Robots](#sitemap-and-robots)
- [404 Handling](#404-handling)
- [Media Library](#media-library)
- [Media Repository Migration](#media-repository-migration)
- [Authentication and Security](#authentication-and-security)
- [AI and DeepSeek Integration](#ai-and-deepseek-integration)
- [Supabase Integration](#supabase-integration)
- [API Overview](#api-overview)
- [Redirects](#redirects)
- [Caching and Persistence](#caching-and-persistence)
- [TypeScript and Code Quality](#typescript-and-code-quality)
- [Deployment](#deployment)
- [Operational Checklist](#operational-checklist)
- [Troubleshooting](#troubleshooting)
- [Security Rules](#security-rules)
- [Important Implementation Notes](#important-implementation-notes)
- [Maintenance Guide](#maintenance-guide)
- [Project Roadmap and Work Tracking](#project-roadmap-and-work-tracking)
- [Feature and Change Planning Protocol](#feature-and-change-planning-protocol)
- [License](#license)

---

## Project Overview

SolMint is implemented as a full-stack JavaScript/TypeScript application rather than a purely static React site.

At a high level:

```text
Browser
  |
  v
React + Vite frontend
  |
  +---- SEO metadata / route management
  |
  +---- CMS / Admin UI
  |
  +---- Media Library
  |
  +---- AI features
  |
  v
Express server (server.ts)
  |
  +---- CMS APIs
  +---- User APIs
  +---- Article APIs
  +---- Comment APIs
  +---- Media APIs
  +---- AI proxy APIs
  +---- SEO / sitemap handling
  +---- Redirects
  |
  +--------------------+
  |                    |
  v                    v
Supabase             GitHub Media Repository
Database             (image files)
```

The important design principle is that **the browser should not directly hold long-lived server credentials**. Sensitive operations are intended to pass through authenticated server endpoints.

---

## Architecture

### Frontend

The frontend uses:

- React 19
- React DOM
- Vite 6
- Tailwind CSS 4
- `@tailwindcss/vite`
- Lucide React for icons
- Motion for UI animation

The application is configured as an ES module project and uses the `@/*` TypeScript/Vite alias for project-root imports.

### Backend

`server.ts` is the custom Express entry point.

It is responsible for:

- Starting the HTTP server.
- Serving the Vite development application in development.
- Serving the built frontend in production.
- Compression.
- JSON request parsing.
- Admin authentication middleware.
- Cron authentication for automated publishing.
- CMS settings APIs.
- User APIs.
- Article APIs.
- Comment APIs.
- Media-library APIs.
- AI-related server APIs.
- SEO routing behavior.
- Sitemap and robots handling.
- Legacy URL redirects.

### Data layer

The project uses more than one persistence mechanism because different parts of the application have different requirements:

- **Supabase** is used for persistent database-backed content and media metadata.
- **Local/server data storage** is used as a fallback or for server-managed application data where implemented.
- **GitHub** is used as the external media repository for uploaded article images.
- **Browser LocalStorage** is used for selected client-side caches/configuration.

---

## Technology Stack

| Area | Technology |
|---|---|
| Language | TypeScript / JavaScript |
| Frontend | React 19 |
| Build tool | Vite 6 |
| Server | Express 4 |
| Runtime | Node.js |
| CSS | Tailwind CSS 4 |
| Icons | Lucide React |
| Animation | Motion |
| Database | Supabase / PostgreSQL |
| AI | Google GenAI + DeepSeek integrations |
| GitHub media | GitHub repository API |
| Bundler | esbuild |
| Package manager | npm-compatible workflow |

---

## Repository Structure

The exact file set can evolve, but the major application areas are organized approximately as follows:

```text
.
├── public/
│   ├── robots.txt
│   ├── sitemap.xml
│   └── static assets
│
├── scripts/
│   └── generate-sitemap.js
│
├── src/
│   ├── data/
│   │   └── initialBlogData.*
│   │
│   ├── utils/
│   │   ├── mediaService.ts
│   │   ├── seoManager.ts
│   │   ├── markdownRenderer.*
│   │   ├── serverDataStore.*
│   │   └── supabaseClient.*
│   │
│   ├── types.ts
│   └── frontend components/pages
│
├── server.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── README.md
```

`server.ts` is intentionally substantial because it contains the application's server-side API and production routing layer.

---

## Requirements

Recommended baseline:

- Node.js 20+ (Node.js 22 is also suitable).
- npm 10+.
- A configured Supabase project for persistent database functionality.
- A GitHub token with the minimum required repository permissions if GitHub media storage is enabled.
- DeepSeek API credentials if DeepSeek-powered features are enabled.
- Gemini credentials if Gemini-powered features are enabled.

Before deployment, verify that the hosting provider supports a persistent Node.js/Express process. This project is not simply a static Vite build when the server APIs are required.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/azad2022/solsite.git
cd solsite
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Fill in the required values for the environment you are running.

Do **not** commit `.env` or real credentials to Git.

---

## Environment Variables

The repository includes `.env.example` as the reference list. Variable names may be extended as the application evolves.

### AI Studio / Gemini

```text
GEMINI_API_KEY=
```

Used for Google Gemini-related AI functionality.

### Application URL

```text
APP_URL=
```

Used where the application needs to know its externally accessible URL.

### Supabase

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

These values configure the Supabase client used by the application.

### GitHub media storage

```text
GITHUB_TOKEN=
GITHUB_MEDIA_TOKEN=
```

These are server-side credentials used for GitHub-backed media operations. Keep them private.

### Admin authentication

```text
ADMIN_PASSCODE=
```

Used by protected administrative server endpoints.

### DeepSeek

```text
DEEPSEEK_API_KEY=
```

Used for server-side DeepSeek functionality.

### Automated publishing

The production server also supports a dedicated cron secret:

```text
AUTOPUBLISH_CRON_SECRET=
```

This secret is separate from the normal admin passcode and should be used for external scheduled-job authentication.

### Environment variable priority

Where supported, server code prefers explicit runtime environment variables over hard-coded/default application values.

For production, always provide real values through the hosting provider's secret/environment-variable system rather than relying on development defaults.

---

## Development

Start the application in development mode:

```bash
npm run dev
```

The `dev` script runs:

```text
tsx server.ts
```

The Express server integrates with Vite for the development experience.

### HMR

The Vite configuration supports an optional:

```text
DISABLE_HMR=true
```

When enabled, Hot Module Replacement and file watching are disabled. This is useful in environments where automated file edits can cause excessive reloads or CPU usage.

---

## Production Build

Build the application with:

```bash
npm run build
```

The current build pipeline performs three major operations:

1. Generate `sitemap.xml` and `robots.txt`.
2. Build the Vite frontend.
3. Bundle `server.ts` with esbuild into `dist/server.cjs`.

Conceptually:

```text
npm run build
   |
   +--> scripts/generate-sitemap.js
   |
   +--> vite build
   |
   +--> esbuild server.ts -> dist/server.cjs
```

The generated server bundle is a CommonJS Node.js file so it can be launched directly with Node.

---

## Production Start

After a successful build:

```bash
npm start
```

This executes:

```text
node dist/server.cjs
```

The application server listens on the configured runtime port where supported by the hosting platform. The source currently defines a default application port internally; production infrastructure should expose the appropriate service port.

---

## Available npm Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Express + Vite development server |
| `npm run build` | Generate SEO files and create the production build |
| `npm start` | Start the bundled production server |
| `npm run preview` | Run Vite's preview server |
| `npm run clean` | Remove generated build/server artifacts |
| `npm run lint` | Run TypeScript checking without emitting files |
| `npm test` | Run the project's TypeScript test suite |

The `lint` script currently runs TypeScript's `--noEmit` check. It is therefore a type-checking step rather than a full ESLint configuration.

---

## Application Features

The platform includes several major functional areas.

### Public website

- Solana-focused landing pages.
- Wallet information.
- Token creation information.
- Meme-coin information.
- NFT information.
- Security information.
- Download page.
- FAQ.
- Blog and article pages.

### CMS / admin functionality

The application contains administrative functionality for managing:

- Articles.
- Editor/content workflows.
- Comments.
- Media.
- SEO-related data.
- Redirects.
- Downloads.
- DeepSeek settings/logs.
- Chatbot settings.
- Database-related functions.
- Security settings.
- Users and permissions.
- Audit-related functionality.

### Content generation

DeepSeek-powered functionality can be configured for:

- Topic selection.
- Target keywords.
- Writing style.
- Word-count targets.
- FAQ generation.
- Call-to-action generation.
- Scheduled publication.
- Draft/publication modes.
- Cover-image requirements.
- Media style selection.

---

## CMS and Content Management

The CMS stores and exposes structured article data such as:

- Title.
- Slug.
- Category.
- Tags.
- Summary.
- Markdown/content body.
- Cover image.
- Video URL.
- Author information.
- Publication dates.
- Read time.
- View count.
- Comments.
- SEO score.
- Draft status.

Articles can originate from the baseline application data and from the persistent database.

---

## Article Data Flow

The server's article aggregation logic follows this general model:

```text
INITIAL_ARTICLES
      |
      v
  Base article map
      |
      +-----------------------+
                              |
                              v
                    Supabase `articles`
                              |
                 published / draft filtering
                              |
                              v
                     merged article map
                              |
                              v
                       Public article API
                              |
                              +--> sitemap
                              +--> SEO metadata
                              +--> article pages
```

When Supabase is available, database articles are incorporated and can override baseline entries with the same slug.

Draft articles are excluded from the public article set.

Comments are also merged from persistent sources before the public article representation is produced.

---

## SEO Architecture

SEO is a first-class part of the application.

The main SEO implementation lives in:

```text
src/utils/seoManager.ts
```

The SEO system provides route-level metadata including:

- Page title.
- Meta description.
- Canonical URL.
- Open Graph title.
- Open Graph description.
- Open Graph URL.
- Open Graph type.
- Open Graph image.
- Twitter card metadata.
- H1.
- Breadcrumb data.
- 404-specific metadata.

### Static routes

The configured SEO map includes major routes such as:

```text
/
/solana-wallet
/solana-token
/solana-meme-coin
/solana-nft
/security
/download
/blog
/faq
```

### Article routes

Article routes are generated dynamically using article data.

The canonical article URL format is:

```text
https://solmint.ir/article/{slug}
```

### 404 pages

Unknown routes are represented by SEO metadata with:

```text
robots = noindex, follow
```

This prevents nonexistent pages from being intentionally indexed while still allowing crawlers to follow valid links.

---

## Sitemap and Robots

The build process executes:

```text
scripts/generate-sitemap.js
```

The script generates:

```text
public/sitemap.xml
public/robots.txt
```

If a `dist/` directory already exists, the generated files are also copied there.

### Sitemap sources

The sitemap contains:

- Important static routes.
- Published article URLs.
- `lastmod` values where a valid publication/update date is available.

Draft articles are excluded.

### Robots rules

The generated robots file allows public content and disallows administrative/API areas such as:

```text
/admin
/api/
```

The sitemap URL is declared explicitly.

### Important deployment note

The sitemap generator needs access to the article source used during the build. If Supabase is unavailable during the build, the generated sitemap can contain only the static routes and whatever article data is otherwise available to the generator.

After deployment, verify the actual production sitemap instead of assuming that a successful build means the sitemap contains every article.

---

## 404 Handling

The application distinguishes between valid pages and unknown routes.

For unknown routes, the SEO manager marks the route as a 404 and applies `noindex, follow` metadata.

The server also contains routing logic intended to ensure real HTTP 404 behavior rather than returning a successful `200` response for every unknown URL.

When changing routing, verify both:

1. The browser displays the correct 404 page.
2. The HTTP response status is actually `404`.

This distinction matters for SEO and monitoring systems.

---

## Media Library

The media library is designed around a GitHub repository as the long-term storage location for article images.

The intended workflow is:

```text
Admin selects image
        |
        v
Client optimizes image
        |
        v
Convert to WebP when supported
        |
        v
Generate SEO-friendly filename
        |
        v
Authenticated server media API
        |
        v
GitHub media repository
        |
        +--> file stored in GitHub
        |
        v
Supabase media metadata
        |
        v
Local client cache
```

### Image optimization

The client-side media service:

- Reads the uploaded image.
- Limits the dimensions.
- Uses a canvas for optimization.
- Attempts WebP output.
- Falls back to JPEG if WebP is not available.
- Produces base64 data for the server upload API.

Default optimization limits are approximately:

```text
Maximum width: 1920 px
Maximum height: 1080 px
Quality: 0.82
```

These values can be changed in `src/utils/mediaService.ts`.

---

## Media Repository Migration

The application supports migration between configured GitHub media repositories.

Migration is intentionally fail-safe.

The expected flow is:

```text
Current repository
      |
      v
Read asset
      |
      v
Write asset to target repository
      |
      v
Verify target write
      |
      v
Update metadata
      |
      v
Only then remove obsolete source data where applicable
```

Never delete the source repository or its files before the target repository and metadata have been verified.

---

## Authentication and Security

The server uses administrative authentication for sensitive operations.

Protected operations include, depending on the endpoint:

- Media upload.
- Media deletion.
- Media migration.
- Administrative configuration changes.
- Automated publishing.
- Other production mutations.

Sensitive credentials must remain server-side.

The database also uses Supabase Row Level Security (RLS) for access control. Production database policies must remain aligned with the API's intended public/private boundaries.

---

## AI and DeepSeek Integration

DeepSeek functionality is exposed through server-side application logic rather than exposing the provider credential directly to the browser.

AI-related functionality can include:

- Content generation.
- Article generation.
- Topic and keyword processing.
- SEO-related content assistance.
- Automated publishing workflows.
- Chatbot functionality.

Provider credentials, quotas, model names, request limits, and error handling must be treated as production configuration.

---

## Supabase Integration

Supabase/PostgreSQL is a core persistence layer.

The production database should be treated as authoritative for persistent CMS data and metadata unless a feature explicitly documents another source of truth.

Important database areas include:

- `articles`
- `media_assets`
- `media_config`
- Other feature-specific tables/functions used by the current application

### Public access model

The current production security model is intentionally restrictive:

- Public clients may read only data that is intended to be public.
- Public clients must not directly mutate CMS or media-management data.
- Private configuration such as `media_config` must not be exposed through anonymous API access.
- Database functions that perform privileged operations must not be executable by anonymous users unless explicitly required and reviewed.

### Database change policy

Any schema, RLS, policy, function, index, trigger, or permission change must be treated as a production change and documented in the project roadmap/changelog.

After database changes, verify both:

1. Database-side security/performance checks.
2. Application compatibility with the new schema and policies.

---

## API Overview

The server exposes application-specific APIs for areas such as:

```text
Articles
Comments
Users
CMS settings
Media
AI
SEO
Redirects
Automated publishing
```

Sensitive operations must be authenticated.

### Media API examples

```text
POST   /api/media/upload
DELETE /api/media/:id
POST   /api/media/migrate
```

All sensitive media operations should remain protected by admin authentication.

### API error handling

Client code should not blindly assume that every API response is JSON.

A robust API client should validate:

1. HTTP status.
2. Response content type.
3. Response body before calling `JSON.parse()`.

This is especially important for production failures where a proxy, platform, reverse proxy, or upstream service may return HTML or an empty response instead of JSON.

For example, a JSON parser error such as:

```text
JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

usually means the caller attempted to parse an empty or non-JSON response as JSON. The correct debugging approach is to inspect the HTTP status, response body, and content type before parsing.

---

## Redirects

The server contains a legacy redirect map for old URLs.

Current examples include mappings such as:

```text
/wallet        -> /solana-wallet
/token-builder -> /solana-token
/meme-coin     -> /solana-meme-coin
/apk-download  -> /download
/apk           -> /download
```

These redirects use HTTP 301 responses.

When changing URLs, prefer a server-side permanent redirect for an intentionally replaced public URL rather than silently returning a duplicate page.

---

## Caching and Persistence

The project uses multiple levels of state storage.

### Server/database

Persistent content and application configuration are stored in Supabase and/or server-managed persistence depending on the feature.

### Browser LocalStorage

The media service uses LocalStorage for:

- Media configuration cache.
- Media asset cache.
- Selected client-side admin state.

LocalStorage should be treated as a convenience/cache layer, not the authoritative source for critical server data.

### GitHub

GitHub stores the actual media files for the configured media repository.

### Consistency principle

For destructive media operations, the intended order is:

```text
Delete from GitHub
      |
      v
Verify GitHub deletion
      |
      v
Delete metadata from Supabase
      |
      v
Update local cache
```

This prevents the database from claiming that a file is gone when the actual repository deletion failed.

---

## TypeScript and Code Quality

TypeScript configuration is designed for a modern browser/server environment.

Key compiler settings include:

- ES2022 target.
- ESNext modules.
- Bundler module resolution.
- React JSX transform.
- Strict file/module isolation behavior.
- No TypeScript output emission from the type-check command.

Run the project's type check with:

```bash
npm run lint
```

Run the test suite with:

```bash
npm test
```

Before committing a significant change, the recommended minimum validation is:

```bash
npm run lint
npm test
npm run build
```

If any of these commands fails, do not treat the change as production-ready.

---

## Deployment

A production deployment should provide:

1. Node.js runtime.
2. Environment variables/secrets.
3. Network access to Supabase.
4. Network access to GitHub APIs when media features are enabled.
5. Network access to AI providers when AI features are enabled.
6. A persistent process capable of running the Express server.

### Generic deployment sequence

```bash
npm ci
npm run lint
npm test
npm run build
npm start
```

### Production verification

After deployment, verify at minimum:

```text
/
/solana-wallet
/solana-token
/solana-meme-coin
/solana-nft
/security
/download
/blog
/faq
/sitemap.xml
/robots.txt
```

Also test a deliberately invalid route and verify that it produces a genuine HTTP 404.

---

## Operational Checklist

### Before deployment

- [ ] `npm ci` succeeds.
- [ ] `npm run lint` succeeds.
- [ ] `npm test` succeeds.
- [ ] `npm run build` succeeds.
- [ ] All required production environment variables are configured.
- [ ] No secrets are committed.
- [ ] Supabase is reachable.
- [ ] GitHub media repository is reachable.
- [ ] AI provider credentials are valid if AI features are enabled.
- [ ] Production domain points to the correct deployment.

### After deployment

- [ ] Homepage returns HTTP 200.
- [ ] Major landing pages return HTTP 200.
- [ ] Blog page works.
- [ ] Published articles work.
- [ ] Draft articles are not publicly exposed.
- [ ] `/sitemap.xml` is valid XML.
- [ ] Sitemap contains current published articles.
- [ ] `/robots.txt` is accessible.
- [ ] 404 route returns HTTP 404.
- [ ] Legacy URLs return 301 redirects.
- [ ] Admin authentication blocks unauthorized mutations.
- [ ] Media upload works.
- [ ] Media deletion is consistent between GitHub and Supabase.
- [ ] AI endpoints reject unauthorized/invalid requests as expected.
- [ ] Automated publishing uses the dedicated cron secret.
- [ ] Supabase security/performance advisors have been reviewed after significant database changes.

---

## Troubleshooting

### Build fails during sitemap generation

Check:

- Supabase URL.
- Supabase anon key.
- Network access from the build environment.
- Supabase REST API availability.
- Article table permissions.

The sitemap generator logs a warning when the article request cannot be completed, but the build process may continue. Therefore, a successful build does not necessarily prove that the dynamic sitemap contains all articles.

### `JSONDecodeError` / invalid JSON response

If a CI step or Python helper reports:

```text
json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

inspect the raw HTTP response before parsing it.

Typical causes:

- Empty HTTP response.
- HTML error page returned by a proxy.
- Authentication failure.
- Wrong endpoint.
- Server returned a redirect.
- Rate limiting.
- Upstream provider outage.
- Incorrect content-type assumption.

Use a diagnostic request that records:

```text
HTTP status
Content-Type
Response body
Final URL after redirects
```

Do not solve the problem by simply wrapping `json.loads()` in a generic exception handler; the upstream response still needs to be corrected or handled explicitly.

### Supabase unavailable

Check:

- Environment variables.
- Project status.
- Network connectivity.
- Table names.
- Row-level security policies.
- API key validity.

The application has fallback paths in selected areas, but production should not rely on an unavailable database.

### Media upload fails

Check:

- Admin authentication.
- GitHub token permissions.
- Owner/repository name.
- Branch.
- Base path.
- Repository existence.
- GitHub API rate limits.
- Image size after optimization.

### Media deletion fails

Check the GitHub file SHA. The deletion workflow is intentionally conservative because deleting the database record before confirming the GitHub deletion can create data inconsistency.

### Admin authentication fails

Check:

- `ADMIN_PASSCODE`.
- The admin passcode configured in CMS settings where applicable.
- Request headers.
- Reverse-proxy header forwarding.
- Whether the browser is using a stale cached credential.

### AI features fail

Check:

- Provider API key.
- API base URL.
- Model name.
- Provider quota/balance.
- Request payload.
- Server logs.
- Rate limits.

---

## Security Rules

The following rules should be treated as non-negotiable for production work.

### 1. Never commit secrets

Do not commit:

```text
.env
API keys
GitHub tokens
Admin passwords
Cron secrets
Service-role database credentials
```

### 2. Keep GitHub tokens server-side

The frontend should never receive a long-lived GitHub personal access token.

### 3. Protect mutation endpoints

Any endpoint that changes data, deletes data, uploads files, migrates storage, changes credentials, or changes production configuration must be authenticated and validated server-side.

### 4. Validate user input

Do not trust:

- filenames.
- slugs.
- repository names.
- paths.
- article IDs.
- user IDs.
- URLs.
- uploaded MIME types.
- admin headers.

### 5. Avoid unsafe file paths

Never construct arbitrary filesystem paths directly from untrusted user input without strict normalization and validation.

### 6. Do not expose server-only configuration

Client-safe CMS settings must not contain secrets.

### 7. Rotate compromised credentials

If a secret has ever been committed to a public repository, assume it is compromised even if the commit is later deleted. Revoke and replace it at the provider.

---

## Important Implementation Notes

### Hard-coded defaults

Some application files contain development/fallback defaults for values such as URLs, storage configuration, or client behavior. Production deployments should prefer explicit environment configuration and server-side secrets.

Do not copy development defaults into production blindly.

### Admin credential handling

The media client contains a fallback behavior for environments where an admin passcode is missing from browser storage. This should be treated as a compatibility fallback, not as a security mechanism. Production authentication must ultimately be enforced by the server.

### Public vs private Supabase keys

A Supabase publishable/anon key is not equivalent to a service-role key. Never expose a service-role key to the browser.

### GitHub as media storage

GitHub is appropriate here because the expected image volume is relatively modest and the media files benefit from versioned repository storage. It should not be treated as a high-throughput object-storage system for unrestricted user uploads.

### Build-time vs runtime SEO

There are two distinct SEO concerns:

1. Build-time generation of sitemap/robots files.
2. Runtime route metadata and 404 behavior.

Changing one does not automatically change the other.

### Sitemap priorities

The current sitemap intentionally focuses on valid URLs and `lastmod` information. Optional fields such as `priority` and `changefreq` are not required for a functional XML sitemap and should not be added merely for cosmetic reasons.

---

## Maintenance Guide

### Adding a new public route

When adding a new public route:

1. Add the React route/page.
2. Add SEO metadata in `src/utils/seoManager.ts`.
3. Add the route to the sitemap generator when appropriate.
4. Add any required server routing behavior.
5. Decide whether the route should be indexable.
6. Add an Open Graph image if appropriate.
7. Add breadcrumbs where useful.
8. Test canonical URLs.
9. Test the production HTTP status.

### Adding a new article

1. Create/publish the article through the CMS or the appropriate data source.
2. Confirm the slug is unique.
3. Confirm the article is not marked as draft when it should be public.
4. Confirm the cover image exists.
5. Confirm the canonical article URL.
6. Rebuild if the deployment process requires build-time sitemap regeneration.
7. Verify the article appears in the production sitemap.

### Changing the media repository

1. Configure the target repository.
2. Test the connection.
3. Run migration.
4. Verify every migrated asset.
5. Verify public URLs.
6. Verify article references.
7. Keep the source repository until verification is complete.
8. Only then retire the old repository.

### Changing authentication

If authentication logic is changed, test:

- Correct credentials.
- Incorrect credentials.
- Missing credentials.
- Expired/stale browser credentials.
- Direct API access without the UI.
- Reverse-proxy behavior.
- Production environment variables.

### Changing the database schema

When changing Supabase tables:

1. Update the database schema/migration.
2. Update TypeScript interfaces.
3. Update Supabase queries.
4. Update fallback mappings if present.
5. Test existing records.
6. Test new records.
7. Test null/missing values.
8. Test production data compatibility.
9. Review RLS/policies and database advisors.
10. Record the change in the roadmap/changelog.

---

## Project Roadmap and Work Tracking

This section is the persistent project backlog. It is intentionally kept in `README.md` so that the next development session can recover the project's state without relying on chat history.

### Status definitions

- **P0 — Critical:** Production/security/data-loss risk. Must be addressed before unrelated feature work.
- **P1 — High:** Important for production reliability, maintainability, or operational safety.
- **P2 — Medium:** Valuable engineering improvement that should be scheduled.
- **P3 — Low:** Nice-to-have or cleanup work.
- **DONE:** Implemented and verified.
- **IN PROGRESS:** Actively being implemented.
- **PLANNED:** Defined but not yet implemented.
- **BLOCKED:** Requires an external decision, credential, provider capability, or other dependency.

### Current verified status

| Priority | Area | Status | Work item | Definition of done |
|---|---|---|---|---|
| P0 | Database security | DONE | Harden production RLS and public privileges for CMS/media data; restrict privileged DB function execution | Supabase policies/privileges verified and advisors reviewed |
| P1 | Automated validation | PLANNED | Strengthen automated tests around critical APIs, authentication, article visibility, media operations, and failure paths | Critical flows have repeatable automated tests and pass in CI |
| P1 | CI/CD quality gate | PLANNED | Ensure lint, tests, build, and relevant production checks run automatically before release | A failed quality gate prevents an unsafe release |
| P1 | Production smoke tests | PLANNED | Add repeatable HTTP-level checks for public routes, 404s, redirects, sitemap, robots, and protected APIs | Production smoke suite can be run after every deployment |
| P1 | Database/application contract | PLANNED | Continuously verify Supabase schema/RLS/policies/functions remain compatible with application expectations | Schema/API contract checks are documented and automated where practical |
| P2 | Observability | PLANNED | Improve structured logging, error visibility, and operational diagnostics for server/API failures | Production failures can be diagnosed without reproducing locally |
| P2 | Recovery/runbooks | PLANNED | Document backup, rollback, migration, media-recovery, credential-rotation, and incident procedures | Critical recovery procedures are documented and testable |
| P2 | Dependency maintenance | PLANNED | Periodically review Node/npm/framework/dependency versions and security advisories | Dependencies are intentionally maintained and upgrades are validated |
| P3 | Licensing | PLANNED | Decide and document the project's intended source-code license | Repository contains the intended license or an explicit proprietary notice |

> **Important:** `PLANNED` items are not necessarily known bugs. They are remaining engineering work required or recommended to move the project toward a more mature production operating model.

### Completed work record

The following categories have already received production attention and should not be treated as unresolved simply because they remain documented here:

- Media API authentication hardening.
- Removal of client-side long-lived GitHub token handling.
- Atomic/fail-safe media deletion behavior.
- Fail-safe media repository migration behavior.
- Article publication/draft filtering.
- Public write restrictions for CMS/media tables.
- Private handling of `media_config`.
- Restriction of privileged database function execution.
- SEO 404 handling and sitemap improvements documented elsewhere in this README.

Future work should update the status rather than creating duplicate backlog entries.

---

## Feature and Change Planning Protocol

**No significant feature, bug fix, database change, security change, or production configuration change should be implemented without a written plan.**

For every new item, create or update a roadmap entry containing:

1. **Problem / goal** — What is being fixed or built and why?
2. **Scope** — Which frontend, backend, database, infrastructure, SEO, or external integrations are affected?
3. **Dependencies** — What must exist or be decided before implementation?
4. **Data impact** — Does it change schema, stored data, permissions, migrations, or external repositories?
5. **Security impact** — Does it introduce new credentials, endpoints, permissions, file operations, or trust boundaries?
6. **Implementation plan** — Ordered technical steps before coding.
7. **Validation plan** — Unit/integration tests, type checks, builds, database checks, HTTP checks, or manual verification required.
8. **Deployment plan** — How the change reaches production safely.
9. **Rollback plan** — How to reverse the change if production behavior is incorrect.
10. **Definition of done** — Objective conditions that must be true before marking the work complete.
11. **Post-deployment verification** — What must be checked against the real production system.
12. **README update** — Mark the item `DONE` only after implementation and verification; record important follow-up work as a new backlog item.

### Standard implementation lifecycle

```text
Request / Problem
       |
       v
Investigate current GitHub + Supabase state
       |
       v
Write plan and define acceptance criteria
       |
       v
Assess security / data / compatibility impact
       |
       v
Implement the smallest safe change
       |
       v
Run tests + type check + build
       |
       v
Verify GitHub repository state
       |
       v
Verify Supabase schema / RLS / advisors when relevant
       |
       v
Deploy / merge
       |
       v
Run production smoke checks
       |
       v
Update README status and record remaining work
```

### Rules for future development sessions

- Always read the roadmap before starting substantial work.
- Never assume chat history is the project's source of truth; `README.md` is the persistent engineering record.
- Do not mark a task complete merely because code was written. It must be tested and verified.
- For database-related work, compare the repository's expected schema with the actual Supabase production state.
- For security-related work, verify both application behavior and database permissions/RLS where applicable.
- For production fixes, record any remaining risk or follow-up work in the roadmap.
- If a task reveals a new issue, add it to the roadmap instead of silently leaving it undocumented.
- When a task is completed, update its status and definition of done in the same change whenever practical.
- Avoid broad rewrites when a focused, testable change can solve the problem safely.

---

## Recommended Validation Matrix

For significant changes, validate at least the following:

| Area | Test |
|---|---|
| Build | `npm run build` |
| Type checking | `npm run lint` |
| Automated tests | `npm test` |
| Homepage | HTTP 200 |
| Public routes | HTTP 200 |
| Unknown route | HTTP 404 |
| Redirects | HTTP 301 |
| Sitemap | Valid XML |
| Robots | Valid text and sitemap reference |
| Articles | Published article visible |
| Drafts | Draft article not publicly indexed/exposed |
| Admin | Unauthorized mutation rejected |
| Media | Upload, list, delete |
| Media migration | Source/target consistency |
| AI | Valid and invalid API requests |
| Database | Read/write/error behavior |
| Supabase security | RLS, privileges, functions, advisors reviewed when relevant |

---

## Project Philosophy

The project should remain:

- SEO-aware.
- Server-secure.
- Database-backed for persistent content.
- Conservative with destructive operations.
- Explicit about public vs private configuration.
- Easy to deploy and recover.
- Compatible with a modest publishing workload.
- Documented so future development does not depend on undocumented chat history.

When implementing new features, prefer a small, verifiable change over a broad rewrite of working infrastructure.

---

## License

No explicit open-source license is currently declared in this repository.

Unless a license is added, the repository should not be assumed to grant general permission to reuse, redistribute, or commercially exploit the source code.

---

## Maintainer

Repository owner: `azad2022`

Project: **SolMint**

Production site: https://solmint.ir/
