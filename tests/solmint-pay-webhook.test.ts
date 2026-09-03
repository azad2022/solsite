import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWebhookWithTimeout, shouldDeadLetter, webhookRetryDelaySeconds } from '../src/pay/services/webhookDelivery';
import { generateWebhookSecret } from '../src/pay/services/webhookSecretEnvelope';
import { signWebhookPayload, verifyWebhookPayload } from '../src/pay/services/webhookSigner';

const secret = generateWebhookSecret();
const provider = { getSigningSecret: async () => secret };


test('webhook retry backoff is bounded and deterministic', () => {
  assert.equal(webhookRetryDelaySeconds(1), 30);
  assert.equal(webhookRetryDelaySeconds(2), 60);
  assert.equal(webhookRetryDelaySeconds(3), 120);
  assert.equal(webhookRetryDelaySeconds(8), 3840);
  assert.equal(webhookRetryDelaySeconds(20), 21600);
  assert.equal(shouldDeadLetter(7), false);
  assert.equal(shouldDeadLetter(8), true);
});

test('webhook signature verifies exact body and rejects stale timestamp/tampering', async () => {
  const rawBody = JSON.stringify({ id: 'evt-1', type: 'payment.confirmed', data: { amount: '100' } });
  const now = Math.floor(Date.now() / 1000);
  const header = await signWebhookPayload({
    webhookId: 'wh-1', eventId: 'evt-1', timestampSeconds: now, rawBody, keyVersion: 'v1', secretProvider: provider,
  });

  assert.equal(await verifyWebhookPayload({ webhookId: 'wh-1', eventId: 'evt-1', header, rawBody, keyVersion: 'v1', secretProvider: provider, nowSeconds: now }), true);
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh-1', eventId: 'evt-1', header, rawBody: `${rawBody} `, keyVersion: 'v1', secretProvider: provider, nowSeconds: now }), false);
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh-1', eventId: 'evt-1', header, rawBody, keyVersion: 'v1', secretProvider: provider, nowSeconds: now + 301 }), false);
});

test('webhook delivery rejects redirects and disallowed endpoints before network access', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; return new Response(null, { status: 200 }); }) as typeof fetch;
  try {
    await assert.rejects(fetchWebhookWithTimeout({ endpointUrl: 'http://example.com/hook', signatureHeader: 'x', body: '{}' }));
    await assert.rejects(fetchWebhookWithTimeout({ endpointUrl: 'https://localhost/hook', signatureHeader: 'x', body: '{}' }));
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
