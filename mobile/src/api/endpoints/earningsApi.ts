import client from '../client';

export interface MonthRow { month: number; name: string; year: number; amount: number; jobCount: number; }

export interface EarningsData {
  year:          number;
  monthly:       MonthRow[];
  ytd:           number;
  allTime:       number;
  allTimeJobs:   number;
  pendingEscrow: number;
}

export const earningsApi = {
  getEarnings: (year: number): Promise<EarningsData> =>
    client.get(`/api/users/me/earnings?year=${year}`).then(r => r.data),
};
