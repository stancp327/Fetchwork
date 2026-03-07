import { apiRequest } from '../utils/api';

export const aiApi = {
  generateDescription: (data) =>
    apiRequest('/api/ai/generate-description', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  matchFreelancers: (jobId) =>
    apiRequest(`/api/ai/match-freelancers/${jobId}`),
};
