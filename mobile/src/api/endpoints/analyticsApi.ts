import api from '../client';

export interface MonthlyEarning {
  month: string;
  amount: number;
  fees: number;
}

export interface ProposalFunnel {
  sent: number;
  pending: number;
  accepted: number;
  declined: number;
}

export interface FreelancerAnalytics {
  ytdEarnings: number;
  totalEarnings: number;
  avgJobSize: number;
  winRate: number;
  activeJobs: number;
  completedJobs: number;
  deliveryRate: number | null;
  repeatClientRate: number;
  ratingAvg: number | null;
  ratingCount: number;
  monthlyEarnings: MonthlyEarning[];
  proposalFunnel: ProposalFunnel;
  topCategories: { category: string; earned: number; jobs: number }[];
}

export interface AnalyticsResponse {
  freelancer: FreelancerAnalytics | null;
  client: Record<string, unknown> | null;
  meta: { range: string; monthCount: number; months: string[] };
}

export const analyticsApi = {
  getMyAnalytics: async (range = '1yr'): Promise<AnalyticsResponse> => {
    const { data } = await api.get('/api/analytics/me', { params: { range } });
    return data;
  },
};
