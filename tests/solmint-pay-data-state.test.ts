import test from 'node:test';
import assert from 'node:assert/strict';
import { PAY_DATA_STATES, isPayTerminalState } from '../src/pay/data-state.ts';

test('Pay data-state model covers operational UI states without financial assumptions', () => {
  assert.deepEqual(PAY_DATA_STATES, [
    'idle',
    'loading',
    'ready',
    'empty',
    'error',
    'unauthorized',
    'forbidden',
    'stale',
    'retryable',
  ]);

  assert.equal(isPayTerminalState('ready'), true);
  assert.equal(isPayTerminalState('empty'), true);
  assert.equal(isPayTerminalState('unauthorized'), true);
  assert.equal(isPayTerminalState('forbidden'), true);
  assert.equal(isPayTerminalState('loading'), false);
  assert.equal(isPayTerminalState('stale'), false);
  assert.equal(isPayTerminalState('retryable'), false);
});
