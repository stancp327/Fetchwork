import api from '../client';

export const boostsApi = {
  credits: async () => {
    const { data } = await api.get('/api/boosts/credits');
    return data;
  },
  options: async () => {
    const { data } = await api.get('/api/boosts/options');
    return data;
  },
  boostJob: async (jobId: string, plan = '7day', useCredit = false) => {
    const { data } = await api.post(`/api/boosts/job/${jobId}`, { plan, useCredit });
    return data;
  },
  boostService: async (serviceId: string, plan = '7day', useCredit = false) => {
    const { data } = await api.post(`/api/boosts/service/${serviceId}`, { plan, useCredit });
    return data;
  },
  analytics: async () => {
    const { data } = await api.get('/api/boosts/analytics');
    return data;
  },
  trackClick: async (targetType: string, targetId: string) => {
    await api.post('/api/boosts/track/click', { targetType, targetId });
  },
};
