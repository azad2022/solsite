export class PayHttpError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'PayHttpError';
    this.status = status;
    this.requestId = requestId;
  }
}

export interface PayHttpClientOptions {
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
}

/**
 * Transport boundary for Pay API traffic.
 *
 * This intentionally accepts only same-origin `/api/...` paths. It does not
 * define any Pay endpoint or business contract; concrete service methods must
 * be added only after the backend contract is production-enabled.
 */
export class PayHttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly credentials: RequestCredentials;

  constructor(options: PayHttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.credentials = options.credentials ?? 'include';
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/api/') || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) {
      throw new TypeError('Pay API requests must use a same-origin /api/... path.');
    }

    const response = await this.fetchImpl(path, {
      ...init,
      credentials: init.credentials ?? this.credentials,
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    });

    const requestId = response.headers.get('x-request-id') ?? undefined;
    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message ?? `Pay request failed (${response.status}).`)
        : `Pay request failed (${response.status}).`;
      throw new PayHttpError(message, response.status, requestId);
    }

    return payload as T;
  }
}

export const defaultPayHttpClient = new PayHttpClient();
