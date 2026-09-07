export const PAY_DATA_STATES = [
  'idle',
  'loading',
  'ready',
  'empty',
  'error',
  'unauthorized',
  'forbidden',
  'stale',
  'retryable',
] as const;

export type PayDataState = (typeof PAY_DATA_STATES)[number];

export interface PayStateMeta {
  state: PayDataState;
  requestId?: string;
  updatedAt?: string;
  message?: string;
  retryable?: boolean;
}

export interface PayData<T> {
  value: T;
  meta: PayStateMeta;
}

export const isPayTerminalState = (state: PayDataState): boolean =>
  state === 'ready' || state === 'empty' || state === 'unauthorized' || state === 'forbidden';
