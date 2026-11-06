import assert from "node:assert/strict";
import test from "node:test";

import {
  SOLMINT_PRODUCTION_PROJECT_REF,
  assertProductionApplyRef,
  validateProductionDatabaseUrl,
} from "../scripts/solmint-pay-production-migration-guard.mjs";

const projectRef = SOLMINT_PRODUCTION_PROJECT_REF;
const expectedPassword = "not-a-real-production-password";

function poolerUri({
  protocol = "postgresql:",
  username = `postgres.${projectRef}`,
  password = expectedPassword,
  host = "aws-0-eu-central-1.pooler.supabase.com",
  port = "5432",
  database = "postgres",
  query = "?sslmode=require",
  fragment = "",
} = {}) {
  const encodedPassword = password === "" ? "" : `:${encodeURIComponent(password)}`;
  return `${protocol}//${encodeURIComponent(username)}${encodedPassword}@${host}${port ? `:${port}` : ""}/${database}${query}${fragment}`;
}

test("valid Session Pooler URI is bound to this project and its embedded password is stripped", () => {
  const result = validateProductionDatabaseUrl(
    poolerUri(),
    expectedPassword,
  );

  assert.equal(result.projectRef, projectRef);
  assert.equal(result.hostname, "aws-0-eu-central-1.pooler.supabase.com");
  assert.equal(result.port, "5432");
  assert.equal(result.embeddedPasswordPresent, true);

  const sanitized = new URL(result.sanitizedUrl);
  assert.equal(sanitized.password, "");
  assert.equal(sanitized.username, `postgres.${projectRef}`);
  assert.equal(sanitized.searchParams.get("sslmode"), "require");
});

test("URI without embedded password is accepted and TLS is made explicit", () => {
  const result = validateProductionDatabaseUrl(
    poolerUri({ password: "", query: "" }),
    expectedPassword,
  );

  assert.equal(result.embeddedPasswordPresent, false);
  const sanitized = new URL(result.sanitizedUrl);
  assert.equal(sanitized.password, "");
  assert.equal(sanitized.searchParams.get("sslmode"), "require");
});

test("stronger PostgreSQL TLS verification modes remain intact", () => {
  for (const mode of ["verify-ca", "verify-full"]) {
    const result = validateProductionDatabaseUrl(
      poolerUri({ query: `?sslmode=${mode}` }),
      expectedPassword,
    );
    assert.equal(new URL(result.sanitizedUrl).searchParams.get("sslmode"), mode);
  }
});

const invalidUriCases = [
  ["rejects non-PostgreSQL protocols", poolerUri({ protocol: "https:" })],
  ["rejects non-Supabase-Pooler hosts", poolerUri({ host: "db.nvopkbiedorfshwbmyhn.supabase.co" })],
  ["rejects a different project user", poolerUri({ username: "postgres" })],
  ["rejects a different project reference", poolerUri({ username: "postgres.abcdefghijklmnopqrst" })],
  ["rejects a non-Session-Pooler port", poolerUri({ port: "6543" })],
  ["rejects an unexpected database", poolerUri({ database: "template1" })],
  ["rejects URI fragments", poolerUri({ fragment: "#unexpected" })],
  ["rejects unsupported query parameters", poolerUri({ query: "?sslmode=require&options=unsafe" })],
  ["rejects password query parameters", poolerUri({ query: "?password=leak" })],
  ["rejects duplicate sslmode parameters", poolerUri({ query: "?sslmode=require&sslmode=verify-full" })],
  ["rejects disabled TLS", poolerUri({ query: "?sslmode=disable" })],
  ["rejects permissive TLS preference", poolerUri({ query: "?sslmode=prefer" })],
  ["rejects malformed URI input", "postgresql://%E0%A4%A:bad@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"],
];

for (const [name, uri] of invalidUriCases) {
  test(name, () => {
    assert.throws(
      () => validateProductionDatabaseUrl(uri, expectedPassword),
      Error,
    );
  });
}

test("embedded and standalone passwords must match", () => {
  assert.throws(
    () => validateProductionDatabaseUrl(
      poolerUri({ password: "different-password" }),
      expectedPassword,
    ),
    /does not match/,
  );
});

test("validation errors never echo the supplied credential or connection URI", () => {
  const secret = "highly-sensitive-test-value";
  const maliciousUri = `postgresql://postgres.${projectRef}:${encodeURIComponent(secret)}@wrong.example.com:5432/postgres`;

  assert.throws(
    () => validateProductionDatabaseUrl(maliciousUri, secret),
    (error) => {
      assert.equal(error.message.includes(secret), false);
      assert.equal(error.message.includes(maliciousUri), false);
      return true;
    },
  );
});

test("missing URL or standalone password fails closed", () => {
  assert.throws(() => validateProductionDatabaseUrl("", expectedPassword), /URI is missing/);
  assert.throws(() => validateProductionDatabaseUrl(poolerUri(), ""), /password is missing/);
});

const validSha = "d0cd69e2a9fd461a81dd92a74be0c68d99458297";

test("Production APPLY accepts an explicitly confirmed exact main workflow_dispatch SHA", () => {
  const result = assertProductionApplyRef({
    eventName: "workflow_dispatch",
    ref: "refs/heads/main",
    sha: validSha,
    expectedSha: validSha,
  });

  assert.equal(result.ref, "refs/heads/main");
  assert.equal(result.sha, validSha);
});

const invalidApplyContexts = [
  ["rejects pull_request events", { eventName: "pull_request", ref: "refs/heads/main" }],
  ["rejects push events", { eventName: "push", ref: "refs/heads/main" }],
  ["rejects feature branches", { eventName: "workflow_dispatch", ref: "refs/heads/feat/pay-subscription-billing" }],
  ["rejects tags", { eventName: "workflow_dispatch", ref: "refs/tags/v1.0.0" }],
  ["rejects missing commit SHA", { eventName: "workflow_dispatch", ref: "refs/heads/main", sha: "" }],
  ["rejects malformed commit SHA", { eventName: "workflow_dispatch", ref: "refs/heads/main", sha: "deadbeef" }],
  ["rejects missing expected SHA", { eventName: "workflow_dispatch", ref: "refs/heads/main", sha: validSha, expectedSha: "" }],
  ["rejects malformed expected SHA", { eventName: "workflow_dispatch", ref: "refs/heads/main", sha: validSha, expectedSha: "deadbeef" }],
  ["rejects stale or different expected SHA", { eventName: "workflow_dispatch", ref: "refs/heads/main", sha: validSha, expectedSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
];

for (const [name, context] of invalidApplyContexts) {
  test(name, () => {
    assert.throws(
      () => assertProductionApplyRef({
        eventName: context.eventName,
        ref: context.ref,
        sha: context.sha ?? validSha,
        expectedSha: context.expectedSha ?? validSha,
      }),
      Error,
    );
  });
}
