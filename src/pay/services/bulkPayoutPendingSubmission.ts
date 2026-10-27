import { decodeBase58 } from './base58';

export interface PendingBulkPayoutSubmission {
  batchId: string;
  signature: string;
  idempotencyKey: string;
}

export type PendingBulkPayoutSubmissions = Record<string, PendingBulkPayoutSubmission>;

const BATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_PREFIX = 'solmint-pay:bulk-payout:pending-submit:v1:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSignature(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 64 || value.length > 128) return false;
  try {
    return decodeBase58(value).length === 64;
  } catch {
    return false;
  }
}

function normalize(value: unknown): PendingBulkPayoutSubmission | null {
  if (!isRecord(value)) return null;
  const { batchId, signature, idempotencyKey } = value;
  if (typeof batchId !== 'string' || !BATCH_ID_PATTERN.test(batchId)) return null;
  if (!isSignature(signature)) return null;
  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) return null;
  return { batchId, signature, idempotencyKey };
}

export function pendingBulkPayoutStorageKey(merchantId: string): string {
  return STORAGE_PREFIX + merchantId;
}

export function parsePendingBulkPayoutSubmissions(raw: string | null): PendingBulkPayoutSubmissions {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    const result: PendingBulkPayoutSubmissions = {};
    for (const value of parsed) {
      const submission = normalize(value);
      if (submission) result[submission.batchId] = submission;
    }
    return result;
  } catch {
    return {};
  }
}

export function serializePendingBulkPayoutSubmissions(
  submissions: Readonly<PendingBulkPayoutSubmissions>,
): string {
  const valid = Object.values(submissions)
    .map(normalize)
    .filter((submission): submission is PendingBulkPayoutSubmission => submission !== null);
  return JSON.stringify(valid);
}

export function loadPendingBulkPayoutSubmissions(merchantId: string): PendingBulkPayoutSubmissions {
  if (typeof window === 'undefined') return {};
  try {
    return parsePendingBulkPayoutSubmissions(window.sessionStorage.getItem(pendingBulkPayoutStorageKey(merchantId)));
  } catch {
    return {};
  }
}

export function savePendingBulkPayoutSubmissions(
  merchantId: string,
  submissions: Readonly<PendingBulkPayoutSubmissions>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = pendingBulkPayoutStorageKey(merchantId);
    const serialized = serializePendingBulkPayoutSubmissions(submissions);
    if (serialized === '[]') window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, serialized);
  } catch {
    // Keep the in-memory recovery path if the browser blocks session storage.
  }
}
