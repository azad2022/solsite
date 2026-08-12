// Compatibility entrypoint for the production-build workflow.
// The canonical frontend authentication hardening implementation lives in
// harden-admin-frontend-v2.mjs; keep this wrapper stable so CI and local builds
// execute the same production-safe transformation.
await import('./harden-admin-frontend-v2.mjs');
