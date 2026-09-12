import { payTransactionService, type PayTransaction, type PayTransactionStatus } from './transactionService';
import { defaultPayHttpClient, type PayHttpClient } from '../http';

export interface PayDashboardActivity {
  transactions: PayTransaction[];
  loadedAt: string;
}

export interface PayDashboardTransactionSource {
  list(merchantId: string, filters: { limit?: number; status?: PayTransactionStatus; search?: string }): Promise<PayTransaction[]>;
}

export function createPayDashboardService(source: PayDashboardTransactionSource = payTransactionService): {
  loadActivity(merchantId: string): Promise<PayDashboardActivity>;
} {
  return {
    async loadActivity(merchantId: string): Promise<PayDashboardActivity> {
      const transactions = await source.list(merchantId, { limit: 6 });
      return { transactions, loadedAt: new Date().toISOString() };
    },
  };
}

export function createPayDashboardHttpService(client: PayHttpClient = defaultPayHttpClient) {
  void client;
  return createPayDashboardService(payTransactionService);
}

export const payDashboardService = createPayDashboardService();
