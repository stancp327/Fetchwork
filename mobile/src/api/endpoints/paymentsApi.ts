import client from '../client';

export const paymentsApi = {
  getEphemeralKey: (): Promise<{ ephemeralKey: string; customerId: string }> =>
    client.post('/api/payments/ephemeral-key').then(r => r.data),

  getSavedMethods: (): Promise<{ methods: Array<{ id: string; card: { brand: string; last4: string } }> }> =>
    client.get('/api/payments/methods').then(r => r.data),

  fundJob: (jobId: string, data: { packageName?: string; paymentMethodId?: string }): Promise<{
    paymentIntentId: string; clientSecret: string;
  }> =>
    client.post(`/api/payments/job/${jobId}/fund`, data).then(r => r.data),

  releasePayment: (jobId: string) =>
    client.post(`/api/payments/job/${jobId}/release`).then(r => r.data),

  sendTip: (data: { recipientId: string; amount: number; paymentMethodId: string; jobId?: string }) =>
    client.post('/api/payments/tip', data).then(r => r.data),

  getConnectStatus: () =>
    client.get('/api/payments/connect-status').then(r => r.data),

  getStripeConnectUrl: () =>
    client.post('/api/payments/connect-onboard').then(r => r.data),
};
