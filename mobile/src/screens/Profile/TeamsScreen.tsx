import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { teamsApi } from '../../api/endpoints/teamsApi';
import { ProfileStackParamList } from '../../types/navigation';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Teams'>;

export default function TeamsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<'client_team' | 'agency'>('client_team');
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDescription, setDeptDescription] = useState('');
  const [teamToAddId, setTeamToAddId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const teamsQuery = useQuery({
    queryKey: ['mobile-teams'],
    queryFn: () => teamsApi.getMyTeams(),
  });

  const invitesQuery = useQuery({
    queryKey: ['mobile-team-invitations'],
    queryFn: () => teamsApi.getPendingInvitations(),
  });

  const orgsQuery = useQuery({
    queryKey: ['mobile-organizations'],
    queryFn: () => teamsApi.getMyOrganizations(),
  });

  const orgDetailQuery = useQuery({
    queryKey: ['mobile-organization-detail', selectedOrgId],
    queryFn: () => teamsApi.getOrganization(selectedOrgId),
    enabled: !!selectedOrgId,
  });

  const queryError = (teamsQuery.error as any)?.response?.data?.error
    || (invitesQuery.error as any)?.response?.data?.error
    || (orgsQuery.error as any)?.response?.data?.error
    || (orgDetailQuery.error as any)?.response?.data?.error;


  const createMutation = useMutation({
    mutationFn: () => teamsApi.createTeam({ name: name.trim(), type }),
    onSuccess: () => {
      setMessage('Team created');
      setError('');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to create team');
      setMessage('');
    },
  });

  const invitationMutation = useMutation({
    mutationFn: ({ teamId, action }: { teamId: string; action: 'accept' | 'decline' }) =>
      action === 'accept' ? teamsApi.acceptInvitation(teamId) : teamsApi.declineInvitation(teamId),
    onSuccess: () => {
      setMessage('Invitation updated');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['mobile-team-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to update invitation');
      setMessage('');
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: () => teamsApi.createOrganization({ name: orgName.trim(), description: orgDescription.trim() }),
    onSuccess: (res: any) => {
      const createdOrgId = res?.organization?._id || '';
      setMessage('Organization created');
      setError('');
      setOrgName('');
      setOrgDescription('');
      if (createdOrgId) setSelectedOrgId(createdOrgId);
      queryClient.invalidateQueries({ queryKey: ['mobile-organizations'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to create organization');
      setMessage('');
    },
  });

  const addDepartmentMutation = useMutation({
    mutationFn: () => teamsApi.addOrganizationDepartment(selectedOrgId, { name: deptName.trim(), description: deptDescription.trim() }),
    onSuccess: () => {
      setDeptName('');
      setDeptDescription('');
      setMessage('Department added');
      setError('');
      orgDetailQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['mobile-organizations'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to add department');
      setMessage('');
    },
  });

  const removeDepartmentMutation = useMutation({
    mutationFn: (deptId: string) => teamsApi.removeOrganizationDepartment(selectedOrgId, deptId),
    onSuccess: () => {
      setMessage('Department removed');
      setError('');
      orgDetailQuery.refetch();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to remove department');
      setMessage('');
    },
  });

  const addTeamToOrgMutation = useMutation({
    mutationFn: () => teamsApi.addTeamToOrganization(selectedOrgId, teamToAddId),
    onSuccess: () => {
      setTeamToAddId('');
      setMessage('Team added to organization');
      setError('');
      orgDetailQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-organizations'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to add team to organization');
      setMessage('');
    },
  });

  const removeTeamFromOrgMutation = useMutation({
    mutationFn: (teamId: string) => teamsApi.removeTeamFromOrganization(selectedOrgId, teamId),
    onSuccess: () => {
      setMessage('Team removed from organization');
      setError('');
      orgDetailQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-organizations'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to remove team from organization');
      setMessage('');
    },
  });

  const isRefreshing = teamsQuery.isRefetching || invitesQuery.isRefetching || orgsQuery.isRefetching;
  const isLoading = teamsQuery.isLoading || invitesQuery.isLoading;

  const onRefresh = () => {
    setError('');
    setMessage('');
    teamsQuery.refetch();
    invitesQuery.refetch();
    orgsQuery.refetch();
  };

  const onCreateTeam = () => {
    if (!name.trim()) {
      setError('Team name is required');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    createMutation.mutate();
  };

  const onCreateOrganization = () => {
    if (!orgName.trim()) {
      setError('Organization name is required');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    createOrgMutation.mutate();
  };

  const onAddDepartment = () => {
    if (!selectedOrgId) return;
    if (!deptName.trim()) {
      setError('Department name is required');
      return;
    }
    setError('');
    setMessage('');
    addDepartmentMutation.mutate();
  };

  const onAddTeamToOrg = () => {
    if (!selectedOrgId || !teamToAddId) {
      setError('Select a team to add');
      return;
    }
    setError('');
    setMessage('');
    addTeamToOrgMutation.mutate();
  };

  const teams = teamsQuery.data?.teams || [];
  const invitations = invitesQuery.data?.invitations || [];
  const organizations = orgsQuery.data?.organizations || [];
  const selectedOrg = orgDetailQuery.data?.organization;
  const selectedOrgTeams = orgDetailQuery.data?.teams || [];

  const availableTeamsForOrg = useMemo(() => {
    if (!selectedOrg) return [];
    const inOrg = new Set(selectedOrgTeams.map((t) => t._id));
    return teams.filter((t) => !inOrg.has(t._id));
  }, [selectedOrg, selectedOrgTeams, teams]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create Team</Text>
          <Input
            label="Team Name"
            value={name}
            onChangeText={setName}
            placeholder="My Team"
          />

          <View style={styles.optionRow}>
            <Button
              label="Client Team"
              size="sm"
              variant={type === 'client_team' ? 'primary' : 'secondary'}
              onPress={() => setType('client_team')}
              style={{ flex: 1 }}
            />
            <Button
              label="Agency"
              size="sm"
              variant={type === 'agency' ? 'primary' : 'secondary'}
              onPress={() => setType('agency')}
              style={{ flex: 1 }}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && queryError ? <Text style={styles.error}>{queryError}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          <Button
            label="Create Team"
            onPress={onCreateTeam}
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
            fullWidth
          />
        </View>

        {invitations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            {invitations.map((invite) => (
              <View key={invite._id} style={styles.teamRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{invite.name}</Text>
                  <Text style={styles.teamMeta}>{invite.type === 'agency' ? 'Agency' : 'Client Team'}</Text>
                </View>
                <View style={styles.actionsRow}>
                  <Button
                    label="Accept"
                    size="sm"
                    variant="success"
                    onPress={() => {
                      setError('');
                      setMessage('');
                      invitationMutation.mutate({ teamId: invite._id, action: 'accept' });
                    }}
                    disabled={invitationMutation.isPending}
                  />
                  <Button
                    label="Decline"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setError('');
                      setMessage('');
                      invitationMutation.mutate({ teamId: invite._id, action: 'decline' });
                    }}
                    disabled={invitationMutation.isPending}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Organizations</Text>
          <Input
            label="Organization Name"
            value={orgName}
            onChangeText={setOrgName}
            placeholder="Acme Group"
          />
          <Input
            label="Description (optional)"
            value={orgDescription}
            onChangeText={setOrgDescription}
            placeholder="What this org does"
          />
          <Button
            label="Create Organization"
            onPress={onCreateOrganization}
            loading={createOrgMutation.isPending}
            disabled={createOrgMutation.isPending}
            fullWidth
          />

          {!organizations.length ? (
            <Text style={styles.teamMeta}>No organizations yet.</Text>
          ) : (
            organizations.map((org) => (
              <View key={org._id} style={styles.teamRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{org.name}</Text>
                  <Text style={styles.teamMeta}>@{org.slug}</Text>
                  <Text style={styles.teamMeta}>{(org.teams || []).length} teams</Text>
                </View>
                <Button
                  label={selectedOrgId === org._id ? 'Close' : 'Manage'}
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelectedOrgId(selectedOrgId === org._id ? '' : org._id)}
                />
              </View>
            ))
          )}
        </View>

        {selectedOrgId ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Organization Detail</Text>
            {orgDetailQuery.isLoading ? <Text style={styles.teamMeta}>Loading organization…</Text> : null}
            {!!selectedOrg && (
              <>
                <Text style={styles.teamName}>{selectedOrg.name}</Text>
                {!!selectedOrg.description && <Text style={styles.teamMeta}>{selectedOrg.description}</Text>}

                <Text style={styles.sectionTitle}>Departments</Text>
                <Input label="Department name" value={deptName} onChangeText={setDeptName} placeholder="Operations" />
                <Input label="Description (optional)" value={deptDescription} onChangeText={setDeptDescription} placeholder="What this department handles" />
                <Button
                  label="Add Department"
                  size="sm"
                  onPress={onAddDepartment}
                  loading={addDepartmentMutation.isPending}
                  disabled={addDepartmentMutation.isPending}
                />
                {(selectedOrg.departments || []).map((dept) => (
                  <View key={dept._id} style={styles.teamRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{dept.name}</Text>
                      {!!dept.description && <Text style={styles.teamMeta}>{dept.description}</Text>}
                    </View>
                    <Button
                      label="Remove"
                      size="sm"
                      variant="secondary"
                      onPress={() => removeDepartmentMutation.mutate(dept._id)}
                      disabled={removeDepartmentMutation.isPending}
                    />
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Teams in Organization</Text>
                {!selectedOrgTeams.length ? <Text style={styles.teamMeta}>No teams linked yet.</Text> : null}
                {selectedOrgTeams.map((team) => (
                  <View key={team._id} style={styles.teamRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamMeta}>{team.type === 'agency' ? 'Agency' : 'Client Team'}</Text>
                    </View>
                    <Button
                      label="Remove"
                      size="sm"
                      variant="secondary"
                      onPress={() => removeTeamFromOrgMutation.mutate(team._id)}
                      disabled={removeTeamFromOrgMutation.isPending}
                    />
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Add Existing Team</Text>
                <View style={styles.optionRow}>
                  {availableTeamsForOrg.map((team) => (
                    <Button
                      key={team._id}
                      label={team.name}
                      size="sm"
                      variant={teamToAddId === team._id ? 'primary' : 'secondary'}
                      onPress={() => setTeamToAddId(team._id)}
                    />
                  ))}
                </View>
                <Button
                  label="Add Team to Organization"
                  size="sm"
                  onPress={onAddTeamToOrg}
                  loading={addTeamToOrgMutation.isPending}
                  disabled={addTeamToOrgMutation.isPending || !teamToAddId}
                />
              </>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>My Teams</Text>
          {!teams.length ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{isLoading ? 'Loading teams…' : 'No teams yet'}</Text>
              <Text style={styles.emptySub}>Create one above or accept an invite.</Text>
            </View>
          ) : (
            teams.map((team) => {
              const activeCount = (team.members || []).filter((m) => m.status === 'active').length;
              return (
                <View key={team._id} style={styles.teamRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamMeta}>{team.type === 'agency' ? 'Agency' : 'Client Team'}</Text>
                    <Text style={styles.teamMeta}>{activeCount} active members</Text>
                  </View>
                  <Button
                    label="Open"
                    size="sm"
                    variant="secondary"
                    onPress={() => navigation.navigate('TeamDetail', { teamId: team._id })}
                  />
                </View>
              );
            })
          )}
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
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  optionRow: { flexDirection: 'row', gap: spacing.xs },
  error: { ...typography.caption, color: colors.danger },
  success: { ...typography.caption, color: colors.success },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.xs },
  teamName: { ...typography.body, fontWeight: '700', color: colors.textDark },
  teamMeta: { ...typography.caption, color: colors.textSecondary },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h4, marginBottom: spacing.xs },
  emptySub: { ...typography.bodySmall, color: colors.textMuted },
});
