import client from '../client';

export const billingApi = {
  getWalletBalance: (): Promise<{ balance: number; credits?: unknown[] }> =>
    client.get('/api/billing/wallet/balance').then(r => r.data),
};
