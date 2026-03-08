import client from '../client';
import { Job, Proposal } from '@fetchwork/shared';

export interface JobFilters {
  category?: string;
  minBudget?: number;
  maxBudget?: number;
  search?: string;
  isRemote?: boolean;
  status?: string;
  page?: number;
  limit?: number;
}

export const jobsApi = {
  browse: (filters: JobFilters = {}): Promise<{ jobs: Job[]; total: number; page: number; pages: number }> =>
    client.get('/api/jobs', { params: { limit: 20, ...filters } }).then(r => r.data),

  getById: (id: string): Promise<Job> =>
    client.get(`/api/jobs/${id}`).then(r => r.data),

  create: (data: Partial<Job>): Promise<{ job: Job }> =>
    client.post('/api/jobs', data).then(r => r.data),

  myJobs: (params?: { status?: string; role?: string }): Promise<Job[]> =>
    client.get('/api/jobs/my-jobs', { params }).then(r => r.data),

  apply: (id: string, data: { coverLetter: string; bidAmount: number; milestones?: object[] }) =>
    client.post(`/api/jobs/${id}/apply`, data).then(r => r.data),

  getProposals: (jobId: string): Promise<Proposal[]> =>
    client.get(`/api/jobs/${jobId}/proposals`).then(r => r.data),

  acceptProposal: (jobId: string, proposalId: string) =>
    client.put(`/api/jobs/${jobId}/proposals/${proposalId}/accept`).then(r => r.data),

  markComplete: (jobId: string) =>
    client.put(`/api/jobs/${jobId}/complete`).then(r => r.data),

  updateStatus: (jobId: string, status: string) =>
    client.put(`/api/jobs/${jobId}/status`, { status }).then(r => r.data),

  featureJob: (jobId: string, tier: 'standard' | 'premium'): Promise<{ clientSecret: string; amount: number; paymentIntentId: string }> =>
    client.post(`/api/jobs/${jobId}/feature`, { tier }).then(r => r.data),

  verifyFeature: (jobId: string, paymentIntentId: string) =>
    client.post(`/api/jobs/${jobId}/feature/verify`, { paymentIntentId }).then(r => r.data),

  promoteProposal: (jobId: string, proposalId: string): Promise<{ clientSecret: string; amount: number; paymentIntentId: string }> =>
    client.post(`/api/jobs/${jobId}/proposals/${proposalId}/promote`).then(r => r.data),

  verifyPromotion: (jobId: string, proposalId: string, paymentIntentId: string) =>
    client.post(`/api/jobs/${jobId}/proposals/${proposalId}/promote/verify`, { paymentIntentId }).then(r => r.data),

  completeMilestone: (jobId: string, milestoneId: string) =>
    client.post(`/api/jobs/${jobId}/milestones/${milestoneId}/complete`).then(r => r.data),

  approveMilestone: (jobId: string, milestoneId: string) =>
    client.post(`/api/jobs/${jobId}/milestones/${milestoneId}/approve`).then(r => r.data),
};
