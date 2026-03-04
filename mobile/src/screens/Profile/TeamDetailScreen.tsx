import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { TeamAuditLog, TeamClientRelationship, TeamCustomRole, TeamPermissionKey, teamsApi, TeamMember, TeamMemberRole } from '../../api/endpoints/teamsApi';
import { ProfileStackParamList } from '../../types/navigation';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TeamDetail'>;

const ROLE_OPTIONS: Array<{ label: string; value: 'member' | 'manager' | 'admin' }> = [
  { label: 'Member', value: 'member' },
  { label: 'Manager', value: 'manager' },
  { label: 'Admin', value: 'admin' },
];

const PERMISSION_OPTIONS: Array<{ key: TeamPermissionKey; label: string }> = [
  { key: 'manage_members', label: 'Manage Members' },
  { key: 'manage_billing', label: 'Manage Billing' },
  { key: 'approve_orders', label: 'Approve Orders' },
  { key: 'create_jobs', label: 'Post Jobs' },
  { key: 'manage_services', label: 'Manage Services' },
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'message_clients', label: 'Message Clients' },
  { key: 'assign_work', label: 'Assign Work' },
];

export default function TeamDetailScreen({ route }: Props) {
  const { teamId } = route.params;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'manager' | 'admin'>('member');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<TeamPermissionKey[]>([]);
  const [clientUserId, setClientUserId] = useState('');
  const [clientProjectLabel, setClientProjectLabel] = useState('');
  const [clientAccessLevel, setClientAccessLevel] = useState<'view_assigned' | 'view_all' | 'collaborate'>('view_assigned');
  const [editingRoleId, setEditingRoleId] = useState('');
  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingRolePermissions, setEditingRolePermissions] = useState<TeamPermissionKey[]>([]);
  const [editingClientId, setEditingClientId] = useState('');
  const [editingClientLabel, setEditingClientLabel] = useState('');

  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['mobile-team-detail', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
  });

  const team = data?.team;

  const myMember = useMemo(() => {
    if (!team?.members || !user?._id) return null;
    return team.members.find((m) => {
      const memberId = typeof m.user === 'string' ? m.user : m.user?._id;
      return memberId === user._id;
    });
  }, [team?.members, user?._id]);

  const myRole = ((team?.currentUserRole || myMember?.role || 'member') as TeamMemberRole);
  const isOwner = Boolean(team?.currentUserIsOwner || team?.currentUserCanDelete || myRole === 'owner');
  const isAdmin = myRole === 'admin';
  const canManageMembers = Boolean(team?.currentUserCanManageMembers || isOwner || isAdmin || myRole === 'manager');

  const inviteMutation = useMutation({
    mutationFn: () => teamsApi.inviteMember(teamId, { email: inviteEmail.trim(), role: inviteRole }),
    onSuccess: (res) => {
      setMessage(res.message || 'Invitation sent');
      setError('');
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['mobile-team-detail', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to send invitation');
      setMessage('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: (res) => {
      setMessage(res.message || 'Member removed');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['mobile-team-detail', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to remove member');
      setMessage('');
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: (targetUserId: string) => teamsApi.transferOwnership(teamId, targetUserId),
    onSuccess: (res) => {
      setMessage(res.message || 'Ownership transferred');
      setError('');
      setTransferTargetUserId('');
      queryClient.invalidateQueries({ queryKey: ['mobile-team-detail', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-team-audit', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to transfer ownership');
      setMessage('');
    },
  });

  const { data: auditData, refetch: refetchAudit, isFetching: auditLoading } = useQuery({
    queryKey: ['mobile-team-audit', teamId],
    queryFn: () => teamsApi.getAuditLogs(teamId, { page: 1, limit: 20 }),
    enabled: isOwner || isAdmin,
  });

  const { data: customRolesData, refetch: refetchCustomRoles } = useQuery({
    queryKey: ['mobile-team-custom-roles', teamId],
    queryFn: () => teamsApi.getCustomRoles(teamId),
    enabled: isOwner || isAdmin,
  });

  const { data: clientsData, refetch: refetchClients } = useQuery({
    queryKey: ['mobile-team-clients', teamId],
    queryFn: () => teamsApi.getLinkedClients(teamId),
    enabled: isOwner || isAdmin,
  });

  const { data: spendControlsData, refetch: refetchSpendControls } = useQuery({
    queryKey: ['mobile-team-spend-controls', teamId],
    queryFn: () => teamsApi.getSpendControls(teamId),
    enabled: isOwner || isAdmin,
  });

  const createCustomRoleMutation = useMutation({
    mutationFn: (payload: { name: string; permissions: TeamPermissionKey[] }) => teamsApi.createCustomRole(teamId, payload),
    onSuccess: () => {
      setNewRoleName('');
      setNewRolePermissions([]);
      refetchCustomRoles();
      refetch();
      setMessage('Custom role created');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to create custom role');
      setMessage('');
    },
  });

  const updateCustomRoleMutation = useMutation({
    mutationFn: (payload: { roleId: string; name: string; permissions: TeamPermissionKey[] }) =>
      teamsApi.updateCustomRole(teamId, payload.roleId, { name: payload.name, permissions: payload.permissions }),
    onSuccess: () => {
      setEditingRoleId('');
      setEditingRoleName('');
      setEditingRolePermissions([]);
      refetchCustomRoles();
      refetch();
      setMessage('Custom role updated');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to update custom role');
      setMessage('');
    },
  });

  const deleteCustomRoleMutation = useMutation({
    mutationFn: (roleId: string) => teamsApi.deleteCustomRole(teamId, roleId),
    onSuccess: () => {
      refetchCustomRoles();
      refetch();
      setMessage('Custom role deleted');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to delete custom role');
      setMessage('');
    },
  });

  const assignCustomRoleMutation = useMutation({
    mutationFn: ({ userId, customRoleName }: { userId: string; customRoleName: string }) =>
      teamsApi.assignMemberCustomRole(teamId, userId, customRoleName),
    onSuccess: () => {
      refetch();
      setMessage('Member custom role updated');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to update member custom role');
      setMessage('');
    },
  });

  const linkClientMutation = useMutation({
    mutationFn: (payload: { clientUserId: string; projectLabel?: string; accessLevel?: 'view_assigned' | 'view_all' | 'collaborate' }) => teamsApi.createLinkedClient(teamId, payload),
    onSuccess: () => {
      setClientUserId('');
      setClientProjectLabel('');
      setClientAccessLevel('view_assigned');
      refetchClients();
      setMessage('Client linked');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to link client');
      setMessage('');
    },
  });

  const updateLinkedClientMutation = useMutation({
    mutationFn: ({ clientId, accessLevel, projectLabel }: { clientId: string; accessLevel: 'view_assigned' | 'view_all' | 'collaborate'; projectLabel?: string }) =>
      teamsApi.updateLinkedClient(teamId, clientId, { accessLevel, projectLabel }),
    onSuccess: () => {
      refetchClients();
      setMessage('Linked client updated');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to update linked client');
      setMessage('');
    },
  });

  const unlinkClientMutation = useMutation({
    mutationFn: (linkedClientId: string) => teamsApi.removeLinkedClient(teamId, linkedClientId),
    onSuccess: () => {
      refetchClients();
      setMessage('Client unlinked');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to unlink client');
      setMessage('');
    },
  });

  const updateSpendControlsMutation = useMutation({
    mutationFn: (payload: { spendControls: any; approvalThresholds: any }) => teamsApi.updateSpendControls(teamId, payload),
    onSuccess: () => {
      refetchSpendControls();
      setMessage('Team controls updated');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to update team controls');
      setMessage('');
    },
  });

  const onInvite = () => {
    if (!inviteEmail.trim()) {
      setError('Email is required');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    inviteMutation.mutate();
  };

  const onRemoveMember = (member: TeamMember) => {
    const memberId = typeof member.user === 'string' ? member.user : member.user?._id;
    if (!memberId) return;

    Alert.alert('Remove member?', 'This user will lose access to the team.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMemberMutation.mutate(memberId),
      },
    ]);
  };

  const activeMembers = (team?.members || []).filter((m) => m.status === 'active');
  const transferCandidates = activeMembers.filter((m) => m.role !== 'owner');
  const auditLogs: TeamAuditLog[] = auditData?.logs || [];
  const customRoles: TeamCustomRole[] = customRolesData?.customRoles || [];
  const linkedClients: TeamClientRelationship[] = clientsData?.clients || [];

  const toggleRolePermission = (permissionKey: TeamPermissionKey) => {
    setNewRolePermissions((prev) => (
      prev.includes(permissionKey) ? prev.filter((p) => p !== permissionKey) : [...prev, permissionKey]
    ));
  };

  const onCreateCustomRole = () => {
    const name = newRoleName.trim();
    if (!name) {
      setError('Custom role name is required');
      return;
    }

    if (!newRolePermissions.length) {
      setError('Pick at least one permission');
      return;
    }

    createCustomRoleMutation.mutate({ name, permissions: newRolePermissions });
  };

  const onLinkClient = () => {
    if (!clientUserId.trim()) {
      setError('Client user id is required');
      return;
    }
    linkClientMutation.mutate({
      clientUserId: clientUserId.trim(),
      accessLevel: clientAccessLevel,
      projectLabel: clientProjectLabel.trim(),
    });
  };

  const startEditRole = (role: TeamCustomRole) => {
    setEditingRoleId(role._id);
    setEditingRoleName(role.name);
    setEditingRolePermissions(role.permissions || []);
  };

  const toggleEditingRolePermission = (permissionKey: TeamPermissionKey) => {
    setEditingRolePermissions((prev) => (
      prev.includes(permissionKey) ? prev.filter((p) => p !== permissionKey) : [...prev, permissionKey]
    ));
  };

  const saveEditedRole = () => {
    if (!editingRoleId || !editingRoleName.trim()) return;
    if (!editingRolePermissions.length) {
      setError('Pick at least one permission for edited role');
      return;
    }
    updateCustomRoleMutation.mutate({
      roleId: editingRoleId,
      name: editingRoleName.trim(),
      permissions: editingRolePermissions,
    });
  };

  const saveClientLabel = (clientId: string, accessLevel: 'view_assigned' | 'view_all' | 'collaborate') => {
    updateLinkedClientMutation.mutate({ clientId, accessLevel, projectLabel: editingClientLabel.trim() });
    setEditingClientId('');
    setEditingClientLabel('');
  };

  const onTransferOwnership = () => {
    if (!transferTargetUserId) {
      setError('Pick a member to transfer ownership to');
      return;
    }

    Alert.alert(
      'Transfer ownership?',
      'This will remove your owner privileges and cannot be auto-reverted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: () => transferOwnershipMutation.mutate(transferTargetUserId),
        },
      ]
    );
  };

  const onRefreshAll = () => {
    refetch();
    if (isOwner || isAdmin) {
      refetchAudit();
      refetchCustomRoles();
      refetchClients();
      refetchSpendControls();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching || auditLoading} onRefresh={onRefreshAll} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.name}>{team?.name || (isLoading ? 'Loading team…' : 'Team')}</Text>
          <Text style={styles.meta}>{team?.type === 'agency' ? 'Agency' : 'Client Team'}</Text>
          {!!team?.description && <Text style={styles.description}>{team.description}</Text>}
          {team?.transferState && team.transferState !== 'idle' && (
            <Text style={styles.warning}>Ownership transfer is currently in progress.</Text>
          )}
        </View>

        {canManageMembers && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Invite Member</Text>
            <Input
              label="Email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="teammate@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.optionRow}>
              {ROLE_OPTIONS.map((option) => {
                const selected = inviteRole === option.value;
                return (
                  <Button
                    key={option.value}
                    label={option.label}
                    size="sm"
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() => setInviteRole(option.value)}
                    style={{ flex: 1 }}
                  />
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}

            <Button
              label="Send Invite"
              onPress={onInvite}
              loading={inviteMutation.isPending}
              disabled={inviteMutation.isPending}
              fullWidth
            />
          </View>
        )}

        {isOwner && transferCandidates.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Transfer Ownership</Text>
            <Text style={styles.description}>Choose an active member to become the new owner.</Text>
            <View style={styles.optionRow}>
              {transferCandidates.map((member) => {
                const memberId = typeof member.user === 'string' ? member.user : member.user?._id || '';
                const selected = transferTargetUserId === memberId;
                const name = typeof member.user === 'string'
                  ? member.user
                  : `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || member.user?.email || 'Member';
                return (
                  <Button
                    key={memberId}
                    label={name}
                    size="sm"
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() => setTransferTargetUserId(memberId)}
                    style={{ flex: 1 }}
                  />
                );
              })}
            </View>
            <Button
              label="Transfer Ownership"
              variant="danger"
              onPress={onTransferOwnership}
              loading={transferOwnershipMutation.isPending}
              disabled={!transferTargetUserId || transferOwnershipMutation.isPending || team?.transferState === 'applying' || team?.transferState === 'pending'}
              fullWidth
            />
          </View>
        )}

        {(isOwner || isAdmin) && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Audit Trail</Text>
              <Button label="Refresh" size="sm" variant="secondary" onPress={() => refetchAudit()} loading={auditLoading} />
            </View>
            {auditLoading ? <Text style={styles.meta}>Loading audit logs…</Text> : null}
            {!auditLoading && !auditLogs.length ? <Text style={styles.empty}>No audit events yet.</Text> : null}
            {auditLogs.map((log) => (
              <View key={log._id} style={styles.auditRow}>
                <Text style={styles.memberName}>{String(log.action || '').replaceAll('_', ' ')}</Text>
                <Text style={styles.memberMeta}>
                  {(log.actor?.firstName || 'User')} {(log.actor?.lastName || '')} • {new Date(log.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {(isOwner || isAdmin) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Custom Roles</Text>
            <Input
              label="Role Name"
              value={newRoleName}
              onChangeText={setNewRoleName}
              placeholder="Finance Reviewer"
            />
            <Text style={styles.meta}>Permissions</Text>
            <View style={styles.optionRow}>
              {PERMISSION_OPTIONS.map((perm) => (
                <Button
                  key={perm.key}
                  label={perm.label}
                  size="sm"
                  variant={newRolePermissions.includes(perm.key) ? 'primary' : 'secondary'}
                  onPress={() => toggleRolePermission(perm.key)}
                />
              ))}
            </View>
            <Button
              label="Create Custom Role"
              onPress={onCreateCustomRole}
              loading={createCustomRoleMutation.isPending}
              disabled={createCustomRoleMutation.isPending}
              fullWidth
            />

            {customRoles.map((role) => (
              <View key={role._id} style={styles.memberRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{role.name}</Text>
                  <Text style={styles.memberMeta}>{(role.permissions || []).join(', ') || 'No permissions'}</Text>

                  {editingRoleId === role._id && (
                    <View style={{ marginTop: spacing.xs }}>
                      <Input
                        label="Edit role name"
                        value={editingRoleName}
                        onChangeText={setEditingRoleName}
                        placeholder="Role name"
                      />
                      <View style={styles.optionRow}>
                        {PERMISSION_OPTIONS.map((perm) => (
                          <Button
                            key={`${role._id}-${perm.key}`}
                            label={perm.label}
                            size="sm"
                            variant={editingRolePermissions.includes(perm.key) ? 'primary' : 'secondary'}
                            onPress={() => toggleEditingRolePermission(perm.key)}
                          />
                        ))}
                      </View>
                      <View style={styles.optionRow}>
                        <Button
                          label="Save"
                          size="sm"
                          onPress={saveEditedRole}
                          loading={updateCustomRoleMutation.isPending}
                          disabled={updateCustomRoleMutation.isPending}
                        />
                        <Button
                          label="Cancel"
                          size="sm"
                          variant="secondary"
                          onPress={() => {
                            setEditingRoleId('');
                            setEditingRoleName('');
                            setEditingRolePermissions([]);
                          }}
                        />
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.optionRow}>
                  <Button
                    label="Edit"
                    variant="secondary"
                    size="sm"
                    onPress={() => startEditRole(role)}
                  />
                  <Button
                    label="Delete"
                    variant="danger"
                    size="sm"
                    onPress={() => deleteCustomRoleMutation.mutate(role._id)}
                    loading={deleteCustomRoleMutation.isPending}
                  />
                </View>
              </View>
            ))}
            {!customRoles.length && <Text style={styles.empty}>No custom roles yet.</Text>}
          </View>
        )}

        {(isOwner || isAdmin) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Linked Clients</Text>
            <Input
              label="Client User ID"
              value={clientUserId}
              onChangeText={setClientUserId}
              placeholder="Paste client user id"
              autoCapitalize="none"
            />
            <Input
              label="Project Label (optional)"
              value={clientProjectLabel}
              onChangeText={setClientProjectLabel}
              placeholder="Kitchen Remodel"
            />
            <Text style={styles.meta}>Access Level</Text>
            <View style={styles.optionRow}>
              <Button label="View Assigned" size="sm" variant={clientAccessLevel === 'view_assigned' ? 'primary' : 'secondary'} onPress={() => setClientAccessLevel('view_assigned')} />
              <Button label="View All" size="sm" variant={clientAccessLevel === 'view_all' ? 'primary' : 'secondary'} onPress={() => setClientAccessLevel('view_all')} />
              <Button label="Collaborate" size="sm" variant={clientAccessLevel === 'collaborate' ? 'primary' : 'secondary'} onPress={() => setClientAccessLevel('collaborate')} />
            </View>
            <Button
              label="Link Client"
              onPress={onLinkClient}
              loading={linkClientMutation.isPending}
              disabled={linkClientMutation.isPending}
              fullWidth
            />

            {linkedClients.map((rel) => {
              const userObj = typeof rel.client === 'string' ? null : rel.client;
              const relClientId = typeof rel.client === 'string' ? rel.client : rel.client?._id || '';
              const relLabel = `${userObj?.firstName || ''} ${userObj?.lastName || ''}`.trim() || userObj?.email || relClientId;
              return (
                <View key={rel._id} style={styles.memberRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{relLabel}</Text>
                    <Text style={styles.memberMeta}>{rel.accessLevel}{rel.projectLabel ? ` • ${rel.projectLabel}` : ''}</Text>
                    <View style={[styles.optionRow, { marginTop: spacing.xs }]}> 
                      <Button
                        label="Assigned"
                        size="sm"
                        variant={rel.accessLevel === 'view_assigned' ? 'primary' : 'secondary'}
                        onPress={() => updateLinkedClientMutation.mutate({ clientId: relClientId, accessLevel: 'view_assigned', projectLabel: rel.projectLabel || '' })}
                        disabled={updateLinkedClientMutation.isPending}
                      />
                      <Button
                        label="All"
                        size="sm"
                        variant={rel.accessLevel === 'view_all' ? 'primary' : 'secondary'}
                        onPress={() => updateLinkedClientMutation.mutate({ clientId: relClientId, accessLevel: 'view_all', projectLabel: rel.projectLabel || '' })}
                        disabled={updateLinkedClientMutation.isPending}
                      />
                      <Button
                        label="Collaborate"
                        size="sm"
                        variant={rel.accessLevel === 'collaborate' ? 'primary' : 'secondary'}
                        onPress={() => updateLinkedClientMutation.mutate({ clientId: relClientId, accessLevel: 'collaborate', projectLabel: rel.projectLabel || '' })}
                        disabled={updateLinkedClientMutation.isPending}
                      />
                    </View>
                    {editingClientId === relClientId ? (
                      <View style={{ marginTop: spacing.xs }}>
                        <Input
                          label="Edit project label"
                          value={editingClientLabel}
                          onChangeText={setEditingClientLabel}
                          placeholder="Project label"
                        />
                        <View style={styles.optionRow}>
                          <Button label="Save Label" size="sm" onPress={() => saveClientLabel(relClientId, rel.accessLevel)} />
                          <Button label="Cancel" size="sm" variant="secondary" onPress={() => { setEditingClientId(''); setEditingClientLabel(''); }} />
                        </View>
                      </View>
                    ) : (
                      <Button
                        label="Edit Label"
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setEditingClientId(relClientId);
                          setEditingClientLabel(rel.projectLabel || '');
                        }}
                      />
                    )}
                  </View>
                  <Button
                    label="Unlink"
                    variant="danger"
                    size="sm"
                    onPress={() => unlinkClientMutation.mutate(relClientId)}
                    loading={unlinkClientMutation.isPending}
                  />
                </View>
              );
            })}
            {!linkedClients.length && <Text style={styles.empty}>No linked clients.</Text>}
          </View>
        )}

        {(isOwner || isAdmin) && spendControlsData ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Team Controls</Text>
            <Text style={styles.memberMeta}>Settings source: {spendControlsData.effectiveSource || 'team'}</Text>
            <Text style={styles.memberMeta}>
              Monthly cap: {spendControlsData.spendControls.monthlyCapEnabled ? `$${Number(spendControlsData.spendControls.monthlyCap || 0).toFixed(2)}` : 'disabled'}
            </Text>
            <Text style={styles.memberMeta}>
              Payout approval: {spendControlsData.approvalThresholds.payoutRequiresApproval ? `on (threshold $${Number(spendControlsData.approvalThresholds.payoutThresholdAmount || 0).toFixed(2)})` : 'off'}
            </Text>
            {isOwner ? (
              <View style={styles.optionRow}>
                <Button
                  label={spendControlsData.spendControls.monthlyCapEnabled ? 'Disable cap' : 'Enable cap'}
                  size="sm"
                  variant="secondary"
                  onPress={() => updateSpendControlsMutation.mutate({
                    spendControls: {
                      ...spendControlsData.spendControls,
                      monthlyCapEnabled: !spendControlsData.spendControls.monthlyCapEnabled,
                    },
                    approvalThresholds: spendControlsData.approvalThresholds,
                  })}
                  loading={updateSpendControlsMutation.isPending}
                />
                <Button
                  label={spendControlsData.approvalThresholds.payoutRequiresApproval ? 'Disable payout approvals' : 'Enable payout approvals'}
                  size="sm"
                  variant="secondary"
                  onPress={() => updateSpendControlsMutation.mutate({
                    spendControls: spendControlsData.spendControls,
                    approvalThresholds: {
                      ...spendControlsData.approvalThresholds,
                      payoutRequiresApproval: !spendControlsData.approvalThresholds.payoutRequiresApproval,
                    },
                  })}
                  loading={updateSpendControlsMutation.isPending}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Members ({activeMembers.length})</Text>
          {activeMembers.map((member) => {
            const memberId = typeof member.user === 'string' ? member.user : member.user?._id;
            const fullName = typeof member.user === 'string'
              ? member.user
              : `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || member.user?.email || 'Member';
            const canRemove = canManageMembers && member.role !== 'owner' && memberId !== user?._id;

            return (
              <View key={`${memberId}-${member.role}`} style={styles.memberRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{fullName}</Text>
                  <Text style={styles.memberMeta}>{member.role}{member.customRoleName ? ` • custom: ${member.customRoleName}` : ''}</Text>
                  {(isOwner || isAdmin) && member.role !== 'owner' && customRoles.length > 0 && memberId ? (
                    <View style={[styles.optionRow, { marginTop: spacing.xs }]}> 
                      <Button
                        label="Clear custom role"
                        size="sm"
                        variant="secondary"
                        onPress={() => assignCustomRoleMutation.mutate({ userId: memberId, customRoleName: '' })}
                      />
                      {customRoles.map((role) => (
                        <Button
                          key={`${memberId}-${role._id}`}
                          label={role.name}
                          size="sm"
                          variant={member.customRoleName === role.name ? 'primary' : 'secondary'}
                          onPress={() => assignCustomRoleMutation.mutate({ userId: memberId, customRoleName: role.name })}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
                {canRemove ? (
                  <Button
                    label="Remove"
                    variant="danger"
                    size="sm"
                    onPress={() => onRemoveMember(member)}
                    loading={removeMemberMutation.isPending}
                  />
                ) : null}
              </View>
            );
          })}
          {!activeMembers.length && <Text style={styles.empty}>No active members.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  name: { ...typography.h3, color: colors.textDark },
  meta: { ...typography.caption, color: colors.textSecondary },
  description: { ...typography.bodySmall, color: colors.textSecondary },
  warning: { ...typography.caption, color: '#b45309' },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  optionRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { ...typography.caption, color: colors.danger },
  success: { ...typography.caption, color: colors.success },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  memberName: { ...typography.body, color: colors.textDark, fontWeight: '600' },
  memberMeta: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize' },
  auditRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  empty: { ...typography.bodySmall, color: colors.textMuted },
});
