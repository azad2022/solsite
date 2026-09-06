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
  key_ops?: string[];
};

type Jwks = { keys?: JwksKey[] };
type OidcConfiguration = {
  issuer?: string;
  jwks_uri?: string;
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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Supabase discovery request failed: HTTP ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function main(): Promise<void> {
  const env = await readEnv();
  const supabaseUrl = normalizeUrl(required("SUPABASE_URL", env.SUPABASE_URL));
  const algorithm = required("SUPABASE_INTERNAL_JWT_ALGORITHM", env.SUPABASE_INTERNAL_JWT_ALGORITHM);
  const keyId = required("SUPABASE_INTERNAL_JWT_KEY_ID", env.SUPABASE_INTERNAL_JWT_KEY_ID);
  const configuredIssuer = normalizeUrl(required("SUPABASE_INTERNAL_JWT_ISSUER", env.SUPABASE_INTERNAL_JWT_ISSUER));
  const audience = required("SUPABASE_INTERNAL_JWT_AUDIENCE", env.SUPABASE_INTERNAL_JWT_AUDIENCE);

  if (!REQUIRED_ALGORITHMS.includes(algorithm as SupportedAlgorithm)) {
    throw new Error(`SUPABASE_INTERNAL_JWT_ALGORITHM must be ES256 or RS256; received ${algorithm}.`);
  }

  const discoveryUrl = `${supabaseUrl}/auth/v1/.well-known/openid-configuration`;
  const discovery = await fetchJson<OidcConfiguration>(discoveryUrl);
  const liveIssuer = normalizeUrl(required("live OIDC issuer", discovery.issuer));
  const jwksUri = required("live OIDC jwks_uri", discovery.jwks_uri);

  if (liveIssuer !== configuredIssuer) {
    throw new Error(`Issuer mismatch: configured=${configuredIssuer}, live=${liveIssuer}.`);
  }

  const expectedJwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  if (normalizeUrl(jwksUri) !== normalizeUrl(expectedJwksUri)) {
    throw new Error(`Unexpected JWKS URI: live=${jwksUri}, expected=${expectedJwksUri}.`);
  }

  const jwks = await fetchJson<Jwks>(jwksUri);
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  const matchingKey = keys.find((key) => key.kid === keyId);

  if (!matchingKey) {
    const available = keys.map((key) => key.kid || "<missing-kid>").join(", ") || "<none>";
    throw new Error(`Configured kid ${keyId} is not present in live JWKS. Available kids: ${available}.`);
  }

  if (matchingKey.alg !== algorithm) {
    throw new Error(`Algorithm mismatch for kid ${keyId}: configured=${algorithm}, live=${matchingKey.alg || "<missing>"}.`);
  }

  if (matchingKey.key_ops && !matchingKey.key_ops.includes("verify")) {
    throw new Error(`Live key ${keyId} is not advertised for signature verification.`);
  }

  // Audience is deliberately not inferred from discovery metadata. The configured value
  // must remain explicit until it is confirmed against the live verifier configuration.
  console.log(JSON.stringify({
    status: "verified",
    supabaseUrl,
    issuer: liveIssuer,
    jwksUri,
    algorithm,
    kid: keyId,
    audience,
    audienceVerification: "explicit-config-only",
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(`Pay JWT signing configuration verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
