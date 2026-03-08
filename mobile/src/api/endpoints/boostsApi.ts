import api from '../client';

export type BoostTier = 'standard' | 'premium' | 'featured';

export interface BoostCredits {
  credits: number;
  freeCreditsUsed: number;
  plan: string;
}

export interface Boost {
  tier: BoostTier;
  expiresAt: string;
  cost: number;
}

export const boostsApi = {
  getCredits: (): Promise<BoostCredits> =>
    api.get('/api/boosts/credits').then(r => r.data),

  boostJob: (id: string, tier: BoostTier): Promise<{ boost: Boost }> =>
    api.post(`/api/boosts/job/${id}`, { tier }).then(r => r.data),

  boostService: (id: string, tier: BoostTier): Promise<{ boost: Boost }> =>
    api.post(`/api/boosts/service/${id}`, { tier }).then(r => r.data),

  getAnalytics: (): Promise<{ impressions: number; clicks: number; applications: number }> =>
    api.get('/api/boosts/analytics').then(r => r.data),
};
