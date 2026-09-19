import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayInvoiceService } from '../src/pay/services/invoiceService';
import type { PayHttpClient } from '../src/pay/http';

const merchantId = '11111111-1111-4111-8111-111111111111';
const invoiceId = '22222222-2222-4222-8222-222222222222';
const invoice = {
  id: invoiceId, merchant_id: merchantId, invoice_number: 'INV-1001', customer_label: 'Customer A',
  title: 'Website payment', description: 'Test invoice', amount_atomic: '1250000', asset: 'USDC',
  fee_payer: 'merchant', checkout_locale: 'en-US', due_at: null, status: 'open',
  created_at: '2026-09-18T00:00:00Z', updated_at: '2026-09-18T00:00:00Z',
};

function clientFor(payload: unknown): PayHttpClient {
  return { request: async <T>() => payload as T } as unknown as PayHttpClient;
}

test('invoice service parses the released read envelope', async () => {
  const result = await createPayInvoiceService(clientFor({ success:true, apiVersion:'v1', data:[invoice] })).list(merchantId);
  assert.equal(result[0]?.invoice_number, 'INV-1001');
  assert.equal(result[0]?.amount_atomic, '1250000');
});

test('invoice service rejects malformed financial data', async () => {
  await assert.rejects(
    () => createPayInvoiceService(clientFor({ success:true, apiVersion:'v1', data:[{ ...invoice, amount_atomic:'12.5' }] })).list(merchantId),
    /Invalid Pay invoice field: amount_atomic/,
  );
});

test('invoice service validates status filters and identifiers before a request', async () => {
  const service = createPayInvoiceService(clientFor({ success:true, apiVersion:'v1', data:[] }));
  await assert.rejects(() => service.list('not-a-uuid'), /Merchant ID is invalid/);
  await assert.rejects(() => service.list(merchantId, { status:'bad' as never }), /Invoice status is invalid/);
});

test('invoice service parses the detail envelope', async () => {
  const result = await createPayInvoiceService(clientFor({ success:true, apiVersion:'v1', data:invoice })).get(merchantId, invoiceId);
  assert.equal(result.id, invoiceId);
  assert.equal(result.status, 'open');
});
