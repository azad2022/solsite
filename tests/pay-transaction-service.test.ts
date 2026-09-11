import { describe, expect, it, vi } from 'vitest';
import { PayHttpClient } from '../src/pay/http';
import { createPayTransactionService } from '../src/pay/services/transactionService';

const merchantId = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';

function payment() {
  return {
    id: paymentId,
    merchant_id: merchantId,
    external_order_id: 'order-42',
    amount_atomic: '1250000',
    asset: 'USDC',
    token_mint: 'So11111111111111111111111111111111111111112',
    token_program: 'Token2022',
    token_decimals: 6,
    recipient: '9xQeWvG816bUx9EPf...recipient',
    reference: '11111111111111111111111111111111',
    fee_atomic: '12500',
    fee_payer: 'customer',
    customer_total_atomic: '1262500',
    merchant_net_atomic: '1237500',
    merchant_settlement_atomic: '1237500',
    status: 'completed',
    expires_at: '2026-09-11T12:00:00Z',
    created_at: '2026-09-11T11:00:00Z',
    updated_at: '2026-09-11T11:01:00Z',
    network: 'solana',
    payment_link_id: null,
    invoice_id: null,
    customer_wallet_address: 'CustomerWallet111111111111111111111111111111',
  };
}

describe('Pay transaction service', () => {
  it('rejects a malformed list envelope', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, apiVersion: 'v1', data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const service = createPayTransactionService(new PayHttpClient({ fetchImpl }));
    await expect(service.list(merchantId)).rejects.toThrow('Invalid Pay transaction list envelope.');
  });

  it('parses a valid transaction list without converting atomic values to floating point', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, apiVersion: 'v1', data: [payment()] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const service = createPayTransactionService(new PayHttpClient({ fetchImpl }));
    const rows = await service.list(merchantId, { status: 'completed' });
    expect(rows[0].amount_atomic).toBe('1250000');
    expect(rows[0].status).toBe('completed');
  });

  it('parses transaction detail and keeps blockchain evidence separate', async () => {
    const detail = {
      success: true,
      apiVersion: 'v1',
      data: {
        payment: { ...payment(), fee_bps: 100, gas_sponsored: false, fee_recipient: 'FeeRecipient11111111111111111111111111111', fee_payer_address: null },
        transactions: [{ id: '33333333-3333-4333-8333-333333333333', payment_id: paymentId, signature: '5igSignature111111111111111111111111111111111111111111111111', verification_status: 'verified', verified_at: '2026-09-11T11:02:00Z' }],
        transfers: [],
        events: [{ id: '44444444-4444-4444-8444-444444444444', payment_id: paymentId, event_type: 'completed', created_at: '2026-09-11T11:02:00Z' }],
      },
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(detail), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const service = createPayTransactionService(new PayHttpClient({ fetchImpl }));
    const result = await service.get(paymentId);
    expect(result.payment.amount_atomic).toBe('1250000');
    expect(result.transactions[0].verification_status).toBe('verified');
    expect(result.events[0].event_type).toBe('completed');
  });
});
