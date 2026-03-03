import client from '../client';

export type WalletCredit = {
  _id: string;
  amount: number;
  remaining: number;
  reason?: string;
  status: 'active' | 'used' | 'voided' | 'expired';
  createdAt?: string;
  updatedAt?: string;
  usedAt?: string;
};

export const billingApi = {
  getWalletBalance: (): Promise<{ balance: number; credits?: unknown[] }> =>
    client.get('/api/billing/wallet/balance').then((r) => r.data),

  getWallet: (): Promise<{ balance: number; active: WalletCredit[]; history: WalletCredit[] }> =>
    client.get('/api/billing/wallet').then((r) => r.data),

  addWalletFunds: (amount: number): Promise<{ checkoutUrl: string }> =>
    client.post('/api/billing/wallet/add', { amount }).then((r) => r.data),

  withdrawWalletFunds: (amount: number): Promise<{ success: boolean; withdrawn: number; transferId: string }> =>
    client.post('/api/billing/wallet/withdraw', { amount }).then((r) => r.data),
};
