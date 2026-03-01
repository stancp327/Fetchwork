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
};
