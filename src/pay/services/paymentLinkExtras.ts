export type PayPaymentLinkCheckoutFieldType = 'text' | 'email' | 'textarea';

export interface PayPaymentLinkCheckoutField {
  key: string;
  label: string;
  type: PayPaymentLinkCheckoutFieldType;
  required: boolean;
}

export type PayPaymentLinkCheckoutFieldValue = PayPaymentLinkCheckoutField & { value: string };

const FIELD_TYPES = new Set<PayPaymentLinkCheckoutFieldType>(['text', 'email', 'textarea']);
const FIELD_KEY = /^[a-z][a-z0-9_]{0,31}$/;
const MAX_FIELDS = 5;
const MAX_ATOMIC_JSON_TEXT = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and canonicalizes merchant-defined Checkout fields.
 * The server calls this before persisting a definition and again when reading it.
 */
export function parsePaymentLinkCheckoutFields(value: unknown): PayPaymentLinkCheckoutField[] {
  if (!Array.isArray(value) || value.length > MAX_FIELDS) {
    throw new TypeError('Payment Link checkout fields must be an array of at most five fields.');
  }

  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item)) throw new TypeError('Payment Link checkout field is invalid.');
    const keys = Object.keys(item).sort();
    if (keys.join(',') !== 'key,label,required,type') throw new TypeError('Payment Link checkout field has unsupported properties.');

    const key = typeof item.key === 'string' ? item.key.trim() : '';
    const label = typeof item.label === 'string' ? item.label.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const type = item.type;
    const required = item.required;

    if (!FIELD_KEY.test(key) || seen.has(key)) throw new TypeError('Payment Link checkout field key is invalid or duplicated.');
    if (!label || label.length > 80) throw new TypeError('Payment Link checkout field label is invalid.');
    if (typeof type !== 'string' || !FIELD_TYPES.has(type as PayPaymentLinkCheckoutFieldType)) {
      throw new TypeError('Payment Link checkout field type is unsupported.');
    }
    if (typeof required !== 'boolean') throw new TypeError('Payment Link checkout field required flag is invalid.');

    seen.add(key);
    return { key, label, type: type as PayPaymentLinkCheckoutFieldType, required };
  });
}

/** Success destinations are merchant-configured HTTPS URLs, never request/query parameters. */
export function normalizePaymentLinkSuccessUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new TypeError('Payment Link success URL is invalid.');
  const raw = value.trim();
  if (!raw || raw.length > MAX_ATOMIC_JSON_TEXT || /[\u0000-\u0020\u007f]/.test(raw)) {
    throw new TypeError('Payment Link success URL is invalid.');
  }

  let url: URL;
  try { url = new URL(raw); } catch { throw new TypeError('Payment Link success URL must be an absolute HTTPS URL.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError('Payment Link success URL must be an absolute HTTPS URL without credentials.');
  }
  return url.toString();
}

/** NULL means unlimited. The positive integer range matches PostgreSQL integer storage. */
export function parsePaymentLinkMaxPayments(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  let parsed: number;
  if (typeof value === 'number') parsed = value;
  else if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) parsed = Number(value.trim());
  else throw new TypeError('Payment Link payment limit is invalid.');
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) {
    throw new TypeError('Payment Link payment limit is outside the supported integer range.');
  }
  return parsed;
}

export function parseNullableCapacityCount(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) {
    throw new TypeError('Payment Link ' + field + ' is invalid.');
  }
  return parsed;
}

/**
 * Sanitizes customer values against the immutable field definition returned by the
 * backend. The database function revalidates the same values against the locked link
 * row, so a link edit racing checkout cannot bypass required-field validation.
 */
export function sanitizePaymentLinkCheckoutFieldValues(
  fieldsInput: unknown,
  value: unknown,
): Record<string, string> {
  const fields = parsePaymentLinkCheckoutFields(fieldsInput);
  if (value === undefined || value === null) value = {};
  if (!isRecord(value)) throw new TypeError('Custom Checkout field values are invalid.');

  const fieldsByKey = new Map(fields.map(field => [field.key, field]));
  for (const key of Object.keys(value)) {
    if (!fieldsByKey.has(key)) throw new TypeError('An unknown custom Checkout field was supplied.');
  }

  const values: Record<string, string> = {};
  for (const field of fields) {
    const raw = value[field.key];
    if (raw === undefined || raw === null) {
      if (field.required) throw new TypeError('A required custom Checkout field is missing.');
      continue;
    }
    if (typeof raw !== 'string') throw new TypeError('Custom Checkout field values must be strings.');

    const normalized = field.type === 'textarea'
      ? raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim()
      : raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!normalized) {
      if (field.required) throw new TypeError('A required custom Checkout field is empty.');
      continue;
    }
    const maxLength = field.type === 'textarea' ? 2000 : field.type === 'email' ? 254 : 500;
    if (normalized.length > maxLength) throw new TypeError('Custom Checkout field value is too long.');
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new TypeError('Custom Checkout email field is invalid.');
    }
    values[field.key] = normalized;
  }

  return values;
}
