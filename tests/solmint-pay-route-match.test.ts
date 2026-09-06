import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPayRoute } from '../src/pay/route-match.ts';

test('Pay route matcher separates dashboard, checkout, and unknown paths', () => {
  assert.deepEqual(matchPayRoute('/pay'), { kind: 'dashboard', section: 'overview' });
  assert.deepEqual(matchPayRoute('/pay/transactions'), { kind: 'dashboard', section: 'transactions' });
  assert.deepEqual(matchPayRoute('/pay/checkout'), { kind: 'checkout', intentId: undefined });
  assert.deepEqual(matchPayRoute('/pay/checkout/intent_123'), { kind: 'checkout', intentId: 'intent_123' });
  assert.deepEqual(matchPayRoute('/pay/checkout/intent_123/details'), { kind: 'not-found' });
  assert.deepEqual(matchPayRoute('/pay/not-a-section'), { kind: 'not-found' });
  assert.deepEqual(matchPayRoute('/dashboard'), { kind: 'not-found' });
});
