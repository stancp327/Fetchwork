import client from '../client';

export type MobileTeam = {
  _id: string;
  name: string;
  type: 'client_team' | 'agency';
  members?: Array<{ user: string; role: string; status: string }>;
};

export const teamsApi = {
  getMyTeams: (): Promise<{ teams: MobileTeam[] }> =>
    client.get('/api/teams').then(r => r.data),
};
