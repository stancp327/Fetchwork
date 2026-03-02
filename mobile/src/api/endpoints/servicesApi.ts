import client from '../client';
import { Service } from '@fetchwork/shared';

export const servicesApi = {
  browse: (params: {
    category?: string; search?: string; serviceType?: string;
    page?: number; limit?: number;
  } = {}): Promise<{ services: Service[]; total: number; page: number; pages: number }> =>
    client.get('/api/services', { params: { limit: 20, ...params } }).then(r => r.data),

  getById: (id: string): Promise<Service> =>
    client.get(`/api/services/${id}`).then(r => r.data),

  order: (id: string, data: { package: string; requirements?: string }) =>
    client.post(`/api/services/${id}/order`, data).then(r => r.data),

  subscribe: (id: string, data: { tier?: string }) =>
    client.post(`/api/services/${id}/subscribe`, data).then(r => r.data),

  purchaseBundle: (id: string, data: { bundleId: string }) =>
    client.post(`/api/services/${id}/bundle/purchase`, data).then(r => r.data),

  getMySubscriptions: (role: 'client' | 'freelancer' = 'client') =>
    client.get('/api/services/subscriptions/me', { params: { role } }).then(r => r.data),

  cancelSubscription: (subId: string) =>
    client.delete(`/api/services/subscriptions/${subId}`).then(r => r.data),

  getMyBundles: (role: 'client' | 'freelancer' = 'client') =>
    client.get('/api/services/bundles/me', { params: { role } }).then(r => r.data),

  completeSession: (purchaseId: string, sessionIndex: number, notes?: string) =>
    client.post(`/api/services/bundles/${purchaseId}/sessions/${sessionIndex}/complete`, { notes }).then(r => r.data),

  myServices: () =>
    client.get('/api/services/me').then(r => r.data),
};
