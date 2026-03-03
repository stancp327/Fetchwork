import client from '../client';

export type SavedPaymentMethod = {
  id: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault?: boolean;
};

export type PaymentHistoryItem = {
  _id: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  job?: { _id?: string; title?: string };
  client?: { _id?: string; firstName?: string; lastName?: string };
  freelancer?: { _id?: string; firstName?: string; lastName?: string };
};

export const paymentsApi = {
  getEphemeralKey: (): Promise<{ ephemeralKey: string; customerId: string }> =>
    client.post('/api/payments/ephemeral-key').then((r) => r.data),

  getSavedMethods: (): Promise<{ methods: SavedPaymentMethod[] }> =>
    client.get('/api/payments/methods').then((r) => r.data),

  setupPaymentMethod: (): Promise<{ clientSecret: string }> =>
    client.post('/api/payments/methods/setup').then((r) => r.data),

  setDefaultMethod: (pmId: string): Promise<{ message: string }> =>
    client.post(`/api/payments/methods/${pmId}/default`).then((r) => r.data),

  removeMethod: (pmId: string): Promise<{ message: string }> =>
    client.delete(`/api/payments/methods/${pmId}`).then((r) => r.data),

  getHistory: (page = 1, limit = 10): Promise<{ payments: PaymentHistoryItem[]; total: number; page: number; pages: number }> =>
    client.get('/api/payments/history', { params: { page, limit } }).then((r) => r.data),

  fundJob: (jobId: string, data: { packageName?: string; paymentMethodId?: string }): Promise<{
    paymentIntentId: string; clientSecret: string;
  }> =>
    client.post(`/api/payments/job/${jobId}/fund`, data).then((r) => r.data),

  releasePayment: (jobId: string) =>
    client.post(`/api/payments/job/${jobId}/release`).then((r) => r.data),

  sendTip: (data: { recipientId: string; amount: number; paymentMethodId: string; jobId?: string }) =>
    client.post('/api/payments/tip', data).then((r) => r.data),

  getConnectStatus: (): Promise<{ connected: boolean; payoutsEnabled?: boolean; chargesEnabled?: boolean; detailsSubmitted?: boolean }> =>
    client.get('/api/payments/status').then((r) => r.data),

  getStripeConnectUrl: (): Promise<{ accountId?: string; onboardingUrl: string }> =>
    client.post('/api/payments/connect-account').then((r) => r.data),
};
