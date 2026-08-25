# Solmint auth.md

## Audience

This document describes authentication and registration for automated agents and API clients interacting with Solmint (`https://solmint.ir`).

## Current authentication model

Solmint currently uses application-managed user sessions rather than OAuth 2.0 or another dedicated agent-authorization protocol. No OAuth Authorization Server or OAuth Protected Resource Metadata is advertised by Solmint at this time.

Public discovery documents therefore do not require an OAuth authorization-server flow.

## Registration

The standard user registration endpoint is:

`POST https://solmint.ir/api/users/register`

It accepts a JSON object containing `username`, `fullName`, and `password`. Registration is rate-limited and creates a standard Solmint user account. The endpoint is not a dedicated agent-account provisioning API.

Supported method:

- JSON request over HTTPS using `POST`.

Successful registration creates an authenticated application session using a secure session cookie. The returned session is intended for the Solmint application and should be stored and sent according to normal HTTP cookie rules.

## Login

The standard user login endpoint is:

`POST https://solmint.ir/api/users/login`

It accepts `username` and `password` as JSON fields. Successful authentication establishes the same application session mechanism used by the web application.

## Credential use

Solmint does not currently issue OAuth access tokens, API keys, ID-JAG credentials, verified-email identity assertions, or anonymous agent credentials through a public agent-registration flow.

Agents must not assume that a Solmint application session cookie is an OAuth bearer token or an API key. Agents that need authenticated access should use the documented standard user registration/login flow only where the target Solmint API explicitly permits it.

## Safety and discovery

This document is a passive discovery document. Automated scanners should not call `POST /api/users/register` or `POST /api/users/login` merely to discover authentication support because these operations can create accounts, consume rate limits, or establish sessions.

For future OAuth-based agent authentication, Solmint can publish the corresponding OAuth Protected Resource Metadata and Authorization Server metadata here without changing the meaning of this document.
