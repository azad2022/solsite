import { readFile } from "node:fs/promises";

const REQUIRED_ALGORITHMS = ["ES256", "RS256"] as const;

type SupportedAlgorithm = (typeof REQUIRED_ALGORITHMS)[number];

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_INTERNAL_JWT_ALGORITHM?: string;
  SUPABASE_INTERNAL_JWT_KEY_ID?: string;
  SUPABASE_INTERNAL_JWT_ISSUER?: string;
  SUPABASE_INTERNAL_JWT_AUDIENCE?: string;
};

type JwksKey = {
  kid?: string;
  alg?: string;
  kty?: string;
  crv?: string;
  use?: string;
  key_ops?: string[];
};

type Jwks = { keys?: JwksKey[] };
type OidcConfiguration = {
  issuer?: string;
  jwks_uri?: string;
};

export type LiveJwtTrustEvidence = {
  status: "verified";
  supabaseUrl: string;
  issuer: string;
  jwksUri: string;
  algorithm: SupportedAlgorithm;
  kid: string;
  audience: string;
  audienceVerification: "explicit-config-only";
};

function required(name: keyof Env, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required.`);
  if (/\r|\n/.test(normalized)) throw new Error(`${name} must not contain CR/LF.`);
  return normalized;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function requireHttpsUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
  return normalizeUrl(parsed.toString());
}

async function readEnv(): Promise<Env> {
  const env: Env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_INTERNAL_JWT_ALGORITHM: process.env.SUPABASE_INTERNAL_JWT_ALGORITHM,
    SUPABASE_INTERNAL_JWT_KEY_ID: process.env.SUPABASE_INTERNAL_JWT_KEY_ID,
    SUPABASE_INTERNAL_JWT_ISSUER: process.env.SUPABASE_INTERNAL_JWT_ISSUER,
    SUPABASE_INTERNAL_JWT_AUDIENCE: process.env.SUPABASE_INTERNAL_JWT_AUDIENCE,
  };

  if (env.SUPABASE_URL) return env;

  try {
    const dotenv = await readFile(".env", "utf8");
    for (const line of dotenv.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (key in env && !env[key as keyof Env]) {
        env[key as keyof Env] = rawValue.replace(/^['\"]|['\"]$/g, "");
      }
    }
  } catch {
    // Environment-only execution is valid; missing values fail below.
  }

  return env;
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Supabase discovery request failed: HTTP ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

function parseConfiguredAlgorithm(value: string): SupportedAlgorithm {
  if (!REQUIRED_ALGORITHMS.includes(value as SupportedAlgorithm)) {
    throw new Error(`SUPABASE_INTERNAL_JWT_ALGORITHM must be ES256 or RS256; received ${value}.`);
  }
  return value as SupportedAlgorithm;
}

function assertLiveJwksKey(algorithm: SupportedAlgorithm, key: JwksKey): void {
  if (key.alg !== algorithm) {
    throw new Error(`Algorithm mismatch for configured kid: configured=${algorithm}, live=${key.alg || "<missing>"}.`);
  }

  if (key.use && key.use !== "sig") {
    throw new Error(`Live key is not advertised for signatures: use=${key.use}.`);
  }

  if (key.key_ops && !key.key_ops.includes("verify")) {
    throw new Error("Live key is not advertised for signature verification.");
  }

  if (algorithm === "ES256" && (key.kty !== "EC" || key.crv !== "P-256")) {
    throw new Error(`Live ES256 key must be EC/P-256; received kty=${key.kty || "<missing>"}, crv=${key.crv || "<missing>"}.`);
  }

  if (algorithm === "RS256" && key.kty !== "RSA") {
    throw new Error(`Live RS256 key must be RSA; received kty=${key.kty || "<missing>"}.`);
  }
}

export async function verifyLiveJwtTrust(env: Env, fetchImpl: typeof fetch = fetch): Promise<LiveJwtTrustEvidence> {
  const supabaseUrl = requireHttpsUrl("SUPABASE_URL", required("SUPABASE_URL", env.SUPABASE_URL));
  const algorithm = parseConfiguredAlgorithm(required("SUPABASE_INTERNAL_JWT_ALGORITHM", env.SUPABASE_INTERNAL_JWT_ALGORITHM));
  const keyId = required("SUPABASE_INTERNAL_JWT_KEY_ID", env.SUPABASE_INTERNAL_JWT_KEY_ID);
  const configuredIssuer = requireHttpsUrl("SUPABASE_INTERNAL_JWT_ISSUER", required("SUPABASE_INTERNAL_JWT_ISSUER", env.SUPABASE_INTERNAL_JWT_ISSUER));
  const audience = required("SUPABASE_INTERNAL_JWT_AUDIENCE", env.SUPABASE_INTERNAL_JWT_AUDIENCE);

  const discoveryUrl = `${supabaseUrl}/auth/v1/.well-known/openid-configuration`;
  const discovery = await fetchJson<OidcConfiguration>(discoveryUrl, fetchImpl);
  const liveIssuer = requireHttpsUrl("live OIDC issuer", required("live OIDC issuer", discovery.issuer));
  const jwksUri = requireHttpsUrl("live OIDC jwks_uri", required("live OIDC jwks_uri", discovery.jwks_uri));

  if (liveIssuer !== configuredIssuer) {
    throw new Error(`Issuer mismatch: configured=${configuredIssuer}, live=${liveIssuer}.`);
  }

  const expectedJwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  if (normalizeUrl(jwksUri) !== normalizeUrl(expectedJwksUri)) {
    throw new Error(`Unexpected JWKS URI: live=${jwksUri}, expected=${expectedJwksUri}.`);
  }

  const jwks = await fetchJson<Jwks>(jwksUri, fetchImpl);
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  const matchingKeys = keys.filter((key) => key.kid === keyId);

  if (matchingKeys.length === 0) {
    const available = keys.map((key) => key.kid || "<missing-kid>").join(", ") || "<none>";
    throw new Error(`Configured kid ${keyId} is not present in live JWKS. Available kids: ${available}.`);
  }

  if (matchingKeys.length !== 1) {
    throw new Error(`Configured kid ${keyId} is ambiguous in live JWKS (${matchingKeys.length} matching keys).`);
  }

  assertLiveJwksKey(algorithm, matchingKeys[0]);

  // Audience is deliberately not inferred from discovery metadata. The configured value
  // must remain explicit until it is confirmed against the live verifier configuration.
  return {
    status: "verified",
    supabaseUrl,
    issuer: liveIssuer,
    jwksUri,
    algorithm,
    kid: keyId,
    audience,
    audienceVerification: "explicit-config-only",
  };
}

async function main(): Promise<void> {
  const evidence = await verifyLiveJwtTrust(await readEnv());
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error: unknown) => {
  console.error(`Pay JWT signing configuration verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
