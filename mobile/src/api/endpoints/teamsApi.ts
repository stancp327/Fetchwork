import client from '../client';

export type TeamMemberRole = 'owner' | 'admin' | 'manager' | 'member';
export type TeamType = 'client_team' | 'agency';

export type TeamUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImage?: string;
};

export type TeamMember = {
  user: TeamUser | string;
  role: TeamMemberRole;
  status: 'active' | 'invited' | 'removed';
  permissions?: string[];
  title?: string;
  joinedAt?: string;
  invitedAt?: string;
};

export type MobileTeam = {
  _id: string;
  name: string;
  type: TeamType;
  description?: string;
  owner?: TeamUser | string;
  members?: TeamMember[];
  currentUserRole?: TeamMemberRole | null;
  currentUserIsOwner?: boolean;
  currentUserCanDelete?: boolean;
  currentUserCanManageMembers?: boolean;
  transferState?: 'idle' | 'pending' | 'applying';
};

export type TeamInvitation = {
  _id: string;
  name: string;
  type: TeamType;
  description?: string;
  owner?: TeamUser;
};

export type TeamAuditLog = {
  _id: string;
  action: string;
  createdAt: string;
  actor?: TeamUser;
  targetUser?: TeamUser;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export const teamsApi = {
  getMyTeams: (): Promise<{ teams: MobileTeam[] }> =>
    client.get('/api/teams').then((r) => r.data),

  getPendingInvitations: (): Promise<{ invitations: TeamInvitation[] }> =>
    client.get('/api/teams/invitations/pending').then((r) => r.data),

  createTeam: (payload: { name: string; type: TeamType; description?: string }): Promise<{ team: MobileTeam }> =>
    client.post('/api/teams', payload).then((r) => r.data),

  getTeam: (id: string): Promise<{ team: MobileTeam }> =>
    client.get(`/api/teams/${id}`).then((r) => r.data),

  inviteMember: (
    teamId: string,
    payload: { email: string; role?: 'member' | 'manager' | 'admin'; title?: string }
  ): Promise<{ message: string; team: MobileTeam }> =>
    client.post(`/api/teams/${teamId}/invite`, payload).then((r) => r.data),

  acceptInvitation: (teamId: string): Promise<{ message: string; team: MobileTeam }> =>
    client.post(`/api/teams/${teamId}/accept`).then((r) => r.data),

  declineInvitation: (teamId: string): Promise<{ message: string }> =>
    client.post(`/api/teams/${teamId}/decline`).then((r) => r.data),

  removeMember: (teamId: string, userId: string): Promise<{ message: string }> =>
    client.delete(`/api/teams/${teamId}/members/${userId}`).then((r) => r.data),

  transferOwnership: (teamId: string, targetUserId: string): Promise<{ message: string; team: MobileTeam }> =>
    client.post(`/api/teams/${teamId}/transfer-ownership`, { targetUserId }).then((r) => r.data),

  getAuditLogs: (
    teamId: string,
    params?: { page?: number; limit?: number; action?: string; actor?: string; targetUser?: string }
  ): Promise<{ logs: TeamAuditLog[]; pagination: { page: number; limit: number; total: number; pages: number } }> =>
    client.get(`/api/teams/${teamId}/audit-logs`, { params }).then((r) => r.data),
};
