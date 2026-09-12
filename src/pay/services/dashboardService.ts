import { payTransactionService, type PayTransaction, type PayTransactionStatus } from './transactionService';

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

export const payDashboardService = createPayDashboardService();
