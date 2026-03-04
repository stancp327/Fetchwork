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
  customRoleName?: string;
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

export type TeamPermissionKey =
  | 'manage_members'
  | 'manage_billing'
  | 'approve_orders'
  | 'create_jobs'
  | 'manage_services'
  | 'view_analytics'
  | 'message_clients'
  | 'assign_work';

export type TeamCustomRole = {
  _id: string;
  name: string;
  permissions: TeamPermissionKey[];
  createdAt?: string;
};

export type TeamClientRelationship = {
  _id: string;
  team: string;
  client: TeamUser | string;
  addedBy?: TeamUser | string;
  accessLevel: 'view_assigned' | 'view_all' | 'collaborate';
  projectLabel?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TeamSpendControls = {
  monthlyCapEnabled: boolean;
  monthlyCap: number;
  alertThreshold: number;
  currentMonthSpend?: number;
  capResetAt?: string;
};

export type TeamApprovalThresholds = {
  payoutRequiresApproval: boolean;
  payoutThresholdAmount: number;
  requireDualControl: boolean;
};

export type TeamSpendControlsResponse = {
  spendControls: TeamSpendControls;
  approvalThresholds: TeamApprovalThresholds;
  effectiveSource?: 'team' | 'org' | 'merged';
};

export type OrganizationSummary = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  teams?: Array<{ _id: string; name: string }>;
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

  // Phase 2+ team controls
  getSpendControls: (teamId: string): Promise<TeamSpendControlsResponse> =>
    client.get(`/api/teams/${teamId}/spend-controls`).then((r) => r.data),

  // Phase 3b custom roles
  getCustomRoles: (teamId: string): Promise<{ customRoles: TeamCustomRole[] }> =>
    client.get(`/api/teams/${teamId}/custom-roles`).then((r) => r.data),

  createCustomRole: (
    teamId: string,
    payload: { name: string; permissions: TeamPermissionKey[] }
  ): Promise<{ customRoles: TeamCustomRole[] }> =>
    client.post(`/api/teams/${teamId}/custom-roles`, payload).then((r) => r.data),

  updateCustomRole: (
    teamId: string,
    roleId: string,
    payload: { name?: string; permissions?: TeamPermissionKey[] }
  ): Promise<{ customRoles: TeamCustomRole[] }> =>
    client.patch(`/api/teams/${teamId}/custom-roles/${roleId}`, payload).then((r) => r.data),

  deleteCustomRole: (teamId: string, roleId: string): Promise<{ customRoles: TeamCustomRole[] }> =>
    client.delete(`/api/teams/${teamId}/custom-roles/${roleId}`).then((r) => r.data),

  assignMemberCustomRole: (
    teamId: string,
    userId: string,
    customRoleName: string
  ): Promise<{ member: TeamMember }> =>
    client.patch(`/api/teams/${teamId}/members/${userId}/custom-role`, { customRoleName }).then((r) => r.data),

  // Phase 3b linked clients
  getLinkedClients: (teamId: string): Promise<{ clients: TeamClientRelationship[] }> =>
    client.get(`/api/teams/${teamId}/clients`).then((r) => r.data),

  createLinkedClient: (
    teamId: string,
    payload: { clientUserId: string; accessLevel?: 'view_assigned' | 'view_all' | 'collaborate'; projectLabel?: string }
  ): Promise<{ client: TeamClientRelationship }> =>
    client.post(`/api/teams/${teamId}/clients`, payload).then((r) => r.data),

  updateLinkedClient: (
    teamId: string,
    clientId: string,
    payload: { accessLevel?: 'view_assigned' | 'view_all' | 'collaborate'; projectLabel?: string }
  ): Promise<{ client: TeamClientRelationship }> =>
    client.patch(`/api/teams/${teamId}/clients/${clientId}`, payload).then((r) => r.data),

  removeLinkedClient: (teamId: string, clientId: string): Promise<{ success: boolean }> =>
    client.delete(`/api/teams/${teamId}/clients/${clientId}`).then((r) => r.data),

  getClientAccessSnapshot: (
    teamId: string,
    clientId: string
  ): Promise<{ accessLevel: string; projectLabel?: string; team: { id: string; name: string }; assignedWork: unknown[] }> =>
    client.get(`/api/teams/${teamId}/clients/${clientId}/access`).then((r) => r.data),

  // Phase 3a organizations
  getMyOrganizations: (): Promise<{ organizations: OrganizationSummary[] }> =>
    client.get('/api/organizations/mine').then((r) => r.data),

  createOrganization: (payload: { name: string; description?: string; logo?: string; website?: string }) =>
    client.post('/api/organizations', payload).then((r) => r.data),
};
