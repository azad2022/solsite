/**
 * Versioned envelope encryption for merchant webhook secrets.
 *
 * The master key is supplied by the deployment secret store (for example a
 * Cloudflare Worker Secret). Ciphertext may be persisted in the database; the
 * master key never is. AES-GCM authentication protects both confidentiality
 * and integrity. Rotation is represented by a key version supplied by the
 * caller, not by silently changing the envelope format.
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SECRET_BYTES = 32;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url value.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importAesKey(masterKeyBase64Url: string): Promise<CryptoKey> {
  const raw = base64UrlToBytes(masterKeyBase64Url);
  if (raw.byteLength !== KEY_BYTES) throw new Error('Webhook master key must be exactly 32 bytes.');
  return crypto.subtle.importKey('raw', raw.buffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function normalizeSecret(secret: string): Uint8Array {
  const bytes = new TextEncoder().encode(secret);
  if (bytes.byteLength !== SECRET_BYTES) throw new Error('Webhook signing secret must be exactly 32 UTF-8 bytes.');
  return bytes;
}

export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function generateWebhookMasterKey(): string {
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function encryptWebhookSecret(input: { secret: string; masterKeyBase64Url: string }): Promise<string> {
  const secret = normalizeSecret(input.secret);
  const key = await importAesKey(input.masterKeyBase64Url);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, secret);
  return `${VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptWebhookSecret(input: { envelope: string; masterKeyBase64Url: string }): Promise<string> {
  const [version, ivEncoded, ciphertextEncoded] = input.envelope.split('.');
  if (version !== VERSION || !ivEncoded || !ciphertextEncoded) throw new Error('Unsupported webhook secret envelope.');
  const iv = base64UrlToBytes(ivEncoded);
  if (iv.byteLength !== IV_BYTES) throw new Error('Invalid webhook envelope IV.');
  const ciphertext = base64UrlToBytes(ciphertextEncoded);
  if (ciphertext.byteLength < 16) throw new Error('Invalid webhook envelope ciphertext.');
  const key = await importAesKey(input.masterKeyBase64Url);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const secret = new TextDecoder().decode(plaintext);
  normalizeSecret(secret);
  return secret;
}
