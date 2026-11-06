import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SOLMINT_PRODUCTION_PROJECT_REF = "nvopkbiedorfshwbmyhn";

const SAFE_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);
const POOLER_SUFFIX = ".pooler.supabase.com";

function fail(message) {
  throw new Error(message);
}

function decodeUriPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    fail("The Production database connection URI contains invalid encoding.");
  }
}

/**
 * Validates and sanitizes the configured Supabase Session Pooler URI.
 * The returned URI contains no password; callers must supply PGPASSWORD
 * from the standalone GitHub Actions secret.
 */
export function validateProductionDatabaseUrl(
  databaseUrl,
  standalonePassword,
  projectRef = SOLMINT_PRODUCTION_PROJECT_REF,
) {
  if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
    fail("The Production Session Pooler connection URI is missing.");
  }
  if (typeof standalonePassword !== "string" || standalonePassword.length === 0) {
    fail("The standalone Production database password is missing.");
  }
  if (typeof projectRef !== "string" || !/^[a-z0-9]{20}$/.test(projectRef)) {
    fail("The configured Supabase project reference is invalid.");
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    fail("The Production database connection URI is malformed.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    fail("The Production database URI must use PostgreSQL.");
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(POOLER_SUFFIX) || hostname.length <= POOLER_SUFFIX.length) {
    fail("The Production database URI must target the Supabase Session Pooler.");
  }

  const username = decodeUriPart(url.username);
  if (username !== `postgres.${projectRef}`) {
    fail("The Production database URI targets an unexpected Supabase project user.");
  }

  if ((url.port || "5432") !== "5432") {
    fail("The Production Session Pooler must use port 5432.");
  }
  if (url.pathname !== "/postgres") {
    fail("The Production database URI must target the postgres database.");
  }
  if (url.hash !== "") {
    fail("The Production database URI must not contain a fragment.");
  }

  const queryKeys = [...url.searchParams.keys()];
  if (queryKeys.some((key) => key.toLowerCase() !== "sslmode")) {
    fail("The Production database URI contains an unsupported query parameter.");
  }
  const sslModes = url.searchParams.getAll("sslmode");
  if (sslModes.length > 1) {
    fail("The Production database URI contains duplicate SSL settings.");
  }
  const sslMode = (sslModes[0] ?? "require").toLowerCase();
  if (!SAFE_SSL_MODES.has(sslMode)) {
    fail("The Production database connection must require TLS.");
  }
  if (sslModes.length === 0) {
    url.searchParams.set("sslmode", "require");
  } else {
    url.searchParams.set("sslmode", sslMode);
  }

  const embeddedPassword = url.password.length > 0;
  if (embeddedPassword) {
    const decodedPassword = decodeUriPart(url.password);
    if (decodedPassword !== standalonePassword) {
      fail("The embedded URI password does not match the standalone database password secret.");
    }
  }

  // The connection password has exactly one source: PGPASSWORD.
  url.password = "";

  return Object.freeze({
    sanitizedUrl: url.toString(),
    hostname,
    port: "5432",
    projectRef,
    embeddedPasswordPresent: embeddedPassword,
  });
}

/**
 * Production APPLY is permitted only for an explicitly confirmed exact
 * commit on the repository's main branch through workflow_dispatch.
 */
export function assertProductionApplyRef({
  eventName,
  ref,
  sha,
  expectedSha,
}) {
  if (eventName !== "workflow_dispatch") {
    fail("Production APPLY is allowed only through workflow_dispatch.");
  }
  if (ref !== "refs/heads/main") {
    fail("Production APPLY is allowed only from refs/heads/main.");
  }
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/i.test(sha)) {
    fail("GitHub did not provide a valid full commit SHA for this run.");
  }
  if (typeof expectedSha !== "string" || !/^[0-9a-f]{40}$/i.test(expectedSha)) {
    fail("A full 40-character expected_main_sha is required for Production APPLY.");
  }
  if (sha.toLowerCase() !== expectedSha.toLowerCase()) {
    fail("The confirmed commit SHA does not match the workflow's exact main commit.");
  }

  return Object.freeze({ ref, sha: sha.toLowerCase() });
}

function writeGithubEnvironment(name, value) {
  const envFile = process.env.GITHUB_ENV;
  if (typeof envFile !== "string" || envFile.length === 0) {
    fail("GITHUB_ENV is unavailable; refusing to pass the sanitized connection to later steps.");
  }
  if (/[\r\n]/.test(value)) {
    fail("The sanitized Production connection URI contains an invalid line break.");
  }
  appendFileSync(envFile, `${name}=${value}\n`, { encoding: "utf8", flag: "a" });
}

function runCli() {
  const mode = process.argv[2];

  if (mode === "assert-apply-ref") {
    const result = assertProductionApplyRef({
      eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      expectedSha: process.env.EXPECTED_MAIN_SHA,
    });
    console.log(`Production APPLY ref guard passed for main commit ${result.sha}.`);
    return;
  }

  if (mode === "validate-target") {
    const target = validateProductionDatabaseUrl(
      process.env.SUPABASE_DB_URL,
      process.env.SUPABASE_DB_PASSWORD,
    );
    writeGithubEnvironment("SUPABASE_DB_URL_SANITIZED", target.sanitizedUrl);
    console.log(
      "Production database target validated: " +
      `project=${target.projectRef}, host=${target.hostname}, port=${target.port}, ` +
      `database=postgres, embedded_password_removed=${target.embeddedPasswordPresent ? "yes" : "not-needed"}, ` +
      "TLS=required.",
    );
    return;
  }

  fail("Usage: node scripts/solmint-pay-production-migration-guard.mjs <assert-apply-ref|validate-target>");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath !== "" && fileURLToPath(import.meta.url) === invokedPath) {
  try {
    runCli();
  } catch (error) {
    // Error messages are deliberately constant and never include the input URI or credentials.
    console.error(error instanceof Error ? error.message : "Production migration guard failed.");
    process.exitCode = 1;
  }
}
