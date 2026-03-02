import api from '../client';

export interface DiscoveryPrefs {
  enabled: boolean;
  notifyJobs: boolean;
  notifyServices: boolean;
  notifyClasses: boolean;
  categories: string[];
  frequency: 'realtime' | 'daily' | 'weekly';
}

export const discoveryApi = {
  getPrefs: async () => {
    const { data } = await api.get('/api/users/me/discovery');
    return data as { discovery: DiscoveryPrefs; interests: string[]; lookingFor: string[] };
  },
  updatePrefs: async (prefs: Partial<DiscoveryPrefs>) => {
    const { data } = await api.put('/api/users/me/discovery', prefs);
    return data;
  },
};
