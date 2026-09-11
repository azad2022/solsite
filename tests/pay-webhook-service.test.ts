import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PayHttpClient } from '../src/pay/http';
import { createPayWebhookService } from '../src/pay/services/webhookService';

const merchantId = '11111111-1111-4111-8111-111111111111';
const webhookId = '22222222-2222-4222-8222-222222222222';

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const webhook = {
  id: webhookId,
  merchant_id: merchantId,
  endpoint_url: 'https://example.com/solmint/webhook',
  active: true,
  subscribed_events: ['payment.completed'],
  created_at: '2026-09-11T11:00:00Z',
  updated_at: '2026-09-11T11:01:00Z',
  status: 'active',
  failure_count: 0,
  disabled_at: null,
  secret_configured: true,
  signature_status: 'server_signed',
  secret_hash: 'must-never-reach-the-client',
  encrypted_secret: 'must-never-reach-the-client',
};

describe('Pay webhook service', () => {
  it('rejects malformed list envelopes', async () => {
    const client = new PayHttpClient({ fetchImpl: (async () => response({ success: true, apiVersion: 'v1', data: {} })) as typeof fetch });
    const service = createPayWebhookService(client);
    await assert.rejects(() => service.list(merchantId), /Invalid Pay webhook list envelope\./);
  });

  it('allowlists webhook fields and never returns secret-bearing columns', async () => {
    const client = new PayHttpClient({ fetchImpl: (async () => response({ success: true, apiVersion: 'v1', data: [webhook] })) as typeof fetch });
    const service = createPayWebhookService(client);
    const rows = await service.list(merchantId);
    assert.equal(rows[0]?.secret_configured, true);
    assert.equal(rows[0]?.signature_status, 'server_signed');
    assert.equal('secret_hash' in (rows[0] ?? {}), false);
    assert.equal('encrypted_secret' in (rows[0] ?? {}), false);
  });

  it('parses delivery history without accepting payload contents', async () => {
    const client = new PayHttpClient({ fetchImpl: (async () => response({
      success: true,
      apiVersion: 'v1',
      data: { webhook, deliveries: [{ id: '33333333-3333-4333-8333-333333333333', webhook_id: webhookId, event_id: 'event-1', event_type: 'payment.completed', attempt_count: 1, status: 'delivered', next_attempt_at: null, last_attempt_at: '2026-09-11T11:02:00Z', delivered_at: '2026-09-11T11:02:01Z', created_at: '2026-09-11T11:01:00Z', response_status: 200, response_hash: 'abc', error_code: null, payload: { sensitive: 'should-not-be-client-visible' } }] },
    })) as typeof fetch });
    const service = createPayWebhookService(client);
    const result = await service.get(merchantId, webhookId);
    assert.equal(result.deliveries[0]?.status, 'delivered');
    assert.equal('payload' in (result.deliveries[0] ?? {}), false);
  });
});
