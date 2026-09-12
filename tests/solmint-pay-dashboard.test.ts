import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayDashboardService } from '../src/pay/services/dashboardService';
import type { PayTransaction } from '../src/pay/services/transactionService';

const transaction: PayTransaction = {
  id: '11111111-1111-4111-8111-111111111111',
  merchant_id: '22222222-2222-4222-8222-222222222222',
  external_order_id: 'order-1',
  amount_atomic: '123456',
  asset: 'USDC',
  token_mint: 'mint',
  token_program: 'spl-token',
  token_decimals: 6,
  recipient: 'recipient',
  reference: 'reference',
  fee_atomic: '1000',
  fee_payer: 'merchant',
  customer_total_atomic: '124456',
  merchant_net_atomic: '123456',
  merchant_settlement_atomic: '123456',
  status: 'completed',
  expires_at: '2026-09-12T12:00:00.000Z',
  created_at: '2026-09-12T11:00:00.000Z',
  updated_at: '2026-09-12T11:01:00.000Z',
  network: 'mainnet-beta',
  payment_link_id: null,
  invoice_id: null,
  customer_wallet_address: null,
};

test('dashboard activity consumes the existing transaction contract with a bounded recent-activity query', async () => {
  const calls: Array<{ merchantId: string; limit?: number }> = [];
  const service = createPayDashboardService({
    async list(merchantId, filters) {
      calls.push({ merchantId, limit: filters.limit });
      return [transaction];
    },
  });

  const result = await service.loadActivity(transaction.merchant_id);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { merchantId: transaction.merchant_id, limit: 6 });
  assert.equal(result.transactions[0].amount_atomic, '123456');
  assert.equal(result.transactions[0].status, 'completed');
  assert.match(result.loadedAt, /^2026|^20/);
});
